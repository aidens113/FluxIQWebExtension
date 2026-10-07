# r4-d4-2 clearing-press claim (lane D round 4, run-muxky54f-fadb9d03)

## Outcome

Done. Both tasks are fixed in Core (`C:/Users/osrs_/FluxStuff/fxwork/t275/!FluxIQ`), each with a test written to fail first. Nothing was committed.

`R` = `packages/fluxiq/src/programs/automation-studio/runtime`.

## What changed and why

### Task 1: why no `act_not_done_there` was made at 0037

The cause was the order in which the act judge checks a step. The claim was not refused because the ordering and judging inside the decision went wrong; the act never reached the check that reads what the step did.

- `R/flow-bootstrap/instructed-acts/standing.ts` judges each step named for an act in a fixed order. It first runs `automationStudioInstructedActStepFault` (`step-fault.ts`), which checks where the step stands in the Flow: kept, optional, `act_needs_repeat` for a plural act with no repeat, `span_stops_short` and `act_consequence_undeclared`. Only after that does it run `automationStudioInstructedActStepDidInstead` (`act-evidence.ts`), which checks what the step did: `interruption` gives `step_only_clears_the_way`.
- a1 ("confirm everyone ... at least five mutual friends") is plural. `apply.ts` asks `claimRefused` while it handles the first amendment, `14 add act a1`. The second amendment, `14 repeat over 12`, has not run yet, so step 14 has no repeat at that point. The checklist item for the claim is therefore `act_needs_repeat`, which is not an evidence fault, and `claim-verdict.ts` returned `undefined`. The claim was applied. After the repeat was applied, the same checklist read `step_only_clears_the_way`, as in the 0057 request.
- The other hypotheses were ruled out. The step's disposition does not matter, because the verdict copies the step as `kept`. At 0037 it was `dropped`, not `taken`. `item.step` equals the claimed position. The `interruption` flag was on the step, since 0057 shows `step_only_clears_the_way`, which comes only from `step.interruption === true`.
- Core's own `next` makes this a guaranteed path. It tells the model to "add step N with its act, then send repeat". That means every plural act is claimed before its repeat, so for plural acts this whole refusal could never fire.

**Fix** (`R/flow-bootstrap/instructed-acts/claim-verdict.ts`, header paragraph plus about 20 lines):
- Added a new set, `NOT_SETTLED`, holding `act_needs_repeat`, `span_stops_short`, `step_is_optional` and `act_consequence_undeclared`. These are the todos the checklist gives a step from where it stands, before it reads what the step did.
- When the claimed step's todo is in that set, a new helper, `didInstead`, asks `automationStudioInstructedActStepDidInstead` directly. If that finds something, it computes `instead` with `automationStudioInstructedActStepThatNamesIt`, the same way `standing.ts` does. It words the sentence with `automationStudioInstructedActEvidenceSaid`, which is the same sentence the checklist would show once the repeat is on.
- A repeat or a declaration can never make such a step do the act, so refusing at claim time is correct.
- Nothing changes in `standing.ts`, the checklist, the completion check or `apply.ts`.
- The refusal names the way out. With no Confirm in the draft it says: `Step 14 ("Close chat") only closed something in front of the page, and does not do a1. No step in the draft names it yet: on the page where a1 is done, run the press whose words name it with add true and act a1.` With a row's Confirm in the draft, it carries `instead` naming that step.
- A press whose words name the act (a row's "Confirm") still stands while it has no repeat yet.

### Task 2: `rowAct`

- The draft step has no field saying whether a press's target lies inside a listing row. It does carry `interruption?: true`, which is the host's own statement that the press answered a layer in front of the page. `act-evidence.ts` reads the same field.
- The `steps` passed to the feedback are `context.draftSteps` (full draft steps) in both callers, `decision-handlers/amendment.ts:406` and `decision-handlers/second-copy.ts:30`. Neither caller needed a change.
- `R/llm/draft-amendment-feedback.ts`:
  - Added `interruption?: true` to `AutomationStudioDraftAmendmentFeedbackStep`.
  - `rowAct`'s search for a press now skips `step.interruption === true`, and its docblock says why.
  - When no step qualifies, the existing "No step after step N does anything to a row yet ... press that row's own control" sentence applies. When a real press follows the cleared layer, that press is named.

### Tests

- `R/flow-bootstrap/instructed-acts/tests/claim-verdict.test.ts`: added a `describe` block with 4 tests.
  - A test that pins the cause: `act_needs_repeat` before the repeat and `step_only_clears_the_way` after it.
  - The refusal, with its exact sentence.
  - `instead` names a row's Confirm, and the Confirm claim stands while it has no repeat yet.
  - Decision 0037 replayed through `applyAutomationStudioFlowDraftAmendments` with the real verdict: the result is `act_not_done_there`, `acts` stays off the step, and the checklist shows `no_step_added`.
- `R/llm/tests/draft-amendment-feedback.test.ts`: added 1 test that covers both `over_not_before` and `changes_nothing`. There is no new file in `R/llm/tests`.

## Commands run and observed results

All `vitest` runs were from `packages/fluxiq`; `fluxiq:check` and the structure audit were from the Core root.

- **Fail-first, Task 1** (source unchanged):
  - Command: `npx vitest run .../flow-bootstrap/instructed-acts/tests/claim-verdict.test.ts`
  - Result: `Tests 3 failed | 6 passed (9)`. The cause-pin test passed. The other three failed with `expected undefined to deeply equal { act: 'a1', …(1) }`, `expected undefined to match object { act: 'a1', instead: 15 }` and, on the 0037 replay, `expected [] to deeply equal [ ObjectContaining{…} ]`. The empty array matches answer 0038, where both amendments were applied.
- **Fail-first, Task 2** (source unchanged):
  - Command: `npx vitest run .../llm/tests/draft-amendment-feedback.test.ts`
  - Result: `Tests 1 failed | 51 passed (52)`, with `expected 'Step 13 is the listing, so the repeat…' to contain 'No step after step 13 does anything t…'`.
- **After the fixes**: claim-verdict `9 passed (9)`; feedback `52 passed (52)`.
- **Named validation set**: `npx vitest run` on `.../flow-bootstrap/instructed-acts/tests`, `.../flow-draft`, `.../llm/harness-options`, `.../llm/tests/draft-amendment-feedback.test.ts` and `.../llm/decision-handlers/tests`.
  - Result: `Test Files 67 passed (67)`, `Tests 928 passed (928)`, exit 0. It ran twice, once before and once after the final test edit, with the same counts both times.
- **Typecheck**: `node scripts/build-cache/cli.mjs fluxiq:check` exited 0 both times. The second run came after the last test edit.
- **Structure audit**: `node scripts/structure-audit.mjs`.
  - The first run gave exit 1: `FAIL [file-lines] .../llm/tests/draft-amendment-feedback.test.ts: 801 lines exceeds the 800-line limit`, caused by my addition (785 lines before).
  - I tightened the new test to 12 lines, which puts the file at 797. The rerun printed `structure-audit: passed (278 warning(s), 349 baselined)`, exit 0.

## Not verified

- I made no live run, Lab, browser or provider call, as the brief instructed. The fix is checked only against synthetic steps shaped like steps 12 and 14 of the run, not by replaying the actual draft from the run files.
- I did not run full suites.
- `didInstead` skips the `step_only_opens_its_choices` rule (`opensItsChoices` in `standing.ts`), which is internal to `standing.ts` and not exported. A step that only opened an act's choices and is also unsettled (for example a plural act with no repeat yet) is still not refused at claim time; it is caught later by the checklist, as before.

## Open questions or contradictions found

1. **The repeat in the same decision still applies.** At 0037 the next amendment, `14 repeat over 12`, would still put a repeat on the "Close chat" press, with no act on it. The refusal tells the model so, but nothing undoes the repeat. Two fixes are possible, both outside my files:
   - in `apply.ts`, refuse a repeat on a step whose claim this same decision refused; or
   - in `rowAct`/feedback wording, say so.

   The first is the smallest. It would go in `R/flow-draft/amendment/apply.ts`, which I own, but the brief scoped me to the claim path, so I left it alone. It needs a decision.
2. **The `rowAct` sentence wording.** It still says "Step N is the first step after step M that changes something", even when an earlier press that only cleared a layer was skipped. The meaning holds, but the phrase "first ... that changes something" is now slightly loose.
3. **Other workers' files.** The Core worktree also shows `R/llm/decision-handlers/amendment.ts`, `R/llm/evidence-loop/rerun-request.ts` and its test as modified. Those are the other worker's edits; I did not touch them.
