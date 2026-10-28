# t785 UI-B report

## Outcome
Partial. Goal 3 done. Goal 1 done in Core but needs one line in service.ts (not owned). Goal 2 cause is outside my paths.

## What changed
Core paths under packages/fluxiq/src/programs/automation-studio/runtime/.
- Goal 1: flow-bootstrap/unfinished-build/not-done.ts gains `automationStudioFlowBootstrapStopAnnouncementSaid({resultRepair, reason})`; phases.ts uses it for the "Testing the Flow so far" row and has a new optional input `resultRepair?: boolean`.
  - Before: "The build stopped before the Flow was finished: too many attempts in a row went nowhere. Running the Flow as far as it got from its start, ..."
  - After (resultRepair true): "The repair stopped before it was finished: too many attempts in a row went nowhere. The saved Flow is unchanged. Running what the repair has so far from the start, to judge what it does and what is left."
  - Test added to unfinished-build/tests/not-done.test.ts.
- Goal 3: project-agents/dispatch/ending.ts (`passedSaid` takes spend; new `wholeTest` flag on the dispatch spend) and run-brief.ts (sets `spend.wholeTest = true` when the brief tests the judged whole run, i.e. a single-subflow plan).
  - Before: "Revision 2 of the subflow was tried on its own and its trial answered yes."
  - After (single-subflow only): "Revision 2 of the subflow, which is the whole Flow here, answered yes in its test run from the start."
  - Multi-subflow wording unchanged. Test in dispatch/tests/brief-return-reason.test.ts. conversations/commands/build.ts not changed (its sentence is the final chat line; the duplicate came from the brief return).

## Needed outside my paths
1. service.ts line ~1664, the `runAutomationStudioFlowBootstrapBuildPhases({ ... })` call: add `resultRepair: Boolean(repairBrief),` (repairBrief is the generateFlowBootstrapAdaptationInternal parameter, in scope there). Without it the new input stays off and the old words show.
2. Goal 2 (not done): the "Done (2 times): 7 rows from 1 page" card is made by the extension UI, apps/extension/src/panel/chat/stream/step/card-repeats.ts: `doneWords` makes two successful reads with equal result text one card and `fold` only adds to `times`, so two single-page reads of different pages read as one read. Core's per-call words (activity/call-context.ts, observer.ts) and downstream read-page.ts are right per call. Suggested edit: in `doneWords`, return undefined (never fold) when `card.result` matches /\d+ rows? from \d+ pages?/, or sum rows and pages in `fold`. Not in my ownership; step evidence 0054-0057 holds no counts in result.json, so I could not confirm the per-read numbers.

## Commands and results
- `pnpm test <unfinished-build> <project-agents/dispatch>` (packages/fluxiq) -> 51 files, 366 tests passed (before moving the helper into not-done.ts); re-run of unfinished-build -> 24 of 25 files passed, the 25th (judged-wrong-rows) failed on a transient load error while another worker's file was mid-edit, and passed alone on re-run (4 tests).
- `pnpm check` -> only errors are in result-verification/agreement/exclusion-words.ts (another worker's, syntax errors). None in my files.
- Core root `pnpm structure:check` -> my first version failed (unfinished-build 26 files); fixed by moving the helper into not-done.ts. Remaining failures: result-verification/read-account (26 files) and exclusion-words.ts statement-packing, both others'.
- Downstream not touched; its commands not run.

## Not verified
Dispatch tests were not re-run after the final edit (only unfinished-build was). No live or browser check. resultRepair wiring untested end to end.

## Follow-up (leftovers on a successful build; dispatch re-run)
- Re-ran tests of supervisor, dispatch, activity, unfinished-build, service/project-build-ending: 134 files / 1053 tests passed.
- Change: project-agents/supervisor/left-on-target.ts gains `announce()` on its result; supervisor/completion.ts calls `leftNow().announce()` when a completion is accepted (`checked.ok`). It emits a chat row "Left on the site" with `told` (activity/wording/left-told.ts) and emits nothing when `told` is the "left no change" sentence. `AUTOMATION_STUDIO_ACTIVITY_NOTHING_LEFT` is now exported from left-told.ts through the activity barrels. The ledger carries no before-state, so left-told's words are used. Generic words only.
- activity/build.ts "Your Flow is ready" left unchanged (it has no ledger); the new row sits just before it. Fallback/rescued completions already say what is left via their own rows.
- Tests: supervisor/tests/left-on-target.test.ts (nothing left -> no row; a changed-page press -> one row naming it).
- `pnpm check` (packages/fluxiq) -> no TS errors; root `pnpm structure:check` -> passed; `pnpm docs:reference` wrote the reference, `pnpm docs:check` -> current.
- Not verified: no live run; the row's appearance in the extension UI.
