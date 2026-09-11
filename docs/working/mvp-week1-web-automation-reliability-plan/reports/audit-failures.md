# Report: audit-failures

Read-only audit of the current failure model for Phase 1.5. Paths without a
repository prefix are in `F:\!FluxIQWebExtension`; paths prefixed `Core:` are in
`F:\!FluxIQ`.

## Outcome

Done. All four required deliverables are below: the layer table, the
11-category mapping, the 13-item capture table, and the ownership
recommendation. No source file and no working document was modified.

Headline finding: **there is no failure taxonomy on the browser-action path at
all.** From the content script to the Core run record, an action failure is
carried as a free-text English `message` plus a four-value status enum, two
values of which (`timed_out`, `cancelled`) have no producer anywhere in shipped
downstream source. The only real classifier in either repository is Core's
`AutomationStudioAdaptiveFailureClass`, and it derives its class by running
regular expressions over that downstream-authored English message
(`Core: packages/fluxiq/src/programs/automation-studio/runtime/adaptive-orchestrator.ts:113-127`).
Changing the wording of a message in `apps/extension/src/content/action-runtime.ts`
silently reclassifies production failures in Core. That coupling is the single
largest reliability risk this audit found.

## What changed and why

Nothing changed. The brief is read-only investigation; the deliverables are the
tables below.

## Layer table — how a failure is represented at each hop

| # | Layer | Type / symbol | File:line | Failure representation |
| --- | --- | --- | --- | --- |
| 1 | Content script, per action type | `executeContentAction` | `apps/extension/src/content/actions.ts:37-101` | Any throw is caught at `:99` and handed to `deps.failure`. Unsupported type throws at `:98`. |
| 2 | Content script, target ladder | `resolveTarget` | `apps/extension/src/content/action-runtime.ts:61-91` | Throws `No target resolved from <miss list>.` at `:89`, where the list names which of selector / coordinates / visual target / fingerprint missed. Only place in the repo where a failure says *why*, and it says it in prose. |
| 3 | Content script, waits | `waitForElement`, `waitForText` | `apps/extension/src/content/action-runtime.ts:147-182` | Throws `Timed out waiting for selector: X` / `...for text: X` at `:154`, `:172`. Default 10 000 ms. |
| 4 | Content script, result shaping | `actionFailure` → `BrowserActionResult` | `apps/extension/src/content/action-runtime.ts:46-59`; type at `apps/extension/src/content/types.ts:78-90` and `apps/extension/src/shared/protocol.ts:272-287` | `status: "failed"` (hard-coded, `:51`), `message` = `error.message` or `"Action failed."`, plus `url`, `title`, `startedAt`, `finishedAt`, and a full `DomSnapshot` when `captureSettings.snapshots`. No code, no category. |
| 5 | Background / MV3 worker, pre-dispatch | `runBrowserActionCommand`, local `actionFailure` | `apps/extension/src/runtime/action-runner.ts:32`, `:75-84` | Unsupported page (`chrome://`, web store) for a mutating action → `status:"failed"`, message only. No snapshot, no URL. |
| 6 | Background, router | `ExtensionRuntimeCommandRouter.executeAction` | `apps/extension/src/runtime/command-router.ts:20-37` | Any thrown dispatch error → `browserActionFailure(action, message)`; the throw's identity is lost. |
| 7 | Wire mapping | `gatewayActionResultFromBrowserResult` | `apps/extension/src/runtime/result-mapping.ts:19-35` | `error: result.status === "failed" ? result.message : undefined` (`:34`). **`timed_out` and `cancelled` therefore produce no `error` field at all.** Snapshot/url/element are pushed into `payload` via `webAutomationActionResultPayload` (`domain/src/client/gateway-mapping.ts:135-150`). |
| 8 | Wire message | `ClientGatewayActionResult` | `Core: packages/contracts/src/client-gateway.ts:98-108`; envelope `client.action_result` at `:195` | `status: succeeded \| failed \| timed_out \| cancelled \| unknown`, `message?`, `error?`, `payload?`, `target?`, `metadata?`. Still no code field. |
| 9 | Core gateway, pending-command settle | `ClientGatewayCommands.executeAction` | `Core: packages/fluxiq/src/client-gateway/service/commands.ts:61-85` | Server-side timeout synthesises `{status:"timed_out", message:"Client action timed out after Nms."}` at `:69`. This is the only real `timed_out` producer in either repository. |
| 10 | Domain gateway dispatcher | `dispatchWebAutomationOutput` | `domain/src/io/gateway-output-dispatcher.ts:6-31` | Collapses to `{ok, outputId, payload:{status,message,result}, error?}`. `ok = result.status === "succeeded"` (`:24`); `error` is copied only if the client supplied one, so a gateway timeout arrives with `ok:false` and **no `error`**. |
| 11 | Domain runtime adapter | `executeWebAutomationRuntimeCommand`, `rejected` | `domain/src/runtime/adapter.ts:38-66`, `:97-104` | `status: result.ok ? "succeeded" : "failed"` (`:54`) — **`timed_out` is flattened to `failed` here**, and `message`/`error` are set only from `result.error`, so the timeout text survives only nested at `payload.status`/`payload.message`. Registry rejections emit `status:"rejected"` (`:100`). |
| 12 | Core runtime service | `RuntimeService.dispatch`, `withRuntimeBounds`, `settleAttempt` | `Core: packages/fluxiq/src/runtime/service.ts:181-231`, `:343-380`, `:269-278` | Adds its own `timed_out` (`:355-362`, only when `command.timeoutMs` is set) and `cancelled`. Persists `FluxIQRuntimeCommandAttempt` (`Core: packages/fluxiq/src/runtime/contracts.ts:115-129`) with `status`, `result`, `message`. Adapters are tried before transports (`:243-248`), so the downstream direct adapter in row 11 always wins over the websocket transport for `web.*` outputs. |
| 13 | Alternate (unused for `web.*`) websocket transport | `ClientGatewayRuntimeTransport` | `Core: packages/fluxiq/src/runtime/client-gateway-transport.ts:45-67`, `:93-103` | Would preserve `timed_out`/`unknown` verbatim. Unreachable for web automation because of the adapter-first order in row 12. |
| 14 | Automation Studio policy dispatch | `createRuntimePolicyEffectDispatcher` | `Core: .../runtime/io-policy.ts:70-116` | Node outputs get `ok`, `runtimeCommandId`, `runtimeStatus` (`:105` — the only place the raw runtime status is preserved), `error`, `elementTargetResolution`, and the whole nested `result`. Route becomes `"failed"`. Also produces its own failures: unregistered output (`:77`), unmatched element target (`:151`), below-confidence match (`:152`). |
| 15 | Graph executor node attempt | `AutomationStudioNodeAttemptTrace` | `Core: .../runtime/executor/contracts.ts:104-129` | `status` (5-value graph status), `message`, `transitionComparison` (`:120`), `recoveryDecision` (`:121`), `stateRefs.beforeAction/afterAction/stateDiff` (`:123-127`). |
| 16 | Transition comparison | `AutomationStudioTransitionComparisonStatus` | `Core: .../runtime/executor/contracts.ts:8-17` | 9 values: `matched`, `tolerated`, `missing_expected_state`, `unexpected_state`, `action_failed`, `timeout`, `blocked`, `ambiguous`, `unknown`. This is the closest existing thing to a real taxonomy and it is state-comparison-shaped, not action-shaped. |
| 17 | Adaptive classifier | `classifyAutomationStudioAdaptiveFailure` | `Core: .../runtime/adaptive-orchestrator.ts:63-97`; enum at `:6-15`; regex logic at `:113-127` | Produces `AutomationStudioAdaptiveFailureClass` (9 values), `candidateKind` (7 values), a stable `signature`, `deterministicRecoveryCandidates`, `knownAdaptationMatches`, and `llmEligibility`. Classification order: message regexes first, comparison status second, `attempt.status === "failed"` last. |
| 18 | Core run/attempt record | `AutomationStudioFlowRunActionAttemptRecord` | `Core: .../model/flow-adaptation.ts:276-289`; built at `.../runtime/service/summaries/conversions.ts:136-168` | `attemptId`, `nodeId`, `definitionId`, `order`, `status` (+`"unknown"`), `route`, `startedAt`, `finishedAt`, `durationMs`, `comparisonStatus`, `message`, `metadata{regionId, diffSummary, recoverySelected, hostCapabilities, stateRefs, adaptiveFailure}`. **No `outputs` field** — so everything row 14 attached (URL, failure-moment snapshot, element-target diagnostics, nested extension result) stops here. |
| 19 | Recovery / retry record | `AutomationStudioFlowRunRecoveryRecord` | `Core: .../model/flow-adaptation.ts:291-303`; terminal reason at `conversions.ts:246-254` | `status: "selected" \| "exhausted" \| "diagnosis_only"`, `reason`, `candidateCount`. `runtimeTerminalFailureReason` produces three canned English sentences. |
| 20 | Failure-evidence capture | `captureSanitizedFailureEvidence` | `domain/src/runtime/llm-evidence.ts:213-247`; invoked at `Core: .../runtime/service.ts:2946-2992` | Runs a **new** `web.dom.capture_snapshot` at diagnosis time and sanitises it to `WebLlmPageEvidence` (`web-llm-evidence.v1`). Failure to capture is itself surfaced as a `diagnosis` intervention with `llm.failure_evidence_invalid` (`service.ts:2977-2991`). |
| 21 | LLM context packet | `packAutomationStudioLlmContext` | `Core: .../runtime/llm/harness/context-packet.ts:59-99` | `nodeId`, `subflowId`, last 12 `recentActions` (`:49`, `:85`), last 25 `routeHistory`, ≤50 `stateDiffs`, `failureEvidence`, ≤25 `relevantRuns`/`relevantAdaptations`, `policyGates`. |
| 22 | Harness intervention DTO | `AutomationStudioFlowIntervention` | `Core: .../model/flow-adaptation.ts:256-274`; built at `.../runtime/llm/harness/intervention.ts:37` | `kind` ∈ 7 values (`:245-253`), free-text `reason`, `contextSummary.failureEvidence` reduced to provenance only (`failureEvidenceProvenance`, `.../llm/harness/failure-evidence.ts:47-55`), `validation{ok, issues[]}`. |
| 23 | UI | `runtimeFailureEvidenceProvenance`, `sanitizedRuntimeInterventionDetail` | `Core: apps/web/src/features/automation-studio/runtime/run-detail-model.ts:153-173` | Renders only `schemaVersion · byteCount bytes · truncated\|full`; strips any evidence body that leaked. Failure itself is shown as the raw `reason`/`message` strings. |
| 24 | Testing Lab | `RunnerFailure`, `classifyRunnerFailure` | `packages/test-runner/src/failure.ts:17-34`; category enum at `packages/test-contracts/src/evaluation.ts:2-8` | A **separate, unrelated** 17-value harness taxonomy about the test rig (`gateway.pairing`, `process.startup`, …), not about the automated page. It has no relationship to rows 1-23. |

### Crosscutting losses on this path

- **Row 11** flattens `timed_out` → `failed` and drops the message. Core's
  `runtimeStatus` preservation at row 14 therefore records `"failed"`, never
  `"timed_out"`, for any extension-executed action.
- **Row 18** has no field for node outputs, so the extension's failure-moment
  `DomSnapshot`, `url`, `title` and `element` (row 4) are never persisted with
  the attempt.
- **Row 21** compacts attempts through `compactRecentActionForLlm`
  (`context-packet.ts:136-147`), which keeps only `attemptId`, `nodeId`,
  `definitionId`, `order`, `status`, `route`, `durationMs`, `comparisonStatus`.
  It drops `metadata`, so `adaptiveFailure.failureClass` — Core's only real
  classification — **never reaches the diagnosing LLM.**

## 11-category mapping

`P` = producer exists, `p` = partial / indirect, `—` = no producer.

| Plan category | State | Existing producers (`file:line`) | Representation today |
| --- | --- | --- | --- |
| `TARGET_NOT_FOUND` | P | `apps/extension/src/content/action-runtime.ts:89` (`No target resolved from …`), `:148` (`Selector is required.`), `:154`; `Core: .../runtime/io-policy.ts:151` (`Element target could not be matched to any runtime candidate.`) | Free-text message on `status:"failed"`. Core's classifier lands it in `action_failed`, not a target class, because none of its regexes match "No target resolved" (`adaptive-orchestrator.ts:113-127`). |
| `TARGET_AMBIGUOUS` | — | None on the execution path. `resolveTarget` uses `document.querySelector` (`action-runtime.ts:64`) and silently takes the first match; `elementFromPoint` likewise. | The word exists twice, both unreachable from an executed action: `AutomationStudioTransitionComparisonStatus "ambiguous"` (`Core: executor/contracts.ts:16`) and `validateWebRuntimeTargetOverrideEvidence` → `{status:"ambiguous"}` (`domain/src/runtime/llm-evidence.ts:62-78`), which validates an LLM's proposed selector, not a runtime action. **No producer.** |
| `STATE_MISMATCH` | p | `Core: executor/contracts.ts:11-12` (`missing_expected_state`, `unexpected_state`) → `adaptive-orchestrator.ts:121-122` (`expected_state_missing`, `unexpected_state`) | Core-side only, and only for nodes that declared an expected transition. The extension performs **no** post-action verification, so a browser action that "succeeded" while the page did not change is never a mismatch. |
| `NAVIGATION_UNEXPECTED` | — | None. | `web.browser.navigate` returns `status:"succeeded"` unconditionally once the tab resolves (`apps/extension/src/runtime/action-runner.ts:33-44`) — it never verifies the destination committed or that the landing URL is the requested one. `NavigationRecorder` (`apps/extension/src/background/connection/navigation-recorder.ts`) classifies navigations for *recording* attribution only. **No producer.** |
| `OUTPUT_NOT_OBSERVED` | p | `Core: .../runtime/io-policy.ts:106` (`confirmation: false`), `:110` (`"Output confirmation failed."`); `Core: executor/contracts.ts:57-65` `diffSummary.missingOutputIds` / `missingEffectTypes` | Core-side confirmation-input wait only, and only when the node declares `confirmationInputId`. Browser side: e.g. `web.dom.select` assigns `element.value` (`apps/extension/src/content/actions.ts:78`) with no check that the option exists — a non-existent option reports success. |
| `ACTION_REJECTED` | P | `domain/src/runtime/adapter.ts:41`, `:97-104` (`status:"rejected"`); `domain/src/io/gateway-output-dispatcher.ts:11`; `Core: io-policy.ts:76-77`; `apps/extension/src/runtime/action-runner.ts:32` (unsupported page); `apps/extension/src/content/actions.ts:98` (unsupported action type) | Split across five sites with three different shapes: a real `"rejected"` status (domain adapter), an `ok:false` + `error` string (dispatcher), and a `status:"failed"` + message (extension). Only the domain-adapter form survives as a distinct status. |
| `TIMEOUT` | P | `Core: packages/fluxiq/src/client-gateway/service/commands.ts:69` (`status:"timed_out"`); `Core: packages/fluxiq/src/runtime/service.ts:355-362`; `apps/extension/src/content/action-runtime.ts:154`, `:172` (message only, `status:"failed"`) | Three producers, two representations, and the browser-side one does not use the `timed_out` status that exists for it. Core's classifier recovers `timeout` only by regex `/timeout\|timed out/i` on the message. The gateway-level timeout is then flattened at `domain/src/runtime/adapter.ts:54`. |
| `PAGE_CHANGED` | — | None. | No detection of document replacement, navigation, or `readyState` change between dispatch and execution. `apps/extension/src/content/instance.ts` handles re-injection after navigation but produces no failure. `waitForTabReady` (`apps/extension/src/runtime/automation-tab.ts`) gates *before* dispatch only. **No producer.** |
| `AUTH_REQUIRED` | — | None. A case-insensitive grep for `auth_required\|login\|captcha\|sign.?in\|2fa\|otp` over `apps/extension/src` and `domain/src` returned no hit on any failure path. | The only `auth` failure in either repository is `flow_bootstrap.provider_auth_failed` (`Core: .../flow-bootstrap/generation-failure.ts:38`), which is about the LLM provider's API key, not the automated site. **No producer.** |
| `USER_INTERVENTION_REQUIRED` | — | None as a failure category. | "Intervention" in Core means an *LLM* intervention record (`AutomationStudioRuntimeInterventionKind`, `Core: .../model/flow-adaptation.ts:245-253`), not a human hand-off. The nearest gates are `requireApprovalForDestructiveChanges` / `requireApprovalForExternalSideEffects` (`context-packet.ts:169-170`), which gate adaptation *review*, not run outcome; `external_side_effect_denied` (`adaptive-orchestrator.ts:115`) is its closest existing analogue. **No producer.** |
| `UNKNOWN` | P | `Core: conversions.ts:131-134` (`graphStatusToFlowRunStatus` → `"unknown"`); `Core: adaptive-orchestrator.ts:127` (`ambiguous_or_unknown`); `Core: packages/contracts/src/client-gateway.ts:100` (`status:"unknown"`); `packages/test-runner/src/failure.ts:28-34` (`classifyRunnerFailure` default) | Four independent "unknown" values in four enums that do not reference each other. |

**Summary: 4 of 11 categories have a first-class producer, 3 are partial, and 4
(`TARGET_AMBIGUOUS`, `NAVIGATION_UNEXPECTED`, `PAGE_CHANGED`, `AUTH_REQUIRED`)
plus `USER_INTERVENTION_REQUIRED` have none.** All five of the missing ones are
browser-specific and all five must be produced downstream.

### Nearest existing enum to align with

`AutomationStudioAdaptiveFailureClass`
(`Core: .../runtime/adaptive-orchestrator.ts:6-15`) is the taxonomy the rest of
Core already consumes:

| Existing Core class | Plan category |
| --- | --- |
| `action_failed` | `ACTION_REJECTED` **and** `TARGET_NOT_FOUND` (conflated today) |
| `expected_state_missing` | `STATE_MISMATCH` |
| `unexpected_state` | `STATE_MISMATCH` (or `PAGE_CHANGED`, indistinguishable today) |
| `timeout` | `TIMEOUT` |
| `blocked_by_capability_or_policy` | `ACTION_REJECTED` |
| `external_side_effect_denied` | closest to `USER_INTERVENTION_REQUIRED` |
| `missing_router_or_subflow_target` | flow-authoring, no Week 1 analogue |
| `graph_validation_or_unknown_node` | flow-authoring, no Week 1 analogue |
| `ambiguous_or_unknown` | `UNKNOWN` |

## 13-item capture table

"Where" names the layer that holds it at the moment of a failure.

| # | Item | State | Where it exists / where it is lost |
| --- | --- | --- | --- |
| 1 | Current node | **Present** | `trace.currentNodeId` (`Core: executor/contracts.ts:135`) → run-detail `metadata.currentNodeId` (`Core: conversions.ts:108`) → LLM packet `nodeId` (`context-packet.ts:79`). |
| 2 | Subflow | **Present** | `AutomationStudioSubflowExecutionRecord` (`Core: model/flow-adaptation.ts:238-244`) with `metadata.failureReason` (`Core: runtime/service.ts:3531`); LLM packet `subflowId` (`context-packet.ts:78`) and compacted `subflows` (`:90`). |
| 3 | Expected state | **Partial** | `AutomationStudioExpectedTransition.expectedState` exists (`Core: executor/contracts.ts:27`) but only `comparisonStatus` and `diffSummary` are persisted onto the attempt (`Core: conversions.ts:155`, `:161`) and only `comparisonStatus` reaches the LLM (`context-packet.ts:146`). The expected-state object itself never leaves the executor. |
| 4 | Actual state | **Partial** | Same truncation as #3 for the Core side. The browser side *does* capture a full failure-moment `DomSnapshot` (`apps/extension/src/content/action-runtime.ts:47`), but it is dropped: it rides in `payload` (`domain/src/client/gateway-mapping.ts:145`) → nested at `payload.result.snapshot` (`domain/src/io/gateway-output-dispatcher.ts:26`) → node `outputs.result` (`Core: io-policy.ts:109`) → **and `AutomationStudioFlowRunActionAttemptRecord` has no outputs field** (`Core: model/flow-adaptation.ts:276-289`). |
| 5 | Previous state | **Partial** | `attempt.stateRefs.beforeAction` (`Core: executor/contracts.ts:123-127`) persisted into attempt `metadata.stateRefs` (`Core: conversions.ts:164`) as a snapshot *reference*, resolvable only through the host runtime. Not in the LLM packet. |
| 6 | Failed action | **Present** | `attemptId`/`nodeId`/`definitionId`/`order`/`status`/`route` (`Core: model/flow-adaptation.ts:277-283`); reaches both the LLM packet (`context-packet.ts:136-147`) and the evidence-capture request (`Core: runtime/service.ts:2952-2960`). |
| 7 | Failed target | **Absent** from the persisted record | The selector/fingerprint lives in the node action parameters and in `outputs.result`; `elementTargetResolution` diagnostics (matched signals, failed signals, confidence) are written to `outputs` at `Core: io-policy.ts:107` and to command metadata at `:127` — none of which is on the attempt record. The diagnosing LLM instead re-derives candidate targets from a *fresh* page capture. |
| 8 | URL | **Absent** at failure time | The extension supplies `result.url` (`action-runtime.ts:53`) and it dies at the same boundary as #4. The only URL the model sees is `failureEvidence.location`, produced by the fresh capture (`domain/src/runtime/llm-evidence.ts` → `evidenceLocation`), i.e. the URL at *diagnosis* time. If the page navigated between failure and diagnosis, the recorded URL is wrong. |
| 9 | Recent events | **Partial** | Last 12 action attempts (`AUTOMATION_STUDIO_LLM_MAX_RECENT_ACTIONS = 12`, `context-packet.ts:49`, `:85`), last 25 route decisions (`:83`), ≤50 state diffs (`:82`). No browser/DOM events at all — the recording event stream (`client.recording_event`) is not joined to the run. |
| 10 | Retry history | **Partial** | `AutomationStudioFlowRunRecoveryRecord[]` on the run detail (`Core: model/flow-adaptation.ts:291-303`), `adaptiveRetryAttemptCount` on the subflow entry (`Core: runtime/service.ts:3316`), `recoverySelected` in attempt metadata (`Core: conversions.ts:162`). **Not in the LLM context packet** — the model cannot see what has already been retried. |
| 11 | Browser evidence | **Present, but re-captured** | `captureSanitizedFailureEvidence` (`domain/src/runtime/llm-evidence.ts:213-247`) issues a *new* `web.dom.capture_snapshot` at diagnosis time (`Core: runtime/service.ts:2954`). The snapshot taken at the instant of failure is discarded (see #4). Present for the LLM, absent from the run record. |
| 12 | Timing | **Present** | `startedAt`/`finishedAt`/`durationMs` on the attempt (`Core: model/flow-adaptation.ts:283-286`; built at `conversions.ts:137`, `:152-154`), bounded and passed to the LLM (`context-packet.ts:145`). Extension `startedAt`/`finishedAt` also exist (`action-runtime.ts:56-57`) but are not the ones persisted. |
| 13 | Previous adaptations | **Present** | `knownAdaptationMatches` in the adaptive failure (`Core: adaptive-orchestrator.ts:67`, compacted to `knownAdaptationIds` at `:108`), `relevantAdaptations` ≤25 in the packet (`context-packet.ts:87`), and the reusable-context packet (`context-packet.ts:88`, ≤5 items, ≤8 192 bytes). |

**Score: 5 present, 6 partial, 2 absent.** The two absent items (#7 failed
target, #8 URL) and the worst partial (#4 actual state) all fail at the *same*
boundary: `AutomationStudioFlowRunActionAttemptRecord` has no field for node
outputs, so everything the browser observed at the moment of failure is
discarded before the run record is written.

## `failureEvidence` packet and the stage-indexed reason taxonomy

### The packet (3 000-byte ceiling)

- **Ceiling constant:** `AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES = 3_000`,
  `Core: packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/failure-evidence.ts:6`.
- **Gate:** `sanitizeAutomationStudioLlmFailureEvidence(taskKind, evidence)`
  (`same file:17-25`). It refuses any task kind other than `runtime_diagnosis`
  or `runtime_patch`; requires a bounded `schemaVersion` matching
  `/^[a-z0-9_.:-]{1,100}$/i`; requires `boundedFailureEvidenceValue` (`:27-45`)
  — depth ≤ 12, ≤ 128 children per node, ≤ 512 entries total, strings ≤ 2 000
  chars, key names ≤ 100 chars, and the key names `html`, `innerHtml`,
  `outerHtml`, `pageSource`, `snapshot`, `cookies`, `headers` forbidden after
  stripping `_`/`-`; and rejects (does **not** truncate) anything over 3 000
  bytes serialised.
- **Dynamic allowance:** the caller narrows further —
  `maxEvidenceBytes = max(1, min(3_000, floor(maxInputTokens × 3 × 0.2)))`
  (`Core: .../runtime/service.ts:2947-2951`), i.e. 20 % of the input budget at
  three bytes per token.
- **Producer (downstream, browser-specific):** `WebLlmPageEvidence`,
  `schemaVersion "web-llm-evidence.v1"`, `trust:"untrusted-page-evidence"`,
  `location`, optional `title`, `elements[]`, `truncated`
  (`domain/src/runtime/llm-evidence.ts:44-51`). Element sanitisation at
  `:253-330`: ≤ 40 elements, selector ≤ 500 chars, text/name ≤ 300, URL ≤ 2 000,
  ≤ 20 `<select>` options, opaque `target.N` handles, password /
  `current-password` / `new-password` / `one-time-code` / `cc-*` /
  `data-sensitive` elements dropped, hrefs reduced to same-origin
  `origin+pathname`. Its own default ceiling is 6 000 bytes with a 12 000 hard
  max (`:16-17`) — looser than Core's, see Open Questions.
- **Provenance retained in the record:** `failureEvidenceProvenance`
  (`Core: .../failure-evidence.ts:47-55`) reduces the packet to
  `{schemaVersion, byteCount, truncated, digest(sha256)}` for the intervention's
  `contextSummary` (`.../llm/harness/intervention.ts:37`) and the run metadata
  (`Core: runtime/service.ts:3165`). The UI shows only that provenance and
  strips anything else (`Core: apps/web/src/features/automation-studio/runtime/run-detail-model.ts:153-173`).
- **Target-override validation:** `validateWebRuntimeTargetOverrideEvidence`
  (`domain/src/runtime/llm-evidence.ts:62-78`) matches an LLM-proposed selector
  only against the packet already shown to the model, returning
  `matched | resolved | absent | ambiguous`, with action-type compatibility from
  `targetCompatibleWithFailedAction` (`:373-380`). Bound into Core at
  `Core: runtime/service.ts:3108-3112`.

### The closed stage-indexed reason taxonomy

Defined in
`Core: packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/generation-failure.ts`:

- 6 stages (`:9-15`): `pre_provider_validation`, `provider_resolution`,
  `provider_request`, `provider_output_validation`, `post_provider_validation`,
  `persistence`.
- `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PHASE_FAILURE_CODES` (`:17-72`) — 9 + 3 + 11
  + 22 + 1 + 1 = **47 codes**, each owned by exactly one stage; the stage is
  recoverable from the code via `FLOW_BOOTSTRAP_PHASE_FAILURE_CODE_STAGE`
  (`:77-80`).
- Diagnostic shape (`:82-112`): `{code, stage, retryable, providerInvocation,
  providerResponse, accounting?, evidenceLoop?}`, parsed by
  `parseAutomationStudioFlowBootstrapFailureDiagnostic` (`:114-141`) with exact
  field sets, and cross-checked by `phaseFailureStateMatches` (`:314-338`) and
  `fixedProviderFailureState` (`:340-372`) so a code cannot arrive with a
  retryability or provider-response state inconsistent with its own identity.
- Unknown or wrong-stage codes are **discarded, not passed through**: downstream
  `allowlistedGenerationFailureReason`
  (`packages/test-runner/src/demo-llm-create-ui.ts:658-660`) returns `null`
  unless the code is in the exact per-stage set, with the per-stage sets built
  directly from the Core constant (`:649-656`).

This is the only well-formed failure taxonomy in either repository and it is
**the pattern Phase 1.5 should copy**: a closed code set partitioned by stage, a
parse function with exact field sets, consistency assertions between the code
and the retry/provider state, and a downstream allowlist that drops anything
unrecognised. It covers only LLM Flow generation — not action execution.

## Ownership recommendation

### Core (domain-neutral)

Each of these survives deleting every browser, DOM, URL, selector, tab and
extension concept, and each has a Core consumer already.

1. **The category enum and its carrier fields.** Extend
   `AutomationStudioAdaptiveFailureClass`
   (`Core: .../runtime/adaptive-orchestrator.ts:6-15`) rather than creating a
   second parallel enum downstream. Eight of the eleven plan categories —
   `TARGET_NOT_FOUND`, `TARGET_AMBIGUOUS`, `STATE_MISMATCH`,
   `OUTPUT_NOT_OBSERVED`, `ACTION_REJECTED`, `TIMEOUT`,
   `USER_INTERVENTION_REQUIRED`, `UNKNOWN` — are meaningful for a desktop,
   API or native runtime with no change of wording. A second enum downstream
   would mean two taxonomies and a lossy join, which is the defect this audit
   already found between `FailureCategory`
   (`packages/test-contracts/src/evaluation.ts:2-8`) and
   `AutomationStudioAdaptiveFailureClass`.
2. **A structured failure field on the transport and record types.** Add
   `failure?: {category, code, retryable, stage?}` to
   `FluxIQRuntimeCommandResult`
   (`Core: packages/fluxiq/src/runtime/contracts.ts:80-90`) and to
   `AutomationStudioFlowRunActionAttemptRecord`
   (`Core: .../model/flow-adaptation.ts:276-289`), and to
   `ClientGatewayActionResult` (`Core: packages/contracts/src/client-gateway.ts:98-108`).
   Without this, every downstream classification is discarded at layer 18 of
   the table above. Model the shape on the flow-bootstrap diagnostic, including
   its exact-field parser and consistency assertions.
3. **The byte-bounded evidence packet contract, its sanitiser and its
   provenance digest.** Already Core
   (`.../llm/harness/failure-evidence.ts`), already correct, no change of
   ownership needed.
4. **Retry/recovery accounting.** `AutomationStudioFlowRunRecoveryRecord`,
   `AutomationStudioRecoveryBudget`, `llmEligibility` — all already Core and all
   domain-neutral.
5. **Stop classifying by regex.** Replace `adaptiveFailureClassForAttempt`'s
   message matching (`Core: .../adaptive-orchestrator.ts:113-127`) with a read
   of the structured field from item 2, keeping the regex only as a legacy
   fallback for records written before the field existed. Also widen
   `compactRecentActionForLlm` (`Core: .../llm/harness/context-packet.ts:136-147`)
   to carry the category, so the diagnosing model can see it.

### Domain (this repository, browser-specific)

Each of these is undecidable without browser facts and must be *produced*
downstream, even though the resulting category value is Core's.

1. **`NAVIGATION_UNEXPECTED`, `PAGE_CHANGED`, `AUTH_REQUIRED`.** All three
   require browser signals — a committed `webNavigation` event, document
   identity or `readyState` transition across the dispatch boundary, and
   login/challenge-page recognition. None of the three survives removing "URL"
   or "page". They should be produced in
   `apps/extension/src/content/action-runtime.ts` and
   `apps/extension/src/runtime/action-runner.ts` and carried as the Core
   category value. These are the three categories Week 1 must build from
   nothing.
2. **The `TARGET_NOT_FOUND` / `TARGET_AMBIGUOUS` discrimination.** Needs
   `querySelectorAll().length` and the existing fallback-ladder miss list
   (`action-runtime.ts:61-91`), both DOM facts. The ladder already records
   *which* strategy missed; today it serialises that into prose. It should emit
   a structured `{category, attemptedStrategies[], matchCount}` instead.
3. **`OUTPUT_NOT_OBSERVED` for browser actions.** Post-action verification —
   did the `<select>` value actually change, did the input hold the typed text,
   did the click produce a DOM mutation — is DOM-shaped and belongs in
   `apps/extension/src/content/actions.ts`. Core's confirmation-input wait
   (`io-policy.ts:100-113`) is the domain-neutral half and stays there.
4. **The failure-moment evidence packet.** `WebLlmPageEvidence`, its schema
   version, element sanitisation, sensitivity rules and action-type
   compatibility table (`domain/src/runtime/llm-evidence.ts`) are already
   correctly downstream. Week 1 should additionally have the extension attach a
   packet *at the moment of failure*, not only at diagnosis time, so items #4,
   #7 and #8 of the capture table stop being lost.
5. **The status flattening fix.** `domain/src/runtime/adapter.ts:54` must stop
   collapsing `timed_out`/`cancelled` into `failed`, and must promote
   `payload.message` when the client supplied no `error`. This is a
   three-line downstream change and it is a prerequisite for `TIMEOUT` being
   distinguishable at all.

### Boundary rule this suggests

Core owns *what a failure is called and how it is carried*; the domain owns
*how a browser decides which name applies and what evidence accompanies it*.
Concretely: Core exports the enum, the record field, the parser and the
sanitiser; the extension and `domain/` export producers that fill them. No
browser vocabulary enters Core; no taxonomy definition stays downstream.

## Commands run and observed results

All read-only (`grep`, `sed -n`, `cat`, `find`, `wc`). No build, no test run, no
browser, no panel.

| Command (abridged) | Observed result |
| --- | --- |
| `grep -rn "WebAutomationRuntimeError" --include=*.ts .` | 3 hits: `domain/dist/runtime/errors.d.ts:1`, `domain/src/runtime/errors.ts:1`, `domain/src/runtime/errors.ts:6`. **No construction site anywhere** — the class is exported through `domain/src/runtime/index.ts:4` and never thrown. |
| `grep -rn "failureEvidence\|failure_evidence" --include=*.ts --include=*.md .` (this repo) | 3 hits in authored docs, 3 in `test-runs/.../run-detail-model.ts` (a copied run artifact). **No downstream source consumes `failureEvidence`.** |
| `grep -rn "= \"timed_out\"\|: \"timed_out\"\|: \"cancelled\"" --include=*.ts apps/extension/src domain/src` | No output. Confirms `timed_out` and `cancelled` are declared in the `BrowserActionResult` union (`apps/extension/src/shared/protocol.ts:276`, `apps/extension/src/content/types.ts:81`, `domain/src/actions/types.ts:51`) with **no producer**. |
| `grep -rhoE "new RunnerFailure\(\"[a-z.]+\"" packages/test-runner/src apps/scenario-lab/src \| sort \| uniq -c` | `runtime.behavior` 149, `environment.missing` 101, `recording.persistence` 24, `process.startup` 11, `gateway.connection` 10, `gateway.pairing` 5, `action.dispatch` 5, `fixture.invalid` 4, `extension.worker` 2, `security.redaction` 1. **`extension.install`, `action.targeting`, `visual.mismatch`, `performance.budget`, `test.flaky` have zero producers**; `unknown` is produced only by `classifyRunnerFailure`'s default branch. |
| `grep -rn "runnerFailureCategories" --include=*.ts packages apps` | One hit — its own definition at `packages/test-runner/src/failure.ts:3`. **Dead export.** |
| `grep -rn "validateRunEvaluation\|assertRunEvaluation\|parseRunEvaluationJson" --include=*.ts .` (excluding `test-contracts/src`) | No output. **`RunEvaluation` and its 17-value `FailureCategory` have no producer or consumer outside the contract package.** |
| `grep -rniE "auth_required\|login\|captcha\|sign.?in\|2fa\|otp\|intervention" apps/extension/src domain/src` | 20 hits, all `DomSnapshotPayload`-related false positives from the substring `snapshot`. **No authentication or human-intervention failure path exists downstream.** |
| `grep -n "WEB_EVIDENCE_TOOL_IDS\|WEB_EVIDENCE_RESULT_CODES" packages/test-runner/src/demo-llm-create-ui.ts` | Lines 673-676. Allowlist contents recorded and compared against `domain/src/runtime/llm-evidence.ts:7-9` and `:80` — skew found, see Open Questions. |
| `sed -n` reads of the 23 files named in the layer table (both repositories) | All line references in this report were read directly; none is inferred from a `dist` build except where the table says `Core: …/dist/…`, which it does not. |

## Not verified

- **No runtime behaviour was exercised.** Every claim is a static read. I did
  not run `pnpm check`, `pnpm test`, `pnpm build`, the Testing Lab, a browser,
  or the panel — the brief forbids all of them.
- **Live failure shapes.** I did not observe an actual failed action travel the
  path in the layer table. The `timed_out`-flattening claim (`domain/src/runtime/adapter.ts:54`)
  and the outputs-dropped claim (`Core: .../model/flow-adaptation.ts:276-289`)
  are read from the types and the mapping code, not from a captured run. Both
  should be confirmed with one Testing Lab scenario before Phase 1.5 designs
  around them.
- **Core `dist` vs `src` skew.** I read Core `src` throughout. The
  `llm-production-automation-plan.md` checkpoint records a prior incident where
  Core's exported `dist` lagged its `src`; downstream resolves Core through
  those exports. I did not diff `dist` against `src`, so a stale export could
  make the live behaviour differ from what this report describes.
- **Whether the websocket transport path is ever taken for `web.*`.** I read
  the adapter-before-transport ordering at
  `Core: packages/fluxiq/src/runtime/service.ts:243-248` and the downstream
  adapter registration at `domain/src/runtime/service.ts:13-19`, and concluded
  the direct adapter always wins. I did not observe a dispatch to confirm no
  other registration order occurs at startup.
- **Scenario Lab oracles.** The brief assigns those to `audit-testing-facility`;
  I read only `packages/test-runner/src/failure.ts` and the producer counts, not
  the 12 scenarios.
- **Recording-event join.** I asserted at capture item #9 that the
  `client.recording_event` stream is not joined to the run record. I verified
  that no field on `AutomationStudioFlowRunActionAttemptRecord` or
  `AutomationStudioFlowRunDetail` references it; I did not exhaustively search
  Core for an out-of-band correlation mechanism.

## Open questions or contradictions found

1. **Dead export: `WebAutomationRuntimeError`.**
   `domain/src/runtime/errors.ts:1-9` defines a `code`-carrying error class,
   re-exports it through `domain/src/runtime/index.ts:4`, and never constructs
   it. It is the only structured error type downstream owns. Either it is the
   intended seam for Phase 1.5 and should be used, or it is residue and should
   go.
2. **Evidence-tool allowlist skew between the repositories.**
   `packages/test-runner/src/demo-llm-create-ui.ts:673` allowlists
   `web.click_safe`, `web.fill_safe`, `web.select_safe` — none of which
   `domain/src/runtime/llm-evidence.ts` registers — and **omits
   `web.reveal_safe`**, which it does register (`llm-evidence.ts:9`). Line 674
   likewise omits `web.action.rejected.no_progress`, a code the domain does
   produce (`llm-evidence.ts:80`). `sanitizeEvidenceSteps` (`:675-679`) silently
   drops non-allowlisted steps, so a real reveal-tool step vanishes from the
   sanitized failure with no error. This looks like a rename that was applied
   downstream in `domain/` but not in `test-runner`.
3. **Two unrelated failure taxonomies both named "failure category".**
   `FailureCategory` (`packages/test-contracts/src/evaluation.ts:2-8`, 17
   values) is about the *test rig*; `AutomationStudioAdaptiveFailureClass`
   (Core, 9 values) is about the *automated page*. Neither references the other.
   Phase 1.5's 11 categories are a third. The plan should state explicitly which
   of the three it extends — this report recommends the Core one.
4. **`runnerFailureCategories` is both dead and wrong.**
   `packages/test-runner/src/failure.ts:3-14` lists 10 of the 17 contract
   categories, is never imported, and omits `fixture.invalid`,
   `extension.worker` and `security.redaction`, all three of which the runner
   actually produces.
5. **`RunEvaluation` has no producer.** The 17-category evaluation contract, its
   validator, and the "failed verdict requires a failureCategory" rule
   (`packages/test-contracts/src/evaluation-validation.ts:18-19`) are
   unreachable at runtime. If FluxBench (Phase 1.6) is meant to emit
   `RunEvaluation`, that is currently unimplemented, not merely untested.
6. **Byte-ceiling mismatch between the producer and the gate.** The domain
   evidence runtime defaults to 6 000 bytes with a 12 000 hard maximum
   (`domain/src/runtime/llm-evidence.ts:16-17`); Core's gate rejects anything
   over 3 000 (`Core: .../failure-evidence.ts:6`, `:23`). In practice
   `Core: runtime/service.ts:2947-2951` clamps the request first, so the live
   path is safe — but any other caller of `captureSanitizedFailureEvidence`
   that passes a larger `maxEvidenceBytes` gets a packet that
   `sanitizeAutomationStudioLlmFailureEvidence` will **throw** on rather than
   truncate, producing an `llm.failure_evidence_invalid` intervention instead of
   a diagnosis. Downstream should default to the Core ceiling.
7. **Should `timed_out` and `cancelled` stay on `BrowserActionResult`?** They
   have existed with no producer across three type declarations. Either the
   extension should start setting `timed_out` on its own wait timeouts
   (`action-runtime.ts:154`, `:172`), which is the useful answer, or the union
   should shrink to what it actually emits.
8. **`ClientGatewayActionResult.status` includes `"unknown"`
   (`Core: packages/contracts/src/client-gateway.ts:100`) but
   `BrowserActionResult` does not.** The extension therefore cannot report
   "I do not know what happened", which is exactly the state after a service
   worker restart mid-command. Whether Week 1 needs that value is a plan
   decision.
9. **Where should the failure-moment evidence packet be produced?** Capture
   items #4, #7 and #8 all argue the extension should attach a bounded
   `web-llm-evidence.v1` packet to a *failed* action result, not only at
   diagnosis time. That requires a new field on `BrowserActionResult` and a
   place to put it on the Core attempt record (recommendation item 2). It also
   crosses the repository boundary, so it needs a Core change scheduled —
   which the working document currently records as "Paired document: none".
