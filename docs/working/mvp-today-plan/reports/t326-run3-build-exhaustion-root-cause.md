# t326 — Run 3 build-exhaustion root cause

## Scope and evidence boundary

This is a read-only diagnosis. I did not open run artifacts, provider prompts or responses, page captures, selectors, credentials, or browser state; I did not run tests or a provider command. The run-3 facts below are the supervisor-provided sanitized facts. Comparisons use the sanitized run-1/run-2 debug records and reports, plus the owning FluxIQ Core source and focused tests.

## Verdict

Run 3 is a **truthfully classified build-convergence failure**, not a recurrence of the old terminal-classification defect. The build spent all 26 authorized decisions and ended with no acceptable Flow. The last retained validation reason is `bootstrap.cannot_answer_instruction`, surfaced as `flow_bootstrap.evidence_unusable_decision` at `provider_output_validation`. No proposal existed, so nothing reached review, authored shape, runtime, oracle, repair, or replay.

The concrete product deficiency is reliability: this hard scenario can consume the entire build allowance while repeatedly correcting its draft and still fail to author an answerable Flow. The permitted evidence does **not** isolate a new deterministic Core implementation bug or prove that any two reruns were semantically identical. It supports a bounded model/authoring non-convergence diagnosis.

## Measured comparison

| Run | Build outcome | Decisions/calls | Tool calls | Evidence | Relevant trace shape |
| --- | --- | ---: | ---: | ---: | --- |
| Run 1, `run-muj2kzx1-8f9f8271` | No proposal; final answerability refusal was incorrectly flattened to iteration-limit | 26/26 | 24 | 109,661 bytes | Seven draft reruns; refused dry run; invalid decision; late `node_not_runnable_here`; terminal `bootstrap.cannot_answer_instruction` |
| Run 2, `run-muj39xl6-f6a5d4e5` | Proposed successfully and reached playback | 19 main calls, 18 loop calls | 15 | 91,140 bytes | Seven amendment decisions, six reruns, one unchanged draft, two intermediate unusable decisions, then accepted completion |
| Run 3, `run-mujd550n-e8fbe7aa` | No proposal; truthful final unusable-decision failure | 26/26 | 21 | 98,063 bytes | Ten draft reruns, two draft amendments, one unchanged draft, invalid evidence decision, two cannot-answer endings, and a late invalid-input `node_not_runnable_here` |

Run 3's integrity/redaction checks were valid and it stopped at build. Its evidence total was far below Core's 1,048,576-byte backstop. The terminal diagnostic and 26/26 count identify decision exhaustion following a refused answer, not evidence-byte exhaustion. The supplied facts contain no proposal or downstream-stage evidence.

## Causal chain

1. The loop gathered evidence and accrued/corrected a draft. Ten rerun decisions consumed provider decisions and executed tool calls; one draft amendment was explicitly unchanged.
2. Late outputs still did not settle an acceptable result: the trace includes an invalid evidence decision, `node_not_runnable_here`, and two completions that could not answer the instruction.
3. At the 26-decision backstop, no acceptable completion existed. Core preserved the last actionable completion issue, `bootstrap.cannot_answer_instruction`, through its unusable-decision callback.
4. Because no completion passed validation, Flow Bootstrap emitted no proposal and every later lane was necessarily absent.

The measured cause is therefore **failure to converge on an answerable authored Flow within the authorized build decisions**. The answerability rejection is substantive: accepting it would weaken the product contract by permitting a Flow that cannot produce/save what the instruction requests.

## What Core currently does

- `runtime/loop-limits/flow-bootstrap-evidence-loop.ts` maps the grant's default 26 calls to 26 loop iterations, gives tools one extra ceiling for the deterministic opening observation, and supplies token/cost/deadline budgets. It does not promise that 26 calls will converge.
- `runtime/llm/loop-budget.ts` shows the model its remaining decisions and makes the last affordable decision completion-only.
- `runtime/llm/evidence-loop.ts` treats a runnable draft rerun as an ordinary fresh tool execution. A successful execution clears general no-progress state. An amendment that changes nothing increments no-progress, while a landed amendment neither clears nor increments it. This is intentional and covered behavior.
- The shared `exhausted()` path now preserves the latest unusable decision and issue codes at both budget-zero and literal max-iteration exits. Generic `iteration_limit` remains only when exhaustion does not immediately follow a known unusable decision.
- Completion answerability checks deliberately emit `bootstrap.cannot_answer_instruction` when the authored plan cannot produce/save the requested records.

## Known fixed classification

Run 1 exposed two different matters: model/authoring non-convergence and a Core reporting defect. Core recorded the final `bootstrap.cannot_answer_instruction`, then used to overwrite it with `llm_evidence_loop.iteration_limit` after the literal final iteration. T217 added the shared exhaustion path and focused tests without changing budgets, convergence, rerun, or answerability policy.

Run 3 is direct live evidence that this fix works: essentially the same exhaustion family now ends as `flow_bootstrap.evidence_unusable_decision` with `bootstrap.cannot_answer_instruction`. This is an improvement in truthfulness and diagnosis only; it was never expected to make the provider converge.

## Stochasticity and limits of inference

Observed outcome variability is real: run 2 completed under the same 26-call profile in 19 main calls, whereas runs 1 and 3 exhausted it. That refutes a claim that the scenario is deterministically impossible or that the fixed classification itself prevents success.

Calling the variation “stochastic” is an inference, not a measurement of model randomness. The safe records do not hold page state, rerun arguments, provider text, or hidden reasoning, so differences may arise from provider outputs, exploration choices, transient page state, or their interaction. Three attempts are not a rate estimate. Evidence-byte volume alone is not explanatory: the successful run gathered 91,140 bytes and run 3 gathered 98,063, both well below the backstop.

## Product defect and test/diagnostic gap

### Confirmed product-level defect

The hard-scenario build is not reliably convergent: two observed attempts used the full authorization without producing any Flow, even though one intervening attempt completed. This is a user-visible creation reliability defect. The present safe evidence localizes it to build authoring/convergence, but not to a single faulty branch in Core.

### Not proven as a Core defect

It is not justified to reject every repeated rerun, raise the call ceiling, disable answerability, or label successful reruns duplicates. Core deliberately reruns corrected actions, and the sanitized trace does not disclose enough identity or parameters to prove a semantic cycle. Run 2 also used six reruns and converged.

### Concrete remaining gap

Current focused tests establish loop bounds, remaining-call guidance, completion-only final decisions, truthful final-refusal classification, rerun execution/refusal, and unchanged-amendment no-progress behavior. They do not provide a deterministic end-to-end fixture for the live non-convergence shape: many successful reruns interleaved with draft edits, an unchanged edit, a late unrunnable correction, repeated answerability refusals, and final exhaustion.

Add a scripted Core integration test for that sequence with sanitized identities. It should first pin existing invariants:

1. every decision and rerun is counted once under the 26-decision bound;
2. an explicitly unchanged amendment advances the no-progress counter;
3. successful reruns are not silently collapsed or misreported;
4. the final diagnostic remains `flow_bootstrap.evidence_unusable_decision` with `bootstrap.cannot_answer_instruction`; and
5. no proposal is persisted after the refused completion.

That test would reproduce and stabilize diagnosis; it should not invent a new stop policy. A product-policy experiment can then evaluate whether repeated reruns need a separate bounded “draft convergence” signal or earlier answerability checkpoints. The present trace cannot specify such a policy safely because successful execution is not equivalent to semantic progress toward an answerable Flow.

The remaining diagnostic gap is the same boundary exposed by run 1: sanitized `draft_rerun` rows do not prove which stable draft identity was replaced or whether successive corrected inputs were materially different. A privacy-safe, Core-minted step identity and non-content change indicator would permit cycle analysis without recording page/provider content.

## Sources inspected

- `docs/working/language-driven-flow-loop-plan/debugs/run-muj2kzx1-8f9f8271.md`
- `docs/working/language-driven-flow-loop-plan/debugs/run-muj39xl6-f6a5d4e5.md`
- Reports t210, t213, t215, t217, and t230
- Core `runtime/llm/evidence-loop.ts`, `loop-budget.ts`, and focused evidence-loop/budget/draft tests
- Core `runtime/loop-limits/flow-bootstrap-evidence-loop.ts`
- Core Flow Bootstrap answerability and generation-failure source/tests

No tests were executed; this report changes documentation only.
