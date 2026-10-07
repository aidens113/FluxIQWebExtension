# t347 saved-Flow playback times out on crossborder-marketplace (provider-free)

Worker: t347-playback (worker-high). Tree: `C:\Users\osrs_\FluxStuff\fxwork\t347-flow-playback-timeout` (branch `task/t347-flow-playback-timeout`, shared Core, Core not edited). Nothing committed.

## Outcome

Partial. Two defects were stacked behind each other.

1. **The timeout itself (fixed, Lab defect).** The recording lane ran its Flow on the wrong tab. Fixed in the Lab, with a regression test that fails first. 3 of 3 provider-free runs after the fix start on the start page and get through 17 of the 19 recorded actions, the tab switch included.
2. **A second defect, now exposed (not fixed: the fix needs Core).** The runtime's own retry of the "Network busy" coupon claim already collects the coupon. The person's recorded second press on "Get coupons" then has no target, and the Flow fails `web.target.not_found` at that node. This happened in 3 of 3 runs. The Flow lane still does not pass. The Core change needed is set out below.

## Owned files (listed after the fact; edited before this report was written)

- `packages/test-runner/src/run-scenario/browser-session/present-flow-tab.ts` (new)
- `packages/test-runner/src/run-scenario/browser-session/tests/present-flow-tab.test.ts` (new)
- `packages/test-runner/src/run-scenario/browser-session/index.ts` (barrel export)
- `packages/test-runner/src/run-scenario.ts` (`prepareFlowPage` calls the new module)
- `docs/architecture/testing-facility.md` (the paragraph on closing tabs before playback, which was stale)

## Cause 1, with evidence: the Flow ran on the listing tab

- `run-muykc54t-0cefc7eb` `snapshots/flow-lane.json` has `startCandidateIndex: 0`. All three attempts are the same node, `recorded.candidate.entry.3…`, a `web.dom.wait_for_selector` on `body > div:nth-of-type(4) > div > div:nth-of-type(7)` (the start page's welcome dialog), with `targetResolution.status: unresolved_no_candidates`. The "three wait-for-element steps" are three retries of the Flow's first step, not three separate steps.
- Screenshots `00047` and `00048` show the "Running your Flow, step 1 of 19: Wait for element" overlay, then "Run failed", on the active tab `…/crossborder-marketplace/item/1005008123450` (the Voltbay listing). Meanwhile the runner's tab (third tab, "Farbazaar - Online Shopping") had been reloaded to the start page behind it.
- The recording script opens the listing in a new tab and switches to it (`apps/scenario-lab/src/scenarios/crossborder-marketplace/manifest/steps.ts`, `open-listing` and `listing-tab`).
- The extension drives the tab in front. `apps/extension/src/background/connection/active-page.ts` `handleTabUpdate` takes the active tab on `tabs.onActivated`.
- `run-scenario.ts` `prepareFlowPage` closed the other fixture tabs only when `moment === "playback"`. That arrived in t267 (`30c0b76c`, 2026-10-05) for created Flows. The recording lane calls `prepareFlowPage()` with no moment (`flow-lane/run-flow-lane.ts:157`), so the listing tab stayed open and in front. `openScenarioStart(page)` only reloads `page`; it never brings it forward.
- Classification: a Lab defect. No product change was needed. The saved Flow is not stale: once it ran on the right tab, it replayed actions 1 to 17 correctly.

## What changed and why

- New `presentFlowTab` (`present-flow-tab.ts`). For every moment except `build`, it closes every other fixture tab and every blank tab, never the extension's own pages. When the Flow starts on the fixture page, it then calls `page.bringToFront()` and `activateScenarioTab` and waits until the extension reports holding exactly that tab. Closing alone is not enough, because Chrome chooses which tab to activate next. A Flow that starts on a blank tab is handed no page, as before (`lane-rules/flow-start-page.ts`).
- `prepareFlowPage` calls it once, after the start page is loaded or blanked. It replaces the old close that ran only for `playback`. Created-Flow playback now also waits until the extension holds the tab, where before it only closed tabs.
- The testing-facility paragraph now describes the new rule and names the run.

## Commands run and observed results

- Reproduction, before the fix: `FLUXIQ_LAB_INSTANCE=t347-playback FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs run crossborder-marketplace --flow` gave `run-muykta2i-50152fcb`, verdict failed. It showed the same signature: 3× `web.dom.wait_for_selector` (6158, 5125, 5119 ms), `web.action.timeout` on the same selector, oracle passed, and screenshot `00047` shows the overlay on the listing tab.
- Fail-first test: with `presentFlowTab` holding the old behaviour, `node --test dist/run-scenario/browser-session/tests/present-flow-tab.test.js` printed `not ok 1 - a Flow built from the recording runs on the start page…`, `not ok 2 - a created Flow's playback likewise…` and `not ok 5 - a run that never paired…`, with `# pass 2 # fail 3`. After the fix it printed `# pass 9 # fail 0`, together with `activate-scenario-tab.test.js`.
- `node --test "dist/run-scenario/browser-session/tests/*.test.js"` printed `# tests 17 # pass 17 # fail 0`. This ran on the final build, which run 4's prelude rebuilt.
- `pnpm run build` (test-runner) passed, with tsc clean. `pnpm run check` (test-runner) passed.
- `node scripts/structure-audit.mjs` first failed: `run-scenario.ts: 802 lines exceeds the 800-line limit`. I condensed my edit and reran it: `structure-audit: passed (176 warning(s), 182 baselined)`.
- Provider-free runs after the fix, same command, headed, instance `t347-playback`:
  - `run-muykzkuf-36cd37b2`, `run-muyl9cg2-a2ccb09e`, `run-muylc2el-f91e8791`: all failed, each starting at candidate 0 of 19 with 20 attempts.
  - In each run: attempts 0 to 13 succeeded (welcome wait, dismiss, cookies, type, Enter, results wait, open listing, `web.browser.tab`, chat wait, minimise, 7-in-1, Spain, quantity). Then the "Get coupons" click failed `web.action.rate_limited` and its retry succeeded. The scroll succeeded. The next click failed `web.target.not_found` 3 times. The oracle failed because Add to cart was never reached.
- No Lab processes left: `Get-CimInstance Win32_Process` filtered on node, chrome or chromium with `t347` in the command line returned nothing.

## Cause 2 (exposed, not fixed): the person's retry press is replayed after the runtime already retried

- The fixture's first coupon claim always answers "Network busy, please try again" (`steps.ts` `COLLECT_COUPON`: `claim-coupon`, `claim-refused`, `claim-again`). The recording therefore holds two clicks on the same shadow-root control, entries 51 and 57 in `run-muykzkuf-36cd37b2`, with a scroll between them.
- Since 2026-09-29/30 (`f8135495`, `apps/extension/src/content/actions/click.ts` header) the extension fails a press the page answered as busy with `web.action.rate_limited`, and Core runs the node again. In the replay, node 51's retry collects the coupon. The failure screenshot `run-muykzkuf-36cd37b2.ui-review.local/06-failure-scenario.png` shows "Collected".
- The recorded node 57 then finds nothing: `web.target.not_found`, "0 control(s) of the same family are on the page". Its 3 retries are exhausted.
- Core's absent-step skip (`executor/step-skip/absent-step.ts`) would pass over exactly this step if the node were sometimes-present: `metadata.sometimesPresent === true`, or a failed edge into a Merge. Recording-built nodes never are.
- Why the domain cannot fix this alone (read in Core):
  - `AutomationStudioRecordingMapperCandidate` (`nodes/importer-sdk.ts:20`) has no field that reaches node metadata.
  - A mapper that returns nothing for an `action` entry gets Core's fallback click (`service/recordings/proposal-generation.ts:67-72`), so the domain cannot drop the repeat.
  - The mapper context carries only `following`, so the call for the second click cannot see that the click before it was refused.

**Proposed Core change** (recommended; not made because the brief forbids it):

1. `nodes/importer-sdk.ts`: add `sometimesPresent?: true` to `AutomationStudioRecordingMapperCandidate`.
2. `runtime/service/recordings/proposal-candidates.ts`: carry it through `recordingFlowActionCandidate`. In the node builder (`proposal.candidates.map`, line ~102), write `metadata.sometimesPresent: true`, which `absent-step.ts` already honours (skip on `target_not_found`, no retry, no fault).
3. `runtime/service/recordings/proposal-generation.ts` (`recordingMapperCalls`): give the mapper `preceding` beside `following`.

**Downstream follow-up once Core has the change:** in `domain/src/web-panel-host.ts` `recordedActionEntry`, mark a click `sometimesPresent` when the previous executable entry was a click on the same target and the evidence between them carries the page's busy or try-again answer. Add a domain test, then rerun the same Lab command.

Alternatives I rejected:
- Tell the extension not to retry a busy press when the recording itself retried. That still fails whenever the replay is not refused, because the second press then has no target either.
- An extension-side "skip if absent" click. That would duplicate Core's generic skip in the browser.
- Loosening the Lab's expectations.

## Not verified

- I made no live, paid or creation-lane run. The created-Flow playback path (`moment === "playback"`) now also brings the tab forward and waits for the extension. That is unit-tested only, not exercised in a browser.
- I could not check whether Core's state routing considered node 57. `snapshots/flow-lane.json` prints no `stateRouting` for failed attempts, and the isolated Core is gone after the run.
- I did not run full suites (`pnpm check`, `pnpm test`), per the twice-a-day rule. Only the test-runner build and check, the browser-session tests and the structure audit ran.

## Open questions or contradictions found

- The brief says a paid lane A run "ends with exactly this kind of playback". Lane A's created-Flow playback already closed other tabs before this fix, so Cause 1 mainly affected the recording lane. Lane A should still be checked for Cause 2 if its Flow contains a person-style retry.
- Before t347, no provider-free crossborder recording-lane run exists in any `test-runs` tree on this machine. The live runs found are all creation lanes. So "regression" here means "never worked since the new-tab step and the t267 tab rule", not a pass that later broke.
