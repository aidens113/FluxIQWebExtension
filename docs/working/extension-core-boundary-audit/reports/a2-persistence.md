# A2: Persistence and ownership

Worker report for brief A2 of [extension-core-boundary-audit.md](../../extension-core-boundary-audit.md).
Read-only audit on `dev`, 2026-10-19. No values, tokens or page data were copied.

## Outcome

Done. Every persistent store across `apps/extension/src` (background, content, panel, popup, sidepanel,
runtime, shared, page-world) and `domain/src` is listed below. **Nothing in the extension owns projects, Flows,
recordings, policies or grants.** Those live in Core (Automation Studio's project SQLite store, the gateway's
trusted-client registry, Core's permission gate). One store is a real problem, though: the **offline event
queue**. It keeps recorded page data (DOM snapshots, typed values, action results that can carry extracted rows)
in `chrome.storage.local` across browser restarts, and it has no project or recording binding when it is
replayed. The rest is legitimate local state, with two small "decides policy locally" points.

Not used anywhere in scope: `chrome.storage.sync`, `browser.storage` (the code uses `chrome.*` on both
browsers), IndexedDB, `sessionStorage`, the Cache API, SQLite, and file writes (`node:fs`). The only file
output is two user-initiated downloads: a Core dataset export (`panel/automations/download-file.ts`) and the
problem report JSON (`panel/settings/problem-report-section.ts`).

## Table

Lifetimes: **browser-persistent** means `chrome.storage.local` or page `localStorage`, which survives browser
restarts until removed. **Browser-session** means `chrome.storage.session`, which survives a service-worker
restart and is cleared when the browser closes (on Firefox before 115 it falls back to worker memory).
**Worker** means memory in the background service worker. **Process** means memory in the Node process that
hosts the domain (Core's process).

| Store / key | File : symbol | Holds | Lifetime | Core counterpart | Class | Proposed owner | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `chrome.storage.local` `fluxiq.settings` | `background/storage.ts` `readSettings`/`writeSettings`; repaired by `background/saved-state.ts` `readSavedSettings` | Gateway and Core API URLs; auto-reconnect; capture switches (mutations, input values, snapshots); `requestsEnabled` (always forced to false) | Browser-persistent | None. Core receives the capture switches as metadata in the client hello (`gateway-session.ts`, `metadata.settings`) but does not store or enforce them | Extension-local settings | Stays (see suspected S2 about capture policy and `requestsEnabled`) | Low |
| `chrome.storage.local` `fluxiq.session` | `background/storage.ts` `readSession`/`writeSession`/`clearSession`; `saved-state.ts` `readSavedSession` | Client id, **pairing bearer token**, session id, server URL, `projectId`, connected time | Browser-persistent | `!FluxIQ/packages/fluxiq/src/client-gateway/service/trusted-clients.ts` `ClientGatewayTrustedClientRegistry` (Core stores the token hash and the trust). Project assignment: `!FluxIQ/apps/web/src/lib/paired-client-project-domain.ts` | Pairing secret plus a **cache** of Core's project assignment | Stays. Core is authoritative for both; `projectId` is a cache | Low. The token sits in plain text at rest, which is normal for an extension. `projectId` can go stale (S3) |
| `chrome.storage.local` `fluxiq.clientId` | `background/storage.ts` `readOrCreateClientId` | Random client id | Browser-persistent | Core keys trusted clients by it | Pairing identity | Stays | None |
| `chrome.storage.local` `fluxiq.queuedEvents` | `background/storage.ts` `queueEvent`/`readQueuedEvents`/`removeQueuedRecordingEvent`/`clearQueuedEvents`; used by `background/connection/gateway-session.ts` `send`, `flushQueue`, `queuedActionResult` | Up to 1,000 outgoing gateway messages queued while the socket is down: `client.recording_event`, `client.snapshot` (DOM snapshots), `client.state_update`, `client.action_result` (can carry extracted rows), `client.reconcile_result`, `client.start_recording`/`stop_recording` | **Browser-persistent** until the next flush | Core stores recordings, snapshots and run results in the project store (`!FluxIQ/packages/fluxiq/src/programs/automation-studio/storage/project/`, for example `event-chunk-store.ts`, ingested by `client-gateway/bridge.ts` `appendRecordingEvent`/`appendSnapshot`) | In-flight buffer before handoff, **but persisted durably and holding recorded page data** | Stays as a buffer, with changes: keep it in `chrome.storage.session` or worker memory, bind each message to its recording, project and session, and drop rather than replay stale entries. See C1 | **High.** Page data at rest across restarts. Replay goes to whatever session connects next. 10 MB quota exposure (C1, S1) |
| `chrome.storage.local` `fluxiq.problemLog` | `background/diagnostics/problem/log.ts` `ProblemLog`, `localProblemLogStore` | Last 30 failure messages (redacted when written), with optional command and run ids | Browser-persistent | Core has its own gateway audit log (`client-gateway/service/audit-log.ts`), a different thing | Diagnostics cache | Stays | Low (redacted, bounded) |
| `chrome.storage.local` `fluxiq.activity.overlay` | `background/activity/overlay-preference-storage.ts` `overlayPreferenceStorage` | How the person wants the on-page activity overlay shown | Browser-persistent | None | UI preference | Stays | None |
| `chrome.storage.local` `fluxiq.ui.connectionDraft` | `panel/settings/draft-store.ts` `readConnectionDraft`/`writeConnectionDraft` | Unsaved Connection form values (same fields as settings, no token) | Browser-persistent until Save | None | UI convenience | Stays | None |
| Panel `localStorage` (the draft keys in `draft-storage.ts`) | `panel/chat/conversation/draft-storage.ts` | The chat message being typed, and which conversation it belongs to | Browser-persistent per panel origin | Core owns the conversation itself (`panelConversationRead`/`Send` go to Core) | UI convenience | Stays | Low. Whatever the person typed, including anything sensitive, sits at rest until sent |
| `chrome.storage.session` `fluxiq.inFlight.<commandId>` | `background/connection/in-flight/record-store.ts` `InFlightRecordStore`; area in `record-area.ts` | Commands sent to a page and not yet answered: id, action type, committing flag, start time, tab, document. No values, no addresses | Browser-session | Core's side of the same reconciliation (C8): `client-gateway/service/command-reconcile/`, `command-ledger/` (whose controller says it is not yet wired to production callers) | Client half of a reconciliation protocol | Stays. It is what lets the browser answer Core's "what became of command X" honestly | Low |
| `chrome.storage.session` `fluxiq.commandSeen.<commandId>` | `background/connection/in-flight/seen-store.ts` `SeenCommandStore` | Last 64 received command ids and times | Browser-session | Same as above | Client half of reconciliation | Stays | Low |
| `chrome.storage.session` `fluxiq.hostLease.<resourceKey>` | `background/connection/host-lease/ledger.ts` | The highest host-lease epoch seen per resource, used to refuse stale commands | Browser-session (plus worker memory in front of it) | Core issues and stamps leases: `client-gateway/service/host-lease/` (`stamp.ts`, `source.ts`) | Client-side fencing of leases Core grants | Stays. Core decides; the browser only refuses a lower epoch | Low |
| `chrome.storage.session` `fluxiq.disconnectedByPerson` | `background/panel/session-disconnect-memory.ts` `sessionDisconnectMemory` | Whether the person pressed Disconnect, so auto-connect holds off | Browser-session | None | Connection state | Stays | None |
| `chrome.storage.session` `runtimeSnapshotReadinessProof` | `runtime/automation-tab.ts` `noteSnapshotReadiness`/`consumeSnapshotReadiness` | One-shot proof: tab id, **page URL**, document id, time | Browser-session (also worker memory) | None | Transient cache | Stays. Note that it is the only session key without the `fluxiq.` prefix, and it holds a URL | Low |
| Worker memory `automationTabs` | `runtime/automation-tab.ts` | Last 8 tab ids FluxIQ drove | Worker | Core tracks host leases and resources, not tab ids | Transient | Stays | None |
| Worker memory `ExtractionSessionStore` | `background/extraction/session-store.ts` | Picker session: proposal and preview rows read off the page | Worker; deliberately never written to storage | Core receives only the confirmed definition in the recording | In-flight buffer before handoff | Stays | None. It is a good model for what C1 should do |
| Worker memory `ActivityLog` | `background/connection/activity-log.ts` | 20 recent activity entries and a paged log of up to 500 for the current recording | Worker | Core owns the recording itself; this is display only | UI cache | Stays | None |
| Worker memory: connection, active recording, recording project | `background/index.ts` `connection`; `background/connection/active-recording.ts` | Live connection object, recording state, active recording id and project | Worker. Only `projectId` is written back, into `fluxiq.session` | Core: recordings in the project store, active recordings in `bridge.ts` `activeRecordings` | In-flight state | Stays | Low |
| Content-script memory | `content/recorder.ts` (`recording`, `sequence`, pending input and mutations), `content/selector/selector-memo.ts`, `content/picker/session.ts`, `content/evidence/changes.ts` | Per-page recording buffer and caches | The page | None | In-flight buffer or cache | Stays | None |
| Domain process memory: cleared ways out | `domain/src/cleared-way-outs/registry.ts` `createWebAutomationClearedWayOuts`, scoped per FluxIQ instance by `owned-by.ts` (WeakMap) | Up to 256 pressed "way out" controls (page address plus element descriptor), handed to Core as opaque references | Process | Core keeps only the reference in its run trace, by design | Process cache inside Core's host | Stays (S4) | Low/medium. A durable Core trace can hold a reference that a restart empties |
| Domain process memory: per-build memories | `domain/src/runtime/llm-evidence/stable-handles.ts`, `node-run/arrival.ts`, `node-run/held-literals/memory.ts`, `node-run/own-layers/memory.ts`, `plan-resolution/view-history.ts`, `plan-resolution/target-packets.ts`, `repeated-refusal.ts` and similar | Handle numbering per (project, Flow), the Flow's held parameters, layers this build opened, recent page views. Bounded (for example 16 builds) | Process, per build | Core persists the Flow and the build's run; it does not persist these | Build-session caches inside Core's host | Stays for now (S5) | Low/medium. Lost on a Core restart in the middle of a build |
| Domain process memory: request policy | `domain/src/requests/policy/validation.ts` `webAutomationRequestPolicies` (WeakMap per FluxIQ instance) | Direct-request policy: enabled, allowed origins, limits. Default disabled | Process. Set once at `registerWebAutomationDomain` | No Core project-level request policy found | Host configuration, not durable | Stays as host config (S2) | Low |
| Domain module cache `cached` | `domain/src/runtime/llm-evidence/node-run/catalog.ts` | Runnable-node catalog built from static definitions | Process | Core's node registry is the source | Derived static cache | Stays | None |

## Confirmed findings

**C1. The offline queue keeps recorded page data at rest and replays it without a binding.** Severity high.
- `gateway-session.ts` `send` queues *every* message type when the socket is down:
  `this.queueSize = await this.deps.queue.queueEvent(message);`. The senders include `client.snapshot`
  (`recording-evidence.ts`, two call sites), `client.recording_event` (`recorded-event-intake.ts`,
  `server-command-channel.ts`) and `client.action_result` (`server-command-channel.ts`, five call sites).
- `storage.ts` `queueEvent` writes the queue to `chrome.storage.local`, which outlives a browser restart. The
  default settings record typed values (`shared/browser.ts`: `captureInputValues: true`).
- `flushQueue` resends only `message.type` and `message.payload` on whatever session connects next. It does
  not check that the session, project or recording is the one the message was created under. Core's
  `bridge.ts` drops some messages that arrive with no active recording (`appendOrDiscard`), but results and
  snapshots go through other handlers.
- This contradicts the extension's own stance elsewhere. `background/extraction/session-store.ts` refuses to
  persist preview rows ("a durable preview is exactly the artefact D12 says an excluded column must never
  reach"). AGENTS.md also lists recorded page data in extension storage among the things that must never be
  exposed.
- Ownership is still correct: Core is the durable owner and the queue is a handoff buffer. The fix is the
  buffer's lifetime and binding, not a move to Core.
- Proposed change (an extension change, needing no Core seam): move the queue to `chrome.storage.session`, or
  keep page-data messages in worker memory; stamp each entry with its session, project and recording, and
  drop on mismatch. The risk is that the deliberate guarantee of surviving a worker restart (B3/C8 for action
  results) must be kept for `client.action_result`, because `queuedActionResult` answers reconciliation from
  it. Session storage keeps that guarantee.

**C2. No durable project, Flow, recording, policy or grant ownership exists downstream.**
- Projects: the extension only caches `projectId` in `fluxiq.session`. Lists go to Core
  (`automation-relay.ts` calls `list-flow-summaries` and `list-flow-runs`; `core-api.ts` calls
  `/api/recordings`).
- Flows and runs: read through Core relays only.
- Recordings: Core's project store. The extension holds only an in-flight buffer and a display log.
- Permissions: `domain/.../plan-resolution/step-permission.ts` puts every step to Core's permission gate
  ("the user's instruction or permission is the only authority. Core holds both"). The panel's
  `ask-copy.ts` only renders Core's asks.
- Pairing trust: Core's `trusted-clients.ts`. The extension keeps the token, which is the client side of
  pairing and legitimate.

**C3. The browser-session stores for commands and leases are correctly split.** Core issues commands and leases
and keeps its own ledger. The browser keeps the minimum it needs to answer reconciliation and to fence stale
epochs across a worker restart. These are not two sources of truth: each side records what only it can
observe.

## Suspected (not proven)

- **S1. Quota.** No manifest declares `unlimitedStorage` (`manifest.chrome.json` lists `"storage"` only), so
  `chrome.storage.local` is capped at about 10 MB. A queue of 1,000 messages that includes DOM snapshots can
  probably exceed it. `queueEvent` would then throw out of `send`, and a recorded event or action result
  would be lost or would surface as an error. Not measured.
- **S2. Policy decided locally.**
  - The capture switches (`captureInputValues`, `captureSnapshots`, `captureMutations`) are a privacy policy
    for what reaches a project's recordings. They are set per browser, and Core only receives them as hello
    metadata. If projects need a recording-capture policy, Core should own it and send it down.
  - The extension hard-codes `requestsEnabled: false`: `storage.ts` `normalizeSettings`, `saved-state.ts`,
    `settings-save.ts`, `draft-store.ts`, and a disabled toggle in `form-fields.ts`. The domain separately has
    a per-instance request policy (`requests/policy/validation.ts`, default disabled).
  - No Core counterpart for either was found. Today both say "off", so they agree. But that is two places
    deciding the same policy, neither of which is Core's project policy store.
- **S3. Stale project.** `automation-relay.ts` falls back to the cached `deps.projectId()` (from
  `fluxiq.session`) when a panel message names no project. It is refreshed when a session becomes ready and
  when a recording links a project. I did not trace whether Core reassigning the browser to another project
  while it stays connected updates the cache.
- **S4. Dangling way-out references.** Core's durable run trace can hold a `way-out.*` reference whose target
  lives only in domain process memory (256 entries). A trial after a Core restart, or after 256 newer presses,
  gets "names nothing". The design deliberately keeps page structure out of Core, so this is a durability
  trade-off rather than a boundary breach.
- **S5. Build memories in process.** Handle numbering, held literals and layers the build opened are per-build
  state in domain memory. A Core restart in the middle of a build renumbers handles and forgets held values.
  This is web-specific (it stays downstream), but if builds are meant to survive a restart, Core needs a
  build-state persistence seam that the domain can write to. A3 may cover the generic part.

## Summary

The extension and domain do not own any durable project, Flow, recording, policy or grant data. Core owns all
of it, and the extension reads it through relays and the gateway. Almost every store is legitimate local
state: pairing identity and token, settings, UI drafts and preferences, a redacted problem log, and
browser-session reconciliation and lease records.

The one finding that needs action is the offline queue. It keeps DOM snapshots, typed values and action
results in persistent local storage, has quota exposure, and replays without checking the session or project.
It should become a session-lifetime, bound buffer.

Two smaller ownership questions should go to the supervisor:
- whether recording-capture and direct-request policy belong in Core's project policy;
- whether build-session memories need a Core persistence seam.

## Commands run and observed results

- `grep -rnE "chrome\.storage|browser\.storage|storage\.(local|session|sync)|indexedDB|IDBDatabase|localStorage|sessionStorage|caches\.open|writeFile|appendFile|sqlite|better-sqlite|node:fs|..." apps/extension/src domain/src` (tests excluded). Hits only in the files in the table. None for `sync`, `browser.storage`, IndexedDB, `sessionStorage`, Cache API, SQLite or fs.
- `grep` for module-level `new Map/Set/WeakMap` and module-level `let` in both trees. Mostly constant sets. Mutable state as listed.
- `grep` for `downloads.download|createObjectURL|new Blob|showSaveFilePicker`. Two user-initiated downloads.
- `grep` for `send("client.*"` in background and runtime, to list which message types reach the queue.
- `grep` for `requestsEnabled|captureInputValues`, `projectId`, `grant|policy|approv` in the extension.
- Core comparisons: `client-gateway/service/` listing, `trusted-clients.ts`, `command-ledger/`, `host-lease/`, `bridge.ts` (recording intake), `storage/project/event-chunk-store.ts`. Grep for `captureInputValues` and `requestsEnabled` in Core src: no hits.
- `manifest.*.json`: `"storage"` permission only, no `unlimitedStorage`.

## Not verified

- Actual size of queued snapshots against the quota (S1). No run.
- How Core handles replayed `client.snapshot` and `client.action_result` that arrive under a new session, and
  whether Core dedupes replayed recording events by `eventId` (`recording-stream/entry.ts` reads
  `metadata.eventId`; not traced further).
- Whether every domain build memory is scoped per FluxIQ instance and bounded. Spot-checked
  `cleared-way-outs`, `held-literals`, `own-layers` and `stable-handles` only.
- Tests, e2e and `scripts/` were out of scope.

## Open questions or contradictions found

- The offline queue (C1) contradicts the "never persist a preview" rule in `session-store.ts` and the AGENTS.md
  rule against recorded page data in extension storage.
- Core's command ledger controller says "production gateway/executor callers are not wired to this
  controller". So the browser's in-flight records may currently be the more complete half of reconciliation.
  This is worth A3's attention.
