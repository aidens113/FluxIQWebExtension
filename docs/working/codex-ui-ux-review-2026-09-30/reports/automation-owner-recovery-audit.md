# Extension automation owner recovery audit

Status: Complete — read-only, bounded implementation proposed
Owner: deployment_docs_audit worker
Date: 2026-10-01

## Written brief

- Operational recovery remains held. Read only downstream panel/automations/{controller.ts,automations-tab.ts,automation-strip.ts}, their owning tests, panel/state/store.ts/request.ts and directly needed ExtensionStatus frontend type fields/caller contracts. Source is checkpointed e14e935a; no product edits.
- Parent Current State establishes bounds. Preserve verified stable rows/focus/passive names, explicit navigation, utility ordering, export delivery and held working state.
- Inspect Core address/connection ownership: retained rows/detail/replies/unsupported markers, stale read/run/export completions, same-id new owner locks, current captured mutation handlers and refresh trigger. Distinguish active connection updates from address replacement and normal request failures from defensive rejected fixtures.
- Propose exact bounded source/test partition, current-owner semantics and meaningful deferred regressions; no new wire token/version/cancellation guarantee or client lifecycle API assumed. Note wider Chat-target dependence separately instead of silently widening scope.
- Write source-confirmed findings progressively here, including compatibility behavior preserved. No actual recordings/datasets/status/browser state, background/private payloads/protected Core, broad/live/browser/provider/panel operations, commits or shared docs.

## Findings

## Evidence / limits

Read parent Current State, exact panel/automations controller/tab/strip, their direct owning tests, panel/state/store.ts/request.ts and required frontend protocol/status-fixture declarations only. No background/recorded/private runtime data inspected. Existing source is frozen; no source/test edits or execution gates ran. Findings below are source call-order evidence, not browser reproduction or certification.

PanelStore.request explicitly never throws, and panelRequest catches rejected browser transport into PanelResult. Uncaught rejected list/detail/run promises are therefore defensive injected-provider failures, not the normal network failure path. Existing export catch/finally delivery recovery and reentrant synchronous export lock are verified contracts that must survive. Existing stable keyed rows, source-owned focus, passive naming, explicit navigation and held working signal also remain intact.

## A1: Connected address changes retain foreign state and do not trigger a read

controller.observe compares only status.connectionState against its boolean connected flag. It reads no gatewayUrl, settings.coreApiUrl, clientId or projectId fields. Status exposes these frontend owner/routing identifiers; project omission in relay requests uses the browser session's project. A connected A→connected B status therefore keeps rows, replies, notices, details, detailsAsked and unsupported flags from A, returns false and causes tab.render to skip refresh. Current-owner context is not represented anywhere in controller state.

The timer may eventually refresh, but selected strip still shows old same-ID run facts/datasets until then, and old replies can be chosen by updatedAt over B's rows. A's detail cache can satisfy B's same-run-ID lookup. This is a frontend owner defect, not a claim of server authorization bypass.

## A2: Every asynchronous channel can publish an obsolete owner's completion

- List refresh has a single boolean reading. A pending A request keeps reading=true after disconnect/replacement, so a newly connected B refresh is ignored. A reply later clears it and replaces rows/readError or sets listUnsupported under B, with no captured owner/generation check.
- Detail adds a runId to detailsAsked before awaiting; its completion sets detailUnsupported/details or deletes that marker with no owner/current-focus/request token. Same-ID B detail state can be populated or suppressed by A. Changing focused flow does not fence current detail completion; the cache may keep data for an automation nobody currently has open.
- Run sets global runningFlowId and awaits; disconnect/replacement does not reset/fence it. A completion clears the global lock, writes notices/replies, initiates refresh and requests old run detail even after the owner changes. If a future owner reset permits B's same-flow run, an old A completion/finally must not release B's lock.
- Export has flow-ID Set locking and no owner checks before/after await or synchronous download. A completion after switching to B can save A's export. Its catch/finally can add a notice or remove B's same-flow export lock. Existing synchronous download/reentrant locking must remain held until current delivery finishes; no issued request is claimed cancellable.

Use separate captured frontend owner epoch and per-channel operation tokens at entry, completion, notification, delivery and cleanup. Disconnect should invalidate in-flight connected requests even when the same address later reconnects; same-owner confirmed data may be retained as offline evidence rather than foreign-owner state. No transport cancellation/session-proof API is assumed.

## A3: Fallback/unsupported ownership is incorrectly global

listUnsupported/runUnsupported/detailUnsupported live for the controller lifetime. A legacy A background/relay unsupported response blocks B permanently despite B potentially supporting the endpoint. mode checks listUnsupported before connected, so disconnect while fallback still displays fallback rather than offline. Preserve no-repeat fallback for the same owner; reset capability assumptions only on an actual owner replacement, and choose offline truthfully when disconnected. Reconnect to the same owner should not blindly spam previously unsupported messages.

When fallback draw stops the timer, later owner recovery also needs explicit timer restart: existing tab.render only invokes refresh on observe true and never starts a stopped timer. A new owner cannot receive the regular30s updates until the user toggles tab activity. Centralize the already authorized active/visible/nonfallback timer policy; no polling cadence or wire change.

## A4: Offline export remains actionable and obsolete tuples are accepted

controller.exportDataset checks only exporting.has(flowId), unlike run's connected/working guard. State retains cached rows offline, strip.draw finds that row regardless of mode, and exportLine disables buttons only when row.exporting. Offline strip therefore still offers enabled export buttons and dispatches requests. Old detached dataset controls capture flow/run/dataset tuple and call exportDataset without verifying current row/detail tuple. run similarly accepts any flowId while connected, without requiring it in the current confirmed list.

Require connected current-owner confirmed row and current dataset/run tuple at operation entry. Offline/stale owner exports must be disabled/removed or clearly unavailable. Preserve same-owner valid retained read-failure behavior as a deliberate policy; do not automatically equate transient read failure with deleted data. A current list that confirms target removal should invalidate its old action/export controls.

## A5: Same-ID stale DOM handlers need a frontend ownership lease

Tuple membership alone cannot reject a retained A CSV handler when B has identical flow/run/dataset IDs. The controller public run/export API currently receives IDs only, so it cannot distinguish that old handler from a legitimate newly rendered B handler. A bounded local frontend epoch/lease must be captured by mounted controls and validated at entry, without adding wire fields or claiming a server token/version.

Possible explicit local contract: expose an opaque/number owner revision in controller state and allow optional expected revision arguments for frontend run/export/focus callbacks; current UI always supplies its captured revision, while legacy direct callers remain compatibility-safe. Or expose an owner-bound local actions capability recreated per owner. Supervisor chooses the exact seam before implementation. Rebuild or re-key row/dataset controls on actual owner replacement even when IDs match; retain stable elements on equivalent same-owner refresh. Old callback rejection must occur before a request or current lock mutation.

Existing strip Run listener reads mutable shown flow instead of captured owner; retained invocation after owner replacement can run whichever same-ID flow is currently shown. Existing dataset listeners capture tuple only. Row activation passes a captured row to hooks.choose, whose shell/Chat target has no ownership identifier in this brief. Do not silently broaden into Chat.

## Frontend owner policy requiring explicit integration decisions

Use existing nonsecret frontend scope fields rather than runtime.state/lastMessageAt/eventCount, which fluctuate on ordinary activity and must not reset rows or held working. gatewayUrl is required and provides a reliable address-change signal; settings.coreApiUrl represents HTTP Core reads but settings itself is optional. clientId/projectId affect frontend routing/session scope. paired loss also matters for stale authenticated actions, while sessionId may change during ordinary reconnect and must not be treated as proof of a new Core owner without investigation.

An omitted optional settings field is not necessarily evidence that the Core address changed. Preserve last known address identity when a partial status lacks it, or explicitly distinguish unknown identity from confirmed replacement. Do not print owner keys/URLs or read tokens. Exact normalization/project-null/session behavior needs supervisor agreement; no existing backend identity or status completeness guarantee was invented in this audit.

Keep setWorking's shell-held signal independent of volatile status.runtime. Replacing owner should not silently discard a working lock the shell still holds; the shell remains its owner. Preserve same-owner errors/drafts/metadata on ordinary status pushes and transport refusal.

## Proposed bounded implementation partition

Stage1, exact local frontend ownership/recovery unit after supervisor release:

- Existing controller.ts: observed scope/connection epochs, channel locks/tokens and current tuple validation; owner-scoped unsupported/cache/notice state; guarded acknowledgement/delivery/finally.
- Existing automations-tab.ts: detect meaningful observe refresh signal, reconcile active refresh/timer policy and re-key/retire same-ID foreign row activation callbacks while preserving same-owner stable rows/focus.
- Existing automation-strip.ts: capture local ownership lease for Run/export controls, block offline/obsolete tuples, clear foreign dataset controls and preserve passive same-owner naming/focus.
- New owning tests/controller-owner-recovery.test.ts, automations-tab-owner-recovery.test.ts and automation-strip-owner-recovery.test.ts. Existing controller/tab/strip behavior tests remain unchanged. Optional existing types seam should be explicitly released if owner revision lives outside controller.ts; no shared wire/API change.

Stage2, separate shell/Chat dependency only after read-only investigation and exact release: selected/open automation target and passive naming can survive switching Core address, so clearing controller rows alone leaves an A Chat target alive. Current shell/Chat source is not owned/read here. Root must coordinate how foreign selection becomes unavailable or resets without losing same-owner drafts/history or stealing focus. Do not claim Stage1 completely fixes cross-owner Chat routing.

## Meaningful tests-first cases

1. Connected A→connected B with same flow/run/dataset IDs immediately masks all foreign facts/notices/cache, resets owner-scoped unsupported flags and triggers one current list read. Runtime/recording/status churn and optional missing settings do not reset same-owner state or add reads.
2. Pending A list/detail/run/export resolve/refuse after disconnect/reconnect or owner replacement: no current publication, old follow-up read, old download or same-ID B lock release. A captured obsolete handler refuses before issuing any request.
3. Same-owner ordinary read failure retains confirmed state/error and retry policy; same-owner unsupported remains no-repeat. Different owner can attempt that capability anew. Offline mode remains offline even if that owner's unsupported flag was set.
4. Old tuple removed by current metadata refuses Run/export; a current same-ID tuple from a new owner requires a new frontend lease. Offline exports dispatch nothing and no old export reaches download.
5. Successful current export, thrown download, duplicate activation and reentrant synchronous delivery preserve the existing lock/recovery behavior from e14e935a. Issued operation cancellation is never claimed.
6. Active fallback→new owner recovery restarts the existing30s timer once; inactive/hidden tab still performs no timer reads and no duplicate interval starts. Keep keyed row identity/focus/scroll stable within a single owner.
7. Defensive injected rejected promises release only their current operation/read markers and produce fixed local feedback; normal runtimeSendMessage rejection continues through PanelResult rather than being mislabeled an uncaught transport exception.

## Return

Only this worker report changed; all product/tests remain frozen. No test/type/build/live/provider/panel/private-data/commit activity ran. Current-owner request/delivery fencing, stale same-ID handler leases, offline export and fallback timer recovery are confirmed bounded frontend defects. Wider Chat target ownership remains an explicitly separate integration dependency.
