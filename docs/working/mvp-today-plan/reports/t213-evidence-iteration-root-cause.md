# t213 — Evidence-iteration root cause

## Scope

- Run: `run-muj2kzx1-8f9f8271`
- Read t210/t211, the published evidence-loop identifiers/codes/counts, and the directly relevant Core loop, grammar, bootstrap-validation, failure-mapping, and tests.
- Did not read provider text, page evidence, selectors, raw logs, credentials, or run payloads. Did not edit Core/source/shared documents, run builds/tests, commit, or touch browser/provider/Lab state.

## Root-cause verdict

The failure has a **model-output cause** and a **Core terminal-classification defect**:

1. The model used all 26 authorized decisions without producing an acceptable Flow. Its 26th and final, completion-only decision did return a completion, but bootstrap validation rejected it under `bootstrap.cannot_answer_instruction`: the proposed result still had no retained step capable of producing/saving the requested record set.
2. Core correctly recorded that final completion as unusable, but then the `for` loop ended at `maxIterations` and the unconditional return at the bottom of `runtime/llm/evidence-loop.ts` replaced the known refusal with `llm_evidence_loop.iteration_limit`. Bootstrap mapped that to `flow_bootstrap.evidence_iteration_limit` at `provider_output_validation`, dropping the decisive issue code from the terminal diagnostic.

Therefore the missing Flow is principally a convergence/model-behavior failure: the last offered result could not answer the instruction. The inaccurate terminal reason is a loop defect. Raising the call ceiling is not supported as the smallest fix.

## Exact state and counter path

The live grant authorized 26 calls. `automationStudioFlowBootstrapEvidenceLoopLimits` sets `maxIterations` to `min(maxCallsPerRun, 64)`, so this run's decision backstop was 26. It sets the tool-call ceiling one higher; the run used only 24 tool calls. The evidence total was 109,661 bytes against the 1,048,576-byte backstop, build duration 221,361 ms against 540,000 ms, and t210 reports cost/tokens below their grant ceilings. Those bounds did not end the loop.

| Iteration range | Counter/state transition |
| --- | --- |
| 0 | Deterministic initial observation; no provider decision. It was rejected because the start location had not been reached. |
| 1–12 | Twelve paid decisions gather evidence and append attempted/successful draft steps. Several page-state refusals occur, but successful actions, observations, and structure detections keep resetting progress. |
| 13–14 | Each paid decision is `amend_draft` with a rerun; each rerun becomes an ordinary tool call and succeeds. `draftAmendments` advances once per decision. |
| 15 | A completion/dry-run path is refused as `llm_evidence_loop.dry_run_refused`; it is recorded as one unusable decision and feedback is made available to the next call. |
| 16 | Another draft-rerun decision applies three non-rerun amendments and reruns an inspection successfully. |
| 17–20 | Structure detection first finds no repeating structure, then later action/structure/inspection calls succeed. |
| 21–23 | Three more draft-rerun decisions each rerun an inspection successfully. The `amended` counts are 1, 0, and 0; a zero does not mean the rerun was refused—it counts only non-rerun amendments. No `amendmentsRefused` codes were published. |
| 24 | A paid decision is unusable as `llm_output.invalid_evidence_decision`; feedback is added and the loop continues. |
| 25 | A seventh draft-rerun decision runs; its node call is rejected `web.action.rejected.invalid_input` / `node_not_runnable_here`. |
| 26 | `iterationsLeft` is 1, so the budget calculation necessarily returns at most one decision. Because completion is available, `finalDecision` becomes true; tools and `amend_draft` are withdrawn and the schema offers only `complete`. The completion check rejects the result as `bootstrap.cannot_answer_instruction`. `unusable()` records the code, sets `lastIssueCodes`, and returns “continue” because this is not a three-in-a-row/no-progress stop. |
| Loop exit | No iteration 27 exists. Control reaches the unconditional `llm_evidence_loop.iteration_limit` return, bypassing the “budget is zero after an unusable answer” handling that exists at the top of a subsequent iteration. |

The trace consequently has 26 distinct paid iterations but 34 published rows: an `amend_draft` rerun produces both an amendment row and the rerun tool-call row. Core's diagnostic correctly counts distinct positive iteration numbers, not rows, as `decisionCount: 26`.

## Why the reruns did not trip another guard

- Draft editing is part of authoring. Core permits up to 16 amendment decisions by default, bounded by `maxIterations`; seven were used.
- A valid rerun request deliberately bypasses repeat-answer suppression, withdraws the old draft step, and executes the corrected call through the ordinary tool path.
- A rerun that executes does not increment the amendment no-progress counter. Its succeeding inspection is treated as a successful evidence result, so the general progress guard does not end the run.
- The published codes do not expose the rerun parameters or which draft step was replaced. They cannot establish that the seven reruns were identical or that Core should have rejected one as a duplicate.

That policy explains how repeated draft reruns consumed calls, but it is not itself proven defective by this run. The bounded record shows correction attempts and eventual non-convergence, not a provably identical infinite repeat.

## Model behavior versus loop defect

### Model behavior

- It continued exploration/amendment through the full grant rather than settling an acceptable result earlier.
- One decision was structurally invalid, one completed draft failed dry-run, and the last rerun targeted a node not runnable in the current state.
- Most importantly, the required final completion still failed `bootstrap.cannot_answer_instruction` despite the completion-only schema and budget instruction.

### Loop defect

- Core knew the final refusal's issue code but reported only `iteration_limit` because the max-iteration `for` exit has no parity with the budget-zero branch at lines 416–422.
- The existing budget test covers a refused final answer when another loop-top check observes that the budget is spent. It does not cover refusal on the literal `maxIterations`-th decision, where there is no next iteration.
- The defect obscures the actionable diagnosis. It did not turn a valid Flow into an invalid one and did not prevent an available 27th call—the grant had no 27th call.

## Smallest correct fix

In Core `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts`, make exhaustion through the bottom of the `for` loop use the same terminal helper as the existing `remaining.decisionsLeft === 0` branch:

- if the most recent decision was unusable and `unusableDecisions` is configured, call `unusableDecisions.stalled` with `lastIssueCodes`, the trace, and accounting;
- throw that result when `propagateDecisionErrors` is true, otherwise return `llm_evidence_loop.invalid_decision`;
- return `llm_evidence_loop.iteration_limit` only when no known unusable answer immediately caused exhaustion.

For this bootstrap caller, the stalled callback already converts that progress to `flow_bootstrap.evidence_unusable_decision` and retains the sanitized issue code `bootstrap.cannot_answer_instruction`. No service or failure-schema change is needed.

Required test ownership:

- `packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/loop-budget.test.ts`: add the max-iteration-backstop variant of “ends as the refused answer,” asserting the stalled callback receives the final issue code and the loop does not return `iteration_limit`.
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/tests/unusable-decision.test.ts`: replace or refine the current expectation that any unusable third/max iteration becomes `iteration_limit`; distinguish a last unusable decision from exhaustion after a usable non-completion path.
- Proportional integration coverage may be added to `packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts` to assert bootstrap surfaces `flow_bootstrap.evidence_unusable_decision` plus `bootstrap.cannot_answer_instruction` when the final allowed completion is refused.

Do **not** fix this by increasing `maxCallsPerRun`, disabling answerability, accepting a Flow with no record-producing node, or treating successful reruns as categorically duplicate. None addresses the observed classification defect, and the latter two weaken correctness.

## Missing diagnostic evidence

- The terminal artifact should retain `issueCodes` for a final refused completion. It currently loses `bootstrap.cannot_answer_instruction` from the failure summary even though the last safe step retains it.
- An iteration-limit diagnostic should state which bound ended the loop: call/iteration backstop, tokens, cost, duration, tool calls, or evidence bytes. This run can be reconstructed as the 26-call backstop only by correlating grant totals and source arithmetic.
- Published steps do not state the `decisionsLeft` value, whether a decision was completion-only, or which decision kinds were offered.
- A draft-rerun step states its amendment count and refusal codes but not a Core-minted identity for the replaced draft step. Without page/model content—which must remain private—a reviewer cannot tell whether successive reruns refined distinct steps or repeated the same correction.
- No proposal survived, so the safe bundle cannot show the final rejected plan shape. The `cannot_answer` code is sufficient to identify the missing capability class, but not which attempted extraction step was dropped or malformed.

## Handoff

Implement the terminal-classification parity fix and its focused tests before interpreting another final-decision refusal. A subsequent live run is still required to establish whether the model converges to a valid Flow; this fix improves truthfulness and debuggability, not the model's authored result by itself.
