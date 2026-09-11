# Report: audit-core-runtime

Audit of what FluxIQ Core already provides for Week 1 and what it lacks.
Read-only. Core at `e522f17` on `dev` (`F:\!FluxIQ`); this repository at
`d848536` on `dev`. Every claim cites `path:line` or an exported symbol.
Unqualified paths are Core (relative to `packages/fluxiq/src/` unless a
`packages/` prefix appears); paths in this repository are prefixed `ext:`.

## Outcome

Done. Sections (a)-(e) below. The headline results:

- Core's runtime kernel, IO seam, element matcher, expected-transition
  comparison, failure enums, recovery ladder and LLM harness all exist and are
  public. Week 1 needs far fewer new Core seams than the phase outline assumed.
- Three of them are **wired but inert** for the web domain: the element-target
  safety gate never runs (no candidates are ever supplied), the host-runtime
  state/evidence boundary is never bound, and the expectation node always
  passes.
- One genuine Core gap dominates Week 1.5: **structured failure status is
  destroyed three times** between the extension and the failure classifier, and
  the classifier then reconstructs it with regular expressions over free text.
  Three Core seams are needed and one proposed one is not; each is named with
  an owning package and a compatibility note in (c).

## What changed and why

Nothing changed. Read-only investigation, as the brief requires.

## (a) Runtime contracts a domain plugs into

### Action attempt

| Contract | Location | Notes |
| --- | --- | --- |
| `FluxIQRuntimeCommand` | `runtime/contracts.ts:59` | Transport-neutral; `kind` is `execute_action`/`capture_snapshot`/`read_state`/`run_flow`/`custom` (`:52`). |
| `FluxIQRuntimeCommandResult` | `runtime/contracts.ts:81` | `status` (`:73`) is `succeeded`/`failed`/`timed_out`/`cancelled`/`rejected`/`unknown`. |
| `FluxIQRuntimeCommandAttempt` | `runtime/contracts.ts:120` | Persisted per attempt with transport, adapter, client, session, timings. |
| `RuntimeService.dispatch` | `runtime/service.ts:181` | Selects adapter or transport, emits `command.dispatched`/`command.result`, settles the attempt. |
| `withRuntimeBounds` | `runtime/service.ts:343` | The only place `timed_out` is produced: `command.timeoutMs > 0` races the call and resolves `status: "timed_out"` (`:353-365`). Abort resolves `cancelled` (`:366-371`). |
| `RuntimeActionAttempt` | `programs/automation-studio/model/runtime.ts:6` | Automation Studio's own attempt record, with `preStateFingerprint`/`postStateFingerprint`. No producer on the path I traced — see (e). |
| `AutomationStudioNodeAttemptTrace` | `programs/automation-studio/runtime/executor/contracts.ts:104` | The attempt record the MVP loop actually produces. |

Downstream side: `ext:domain/src/runtime/adapter.ts:16`
`createWebAutomationRuntimeAdapter` registers a `transport: "direct"` adapter
through `fluxiq.runtime.registerAdapter` (`ext:domain/src/runtime/service.ts:17`),
and `ext:domain/src/runtime/service.ts:22` calls `bindRuntimeService`.

### Output node execution

- `IoRegistry`, `OutputAdapter`, `defineOutput` — `io/index.ts:145`, `:81`,
  `:107`. `OutputDispatchResult` (`io/index.ts:29`) is
  `{ ok, outputId, payload?, error?, metadata? }`.
- `dispatchPolicyOutput` — `programs/automation-studio/runtime/io-policy.ts:11`.
  Resolves the output, prepares the element target, dispatches, optionally
  awaits a confirmation input, returns `AutomationNodeExecutionResult`.
- `createIoPolicyEffectDispatcher` / `createRuntimePolicyEffectDispatcher` —
  `io-policy.ts:54`, `:70`. The runtime variant prefers `RuntimeService.dispatch`
  when a capability advertises the output (`runtimeCanDispatchOutput`, `:197`)
  and falls back to the IO adapter otherwise (`:79`).
- Wiring: `programs/automation-studio/runtime/service.ts:3432-3435` sets
  `graphOptions.effectDispatcher` from the bound IO runtime; `:795`, `:801`,
  `:803`, `:805` are `bindIoRuntime`, `bindNativeNodeRuntime`,
  `bindHostRuntime`, `bindRuntimeService`.
- Effects reach the dispatcher through `dispatchAutomationStudioEffects`
  (`runtime/executor/node-execution.ts:114`), which offers it **every** effect a
  node emits, not only `policy.output.dispatch`, and lets a `status: "failed"`
  return flip the node (`:119`).
- Importer node/implementation seam: `AutomationStudioImporterSdkManifest`
  (`programs/automation-studio/nodes/importer-sdk.ts:44`) and
  `AutomationStudioImporterImplementationBundle` (`:82`); execution context
  `AutomationStudioNativeNodeContext` (`:61`) carries `elementMatcher` and
  `resolveTarget(resolverId, target)` (`:73-74`).

### State / evidence provider

| Contract | Location |
| --- | --- |
| `StateSnapshot`, `StateNamespace`, `StateValue`, `StateDelta` | `programs/automation-studio/model/state.ts:176`, `:169`, `:154`, `:222` |
| `StatePathSchema` | `model/state.ts:204` |
| `diffStateSnapshots`, `applyStateDeltas` | `model/state-diff.ts:7`, `:32` |
| `RecordingDomainDefinition`, `RecordingDomainEventDefinition` | `model/recording-domain.ts:94`, `:83` |
| `RecordingDomainEventReducer`, `RecordingDomainObservationExtractor` | `model/recording-domain.ts:75`, `:79` |
| `processRecordingDomainEvent` | `model/recording-domain.ts:172` |
| `AutomationStudioHostRuntimeBoundary` | `runtime/host-runtime.ts:26` — `captureStateSnapshot`, `inspectStateDiff`, `rollbackHint`, plus a `capabilities` iterable (`AutomationStudioHostRuntimeCapability`, `:4`). |
| `AutomationStudioHostStateSnapshotRef` | `runtime/host-runtime.ts:12` |
| Capture points | `runtime/executor/host-state.ts:6` — `before_action`, `after_action`, `after_wait_retry`, `after_patch_test`; results land in `attempt.stateRefs` (`runtime/executor/contracts.ts:123`). |
| Evidence model | `model/evidence.ts` — `EvidenceReference:16`, `StateFact:37`, `NodeEvidenceRole:41`, `EvidenceComparator:49`, `NodeEvidenceBinding:58`. |
| Gateway evidence wire types | `packages/contracts/src/client-gateway.ts` — `ClientGatewayStateUpdate:36`, `ClientGatewayRecordingEvent:44`, `ClientGatewaySnapshot:81`. |

### Expected-state validation

- `AutomationStudioExpectedTransition` — `runtime/executor/contracts.ts:19`
  (`expectedRoute`, `expectedStatus`, `expectedOutputs`, `expectedEffects`,
  `expectedState`, `tolerance`).
- `AutomationStudioActualTransition` — `runtime/executor/contracts.ts:36`.
- `AutomationStudioTransitionComparison` — `runtime/executor/contracts.ts:51`,
  produced by `compareAutomationStudioTransition`
  (`runtime/executor/transition-comparison.ts:6`) for every attempt
  (`runtime/executor/attempt-trace.ts:28`).
- `AutomationStudioTransitionComparisonStatus` — `runtime/executor/contracts.ts:8`:
  `matched | tolerated | missing_expected_state | unexpected_state |
  action_failed | timeout | blocked | ambiguous | unknown`.
- `NodeStateRuntimeComparison` — `model/node-state.ts:44` (expected vs actual
  per-evidence match/mismatch DTO).

**`expectedState` is counted, never evaluated.** `transition-comparison.ts:21`
computes `stateCheckCount = Object.keys(expected.expectedState ?? {}).length`
and uses it only at `:69`, to decide that a node which already routed `failed`
is `missing_expected_state`. No condition inside `expectedState` is ever
compared against a snapshot. Correspondingly `builtin.policy.expectation`
(`programs/automation-studio/nodes/policy/expectation.ts:31-36`) returns
`status: "success"`, `route: "passed"`, `outputs: { passed: true, failed: false }`
unconditionally, emitting a `policy.expectation.checked` effect that carries the
conditions. This independently confirms the `audit-evidence` finding already
recorded in the working document.

### Target identity

- `ElementFingerprint` — `programs/automation-studio/fingerprinting/element-fingerprint.ts:4`.
  Strongest-first fields: `visibleText`, `accessibleName`, `label`, `id`,
  `testId`, `automationId`, `entityId`, `entityKind`, `tagName`, `role`, then
  `selector`, `xpath`, `queryPath`, `statePath`, `url`, `classNames`, `bounds`,
  `attributes`.
- `AutomationStudioElementMatcher` (`:82`), `createAutomationStudioElementMatcher`
  (`:112`), `scoreElementFingerprintCandidates` (`:123`),
  `bestElementFingerprintCandidate` (`:131`), `candidatesFromStateSnapshot`
  (`:184`), `DEFAULT_ELEMENT_FINGERPRINT_WEIGHTS` (`:90`).
- `AutomationStudioElementTarget` — `model/action-element-target.ts:43`
  (`kind: "element"`, `fingerprint`, `candidates?`, `selectedCandidate?`,
  `source?`), with `normalizeAutomationStudioElementTarget` (`:74`) and
  `validateAutomationStudioElementTarget` (`:89`).
- Dispatch-time gate: `prepareElementTargetAction`
  (`runtime/io-policy.ts:118`) and `resolveElementTarget` (`:146`). Minimum
  confidence defaults from output safety level — destructive 0.9, privileged
  0.82, review 0.68, safe 0.45 (`io-policy.ts:174-184`) — overridable with
  `metadata.elementTargetMinConfidence`. An output that sets
  `metadata.elementTarget: true` or `metadata.targetKind: "element"` fails
  dispatch without a fingerprint (`:128-132`).
- Importer resolvers: `AutomationStudioTargetResolverDefinition` and
  `AutomationStudioTargetResolverImplementation` — `nodes/importer-sdk.ts:31`,
  `:79`.

### Node / subflow / router context

- Graph run: `runAutomationStudioGraph(flow, options)` —
  `runtime/executor/graph-run.ts:10`; options
  `AutomationStudioGraphExecutionOptions`
  (`runtime/executor/contracts.ts:143`) carry `effectDispatcher`,
  `compositeExecutor`, `nativeNodeExecutor`, `nodeRegionIds`, `regionRuntime`,
  `runtimeCapabilities`, `authorizedDomainIds`, `currentSubflowId`,
  `approvedRuntimePatchNodeIds`, `recoveryBudget`, `hostRuntime` (`:171`),
  `deadlineAt`, `signal`.
- Subflow: `AutomationStudioFlowSubflow` — `model/flow-adaptation.ts:68`;
  composite execution `runCanonicalAutomationStudioFlow` —
  `runtime/composite-executor.ts:7`.
- Router: `AutomationStudioFlowRouter` — `model/flow-adaptation.ts:44`;
  `compileAutomationStudioRouterPlan` (`runtime/router-runtime.ts:82`),
  `runAutomationStudioRouter` (`:133`), `evaluateAutomationStudioRouteCondition`
  (`:241`), `AutomationStudioRouteDecisionRecord`
  (`model/flow-adaptation.ts:227`).
- Regions: `executeWithRegionTimeout`, `policyDecisionForAttempt`,
  `recordRegionTransition` — `runtime/executor/region-execution.ts`.
- Session: `AutomationStudioRuntimeSession` — `model/runtime.ts:28`;
  `startRuntimeSession` (`runtime/service.ts:2813`), `runRuntimeSession`
  (`:3352`), `cancelRuntimeSession` (`:3618`).

## (b) Adaptation lifecycle entry points and the harness context contract

### Lifecycle, in execution order

1. **Attempt comparison** — `compareAutomationStudioTransition`
   (`runtime/executor/transition-comparison.ts:6`), attached to every attempt.
2. **Deterministic recovery** — `chooseAutomationStudioRecovery`
   (`runtime/executor/recovery-ladder.ts:5`). Priority order:
   `deterministic_path` (1), `approved_runtime_patch` (2), `reroute` (3),
   `llm_diagnosis` (4) (`:33`, `:45`, `:53`), bounded by
   `AutomationStudioRecoveryBudget` (`runtime/executor/contracts.ts:97`) via
   `recoveryBudgetExhaustion` (`runtime/executor/recovery-budget.ts`).
3. **Failure classification** — `classifyAutomationStudioAdaptiveFailure`
   (`runtime/adaptive-orchestrator.ts:63`) producing
   `AutomationStudioAdaptiveFailure` (`:26`) with `failureClass`,
   `candidateKind`, `llmEligibility` and a stable `signature`.
4. **Gates** — `decideAutomationStudioLlmInvocationGate`
   (`runtime/training-modes.ts:271`), `decideAutomationStudioTrainingBudget`
   (`:256`), `decideAutomationStudioProposalApprovalGate` (`:284`),
   `decideAutomationStudioAdaptationPromotionGate` (`:306`),
   `automationStudioScopeIsFrozen` (`:320`).
5. **LLM harness** — `runAutomationStudioLlmHarness` (`runtime/llm/harness.ts`,
   re-exported through `runtime/llm/index.ts`); evidence loop
   `runAutomationStudioLlmEvidenceLoop` (`runtime/llm/evidence-loop.ts:109`).
6. **Patch** — `preflightAutomationStudioRuntimePatch`
   (`runtime/live-patch.ts:61`),
   `preflightAutomationStudioRuntimeTargetOverrideProposal` (`:90`),
   `proposeAutomationStudioRuntimeTargetOverride` (`:145`),
   `executeAutomationStudioRuntimePatch` (`:169`),
   `adaptationFromRuntimePatch` (`:197`).
7. **Record and review** — `saveFlowAdaptation` (`runtime/service.ts:4271`),
   `reviewFlowAdaptation` (`:4283`), `listFlowAdaptationSummaries` (`:3677`),
   `getFlowAdaptation` (`:3903`), `saveFlowAdaptationPolicy` (`:4679`).
   Program API endpoints `list-flow-adaptations`, `get-flow-adaptation`,
   `review-flow-adaptation` (`api/contracts/endpoints.ts:124-126`), plus
   `preflight-llm-execution`, `issue-llm-execution-grant`,
   `generate-flow-bootstrap-adaptation`, `run-runtime-session`,
   `cancel-runtime-session`, `inspect-state-diff` (`:141-148`).
8. **Generation from recordings** — `create-recording-flow-proposals`,
   `review-recording-flow-proposal` (`api/contracts/endpoints.ts:95-96`);
   `reviewRecordingFlowProposal` (`runtime/service.ts:2467`).

### Harness context contract — what a domain must supply for Week 2

`AutomationStudioLlmContextPacket` (`runtime/llm/harness/context-packet.ts:19`),
built by `packAutomationStudioLlmContext` (`:59`) from
`AutomationStudioLlmHarnessInput` (`runtime/llm/harness/task-request.ts:44`).
Domain-supplied fields and their caps:

| Field | Cap | Domain obligation |
| --- | --- | --- |
| `stateDiffs` | first 50 (`context-packet.ts:83`) | Produce comparable state deltas. Requires a state provider. |
| `routeHistory` | last 25 (`:84`) | Core-produced from router decisions. |
| `recentActions` | last 12 (`:85`; `AUTOMATION_STUDIO_LLM_MAX_RECENT_ACTIONS:48`) | Derived from `runDetail.actionAttempts`; carries `status` and `comparisonStatus` only. |
| `failureEvidence` | sanitized by `sanitizeAutomationStudioLlmFailureEvidence` | Domain supplies it via `captureSanitizedFailureEvidence`. |
| `availableActions` | first 100 (`:90`) | Domain action catalogue. |
| `reusableContext` | 5 items, 8,192 bytes, and no key matching `selector`/`target`/`targetId`/... (`:103-131`) | Domain must strip executable targets or the packet throws. |
| `evidenceLoop` | `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS` (`runtime/llm/evidence-loop.ts:4`) | Domain supplies the tools. |

The domain binds evidence through
`AutomationStudioServiceOptions.llmEvidenceRuntime`
(`runtime/service.ts:353-358`) or `bindLlmEvidenceRuntime` (`:767`):

```text
tools: AutomationStudioLlmEvidenceTool[]
executeTool({ projectId, flowId, callId, toolId, value, maxEvidenceBytes, signal })
captureSanitizedFailureEvidence?(input) -> Promise<JsonObject | undefined>
validateTargetOverrideEvidence?(evidence, target: { selector: string }, failedAction)
  -> AutomationStudioRuntimeTargetOverrideEvidenceValidation
```

This repository already implements all four —
`ext:domain/src/runtime/llm-evidence.ts:137`
`createWebAutomationLlmEvidenceRuntime`, bound at `:252`
`bindWebAutomationLlmEvidenceRuntime`. Three web tools exist:
`web.inspect_current_page`, `web.navigate_same_origin`, `web.reveal_safe`
(`:7-9`). Week 2 consumes this contract; Week 1's job is to make the evidence
those tools return trustworthy, not to build new plumbing.

Note the contract's target shape: `validateTargetOverrideEvidence` takes
`{ selector: string }`. Core's own patch lane is **selector-keyed**, which
contradicts the fingerprint-first doctrine in
`docs/architecture/automation-studio-native-nodes.md` ("Element Matching").
See (d) and the open questions.

Two further Week 2 inputs a domain may supply and this repository does not:
`hostRuntime` (`runtime/service.ts:361`, bound via `bindHostRuntime` `:803`)
and `reusableLlmContext.selectForFreshEvidence` (`:364-368`).

## (c) Week 1 needs: existing Core seams vs. seams that must be built

### Already has a generic Core seam

| Week 1 need | Existing seam | Ownership judgement |
| --- | --- | --- |
| 1.2 action vocabulary | `IoRegistry` outputs plus `AutomationStudioNodeDefinition` and the importer SDK (`nodes/importer-sdk.ts:44`) | Downstream. Core needs nothing; the vocabulary is domain data. |
| 1.3 element identity | `ElementFingerprint` (`fingerprinting/element-fingerprint.ts:4`), the matcher, `AutomationStudioElementTarget`, and the dispatch gate (`io-policy.ts:118`) | Downstream. Adopt Core's field names and emit candidates; do not build a second matcher. |
| 1.4 evidence capture points | `AutomationStudioHostRuntimeBoundary` (`runtime/host-runtime.ts:26`) with four capture points | Downstream. The seam exists and is unbound here — no `bindHostRuntime` call in `ext:domain/src`. |
| 1.4 evidence DTOs | `StateSnapshot`, `StateFact`, `EvidenceReference`, `NodeEvidenceBinding` (`model/state.ts:176`; `model/evidence.ts:16`, `:37`, `:58`) | Downstream. Already imported at `ext:domain/src/recording/web-state.ts:2`. |
| 1.5 failure *categories* | `AutomationStudioTransitionComparisonStatus` (`runtime/executor/contracts.ts:8`) and `AutomationStudioAdaptiveFailureClass` (`runtime/adaptive-orchestrator.ts:6`) | Core already owns both enums. Do **not** add a third downstream. |
| 1.5 recovery behaviour | `chooseAutomationStudioRecovery` plus `AutomationStudioRecoveryBudget` | Core. Nothing needed. |

### Three existing seams that are inert for this domain

1. **The element-target gate never runs.** `resolveElementTarget`
   (`io-policy.ts:146-148`) returns `{ status: "unresolved_no_candidates" }`
   and passes the dispatch through whenever `target.candidates` is empty. Grep
   of `ext:domain/src` and `ext:apps/extension/src` finds no producer of
   `AutomationStudioElementTargetCandidate[]`: the only `candidates` reader is
   `selectedTargetCandidate` (`ext:domain/src/output-nodes/targets.ts:28-33`),
   and no downstream output declares `metadata.elementTarget`
   (`ext:domain/src/io/manifest-definitions.ts:10-17` sets only `capabilities`
   and `safety`). The confidence thresholds at `io-policy.ts:174-184` therefore
   never apply to a browser action.
2. **The host-runtime boundary is never bound.** No `bindHostRuntime` call
   exists downstream (grep across `ext:domain/src` and `ext:apps`), so
   `attempt.stateRefs` (`runtime/executor/contracts.ts:123`) is absent from
   every web attempt and `inspectStateDiff` is never called.
3. **The expectation node always passes**
   (`nodes/policy/expectation.ts:31-36`). A host *could* intercept the
   `policy.expectation.checked` effect, because `dispatchAutomationStudioEffects`
   (`runtime/executor/node-execution.ts:114`) offers every effect to the
   dispatcher and a `status: "failed"` return flips the node (`:119`). But the
   single `effectDispatcher` slot is occupied unconditionally by Core at
   `runtime/service.ts:3432-3435`, so a domain cannot add an evaluator without
   displacing Core's output dispatcher.

### Would need a new Core seam

**C1 — Structured failure status must survive dispatch.** This is the Week 1.5
blocker. The chain, traced end to end:

| Step | Location | What survives |
| --- | --- | --- |
| Extension result | `ext:apps/extension/src/shared/protocol.ts:276` | `succeeded｜failed｜timed_out｜cancelled` |
| Gateway result | `packages/contracts/src/client-gateway.ts:98` | same, plus `unknown` |
| Domain dispatcher | `ext:domain/src/io/gateway-output-dispatcher.ts:24-29` | collapsed to `ok: result.status === "succeeded"`; the real status survives only inside `payload.status` |
| `OutputDispatchResult` | `io/index.ts:29` | **no status field exists** |
| `dispatchPolicyOutput` | `runtime/io-policy.ts:49-51` | `{ status: "failed", route: "failed" }`; `runtimeStatus` appears only in `outputs` for the runtime variant (`:105`) |
| `AutomationNodeExecutionResult` | `nodes/contracts.ts:82-87` | `outputs`, `route`, `status`, `effects` — **no `message`, no failure code** |
| `nodeAttemptFromResult` | `runtime/executor/attempt-trace.ts:7-29` | writes no `message` at all |
| `compareAutomationStudioTransition` | `runtime/executor/transition-comparison.ts:65` | `timeout` only if `` `${route} ${message}` `` matches `/timeout｜timed out/i` — with `route: "failed"` and `message` undefined it can never match |
| `adaptiveFailureClassForAttempt` | `runtime/adaptive-orchestrator.ts:118-130` | six of nine failure classes decided by regex over `attempt.message` |

A browser action that times out is therefore classified `action_failed`, and
`adaptiveCandidateKindForFailure` (`runtime/adaptive-orchestrator.ts:133-140`)
consequently proposes `action_target_override` or `recovery_path_or_reroute`
instead of the `expectation_wait_retry` that `timeout` selects. Retry policy is
wrong for every timed-out browser action today.

- Owning package: `fluxiq` — `src/io/index.ts` (add an optional
  `status?: FluxIQRuntimeCommandStatus` to `OutputDispatchResult`);
  `src/programs/automation-studio/nodes/contracts.ts` (add optional `message?`
  and `failureCode?` to `AutomationNodeExecutionResult`);
  `src/programs/automation-studio/runtime/io-policy.ts` (propagate);
  `.../runtime/executor/attempt-trace.ts` (carry `message`);
  `.../transition-comparison.ts` and `.../adaptive-orchestrator.ts` (prefer the
  structured code, keep the regex as fallback).
- Compatibility: additive and optional at every step; a host that sets none
  keeps today's behaviour. No wire-protocol change — the extension already
  sends `timed_out`. Patch-level under the 0.1 policy in
  `docs/architecture/package-boundaries.md`.

**C2 — A target-resolution outcome on the attempt trace.**
`resolveElementTarget` already computes `{ status, candidateId, confidence,
matchedSignals, failedSignals, normalizedScore }` (`io-policy.ts:167-175`) but
writes it only into action metadata and node `outputs.elementTargetResolution`.
Nothing promotes it to `AutomationStudioNodeAttemptTrace`, so Week 1.3's
"deterministic fallback behaviour" cannot be asserted by a Testing Lab scenario
reading the trace, and Week 1.5 cannot distinguish "wrong element" from "action
failed".

- Owning package: `fluxiq` — add an optional `targetResolution?` field beside
  `stateRefs` in `src/programs/automation-studio/runtime/executor/contracts.ts:104`,
  populated from `io-policy.ts`; add `target_not_found` / `target_ambiguous`
  members to `AutomationStudioTransitionComparisonStatus`
  (`runtime/executor/contracts.ts:8`) and a matching
  `AutomationStudioAdaptiveFailureClass`.
- Compatibility: the trace field is additive. Adding enum members **is**
  breaking for exhaustive `switch` consumers — under the 0.1 policy that is a
  minor bump with a migration note. Downstream must handle the new members in
  any comparison-status mapping added in Phase 1.5.

**C3 — An expectation evaluator seam.** Either (i) a chainable
effect-dispatcher registry so a domain can handle `policy.expectation.checked`
without displacing Core's output dispatcher, or (ii) a first-class
`expectationEvaluator?(conditions, mode, timeoutMs, context)` option on
`AutomationStudioGraphExecutionOptions` that Core calls from
`builtin.policy.expectation`. Option (ii) is cleaner: it keeps the expectation
contract typed instead of routing it through an untyped effect payload, and it
lets Core evaluate `expectedState` in `compareAutomationStudioTransition`
instead of merely counting its keys (`transition-comparison.ts:21`).

- Owning package: `fluxiq` —
  `src/programs/automation-studio/nodes/policy/expectation.ts`,
  `.../runtime/executor/contracts.ts`, `.../runtime/service.ts` (bind through a
  new `bindExpectationEvaluator`, mirroring `bindHostRuntime` at `:803`).
- Compatibility: additive and optional, but **behaviour-changing where
  supplied** — a Flow whose expectation node silently passed today starts
  failing once an evaluator is bound. That is the point, but it means the change
  must land together with the Week 1.4 evidence work, not before it, or existing
  scenarios break with no evidence to explain why.

**C4 — A browser evidence DTO is _not_ needed.** The phase outline lists
"evidence DTOs" as Core involvement for 1.4. `StateSnapshot`, `StateValue`,
`StateVisualFrame`, `EvidenceAnchor`, `StateBounds` and `StatePathSchema`
already exist and are already imported at
`ext:domain/src/recording/web-state.ts:2`. What is missing is downstream
population of the declared state paths, not a Core type. Recommend striking
Core involvement from Phase 1.4 and replacing it with C3.

## (d) Functionality duplicated between Core and this repository

**D1 — Element fingerprint and matching (highest cost).**

| | Core | This repository |
| --- | --- | --- |
| Type | `ElementFingerprint` (`fingerprinting/element-fingerprint.ts:4`) | `ElementFingerprint` (`ext:apps/extension/src/content/element-finder.ts:1`) and the untyped `elementFingerprint()` (`ext:domain/src/output-nodes/targets.ts:36`) |
| Schema | — | `elementFingerprintSchema` (`ext:domain/src/actions/schemas.ts:11`) |
| Matching | weighted scoring across ~17 signals, retaining positive and negative contributions (`:123-183`) | `findClosestFingerprint` (`ext:apps/extension/src/content/element-finder.ts:13`): first-match-wins chain selector → xpath → id → `data-testid` → aria-label/name → classNames → visible text |

The two field sets are **not interchangeable**. Downstream emits `name`,
`text`, `value`, `href`, `inputType`; Core's highest-weighted signals are
`accessibleName`, `testId`, `label`, `automationId`, `entityId`, none of which
downstream produces (the test id is buried inside
`attributes["data-testid"]`). Feeding a downstream fingerprint to Core's
matcher today would score zero on every high-weight signal. Judgement: Core
owns matching; Phase 1.3 should rename downstream fields to Core's vocabulary
and emit `candidates`, keeping only the DOM-query half
(`findClosestFingerprint`, `xpathFor`) downstream, since it needs `document`
and cannot import `fluxiq` (Node 22 plus native SQLite per
`docs/architecture/package-boundaries.md`).

**D2 — Target-override evidence validation types.**
`ext:domain/src/runtime/llm-evidence.ts:52,57` declares
`WebRuntimeTargetOverrideEvidenceValidation` and
`WebRuntimeTargetOverrideFailedAction` as local structural copies of Core's
public `AutomationStudioRuntimeTargetOverrideEvidenceValidation`
(`runtime/live-patch.ts:28`) and `AutomationStudioRuntimeTargetOverrideFailedAction`
(`:34`) — same members, same field names. Structural typing makes this compile,
but a Core change desynchronises it silently. Fix: import the Core types.

**D3 — Action-result shape declared three times downstream, plus Core.**
`WebAutomationActionResult` (`ext:domain/src/actions/types.ts:48`),
`BrowserActionResult` (`ext:apps/extension/src/content/types.ts:78`) and
`BrowserActionResult` (`ext:apps/extension/src/shared/protocol.ts:276`) are
field-identical, against Core's `ClientGatewayActionResult`
(`packages/contracts/src/client-gateway.ts:98`) and
`FluxIQRuntimeCommandResult` (`runtime/contracts.ts:81`). The status unions
differ: downstream has four members, the gateway five (adds `unknown`), the
runtime six (adds `rejected`). A `rejected` runtime result has no downstream
representation.

**D4 — Legacy action-type map written twice downstream.**
`LEGACY_BROWSER_ACTION_TO_WEB_AUTOMATION` (`ext:domain/src/actions/types.ts:77`)
and an inline copy inside `normalizeWebAutomationActionType`
(`ext:domain/src/client/gateway-mapping.ts:151-166`). The inline copy ends
`?? "web.dom.extract"` (`:167`), so an unrecognised action type silently becomes
an extract rather than being rejected — a Week 1 reliability defect in its own
right, and arguably a breach of this repository's "an unmapped input must not
become executable" rule.

**D5 — Core-internal duplication worth knowing about.** `ElementFingerprint`
(`fingerprinting/element-fingerprint.ts:4`) and
`AutomationStudioElementTargetFingerprint` (`model/action-element-target.ts:6`)
are field-for-field identical apart from `statePath`'s type. Any Phase 1.3
fingerprint change must touch both, or be raised in Core first.

**Not duplication, checked and cleared.** `StateSnapshot` construction —
`ext:domain/src/recording/web-state.ts` uses Core's types and does not redefine
them. `ext:apps/extension/src/background/connection.ts` is a documented facade
over `connection/` (`connection.ts:5-9`), not a parallel implementation.
`content/frame-geometry.ts` (capture) and
`background/connection/frame-geometry.ts` (translate) are complementary, as are
`content/dom-snapshot.ts` (capture) and
`background/connection/dom-snapshot.ts` (merge and transport).

## (e) Dead or superseded APIs touching the MVP loop

### This repository — exports with zero references anywhere

Grep-verified repo-wide, excluding `node_modules/`, `dist/`, `build/`,
`.test-build/`, `.script-build/` and `test-runs/`.

| Symbol | Location | Note |
| --- | --- | --- |
| `WebAutomationRuntimeError` | `ext:domain/src/runtime/errors.ts:1` | Carries a `code`. Exactly the shape Phase 1.5 needs, and nothing throws it. |
| `legacyBrowserActionType` | `ext:domain/src/client/gateway-mapping.ts:131` | Superseded; no caller. |
| `createWebAutomationStructuredSnapshot` | `ext:domain/src/client/gateway-mapping.ts:98` | |
| `getWebAutomationOutputNodeDefinition` | `ext:domain/src/output-nodes/registry.ts:5` | |
| `webAutomationRuntimeCommandFromOutput`, `webAutomationOutputResultFromRuntimeResult` | `ext:domain/src/runtime/commands.ts:12`, `:33` | Named in `ext:docs/working/extension-runtime-capabilities-plan.md:619-620` as delivered; no caller. |
| `runWebAutomationFlow` | `ext:domain/src/runtime/flow-runner.ts:13` | Same: described in that plan at `:48` and `:933`; no caller. |
| `webAutomationRuntimeTracePayload` | `ext:domain/src/runtime/trace.ts:4` | |
| `runStateReadViaSnapshot` | `ext:apps/extension/src/runtime/state-reader.ts:8` | The `read_state` runtime command kind has no live path. |
| `isProbablySecureGateway` | `ext:apps/extension/src/shared/browser.ts:27` | |
| `EXTENSION_NAME`, `PROTOCOL_VERSION` | `ext:apps/extension/src/shared/constants.ts:1`, `:2` | |

Also: `LEGACY_BROWSER_ACTION_TO_WEB_AUTOMATION`
(`ext:domain/src/actions/types.ts:77`) is referenced only to build its own
reverse map (`:91-93`), so the forward direction is dead. And
`ext:domain/src/runtime/reusable-evidence-coordinator.ts` is barrel-exported
(`ext:domain/src/runtime/index.ts:8`) and exercised by its tests, but has no
production caller — its `WebReusableEvidenceWritePort` is never bound to
`reusableLlmContext` on the Core service. Implemented but unwired, not dead.

### This repository — superseded or boundary-violating

- `ext:domain/src/web-panel-host.ts:2` imports
  `AutomationStudioNativeNodeRuntime` from
  `"../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/runtime/native-node-runtime.js"`
  — a hard-coded sibling-checkout deep path into Core's `dist/`. The class is
  publicly exported from `fluxiq/automation-studio` (barrel chain
  `programs/automation-studio/index.ts:12` → `runtime/index.ts:12` →
  `runtime/native-node-runtime.ts:22`, with `"./automation-studio"` in the
  `fluxiq` package `exports` map). The deep import is unnecessary, bypasses the
  declared export map, and breaks if Core's internal layout moves.
- `ext:domain/src/runtime/llm-evidence.ts:252-256` duck-types
  `bindLlmEvidenceRuntime` as an optional method and returns `false` when it is
  absent. It is a real public method (`runtime/service.ts:767`); the shim is a
  dead compatibility path that can silently swallow a wiring failure.
- `ext:domain/src/runtime/adapter.ts:52-60` maps every non-ok dispatch to
  `status: "failed"`, discarding the `timed_out`/`cancelled` the extension
  already reports. This is the downstream half of C1.

### Core — deprecated APIs still on the MVP loop

| Symbol | Location | Why it matters |
| --- | --- | --- |
| `AutomationStudioFlowDocument` | `model/artifacts.ts:32` — `@deprecated Use owner-independent AutomationStudioFlowArtifact for new writes.` | Still the parameter type of `runAutomationStudioGraph` (`runtime/executor/graph-run.ts:11`), of `AutomationStudioRuntimeSession.flow` (`model/runtime.ts:39`), of `runRuntimeSession({ flow })` (`runtime/service.ts:3355`) and of `AutomationStudioRuntimePatchExecutionInput.flow` (`runtime/live-patch.ts:44`). The whole MVP execution loop runs on a deprecated type. |
| `AutomationStudioFlowOwnerKind` | `model/artifacts.ts:7` | Required field of the above. |
| `PolicyAction.actionType` | `model/actions.ts:80` — `@deprecated Compatibility field for policies recorded before output bindings.` | Still **non-optional**, and `policyActionFromPayload` (`runtime/io-policy.ts:186`) populates it from `outputId`. |
| `AutomationStudioTaskArtifact`, `AutomationStudioRoutineArtifact` | `model/artifacts.ts:47`, `:63` | `AutomationStudioRuntimeSession.targetKind` still admits `"task"` and `"routine"` (`model/runtime.ts:32`). |
| `client.pairing_submit` | `packages/contracts/src/client-gateway.ts:186-187` — "Deprecated compatibility path" | Still handled at `packages/fluxiq/src/client-gateway/service/inbound.ts:52`. Not used by this extension (grep: no hits under `ext:apps`), so no downstream work. |
| `saveFlow` / `getFlow` for the visual editor | `api/contracts/flow.ts:21`, `:32`; `assertAutomationStudioNormalEditorGraphEndpoint` (`api/contracts/endpoints.ts:164`) | Editor-side only; no MVP-loop impact. |

Core symbol with no producer on the MVP loop: `RuntimeActionAttempt`
(`model/runtime.ts:6`), with its `preStateFingerprint` and
`postStateFingerprint`. The executor produces
`AutomationStudioNodeAttemptTrace` instead. If Phase 1.5 wants pre/post-state
fingerprints, this type is the intended home and is currently unused — but see
the runtime-kernel plan's own note that these types "are not yet wired into a
general runtime service" (`docs/working/runtime-kernel-plan.md:174-178`).

## Commands run and observed results

All read-only. No build, no Testing Lab, no browser, no panel.

- `wc -l` over the eight Core documents named in the brief — all present;
  `runtime-kernel-plan.md` 1050, `adaptive-flow-training-roadmap.md` 969,
  `llm-assisted-deterministic-automation-expansion-plan.md` 3465,
  `recording-proposal-generator-plan.md` 634.
- `awk '/^## Current State/...'` over the four Core working documents — only
  `adaptive-flow-training-roadmap.md` has a `## Current State` section. The
  other three predate that convention; `grep -n "^#\{1,3\} "` confirmed their
  heading lists. For `runtime-kernel-plan.md` I read the status header instead
  (`Status: Complete`, `Phases 1-8 delivered 2026-08-20`, lines 3-4) plus
  `## Current Inventory` and `## Core Runtime Contracts`. Recorded as a
  contradiction below.
- `cat` and `sed -n` over: Core `AGENTS.md`;
  `docs/architecture/{current-system,runtime-kernel,package-boundaries,automation-studio-native-nodes}.md`;
  `packages/fluxiq/src/runtime/{contracts,service,client-gateway-transport}.ts`;
  `src/io/index.ts`; `src/domains/index.ts`; `src/framework/index.ts`;
  `packages/contracts/src/client-gateway.ts`; and under
  `src/programs/automation-studio/`:
  `model/{runtime,node-state,state,evidence,action-element-target,flow-adaptation,recording-domain}.ts`,
  `fingerprinting/{contracts,element-fingerprint}.ts`,
  `nodes/{importer-sdk,contracts}.ts`, `nodes/policy/expectation.ts`,
  `runtime/{contracts,adapters,io-bridge,io-policy,host-runtime,adaptive-orchestrator,router-runtime,training-modes,live-patch,index}.ts`,
  `runtime/executor/*.ts`,
  `runtime/llm/harness/{context-packet,task-request,task-kind}.ts`,
  `runtime/llm/evidence-loop.ts`, `api/contracts/endpoints.ts`, and targeted
  `sed` ranges of `runtime/service.ts` (353-368, 692-705, 760-810, 3352-3400,
  3425-3465, 4271-4290).
- `python -c` over `packages/fluxiq/package.json` — printed the full `exports`
  map; confirmed `"./automation-studio"`, `"./runtime"`, `"./core"` and
  `"./io"`, and that no subpath maps to
  `dist/programs/.../native-node-runtime.js`.
- `grep -rn "from \"fluxiq\|from \"@fluxiq/"` over `ext:domain/src`,
  `ext:apps` and `ext:packages` — 50 hits; the only non-type Core imports are
  `ext:domain/src/host.ts:1`, `ext:domain/src/tests/domain.test.ts:2-3`, and
  the deep `dist` import at `ext:domain/src/web-panel-host.ts:2`.
- `grep -rn` over `ext:domain/src` and `ext:apps/extension/src` for
  `fingerprint`;
  `elementMatcher|scoreElement|bestElementFingerprintCandidate|normalizeAutomationStudioElementTarget|AutomationStudioElementTarget`;
  `elementTarget|targetKind|elementTargetMinConfidence|candidates`;
  `failureClass|FailureCode|timed_out|classifyFailure|errorCode`;
  `bindHostRuntime|bindRuntimeService|bindNativeNodeRuntime|bindIoRuntime|hostRuntime|registerAdapter|registerDomainIo|registerRecordingDomain`;
  and `deprecated|legacy|TODO(remove|superseded`. The Core-matcher grep
  returned **zero hits**, which is the evidence for (c)(1) and (d)(D1). The
  failure grep returned three hits, all of them the same four-member status
  union (D3).
- Two dead-export scans over `ext:domain/src` and
  `ext:apps/extension/src`, then every candidate re-verified individually with
  a repo-wide `grep -rn` excluding generated output. The second scan's raw
  output listed 71 symbols; most were intra-file uses the script could not see.
  Only the ten in (e) survived individual verification.
- Line numbers for every citation in this report were re-checked with targeted
  `grep -n` after drafting; several first-pass numbers were off by one to four
  lines and were corrected.
- `git log -1 --format="%h %s"` in both repositories — `d848536` here,
  `e522f17` on Core `dev`.

## Not verified

- **No execution.** Every claim is read from source. I did not run `pnpm
  check`, `pnpm test`, or any Core suite, so the control-flow traces in
  (c)(C1) and (c)(3) are reasoned from code, not observed at runtime. The C1
  chain in particular deserves one focused Core test before Phase 1.5 commits
  to it.
- I did not read the 3,465-line
  `llm-assisted-deterministic-automation-expansion-plan.md` or the 634-line
  `recording-proposal-generator-plan.md` in full — only their heading maps —
  because neither has the `Current State` section the brief scoped me to.
  Phase content in them may contradict what the source says; where they
  differ, I reported the source.
- `runtime/service.ts` is 6,919 lines; I read roughly 250 of them by targeted
  `sed`. There may be additional adaptation or evidence entry points I did not
  see. The `runtime/service/` subdirectory (`adaptations/`, `evidence/`,
  `flows/`, `proposals/`, `recordings/`) was listed but not read.
- I did not verify that Core's published `dist/` matches `src/` for any symbol
  I cite. This repository links Core with `link:`
  (`ext:domain/package.json:18-19`), so a stale Core build could make a
  source-accurate claim wrong at runtime.
- The claim that no downstream output sets `metadata.elementTarget` rests on
  grep plus reading `manifest-definitions.ts`; I did not enumerate every output
  definition path.
- Element-matcher *scoring behaviour* (weights, thresholds in practice) is read
  from the types and `DEFAULT_ELEMENT_FINGERPRINT_WEIGHTS`, not measured.
- I did not check whether Core's `.structure-baseline.json` already tolerates
  the 6,919-line `runtime/service.ts`, so I make no claim about whether it
  violates Core's own 800-line budget.

## Open questions or contradictions found

1. **Selector-keyed patching versus fingerprint-first doctrine.**
   `docs/architecture/automation-studio-native-nodes.md` ("Element Matching")
   says structural paths "are not allowed to dominate stronger semantic
   identity" and that mappers should not persist "only a selector or XPath".
   Yet Core's own runtime-patch contract is selector-only:
   `validateTargetOverrideEvidence(evidence, target: { selector: string }, ...)`
   (`runtime/service.ts:357`; `runtime/live-patch.ts:28-30`). Phase 1.3 cannot
   satisfy both. Which wins, and does the patch lane need a fingerprint-shaped
   target?
2. **Three working documents named in my brief have no `Current State`
   section.** `runtime-kernel-plan.md`,
   `llm-assisted-deterministic-automation-expansion-plan.md` and
   `recording-proposal-generator-plan.md` predate the convention Core's own
   structure audit enforces (Core `AGENTS.md`, "working-document header,
   `Current State`, size, and index rules"). Either they are baselined
   exceptions or the audit does not cover them. Either way the brief's "read
   the `Current State` sections only" instruction was unsatisfiable for three
   of four.
3. **`runtime-kernel-plan.md` says "Complete"; the architecture doc calls this
   repository the "first integration target"** (`runtime-kernel.md`,
   "Validation Target"). The integration is real but partial: the runtime
   adapter and `bindRuntimeService` are wired, `bindHostRuntime` is not, and
   `read_state` has no live downstream path. Should the Core plan be reopened,
   or is host-runtime binding downstream-only work?
4. **Who owns `expectedState` evaluation?** C3 proposes a Core evaluator seam.
   The alternative — replacing `builtin.policy.expectation` downstream through
   the importer SDK — leaves Core untouched but leaves the built-in node
   silently passing for every other domain, which reads like the sort of
   known-broken default this repository's standards reject. I recommend the
   Core seam; it crosses the repository boundary, so it needs the user's call.
5. **Enum extension costs a Core minor bump.** C2 adds members to
   `AutomationStudioTransitionComparisonStatus`. Under
   `docs/architecture/package-boundaries.md` ("intentional API breaks increment
   the minor version with migration notes") that is a deliberate break for
   exhaustive consumers. Is Week 1 allowed to spend a Core minor bump, or
   should the new outcomes ride in `metadata` until a scheduled Core release?
6. **`RuntimeActionAttempt` (`model/runtime.ts:6`) has no producer.** Its
   `preStateFingerprint` and `postStateFingerprint` are exactly what Phase 1.5
   wants. Is it the intended future home, or superseded by
   `AutomationStudioNodeAttemptTrace` and due for removal?
7. **`ext:domain/src/client/gateway-mapping.ts:167` coerces an unknown action
   type to `web.dom.extract`.** That looks like an unmapped input becoming
   executable, which this repository's `AGENTS.md` forbids. I am reporting it,
   not fixing it — but it may belong in Phase 1.2 rather than waiting for 1.5.
