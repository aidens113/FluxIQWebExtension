# DataInspector loading and recovery plan

Status: Complete — executable source-based recovery plan; implementation not released
Owner: deployment_docs_audit
Date: 2026-10-01

## Written brief

- Tooltip stays frozen for root verification. Own only this report, no source/tests/checks. Read parent Current State and core-data-controls-audit.md D2.
- Exact Core reads: apps/web/src/features/automation-studio/development/DataInspector.tsx and owning tests/DataInspector.test.ts; its directly imported request/cache/metrics type declarations only as needed, at most three dependency files. Do not inspect actual telemetry, private stores or protected backend/runtime.
- Establish true refresh/read vs clear-ui-cache mutation semantics, current ownership props/API changes/unmount, initial/refresh/error/confirmed-empty display, busy/duplicate/op-finally behavior and existing authored UI contract. No automatic replay of a possibly completed clear mutation; explicit recovery must be truthful.
- Prepare exact DataInspector.tsx +NEW development/tests/DataInspector-recovery.test.tsx implementation partition, typed actual mounted deferred fixture and meaningful tests-first schedules. Preserve all original assertions and generic DataTable ownership; request extra exact path release if a helper/API change is genuinely required.
- Distinguish directly reproduced source paths from pending live evidence. No implementation, checks/shared docs/commits/browser/Lab/providers/panel/private state. Root owns review, source release and coordinated gates; max read scope is bounded rather than whole framework rediscovery.

## Actual scope and evidence

Read actual DataInspector source and unchanged owning DataInspector.test.ts (three assertions). Read only declaration sections in two dependency files: development/telemetry.ts for AutomationStudioDevelopmentSnapshot and cache/data-cache.ts for AutomationStudioCacheStats. No third dependency, runtime telemetry values, backend or private store was inspected. Parent Current State and prior D2 remain available from immediately preceding work. Source facts below have not been executed: no test/check/browser command ran.

Original authored contract: Overview/Requests/SQL/Browser/Preload views; initial and manual get-performance-metrics reads; explicit delete-project-ui-cache post with projectId; bounded120 preload-event buffer; event-based telemetry with no inspector polling loop; native shared DataTable/Modal/Button/Segmented. Original tests also exercise summarizePreloadMetrics and empty-buffer behavior. All must stay intact.

The private InspectorApi exposes get/post Promise results with `{ ok: boolean; payload?: T; error?: string }`. No signal/cancellation option, project-scoped read payload, mutation receipt/transaction ID, idempotency promise or cache-stat response is declared. The clear sends a projectId, but the performance read is endpoint-only. Do not infer that server metrics are project-scoped or that acknowledged clear resets the client cache snapshot; source currently does neither.

## Source-confirmed sequences and uncertainty

- Initial read sets loading but EndpointTable always renders successful-empty wording from an empty array; no confirmed envelope distinguishes pending/unavailable/confirmed-empty. SQL substitutes a loading empty string, but neither server table forwards shared DataTable.loading.
- Both read and clear await without catch/finally. Rejection leaves loading=true and no local feedback; caller raw error text is surfaced on non-ok. No executed rejection reproduction or actual error content inspected.
- Server samples and local view state persist across API changes until new response; old responses can overwrite a new owner. Project changes do not retire clear callbacks/results. Unmount has no async fence. A-B-A owner equality alone would not retire an earlier first-A generation.
- Both operations share one loading Boolean but have no synchronous operation lock. Button busy may prevent ordinary new clicks after a render; it does not establish a captured-function duplicate or overlapping-finally guarantee. Those require actual tests.
- Clear success is inferred only from result.ok; no acknowledgement message or documented local-cache reset exists. Rejection/non-ok cannot establish transaction outcome from this local contract. It is unsafe to automatically replay clear while trying to recover a read.

## Exact later implementation partition

1. Core `apps/web/src/features/automation-studio/development/DataInspector.tsx`.
2. NEW Core `apps/web/src/features/automation-studio/development/tests/DataInspector-recovery.test.tsx`.

Own this report additionally. Preserve all assertions in existing DataInspector.test.ts; no telemetry/cache/API/shared DataTable/Modal/Button source, helper/barrel/styles/backend/runtime changes. Existing helpers remain exported as now. Keep the view/coordinator cohesive in its owning source and report resulting line budget; if implementation exceeds ownership/budget substantially, request an exact extraction brief rather than silently adding files.

## Concrete owner and operation algorithm

### Owner generation and masking

Use the public AutomationStudioDataInspector as a small same-file owner boundary. Its render-updated identity ref contains API reference, normalized `activeProjectId ?? null`, and monotonically increasing generation. Renew only when API or normalized project changes; ordinary cacheStats/onClose callback or telemetry updates must not remount/reset it. A private same-file workspace keyed by generation owns its view, server confirmation/read feedback, clear feedback, operation lock and preload subscription. Current-generation callback from the public boundary fences old mounted callbacks synchronously before passive cleanup; private mounted ref/layout cleanup fences unmount. Compare generation as well as tuple so A-B-A cannot revive first-A callbacks.

Conservatively retire local inspector workspace on project changes even though get-performance-metrics is server-wide; this is UI/mutation ownership, **not** a claim that the backend read filters by project. Auto-read exactly once for the new workspace, never auto-post. Local view resets to Overview on owner replacement; within an owner ordinary rerenders/manual reads preserve current view. Global telemetry still comes from its existing hook and is not reset/filtered by this view; do not claim project isolation of that store.

Fresh callback refs/current-owner guard should also protect a retained Modal close against closing a replacement inspector. Forward ordinary latest onClose/cacheStats props without making their JSX function identity a lease. No API method extension or server-operation cancellation is possible/required: logical retirement suppresses stale publication; an already sent clear can still complete.

### One synchronous current-workspace operation lock

Preserve current intended serialized server controls using a ref lock `{ epoch, kind: "read" | "clear" | null }`, acquired synchronously before request dispatch. Both read and clear require current mounted owner and idle lock; clear additionally requires the captured normalized project. Duplicate retained callbacks in the same act turn submit once. Disable both current server controls while that workspace operation is pending and show the actual pending operation, not a generic successful-empty state. Do not disable local Segmented views or native Modal close.

Each operation captures epoch/API/project/owner generation and only publishes while all relevant owner checks and epoch match. Its finally releases busy only for that exact current workspace operation; old completions cannot release a replacement operation. Source owner replacement remount permits the new owner to read while ignoring the retired work; an outstanding old clear is not cancelled/replayed. A new explicit action in a newly owned workspace is a separate user request, not automatic retry. Read before-dispatch lifetime checks also apply to retained click handlers after unmount.

### Independent read confirmation and mutation feedback

Use server read state with confirmed flag, current metrics, pending and local error. Initial state is unconfirmed/pending, so the first committed table/status cannot claim no samples. Read success updates a confirmed snapshot; successful empty is explicit confirmed-empty. Refresh keeps current confirmed samples; failure keeps them with fixed local error and stale/last-confirmed wording. Rejected/non-ok/malformed read exits busy and offers the existing explicit Refresh server action. No raw exception/response.error text enters product feedback.

Read and clear feedback are distinct state. Refresh must not clear an unresolved clear acknowledgement/uncertainty; clear success must not erase a read error or invent a newer metrics snapshot. Existing SQL/Endpoint server tables receive pending only for a read, not for a clear; client telemetry tables keep their independent source semantics. Top-level pending/error/stale feedback is visible across views. SQL sample count should say loading/unavailable until confirmed rather than presenting initial0 as measured. On a confirmed-zero refresh, table empty text should describe last-confirmed zero if pending/failed, and normal no-samples only after current successful completion.

Clear pending says cache-clear request pending. `ok === true` reports **"UI cache clear was acknowledged."** No forced zero client cache count or automatic refresh/post. Non-ok/rejected/malformed outcome reports fixed **"UI cache clear was not confirmed. It may have completed."** This wording reflects contract uncertainty, not proof of committed deletion. Busy releases; existing Clear UI cache becomes available for a separate explicit user action. Do not add an automatic Retry clear, loop, read-recovery replay or hidden second post. Preserve projectId capture: new target cannot be reached by a retained old click/result. No authorization/recheck/idempotency promise is made without an owning backend contract release.

### Read response compatibility and rendered safety

Existing read type accepts optional metrics: successful absent/null payload, absent metrics or null metrics currently acts as empty, so retain that compatibility rather than requiring a new backend field. A provided non-null payload must be a non-array object; explicit non-array metrics is a local malformed-read error. Before accepting arrays, constrain only actual rendered metric fields; never traverse arbitrary metadata/results/private payloads. Every item must be a non-null object with string kind. Unknown future string kinds can be ignored as existing filters do. Recognized sql/endpoint kinds require finite elapsedMs and boolean ok; optional displayed strings/numbers/possibleFullScan are type-safe when present, with null/undefined accepted where existing nullish fallback handles them. recordedAt is not rendered and need not become a new rejection requirement. This protects formatDuration/filter/map without a public wire change. Exact owning tests must pin these compatibility decisions; if root prefers a different contract, change the written release first.

## Typed actual-view fixture

Use `Parameters<typeof AutomationStudioDataInspector>[0]` for props and its api type, not an any adapter or exported test hook. Typed synthetic `{ ok; payload?; error? }` deferred get/post responses route the two known endpoints. At the adapter's generic boundary cast only the routed synthetic payload result to its generic T; spy recorded endpoint/payload remains inspectable.

Mock only the telemetry hook to return a complete typed AutomationStudioDevelopmentSnapshot and shared Modal to a typed native section for actual mounting; keep real DataInspector, Button, DataTable, Segmented and preload hook. Synthetic snapshot uses empty arrays/cache/graph and the declared full counters shape, with cacheStats returning a typed synthetic cache. A synthetic window EventTarget supports the real preload subscribe/unsubscribe; do not read or feed actual telemetry. No fake polling loop or runtime provider.

Use ReactTestRenderer/act and typed ReactTestInstance label helpers. For same-commit owner masking, a typed wrapper layout-effect probe captures mounted render visibility and invokes retained old handlers before passive cleanup. Retain old Modal onClose callbacks through the typed fixture as well. Every pending deferred request is resolved/rejected within act and all mounted renderers/window/listeners/spies restored after each case. Avoid real timeouts, relaxed compilation or broad mocks of the subject.

## Meaningful tests-first schedules

1. Held initial get: initial commit and pending renders show loading/unconfirmed, not No endpoint samples/No SQL samples/confirmed sample count0; controls busy, no polling or clear post. Resolve real empty -> confirmed empty and idle. Missing/null optional metrics compatibility stays accepted; explicit invalid metrics returns local error.
2. Reject and non-ok first read, including raw private-like synthetic error strings: busy releases, local error appears, no successful-empty claim or raw text; explicit Refresh server submits one new read and recovers. No clear post.
3. Confirm samples then hold/reject refresh: samples persist, pending and stale/last-confirmed wording is truthful, confirmed zero remains last-confirmed zero, local view stays selected, retry success replaces snapshot. Client telemetry tables are not falsely marked busy for this server read.
4. Duplicate current read and clear callbacks invoked synchronously: each submits once. Cross-operation captured clear while read pending/read while clear pending submits none; owner operation finally cannot clear newer pending state. Initial auto-read/current manual callback share the same lock and do not double dispatch.
5. Clear with actual target project: captured project freezes, pending feedback appears, exactly one post. ok true only shows acknowledgement; synthetic cacheStats count remains unchanged. Rejected/non-ok/malformed clear releases busy with uncertainty, no raw text and no automatic repost/get; later explicit Clear submits a separate post.
6. Read rejection recovery while clear uncertainty remains, and explicit clear after failed read: independent feedback survives; no command replay/false read success. Test request counts, not just message snapshots.
7. API, normalized project and API/project A-B-A replacements while old get/post is pending: commit never shows foreign confirmed server samples/clear acknowledgement; retired callbacks cannot submit or close the replacement. Old success/rejection/finally cannot overwrite/reset replacement busy/feedback. Fresh owner auto-read remains read-only and old clear is neither cancelled nor replayed.
8. Ordinary telemetry/cacheStats/onClose callback rerenders: current view/confirmation and pending operation remain intact; no extra read/remount/post. Latest valid Modal close calls latest owner callback; retained old-owner close does nothing.
9. Unmount before/after dispatch: retained read/clear/close callbacks cannot dispatch, late settlements cannot publish and real preload window listeners clean up. Preserve original summary/preload assertions and no-setInterval contract.
10. Synthetic recognized malformed rows that would reach formatDuration, plus null/unknown-kind forward compatibility: fixed read error or declared ignored-future-kind behavior, never crash/false empty from malformed success. Do not validate arbitrary extra fields or introduce a new API/backend requirement.

## Proposed validation and return

Only after explicit release, tests first run NEW development/tests/DataInspector-recovery.test.tsx against unchanged source through heavy; record actual failures rather than treating this plan as reproduction. Implement exact two paths, then run new suite plus unchanged development/tests/DataInspector.test.ts and relevant unchanged component-contracts. Scoped strict types extend actual web tsconfig for the exact two changed roots with inherited options and no weakening; report all dependency diagnostics. Review whitespace, operation/owner source and module budget, freeze for root independent/full verification. Root can add integrated Modal ownership verification under its own exact paths if needed; worker does not silently add tests/helpers.

No source/tests/checks/shared docs/commits/browser/Lab/providers/panel/private data changed/read. This report establishes source paths and executable synthetic schedules; live request failures, actual mutation outcome, browser events and measured UI latency remain unverified. Tooltip and root CodeViewer completed paths remain frozen/unmodified by this worker.
