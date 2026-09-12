# Report: w2-browser-actions

Worker: `w2-browser-actions`. Brief: `### Brief: w2-browser-actions` in
[briefs/wave-2.md](../briefs/wave-2.md) — Phase 1.2 step 4, coding against
[reports/w2-foundation.md](./w2-foundation.md).

## Outcome

**Done.** Every item in the brief landed; the gates in the wave preamble pass,
with observed output in [Commands](#commands-run-and-observed-results). I edited
only the files my brief lists as owned, plus four new modules and six new test
files inside `apps/extension/src/runtime/`, the directory I own.

One thing the supervisor must assign to someone:
**`domain/src/client/gateway-mapping.ts` is owned by no Wave 2 brief**, and it is
the reason a tab or download request cannot yet arrive as a typed field. Detail
in [Open questions](#open-questions-or-contradictions-found), item 1.

## What changed and why

### `action-runner.ts` — routing, tab reuse, and the guard

- **Tab and download run before any tab is resolved.** Previously
  `runBrowserActionCommand` called `resolveAutomationTab` first, so
  `web.browser.tab` with `operation: "open"` would *create* an automation tab
  and then open a second one. Both action types now return before that, and the
  page guard does not apply to them: they act on the browser, not on a document,
  so refusing them because the current page is privileged would be wrong.
- **Navigation reuses the automation tab.** `forceNew: true` was unconditional,
  so every navigation opened a new tab and abandoned the page the Flow had
  reached. Now `newTab` opts into a new tab, a named tab is navigated in place
  (`resolveAutomationTab` gained the matching branch), and otherwise the
  remembered automation tab is reused.
- **Landed-URL comparison.** Navigation used to report the *requested* URL back
  as `succeeded` without looking at the tab. It now reads the tab's URL after
  the navigation settles and compares (decision D4); a mismatch is `failed` with
  `navigation_unexpected`, carrying expected and actual.
- **The guard is evaluated for every action**, not only for a navigation or a
  command with no `tabId`, and it reads the resolved tab's live URL rather than
  trusting the connection's last observation, which can be stale or missing.
  `request.unsupportedPageReason` remains a fallback. **Which actions it
  blocks is unchanged** — mutating ones, per `isMutatingAction` — see
  [Deliberate limits](#deliberate-limits).
- **`browserFrameId` honoured**, through `frameIdForAction`; `topFrameOnly` is
  now derived from the same answer, so a Flow addressing a frame is no longer
  silently answered by whichever frame replies first.
- `browserActionFailure` now states a failed validation and an `action_failed`
  record instead of `not-yet-validated` with no failure.

### `result-mapping.ts` — two fixes on the wire

- **`failure` is forwarded.** `gatewayActionResultFromBrowserResult` copied
  every field but this one, so the record the content side now builds was
  assembled and then dropped one call short of the gateway (found by
  w2-foundation; its own [Not verified](./w2-foundation.md) section flagged it).
  The rejection path already did this.
- **Every non-succeeded status carries its message as the error.** `error` was
  set only for `failed`, so `timed_out` and `cancelled` reached the gateway with
  none while `RuntimeStatusTracker` showed the same result as failed *with* one
  (found by w1-extension-unit-tests). The status itself was already passed
  through untouched and still is.

### `browser-tab.ts` — open, switch, close

Replaces the stub. Each operation leaves the automation tab pointing where the
Flow now is, so the next content action addresses the tab this one selected.
Open compares the landed URL when a URL was requested; switch selects by id or
by URL substring and reports `target_not_found` when nothing matches; close
confirms the tab is actually gone before claiming success.

### `browser-download.ts` — wait for a download

Replaces the stub. Waits through `chrome.downloads` (listener plus a poll, both
bounded by the timeout); a timeout is `timed_out` with Core's `timeout`
category, never flattened to `failed`. **Without the `downloads` permission it
fails immediately as a capability refusal** rather than hanging until its
timeout — that permission arrives with `w2-upload-dialog` and is absent from all
three manifests as I write this, so this is the path that runs today. The wait
looks back a bounded 15 s, because a Flow clicks a link and *then* waits: a
download that finished between those two actions still counts, while a file left
by an earlier run cannot pass for this one.

### New modules (all in `apps/extension/src/runtime/`)

| File | Why it is its own module |
| --- | --- |
| `command-options.ts` | The only thing between a raw gateway parameter and the tab or frame an action is aimed at. Pure, so it is tested directly. |
| `navigation-outcome.ts` | The landed-URL post-condition, used by both navigate and tab-open. Pure. |
| `unsupported-page.ts` | The automation-side page rule. Pure. |
| `action-results.ts` | Worker-side result and failure builders. The content script's `results.ts` reads `location` and `document`, neither of which exists in a service worker. |

### The failure records, and why each is shaped as it is

Core's parser drops a record whole rather than repairing it, so each category is
paired with the stage and retryability its consistency rules allow. A test
asserts every record this work produces survives `parseAutomationStudioFailureRecord`.

| Situation | Category | Code | Retryable |
| --- | --- | --- | --- |
| Landed somewhere else | `navigation_unexpected` | `web.navigate.unexpected_url` | no — the same request lands in the same place |
| Download wait expired | `timeout` | `web.download.timeout` | yes |
| Privileged page | `blocked_by_capability_or_policy` | `web.page.unsupported` | no (Core forbids it) |
| No `downloads` permission | `blocked_by_capability_or_policy` | `web.download.permission_missing` | no |
| Tab request unreadable | `blocked_by_capability_or_policy` | `web.tab.invalid_request` | no |
| No tab matched a switch | `target_not_found` | `web.tab.no_match` | yes, stage `target_resolution` only |
| Browser refused the operation | `action_failed` | `web.tab.failed`, `web.tab.not_closed`, `web.action.failed` | yes |

### Deliberate limits

- **The guard's blocking policy is unchanged.** The plan says "unsupported-page
  guard applied to every action"; w2-foundation had deliberately excluded
  `assert` and `extract_list` from `isMutatingAction` so read-only actions are
  not blocked. I read the plan as *evaluate* for every action and kept
  foundation's blocking policy, because widening it would change Lab behaviour
  and **my brief forbids me from running `pnpm lab`**, so I could not have
  proven the wider rule safe.
- **`about:blank` is now unsupported for automation.** That is what the w1
  finding asks for, and the automation tab starts there, so a mutating action
  dispatched before any navigation now fails with a clear reason instead of
  being sent to a blank page. Navigation itself is judged by its *target*, so
  the normal navigate-then-act sequence is unaffected.

## Commands run and observed results

From `F:\!FluxIQWebExtension`, `EXTENSION_TEST_BUILD_LABEL=w2-browser-actions`.
Each exit status was captured by redirecting to a file and echoing `$?`, never
through a pipe.

| Command | Observed |
| --- | --- |
| `pnpm --filter …/extension check` | **first run: exit 139** — `Segmentation fault`, `Exit status 3221225477` (0xC0000005). Not a type error: no diagnostics were printed. **Rerun: exit 0.** |
| `apps/extension/node_modules/.bin/tsc -p tsconfig.test.json` (direct) | exit 0, no diagnostics — sources *and* tests, a superset of `tsconfig.json`'s program |
| `EXTENSION_TEST_BUILD_LABEL=w2-browser-actions pnpm --filter …/extension test` | exit 0 — `# tests 120 / # pass 120 / # fail 0` (72 after w2-foundation) |
| `pnpm --filter …/extension test:content` | exit 0 — `117 passed (15.0s)` |
| `GIT_INDEX_FILE=<scratch> node scripts/structure-audit.mjs` | exit 0 — `passed (31 warning(s), 19 baselined)` |

The segfault matches the crash the brief's concurrency notes record for
2026-09-11 under parallel load. I reran it once, as the brief directs, and it
passed; the direct `tsc` run over the larger program had already exited 0 with
no diagnostics, which is why I am confident the crash was environmental.

An earlier `check` failed with two errors in `src/content/describe-element.ts`
(`Cannot redeclare block-scoped variable 'role'`) — `w2-identity-capture`'s
file, mid-edit. It was gone by the next run. I changed nothing there.

**Audit method.** The audit reads only tracked files, so the ten new files were
staged into a **scratch index** (`GIT_INDEX_FILE` pointing at a file under my
scratchpad, `git read-tree HEAD` then `git add -N`), leaving the real index
untouched for the twelve workers running beside me. `pnpm structure:baseline`
was **not** run and no baseline entry was added, raised, or regenerated. The
warning count is unchanged from w2-foundation's 31: `src/runtime/` holds 12
source files against the 15-file advisory threshold, and no filename prefix
reaches the 3-file limit that would demand a subdirectory.

**Test coverage added** (70 assertions across 6 new files, plus 3 tests added to
the two existing ones): the landed-URL policy; the page rule including the three
schemes the recording-side rule misses; the option readers and their refusal of
malformed values; every failure record against Core's parser; the tab switch
selection; the download matching and window rules; and the two wire fixes.

## Not verified

- **Nothing ran in a browser.** `chrome.tabs` and `chrome.downloads` do not
  exist in the Node unit runner, and the content harness bundles only the
  content script, so **`runBrowserTabAction`, `runBrowserDownloadAction`, the
  navigation path, and the live tab-URL read were never executed** — only their
  pure decision functions were. My brief adds no T2 spec, forbids `pnpm build`
  and `pnpm lab`, and no harness covers the background worker. This is the
  largest gap in this work and needs live validation before the phase is called
  done.
- **The download wait loop is unexecuted**: listener registration, the 500 ms
  poll, the timeout, and the cleanup. Only `selectCompletedDownload` and
  `downloadFilenameMatches` are covered.
- **The `downloads` permission is still absent** from all three manifests
  (`w2-upload-dialog` adds it), so today `web.browser.download` always takes the
  capability-refusal path. The success and timeout paths have never run.
- **`timed_out` does not survive the domain hop yet.** `domain/src/runtime/adapter.ts`
  still flattens it (`w2-domain-status`), so the `timed_out` a download timeout
  produces is not observable above the extension.
- **`webAutomationActionResultPayload` still omits `failure`** from the payload
  object. The top-level wire field now carries it, which is what
  `ClientGatewayActionResult.failure` is; the payload copy is domain-owned and
  outside my files.
- **Not run:** `pnpm build`, `pnpm lab`, root `pnpm check`/`pnpm test`, and the
  domain package's gates — my brief forbids the first two and I changed no
  domain file.
- I did not verify how `connection.ts` renders these results in the panel, nor
  re-check `runtimeConfirmationForActionResult` against the new statuses.

## Open questions or contradictions found

1. **No Wave 2 brief owns `domain/src/client/gateway-mapping.ts`, and it is
   load-bearing for this phase.** `webAutomationActionFromGatewayCommand` maps a
   fixed set of flat fields — `selector`, `text`, `value`, `key`, `url`,
   `timeoutMs`, `coordinates`, `visualTarget` — and copies everything else into
   `options`. It sets **neither `tabId` nor `frameId`**, and knows nothing of
   `newTab`, `tab`, or `download`. So the typed fields w2-foundation added to
   `WebAutomationActionCommand` can never be populated from a gateway command.
   My readers accept both shapes — typed field first, raw parameter second — so
   the feature works today through `options` (`operation`, `url`, `tabId`,
   `urlPattern`, `active`, `filename`, `timeoutMs`, and `browserFrameId` /
   `browserTabId` / `newTab`) and keeps working unchanged once the mapping grows
   typed fields. **The supervisor should assign that mapping**, or the typed
   fields stay dead. `w2-domain-vocabulary` owns the schemas but not this file.
2. **`browserFrameId` is named by the plan but exists nowhere in either
   repository.** I implemented it as an `options` key, alongside `browserTabId`.
   If Core or a Flow author expects a different name, this is the moment to say
   so — it is one line in `command-options.ts`.
3. **Two lists of unsupported pages now exist.** Mine
   (`runtime/unsupported-page.ts`, automation) and
   `background/connection/browser-state.ts` (recording), which still misses
   `about:`, `view-source:`, `data:`, and the current store hosts — the w1
   finding. `browser-state.ts` is in no Wave 2 brief's owns list, so I could not
   consolidate them. **Recommend giving that file to someone with the
   instruction to import the rule from `runtime/unsupported-page.ts`**, so the
   recording gap closes and the duplication goes with it.
4. **The validation-text bounding rule is stated twice**, in
   `content/action-runtime/validation-outcome.ts` and in my `action-results.ts`.
   The *bound* is shared — mine imports `WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH`
   from the domain — but the truncate-and-never-empty logic is duplicated,
   because the content bundle must not import the domain barrel (w2-foundation's
   invariant) and the worker cannot import content modules without tripping the
   audit's barrel rule. A shared pure module reachable from both would fix it;
   it needs a home neither side owns today.
5. **`unknown` now also carries an error**, since I keyed the rule on "not
   succeeded" rather than listing statuses. That matches `RuntimeStatusTracker`,
   which treats every non-succeeded status as failed. Flagging it because the
   brief named only `timed_out` and `cancelled`.
6. **`docs/architecture/web-capabilities.md` is now out of date** for five rows:
   Navigate (line 84), Open/Switch/Close tab (97–99) and Downloads (100) all
   still describe the pre-step-4 behaviour and name this work as pending. That
   file is Phase 1.2 **step 6** and outside my owns list, so I left it; it should
   be updated before the phase's exit check, which reads that very matrix.
7. **`runtime/index.ts` was not edited.** It is not in my owns list, and nothing
   outside `src/runtime/` imports the four new modules. Their pure helpers are
   reachable anyway, because the barrel already re-exports `./browser-tab` and
   `./browser-download` with `export *`.
