# Provider-disabled public accounting compatibility

## Current State

Read-only discovery complete. Public success-path compatibility exists, but it currently rests on an absence-based zero helper; actual execution regression and the default-enabled deadline accounting gap remain unverified. All source remains unchanged by this unit. No tests, builds, types, audits, source/shared-document edits, runtime, provider, key, or state actions performed.

## Confirmed public consumer shape

The downstream `ExistingFluxIQControlClient` run-detail parser reads `detail.metadata.llmGate.costAccounting.calls` into optional `providerCallCount`. It does not derive zero from absent interventions, absent gate, or disabled configuration. Optional `llmAccounting`, gate, and provider-call records are projected from the same metadata owner. Strict replay requires explicit zero calls or accounting and rejects incomplete/nonzero accounting, contradictory records, interventions, invoked model gate, or nonzero harness activation.

Public false construction omits standing/session/chat model provider bindings. That proves construction admission, and does not install a public runtime call ledger. Ordinary service `getFlowRunDetail` delegates to its run-detail reader; session conversion also runs when session details are written. The actual existing success-path publication is traced below; runtime compatibility remains untested.

## Inspected owner inventory

- Core `packages/fluxiq/src/framework/index.ts`: option/forwarding contexts only.
- Core `packages/fluxiq/src/programs/_shared/runtime.ts`: construction admission contexts only.
- Core `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`: ordinary run result-port setup and get/write detail contexts only.
- Downstream `packages/test-runner/src/existing-fluxiq-control.ts`: run-detail public parser and public shape only.
- Downstream `packages/test-runner/src/saved-flow-replay/provider/free-accounting.ts`: strict consumer.

Approved additions inspected: Core `runtime/service/run-detail-read/flow-run-detail-reader.ts` and `runtime/service/summaries/conversions.ts` under the same AutomationStudio owner. Session conversion publishes attempts/recovery/interventions and closed summary metadata, not `llmGate` or call accounting. The reader returns an existing typed/legacy detail verbatim or reconstructs from the session with partial-write metadata. Neither derives or measures a zero-call ledger.

Supervisor approved and this worker read `runtime/result-verification/zero-provider-run.ts` and its caller's relevant no-provider/settlement contexts in `runtime/result-verification/run-outcome.ts`. Missing metadata remains unknown, and constructor omission must not be turned into synthetic runtime zero.

## Existing zero publication: compatibility versus measurement

Supervisor-approved helper/caller reads show a baseline, unchanged t179 path already publishes the exact zero gate shape strict replay consumes. `automationStudioZeroProviderGate` returns explicit zero calls/tokens/cost/budget breaches/pending calls and an empty call list only when `detail.metadata.llmGate` is absent and both prior/run-verification intervention arrays are empty. `recordOnRunDetail` writes this gate together with result-verification metadata and the verdict. Successful-session verification reaches this save after its bounded check; non-succeeded sessions instead go to failed-step repair.

This is an absence-based inference, not independent measured provider admission. The bounded verification fallback supplies `interventions: []` after timed-out/aborted/thrown work, and that fallback still reaches the same zero helper. A call whose intervention has not returned is therefore not excluded by this helper's predicate. This is a source-level risk, not a reproduced provider execution in this unit. No source change is proposed from disabled configuration alone.

Final approved reads: `runtime/result-verification/verify.ts` dispatch/intervention contexts, `runtime/service/runtime-adaptation/result-check.ts` resolver contexts, and `runtime/llm/harness/run.ts` dispatch/run-budget contexts. These separate actual no dispatch from missing returned intervention.

## Exact disabled ordinary path

For an ordinary deterministic run with no `llmExecution`, false construction installs neither the session resolver nor the standing resolver. The result-check resolver can return a caller's provider first, but this ordinary invocation supplies no caller execution authority; with the standing resolver absent it returns undefined even if the Flow retains a scheduled standing check and its authorizations. `verifyAutomationStudioRunResult` returns `performed: false`/the no-model skip code and an empty intervention list before `askOnce`. A deterministic arithmetic observation can also return before resolving any provider.

For a succeeded session, the result-verification settlement records the outcome and legacy explicit zero gate in one detail save when no previous gate/intervention is present. The public parser then supplies `providerCallCount: 0`, a complete zero accounting object, `llmGate.invoked: false`, an empty provider-call list, and omitted-count zero. These satisfy the current strict replay consumer, assuming zero external harness activations. The result remains unjudged where no model was available: zero calls does not change the verification verdict or imply successful task oracles.

This is static control-flow evidence for the ordinary no-dispatch branch, not a runtime proof. False construction does not bar a trusted later manual rebind, a custom/native action independently invoking a provider, or an override of the public service. A failed session follows failed-step repair instead of this succeeded-session verdict publication; missing public accounting there must stay unknown.

## Precise default-enabled accounting hazard

1. A succeeded run has no existing `llmGate` and no prior recovery intervention.
2. Its result resolver supplies a provider. `verify.ts` enters `askOnce`, which awaits `runAutomationStudioLlmHarness`.
3. The harness performs preflight and optional budget admission before calling `automationStudioLlmProviderCall`. A provider response can complete with known paid usage and a first intervention. A first answer that needs confirmation enters a second check.
4. The outer verification deadline expires while the first or second actual provider dispatch is pending. Its fallback report sets `interventions: []`, discarding any first-check intervention because the overall `verify.ts` report has not returned yet.
5. `recordOnRunDetail` sees absent old gate and both intervention arrays empty. The legacy helper writes complete calls/tokens/cost/pending zero even though dispatch may have occurred, and can hand that run to the adaptation replay recorder as `askedNoModel`.

The source proves this control-flow gap; this unit did not run a reproduction. The two-check case also loses a potentially already known first paid call, not merely uncertain pending usage. This hazard is separate from the disabled ordinary branch and must not be described as a disabled provider being invoked. The helper is unchanged baseline source (approved bounded git diff was empty), with t179 ownership stated in its header.

## Smallest truthful follow-up and fail-first cases

First run actual mocked public-runtime regressions before implementing a measurement change. Proposed exact owners for a written release:

- Existing Core `programs/_shared/tests/model-provider-admission.test.ts`: extend the real false factory fixture with an ordinary public saved Flow/native action execution, terminal `getFlowRunDetail` read, before-construction key-reveal spy, and fresh underlying provider-dispatch observer. Assert original service/key identity retained, dispatch/reveal zero, explicit public accounting, and unchanged no-model verdict. Existing public framework fixture can provide the public factory forwarding case. Release/read the nearest native-runtime/service support before selecting helpers; do not copy mirrored test support.
- Existing Core `runtime/result-verification/tests/run-outcome.test.ts` and owning `tests/run-outcome-harness.ts`: actual bounded verification with a provider that signals dispatch before remaining pending; require publication to remain unknown/nonzero/pending instead of zero. A second case completes a paid first check, then stalls confirmation; first paid evidence must survive and no zero proof/replay qualification may be produced. A third case times out before provider resolution/dispatch; it must not invent a call and should expose a definitive observed zero only if the capture lifetime actually covers the whole check.
- Existing `runtime/result-verification/tests/zero-provider-run.test.ts`: partial/missing/contradictory evidence remains unknown; existing positive no-provider semantics and prior recovery gates remain intact.
- Existing downstream `existing-fluxiq-control.test.ts` and `saved-flow-replay/provider/tests/free-accounting.test.ts`: public explicit zero accepted; missing/pending/attempted/nonzero/contradictory evidence rejected. No client fallback from disabled configuration.

The capture must begin before the bounded verification task and survive its timeout/abort fallback. The earliest generic call authority seen is the actual provider-dispatch boundary reached through `automationStudioLlmProviderCall`, after all harness preflight/refusal paths. Count neither `verify` entries nor `askOnce`/harness entries: an unsent budget refusal is not a dispatch. Preserve `providerInvocation: not_attempted` versus attempted/unknown, pending work, and actual reported paid usage. Internal retries retain existing logical-question accounting, with retry attempts separate. A definitive zero requires a completed observation scope with no dispatch/pending work, not an absent final intervention list.

Minimal production partition to investigate after a meaningful failure: `result-verification/run-outcome.ts` scoped capture/timeout settlement, `result-verification/verify.ts` per-check emission/retention, `result-verification/zero-provider-run.ts` require affirmative current capture, and a focused generic observation seam alongside the provider invocation owner if existing hooks cannot report attempt/pending/settlement. `llm/harness/run.ts` and discovered `llm/provider-retry/call.ts` are candidate authority owners; the latter was located through imports but not read in this bounded unit. A release must inspect its real invocation/provenance contract before choosing that seam. Reuse existing run-budget receipt where it already measures the same current calls, but do not invent one from reserve/harness counts or silently alter budget policies.

Keep completed-check interventions and known paid usage even if later work does not finish. If only a pending/unknown attempt is available, publish that bounded fact without fabricated token/cost totals; strict replay should fail closed. Preserve original run status, standing check schedule, result-verification policy, service identities, key authorization/storage, normal enabled defaults, and late-task write prevention. No runtime-wide all-role total can be claimed solely from a verification-local counter unless earlier recovery accounting coverage is explicitly proven; absent historical accounting remains unknown.

## Supervisor acceptance dependencies

No accepted usable A/B saved Flow exists, so actual unchanged reuse remains blocked independently of this compatibility work. After C4 source freezes and fresh public builds/gates pass, root must release the exact mocked runtime/accounting regression, inspect its observed result, and decide whether the measured deadline seam needs implementation before any paid/live retry or saved replay. Constructor tests and source reasoning alone do not certify zero provider execution.
