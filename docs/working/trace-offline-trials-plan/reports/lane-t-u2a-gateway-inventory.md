# Lane T U2a: Client Gateway Inventory And Capture Boundary

Worker report for brief `lane-t-u2a-gateway-inventory` (trace P0 gate: "inventory complete and the capture
boundary written down as a decision"). Read-only in both repositories. The only file written is this one.

Path prefixes used below:

- `Core:` = `C:/Users/osrs_/FluxStuff/fxwork/t729/!FluxIQ/`
- `Ext:` = `C:/Users/osrs_/FluxStuff/fxwork/t729/!FluxIQWebExtension/`

Every claim cites `file:line`. Anything not confirmed by reading code is marked **unverified**.

## Outcome

Done. All five sections are written, with a recommended decision and open questions at the end.

## What changed and why

Nothing in either repository changed. This report is the brief's only output.

## Commands run and observed results

Read-only `sed`, `cat`, `grep`, `find` and `wc` over the files cited below. No build, test or audit was run
(the brief asked for an inventory, not a code change). No browser and no Lab run.

## Not verified

- Whether a live build (exploration, trials, judged run) ever opens a client recording session, which would put
  screenshots and recording evidence into a build's inputs. I found no build path that opens one but did not
  search exhaustively.
- Whether anything in Core calls `ClientGatewayService.sendPing` (only its definitions were found:
  `Core:packages/fluxiq/src/client-gateway/service.ts:215`, `service/commands.ts:229`).
- Whether any Core decision reads `session.lastSeenAt` (the only non-gateway reader found is a projection at
  `Core:packages/fluxiq/src/runtime/client-gateway-transport.ts:154`).
- Whether the object store ever deletes or garbage-collects state assets (it matters for pinning screenshot
  artifacts for a trace's lifetime).
- Whether `client.snapshot` replies to `server.capture_snapshot` carry the server message id anywhere in the
  payload. The command handler keys its status by `message.id`
  (`Ext:apps/extension/src/background/connection/server-command-channel.ts:192-209`), but I did not trace it
  into the emitted snapshot.

---

## 1. Inbound: everything Core accepts from a client

### 1.0 Intake path and validation (applies to every row)

- **Transport.** `Core:apps/web/src/server/client-gateway-websocket.ts` is a hand-written WebSocket server. Each
  complete text frame calls `gateway.receiveRaw(sessionId, text)` (`:140-145`). Frames go through
  `void this.handleFrame(frame)` (`:185`), so one socket's messages can be processed **concurrently**. Core's
  bridge relies on this and says so (`Core:packages/fluxiq/src/programs/automation-studio/client-gateway/bridge.ts:314-316`).
  A thrown receive is answered directly on the socket with `server.error` code `gateway.receive_failed`
  (`client-gateway-websocket.ts:143-144,297-305`). That message bypasses `ClientGatewayTransport`, so it is not
  in the outbound queue.
- **Decoder.** `ClientGatewayInbound.receiveRaw` runs `JSON.parse` and casts the result to
  `ClientGatewayClientMessage` (`Core:packages/fluxiq/src/client-gateway/service/inbound.ts:51-54`). Nothing
  checks the envelope or payload schema at intake. `receive()` dispatches on `message.type`
  (`inbound.ts:56-122`), and an unknown type is silently ignored (it falls through every `if`).
- **Field-level reads happen per consumer.** Examples: the action-result reading
  (`service/action-result-reading.ts:296-306`), the durable result allowlist (`service/command-ledger/dispatch.ts:206-216`),
  the reconcile answer reader (`service/command-reconcile/answer-reading.ts:12-19`), and the protocol-version
  verdict on hello (`inbound.ts:130-143`).
- **Readiness gate.** Every type except `client.hello` and `client.pairing_submit` is refused with
  `server.pairing_required` until the session is `ready` (`inbound.ts:68-71`). `sessions.touch` sets
  `lastSeenAt` on every message (`inbound.ts:58`, `service/sessions.ts:74-75`).
- **Envelope fields** (`Core:packages/contracts/src/client-gateway.ts:538-547`): `id`, `type`, `protocolVersion`,
  `timestamp`, `sessionId?`, `clientId?`, `correlationId?`, `payload`. Core reads the client-minted `id` and
  `timestamp` downstream, so they affect behaviour:
  - the bridge uses `message.id` as `clientGatewayMessageId` and `correlationId` (`bridge.ts:262,266,270,612,627,666`);
  - the domain input hub uses `id` as the IO envelope id and `timestamp` as `timestampMs` (`Ext:domain/src/io/gateway-input-hub.ts:41-46`).

  Neither side ever sets `correlationId`. No Core gateway or extension connection code writes it (grep over
  `Core:packages/fluxiq/src/client-gateway` and `Ext:apps/extension/src/background/connection`).
- **Event fan-out.** `ClientGatewayEventBus.emit` awaits every subscriber in parallel
  (`service/event-bus.ts:12-14`). The subscribers in a running host are:
  - `ClientGatewayRuntimeTransport` (`Core:packages/fluxiq/src/runtime/client-gateway-transport.ts:40-42,118-138`);
  - `AutomationStudioClientGatewayBridge` (`bridge.ts:108,218-237`);
  - `ClientGatewayDurableDispatch`, which subscribes only to `session.disconnected` (`dispatch.ts:41`);
  - the web domain's `GatewayInputHub` (`Ext:domain/src/io/gateway-input-hub.ts:13,26-51`).

  Late results go to `onLateActionResult` listeners (`Core:packages/fluxiq/src/programs/_shared/runtime.ts:92-94`).

### 1.1 WebSocket message table

Each type is described with the same fields: the fields it carries and their optional or null semantics; how it
is decoded or validated; what consumes it; how far it reaches; and whether it is persisted today.

#### `client.hello`

- **Fields** (`contracts client-gateway.ts:27-35`): `clientId?`, `clientType`, `name?`, `version?`, `token?`
  (a secret), `capabilities?`, `metadata?`. `metadata` is opaque; `metadata.domainId` is read by
  `service/declared-domain.ts`.
- **Omitted versus present matters.** `capabilities ?? session.capabilities`, and `metadata` is replaced only
  when it is not `undefined` (`service/lifecycle.ts:318-325`).
- **Decoder.** Protocol-version verdict (`inbound.ts:59-60,130-143`); a missing version is accepted with an
  audit entry.
- **Consumers.** `lifecycle.handleHello` → `resumeTrustedSession` (`lifecycle.ts:305-373`): token match,
  domain-binding check (`:344-353`), token rotation (`:354`), replacement of older sessions (`:355-359`),
  `server.session_ready`, then the `session.ready` event. Otherwise it creates a pairing and sends
  `server.pairing_required` (`:310-315`).
- **Reaches.** The runtime through `client.ready` (`client-gateway-transport.ts:120`) and through the session
  list that session selection reads (§4.2). It never reaches the evidence loop or a model directly.
- **Persisted.** The trusted-client store on token rotation
  (`service/trusted-clients.ts:108-129`; the store is `programs/_shared/runtime.ts:254-265`) and the audit log,
  which is in memory only (`service/audit-log.ts:6-27`).

#### `client.pairing_submit`

- **Fields.** `{ pairingCode }` (`contracts:552`). This path is deprecated.
- **Decoder.** None.
- **Consumers.** Always rejected with `server.error` (`inbound.ts:64-67`, `service/pairing-flow.ts:143-145`).
- **Reaches.** Nothing.
- **Persisted.** The audit log only.

#### `client.capabilities`

- **Fields.** `{ capabilities: ClientGatewayCapability[] }`. Each capability has `id`, `kind`, `label?`,
  `actionTypes?` and opaque `metadata?` (`contracts:19-25,553`).
- **Decoder.** None. The array replaces `session.capabilities` (`inbound.ts:72-75`), and no event is emitted.
- **Consumers.** Read later wherever sessions are selected or filtered:
  - runtime transport selection (`client-gateway-transport.ts:103-116,194-201`);
  - domain session filters (`Ext:domain/src/runtime/llm-evidence/tools.ts:715`, `Ext:domain/src/runtime/adapter.ts:167-175`);
  - activity targeting (`service/activity-publisher.ts:102-106`);
  - reconcile eligibility through `answersReconcile` (`service/command-reconcile/session-answers.ts:9-11`).
- **Reaches.** The runtime and the evidence loop's session choice, indirectly.
- **Persisted.** No. It lives in memory on the session.

#### `client.state_update`

- **Fields** (`contracts:37-43`): `activeContextId?`, `contexts?`, `state?`, `recording?`, `metadata?`.
  `metadata.inputId` and `metadata.domainId` are read.
- **Absent versus false matters.** `recording !== false` is checked at `bridge.ts:641`.
- **Decoder.** None. It is stored on `session.stateUpdate` (`inbound.ts:76-79`) and exposed through
  `snapshot().sessions`, because `toPublic` keeps it (`sessions.ts:79-82`).
- **Consumers.**
  - The runtime transport emits `state.update` (`client-gateway-transport.ts:122`).
  - The bridge's `appendStateUpdate` (`bridge.ts:637-671`) writes an IO input through `recordGatewayInput`
    (`:673-699`) or a recording observation.
  - The domain `GatewayInputHub` (`gateway-input-hub.ts:27-50`) feeds IO input listeners, which satisfy output
    confirmations (`Core:packages/fluxiq/src/programs/automation-studio/runtime/io-policy.ts:142-147`).
- **Reaches.** The runtime: confirmation inputs decide whether a dispatched output succeeded
  (`io-policy.ts:111,123`).
- **Persisted.** Only into a recording when one is open (`bridge.ts:638-643`). Otherwise it is discarded with an
  audit entry.

#### `client.start_recording`

- **Fields** (`contracts:57-69`): `recordingId`, `description?`, `projectId?: string | null`, `taskId?`,
  `startedAt?`, `domainId?: string | null`, `initialState?`, `environment?`, `sources?`, `actionChannels?`,
  `metadata?`.
- **Decoder.** The bridge checks the description is between 1 and 4000 characters (`bridge.ts:327-330`), then the
  project context (`:331-339`).
- **Consumers.** `startRecordingFromClient` → `automationStudio.createRecording`, acknowledged with
  `server.start_recording` (`bridge.ts:295-384`).
- **Reaches.** Recording evidence. Builds read recordings as evidence later (§3).
- **Persisted.** Yes, as the recording session.

#### `client.stop_recording`

- **Fields** (`contracts:71-75`): `recordingId`, `projectId?: string | null`, `endedAt?`.
- **Decoder.** None.
- **Consumers.** `stopRecordingFromClient`: drain, flush, `finalizeRecording` (`bridge.ts:392-414`). The inbound
  handler clears `activeRecordingId` (`inbound.ts:85-90`).
- **Reaches.** Recording evidence.
- **Persisted.** Yes (finalize).

#### `client.recording_entry`

- **Fields** (`contracts:77-81`): `recordingId`, `projectId?`, `entry` (opaque `JsonObject`).
- **Decoder.** None at the gateway. Entries are queued in arrival order (`bridge.ts:240-259`).
- **Consumers.** `appendRecordingEvents` (`bridge.ts:96`).
- **Reaches.** Recording evidence.
- **Persisted.** Yes, or discarded with an audit entry when no recording is open (`bridge.ts:249-251,521-552`).

#### `client.recording_event`

- **Fields** (`contracts:45-55`): `eventType`, `eventId?`, `recordingId?`, `domainId?`, `timestamp?`,
  `sourceId?`, `target?`, `payload?`, `metadata?` (opaque). `metadata` carries `inputId`, `domainId` and
  `runtimeConfirmation`.
- **Decoder.** None at the gateway. The domain manifest validates it on `appendRecordingDomainEvent`; a rejection
  comes back as `server.error recording.event_rejected` (`bridge.ts:445-468,471-490`).
- **Consumers.**
  - The runtime transport emits `recording.event` (`client-gateway-transport.ts:124`).
  - The bridge's `appendRecordingEvent` (`bridge.ts:416-469`).
  - The domain `GatewayInputHub` feeds IO listeners (`gateway-input-hub.ts:27-50`). The extension sends a
    runtime confirmation as a `recording_event` after every succeeded action
    (`Ext:apps/extension/src/background/connection/server-command-channel.ts:343-375`).
- **Reaches.** The runtime (output confirmation) and recording evidence.
- **Persisted.** Into the recording when one is open; otherwise discarded with an audit entry (`bridge.ts:421-429`).

#### `client.snapshot`

- **Fields** (`contracts:83-90`): `kind: "state" | "structured" | "image" | "binary" | "custom"`, `snapshotId?`,
  `timestamp?`, `state?`, `payload?`, `metadata?`.
- **Decoder.** None.
- **Consumers.** The runtime transport emits `snapshot` (`client-gateway-transport.ts:123`). The bridge's
  `appendSnapshot` writes an observation whose correlation is `snapshotId ?? message.id` (`bridge.ts:600-635`).
- **Reaches.** The runtime event stream and recording evidence.
- **Persisted.** Into the recording when one is open; otherwise discarded (`bridge.ts:602`).

#### `client.action_result`

- **Fields** (`contracts:154-171`): `commandId`, `status` (also `interrupted`), `startedAt?`, `completedAt?`,
  `message?`, `target?`, `payload?` (opaque; for the web domain it carries the page view and other evidence
  in-band), `error?`, `clearedWait?`, `failure?`, `metadata?`.
- **Decoder.**
  - `readClientGatewayActionResult` maps `interrupted` to `unknown` or `failed` (`action-result-reading.ts:296-306`).
  - Results for durable commands are `structuredClone`d (`inbound.ts:106`).
  - The durable path applies a strict key allowlist and type checks; an unknown key makes the result
    "suppressed" (`dispatch.ts:85-86,206-216`).
  - The non-durable runtime path keeps `failure` only when it parses and bounds `clearedWait`
    (`client-gateway-transport.ts:70-73,219-223`).
- **Consumers.** `commands.settle` (`commands.ts:120-131`) resolves the caller's promise, or goes to
  `durable.settle` (`dispatch.ts:74-93`) or `settleLate` (`commands.ts:215-223`). The callers are:
  - the bridge's `executeAction` and `appendActionResult` (`bridge.ts:202-216,701-726`);
  - the domain IO output dispatcher (`Ext:domain/src/io/gateway-output-dispatcher.ts:30-41`), which feeds the executor;
  - the domain evidence-loop tools (`Ext:domain/src/runtime/llm-evidence/tools.ts:708`,
    `capture.ts:541,696`, `node-run/retries/dispatch.ts:91`), which feed the evidence loop and the model.

  The event is then republished as a diagnostic only (`inbound.ts:110-112`; the runtime transport ignores it at
  `client-gateway-transport.ts:125-126`).
- **Reaches.** The runtime, the evidence loop and the model. This is the main data channel.
- **Persisted.**
  - Durable commands: a receipt with digests only (`redaction: "receipt_only"`, `dispatch.ts:89`) in the
    command ledger.
  - Late results: run evidence through `AutomationStudioLateActionResults`
    (`programs/automation-studio/runtime/service.ts:413`, `programs/_shared/runtime.ts:92-94`), with no
    payload (`command-history.ts:27-31`).
  - RuntimeService path: the command attempt, with withholding, in `FileRuntimeStore`
    (`Core:packages/fluxiq/src/runtime/service.ts:288-297`, `runtime/storage.ts:43-52`).
  - Recording: an action entry when a recording is open (`bridge.ts:701-726`).
  - The full result payload is **not** persisted at the gateway.

#### `client.reconcile_result`

- **Fields** (`contracts:202-206`): `commandId`, `state: landed | not_seen | running | unknown`, and `result?`
  (on `landed` only).
- **Decoder.** `readClientGatewayReconcileAnswer`. A `landed` answer without a matching result is read as
  `unknown` (`answer-reading.ts:12-19`).
- **Consumers.** `commands.answerReconcile` → `reconciler.answer` (`commands.ts:145-147`,
  `reconciler.ts:73-78`). The answer settles a timed-out command through `clientGatewayReconciledResult`
  (`commands.ts:175-185`, `dispatch.ts:157-167`). An answer nobody asked for is audited (`inbound.ts:115-120`).
- **Reaches.** The runtime: it decides `succeeded`, `failed` or `timed_out` for the waiting caller.
- **Persisted.** Indirectly, through the durable receipt or the attempt store.

#### `client.error`

- **Fields.** `{ message, code?, metadata? }` (`contracts:562`).
- **Decoder.** None.
- **Consumers.** The runtime transport emits `runtime.error` (`client-gateway-transport.ts:127-137`). The bridge
  writes a recording marker (`bridge.ts:273-288`).
- **Reaches.** The runtime event stream.
- **Persisted.** Into the recording when one is open.

### 1.2 Lifecycle inputs that are not messages but change behaviour

- **`connect({ socket })`** creates the session with a random `sessionId` and a fallback random `clientId`
  (`service/lifecycle.ts:283-288`, `sessions.ts:22-29`).
- **Socket close → `disconnect(sessionId, "socket closed")`** (`client-gateway-websocket.ts:146-150`,
  `lifecycle.ts:290-303`). It emits `session.disconnected`, which can make durable commands uncertain at once
  (`dispatch.ts:41,177-180`) and is forwarded as `client.disconnected` (`client-gateway-transport.ts:121`).
- **Operator pairing approval** over HTTP (`Core:apps/web/src/app/api/client-gateway/approve-pairing/route.ts:17`,
  `pairing-flow.ts:79-188`) makes a session `ready` and sends `server.session_ready`. Revocation is
  `service/access.ts`.

### 1.3 HTTP routes a client or the extension calls directly

These are not gateway messages. Each also appears in §4 as a bypass.

#### `POST /api/programs/<program>/<endpoint>` with the pairing token as bearer

- **Caller.** `callCoreProgram` (`Ext:apps/extension/src/background/connection/core-api.ts:144-207`).
- **Allowlist.** `PAIRED_CLIENT_ENDPOINTS` (`Core:apps/web/src/lib/program-route.ts:88-129`). Payloads are
  narrowed at `:279-325`. Authorization is in `Core:apps/web/src/app/api/programs/[programId]/[endpoint]/route.ts:101-128`.
- **Endpoints that reach a run or build:**
  - `append-turn`: the person's instruction text, `capabilities` (ids only; `Ext:apps/extension/src/background/panel/chat-capabilities.ts:7-14`),
    and `onScreen`, which can carry `pageUrl`, `flowId`, `runId` and `recordingId` (`Ext:apps/extension/src/shared/protocol.ts:198-222`).
    This is the build's initial run context.
  - `answer-ask`: the person's answer.
  - `cancel-runtime-session`, `cancel-flow-bootstrap`, `pause-runtime-session`, `resume-runtime-session`:
    external control.
  - `run-runtime-session`: starts a run.
  - `remove-recording-entry`: mutates an open recording.
  - `generate-recording-proposal` and `review-recording-flow-proposal`.
- **Read-only endpoints:** `list-*`, `get-*`, `export-run-dataset`, and `secret-keys snapshot`.
- **Persisted.** In the conversation, run and recording stores. Nothing is captured at the gateway.

#### `PUT /api/programs/automation-studio/state-assets/<projectId>/<sha256>`

- **Carries.** Screenshot PNG bytes, the content type, and the `x-content-sha256` header
  (`Ext:.../connection/core-api.ts:77-104`).
- **Validated.** Media-type allowlist, 20 MB limit, digest check
  (`Core:apps/web/src/app/api/programs/automation-studio/state-assets/[projectId]/[sha256]/route.ts:45-78`).
- **Consumer.** `writeProjectObjectAsset`, then returns a `contentRef`.
- **Reaches.** Recording evidence state, by reference (§3).
- **Persisted.** Yes, content-addressed (`programs/automation-studio/storage/object-store.ts:339-346`).

#### `GET /api/client-gateway/snapshot`

- **Carries.** A bearer token. Read-only.
- **Consumer.** The extension learns its project binding from the response
  (`Ext:.../connection/core-api.ts:38-75`).
- **Reaches.** Core behaviour: no.
- **Persisted.** No.

#### `GET /api/recordings`

- **Carries.** A bearer token and paging. Read-only (`core-api.ts:15-31,213-218`).
- **Reaches.** Core behaviour: no.
- **Persisted.** No.

---

## 2. Outbound: every command Core sends a client, and what it expects back

Every server message is built by `ClientGatewayTransport.message`, which mints `id` with `randomUUID()` and
`timestamp` with `config.now()` and stamps `sessionId` and `clientId` (`service/transport.ts:16-29`). Messages
are delivered by:

- `send`, which queues into the unbounded `session.outbound` and writes the socket (`:31-35`);
- `sendChecked` (durable), which requires a ready session with a live socket (`:37-42`);
- `sendUnqueued` (activity), best-effort and not queued (`:50-61`).

`outbound(sessionId)` exposes the queued copies (`service.ts:252-254`).

### `server.execute_action`

- **Payload** (`contracts:113-121,570`): `actionType`, `parameters?`, `target?`, `timeoutMs?`, `metadata?`,
  `lease?`, `commandId`.
- **Senders.**
  - Non-durable: `commands.executeAction` with `commandId = randomUUID()` (`commands.ts:89-113`).
  - Durable: `ClientGatewayDurableDispatch.execute`, where `commandId` is a digest of the owner (`projectId`,
    `runId`, `flowId`, `invocationId`, `attemptId`, `effectOrdinal`) (`dispatch.ts:43-72`,
    `command-ledger/controller.ts:47-51`).
  - Lease refusal: the message is built but never sent, and a failure is synthesized (`commands.ts:208-213`).
- **Expected answer.** `client.action_result` with the same `commandId`. Core waits `timeoutMs + COMMAND_ANSWER_MARGIN_MS`,
  or 30 s by default (`commands.ts:105`, `config.ts:332`). When the wait runs out it asks `server.reconcile_command`
  before settling `timed_out` (`commands.ts:175-185`). A result from another session is `wrong_session`; one
  arriving after closure is late (`commands.ts:120-131`).
- **Correlation id.** `commandId`.

### `server.reconcile_command`

- **Payload.** `{ commandId }` (`contracts:199,571`).
- **Sender.** `ClientGatewayCommandReconciler` (`reconciler.ts:95-103`). Only sessions that declared
  `answersReconcile` are asked.
- **Expected answer.** `client.reconcile_result` within `reconcileAnswerMs` (5 s by default; `config.ts:333`).
  `running` gets one more wait (`reconciler.ts:125`).
- **Correlation id.** `commandId`.

### `server.capture_snapshot`

- **Payload.** `{ kind?, metadata? }` (`contracts:569`). There is no command id.
- **Senders.** `commands.captureSnapshot` (`commands.ts:81-87`), reached from the runtime transport
  (`client-gateway-transport.ts:75-85`), the domain runtime adapter (`Ext:domain/src/runtime/adapter.ts:149-163`)
  and the operator API (`programs/automation-studio/api/handlers/client-gateway.ts:80-90`).
- **Expected answer.** None awaited. The client answers asynchronously with `client.snapshot`, `state_update` or
  `recording_event`, and nothing ties the answer to the request. The domain's evidence loop instead uses
  `execute_action` `web.dom.capture_snapshot`, which answers in-band (`Ext:domain/src/runtime/llm-evidence/structure/detect.ts:199`).
- **Correlation id.** None. This is a correlation gap.

### `server.start_recording`

- **Payload.** `{ recordingId, projectId?, taskId?, domainId? }` (`contracts:567`).
- **Sender.** `commands.startRecording` (`commands.ts:67-72`), from the bridge (`bridge.ts:172-177,380-382`).
- **Expected answer.** No acknowledgement. The client streams recording messages afterwards.
- **Correlation id.** `recordingId`.

### `server.stop_recording`

- **Payload.** `{ recordingId? }` (`contracts:568`).
- **Sender.** `commands.stopRecording` (`commands.ts:74-79`).
- **Expected answer.** None.
- **Correlation id.** `recordingId`.

### `server.pairing_required`

- **Payload.** `{ referenceCode?, reason }`.
- **Senders.** `lifecycle.ts:312-315` and `inbound.ts:69`.
- **Expected answer.** None. The person then approves the client in the web panel.
- **Correlation id.** None.

### `server.session_ready`

- **Payload.** `{ sessionId, token, projectId? }`. The token is a secret.
- **Senders.** `lifecycle.ts:361-365` and `pairing-flow.ts:188`.
- **Expected answer.** None. The client stores the token and flushes its queue
  (`Ext:.../connection/server-command-channel.ts:145-166`).
- **Correlation id.** `sessionId`.

### `server.activity`

- **Payload.** `ClientGatewayActivity`, with a per-process `sequence` (`contracts:393-466`).
- **Sender.** `ClientGatewayActivityPublisher` (`activity-publisher.ts:24-31`). It is unqueued, display-only,
  and sent only to sessions that declared the capability.
- **Expected answer.** Never answered (`server-command-channel.ts:123-128`).
- **Correlation id.** `activityId` and `sequence`.

### `server.ping`

- **Payload.** `{ nonce }`, where the nonce is a random UUID.
- **Sender.** `commands.sendPing` (`commands.ts:229-232`). No Core caller was found (unverified).
- **Expected answer.** None. The client only notes that a message arrived.
- **Correlation id.** None.

### `server.disconnect`

- **Payload.** `{ reason }`.
- **Senders.** `lifecycle.ts:357` (a newer session replaces this one) and `inbound.ts:140` (protocol version
  mismatch).
- **Expected answer.** None.
- **Correlation id.** None.

### `server.error`

- **Payload.** `{ message, code?, metadata? }`.
- **Senders.** `commands.sendError`, which also writes the audit log (`commands.ts:234-242`); the bridge's
  recording refusals (`bridge.ts:328,333-337,477-489`); `inbound.ts:139`; pairing refusals
  (`pairing-flow.ts:100,145`). Separately, `gateway.receive_failed` is written straight to the socket
  (`client-gateway-websocket.ts:144`).
- **Expected answer.** None. The extension reads a recording-start refusal as scoped to the recording, and any
  other error as a failed connection (`server-command-channel.ts:109-121`).
- **Correlation id.** None. The bridge puts `clientGatewayMessageId` in `metadata` (`bridge.ts:482`).

### `server.set_active_tab`

- **Payload.** `{ tabId }` (`contracts:572`).
- **Sender.** No Core sender was found (grep of `packages` and `apps/web/src`). The extension still handles it
  (`server-command-channel.ts:137-139,185-190`).
- **Correlation id.** None.

### Core-synthesized results

These are never sent on the wire, but callers receive them as if they were action results:

- timeout or reconcile outcomes (`commands.ts:175-185`; `command-reconcile/reconciled-result.ts:26-48`);
- gateway close, which settles waiting commands `unknown` (`commands.ts:155-165`);
- durable outcomes made uncertain: abort, disconnect or close (`dispatch.ts:181-185`);
- lease refusals (`commands.ts:208-213`);
- runtime-level timeout, cancel or rejection (`Core:packages/fluxiq/src/runtime/service.ts:367-416`,
  `client-gateway-transport.ts:209-216`).

---

## 3. Deferred dereferences: what Core reads later rather than in-band

### Screenshots (state assets)

- **How they are written.** The extension captures the visible viewport, hashes it, and PUTs it before sending
  any message that references it (`Ext:apps/extension/src/background/connection/state-assets.ts:29-47`). The
  returned `contentRef` (`/api/programs/automation-studio/state-assets/<project>/<sha>`,
  `object-store.ts:339`) is embedded in the state snapshot of recording evidence
  (`Ext:.../connection/recording-evidence.ts:256-290`).
- **Where and when they are read.**
  - The GET route serves them to the web panel through `readProjectObjectAsset`
    (`state-assets/.../route.ts:18-43`, `programs/automation-studio/runtime/service/object-documents.ts:51-58`).
  - The state index validates them (`programs/automation-studio/storage/state-index.ts:226,259`).
  - The executor's `recorded-state.ts` and the proposal candidates carry `screenshotRef` but do not read the
    bytes (`runtime/executor/recorded-state.ts:8-55`, `runtime/service/recordings/proposal-candidates.ts:190`).
  - No model call sends images (grep for image content types in `packages/fluxiq/src` found none).
- **Status for traces.** Recording-time only, as far as found. Whether builds open a recording is unverified.

### Recording state snapshots

- **What.** Recording state snapshots are dehydrated to `stateRef` objects on write and hydrated on read
  (`object-documents.ts:135-219`). The write sites are `programs/automation-studio/runtime/service.ts:742,767`
  and `runtime/service/recordings/store.ts:63`.
- **When they are read.** When a recording is read later: `service.ts:650,663,4298`,
  `recordings/store.ts:85`, and `readIndexedStateSnapshot` at `object-documents.ts:220-230`. Builds read
  recordings as evidence (recording-as-evidence), so a build dereferences client data that an earlier session
  captured.

### Recording sessions and entries

- **What.** The bridge writes them (`bridge.ts:96,131,190,343,401,446,706`). Builds and proposals read them
  later from storage.
- **When they are read.** At build or proposal time. A trace has to name the exact recording and its version.

### Late action results

- **What.** Kept on the run's detail (`programs/_shared/runtime.ts:92-94`,
  `runtime/service/runtime-session/late-action-result.ts:34`).
- **When they are read.** Later, when the run is read or diagnosed. They carry closed fields only, with no
  payload (`command-history.ts:27-51`).

### Command ledger records

- **What.** Claim and receipt with digests only (`command-ledger/contracts.ts:1-25`).
- **When they are read.** On re-dispatch or reconcile through `ledger.read` (`contracts.ts:40`).

### Runtime store

- **What.** Runs and command attempts with withholding, at `artifacts/runtime/...` (`runtime/storage.ts:43-68`).
- **When they are read.** At RuntimeService start (`runtime/service.ts:299-304`).

### Trusted clients

- **What.** `client-gateway/trusted-clients.json` (`programs/_shared/runtime.ts:254-265`).
- **When they are read.** At `ready()` before a hello is handled (`lifecycle.ts:306`). This store decides resume
  or pairing.

### Run datasets

- **What.** Rows from dispatches that carry `recordOutput` (`runtime/io-policy.ts:104-107`).
- **When they are read.** By post-processing and `export-run-dataset`. They are derived, not client-direct.

### Step logs (`FLUXIQ_LLM_STEP_LOG_DIR`)

- **What.** Core writes them (`runtime/llm/step-log/directory.ts`).
- **When they are read.** Never by Core. No `readFile` or `readdir` appears in the step-log or progress-trace
  files that use the variable.

### Lab or client files in the workspace

- None found that Core reads during a run. The Lab's per-step files are Core's own step logs, which Core only
  writes.

### Everything else is in-band

Page views, extraction rows, fact-check answers and target resolutions arrive inside `client.action_result.payload`
(for example `Ext:domain/src/io/gateway-output-dispatcher.ts:41-60` and `Ext:domain/src/runtime/adapter.ts:140-147`).
No lazy read goes back to the client, apart from issuing a new command.

---

## 4. Bypasses and gateway-level nondeterminism

This section is a list only. The executor and evidence-loop side belongs to another worker.

### 4.1 Reads and effects that do not go through the gateway

1. The paired-client HTTP program routes in §1.3: `append-turn` (the initial instruction and context),
   `answer-ask`, `cancel`/`pause`/`resume-runtime-session`, `cancel-flow-bootstrap`, `run-runtime-session`, and
   `remove-recording-entry`. These carry the initial run context and external control, and none of them pass
   `ClientGatewayService`.
2. Cookie-authenticated operator routes in the web panel. Examples are `approve-pairing`, and the Automation
   Studio handlers `startClientRecording`, `executeClientAction` and `captureClientSnapshot`
   (`api/handlers/client-gateway.ts:57-95`). The commands they cause are gateway outbound and would be captured;
   the operator request itself is not.
3. The screenshot PUT (§1.3, §3).
4. The candidate start hook: Core POSTs to `FLUXIQ_CANDIDATE_START_URL` (the Lab's reset) and keeps the answer
   (`runtime/candidate-start-hook/from-environment.ts:55-69`, `environment.ts:13`; wired at
   `programs/_shared/runtime.ts:69`). This is an external effect plus an external read.
5. In-process reads of gateway state. These are queries rather than messages, and they decide which client gets
   a command:
   - `clientGateway.snapshot().sessions` in `runtime/client-gateway-transport.ts:46,105-108`;
   - `Ext:domain/src/runtime/llm-evidence/tools.ts:715`;
   - `Ext:domain/src/runtime/adapter.ts:167`;
   - `Ext:domain/src/io/gateway-output-dispatcher.ts:131`;
   - `Ext:domain/src/runtime/host-runtime.ts:285`.
6. The bridge reads stored recordings back to decide whether a refused append was a race
   (`bridge.ts:595-598`). That is a storage read on the intake path.
7. The extension's offline queue re-mints envelope `id` and `timestamp` on flush: it re-sends `type` and
   `payload` through `client.send` (`Ext:apps/extension/src/background/connection/gateway-session.ts:261-270`;
   minting at `Core:packages/client-gateway-websocket/src/transport.ts:321-330`). The source id and time of a
   queued message are lost before Core sees it.

### 4.2 Nondeterministic inputs at the gateway level

- **Ids.**
  - Non-durable `commandId` from `randomUUID()` (`commands.ts:95`).
  - Server message `id` (`transport.ts:21`).
  - `sessionId`, and `clientId` when the hello omits it (`sessions.ts:24-26`).
  - Ping nonce (`commands.ts:231`).
  - Audit ids (`audit-log.ts:12`) and `trustedClientId` (`trusted-clients.ts:78`).
  - Tokens from `createToken` (`config.ts:336`).
  - Bridge `recordingId` fallback `client.<id>.<Date.now()>` (`bridge.ts:126`).
  - Runtime transport fallback ids from `Date.now()` (`client-gateway-transport.ts:81,211`).
- **Clock.**
  - `config.now` is injectable (`config.ts:337`). It feeds message timestamps, `dispatchedAt`, `closedAt` and
    `receivedAt` (`command-history.ts:93,109,130`), and the receipt's `receivedAt` (`dispatch.ts:89`).
  - Direct `Date.now()` calls bypass it: the bridge's empty state snapshot and fallbacks (`bridge.ts:507,715,748,753-754`)
    and the domain hub's `timestampMs` fallback (`gateway-input-hub.ts:46`).
- **Timers.** These are real `setTimeout`s with no port, so a virtual clock cannot drive them today:
  - the answer wait (`commands.ts:107`);
  - the reconcile window and running wait (`reconciler.ts:95,125`);
  - the durable answer wait (`dispatch.ts:67,115`);
  - the bridge stop drain of 250 ms (`bridge.ts:105,397`);
  - the runtime bounds (`runtime/service.ts:387`).
- **Session selection** depends on `connectedAt` ordering and capability sets (`client-gateway-transport.ts:105-116`).
- **Concurrency.** Frames are dispatched without awaiting (`client-gateway-websocket.ts:185`), and the event bus
  runs subscribers in parallel (`event-bus.ts:13`). The order in which handlers finish is therefore not
  guaranteed to equal arrival order. The bridge restores order itself with `writeOrder`, queued before its first
  await (`bridge.ts:231-236`).

---

## 5. Proposed capture boundary

### 5.1 Where to take the immutable copies

Add one recorder port owned by `ClientGatewayService`, for example
`ClientGatewayServiceOptions.trace?: ClientGatewayTraceSink`, resolved by `resolveClientGatewayConfig`
(`service/config.ts:27-39`) and passed to the collaborators constructed in `service.ts:74-104`. Capture at
these points:

1. **Inbound: `ClientGatewayInbound.receiveRaw` (`service/inbound.ts:51`), before `JSON.parse`.**
   - Copy the raw text. A string is immutable, and it preserves omitted fields versus `null`, number spellings,
     unknown and extension fields, and key order. These are exactly the source plan's 3.3 fidelity rules, which
     a re-serialized object would lose.
   - Assign the delivery sequence synchronously on entry (see §5.3), along with `sessionId` and
     `receivedAt = config.now()`.
   - After `receive` returns or throws, append a disposition event: `accepted`, `refused_not_ready`
     (`inbound.ts:68-71`), `protocol_refused` (`:130-143`), `parse_failed`, `receive_failed` with its error, or,
     for action results, the `ClientGatewayResultDisposition` (`commands.ts:25`).
   - Direct in-process callers of `receive(sessionId, message)` (`service.ts:179-181`; the mock client) are
     recorded as `JSON.stringify(message)` and marked `source: "object"`.
   - An offline run feeds each recorded text back through the same `receiveRaw` → `receive` → `settle` and event
     bus. No replay-only state object is needed.
2. **Lifecycle: `ClientGatewayLifecycle.connect` and `disconnect`** (`lifecycle.ts:283,290`, including the
   reason), pairing approval (`pairing-flow.ts:79`) and revocation (`access.ts`), as control events.
3. **Outbound: `ClientGatewayTransport.send`, `sendChecked` and `sendUnqueued`** (`transport.ts:31,37,50`).
   - Record a structured copy of the built message with its sequence and delivery outcome (`queued+sent`,
     `send_failed`, or `dropped` for unqueued).
   - Also record `refuseForLease` (`commands.ts:208-213`) as `refused_unsent` together with its synthesized
     result.
   - Move the raw `gateway.receive_failed` write in `client-gateway-websocket.ts:144` behind the transport, or
     record it from the receive-failure disposition above.
4. **Core-synthesized outcomes:** `answerNeverCame` (`commands.ts:175-185`), `close` (`:155-165`), durable
   `uncertain` (`dispatch.ts:181-185`) and `accept` suppressions (`dispatch.ts:83-87`). Record these as
   `core.synthesized` events so the parity harness can tell a client answer from a Core timeout, and so a
   virtual-clock replay can be checked against them.

**Prerequisites for faithful replay through the same path.** These are gaps, not proposals for this lane:

- an id-source port for `ClientGatewayCommands` and `ClientGatewayTransport`. Today `randomUUID` is imported
  directly (`commands.ts:1,95`, `transport.ts:1,21`). Recorded non-durable command ids must reappear, or the
  recorded results will not match their pending commands. Durable ids are already deterministic.
- a timer port beside `config.now`, for the timers listed in §4.2.

### 5.2 What is excluded as transport-only, and why it cannot influence Core

- **WebSocket framing, fragmentation, masking, and protocol ping, pong and close frames**
  (`client-gateway-websocket.ts:204-249`). They never reach `receiveRaw`; only completed text frames do (`:217`).
- **The HTTP upgrade, `Origin` check and health responses** (`:39-68`). A refused upgrade creates no session,
  so nothing reaches Core.
- **Token values in `client.hello.token` and `server.session_ready.token`.** They are secrets and must not be
  stored. What Core does with a token is fully visible in the captured outcome (`session_ready` versus
  `pairing_required`, plus the audit types at `lifecycle.ts:335,346`). The token is replaced by a
  `{ redacted: "credential" }` marker. This is a declared fidelity limitation: an offline intake must stub
  trusted-client resolution and replay the captured verdict.
- **`server.activity`.** It is display-only. No Core component reads a reply to it, and nothing answers it
  (`activity-publisher.ts`; `server-command-channel.ts:123-128`). Capture it as a separate display stream that
  is excluded from parity, or not at all.
- **The audit log and the `outbound()` queue.** Both are derived from captured events.
- **What is not transport-only.** The envelope's client-minted `id` and `timestamp` are read downstream (§1.0),
  and `sessionId`, `lastSeenAt`, `connectedAt` and capabilities affect session choice. All of these are kept.

### 5.3 Ordering and correlation

- **Ordering.** Use one gateway-wide, monotonic `deliverySequence` counter, shared by inbound, outbound,
  lifecycle and synthesized events. Inbound events take their number at `receiveRaw` entry, synchronously
  before any await. Because the text arrives in frame order, that number is the order of delivery to Core,
  which source timestamps cannot reconstruct. Interleaving outbound events on the same counter preserves "the
  command was sent before its result arrived." Also keep the source envelope `id` and `timestamp` as the
  source sequence and time.
- **Unknown causality.** Do not record an inferred cause for uncorrelated pairs, such as a
  `server.capture_snapshot` and the `client.snapshot` that followed it. Leave the cause unknown, as source plan
  5.2 requires.
- **Correlation.**
  - `commandId` links `execute_action`, `action_result`, `reconcile_command` and `reconcile_result`.
  - `recordingId` links recording messages.
  - For durable commands, the ledger `binding` (run, flow, invocation, attempt, effect ordinal;
    `command-ledger/contracts.ts:1-12`) links a command to the run step that issued it.
  - For non-durable commands, attach `commandOwner()` (`types.ts:198`, already read at `commands.ts:100`).
- **Concurrency.** Because frames are handled concurrently (§4.2), an offline feed has to choose between
  replaying with the same concurrency, or awaiting each `receiveRaw` in sequence and declaring that a
  serialization. This is open question 2.

### 5.4 What the extension must put in-band (or Core must pin) that Core now dereferences

- **Screenshots.** The bytes already arrive at Core over HTTP before any message references them
  (`state-assets.ts:33` runs before `recording-evidence.ts:289`), and they are stored content-addressed. The
  route is Core's own intake, so Core can record an `artifact` trace event at `writeProjectObjectAsset`
  (sha256, media type, size) and pin the object, with no extension change. The alternative is an in-band
  artifact message. Either way, the trace must not resolve the live URL during replay (source plan 5.3).
- **Page snapshots for tier 2 (P2).** This is a new in-band payload in tracing mode, attached to each
  observation and read result. It is lane T's spike, and the extension lane owns it.
- **Envelope id and timestamp through the offline queue.** The extension should send the queued envelope
  unchanged instead of re-minting it (`gateway-session.ts:261-270`). This belongs to lane G's queue fix.
  Otherwise Core receives a new id and time for old data, and a trace records them faithfully but meaninglessly.
- **`server.capture_snapshot`.** It needs a correlating id. Either add `commandId` to the message and its reply,
  or keep that legacy path out of traces, since builds use `execute_action web.dom.capture_snapshot`, which
  answers in-band.
- **Initial run context and control.** These come over HTTP (§4.1 item 1). They are not the extension's to put
  in-band; Core should capture them where it accepts them (the conversation and run-control handlers) as
  manifest and control events in the same trace.

### 5.5 Where the trace contract module should live

Candidates: `packages/fluxiq/src/client-gateway/trace/` or `packages/fluxiq/src/runtime/trace/`.

**Recommendation: `packages/fluxiq/src/client-gateway/trace/`** for the manifest, event envelope, completeness
status, and the recorder (sink) port. The store implementation goes with the workspace store that P2 names
(Automation Studio `storage/`). The environment port and the offline-trial runner go in Automation Studio
`runtime/`. The reasons:

1. **Ownership.** `code-structure.md` puts the client gateway in a domain-neutral framework area
   (`Core:docs/architecture/code-structure.md:35-38`). The trace is defined as "what Core received from
   clients", and the copies are taken inside `client-gateway/service/`. If the Automation Studio program were
   deleted, the trace contract would still have a consumer (the gateway itself), so it is not program-owned
   (`code-structure.md:44-47`).
2. **Dependency direction and cycles.** `runtime/` already imports `client-gateway` by value: `runtime/service.ts:2-3`
   and `runtime/client-gateway-transport.ts:2-10` import the command ledger and the service. If the gateway's
   capture code imported a value from `runtime/trace/`, the edge client-gateway → runtime would close a cycle.
   The `import-cycles` rule fails any module that joins one (`Core:scripts/structure-audit/rules/import-cycles.mjs:1-30`).
   Type-only edges are erased (`:16-18`); the existing client-gateway → runtime edge is type-only
   (`client-gateway/service.ts:2`). With the contract under `client-gateway/trace/`, runtime and Automation
   Studio consume it in the direction that already exists.
3. **The runtime kernel is not the main path.** The web domain dispatches through
   `automationStudioClientGateway.executeAction` (`Ext:domain/src/io/gateway-output-dispatcher.ts:30,41`,
   `Ext:domain/src/runtime/llm-evidence/tools.ts:708`), not through `RuntimeService`. A trace under
   `runtime/trace/` would sit beside a path most live traffic skips.
4. **Browser bundles.** `client-gateway/contracts.ts` is a browser-bundle entry (`Core:scripts/structure-audit/config.mjs:68`).
   Do not re-export `trace/` from `contracts.ts`; export it only from `client-gateway/index.ts`, so digest code
   that uses `node:crypto` stays out of the extension's bundle graph (the browser-imports rule, `config.mjs:51-77`).
   If the extension ever needs a trace wire type (for example a tracing-mode capability or an artifact message),
   that type belongs in `packages/contracts/src/client-gateway.ts` with the other wire types, not in `trace/`.
5. **Web vocabulary.** All of `packages/` is domain-neutral (`config.mjs:110-122`). Contract names must avoid the
   terms at `scripts/structure-audit/rules/web-vocabulary.mjs:117-124`: `dom`, `css`, `xpath`, `iframe`,
   `cookie`, `browser`, `tab`, `click`, `scroll`, `class name`, `selector`, and the rest of that list. Use
   neutral names such as `observation`, `artifact`, `snapshot`, `stream` and `context`. The web page-snapshot
   payload stays opaque inside the envelope's `payload`, with the domain declaring its schema.
6. **Name collision.** "Trace" already names unrelated executor and evidence-loop files:
   - `programs/automation-studio/runtime/executor/attempt-trace.ts` and `trace-summary.ts`;
   - `trace-withholding.ts`, `frames/framed-trace.ts`, `lifecycle/failure-class-trace.ts`, and
     `step-loop/ended-trace.ts` / `lifecycle-trace.ts`;
   - `runtime/recovery/trace.ts`, `runtime/llm/evidence-loop/trace.ts`, `runtime/llm/evidence-progress/build-trace.ts`
     and `progress-trace.ts`, and `runtime/exploration-reduction/evidence-loop-trace.ts`;
   - `runtime/service/flow-bootstrap-commands/evidence-trace.ts` and `runtime/service/summaries/recovery-trace.ts`.

   Prefix every exported type `ClientGatewayTrace*` (for example `ClientGatewayTraceManifest`,
   `ClientGatewayTraceEvent`, `ClientGatewayTraceCompleteness`, `ClientGatewayTraceSink`). Keep the different
   package path and the prefix, and never import the executor's traces into it or the reverse.
7. **Layout.** One exported thing per file, a barrel at `client-gateway/trace/index.ts`, and tests in
   `client-gateway/trace/tests/`. Depth is fine: `packages/fluxiq/src/client-gateway/trace/<file>.ts` is 6
   segments against the cap of 8 (`code-structure.md:106-115`). A filename prefix shared by 3 or more files
   becomes a subdirectory (`:64-87`).

---

## Recommended decision

Capture traces inside `ClientGatewayService`, through one injected `ClientGatewayTraceSink`:

- raw inbound text at `ClientGatewayInbound.receiveRaw`, before `JSON.parse`, then its disposition;
- connect, disconnect and pairing lifecycle events;
- every outbound message at `ClientGatewayTransport.send`, `sendChecked` and `sendUnqueued`, plus lease refusals;
- Core-synthesized timeout, close and uncertain outcomes;

all on one gateway-wide delivery sequence that is assigned synchronously on entry. `commandId`, `recordingId`,
the durable ledger binding and `commandOwner` provide correlation.

Exclude only:

- WebSocket framing and upgrade, which never reach `receiveRaw`;
- `server.activity`, which nothing answers;
- token values, which are replaced by a declared credential marker whose effect is visible in the captured
  `session_ready` or `pairing_required`.

Inputs that bypass the gateway must be captured into the same trace by Core where Core accepts them: the
paired-client HTTP `append-turn`, `answer-ask` and run-control calls, the screenshot PUT (as content-addressed
artifact events, pinned), and the candidate start hook's answer. An offline run feeds the recorded text back
through the same `receiveRaw` → `receive` → `settle` path and event bus. That needs two small ports first: an id
source for non-durable command and message ids, and a timer source beside `config.now`.

Place the contract (manifest, event envelope, completeness, sink port) in
`packages/fluxiq/src/client-gateway/trace/` with `ClientGatewayTrace*` names, exported from
`client-gateway/index.ts` and never from `contracts.ts`. Put the store in the workspace store and the environment
port and runner in Automation Studio `runtime/`.

## Open questions or contradictions found

1. **Scope of "trace."** The plan defines a trace as what Core received from clients at the gateway (Decision 4).
   But the initial run context and external control arrive over HTTP, outside the gateway (§4.1 item 1). Should
   the manifest live with the gateway trace (one trace, several streams), or should Automation Studio own a
   run-level manifest that references a gateway stream? This report recommends one trace with named streams and
   a gateway-owned contract. The supervisor should confirm.
2. **Concurrency on replay.** Live intake is concurrent per socket (`client-gateway-websocket.ts:185`,
   `event-bus.ts:13`). Should offline intake await each message in sequence (deterministic, but a declared
   difference from live) or reproduce the concurrency? P3 parity depends on this choice.
3. **Screenshot capture.** Core-side capture at `writeProjectObjectAsset` with pinning, or an in-band artifact
   message from the extension? Decision 4 says the extension puts dereferenced data in-band, but here Core
   already receives the bytes itself over HTTP.
4. **The durable path refuses unknown result keys** (`dispatch.ts:206-208`) while the non-durable path passes
   them through. A trace that keeps extension fields will hold fields that one live path never let through.
   Replaying through the same path reproduces this, but the parity harness should expect it.
5. **`server.capture_snapshot` has no correlation id.** Should it get a `commandId`, or be kept out of the traced
   surface because builds use the in-band `execute_action` variant?
6. **Redaction versus exact parity.** Token redaction is runtime-visible: it decides resume. Source plan 3.3 says
   such scopes cannot pass exact parity. Is "stub trusted-client resolution and replay the captured verdict"
   acceptable for P3, or must the lifecycle scope be marked as a fidelity limitation?
7. **Unverified items** from "Not verified" above: whether builds open recordings, whether anything calls
   `sendPing`, whether any decision reads `lastSeenAt`, and how state assets are retained.
