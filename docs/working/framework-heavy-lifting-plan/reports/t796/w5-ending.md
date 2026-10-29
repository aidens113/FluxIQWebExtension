# t796 w5-ending

## Outcome
Done. All three items implemented; narrow checks pass (113 files, 1137 tests).

## What changed and why
RT = packages/fluxiq/src/programs/automation-studio/runtime.
1. RT/service/project-build-ending/record-told.ts: `ran()` reads `feedback.notRun` defensively (absent or empty = old text). When any step is listed, the count no longer says "ran all N of its steps" but "made N step runs, counting each pass of a repeat", followed by ", but its step “X” never ran (on any of the 3 passes)" or "did not run on passes 2 and 3 of 3" (at most 5 named, each label once).
2. Leftovers:
   - RT/activity/wording/left-told.ts: `AutomationStudioActivityLeftAct` gains `on?`. It is said after the act as `on the page “<address>”`, cut at 80 characters, nothing if it has no letter or digit. Two identical presses on different pages are now two entries.
   - RT/project-agents/supervisor/left-on-target.ts: fills `on` per act from each brief's `trialChange().leftFromEarlier()`. The project snapshot carries no place, so acts are matched by `did` in order, per owner.
   - RT/activity/wording/act-words.ts: pressing a control of kind `tab` is fleeting like a link. A trial step labelled "open …" (without "and"/"then") is a passing move (TRIAL_ONLY_MOVES), so tab presses and "open the post" are no longer listed as "might have left something behind". Lasting acts were already told first (inPlace, kept, quiet, then possibly).
3. RT/flow-bootstrap/site-reset/trial-change-port.ts `leftFromEarlier`: `where` = `place.location`, else `controlOriginal.location`, else the location its control place was last read at (readLog).

## Cause of the missing `where` (item 3)
`ledger.ts` `placed()` sets `entry.place` only when `place.changed.length > 0`. An exploration act made where the before/after reads differed in nothing (the dialog/overlay case) never gets a `place`, though `placed` was handed the location. That is in `site-reset/ledger.ts`, which I do not own. I only added the fallbacks above. For act-7 it fixes it only if its control place was read at a location. Proper fix, for the lead: in `placed()`, keep `location` even when `changed` is empty (e.g. a separate `entry.at`).

## Fail-first evidence
Tests were written before the source and the source was edited before the first run, so I have no separate red run. The first run after the edits had 1 failure out of 1137, in my own left-on-target test: it expected the "still on the site" sentence, but the act is told as "no read showed a change". I corrected the expectation. Final run is green.

## Commands run and results
`pnpm test src/programs/automation-studio/runtime/service/project-build-ending .../activity .../project-agents/supervisor .../flow-bootstrap/site-reset` (under the heavy-check lock), packages/fluxiq:
- run 1: Test Files 1 failed | 112 passed (113); Tests 1 failed | 1136 passed (1137).
- run 2: Test Files 113 passed (113); Tests 1137 passed (1137).

New tests (a library, holds on books, a step that never ran):
- service/project-build-ending/tests/ending-truth.test.ts: never ran on any pass; did not run on passes 2 and 3 of 3; no `notRun` gives the old text.
- activity/wording/tests/left-told.test.ts: two holds on two pages; no place gives the old text; tab and open-page presses are not listed.
- project-agents/supervisor/tests/left-on-target.test.ts: two identical presses told apart by page.
- flow-bootstrap/site-reset/tests/trial-witness.test.ts: `where` from where the control was read.

## Not verified
- Not run against the real `notRun` producer (service/candidate-trial/feedback.ts, built in parallel); I used the fixed shape from the brief.
- Not run with a live run; `tsc` typecheck was not run separately (vitest only).
- A quiet act (no change seen) is told in the "nothing read afterwards could show" sentence, with the page named; a dialog act with no known location stays unnamed.

## Open questions
- The `ledger.ts` `placed()` cause above.
- Matching by `did` in order assumes `leftFromEarlier` and the snapshot list acts in the same order, as both iterate the ledger's acts.
