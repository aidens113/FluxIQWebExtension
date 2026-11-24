# t1013: paging settled per list; a Next page off its list is refused - report

## Outcome

Done. A Next page that moves its list (or finds the end) now tells Core which list it was, using the same `listKey` that a read of that list carries. Core records paging for each list from those answers. The result header now states plainly that a page follows, that the list ended, or that paging is "not yet checked", and it never says the list is unsettled after an end was seen. A Next page run on a page that does not show its list is refused with `target_not_found` / `list_not_on_page`, naming the list by its handle. It is no longer reported as "outcome uncertain". Narrow checks pass in both trees. Nothing was committed.

## What changed and why

**Core (`fxwork/t1013/!FluxIQ`, task branch):**
- `answer-first/result-feed/list-move.ts` (new, exported from the barrel) does two things:
  - `automationStudioAnswerFirstListMoveOf(evidence)` reads the answer's `listMove` field (`{listKey, verdict: moved|ended, said?, place?}`). This is a generic Core contract with no web words in it.
  - `automationStudioAnswerFirstListMovePaging(ledger, move)` creates a `paging` event for every draft read step whose `reads.listKey` matches. Each event applies to that step's most recently read page.
  - Guard: when the pager marks both places with the same numbered name, an end seen at a later place than the step's latest page becomes "moved" (a page follows). An end or move seen at an earlier place settles nothing. Without comparable places, the domain's verdict stands.
- `result-feed/feed.ts` `called`: a call that read nothing but carries a `listMove` now records those paging events. Replay calls still return early, so forward-run passes are unchanged.
- `result/ledger.ts` `pagingSaid`: an "ended" that arrives after the latest page was already marked "moved" leaves it as "moved". That end was seen on a page this step never read, so recording it would cut the list short.
- `result/header.ts` wording:
  - No paging recorded: `paging after X not yet checked`.
  - Moved: `a page follows X (the list moved on), not read yet`.
  - Ended: unchanged, `the list ended after X (reason)`.
- `packages/fluxiq/package.json`: 0.54.6 → 0.54.7 (dev is 0.54.6).
- Tests:
  - `result-feed/tests/list-move.test.ts` (new): the bikes trail shape, moved, another list, later/earlier/same place, and the reader.
  - `result/tests/header.test.ts`: updated the moved wording and added a plain-paging test.
  - `result/tests/ledger.test.ts`: added the ended-after-moved test.

**Downstream (`fxwork/t1013/!FluxIQWebExtension`):**
- Wire contract C1: `WebAutomationNextPageAnswer` `ended` can now carry `page?` (the page the pager marks current where the end was seen). `answer-value.ts` reads it. The content script sends it (`move-page.ts` default branch, and `content/actions/next-page.ts`).
- Content script, list not on the page:
  - `move-outcome.ts` gains `listAbsentMove`. It returns `failed` / `list_vanished` with `listAbsent: true`, decided before anything is pressed (`move-page.ts` step 1).
  - `next-page.ts` maps `listAbsent` to TARGET_NOT_FOUND, which is unacted and retryable, instead of OUTPUT_NOT_OBSERVED. The wire answer is still `{outcome: failed, stop: list_vanished}`. A list that vanishes after a press stays OUTPUT_NOT_OBSERVED.
- Domain:
  - `output-nodes/next-page/list-move.ts` (new): `webAutomationNextPageListMove(parameters, payload)` returns `{listKey, verdict, said, place?}`. The `listKey` is built from `nextPage.item` plus the frame, the same way `extract-list/answered.ts` builds it. `said` uses fixed domain wording for each end word.
  - `node-run/run.ts`: the outcome of a successful exploration `core.run_node` now carries `listMove`.
  - `node-run/outcome.ts`: `listMove?` added to `WebNodeRanOutcome`.
  - `action-failure/refusal.ts`: TARGET_NOT_FOUND together with a Next page `list_vanished` gives reason `list_not_on_page`.
  - `action-failure/next-page-list.ts` (new): names the list by the handle the call wrote (`target`). `run.ts` wraps the refusal with it.
  - `tool-rejection.ts`: the new reason plus its documentation. `rejection-next/next-sentence.ts` adds its `next` sentence, in generic wording.
  - `node-run/replay.ts`: a test replay of such a step answers `core.replay.failed` saying the list is not on the page, never `remembered`.
- Tests:
  - `output-nodes/next-page/tests/list-move.test.ts` (new): the move's key equals the read's key; other list or frame gives another key; end wording; place.
  - `action-failure/tests/next-page-list.test.ts` (new): refusal reason, naming in every written form, and a list that vanished after a press staying `output_not_observed`.
  - `node-run/tests/run.test.ts`: two end-to-end exploration tests (detect, read by handle, then Next page). They check that the answer carries the read's `listKey`, and that the refusal is `web.action.rejected.target_not_found` / `list_not_on_page` naming the handle, not `outcome_uncertain`.
  - `actions/next-page/tests/answer-value.test.ts`: covers the end page.
  - Extension: `actions/tests/next-page.test.ts` (two new tests); `move-page.test.ts`, `script-next.test.ts` and `scroll-loaded-list.test.ts` expectations now include the end's page (5 / 4 / 5), which is correct behaviour.
- Docs: `docs/architecture/web-capabilities.md` has a new section, "Next page names its list, and is refused where its list is not (t1013)". `docs/architecture/build-loop.md` has one added paragraph.

## Commands run and observed results

All checks ran through `fxwork/.heavy-slots/heavy-slot.mjs run`, one at a time.
- Core (`packages/fluxiq`): `node ../../scripts/vitest-groups.mjs --groups=parallel src/.../answer-first/result/ src/.../answer-first/result-feed/` → 26 files, 173 tests passed, "all groups passed: parallel".
- `pnpm --filter fluxiq check` → exit 0.
- Core libraries build (`pnpm --filter @fluxiq/contracts --filter @fluxiq/sdk --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/ui-components build`) → all five "Done", exit 0. The domain check required this first.
- Domain:
  - `DOMAIN_TEST_BUILD_LABEL=t1013 node scripts/test-domain.mjs next-page action-failure node-run/tests/run.test node-run/tests/replay.test rejection-next llm-evidence/tests/tool` → 162 tests, 162 pass, 0 fail. Re-run after the type fix gave the same result.
  - `pnpm check` (domain) first failed with TS2345: `present<>` requires `listMove`. I moved the field to `WebNodeRanOutcome` and added `listMove: undefined` to the look outcome. The re-run gave exit 0.
- Extension:
  - `EXTENSION_TEST_BUILD_LABEL=t1013 node scripts/test-extension.mjs page-advance content/actions/tests/next-page` first failed 4 tests, all because an end now carries `page`. After updating those expectations: 131 tests, 131 pass.
  - `... test-extension.mjs next-page pagination` → 81 tests, 81 pass.
  - `pnpm check` (extension) → exit 0.
- Structure audits:
  - Downstream `node scripts/structure-audit.mjs` → "passed (259 warning(s), 551 baselined)".
  - Core `node scripts/structure-audit.mjs` → "passed (571 warning(s), 903 baselined)".
- Evidence: I copied the run's steps to `test-runs/t1013-evidence/steps/` (ignored) and read only codes and structure. Step 0089: `core.run_node` `web.output.dom-next_page` with `{nextPage:{list:"extraction.3"}}` gave `web.action.rejected.output_not_observed` / `outcome_uncertain`. The header at 0090 said "nothing has said whether a page follows offset=0".

## Not verified

- No live run, no Lab run and no browser spec. Whether the model now returns to the list's page and runs Next page there is model behaviour. The bikes trail shape is proven provider-free in Core's `list-move.test.ts` and in the domain end-to-end exploration tests.
- Saved-Flow playback: a Next page whose list is absent now has Core category `target_not_found` (routes by page state) instead of `output_not_observed` (recovery ladder). No playback test exercised this.
- A list-absent Next page now gets Core's first attempt plus 3 retries, each waiting about 5 s for the list. Measured only in unit tests, not live.
- Forward-run passes still settle paging through the loop route (`passed`). Replay answers do not carry `listMove`.
- Core's `docs/architecture` was not updated; Core docs are outside my owned paths.

## Open questions or contradictions found

1. **Version clash:** t1008's branch (`581922423`) also bumped fluxiq to 0.54.7. Whichever merges second needs 0.54.8.
2. The domain test run before the Core build used Core's old dist. The domain does not import the changed Core module, and the re-run after the build also passed (162/162).
3. Working reads in the header still show only pages and rows, with no paging line. The paging statement covers the result's own steps, as before.
4. `listMove` is visible to the model as well. Before this change, an exploration Next page did not say "moved" or "ended" at all, only `pageChanged`.
