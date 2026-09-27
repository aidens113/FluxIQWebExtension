# t229 Run-2 Reauthor Root-Cause Trace

## Outcome

The smallest owning Core path is `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`, specifically:

- the refuted-result callback in `AutomationStudioService.runRuntimeSession`, which routes the wrong answer back into `generateFlowBootstrapAdaptation(... mode: "extend")`; and
- `AutomationStudioService.generateFlowBootstrapAdaptation`, whose broad `provider_request` stage window and outer catch produced the terminal diagnostic.

The supporting classification owner is `runtime/flow-bootstrap/generation-failure/phase-failure.ts` plus `failure-state.ts`; the route/record owner is `runtime/recovery/refuted-result/reauthor.ts`.

No raw run artifact or provider text was inspected. The evidence proves the class and stage recorded by Core, but not the exact throwing statement. A provider-specific behavioral fix or automatic retry is therefore not justified yet.

## Files inspected

Downstream reports:

- `t226-run2-build-debug.md`
- `t227-run2-runtime-judge-debug.md`
- `t228-run2-integrity-and-accounting.md`

Core source and directly relevant tests:

- `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`
- `runtime/recovery/refuted-result/reauthor.ts`
- `runtime/recovery/refuted-result/tests/reauthor.test.ts`
- `runtime/flow-bootstrap/generation-failure/phase-failure.ts`
- `runtime/flow-bootstrap/generation-failure/failure-state.ts`
- `runtime/flow-bootstrap/generation-failure/harness-failure.ts`
- `runtime/flow-bootstrap/generation-failure/tests/round-trip.test.ts`
- `runtime/tests/service-bootstrap/tests/accounting.test.ts`
- `runtime/tests/service-bootstrap/tests/extend.test.ts`
- `runtime/service/flow-bootstrap-commands/generation-request.ts`
- `runtime/llm/harness/run.ts`
- `runtime/llm/provider-retry/call.ts`
- `runtime/llm/provider-contract.ts`
- `runtime/llm/failure-disposition.ts`
- `runtime/llm/execution/grants.ts`
- `runtime/llm/evidence-loop.ts`
- `runtime/llm/unusable-decision.ts`
- `runtime/llm/tests/unusable-decision.test.ts`
- `packages/fluxiq/src/programs/_shared/runtime.ts`

## What is proved

1. The 12-of-13 dataset mismatch was judged and correctly refuted as `core.result.does_not_answer_request`.
2. `automationStudioRefutedResultReauthorDecision` correctly routes that closed code when the project and Flow are available. Run 2 entered this route.
3. The service attempted extend-mode Flow Bootstrap generation. It produced no repair adaptation and recorded `flow_bootstrap.unexpected_error`, stage `provider_request`, `retryable: false`, provider invocation `attempted`, and provider response `unknown`.
4. `flowBootstrapUnclassifiedThrowCode` produces exactly `flow_bootstrap.unexpected_error` when an ordinary `Error` (not a typed Flow Bootstrap error, grant refusal, `TypeError`, `RangeError`, or `DOMException`) escapes while the service's current stage variable is `provider_request`.
5. The existing accounting test deliberately asserts that exact conservative tuple for a raw harness `Error`; the classification is internally consistent with current code.
6. No repair adaptation was applied, so refusing to replay the same Flow is correct. `automationStudioRefutedResultFlowWasReauthored` requires `applied: true` before rerun.

## What is not proved

The permitted evidence does not identify which statement threw. In `generateFlowBootstrapAdaptation`, the service advances `failureStage` to `provider_request` immediately after provider resolution, before build routing, harness-option construction, limits/authority/permission setup, evidence-loop setup, or the first harness call. Any ordinary `Error` across that entire region collapses to the same tuple.

Known provider failures normally return structured harness diagnostics and are projected to specific Flow Bootstrap codes. The generic `unexpected_error` therefore does **not** prove a DeepSeek transport, HTTP, timeout, malformed-output, budget, or credential failure. It also does not prove that bytes reached the provider: `providerInvocation: attempted` is derived from the broad stage, not an independently published observation. The 21-call roll-up contains the 19 build and 2 verification calls and no separately attributed reauthor call, but the permitted accounting cannot prove whether an unrecorded call occurred.

One source-level concern is the reauthor callback's replacement of the run grant's purpose with `explore_and_adapt`: real grants include purpose in exact scope equality. A different original purpose would be a deterministic scope mismatch. However, a mismatch caught during provider resolution should be published as `flow_bootstrap.execution_grant_scope_mismatch` at `provider_resolution`, which is not run 2's record. Without the original repair grant scope or the thrown typed value, this remains a hypothesis, not the root cause.

## Retry, disposition, and classification assessment

- **Retry:** `retryable: false` is the safe answer for an unclassified ordinary `Error`. Blindly retrying could repeat a Core guard/defect or duplicate a request whose disposition is unknown.
- **Disposition:** stopping the repair and leaving the original Flow unchanged is correct. There is no safe adaptation to apply or replay.
- **Response state:** `providerResponse: unknown` is honest.
- **Classification precision:** the code `flow_bootstrap.unexpected_error` is a valid fallback, but `stage: provider_request` and `providerInvocation: attempted` are too strong because the service marks the stage before request execution. This is the actionable defect exposed by run 2.

## Smallest safe fix

Do not add a retry or provider-specific special case. Narrow the request boundary in `generateFlowBootstrapAdaptation`:

1. Keep routing, option-registry, authority, permission, and evidence-loop setup outside the `provider_request` classification window.
2. Wrap each actual `runFlowBootstrapLlmHarness` invocation in one focused helper that converts an untyped thrown value using the provider-request diagnostic rules while preserving typed harness/provider failures unchanged.
3. Classify ordinary errors thrown before that helper as pre-request/setup failures with `providerInvocation: not_attempted` and `providerResponse: not_received`.
4. Continue publishing only closed codes and flags; do not persist exception messages.

This is the smallest safe change because it changes diagnosis, not budgets, permissions, retry policy, or Flow behavior. A subsequent run will identify whether the failure is pre-request setup, a typed provider outcome, or a true untyped harness throw. Only then should the narrower owner receive a behavioral fix.

The purpose rewrite should be covered at the same time but not changed speculatively: verify that extend-mode reauthoring presents the exact original grant scope to the real resolver. If the integration test demonstrates a mismatch, preserve the original purpose rather than relabelling an issued grant, and let the generation-request gate decide which original purposes may enter extend mode.

## Focused test gap

Current coverage is split across seams that cannot catch this composition failure:

- `service-bootstrap/tests/accounting.test.ts` covers a generic generation-time raw harness error, but not the refuted-result reauthor route.
- `recovery/refuted-result/tests/reauthor.test.ts` stubs `generate`, `approve`, and `apply`; it cannot test stage ownership, provider invocation, grant scope, or accounting.
- `service-bootstrap/tests/extend.test.ts` uses a fake resolver and an already suitable grant shape; it does not exercise the real scope-enforcing grant service.
- the real-grant recovery tests do not drive a refuted result into extend-mode generation and application.

Add one service-level fixture using `AutomationStudioLlmExecutionGrantService` that drives a model-refuted result through `repairRefutedResult` into extend mode. It should cover:

1. a pre-request setup `Error`: no provider call, pre-request stage, `not_attempted` / `not_received`;
2. an actual raw harness `Error`: `provider_request`, `unexpected_error`, `attempted` / `unknown`, non-retryable;
3. a structured retryable provider failure: its specific code, retryability, status/response state, and accounting survive unchanged;
4. a successful proposal/approve/apply path: `resultReauthor.applied: true` and only then replay;
5. exact grant-scope preservation, especially the original purpose, across verification and reauthor resolution.

Also assert that failure before an adaptation yields no apply/replay and that the stored `resultReauthor` record contains no raw message.

## t217 nuance correction

Run 2 did **not** exercise t217's bottom-of-loop final-exhaustion helper. The initial build recorded two ordinary `core.decision_unusable` rows, continued, reached `core.decision_complete`, and produced a proposal. T217's `exhausted()` helper in `runtime/llm/evidence-loop.ts` applies only when the loop ends with its last paid decision unusable at the iteration/budget boundary; `runtime/llm/tests/unusable-decision.test.ts` directly covers that case. The later reauthor failure was `flow_bootstrap.unexpected_error`, not final unusable-decision exhaustion.

This corrects the broader wording in t226: ordinary unusable-decision handling was exercised; t217's final-exhaustion path was not.

## Validation performed

Read-only source and test inspection with `rg` and `Get-Content`. No raw artifact, provider content, source/shared-document edit, build, test execution, live/provider/browser action, or commit was performed.
