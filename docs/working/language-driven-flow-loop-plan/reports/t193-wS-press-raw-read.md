# t193-wS: a press must not hand the model the extension's raw page snapshot

## Outcome

Done. A node's `read` no longer carries the extension's own record of the page: `snapshot`, `element`, `visualTarget`, `resolution` and `structure` are removed. Everything else a node answered still reaches the model whole, with no caps. That includes `extracted`, `extraction` with `rejectedRows`, `validation`, `message`, `url`, `title`, `dialog` and `checkWait`. `recorded`, which is what replay uses, is unchanged.

## What changed and why

### History (step 1)

- `ee25ac9e` (2026-09-12): the extension's `buildResult` attaches a raw `snapshot` to every result while `captureSettings.snapshots` is on, and that setting defaults to `true`. The relevant code is `apps/extension/src/content/action-runtime/results.ts:464` and `content/capture-settings.ts:31`. As a result, every successful press, type, select or navigate payload has carried the raw page since then. `client/gateway-mapping.ts:301` (`webAutomationActionResultPayload`) forwards `element`, `visualTarget`, `snapshot` and `resolution` alongside the read fields.
- `2e16cf00` (2026-09-22, t082): `run.ts` first returned `read = node.proposes ? webNodeReadResult(payload, budget/4) : undefined`. Every node except `capture_snapshot` proposes, so presses also returned their payload. The cap then was 8 items, depth 6, 24 keys, 200-character strings and a quarter of the byte budget, so only a trimmed raw snapshot got through.
- `b507d5fa` (2026-09-30 16:30, t200, "nothing capped"): removed those caps. From this commit on, the raw snapshot arrived whole in press payloads. In `run-mup2i28c-6c7fc209` that was 199,305 bytes.
- The comment at `run.ts:386-391` ("Never for the look itself…") describes only the look. The look actually returns before that line, so the `proposes` gate never kept a raw snapshot out of anything.

### Genuine reads versus mutating payloads

All nodes share one payload shape (`WebAutomationActionResult`, `domain/src/actions/types.ts:466`).

- **The read fields:** `extracted` (extract, wait-for-text and similar reads), and `extraction` (the `extract_list` account, plus the rejected samples that `rejected-rows.ts` turns into `rejectedRows`). `dialog` and `checkWait` are the node's own outcome.
- **What a mutating node's payload holds:**
  - `commandId`, `actionType`, `status`
  - `validation` (prose `expected`/`actual`, for example "the page ignored the first press, so it was pressed once more")
  - `message`, `url`, `title`
  - the raw page record: `element`, `snapshot`, `resolution`, `visualTarget`
  - `startedAt` and `finishedAt`
- `structure` (selectors) comes only from `capture_snapshot`, which never gets a read. It is removed anyway, as page markup.

### Fix

- **New `domain/src/runtime/llm-evidence/node-run/page-record.ts`:** `webNodeWithoutPageRecord(payload)` drops those five top-level keys and keeps everything else.
  - It returns `undefined` when the page record was all the payload held.
  - It returns the payload untouched (same identity) when it holds no page record.
- **`node-run/rejected-rows.ts`:** `webNodeReadWithRejectedRows` builds `read` from `webNodeWithoutPageRecord(recorded)`. `recorded` is returned as before, so `replay.produced` is unchanged. The doc comments were updated.
- **`node-run/run.ts`:** only the comment at 386-394 changed, to say what is now true. Code is unchanged. Press outcome fields (`control`, `pageChanged`, `unchangedPress`, `status`, `inFlow`) still come from `run.ts` as before, and `validation` stays in `read`.
- **Shown-address rule:** `run.addresses.ran(...)` gets the `read` the model is actually shown, so it registers every address in it, such as a read's `url` column or the payload `url`. Packet links still register through `run.shown(after)`. One behaviour change follows: an address that appeared only in a press's raw snapshot (and not in any packet) no longer counts as shown. This is correct now that the model never sees it. The new test covers it, and the existing `shown-addresses.test.ts` (9 tests) stays green.
- **New test file `node-run/tests/press-raw-read.test.ts`** (4 tests):
  1. A click whose payload carries snapshot, element, resolution and visualTarget returns none of them. The raw xpath, class name, raw-only link and `interactiveElements` appear nowhere in the evidence. `status`, `pageChanged`, `control`, `validation` and `url` are kept. `draft.replay.produced` still equals the raw element count, which shows `recorded` is unchanged.
  2. An extract node's `extracted` and `validation` are shown whole without its page record, and the address it returned can be followed.
  3. After a press, a packet link is allowed and a link found only in the raw copy is refused with `address_not_shown`.
  4. A unit test of `webNodeWithoutPageRecord`.

## Commands run and observed results

- `bash .../heavy.sh "t193-wS domain test" env DOMAIN_TEST_BUILD_LABEL=t193-ws pnpm --filter @fluxiq-web-extension/domain test`, with the fix: rc=0, `# tests 1065`, `# pass 1065`, `# fail 0`. The four new tests are `ok 565`-`ok 568`.
- The same command with the fix reverted (`rejected-rows.ts` line 64 back to `webNodeReadResult(recorded)`, module kept so the test compiles): rc=1, `# tests 1065`, `# pass 1062`, `# fail 3`. The failures were:
  - `not ok 565`: "read carries no snapshot"
  - `not ok 566`: `true !== false`, because the read had a snapshot
  - `not ok 567`: `'web.action.succeeded'` where `'web.action.rejected.address_not_shown'` was expected

  The fix was then restored byte-identical (checked with grep).
- `bash .../heavy.sh "t193-wS domain check" pnpm --filter @fluxiq-web-extension/domain check`: rc=0.
- `node scripts/structure-audit.mjs` from the tree root: rc=0, `structure-audit: passed (135 warning(s), 119 baselined)`. No warning names the new files.
- A final `pnpm ... domain test` on the restored tree: rc=1 before any test ran. `core-build.mjs` refused because Core's `packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/system-prompt.ts` in `fxwork/t193/!FluxIQ` is newer than Core's dist. Another agent edited it after my first two runs. I did not rebuild Core.
- I then ran `bash .../heavy.sh ... env DOMAIN_TEST_BUILD_LABEL=t193-ws node scripts/test-domain.mjs` from `domain/`, which is the same suite without the Core staleness gate and uses the unchanged Core dist: rc=0, `# tests 1065`, `# pass 1065`, `# fail 0`.

## Not verified

- No live run or Lab run. The fix is shown only against stubbed gateway payloads shaped like the dump's `dismiss.privacy` entry, whose read keys I inspected.
- The last full-suite pass skipped the Core staleness gate, as described above. It ran against the same Core dist the first passing run used.
- `pnpm check`, `pnpm test` and `pnpm build` at repository level were not run.

## Open questions or contradictions found

1. **Wrong label in the brief:** `DOMAIN_TEST_BUILD_LABEL=t193-wS` is rejected by `test-domain.mjs`, which requires `/^[a-z0-9][a-z0-9-]{0,63}$/`. I used `t193-ws`.
2. **Replay counts a press's raw elements.** For a press, `replay.produced.records` is the count of the raw snapshot's `interactiveElements`. That happens because `reads: node.proposes` is true for clicks and `webNodeRecordCount` takes the longest list in the payload. I kept it unchanged as the brief required, and test 1 pins it. It looks like a latent false signal for replay verification of presses, and it should be decided separately.
3. **CSS selectors still leak through `validation`.** `validation.actual` can contain a selector, for example "the point 278,31 landed on span.css-0yh3pb0" in the same dump (L27). That is page markup reaching the model through validation wording, which this fix deliberately keeps. Fixing it would mean changing the extension's validation prose in `apps/extension`, which is outside this brief.
4. **Core's staleness gate is failing** for `fxwork/t193/!FluxIQ` right now, because of a concurrent `system-prompt.ts` edit. The next labelled domain test there will refuse until Core's dist is rebuilt.
