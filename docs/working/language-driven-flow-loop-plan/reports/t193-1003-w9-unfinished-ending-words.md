# t193-1003-w9 unfinished ending words (worker report)

## Outcome

Done. All three defects are fixed in Core tree `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ`. I wrote failing tests first and saw them fail (4 failed, 30 passed). They pass now.

## What changed and why

R = `packages/fluxiq/src/programs/automation-studio/runtime`

- **R/flow-bootstrap/unfinished-build/not-done.ts**
  - Added `automationStudioFlowBootstrapProgressAndTestSaid(checklist, judgement)`. It covers the case where the progress sentence already says the Flow ran and was not judged a success: the test's step count goes into that sentence ("when the Flow (16 steps) was run from its start") and the test sentence is dropped. It still says both sentences when the test adds something: steps carried over and not run, steps not run in this build, or no judge.
  - `automationStudioFlowBootstrapProgressSaid` takes an optional third parameter, `stepsInFlow`. It is used only in the run clause, and only when the judged clause is present. The output is unchanged for every existing caller.
  - This fixes defect 1.
- **R/flow-bootstrap/unfinished-build/not-finished.ts**
  - Uses the new combined sentence.
  - New `doubtSaid`: when the last verdict is not `no` and it carries `unconfirmedReading`, the ending now says one of these, bounded to 200 characters, in the place where a `no`'s advice is said:
    - `What the judge doubted, in one check the other did not confirm: "<observed>".`
    - if there is no observed text: `What one check of the judge says is left to change, which the other did not confirm: "<advice>".`
  - This fixes defect 2.
  - The other worker's `judgeSaid` sentences are untouched, and every fact is kept: what stood still, rounds, decisions, and the kept sentence.
- **R/conversations/commands/create-here.ts**
  - When the build kept a draft and gave an ending, the line under the ending is now `What you asked is saved on the Flow "<name>".` It used to be `What is left: the Flow "<name>", with what you asked saved on it.`
  - The ending's kept sentence ("kept as a draft, not put into the Flow, and building again carries on from it") is the single place that says what is left.
  - The no-ending and nothing-kept lines are unchanged.
  - This fixes defect 3.
- **`kept-said.ts` and `tried.ts` are unchanged.** Rewording kept-said would have broken about 10 test files I do not own, plus downstream fixtures.
- **Tests:**
  - `unfinished-build/tests/not-finished.test.ts`: a new describe block built from run-musp4h2f's ending inputs (6 things asked, 16 steps, 4 rounds, 60 decisions, `no` then `unknown` with `oneCallSaidYes` and the towel-quantity `unconfirmedReading`).
  - `unfinished-build/tests/not-done.test.ts`: two tests for the new combined sentence.
  - `unfinished-build/tests/judged.test.ts`: one assertion updated, because it pinned the duplicated sentence.
  - `conversations/commands/tests/execute.test.ts`: one assertion updated for the new line.

For this run, the expected start of the ending (pinned by test) is:

> I have not finished this Flow yet: the last 2 repairs made no measurable progress, each on the round before it: no more of the 6 things you asked had a step (6, as before); the judge no longer agreed it was wrong: one check said it does what you asked, the other did not. What the judge doubted, in one check the other did not confirm: "step 9 clicked '+' once, ...". 6 of the 6 things you asked have a step that ran, or could run, when the Flow (16 steps) was run from its start, but the Flow was not judged to do what you asked. I tried 4 times live -- exploring, then 3 repairs after testing what I had -- over 60 decisions. The Flow so far was kept as a draft, not put into the Flow, and building again carries on from it.

## Commands run and observed results

- `npx vitest run .../unfinished-build/tests/not-finished.test.ts .../not-done.test.ts`, before the fix: `Tests 4 failed | 30 passed (34)`.
- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build`, after the fix:
  - First run: 1 failed (`judged.test.ts`, which pinned the old duplicated sentence). I updated that assertion.
- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build src/programs/automation-studio/runtime/conversations` (in packages/fluxiq):
  - `Test Files 36 passed (36)`, `Tests 256 passed (256)`, exit 0.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t193 w9 tsc" npx tsc --noEmit -p tsconfig.json`: printed `[heavy] t193 w9 tsc holds b1`, no diagnostics, exit 0.

## Not verified

- No live run and no UI check.
- I did not run the downstream extension or test-runner tests. Their fixtures (`live-run-display.test.ts`, `build-from-chat.test.ts`) only use the unchanged "empty ..." line.
- Not run: structure audit and the full suites.

## Open questions or contradictions found

- The same duplicated sentence still happens in `budget-exhausted.ts` and `replies-unreadable.ts`: they call ProgressSaid and TestSaid separately. I do not own them. Switching each to `automationStudioFlowBootstrapProgressAndTestSaid` is a one-line change for whoever owns them, but the budget-exhausted message puts ProgressSaid inside its first sentence, so it needs care.
- D10, the judge-split card's "not marked as failed" line, is outside my scope.
- `judged.test.ts` and `execute.test.ts` were not named as mine. I changed one assertion in each because they pinned the defective wording.
