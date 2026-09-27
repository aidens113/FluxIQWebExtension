# t216 — Live build budget derivation

## Outcome

Run 1's 26th provider call was not selected by token, cost, or wall-clock exhaustion. It was selected by the **26-iteration call-count backstop** that the runner requested and Core granted. On loop iteration 26, the call-count component of `decisionsLeft` was exactly one, so—because the loop had enough successful tool work to complete—the evidence loop offered only completion and told the model it was the last decision. That completion-only decision was unusable (`bootstrap.cannot_answer_instruction`), and the loop ended `llm_evidence_loop.iteration_limit`, mapped to `flow_bootstrap.evidence_iteration_limit`.

This is the configured behavior working as written. The measured defect is convergence before that backstop: 25 earlier decisions, including seven draft reruns, did not produce a valid proposal. Raising a global budget would mask that behavior and is not the smallest safe product fix.

## Closed arithmetic

### 1. CLI and downstream plan

The t178 command did not supply `--llm-max-calls` or `--llm-max-run-tokens`.

1. `packages/test-contracts/src/llm.ts` supplies `maxCallsPerRun = 26`, request limits 48,000 input / 8,000 output / 56,000 total, a 30,000 ms declared timeout, $0.25 per call, and zero retries.
2. `packages/test-runner/src/commands.ts` copies those defaults into the live profile because no override was present.
3. `create-flow` maps to iterating purpose `build_and_adapt`, so `packages/test-runner/src/live-llm/live-llm-plan.ts` preserves the declared call count: `maxCalls = 26`.
4. Per-request exposure is `56,000 × 26 = 1,456,000` tokens. With no explicit run-token value, the plan applies Core's default formula:

   `max(56,000, min(1,456,000, 560,000)) = 560,000` tokens.

5. Per-call cost remains `min($0.25, $0.25) = $0.25`; total cost becomes `min($2.00, $0.25 × 26) = $2.00`.
6. Timeout becomes `min(30,000 ms, 25,000 ms) = 25,000 ms`; retries remain zero.

The resulting build plan is therefore 26 calls, 560,000 run tokens, $2 total estimated cost, a 25-second per-call timeout, and no retry calls.

### 2. Preflight and grant

`packages/test-runner/src/live-llm/execution-grant.ts` sends the plan unchanged to both preflight and issue:

- `purpose: build_and_adapt`
- `maxCalls: 26`
- `maxUses: 26` on issue
- `maxTotalTokensPerRun: 560,000`
- `maxEstimatedCostUsd: 0.25`
- `maxTotalEstimatedCostUsd: 2`
- `timeoutMs: 25,000`
- `providerRetryCount: 0`

Core's `runtime/llm/execution/grants.ts` treats `build_and_adapt` as iterating, accepts the caller's 26 because it lies inside the 1–64 grant range, verifies the token and cost arithmetic, requires `maxUses === maxCalls`, creates 26 reveal authorizations, and issues a grant with 26 remaining uses. Resolution returns `maxCallsPerRun: 26` to Flow Bootstrap.

### 3. Flow Bootstrap loop

Core's `runtime/loop-limits/flow-bootstrap-evidence-loop.ts` derives:

| Loop value | Arithmetic | Result |
| --- | --- | ---: |
| `maxIterations` | `min(maxCallsPerRun, loop ceiling)` = `min(26, 64)` | 26 |
| `maxToolCalls` | `min(maxIterations + 1, tool ceiling)` = `min(27, 64)` | 27 |
| `maxEvidenceBytes` | loop ceiling | 1,048,576 |
| `maxEvidenceContextBytes` | configured context window | 24,000 |
| `maxTokensPerDecision` | `min(56,000, 48,000 + 8,000)` | 56,000 |
| `maxTotalTokens` | grant run budget | 560,000 |
| `maxCostUsd` | grant total cost | $2.00 |
| `maxDurationMs` | 600,000 ms grant lease less 60,000 ms | 540,000 ms |
| Per-decision cost reservation | `floor(($2 / 26) × 10^9) / 10^9` | $0.076923076 |
| No-progress / consecutive-unusable backstop | `min(24, 26)` | 24 |

The initial observation is a tool call before any provider decision, which is why the tool-call ceiling is one greater than the iteration ceiling. It does not consume one of the 26 provider decisions.

### 4. Why decision 26 was final

Before each provider decision, `runtime/llm/loop-budget.ts` computes each applicable remaining-decision count and takes the minimum:

`decisionsLeft = min(iterationsLeft, tokensAllowed, costAllowed, timeAllowed)`.

At iteration `i`, the configured backstop contributes `26 - i + 1`. Thus iteration 26 contributes exactly one. `runtime/llm/evidence-loop.ts` then sets `finalDecision` when `decisionsLeft === 1` and the loop is eligible to complete; it removes all tools and exposes only the completion decision shape.

Run 1 had 19 successful tool results, well above Flow Bootstrap's `minToolCalls = 1`, so it was eligible to complete. The 26th decision was therefore completion-only. It returned no usable completion, and there was no iteration 27.

The safe run report confirms substantial headroom at termination:

| Bound | Final observed | Ceiling | Used |
| --- | ---: | ---: | ---: |
| Tokens | 366,210 | 560,000 | 65.4% |
| Estimated cost | $0.0573657 | $2.00 | 2.9% |
| Build duration | 221,361 ms | 540,000 ms loop deadline | 41.0% |
| Calls | 26 | 26 | 100% |

Therefore the call/iteration backstop is the only bound known to have reached 100%. The authorized reports do not retain the per-turn `core.budget` entries, so they cannot prove whether another derived remaining-decision count tied the backstop at one; no token, cost, deadline, or budget-breach failure was emitted. The call backstop necessarily selected the last decision regardless of any tie.

## Budget change versus convergence fix

### Recommended product disposition

Do **not** raise the shared 26-call default from this run. The loop already showed the final-decision budget signal and enforced completion-only at call 26. The failure was that the prior 25 decisions did not converge: the safe trace contains seven draft reruns, a refused dry run, an invalid evidence decision, a non-runnable final rerun, and then inability to complete. More calls would authorize more of the same pattern without evidence that another turn is sufficient.

The smallest correct product change should be in Core's convergence/progress path, after the dedicated root-cause analysis determines which transition was wrong. Candidate seams are:

- `runtime/llm/evidence-loop.ts`: progress accounting, draft-rerun handling, final-decision transition, and unusable-decision handling;
- `runtime/llm/loop-budget.ts`: remaining-call presentation only if the recorded final-budget signal was incomplete or late;
- `runtime/loop-limits/flow-bootstrap-evidence-loop.ts`: derivation only if the grant's call allowance and loop decisions are proven to require a reserve not represented today;
- `runtime/service.ts`: Flow Bootstrap's wiring of limits, draft validation, and completion checks.

A convergence fix should make repeated draft repair either produce measurable new draft/evidence progress, redirect while enough calls remain, or stop with a specific non-convergence cause. It should not reinterpret a cost/token budget as permission for unlimited calls.

### Smallest reversible budget experiment

If the supervisor needs a controlled diagnostic rather than a product fix, the smallest configuration-only change is adding `--llm-max-calls 27` for one serial run. No source default needs to change. Its effects are explicit:

- loop backstop rises from 26 to 27 decisions;
- token budget remains 560,000 unless `--llm-max-run-tokens` is separately changed;
- total cost remains $2;
- per-decision cost reservation falls from $0.076923076 to `floor(($2 / 27) × 10^9) / 10^9 = $0.074074074`;
- the former 26th decision is no longer necessarily completion-only, and the 27th becomes the backstop.

This experiment can answer whether exactly one extra correction suffices, but a pass would not by itself justify raising the default. A repeated non-converging trace would strengthen the convergence diagnosis.

## Existing tests that pin the arithmetic

Downstream:

- `packages/test-runner/src/live-llm/tests/live-llm-plan.test.ts` pins `create-flow` to the default 26 calls, the 560,000-token default run budget, and explicit operator call overrides.
- `packages/test-runner/src/live-llm/tests/live-llm-run.test.ts` pins the issued build grant request to `maxCalls: 26` and records build accounting.

Core:

- `runtime/llm/tests/execution-grant/tests/execution-grants.test.ts` pins default iterating grants to 26 calls/uses, 560,000 tokens, $2, and 26 reveal authorizations.
- `runtime/loop-limits/tests/flow-bootstrap-evidence-loop.test.ts` pins 26 calls to 26 iterations, 27 tool calls, the $2/26 reservation, token/cost/deadline budgets, and the 24-step no-progress backstop.
- `runtime/llm/tests/loop-budget.test.ts` pins minimum-bound arithmetic, the newest `core.budget` entry, completion-only final decisions, and iteration-limit behavior when the final decision does not complete.
- `runtime/llm/tests/evidence-loop.test.ts` pins raw iteration-limit enforcement; `runtime/llm/tests/unusable-decision.test.ts` pins the unusable-decision far backstop.

## Required regression coverage for a convergence change

The narrow regression should model the observed shape without provider text or page evidence: a 26-decision Flow Bootstrap budget, successful tool results interleaved with seven draft reruns, isolated unusable decisions, a non-runnable late rerun, and a completion-only last decision. It should assert the intended corrected outcome—earlier specific non-convergence or valid completion—and that tokens, cost, deadline, grant uses, and provider-free replay boundaries remain unchanged.

Likely owned tests are `runtime/llm/tests/draft-amendment-feedback.test.ts`, `runtime/llm/tests/repeat-policy.test.ts`, `runtime/llm/tests/loop-budget.test.ts`, and `runtime/loop-limits/tests/flow-bootstrap-evidence-loop.test.ts`. If a default or request field changes, also update the two downstream live-plan/live-run tests named above and Core's execution-grant test.

## Diagnostic gap

The safe build record reports aggregate usage and the evidence-loop trace, but not the per-turn `core.budget` values shown to the model. Persisting closed numeric `decisionsLeft`, `tokensLeft`, `costLeftUsd`, and `secondsLeft` per decision would prove which dynamic bound won or tied without retaining prompts, responses, selectors, or page data.

No raw run artifact, provider content, browser state, source/shared document, build, test, commit, or Lab state was read or changed.
