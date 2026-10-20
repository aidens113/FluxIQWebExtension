# Lane G: gateway client into Core (t726)

Lead report and running progress log for lane G of
[the boundary audit](../../extension-core-boundary-audit.md) (findings 1 and 2, move-plan phases 1 and 3).
Worktrees: `fxwork/t726/!FluxIQWebExtension` and `fxwork/t726/!FluxIQ`, both on
`task/t726-gateway-client-into-core`. No commits; the supervisor commits each `UNIT READY` block.

## Facts the plan rests on (read 2026-10-19)

- Core mints a new gateway `sessionId` for every socket (`client-gateway/service/sessions.ts` `create`), and a
  reconnect resumes the *trusted client* through the token, which Core rotates on each resume
  (`lifecycle.ts` `resumeTrustedSession`). Core keys a client's active recording by that trusted client
  (`automation-studio/client-gateway/bridge.ts` `recordingOwnerKey`), so a recording survives a reconnect.
  Binding a queued entry to the wire `sessionId` would therefore drop every entry on every reconnect. The
  queue's "gateway session" is instead the client's **trust lineage**: one id kept while each new socket
  resumes by token, replaced whenever a socket had to pair (or said hello without a token). This is the
  same unit Core files recordings under.
- Core's `@fluxiq/client-gateway-websocket` today is connect, open deadline, send and events only.
- Session picking has three copies with two rules: `domain/src/runtime/adapter.ts` and
  `domain/src/io/gateway-output-dispatcher.ts` accept `connected` or `ready` and any `web.*` action;
  `runtime/web-sessions/eligible-web-session.ts` (leases, evidence tools) needs `ready`, not recording, and
  the web capability. Core refuses commands to a non-`ready` session anyway (`requireReady`), and an
  unpaired second session makes the loose rule's "exactly one" fail, so the one rule is the strict one.
- Host-lease refusal codes and reconcile states already live in `@fluxiq/contracts/client-gateway`.
- No wire message changes: the queue binding, lineage and session pick are client-side or host-side only.

## Queue semantics (both units)

- Lifetime: the browser session. Stored in `chrome.storage.session` (Firefox before 115 and any browser
  without it: worker memory, as `in-flight/record-area.ts` already does). Any `fluxiq.queuedEvents` left in
  `chrome.storage.local` is removed when the background starts, which every upgrade does.
- Entry: `{ binding: { session, projectId, recordingId }, message }`. `session` is the trust lineage;
  `projectId` the client's current project when queued (`null` when none); `recordingId` the recording the
  payload names, else the recording in progress when queued, else `null`.
- Flush (after `session_ready`): deliver, in queue order, the entries whose lineage and project equal the
  current ones and whose recording is `null`, the current recording, or a recording whose own
  `client.stop_recording` is in the queue under the same lineage and project (it ended while the socket was
  down). Every other entry is dropped. A send failing mid-flush keeps only the undelivered matching tail.
- Cap: `MAX_EVENT_QUEUE_SIZE` (1,000), newest kept. `queuedActionResult` reads only current-lineage entries.

## Plan

Unit 1 (phase 1, privacy fix): Core `outbox/` (entry types, binding rule, lineage rule, store port, memory
store, cap) in `client-gateway-websocket`; the extension stores it in session storage, discards the
persistent queue, tags entries and flushes by binding (`storage.ts`, `saved-state.ts`,
`gateway-session.ts`, `connection.ts`, `index.ts`).

Unit 2 (phase 3): Core gains `connection/` (reconnect with backoff, heartbeat, keep-alive hook, state,
lineage, outbox, open-failure wording), `reconcile/` (the client half of C8 with ports for storage, the
commit predicate and the domain's outcome builders), `host-lease/` (reading, judgement, refusal, ledger
with a storage port), `storage-area/` (the key-value area port and a memory area) and `session-pick/` (one
rule). The extension's `GatewaySession` becomes the web adapter over Core's connection (hello, command
mapping, MV3 keep-alive, session persistence); `in-flight/` and `host-lease/` use Core's classes;
`domain/src/client/host-lease.ts` and `reconcile/answer.ts` are deleted with callers switched; the domain's
three session pickers become one call to Core's rule.

Workers, partitioned by file, foreground:
1. W-A (worker-high, Core `outbox/`) with W-B (worker, Core `reconcile/`, `host-lease/`, `storage-area/`,
   `session-pick/`). Lead adds the package barrel lines and rebuilds Core.
2. W-C (worker-high, Core `connection/`) with W-D (worker-high, downstream Unit 1).
3. W-E (worker-high, extension gateway adapter onto Core's connection) with W-F (worker, extension
   reconciliation and lease onto Core, domain client and session pick).
4. Docs (downstream `docs/architecture/extension-client.md`, Core `client-gateway.md`, package README),
   then the headed provider-free browser exercise on a realistic scenario.

## Worker briefs

### Brief: lane-g-wa-core-outbox
- Repository: FluxIQ Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t726/!FluxIQ`.
- Task: add `packages/client-gateway-websocket/src/outbox/`, the offline queue as specified under "Queue
  semantics" in this report, with no browser concept. One exported thing per file, `index.ts` barrel,
  `.ts` import specifiers as the package uses. Files:
  - `types.ts`: `ClientGatewayOutboxBinding { session: string; projectId: string | null; recordingId: string | null }`,
    `ClientGatewayOutboxEntry { binding; message: ClientGatewayClientMessage }`,
    `ClientGatewayOutboxState { lineage?: string; entries: ClientGatewayOutboxEntry[] }`,
    `ClientGatewayOutboxStore { read(): Promise<ClientGatewayOutboxState>; write(state): Promise<void> }`,
    `ClientGatewayOutboxContext { projectId: string | null; recordingId: string | null }`.
  - `binding.ts` `clientGatewayOutboxBinding(message, session, context)`: recording = the payload's string
    `recordingId`, else `context.recordingId`, else `null`; project = `context.projectId`.
  - `deliverable.ts` `clientGatewayOutboxDeliverable(entries, current)` -> `{ deliver, dropped }` by the flush rule.
  - `lineage.ts` `clientGatewayLineageAfterReady({ stored, resumed, mint })`: `stored` when `resumed` and
    `stored` is set, else `mint()`. (`resumed`: the hello carried a token and no `server.pairing_required`
    came on that socket; the caller decides it.)
  - `outbox.ts` class `ClientGatewayOutbox(store, { limit = 1000 })`: `enqueue(message, binding)` -> size,
    newest `limit` kept; `flush(current, send)` -> `{ delivered, dropped }` (drops written first, sends in
    order, on a send failure writes the undelivered tail and rethrows, else writes no entries);
    `actionResult(commandId, session)` (current-lineage `client.action_result` entries only; a payload
    status `interrupted` reads as `unknown`, as `apps/extension/.../gateway-session.ts` `queuedActionResult`
    does today); `removeRecordingEvent(eventId)` -> count; `size()`; `lineage()`; `setLineage(id)`. Every
    operation runs one after another on one chain, so an enqueue during a flush is never lost; `send`
    passed to `flush` must not enqueue (document it).
  - `memory-store.ts` `clientGatewayMemoryOutboxStore()` (copies on write).
- Tests first, vitest, in `outbox/tests/`: binding; deliverable (lineage, project and other-recording
  entries dropped; current and ended-in-queue recordings delivered; order kept); lineage; cap; flush tail on
  failure; `actionResult` lineage filter and `interrupted`; `removeRecordingEvent`; enqueue during flush.
- Required reads: this report's "Facts" and "Queue semantics"; the package's `src/*.ts`;
  `packages/contracts/src/client-gateway.ts` message types; Core `docs/architecture/code-structure.md`
  "Tests" and "Files".
- Owns: `packages/client-gateway-websocket/src/outbox/**` only.
- Must not touch: the package's `src/index.ts` (the lead adds the barrel line), any other directory, the
  downstream tree.
- Done: `pnpm --filter @fluxiq/client-gateway-websocket exec vitest run src/outbox` passes;
  `pnpm --filter @fluxiq/client-gateway-websocket check` clean; `pnpm structure:check` clean for these files.
- Report to: downstream `docs/working/extension-core-boundary-audit/reports/lane-g-wa-core-outbox.md`.

### Brief: lane-g-wb-core-ledgers
- Repository: FluxIQ Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t726/!FluxIQ`.
- Task: move the client half of reconciliation, lease fencing and session picking into
  `packages/client-gateway-websocket/src/`, generic and browser-free, as new directories (one exported thing
  per file, barrels, `.ts` specifiers). Downstream originals stay until a later brief switches callers.
  - `storage-area/`: `ClientGatewayStorageArea { get(keys: null); set(items); remove(key: string) }` (the
    shape of `apps/extension/.../in-flight/record-store.ts` `InFlightRecordArea`) and
    `clientGatewayMemoryArea()` (from `in-flight/record-area.ts` `workerMemoryRecordArea`).
  - `reconcile/`: `ClientGatewayCommandReconciliation`, `ClientGatewayInFlightRecordStore`,
    `ClientGatewaySeenCommandStore`, `clientGatewayReconcileAnswer`, from downstream
    `in-flight/{command-reconciliation,record-store,seen-store}.ts` and `domain/src/client/reconcile/answer.ts`.
    Same semantics, except: a record is `{ commandId, actionType, committing, startedAt, place?: Record<string,
    string | number> }`; `begin({ commandId, actionType, parameters }, place?)`; `placed(commandId, place)`
    replaces `dispatched` (no `documentOf`); new deps `commits(actionType, parameters)`,
    `interruptedResult(record, completedAt)`, `notSeenResult(commandId, at)`; stores take `{ keyPrefix }`
    defaulting to today's `fluxiq.inFlight.` and `fluxiq.commandSeen.`.
  - `host-lease/`: `clientGatewayHostLeaseReading`, `clientGatewayHostLeaseJudgement` with
    `clientGatewayHostLeaseRefusalCode`, `clientGatewayHostLeaseRefusal`, `ClientGatewayHostLeaseLedger(area,
    { keyPrefix = "fluxiq.hostLease." })`, from `domain/src/client/host-lease.ts` and downstream
    `host-lease/ledger.ts`; codes from contracts' `CLIENT_GATEWAY_HOST_LEASE_REFUSAL_CODES`; words say
    "client" where they said "browser".
  - `session-pick/`: `clientGatewaySessionEligible(session, { clientType, serves(capability), alsoDeclaring? })`
    (status `ready`, no `disconnectedAt`, that client type, no `activeRecordingId`, a capability it serves,
    and `alsoDeclaring` declared when named) and `pickClientGatewaySession(sessions, criteria &
    { requestedSessionId? })` (the requested id only if eligible, else exactly one eligible, else undefined).
- Tests first, vitest, in each directory's `tests/`, ported from downstream `in-flight/tests/*.test.ts`,
  `host-lease/tests/ledger.test.ts`, `domain/src/client/tests/host-lease.test.ts`,
  `domain/src/client/reconcile/tests/answer.test.ts`, `domain/src/runtime/web-sessions/tests/*.test.ts`,
  without tabs, frames, documents or web codes (fake outcome builders).
- Required reads: the files named above; Core `docs/architecture/code-structure.md` "Tests" and "Files".
- Owns: `packages/client-gateway-websocket/src/{storage-area,reconcile,host-lease,session-pick}/**`.
- Must not touch: the package's `src/index.ts`, `src/outbox/**`, `src/connection/**`, the downstream tree.
- Done: `pnpm --filter @fluxiq/client-gateway-websocket exec vitest run src/storage-area src/reconcile
  src/host-lease src/session-pick` passes; the package `check` clean; `pnpm structure:check` clean for them.
- Report to: downstream `docs/working/extension-core-boundary-audit/reports/lane-g-wb-core-ledgers.md`.

### Brief: lane-g-wc-core-connection
- Repository: FluxIQ Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t726/!FluxIQ`.
- Task: add `packages/client-gateway-websocket/src/connection/`, the reconnecting session layer, ported from
  downstream `apps/extension/src/background/connection/gateway-session.ts` minus its web parts (hello
  contents, `execute_action` mapping, `chrome` keep-alive, session persistence). Files, one export each:
  - `types.ts`: `ClientGatewayConnectionState` (`disconnected | connecting | pairing | connected |
    reconnecting | error`), `ClientGatewayConnectionStatus` (`connectionState`, `queueSize`,
    `lastMessageAt`, `pairingReferenceCode`), the options and handler types.
  - `reconnect-delay.ts` `clientGatewayReconnectDelay(attempt, { baseDelayMs, maxDelayMs })`.
  - `open-failure-message.ts` `clientGatewayOpenFailureMessage(error)`: the downstream `connectFailureMessage`
    strings, character for character (the Lab reads them).
  - `connection.ts` class `FluxIQClientGatewayConnection(options)`. Options: `url()`, `hello()`,
    `tokenStorage`, `WebSocketImpl?`, `openTimeoutMs?`, `autoReconnect()`, `reconnectBaseDelayMs?` (1,000),
    `reconnectMaxDelayMs?` (30,000), `heartbeatIntervalMs?` (20,000), `outbox: ClientGatewayOutbox`,
    `context(): ClientGatewayOutboxContext`, `clientId()`, `mintLineage?` (default
    `globalThis.crypto.randomUUID()`), `beforeConnect?`, `emitStatus`, `reportError`, `clearError`,
    `handlers { onServerMessage?, onPairingRequired?(referenceCode, reason), onSessionReady?(message),
    onHeartbeat?, keepAlive? }`. Methods, with today's semantics: `state`, `statusFields`, `connect`,
    `stopReconnecting`, `retryNow`, `wantsConnection`, `closeClient`, `markDisconnected`,
    `markSessionReady`, `markFailed`, `noteMessageReceived`, `send(type, payload)`, `queuedActionResult`,
    `flushQueue`; new: `removeQueuedRecordingEvent(eventId)`, `refreshQueueSize()`, and
    `on(type, handler)` whose subscriptions are attached to every socket's client, so they survive reconnects.
  - Lineage (see this report's Facts): per socket note whether the hello carried a token and whether
    `server.pairing_required` came; on `server.session_ready` decide with `clientGatewayLineageAfterReady`
    against `outbox.lineage()`, `setLineage`, and only then call `onSessionReady`. Offline `send` enqueues
    with `clientGatewayOutboxBinding(message, lineage, context())` (lineage from memory, else the outbox's,
    else `""`); `flushQueue` flushes with `{ session: lineage, ...context() }` and sends directly on the socket.
- Tests first, vitest, `connection/tests/`, a fake socket and fake timers, no browser concept: every test
  name in downstream `connection/tests/gateway-session.test.ts` ported, plus backoff doubling and cap, retry
  after close, `stopReconnecting`, lineage kept on token resume and minted after pairing, offline send then
  flush (mismatched entries dropped), `on` surviving a reconnect, open-timeout wording.
- Required reads: this report's Facts and Queue semantics; downstream `gateway-session.ts` and its test;
  the package's `src/transport.ts`, `src/types.ts`, `src/outbox/`.
- Owns: `packages/client-gateway-websocket/src/connection/**`.
- Must not touch: `src/index.ts` (the lead adds the line), other package directories, the downstream tree.
- Done: `vitest run src/connection` passes; `npx tsc --noEmit -p tsconfig.json` in the package clean;
  `pnpm structure:check` clean for these files.
- Report to: downstream `docs/working/extension-core-boundary-audit/reports/lane-g-wc-core-connection.md`.

### Brief: lane-g-wd-queue-privacy
- Repository: downstream worktree `C:/Users/osrs_/FluxStuff/fxwork/t726/!FluxIQWebExtension`.
- Task: Unit 1, the offline queue privacy fix, on Core's outbox (already built in the Core worktree's
  `@fluxiq/client-gateway-websocket` dist: `ClientGatewayOutbox`, `clientGatewayOutboxBinding`,
  `clientGatewayLineageAfterReady`, `ClientGatewayOutboxStore`, `ClientGatewayStorageArea`).
  - Store: new `background/connection/outbox-store.ts` `extensionOutboxStore(area)` keeping the state under
    `fluxiq.outbox` in a `ClientGatewayStorageArea`; the background passes `inFlightRecordArea()` (session
    storage, worker memory without it). Reads go through a new `saved-state.ts` reader replacing
    `readSavedQueue` (repairs a malformed state the way the other readers do).
  - `storage.ts`: the local-storage queue functions go; `discardPersistentQueue()` removes
    `fluxiq.queuedEvents` from `chrome.storage.local`; `background/index.ts` calls it at start and takes the
    status `queueSize` from the gateway, not the old reader.
  - `gateway-session.ts`: deps `queue` becomes `outbox` plus `queueContext(): ClientGatewayOutboxContext`;
    lineage as in this report (per socket: token in hello, pairing seen; decided on `session_ready` before
    `onSessionReady` runs); offline `send` enqueues with its binding; `flushQueue` delivers by binding;
    `queuedActionResult` reads the current lineage; new `removeQueuedRecordingEvent`, `refreshQueueSize`.
  - `connection.ts`: builds the outbox; `queueContext` = project `projects.activeRecordingProject() ??
    session.projectId ?? null`, recording `recording.recordingId() ?? null`; the step removal at line ~388
    calls the gateway.
- Tests first, beside each file: lineage, binding, mismatched entries dropped, discard at start, store
  repair; update `background/tests/saved-state.test.ts`, `connection/tests/gateway-session.test.ts`, and
  `apps/extension/e2e/reconnect.spec.ts` (its malformed `fluxiq.queuedEvents` case: the persistent key is
  now never read and is removed at start; do not run Playwright, say it is unrun).
- Required reads: this report's Facts and Queue semantics; the files named.
- Owns: `background/storage.ts`, `background/saved-state.ts`, `background/index.ts`, `background/connection.ts`,
  `background/connection/gateway-session.ts`, new `background/connection/outbox-store.ts`, the connection
  barrel line for it, their tests, `e2e/reconnect.spec.ts`.
- Must not touch: `server-command-channel.ts`, `in-flight/**`, `host-lease/**`, `domain/**`, Core, L1's files.
- Done: `EXTENSION_TEST_BUILD_LABEL=lane-g-wd node apps/extension/scripts/test-extension.mjs <each test>`
  passes; `pnpm --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.json --noEmit` clean;
  `node scripts/structure-audit.mjs` clean for these files.
- Report to: `docs/working/extension-core-boundary-audit/reports/lane-g-wd-queue-privacy.md`.

## Progress log

### 2026-10-19 - Step 1: Core outbox, ledgers, storage area and session pick
- W-A added `src/outbox/` (7 files, 5 tests); W-B added `src/storage-area/`, `src/reconcile/`,
  `src/host-lease/`, `src/session-pick/`. Lead reviewed every source file and added the package barrel lines
  (plus `ClientGatewayHostLease`, `ClientGatewayReconcileAnswer`, `CLIENT_GATEWAY_HOST_LEASE_REFUSAL_CODES`
  re-exports).
- `npx vitest run` in `packages/client-gateway-websocket`: 19 files, 111 tests passed.
  `npx tsc --noEmit -p tsconfig.json`: exit 0. `node scripts/structure-audit.mjs`: "passed (407 warning(s),
  1152 baselined)", none in the package. `pnpm --filter @fluxiq/client-gateway-websocket build`: built.

### 2026-10-19 - Step 2a: Unit 1, the offline queue privacy fix (W-D, verified by the lead)
- Extension queue moved onto Core's `ClientGatewayOutbox`, stored under `fluxiq.outbox` in
  `chrome.storage.session` (worker memory without it) through `background/connection/outbox/store.ts`
  (placed in its own directory because `connection/` and `connection/tests/` are at the 25-file cap);
  `storage.ts` lost the local-storage queue and gained `discardPersistentQueue()`, called at every
  background start; `saved-state.ts` `readSavedOutbox` repairs a malformed queue; `gateway-session.ts`
  decides the trust lineage on `session_ready` before `onSessionReady`, binds offline sends, flushes by
  binding, and answers `queuedActionResult` from the current lineage; `connection.ts` supplies the
  project and recording context; `e2e/reconnect.spec.ts` expects the old key removed (not run).
- Lead fixed `connection/host-lease/tests/gateway-carriage.test.ts` (it still passed the removed `queue`
  dep; outside W-D's files) and added the offline-queue paragraph to `docs/architecture/extension-client.md`
  "Staying Connected".
- `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` in `apps/extension`: exit 0.
  `EXTENSION_TEST_BUILD_LABEL=lane-g node apps/extension/scripts/test-extension.mjs` on gateway-session,
  host-lease, in-flight, saved-state, storage, outbox, server-command-channel, connection-status,
  reconnect-watchdog: 83 tests, 83 pass. `node scripts/structure-audit.mjs`: "passed (215 warning(s), 638
  baselined)"; the two new warnings are advisory (GatewaySession 28 methods, its test 432 lines).
- Risk recorded: `chrome.storage.session` holds about 10 MB, so 1,000 large snapshots could fill it and
  make an offline send throw; the count cap may need a byte cap too (not changed; outside the brief).

UNIT READY (Unit 1): Core `packages/client-gateway-websocket/src/{index.ts,outbox/**,storage-area/**,reconcile/**,host-lease/**,session-pick/**}`
(not `src/connection/`); downstream `apps/extension/e2e/reconnect.spec.ts`,
`apps/extension/src/background/{storage.ts,saved-state.ts,index.ts,connection.ts}`,
`apps/extension/src/background/connection/{gateway-session.ts,index.ts,outbox/**}`,
`apps/extension/src/background/connection/tests/gateway-session.test.ts`,
`apps/extension/src/background/connection/host-lease/tests/gateway-carriage.test.ts`,
`apps/extension/src/background/tests/{saved-state.test.ts,storage-queue-discard.test.ts}`,
`docs/architecture/extension-client.md`, and this lane's reports under
`docs/working/extension-core-boundary-audit/reports/lane-g*.md`.

### 2026-10-19 - Step 2b: Core connection (W-C, verified by the lead)
- `src/connection/` (types, reconnect delay, open-failure wording, `FluxIQClientGatewayConnection`, fake
  socket and harness under `tests/`). Reviewed line by line. Two deliberate changes from downstream: late
  events from a superseded socket are ignored (downstream let a late close drop the live client), and a
  queued message no longer carries a `sessionId` (nothing read it). Lead changed `refreshQueueSize` to
  publish status only when the size changed (as the extension does; the background refreshes on every
  status read), with a test, and added `connection/index.ts` to the package barrel.
- `npx vitest run` (package): 22 files, 150 tests passed. `npx tsc --noEmit -p tsconfig.json`: 0.
  Structure audit: "passed (409 warning(s), 1152 baselined)"; two advisory warnings in the package
  (connection class 32 methods, its test 422 lines). Core package rebuilt.
- Lead edited `apps/extension/src/shared/protocol.ts`: `ConnectionState` is Core's
  `ClientGatewayConnectionState`; command leases are Core's `ClientGatewayHostLease` (the domain's
  `WebAutomationHostLease` is no longer imported there). `npx tsc -p tsconfig.json --noEmit`: 0.

### 2026-10-19 - Supervisor: outbox byte budget (its own unit)
- Directed: a byte budget beside the count cap in Core's outbox, the extension supplying its storage
  quota; either exceeded drops the oldest entries and records the loss as a counted, closed marker the
  flush reports; a storage write failure degrades to the same path instead of throwing.
- Design: Core's gateway files a `client.error` as an audit record and as a marker entry in the active
  recording (`bridge.ts`), so the flush sends the loss to Core as one `client.error`
  (`code: "client.outbox.entries_lost"`, counts per closed reason, no page data) before the surviving
  entries, and the connection tells the host (`onQueueLoss`).

### Brief: lane-g-wg-outbox-budget
- Repository: FluxIQ Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t726/!FluxIQ`.
- Task: give `packages/client-gateway-websocket/src/outbox/` a byte budget and an explicit loss record.
  - `loss-reasons.ts` `CLIENT_GATEWAY_OUTBOX_LOSS_REASONS = ["count_limit", "byte_budget", "write_failed"]`;
    `types.ts` gains `ClientGatewayOutboxLossReason`, `ClientGatewayOutboxLoss { count; byReason:
    Partial<Record<reason, number>> }`, `ClientGatewayOutboxEntry.bytes?: number` and
    `ClientGatewayOutboxState.lost?: ClientGatewayOutboxLoss`.
  - `ClientGatewayOutbox(store, { limit = 1000, byteBudget = Infinity, measure? })`; default measure is the
    UTF-8 length of the entry's JSON (`TextEncoder`), taken once at enqueue and kept in `bytes` (an entry
    read without it is measured then). Enqueue keeps the newest within both limits, dropping the oldest
    and counting each by reason; an entry alone over the budget is never stored (counted `byte_budget`).
  - A store write that throws during enqueue never throws out: drop the oldest half of the remaining
    entries (counted `write_failed`) and retry, down to none; a loss that could not be written is held in
    memory and merged into the next write. The order of what is kept never changes.
  - `flush` returns `{ delivered, dropped, lost }`: when a loss is recorded it first sends one
    `client.error` built with `createClientGatewayMessage` (`code "client.outbox.entries_lost"`, a plain
    message naming the count, `metadata` the count and per-reason counts, nothing else), then the
    deliverable entries; the loss is cleared only once that marker was sent. `lost()` reads it.
  - `src/connection/`: `handlers.onQueueLoss?(loss)` called after a flush that reported one; the
    connection's public API is otherwise unchanged.
- Tests first (vitest, `outbox/tests/`, `connection/tests/`): byte budget exceeded (oldest dropped, order
  kept, loss counted), oversize entry, count limit counted, write throws (no throw, degraded, order kept,
  `write_failed` counted, loss held and written later), flush sends the marker first and clears it, a
  failed marker send keeps loss and entries, `onQueueLoss` called.
- Owns: `packages/client-gateway-websocket/src/outbox/**`, `src/connection/**`.
- Must not touch: other package directories, `src/index.ts`, the downstream tree.
- Done: package `npx vitest run` passes; `npx tsc --noEmit -p tsconfig.json` 0; structure audit clean for
  these files; then `pnpm --filter @fluxiq/client-gateway-websocket build`.
- Report to: downstream `docs/working/extension-core-boundary-audit/reports/lane-g-wg-outbox-budget.md`.

### Brief: lane-g-wf-ledgers-and-pick-downstream
- Repository: downstream worktree `C:/Users/osrs_/FluxStuff/fxwork/t726/!FluxIQWebExtension`.
- Task: switch reconciliation, lease fencing and session picking to Core's (built in the linked
  `@fluxiq/client-gateway-websocket`), deleting the downstream copies with every caller switched.
  - `background/connection/in-flight/`: delete `command-reconciliation.ts`, `record-store.ts`,
    `seen-store.ts` and their moved tests; add `web-reconciliation.ts` building Core's
    `ClientGatewayCommandReconciliation` over Core's record and seen stores with the domain's
    `webAutomationActionCommits`, `webAutomationInterruptedActionResult` and a new domain
    `webAutomationNotSeenActionResult(commandId, at)` (moved from the extension's private `notSeenResult`);
    `record-area.ts` returns `ClientGatewayStorageArea`, falling back to Core's `clientGatewayMemoryArea()`.
  - `background/connection/host-lease/`: delete `ledger.ts` and `tests/ledger.test.ts`; keep a small
    extension factory for Core's `ClientGatewayHostLeaseLedger` over the session area so the directory's
    existing tests keep a subject; switch those tests to Core's `ClientGatewayHostLease`.
  - `server-command-channel.ts`: Core types; `begin({ commandId, actionType, parameters: options }, place)`;
    `noteDispatch` computes `{ tabId, documentId }` (`frameDocumentId`) and calls `placed`.
  - `domain/src/client/`: delete `host-lease.ts`, `tests/host-lease.test.ts`, `reconcile/answer.ts`; keep
    `reconcile/tests/answer.test.ts`'s non-answer assertions under a test named for their subject; add
    `reconcile/not-seen-result.ts` with its test; barrels updated.
  - Session pick: `domain/src/runtime/web-sessions/` defines the web criteria once (extension client type,
    `web.actions` serving this domain or offering `web.dom.capture_snapshot`); `isEligibleWebSession`
    delegates to Core's `clientGatewaySessionEligible`; a `pickWebAutomationSession` uses
    `pickClientGatewaySession`; `runtime/adapter.ts`, `io/gateway-output-dispatcher.ts` and
    `runtime/host-resources/leasable-session.ts` call it. Tests for the rule change beside them: an unpaired
    or recording second session no longer blocks or is picked, a requested id only when eligible.
- Required reads: this report's Facts; Core `src/reconcile`, `src/host-lease`, `src/session-pick`,
  `src/storage-area`; the files named.
- Owns: the files named above, their barrels and tests.
- Must not touch: `gateway-session.ts`, `connection.ts`, `connection/outbox/**`, `storage.ts`,
  `saved-state.ts`, `background/index.ts`, `shared/protocol.ts`, Core, L1's files
  (`git -C C:/Users/osrs_/FluxStuff/fxwork/t724/!FluxIQWebExtension status --short`).
- Done: `EXTENSION_TEST_BUILD_LABEL=lane-g-wf node apps/extension/scripts/test-extension.mjs` on in-flight,
  host-lease and server-command-channel, and `DOMAIN_TEST_BUILD_LABEL=lane-g-wf node domain/scripts/test-domain.mjs`
  on client, web-sessions, host-resources, runtime/tests/adapter and io/tests/gateway-output-dispatcher
  pass; extension `tsc -p tsconfig.json` and `-p tsconfig.test.json`, domain `tsc -p tsconfig.json` and
  `-p tsconfig.test.json` clean; `node scripts/structure-audit.mjs` clean for these files.
- Report to: `docs/working/extension-core-boundary-audit/reports/lane-g-wf-ledgers-and-pick-downstream.md`.

### 2026-10-19 - Step 3a: outbox byte budget (W-G, lead) and downstream ledgers and session pick (W-F)
- W-G (Core): `outbox/` gained the byte budget (`byteBudget`, entry `bytes` measured once as UTF-8 JSON),
  the closed loss record (`loss/`: `count_limit`, `byte_budget`, `write_failed`), write-failure
  degradation (oldest half dropped and retried, a loss that could not be written held in memory) and the
  flush's loss marker (`client.error`, `code: "client.outbox.entries_lost"`, counts only, sent first and
  cleared once sent); `connection/` calls `handlers.onQueueLoss`. Lead reviewed every line.
  `npx vitest run` (package): 178 tests passed; `npx tsc --noEmit -p tsconfig.json`: 0; structure audit
  "passed (409 warning(s), 1152 baselined)" (package warnings unchanged); package rebuilt by W-G.
- Lead, extension half of the budget: `connection/outbox/byte-budget.ts` (four fifths of
  `chrome.storage.session.QUOTA_BYTES`, 10 MB assumed when unnamed) passed by `connection.ts`;
  `saved-state.ts` `readSavedOutbox` now keeps the loss record (counts under Core's reasons, recounted;
  malformed repaired and noted) and drops a recorded size that is not a byte count (W-G found the reader
  discarded `lost`, so the marker would never have been sent); `gateway-session.ts` hands a flushed loss to
  `onQueueLoss`, which `connection.ts` shows as a warning in the activity log. Tests: byte budget,
  saved-state loss and size, a flush that sends the marker before the queued messages.
- W-F (downstream): `in-flight/` keeps `record-area.ts` (Core memory area fallback), `frame-document.ts`
  and a new `web-reconciliation.ts` over Core's reconciliation; `host-lease/session-ledger.ts` builds Core's
  ledger over the session area; `server-command-channel.ts` uses Core's types, `begin(..., { tabId })` and
  `placed({ tabId, documentId })`; deleted the downstream reconciliation, record and seen stores, the
  extension ledger, domain `client/host-lease.ts` and `client/reconcile/answer.ts` (with their moved tests);
  added domain `client/reconcile/not-seen-result.ts`; `runtime/web-sessions/` defines the web criteria
  once and `pickWebAutomationSession` on Core's pick, used by the adapter, the output dispatcher and the
  host-resource lease. Lead updated `docs/architecture/extension-client.md` for the budget, the loss
  marker and the moved ledgers.
- Lead's checks on the combined tree: domain `tsc -p tsconfig.json` 0 and `-p tsconfig.test.json` 0;
  extension `tsc -p tsconfig.json` 0 and `-p tsconfig.test.json` 0;
  `DOMAIN_TEST_BUILD_LABEL=lane-g node domain/scripts/test-domain.mjs client/ web-sessions host-resources
  runtime/tests/adapter io/tests/gateway-output-dispatcher llm-evidence/tests/tools`: 181 pass, 0 fail;
  `EXTENSION_TEST_BUILD_LABEL=lane-g node apps/extension/scripts/test-extension.mjs` on gateway-session,
  outbox, saved-state, storage, in-flight, host-lease, server-command-channel, connection-status: 77 pass,
  0 fail; `node scripts/structure-audit.mjs`: "passed (215 warning(s), 638 baselined)".
- Correction to the Unit 1 block above: nothing had been committed when the budget landed, and the budget
  changed the same files, so Unit 1 and the budget are one commit now; and Core `src/index.ts` exports
  `src/connection/`, so the Core paths must include it. The blocks below supersede the earlier one.

UNIT READY (Unit 1, offline queue privacy fix with byte budget; supersedes the earlier Unit 1 block):
Core `packages/client-gateway-websocket/src/{index.ts,outbox/**,storage-area/**,reconcile/**,host-lease/**,session-pick/**,connection/**}`;
downstream `apps/extension/e2e/reconnect.spec.ts`,
`apps/extension/src/background/{storage.ts,saved-state.ts,index.ts,connection.ts}`,
`apps/extension/src/background/connection/{gateway-session.ts,index.ts,outbox/**}`,
`apps/extension/src/background/connection/tests/gateway-session.test.ts`,
`apps/extension/src/background/connection/host-lease/tests/gateway-carriage.test.ts`,
`apps/extension/src/background/tests/{saved-state.test.ts,storage-queue-discard.test.ts}`,
`docs/working/extension-core-boundary-audit/reports/lane-g*.md`.

UNIT READY (Unit 2a, reconciliation, lease fencing and session pick on Core; commit after Unit 1):
downstream `apps/extension/src/shared/protocol.ts`,
`apps/extension/src/background/connection/server-command-channel.ts`,
`apps/extension/src/background/connection/in-flight/**` (including deletions),
`apps/extension/src/background/connection/host-lease/**` except `tests/gateway-carriage.test.ts` (including deletions),
`domain/src/client/**` (including deletions), `domain/src/runtime/web-sessions/**`,
`domain/src/runtime/host-resources/{leasable-session.ts,tests/leasable-session.test.ts}`,
`domain/src/runtime/adapter.ts`, `domain/src/runtime/tests/adapter*.test.ts`,
`domain/src/io/gateway-output-dispatcher.ts`, `domain/src/io/tests/gateway-output-dispatcher*.test.ts`,
`docs/architecture/extension-client.md` (it also documents Unit 1's queue and budget).

### Brief: lane-g-we-gateway-adapter
- Repository: downstream worktree `C:/Users/osrs_/FluxStuff/fxwork/t726/!FluxIQWebExtension`.
- Task: Unit 2b. `background/connection/gateway-session.ts` becomes the web adapter over Core's
  `FluxIQClientGatewayConnection` (built in the linked `@fluxiq/client-gateway-websocket`; read its
  `src/connection/`). Core owns the socket, state, backoff, heartbeat, keep-alive ticks, lineage, outbox
  binding, flush, loss hand-off and open-failure wording; delete every downstream copy of those. The adapter
  keeps only: the hello (browser descriptor, capabilities, domain id, capture settings), token persistence
  through `persistSession` (today's compaction on write and clear), the `execute_action` mapping (fact
  check, browser action, rejection results, `withLease`) and the recording and snapshot commands through
  `connection.on(...)`, and the timing constants from `shared/constants.ts`. Keep `GatewaySession`'s public
  methods so `connection.ts`, `server-command-channel.ts` and the rest need no change (a subclass of Core's
  class, or composition, whichever deletes more and reads cleaner; say which and why).
- Tests: keep the adapter's own tests (hello contents, token persistence, command mapping, lease carriage
  in `host-lease/tests/gateway-carriage.test.ts`, one offline-send-then-flush test proving the queue context
  wiring, one loss hand-off test); drop tests whose subject moved to Core (Core's
  `src/connection/tests/` covers them; name each dropped test and its Core counterpart in the report).
- Required reads: this report's Facts and Queue semantics; Core `src/connection/`; the files named.
- Owns: `gateway-session.ts`, `connection/tests/gateway-session.test.ts`,
  `connection/host-lease/tests/gateway-carriage.test.ts`, `background/connection.ts`, `connection/index.ts`,
  `shared/constants.ts`.
- Must not touch: `server-command-channel.ts`, `in-flight/**`, `host-lease/` sources, `outbox/**`,
  `saved-state.ts`, `storage.ts`, `domain/**`, Core, `apps/extension/e2e/**`, L1's files.
- Done: extension `npx tsc -p tsconfig.json --noEmit` and `-p tsconfig.test.json` 0;
  `EXTENSION_TEST_BUILD_LABEL=lane-g-we node apps/extension/scripts/test-extension.mjs` on gateway-session,
  host-lease, in-flight, server-command-channel, outbox, connection-status, reconnect-watchdog passes;
  `node scripts/structure-audit.mjs` passes with no new warning for these files.
- Report to: `docs/working/extension-core-boundary-audit/reports/lane-g-we-gateway-adapter.md`.

### Brief: lane-g-wh-core-docs
- Repository: FluxIQ Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t726/!FluxIQ`.
- Task: document what `@fluxiq/client-gateway-websocket` now owns: the reconnecting connection
  (`src/connection/`: states, backoff, heartbeat and keep-alive, `on` across sockets, open-failure
  wording), the outbox (`src/outbox/`: trust lineage and why it is not the wire `sessionId`, binding, flush
  rule, count cap, byte budget, loss record and its `client.error` marker, write-failure degradation, the
  host-supplied store), the client half of reconciliation (`src/reconcile/`), host-lease fencing
  (`src/host-lease/`), the storage-area port and the one session-picking rule (`src/session-pick/`), each
  with the downstream web extension named only as one host. Current state, not history.
- Files: `packages/client-gateway-websocket/README.md` (a short usage section per capability);
  `docs/architecture/automation-studio/client-gateway.md` (a "Client half" section, and correct anything
  there that says the client package is a thin transport); `docs/architecture/package-boundaries.md` only if
  it describes the package's contents.
- Required reads: the package's `src/**` (not tests), those three documents, this report's Facts and
  Queue semantics.
- Owns: those three files only. Must not touch: any source, `docs/working/**`, the downstream tree.
- Done: the documents match the source (spot-check every name you write against `src/`);
  `node scripts/structure-audit.mjs` still passes.
- Report to: downstream `docs/working/extension-core-boundary-audit/reports/lane-g-wh-core-docs.md`.

### Brief: lane-g-wi-browser-exercise
- Repository: downstream worktree `C:/Users/osrs_/FluxStuff/fxwork/t726/!FluxIQWebExtension`.
- Task: a headed Playwright spec that exercises the real built extension against a stand-in gateway on
  loopback and the everything-store realistic scenario (Scenario Lab), provider-free, modelled on
  `apps/extension/e2e/lease/tests/stale-holder.spec.ts` and `e2e/reconnect.spec.ts`. In one session:
  connect (hello with token answered by `server.session_ready`); a leased command types into the store's
  search box; the gateway starts a recording and the page is used so recording events arrive; drop the
  socket, use the page again so events are queued; the extension reconnects by token and the queued events
  arrive in order; drop again, use the page, and reconnect through `server.pairing_required` then
  `server.session_ready`: the events queued under the old trust never arrive; lease takeover: a higher
  epoch for another holder is adopted and the old holder's late command is refused with
  `host_lease.stale`, the page untouched. Oracles: the page and what the gateway received. No typed values
  or tokens in assertions' messages or logs beyond synthetic fixtures.
- Build with `pnpm --filter @fluxiq-web-extension/extension test:e2e:build` and run only this spec with
  `pnpm --filter @fluxiq-web-extension/extension exec playwright test -c e2e/playwright.config.ts <spec>`.
  Another worker is editing `background/connection/gateway-session.ts` at the same time: if the build fails
  inside that file, wait a minute and build again; never edit it.
- Required reads: the two specs named, `e2e/fixtures/extension-context.ts`, this report's Queue semantics.
- Owns: one new spec file under `apps/extension/e2e/` (your choice of place, following the e2e tree's
  layout) and any stand-in gateway helper beside it in a `tests/` folder.
- Must not touch: anything under `apps/extension/src/`, `domain/`, Core, other specs.
- Done: the spec passes headed against the build; report each step exercised and its observed evidence,
  and what was not exercised.
- Report to: `docs/working/extension-core-boundary-audit/reports/lane-g-wi-browser-exercise.md`.

### 2026-10-19 - Supervisor committed Units 1 and 2a
- Core `3ccb50b2`, downstream `bca31a06` (one commit each side; they share files and only the combined tree
  was verified). W-E was held until then so no half-edited file could be snapshotted.

### 2026-10-19 - Step 3b: Core docs (W-H), pairing gate (lead), gateway adapter (W-E), browser exercise (W-I)
- W-H: Core `packages/client-gateway-websocket/README.md` (a usage section per part),
  `docs/architecture/automation-studio/client-gateway.md` (new "Client half" section; two places that
  called the package a thin transport corrected), `docs/architecture/package-boundaries.md` (one table row).
  Lead read the new section against the source. Structure audit passed.
- Lead, Core: W-I and W-C both observed that a socket still pairing (or whose token the gateway is
  checking) carried client data, because the transport counts an open socket as connected. An unapproved
  session must not receive client data, so `FluxIQClientGatewayConnection.send` now writes to the socket
  only after that socket's `server.session_ready` (lineage decided); before it, a message is queued, and a
  pairing reconnect then drops it with the old lineage. Test first; reverting the gate turns it red
  (`vitest run src/connection -t "still pairing"`: 1 failed), with the gate the package passes:
  `npx vitest run` 27 files, 179 tests passed; `npx tsc --noEmit -p tsconfig.json` 0; Core structure audit
  "passed (410 warning(s), 1152 baselined)"; the package's three warnings are advisory (connection class 32
  methods, `connection.ts` 407 lines, its test 439 lines). One sentence added to `client-gateway.md`.
  Package rebuilt.
- W-E: `gateway-session.ts` is now a subclass of Core's `FluxIQClientGatewayConnection` (488 to 201 lines):
  hello, token persistence through `persistSession`, timing constants and the command mapping
  (`connection.on(...)`, fact checks, rejections, `withLease`); every downstream copy of backoff,
  heartbeat, lineage, flush and open-failure wording deleted. Test file rewritten: 19 tests whose subject
  moved to Core dropped (each mapped to its Core counterpart in the W-E report), 9 adapter tests kept or
  added, including one pinning queue-before-ready. `connection.ts`, `connection/index.ts`,
  `shared/constants.ts` and the carriage test needed no change. Lead reviewed the file line by line and
  updated `docs/architecture/extension-client.md` "Staying Connected" (Core owns the socket; the adapter's
  half; nothing crosses before `session_ready`; the new spec).
- W-I: new headed spec `apps/extension/e2e/gateway-session/tests/queue-across-reconnects.spec.ts` with its
  stand-in gateway helper and the directory barrel; everything-store scenario, provider-free.
- Lead's checks on the final tree: extension `npx tsc -p tsconfig.json --noEmit` 0 and
  `-p tsconfig.test.json` 0; `EXTENSION_TEST_BUILD_LABEL=lane-g node apps/extension/scripts/test-extension.mjs`
  on gateway-session, host-lease, in-flight, server-command-channel, outbox, connection-status,
  reconnect-watchdog, saved-state, storage: 72 pass, 0 fail; `node scripts/structure-audit.mjs`: "passed
  (212 warning(s), 636 baselined)" (three fewer warnings; the supervisor may run `pnpm structure:baseline`).
  `pnpm --filter @fluxiq-web-extension/extension test:e2e:build`: built (Chrome, Firefox, e2e-chromium).
  `npx playwright test -c e2e/playwright.config.ts e2e/gateway-session/tests/queue-across-reconnects.spec.ts
  e2e/lease/tests/stale-holder.spec.ts e2e/reconnect.spec.ts --workers=1`, headed: 5 passed (2.1 min).

### Browser exercise: what was and was not exercised (final build, Chromium, headed)
- Exercised, observed in the spec's evidence line: connect by token (`server.session_ready`); a leased
  command typed into the store's search box; a gateway-started recording with live events; drop with the
  gateway refusing upgrades (3 refused while down); 19 entries queued while down (recording events and
  snapshots) all arrived in queue order on the token reconnect; second drop, 23 entries queued, reconnect
  through `server.pairing_required` then `server.session_ready`: none of the 11 old-trust events and no
  snapshot arrived, while the page's next events did; lease takeover by a higher epoch for another holder
  succeeded and the old holder's late epoch-5 command was refused `host_lease.stale` with the page
  unchanged. The stale-holder spec and `reconnect.spec.ts` (worker restart, dropped socket, alarm, saved
  state repair with the persistent queue key removed) also pass.
- Not exercised in a browser: Firefox and Edge; a service-worker restart with entries queued; the project
  and recording drop rules, the count cap, the byte budget and loss marker, a send failing mid-flush, and
  `queuedActionResult` (all covered by Core and extension unit tests only); a real Core gateway (stand-in
  gateway only).
- Start marker (corrected 2026-10-19 after `g-recording-start-marker.md`): by design it crosses as a
  `client.state_update` (`reason: "recording-evidence"`, `clientKind: "browser.tab"`,
  `recordingState: "started"`, the recording's id), never as a `client.recording_event`: it is passive
  evidence, not an executable input. The spec looked only at recording events. It now asserts the state
  update arrives once and that no recording event carries the marker.

UNIT READY (Unit 2b, the gateway client on Core, docs and browser proof):
Core `packages/client-gateway-websocket/src/connection/{connection.ts,tests/connection.test.ts}`,
`packages/client-gateway-websocket/README.md`, `docs/architecture/automation-studio/client-gateway.md`,
`docs/architecture/package-boundaries.md`;
downstream `apps/extension/src/background/connection/gateway-session.ts`,
`apps/extension/src/background/connection/tests/gateway-session.test.ts`,
`apps/extension/e2e/gateway-session/**`, `docs/architecture/extension-client.md`,
`docs/working/extension-core-boundary-audit/reports/lane-g*.md`. Core package dist rebuilt; downstream
narrow checks and the three headed specs above pass on this tree.

### 2026-10-19 - Supervisor: headed specs flaky on rerun; investigation
Directed: run each spec at least 5 times with step-level capture; compare `reconnect.spec.ts` with the
pre-lane-G tree `fxwork/sweep-1019b` (downstream `cedd46af`, read-only); fix the root cause in lane G's files
without raising waits or loosening assertions; prove it with 5 consecutive green runs; assert the start
marker; correct the observation; run `pnpm structure:baseline`.

Method: `scratchpad/flake/run-batch.sh` runs the specs with the config's workers unless stated, list and
JSON reporters, artifacts in the scratchpad (nothing written into either tree); `failures.mjs` names each
failure's step and error. Command per run:
`NODE_OPTIONS=--no-experimental-strip-types npx playwright test -c e2e/playwright.config.ts <specs> --reporter=list,json --output <scratch>`.

Before OneDrive was restarted (low virtual memory):
- Windows logged "low virtual memory condition" (Resource-Exhaustion-Detector, event 2004) at 19:16:17,
  19:21:31, 19:26:21, 19:33:11, 19:43:10 and 19:44:25, naming `OneDrive.Sync.Service.exe` (pid 32000) at
  15.6-16.0 GB each time. The supervisor's run D artifacts are stamped 19:21-19:22.
- Three runs of all three specs (19:31-19:41): run 1 exit 127 with no output; run 2 every test lost, the
  Playwright workers dying with "Fatal process out of memory: Zone" (exit 0x80000003, 0xC0000409) and the
  queue spec's fixture `page.goto` aborting (`net::ERR_ABORTED; maybe frame was detached?`, the run D
  error); run 3 the queue spec timed out at 240 s with its store page blank. The supervisor rules these out.
- `reconnect.spec.ts`, interleaved, 5 runs each: pre-lane-G 3 green, 2 red (run 3 out of memory at
  19:44:29; run 4 `:85` "a restarted worker reconnects": no hello within 15 s, the run A error); lane G
  5 green.

After the restart (about 19:50; commit free 13.2-13.4 GB, but CPU at 99.9-100% and 1,800-2,400 pages/s
from the other lanes, 29 Chrome processes not mine):
- Five runs of all three specs, config workers: run 1 red, 2 green, 3 red, 4 green, 5 red. Every failure is the same pair, `reconnect.spec.ts:85` and `:122`, "Tearing down
  `extensionSession` exceeded the test timeout of 30000ms". `queue-across-reconnects.spec.ts` (with the new
  start-marker assertion), `stale-holder.spec.ts` and `reconnect.spec.ts:141` passed all 5.
- Every test ran 2-5 times slower than before 19:50 (stale-holder 49-78 s, was 13-17 s; `:141` 59-105 s,
  was 33-41 s); in run 2 the queue spec's steps add up to 57 s of its 134 s. The trace of a failing `:85`:
  launch (Before Hooks) 8.2 s, body 3 s, teardown (After Hooks) over 30 s. The two failing tests are the two
  with the default 30 s budget; the others carry 120-240 s and absorb the same slow teardown.
- `reconnect.spec.ts`, interleaved, 5 runs each: pre-lane-G 3 green (`:122` teardown timeout in run 1,
  `:85` in run 5); lane G 3 green (`:85` and `:122` teardown timeouts in runs 1 and 5). Same failure, both
  trees; green totals overlap (pre-G 43-48 s, G 47-54 s; before 19:50 G was the faster one).
- Tracing is not it: interleaved `--trace off` and default (retain-on-failure) pairs fail the same way
  (`trace-off-2`: `:85` and `:122` teardown timeouts; `trace-on-3`: `:85`).
- Teardown parts measured outside the runner (`teardown-probe.mjs`, 8 launches per tree, with and without
  the CDP worker restart): launch 0.5-1.2 s, `context.close()` 0.4-2.1 s, profile removal about 25 ms, the
  same for both builds. With `DEBUG=pw:api` inside a loaded run, one `context.close()` took 13 s.
- The other `:85` mode (no hello within 15 s after the worker restart) recurred once in a `DEBUG=pw:api`
  run on lane G (every call took milliseconds; the panel showed "Connecting to FluxIQ..."). It did not
  reproduce in isolation: `restart-probe.mjs` 25 restarts, a new worker started every time;
  `hello-probe.mjs` three parallel browsers, 36 restarts, hello within 0-1.6 s every time. It is the same
  failure the pre-lane-G tree showed at 19:45.
- The side-panel polling race named earlier is ruled out: `AutoConnect` connects only from `disconnected`
  or `error`, and the connection moves from `error` to `reconnecting` synchronously; the queue spec's
  evidence shows exactly one accepted socket per phase.

Verdict: lane G introduced no flake. The two failure modes are in `reconnect.spec.ts`'s shared e2e fixture
(`e2e/fixtures/extension-context.ts`, not lane G's): (1) teardown (browser close plus profile removal) that
takes over 30 s when the machine is saturated, inside a 30 s per-test budget; (2) an intermittent missing
hello after a CDP worker restart. Both reproduce on the pre-lane-G tree at a similar rate, so there is no
root cause in lane G's files to fix. Raising the 30 s budget would mean raising a wait, so I did not do it.
The five consecutive green runs were not achieved: post-restart the lane G specs (queue-across-reconnects,
stale-holder) and `:141` were green 5 of 5, and `:85` and `:122` failed in 3 of 5, as they do before lane G.
Decision for the supervisor: give `reconnect.spec.ts:85` and `:122` an explicit budget that covers
browser launch and close (as `:141` already has), run headed e2e with fewer workers while lanes are busy,
or have the fixture's owner investigate the slow close and the missing hello.

Done as directed: the queue spec asserts the start marker (`client.state_update`, `reason:
"recording-evidence"`, `clientKind: "browser.tab"`, `recordingState: "started"`, the recording id, once;
no recording event carries it) and passed in all 5 post-restart runs; the start-marker observation is
corrected here and in `lane-g-wi-browser-exercise.md`; `pnpm structure:baseline` removed the 2 entries
lane G cleared (`as-never` in `gateway-session.ts`, `statement-packing` in its test; "636 entries across 9
rules (0 lowered, 2 removed)"). `npx tsc -p tsconfig.test.json --noEmit` (covers `e2e/`): 0;
`node scripts/structure-audit.mjs`: "passed (212 warning(s), 636 baselined)".

UNIT READY (Unit 2b, refreshed; supersedes the Unit 2b block above): Core
`packages/client-gateway-websocket/src/connection/{connection.ts,tests/connection.test.ts}`,
`packages/client-gateway-websocket/README.md`, `docs/architecture/automation-studio/client-gateway.md`,
`docs/architecture/package-boundaries.md`; downstream `.structure-baseline.json`,
`apps/extension/src/background/connection/gateway-session.ts`,
`apps/extension/src/background/connection/tests/gateway-session.test.ts`, `apps/extension/e2e/gateway-session/**`,
`docs/architecture/extension-client.md`, `docs/working/extension-core-boundary-audit/reports/lane-g*.md`.
Not included: `g-recording-start-marker.md` (another agent's report; the supervisor's to place).
