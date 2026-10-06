# t194-w78: brief advice vs Core's read account (R6), rerun-without-input refusal (R7)

## Outcome

Done. Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`, R/ = `packages/fluxiq/src/programs/automation-studio/runtime/`.

## What changed and why

**R6, `R/recovery/refuted-result/brief.ts`.** READ_STEPS step 3 keeps its existing text and adds: "Where the check's advice contradicts \"How the read went\" (Core's account of what the step did) -- it asks for more pages of a read that already read every page there was, say, or a filter the step already applies -- Core's account stands and that part of the advice is not followed: changing that setting again reads the same items." The header comment records why. ACT_STEPS is unchanged: a Flow that reads nothing has no read account, so the contradiction cannot come up there. No site names. Avoided "always"/"never" so the instruction-conflict check still passes.

**R7, `R/llm/evidence-loop-decision.ts`.** The rule stays: a rerun without input is still dropped. `readAmendments` now uses a per-item `readAmendment`, which returns `"rerun_needs_input"` for a rerun that is well formed apart from its missing input. A new export, `AUTOMATION_STUDIO_LLM_EVIDENCE_RERUN_NEEDS_INPUT_CODE = "llm_evidence_loop.rerun_needs_input"`. `automationStudioLlmEvidenceDecisionIssueCodes` now also reads `amend_draft`. When nothing readable is left and at least one dropped item was such a rerun, it returns `[rerun_needs_input]`. In every other case it returns undefined, so the plain shape refusal is kept.

**Where the refusal text is chosen.** `R/llm/evidence-loop/decision-refusal.ts` already uses the named codes from that function before falling back to `decision_shape_invalid`, so no logic changed there; only its comment changed. `R/llm/unusable-decision.ts` gets an `ISSUE_INSTRUCTIONS` entry: "A rerun needs input, and a rerun without it is dropped, so this amend_draft changed nothing: give the rerun an input -- the parameters to change, or {} to run the step again as it stands." The refusal carries only this code and not `decision_shape_invalid`. The generic shape text ("give every amendment a step number and a change") is therefore left out, because it never pointed at the missing input.

**Partial drops are unchanged.** If an amend_draft still has other readable amendments, the decision is not refused, as before.

## Tests (written first, watched fail, then pass)

- `R/recovery/refuted-result/tests/brief.test.ts`: new case "says Core's account of the read stands where the check's advice contradicts it". It uses the earbuds read account plus the advice "Raise maxPages to 60", and asserts the new sentence and the kept parts of step 3. It failed before the change ("expected '\n3. Act on...' to contain 'Where the check's advice contradicts...'").
- `R/llm/evidence-loop/tests/rerun-needs-input.test.ts` (new) has four cases:
  - The only amendment is a rerun without input: the decision is refused with `[rerun_needs_input]`, and the feedback names "A rerun needs input", "the parameters to change" and "{} to run the step again as it stands", not the shape text.
  - A mixed set where everything was dropped, one of them such a rerun: the same code.
  - A rerun with `input: {}` is still a decision.
  - An amend_draft dropped for another reason keeps `decision_shape_invalid`.

  Before the change, the first two failed (got `[decision_shape_invalid]`, and undefined).

## Commands run and observed results

- Targeted, before the change: `npx vitest run .../refuted-result/tests/brief.test.ts .../evidence-loop/tests/rerun-needs-input.test.ts` -> 3 failed, 7 passed.
- Brief validation (in packages/fluxiq): `npx vitest run src/programs/automation-studio/runtime/recovery/refuted-result src/programs/automation-studio/runtime/llm src/programs/automation-studio/runtime/tests/deepseek-bootstrap`
  - Run 1 -> Test Files 4 failed | 152 passed (156); Tests 1 failed | 1423 passed (1424). The one test failure was in `llm/evidence-loop/tests/repeat-guard.test.ts` ("expected 'This exact call failed on this page b…' to contain 'on this exact page'"). `llm/repeat-guard/*` was being edited by another worker at the time. Three files failed only at file level: `request-prefix`, deepseek-bootstrap `exploration` and `answerability`. Rerun alone, they passed: 2 + 3 tests, then 8 tests.
  - Run 2 -> Test Files 2 failed | 154 passed (156); Tests 2 failed | 1437 passed (1439). Repeat-guard now passed. The two failures:
    - `llm/evidence-loop/tests/completion-attempt.test.ts` ("tells a check that listens when the test refused what it accepted", expected [] to deeply equal [ {...} ]).
    - `llm/evidence-progress/tests/progress-trace.test.ts` ("says a completion the test refused after the check passed").

    Both files and their subjects (`evidence-progress/progress-trace.ts`, `completion-attempt.test.ts`) show as modified by other workers in `git status`. Neither touches code I changed.
  - Every test in the files I own passed in both runs.
- No deepseek-bootstrap byte-count pin changed. That suite passed, and my brief text is not in a system-prompt pin.
- `npx tsc --noEmit -p .` filtered to my files -> no lines printed (no errors in my files).

## Not verified

- No live run. Whether the model now stops raising maxPages, and gives the rerun an input, is not shown.
- I did not re-run the two foreign failures after the other workers finish, and I did not run the full package typecheck output beyond my files.

## Open questions or contradictions found

- The debug's R6 fix column also suggests "do not route the refutation at all" when the advice contradicts the account. I did not do that: it is outside my owned files, and the brief asked only for the wording.
- An amend_draft offered where amend is not offered and dropped for a missing-input rerun now says `rerun_needs_input` instead of `decision_shape_invalid`. Both answers are honest. Only `amend_not_offered` would be more exact, and that path applies only to parsed decisions.
