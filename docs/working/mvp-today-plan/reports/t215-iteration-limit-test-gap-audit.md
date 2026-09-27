# t215 — Iteration-limit test-gap audit

## Scope

Read-only audit of the sanitized conclusions from t210–t213 and Core tests whose ownership is
evidence-loop, decision, or budget behavior. No source, shared document, build, raw artifact,
browser/provider/Lab state, or commit was changed.

Run 1's relevant measured sequence is: 26 authorized decisions; seven amendment/rerun decisions;
one structurally invalid decision; a completion-only 26th decision rejected as
`bootstrap.cannot_answer_instruction`; then an inaccurate terminal
`llm_evidence_loop.iteration_limit`, mapped to `flow_bootstrap.evidence_iteration_limit`.

## Coverage matrix

| Concern | Existing coverage | Status against run 1 |
| --- | --- | --- |
| Repeated draft reruns | `llm/evidence-loop/tests/rerun-request.test.ts` covers runnable reruns and every declined-rerun reason, including multiple reruns in one decision. `flow-bootstrap/tests/evidence-loop-steps.test.ts` preserves refused amendments in the published trace. `llm/tests/evidence-loop-seeded-draft.test.ts` covers applying an amendment to a seeded draft. | The routing/refusal policy is intentional and covered. There is no full-loop test reproducing the seven-run mixed sequence, but the sanitized evidence cannot establish identical reruns, so run 1 does not justify a duplicate-rerun rejection test or behavior change. |
| Unusable decisions | `llm/tests/unusable-decision.test.ts` covers retry, trace/accounting, issue feedback, distinct issues as progress, repeated issues as no progress, mixed repeats, configured streaks, and iteration bounds. | Broadly covered, but one expectation encodes the run-1 defect: “is still bounded by the loop's iterations” expects `iteration_limit` when the final allowed decision is unusable. |
| Progress | `unusable-decision.test.ts` deliberately treats a new refusal issue as progress, repeated issues as no progress, and resets history after new tool evidence. `llm/tests/evidence-loop.test.ts` covers repeat-request progress/reset behavior. | Intentional for the evidence available. A successful rerun is ordinary new tool evidence; run 1 does not prove the seven reruns were identical or should have tripped the guard. Amendment/rerun progress is not exercised end-to-end in one test, but that is a diagnostic integration gap, not the demonstrated cause. |
| Remaining-call awareness | `llm/tests/loop-budget.test.ts` covers closed `decisionsLeft`, token/cost/time bounds, a completion-only last decision, and a refused completion followed by budget exhaustion. `loop-limits/tests/flow-bootstrap-evidence-loop.test.ts` pins a 26-call grant to 26 iterations. | The model-facing countdown and last-turn schema are covered. The missing edge is a refusal *on the literal `maxIterations`-th decision*, where there is no next loop-top budget check. |
| Iteration-limit termination | `llm/tests/evidence-loop.test.ts` covers ordinary iteration exhaustion; `loop-budget.test.ts` covers budget-zero exhaustion; `unusable-decision.test.ts` covers an unusable decision landing on the iteration ceiling. | Incorrectly specified for the decisive edge. Generic exhaustion should remain `iteration_limit`; exhaustion immediately caused by a known unusable/refused final answer should preserve that refusal through the stalled callback. |

## Exact missing regression tests

### Required: terminal refusal at the literal iteration ceiling

Target:
`packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/loop-budget.test.ts`

Add a test parallel to “ends as the refused answer when the budget is spent straight after one,”
but make the rejected completion occur on decision `maxIterations` rather than relying on the next
budget check. Assert:

- `checkCompletion` rejects the final completion with a stable issue code;
- the configured `stalled` callback receives that final issue code, trace, and accounting;
- with propagated decision errors, the callback's error is thrown;
- the result is not `llm_evidence_loop.iteration_limit`.

This is the smallest test that fails for run 1's Core classification defect.

### Required: distinguish unusable-final from ordinary exhaustion

Target:
`packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/unusable-decision.test.ts`

Refine the existing “is still bounded by the loop's iterations” case into two explicit cases:

1. When the max-iteration decision is unusable, assert `stalled` receives its issue code and the
   configured propagation/non-propagation behavior wins (`stalled` error or
   `llm_evidence_loop.invalid_decision`).
2. When the max-iteration decision is a usable non-completing tool decision, assert the ordinary
   `llm_evidence_loop.iteration_limit` result remains.

That preserves the backstop while preventing the known refusal from being overwritten.

### Proportional integration coverage

Target:
`packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts`

The t213 root-cause handoff identifies this as the bootstrap integration owner. Add a provider-stub
case whose final allowed completion fails answerability and assert bootstrap surfaces
`flow_bootstrap.evidence_unusable_decision` with sanitized
`bootstrap.cannot_answer_instruction`, rather than `flow_bootstrap.evidence_iteration_limit`.
This file was not read in this audit because it is outside the brief's allowed test set; the
integration recommendation comes from the authorized t213 conclusion and must be verified by the
implementer before editing.

## Tests not justified by run 1

- Do not add a regression that rejects all repeated reruns as duplicates. The safe evidence does
  not expose rerun parameters or prove identical requests, and current tests intentionally allow a
  runnable correction through the ordinary tool path.
- Do not change the 26-call limit test or raise the limit. It correctly represents the grant; the
  defect is loss of the known final refusal after the last allowed decision.
- Do not weaken completion answerability. The rejected final result lacked a retained step capable
  of producing/saving the requested records, so `bootstrap.cannot_answer_instruction` is the
  actionable diagnosis that should survive.

## Verdict

Current tests intentionally encode most observed behavior: a 26-call grant, model-visible
remaining-call awareness, correction attempts as valid progress, and bounded unusable decisions.
They leave draft-rerun progress only partially integrated, but run 1 does not prove that policy
wrong. The demonstrated gap is narrower and exact: the suite currently **expects** a known
unusable final decision at `maxIterations` to become `iteration_limit`. The two focused Core tests
above must be changed/added with the terminal-classification fix; the bootstrap integration test is
the proportional guard that the actionable issue survives the caller mapping.
