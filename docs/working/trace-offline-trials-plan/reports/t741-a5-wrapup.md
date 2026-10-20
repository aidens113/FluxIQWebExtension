# Report: t741-a5-wrapup (worker)

## Outcome

Done. During a candidate's wrap-up, a `core.run_node` call that names one of the build's acts under `undoes` now runs. A `core.run_node` that explores is still answered `llm_evidence_loop.not_offered`. A draft loop's wrap-up has not changed.

## What changed and why

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQ`, under `packages/fluxiq/src/programs/automation-studio/runtime/llm/`:

- `loop-budget.ts`
  - `automationStudioLlmEvidenceLoopWrapUp().withholds` now has the signature `(toolId, input?)` and judges the whole call.
  - In a candidate wrap-up it returns false for `core.run_node` when `input.undoes` is a string matching `^act-[1-9][0-9]{0,3}$`. This is the same pattern `site-reset/undoes-tool.ts` declares.
  - The tool id and key are plain local constants, so `llm/` does not import `flow-bootstrap/` or `node-tools/`.
  - Any other value under `undoes` is still withheld: a number, an array, `destination-N`, `act-0` or an empty string. So is an `undoes` on any other tool.
  - The candidate wrap-up words in `candidateWrapUpInstruction` get one generic sentence after "...spends a decision.": "A call that names one of this build's own lasting acts under undoes, to undo it before a trial, still runs." The phrase "only X, Y and completing run now" is unchanged, and the draft words are unchanged.
  - The header gets a t741 paragraph giving the cause (photo `run-mvgobp8h-b99ede98`, 0150-0158).
- `evidence-loop.ts`, line 757: the call site now passes `decision.input`: `wrapUp.withholds(decision.toolId, decision.input)`. The comment above it is updated. Nothing else in the file changed.
- `tests/loop-budget.test.ts`
  - New describe "an undo in a candidate's wrap-up (t741)" with four tests:
    - a unit test of `withholds`: an undo runs; exploring and malformed calls are withheld; nothing is withheld outside the wrap-up
    - a draft loop's wrap-up still withholds an undo
    - the new words appear in the candidate wrap-up and not in the draft wrap-up
    - a whole-loop run: the undo runs, and an exploring `core.run_node` is answered `not_offered`
  - The test that matches the default wrap-up instruction exactly is updated to the new sentence.

Tests were written first. Before the fix, `loop-budget.test.ts` showed 4 failed and 29 passed: three of the new tests and the updated exact-match test. The draft-loop test passed both before and after, as it should.

No pinned prompt holds these words. `system-prompt-pins.json` does not contain them, and a grep of both trees for the old sentence found no other copy.

## Commands run and observed results

- `cd .../!FluxIQ/packages/fluxiq && pnpm exec vitest run src/programs/automation-studio/runtime/llm/tests/loop-budget.test.ts`
  - Before the fix: Tests 4 failed | 29 passed (33).
- `pnpm exec vitest run` on these four files after the fix:
  - `llm/tests/loop-budget.test.ts`: 33 tests
  - `llm/evidence-loop/tests/wrap-up-not-offered.test.ts`: 14 tests
  - `llm/decision-handlers/tests/decision-context-wiring.test.ts`: 12 tests
  - `llm/tests/run-budget.test.ts`: 14 tests
  - Result: Test Files 4 passed (4), Tests 73 passed (73).

## Not verified

- No typecheck was run (brief rule; the lead runs it). A risk to check there: `withholds` now has an optional second parameter, and one existing test passes it straight to `.map(wrapUp.withholds)`, so the array index arrives as `input`. A number is never an object, so the result does not change, and the tests pass.
- No live run or project-build test went through an actual `trial_reset_required` followed by an undo in the wrap-up.
- The undo now goes through the repeat guard (`handling.repeats.blocks`) like any call that runs. I did not test that guard with repeated undos.

## Open questions or contradictions found

- `evidence-loop/answered-request.ts` (line 110) is the text the model gets with a `not_offered` refusal. It still says "only X, Y and completing run now. This tool is still listed, but this call was not run." It does not mention undos. I left it alone because I do not own it and `wrap-up-not-offered.test.ts` checks it exactly. If the refusal should also say that undos run, that file and its test need an owner.
