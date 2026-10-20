# Report: lane-t-p2a-core-map (t736, read-only Core map)

## Outcome

Done. Read-only map of FluxIQ Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t736/!FluxIQ` at `ca23a8ba`
(Merge task t734), ending in a recommended design (section 6). No file other than this report was written.

Path convention: paths are relative to Core's `packages/fluxiq/src/` unless they start with `apps/` or
`packages/`. `AS/` means `programs/automation-studio/`. Line numbers were read at `ca23a8ba`.

## What changed and why

Nothing in either repository. This report answers brief items 1-6.

### 1. Store: where traces should live

**Storage roots.**
- `FluxIQHostPaths` is at `framework/index.ts:23-47`. In the v2 layout, `recordings` resolves to
  `.fluxiq/artifacts/automation-studio` (`framework/index.ts:172`, env `FLUXIQ_RECORDINGS_DIR`), and
  `artifacts` resolves to `.fluxiq/artifacts` (`:176`).
- `programs/_shared/runtime.ts:71-78` passes `storageRootDir: paths.recordings` to `AutomationStudioService`.
  The generic runtime store is separate: `FileRuntimeStore` under `<artifacts>/runtime` (`runtime.ts:140`).
- The `AutomationStudioService` constructor (`AS/runtime/service.ts:433-445`) builds three stores from that
  root:
  - the legacy file object store, only when `storageRootDir` is set (`:437`);
  - the per-project SQLite pool, always when a root is set (`:440`, `idleCloseMs`);
  - the project paths (`:442`).

**Candidates.**

| Store | Where | Fit for traces |
| --- | --- | --- |
| Per-project SQLite pool `AutomationStudioProjectDatabasePool` | `AS/storage/project/database.ts:65`. `acquire(projectId)` at `:84`. The file is `projects/<id>/project.sqlite` (`:204-214`). | **Recommended.** It is durable, survives restart (WAL; one connection per project, `:43-64` comment), takes per-store migrations, and is already used live by runs, datasets and conversations. |
| Project content store `AutomationStudioProjectContentStore` | `AS/storage/project/content-store.ts:17-170`. Objects live at `projects/<id>/objects/sha256/aa/bb/<sha>.<ext>` (`:178-180`). | **Recommended for artifact bytes and large payloads.** It is content-addressed with deduplication (`:57-64`), and its owner references (`addReference`, `:76-83`; repository `object-repository.ts:98,124,134`) give real pinning. The `object_references.owner_kind` column is free text (`schema/domain-resources.ts:419-426`). |
| Event chunk store `AutomationStudioProjectEventChunkStore` | `AS/storage/project/event-chunk-store.ts:32-144` | The pattern is right (chunks in the content store, a row per chunk, reads by sequence). Do not reuse it: the stream kind is a closed `"runtime" \| "recording"` union (`:5`), with SQL `check` constraints (`schema/event-streams.ts:8-17`) and separate tables per kind (`:71-83`). It also has no correlation index. |
| Legacy file object store `AutomationStudioObjectStore` | `AS/storage/object-store.ts:37-300`. Indexed by `projects/<id>/indexes/objects.json` (`:259-266`). | **Not for traces.** It has no references. A recording deletion prunes every project object not found by a scan of recordings, timelines and artifacts (`AS/runtime/service/recordings/deletion.ts:108-112,118-151`; also `AS/runtime/service.ts:937-941`). A trace-only object kept here would be deleted. |
| database-manager `SQLiteRepository` and `SQLiteConnectionPool` | `programs/database-manager/storage/sqlite-repository.ts:28`, `connection-pool.ts:42` | Not a fit. It stores generic id→JSON documents per kind, with no range or correlation index. |
| JSON lines | `AS/runtime/service/json-lines/page.ts:6` (`readJsonLinePage`) | A paging reader only; not a store. |

**How state assets are written, retained and deleted today.**
- **Write.**
  - The screenshot PUT reaches `writeProjectObjectAsset` (`AS/runtime/service/object-documents.ts:61-79`).
  - That calls the legacy `objectStore.putBytes(projectId, bytes, mediaType, {recordingId})`
    (`object-store.ts:46-87`). Bytes are written under `projects/<id>/recordings/<rid>/objects/` or
    `projects/<id>/objects/shared/` (`:375-383`), and the entry is upserted into the project's `objects.json`.
  - `contentRef` is `automationStudioObjectContentRef` (`:334-346`).
  - **Order defect.** The expected-digest check runs *after* the write (`object-documents.ts:67-71`). A
    mismatched upload is therefore stored and indexed before it is refused.
- **Retention.** There is none of its own. An object lives while `collectLiveProjectObjectReferences` finds it
  (`deletion.ts:118-142`).
- **Delete.**
  - `deleteRecordingObjects` and `deleteRecordingsObjects` (`object-store.ts:140-203`), then
    `pruneUnreferencedProjectObjects` (`deletion.ts:144-151`).
  - In the content store, `sweepUnreferencedObjects` (`content-store.ts:132-140`, exposed by
    `retention-store.ts:57-59`) deletes only objects without a reference. A grep found no runtime caller of
    either sweep outside `storage/` (unverified that none is scheduled elsewhere).
- **Pinning a trace's artifacts.** Write the artifact bytes into the project content store with an owner
  reference `{ ownerKind: "client_gateway_trace", ownerId: <traceId>, purpose: "artifact" }`. The legacy
  prune never touches the content store, and the content sweep spares referenced objects.
  - A screenshot is then stored twice on disk: once in the legacy store and once in the content store.
  - Deleting a trace means deleting its rows and its references; the next sweep frees the bytes.

**Migration pattern for a new store.**
- A store opens a lease and runs its own migration list: `ADMINISTRATION_MIGRATIONS` plus its own, sorted by id
  (`AS/storage/project/flow-resource-repository.ts:51-54`; open pattern `graph-judgement-store.ts:39-48`).
- The latest project migration ids are `0026_*`, so the next one is `0027_client_gateway_traces`.
- `AS/storage/project/` holds 25 files today, the budget (`docs/architecture/code-structure.md:166-171`), so a
  new store must be a subdirectory.

**What `ClientGatewayTraceStore` needs** (`client-gateway/trace/types.ts:344-359`):
- writes: `writeArtifact`, `appendEvents` (all or nothing, strictly increasing), `writeManifest`;
- reads: `readManifest`, `readEventRange(from, to)`, `readEventsByCorrelation(key ∈ commandId | recordingId |
  causationEventId, value)`, `readArtifact`, `listArtifacts`.

The memory store's semantics are the reference (`client-gateway/trace/memory-store.ts:83-173`): reading a trace
nothing was written for throws, and storing an artifact id twice with different bytes throws.

**The recorder writes the manifest on every flush** (`client-gateway/trace/recorder.ts:293-302`), not only at
close (`:194-201`).
- So once a trace's first flush has happened, a crash leaves a readable, unclosed manifest, which the evaluator
  reads as truncated.
- Nothing flushes on its own: the episode owner must schedule flushes (on a timer, or every N events) and flush
  on close.

### 2. Episodes: identity, where it is known, and overlap

**The manifest says "Episode ids are live run ids"** (`trace/types.ts:108-111`). Activities are
`exploration | test | execution` (`trace/vocabulary.ts:8`).

| Episode | Activity | Id available | Where |
| --- | --- | --- | --- |
| Flow build (flow bootstrap; project build) | exploration | Three different ids exist today; see below. | `AS/runtime/service.ts:1494` (`generateFlowBootstrapAdaptation`) |
| Candidate trial | test | `runId = ports.newRunId?.() ?? environment.newRunId("trial")`, minted *after* the start hook | `AS/runtime/service/candidate-trial/run.ts:116-120` |
| Subflow trial | test | `environment.newRunId("subflow-trial")`, after the start | `AS/runtime/service/subflow-trial/run.ts:153-157` |
| Normal run | execution | `session.runId` at admission | `AS/runtime/service.ts:2480` (`bindAutomationStudioActivityRun(session.runId)`) |

The three build ids are:
1. the activity scope's `build-<uuid>`, minted in `withAutomationStudioBuildActivity` and never persisted
   (`AS/runtime/activity/build.ts:15-18`);
2. `build.<uuid>`, minted inside the build at `AS/runtime/service.ts:1568`;
3. the project build's `buildId` (`AS/runtime/service/project-build/types.ts:20,33`), entered as an
   async-context frame only for project builds (`service.ts:1589`; `AS/runtime/llm/harness-options/
   evidence-build.ts:15-30`).

None of the three is known at `:1494`, and build routing already starts at `:1561`, before `:1568`. A build can
therefore send client commands before any build id exists (the first look, `start: "first_look"`).

**Ambient scopes that already exist** (all `AsyncLocalStorage`, read synchronously by the gateway):

| Scope | Where | What it gives |
| --- | --- | --- |
| Activity frame | `AS/runtime/activity/storage.ts:8`; scope type `activity/contracts.ts:10-16` (`kind: "build" \| "run"`, `id`, `projectId`, `flowId?`) | Run frames start `pending` and are named at bind (`activity/run.ts:45-48`, `activity/bind.ts:9-15`). |
| `automationStudioActivityRunScope` | `AS/runtime/activity/run-scope.ts:10-14` | `{projectId, runId}` for a bound *run* frame only; `undefined` in builds. The host passes it as the gateway's `commandOwner` (`programs/_shared/runtime.ts:83`). |
| Host lease | `AS/runtime/project-agents/host-resources/lease-scope.ts:39-48,69-78` | Strict: commands to the leased session without a lease are refused. One scheduler per host port (`AS/runtime/project-agents/dispatch/host-lease.ts:9-17`). Wired at `runtime.ts:85`. |
| Channel scope | `AS/runtime/environment/channel-scope.ts:14-29` | Entered by a non-live environment's `within` (`environment/scoped.ts:40`). Wired at `runtime.ts:87`. The live `within` is the identity (`environment/live.ts:11-18`). |
| Conversation ambient | `AS/runtime/conversations/context/run.ts:8-10` | `{projectId, conversationId}`. Background conversation commands (builds and runs started from chat) run inside it (`AS/runtime/conversations/commands/execute.ts:37-41`). |
| Build cancellation | `AS/runtime/service/flow-bootstrap-commands/cancellation.ts:20-26,34-39` | Keyed `[projectId, flowId]`. Child scopes serve the briefs. |

**How a gateway session relates to a project.**
- `ClientGatewaySession.projectId?` and `activeRecordingId?` (`packages/contracts/src/client-gateway.ts:482-500`)
  are set from three places:
  - pairing approval (`client-gateway/service/pairing-flow.ts:186`);
  - `startRecording` (`client-gateway/service/commands.ts:72-76`);
  - `markActiveRecording` (`commands.ts:286-290`).
- The field is **not** a reliable routing key:
  - The program route's own comment says the session's `projectId` "is the current context ... and it moves;
    the extension follows the project the person has open" (`apps/web/src/lib/program-route.ts:70-73`).
  - Activity publishing treats a null `projectId` as accepting every project
    (`client-gateway/service/activity-publisher.ts:34-37`).
  - Runtime session selection does not filter by project; it takes the newest ready session that matches the
    command's capabilities (`runtime/client-gateway-transport.ts:103-116`).
- Session metadata comes from hello. The trusted client binds a domain, not a project
  (`packages/contracts/src/client-gateway.ts:509-515`).
- A paired client's HTTP calls carry the gateway session as `actor.sessionId =
  "client-gateway:<sessionId>"` (`apps/web/src/lib/program-route.ts:194`; `authenticatePairedClient`,
  `apps/web/src/app/api/programs/[programId]/[endpoint]/route.ts:96-107`).

**Can two episodes of one project overlap? Yes.**
- A project build runs its briefs in parallel: `Promise.allSettled` over brief tasks
  (`AS/runtime/project-agents/dispatch/dispatcher.ts:96-111`). Each brief may hold its own host lease and
  session.
- Build cancellation keeps a set of active controllers per `[project, flow]` key, "including ones queued on a
  lock" (`cancellation.ts:11,45-46`).
- Trials nest inside a build: they are called from the build's trial gate in the build's async context.
- Runs of different Flows have no project-level exclusion that I found (unverified for the admission rules in
  `AS/runtime/service/runtime-session/admission.ts`, which I did not read).

So routing by `session.projectId` would mix episodes. Routing must use the dispatching async context, as the
host lease and channel scope already do.

### 3. Bypass ingress: handler, identity, narrowest capture point

| Ingress | Accepted at | Identity there | Narrowest capture point |
| --- | --- | --- | --- |
| Chat instruction and on-screen context (`append-turn`) | `AS/api/handlers/conversations.ts:170-208`. The payload is narrowed by the paired allowlist (`apps/web/src/lib/program-route.ts:88-129`). `onScreen` is narrowed to `flowId`, `subflowId`, `runId`, `recordingId` and `pageUrl` (`conversations.ts:328-341`). | `projectId` and `conversationId` from the payload; `actor.sessionId` names the gateway session. The turn precedes any episode: it becomes one via `startAutomationStudioConversationCommand` (`:202`, `AS/runtime/conversations/commands/start.ts:17-33`), and background commands run inside `runInAutomationStudioConversation` (`commands/execute.ts:37-41`). | In the handler after `respondToPersonTurn`, at `conversations.ts:192-203`: the turn text, capability ids, `onScreen` and `turnId`. It reaches the episode it causes through the conversation ambient, as a pending ingress keyed by `(projectId, conversationId)`. The episode opener records it as its first `control` event, and it can also go into the manifest `context`. |
| Ask answers (`answer-ask`) | `AS/api/handlers/conversations.ts:210-232` writes through `conversations().answerAsk`. | `projectId`, `askId`. | `awaitAnswer` in `AS/runtime/parking/conversation-port.ts:67-101`. It runs *in the waiting episode's own async context* and returns exactly the answer the episode consumes, so routing is free and the capture is parity-exact. Parked-and-resumed runs (`AS/runtime/parking/parked-run.ts`, `runtime-session/parked-wait.ts`) are unverified. |
| Run control: cancel run | `AS/api/handlers/runtime-execution.ts:30-43` → `service.cancelRuntimeSession` (`AS/runtime/service.ts:2693`). | `projectId`, `runId`. | The handler, or the service method. Route by an open-episode registry keyed by `runId`. |
| Run control: pause and resume | `AS/api/handlers/run-control.ts:57-70` (`runControl().pause`) and `:72-86` (`instructionAuthority.resume`). | `projectId`, `runId`, the holder flag, the note. | The handler, routed by `runId`. |
| Cancel flow bootstrap | `AS/api/handlers/llm-generation.ts:23-30` → `buildCancellation.cancel` (`cancellation.ts:65-70`). | `projectId`, `flowId`. | The handler, routed by an episode registry keyed `[projectId, flowId]` (the same key as cancellation). The episode itself ends in `AbortError` (`cancellation.ts:51-55`), which maps to `terminationReason: "cancelled"`. |
| Start a run (`run-runtime-session`) | `AS/api/handlers/runtime-execution.ts:44-101` → `service.runRuntimeSession` (`service.ts:2447-2452`). | The narrowed payload: a stored Flow by id, no LLM, no inputs, no side effects (`program-route.ts:116`). | Not a mid-episode event: it is the run episode's opening input. Open the run trace at bind (`service.ts:2480`) with the run input as manifest `context`. |
| Screenshot PUT | `apps/web/src/app/api/programs/automation-studio/state-assets/[projectId]/[sha256]/route.ts:45-84`. Media allowlist png, jpeg, webp and gif (`:16`, `:119-122`); 20 MB limit by header and by body (`:15`, `:59-68`); then `writeProjectObjectAsset` (`object-documents.ts:61-79`). | `projectId` (path); the client session from `authorizeToken` (`route.ts:98`); `recordingId` = `clientSession.activeRecordingId` (`:108`). | After a successful write in `object-documents.ts:61-79` (move the digest check before the write while there). Record an `artifact` event with `resourceKey = contentRef` into the traces that claim that gateway session. The route must pass the client `sessionId` down; today it passes only `projectId` and `recordingId` (`route.ts:71-77`). |
| Candidate start hook answer | Built at `programs/_shared/runtime.ts:70` from `FLUXIQ_CANDIDATE_START_URL` and `_TOKEN` (`AS/runtime/candidate-start-hook/environment.ts:12-15`, `from-environment.ts:40-71`). Called from `automationStudioCandidateTrialStart` (`candidate-trial/run.ts:252-273`), which the trial gate invokes before the trial (`AS/runtime/flow-bootstrap/candidate/trial-gate.ts:428`; subflow `subflow-candidate/subflow-trial-gate.ts:481`). | `projectId`, `flowId`, `candidateId`, `revision`, `digest`, `startLocation`, `lease`. It runs in the **build's** context, *before* the trial's run id exists. | A decorator around the hook function at `runtime.ts:70`. It records the request identity (never the token) and the JSON answer, or the error kind only (as `run.ts:268-271` already does), into the ambient trace, which is the build's. Correlate by `{candidateId, revision, digest}`. The in-trial site reset (`trial-gate.ts:430`, `reset.beforeTrial`) also sends client commands in the build's context, so they land in the build trace. |

Also outside `ClientGatewayService`: when a receive fails, the websocket host sends `server.error` straight on
the socket (`apps/web/src/server/client-gateway-websocket.ts:140-145`), bypassing the transport. Capture it from
the receive-failure disposition, or route it through the transport.

### 4. Secret screening

**The API after lane S** is `screenAutomationStudioLlmEvidence(value, deniedKeys)`
(`AS/runtime/llm/harness/evidence-screen.ts:62-86`, exported at `AS/runtime/llm/harness/index.ts:79`).
- It walks keys and values at every depth and answers `{ deniedKey: boolean; secretShaped: boolean }` only
  (`:53`). It gives no paths and no replacement.
- `secretShaped` covers:
  - a PEM private key, a JWT, a bearer credential, an `sk-` key, an AWS key id, and GitHub and Slack tokens
    (`:35-50`);
  - a Luhn-valid card number with card grouping and issuer digit 2-6 (`:88-114`; moved into Core by t728).
- `automationStudioWithoutCardNumbers(text, marker)` (`:101-103`) replaces only the card digit run.
- `deniedKeys` is the bound domain's declaration of what may not reach a *provider* (raw markup, locators). It
  is not a storage rule. Traces must keep page payloads, since they are what Core received, so pass `[]` for
  storage.
- A pattern already exists for walking a JSON value and naming each screened path:
  `AS/runtime/recovery/repair-context/authored-state-screen.ts:99-124` (`withheld` paths).

**Dependency direction.** The screen lives in `programs/automation-studio`, and `client-gateway/` is a
domain-neutral framework area (`docs/architecture/code-structure.md:37`). The gateway therefore cannot import it.
Screening must be injected from the program side.

**How to apply it before storage, as a declared redaction:**
1. The program gives the gateway a **screening sink**: a `ClientGatewayTraceSink` that wraps the recorder and
   screens synchronously before delegating. `record` is synchronous (`trace/types.ts:279-292`), and the
   screens are synchronous regex walks.
2. For an inbound `text` payload, parse it (the gateway's tap already has the parsed object, see section 6) and
   screen each string leaf, and each key, with `screenAutomationStudioLlmEvidence(leaf, [])`.
   - Nothing found: keep `encoding: "text"` unchanged, which keeps full fidelity.
   - Anything found: store the event as `encoding: "json"` with each offending leaf replaced by a marker. Card
     numbers may be replaced inside the string with `automationStudioWithoutCardNumbers`. Add
     `redactions: [{ path: <JSON pointer>, reason: "secret" }]` (`trace/types.ts:171-175`; reason vocabulary
     `trace/vocabulary.ts:38`).
   - The raw text of such an event is never stored, which is the same rule D7 uses for credentials. The
     completeness evaluator then reports a `redaction_limited` fidelity limitation, not an issue (D6;
     `trace/types.ts:326-332`).
3. D7 credentials are handled by the gateway tap itself, not the program screen, because the gateway knows the
   protocol: `client.hello.payload.token` (`packages/contracts/src/client-gateway.ts:32`) and
   `server.session_ready.payload.token` (`:566`). They are recorded as `json` with `{ redacted: "credential" }`
   and `reason: "credential"`.
   - I also recommend redacting `client.pairing_submit.payload.pairingCode` (`:552`), a short-lived pairing
     secret (my recommendation; not in D7).
4. Artifacts (screenshots, page snapshots) are bytes and are not screened as text. The extension's own sensitive
   capture marker covers page content. Whether snapshot payloads need the screen is for the extension lane
   (P2b).

### 5. Capture policy, and how a tracing flag can travel

**Policy contract.**
- `AutomationStudioRecordingCapturePolicy` (`packages/contracts/src/recording-capture/policy.ts:25-30`) has
  three capture switches plus `directRequests: { allowed }`.
- The default (`default-policy.ts:9-14`) allows every capture switch and turns each on, and forbids direct
  requests.

**How the extension learns it.**
- The paired endpoint `get-recording-capture-policy` (`apps/web/src/lib/program-route.ts:125-127`; handler
  `AS/api/handlers/recordings.ts:13-20`).
- The handler reads `dependencies.recordingCapturePolicy?.(projectId)` (`AS/api/handlers/dependencies.ts:27-32`).
  A grep found no producer of that dependency, so it always answers the default.
- `server.session_ready` carries only `{sessionId, token, projectId?}` (`packages/contracts/src/
  client-gateway.ts:566`; sent at `pairing-flow.ts:188-192` and `lifecycle.ts:161-165`). No capability or
  policy rides on it.

**Host flags.** Core reads `process.env` once, where the host builds the runtime:
- `FLUXIQ_CLIENT_GATEWAY_ENABLED !== "false"` (`programs/_shared/runtime.ts:88`);
- `FLUXIQ_CLIENT_GATEWAY_TRUST_TTL_MS` (`:79`);
- `FLUXIQ_PUBLIC_CLIENT_WS_URL` (`:91`);
- the candidate hook's names as a frozen constant object (`candidate-start-hook/environment.ts:12-15`),
  validated at start and refusing a half-set configuration (`from-environment.ts:44-53`);
- `FLUXIQ_LLM_STEP_LOG_DIR` (`AS/runtime/llm/step-log/directory.ts:12`).

The Lab sets these when it launches Core; the Lab side is P2b.

**How a tracing-mode flag can travel to the extension.** There are two options:
- (a) **In-band per command (recommended).** When the dispatching context has an open trace and the session
  declared a page-snapshot capability, the outbound action command carries a trace marker (for example
  `trace: { snapshot: true }`). The extension then snapshots exactly the traced observations and reads, with no
  project-level state. This is a wire-protocol change, kept in sync per `AGENTS.md`: contracts, background,
  domain, capabilities, tests and docs.
- (b) **Policy field.** Add `tracing: { enabled }` to the capture-policy contract and endpoint, read before
  capture. It is simpler, but project-level and not episode-scoped.

The choice of option sits with the lead and P2b. Core gets the switch from `FLUXIQ_CLIENT_GATEWAY_TRACE` either
way.

### 6. Recommended design

**Gateway option shape** (`client-gateway/service/types.ts:18-58` gains one field):

```ts
// client-gateway/trace/capture-source.ts (new; exported from trace/index.ts)
export type ClientGatewayTraceCaptureSource = {
  /** The open trace the dispatching async context records into, read synchronously as `hostLease` and `channelScope` are. */
  current(): ClientGatewayTraceSink | undefined;
};
// ClientGatewayServiceOptions
trace?: ClientGatewayTraceCaptureSource;   // unset: capture is inert, zero work
```

**Gateway-internal tap** (`client-gateway/service/trace-tap/`, new). It owns routing so the program does not have
to.
- **Outbound.** At `ClientGatewayTransport.send`, `sendChecked` and `sendUnqueued` (`service/transport.ts:31,37,
  50`), record into `current()`. Then *claim* the session for that sink, keyed by `clientId` as well as
  `sessionId` so the claim survives a reconnect, and remember `commandId → sink`.
  - Lease and channel refusals are recorded as `refused_unsent`: `commands.ts:109,112,230-252`.
- **Inbound.** At `ClientGatewayInbound.receiveRaw` (`service/inbound.ts:51-54`), after the synchronous
  `JSON.parse` (`:52`) and before the `await`:
  - `client.action_result` and `reconcile_result` go to the sink found by `commandId`;
  - everything else goes to every open sink that claims the session;
  - a parse failure goes to the claimants as `parse_failed`.
  - The raw string is what gets recorded. The disposition is recorded after `receive` (`:56-70`).
- **Lifecycle.** `connect` and `disconnect` (`service/lifecycle.ts:54,90`), approval (`pairing-flow.ts:79`) and
  revocation (`access.ts:62-71`), routed to claimants. A first hello before any claim is recorded nowhere: a
  declared limitation, and D7 already declares the lifecycle scope a fidelity limitation.
- **Synthesized outcomes.** `answerNeverCame` (`commands.ts:189-200`), `close` (`:169-178`), and durable
  `uncertain` and `accept` suppression (`service/command-ledger/dispatch.ts:63-65,82-87,117-133`), all routed by
  `commandId`.
- **Sequence.** The tap asks each sink to `record`, and the sink assigns its own per-trace sequence. This
  supersedes the gateway-wide counter proposed in inventory §5.3, per D5.
- **Claims.** A claim is dropped once its sink answers `refused: closed`.
- **Constraints.** The tap never throws into the gateway (the sink contract already says so; `trace/types.ts:
  246-250`). It applies D7 credential redaction itself.

**Episode lifecycle and store** (program side, per `code-structure.md`: storage in `storage/`, orchestration in
`runtime/`):
- `AS/storage/project/gateway-trace/` (new; `storage/project/` is at the 25-file budget):
  - `schema.ts`, migration `0027_client_gateway_traces`. Tables:
    - `client_gateway_traces`: trace id, episode id, activity, origin, started and closed times, claimed
      completeness, manifest JSON;
    - `client_gateway_trace_events`: primary key (trace_id, sequence), plus stream, kind, message_type,
      command_id, recording_id, causation_event_id, and event JSON inline below 256 KiB (the threshold of
      `AUTOMATION_STUDIO_OBJECT_THRESHOLD_BYTES`, `object-store.ts:9`), else a content-store object id;
    - `client_gateway_trace_artifacts`: trace, artifact id, object id, sha256, bytes.
    - Indexes on (trace_id, command_id), (trace_id, recording_id) and (trace_id, causation_event_id).
  - `store.ts`: `AutomationStudioProjectGatewayTraceStore implements ClientGatewayTraceStore`, opened with
    `{ pool, projectId }` on the migrations-append pattern. Artifacts are written through
    `AutomationStudioProjectContentStore.putBytes` with an owner reference, which pins them. Also
    `deleteTrace`.
  - `index.ts`, `tests/`, and one export line in `storage/project/index.ts`.
- `AS/runtime/gateway-trace/` (new; named so as not to collide with the executor's "trace", D2):
  - `episodes.ts`: `AutomationStudioGatewayTraceEpisodes`. An `AsyncLocalStorage` frame holds the open
    recorder; the class exposes `run(episode, work)`, a pending frame that is named at bind (for runs), and
    `gatewaySource`. It owns the flush policy (timer plus every N events; `flush` on close) and the
    termination mapping (`AbortError` → `cancelled`, a thrown error → `failed`, a settled status →
    `completed`).
  - `screen.ts`: the screening sink (section 4).
  - `registry.ts`: open episodes by `runId` and by `[projectId, flowId]`, used to route HTTP run control.
  - `ingress.ts`: `control` events for append-turn, run control, the screenshot artifact and the start-hook
    answer.
  - `environment.ts`: `FLUXIQ_CLIENT_GATEWAY_TRACE`, parsed and validated like the start hook.
  - `index.ts`, `tests/`, and one export line in `AS/runtime/index.ts`.
- **Nesting.** A trial opened inside a build replaces the frame for its own work, as channel scope does
  (`channel-scope.ts:25-28`). The build trace records `control` markers when a child episode opens and closes,
  carrying the child's trace id.
- **Store choice.** The store is chosen per episode from `projectId`. Without a pool (in-process tests) the
  memory store is used, or capture is refused.

**How tracing is switched on.**
- `programs/_shared/runtime.ts` reads `FLUXIQ_CLIENT_GATEWAY_TRACE` beside `:88`, constructs the episodes object
  over the service's project pool, and passes `trace: episodes.gatewaySource` to `ClientGatewayService`
  (`:80-92`).
- It also wraps `prepareCandidateStart` (`:70`) with the ingress decorator.
- Unset means no source is passed and `run` simply calls `work`, so there is zero overhead.
- The Lab sets the variable for every live run (P2b).

**Hard constraint: `AS/runtime/service.ts` is frozen in `.structure-baseline.json`.**
- File lines: 4318, exactly its length today (`.structure-baseline.json:307`).
- Class methods: 221 (`:179`).
- Statement packing: 44 (`:701`).
- Every hook there must therefore be a net-zero in-place expression edit:
  - `service.ts:1494`: replace `withAutomationStudioBuildActivity(` with a wrapper that opens the build episode
    and mints the build id.
  - `service.ts:1568`: `buildId = <ambient episode id> ?? \`build.${randomUUID()}\``, so one id names the build.
    This also fixes the first-look commands before `:1568`.
  - `service.ts:2480`: replace `bindAutomationStudioActivityRun(session.runId)` with a combined bind that also
    opens the run trace (pending frame entered at `:2452`).
  - `service.ts:1587`: a `traceEpisode` property in the trial environment's ports.
  - No new methods.

**Trials.** Open the trial episode around execution in `candidate-trial/run.ts:131-137` and
`subflow-trial/run.ts:166-180`, through an optional port added to their contracts. The start hook and the site
reset stay in the build trace (section 3).

**File partition for implementation.**

| Unit | Owns | Depends on |
| --- | --- | --- |
| G, gateway | `client-gateway/trace/capture-source.ts`, `client-gateway/trace/index.ts` (+1 line), `client-gateway/service/trace-tap/**` (new), `client-gateway/service/{types,transport,inbound,lifecycle,commands,pairing-flow,access}.ts`, `client-gateway/service/command-ledger/dispatch.ts`, `client-gateway/service.ts` (collaborator wiring, `:75-103`), `apps/web/src/server/client-gateway-websocket.ts` (`:144`) | Nothing. Proven with the memory store. |
| S, storage | `AS/storage/project/gateway-trace/**`, `AS/storage/project/index.ts` (+1 line) | Trace types only. |
| R, runtime | `AS/runtime/gateway-trace/**`, `AS/runtime/index.ts` (+1 line) | G's source type, S's store, and the screen (read-only import from `AS/runtime/llm/index.ts`). |
| W, wiring and handlers (after G, S and R) | `programs/_shared/runtime.ts`; `AS/runtime/service.ts` (in-place only, as above); `AS/runtime/service/candidate-trial/{contracts,run}.ts`; `AS/runtime/service/subflow-trial/{types,run}.ts` (unverified which file holds the ports type); `AS/runtime/parking/conversation-port.ts`; `AS/api/handlers/{conversations,run-control,runtime-execution,llm-generation}.ts`; `AS/runtime/service/object-documents.ts`; `apps/web/src/app/api/programs/automation-studio/state-assets/[projectId]/[sha256]/route.ts` | G, S, R |

`AS/api/handlers/` also holds 25 files, so add no new file there; edit in place.

**Lane t737: avoid.**
- Its Core tree (`fxwork/t737/!FluxIQ`) currently modifies `AS/runtime/llm/step-log/index.ts` and adds
  `AS/runtime/llm/step-log/reset-step.ts` with a test (`git status`).
- Its brief item 5 is "a reset span inside `core.test_subflow`/`core.test_candidate`". The reset and start calls
  sit at `AS/runtime/flow-bootstrap/candidate/trial-gate.ts:428-430` and
  `AS/runtime/flow-bootstrap/subflow-candidate/subflow-trial-gate.ts:481`. t737 may yet edit those two files
  (unverified).
- None of the units above touch `llm/step-log/**`, `trial-gate.ts` or `subflow-trial-gate.ts`.
- `candidate-trial/run.ts` and `subflow-trial/run.ts` are adjacent: check t737's diff before unit W edits them.

## Commands run and observed results

All commands were read-only:
- `git log --oneline -3` in the Core worktree printed `ca23a8ba Merge task t734: trace-consumer-wiring` at the
  top.
- `grep`, `sed -n`, `cat -n`, `ls` and `wc -l` over the files cited above.
- A per-directory file count printed:
  - `AS/storage/project`: files=25 dirs=10;
  - `client-gateway/service`: files=22;
  - `AS/runtime`: files=23 dirs=30;
  - `AS/api/handlers`: files=25.
- `.structure-baseline.json` showed `service.ts` file-lines 4318 and `wc -l` printed 4318.
- `git status --short` in `fxwork/t737/!FluxIQ` printed ` M .../llm/step-log/index.ts`,
  `?? .../llm/step-log/reset-step.ts` and `?? .../llm/step-log/tests/reset-step.test.ts`.

No tests or builds were run; the brief named no check, since this was a read-only map.

## Not verified

- Whether any scheduled job calls `sweepUnreferencedObjects` (a grep found none outside `storage/`).
- Whether a normal run dispatches any client command before admission and bind (`service.ts:2452-2480`). The
  design assumes it does not.
- Parked-and-resumed asks (`parking/parked-run.ts`, `runtime-session/parked-wait.ts`); only the in-place
  `awaitAnswer` path was read.
- Whether the websocket frame handler keeps arrival order through `void this.handleFrame(frame)`
  (`client-gateway-websocket.ts:185`), which matters for "sequence = delivery order".
- Run admission rules for concurrent runs of one project (`runtime-session/admission.ts`, not read).
- Whether the project database has a write-authority guard that a new store must respect
  (`storage/project/authority-guard/`, not read).
- Which file holds the subflow trial ports type (`subflow-trial/types.ts` or `port.ts`).
- The overhead of screening large inbound payloads; it is for P2's measurement gate.

## Open questions or contradictions found

1. **Build episode id.**
   - **Contradiction.** The manifest says episode ids are live run ids, but a build has no run id and three
      unrelated build ids (section 2).
   - **Decision needed from the lead.** Make the build's episode id `build.<uuid>`, minted at episode open and
     used at `service.ts:1568`, so that one id names the build in the trace, the evidence frame and the step
     logs.
2. **Ordering contradiction.** Inventory §5.3 proposed one gateway-wide sequence; D5 makes it per trace. With
   several open traces claiming one session, each copy carries its own sequence. Cross-trace order is then only
   `observedAt`. Accept this, or add a gateway-wide `deliverySequence` field to the event envelope (a contract
   change in `trace/types.ts`).
3. **Session claims and overlap.** Two parallel briefs on one browser session both claim it, so unsolicited
   inbound (`state_update`, snapshots, recording events) is recorded into both traces. The alternative is
   routing by the host lease's `sessionId` where a lease names one. This needs a decision.
4. **Screenshot digest.** The PUT stores an upload before checking its expected digest
   (`object-documents.ts:67-71`). This is a small existing defect, worth fixing in unit W.
5. **Capture policy is never project-specific.** `recordingCapturePolicy` has no producer, so the policy
   endpoint always answers the default. That is fine for traces, but the policy is not configurable today.
6. **Plan text.** D1 says the start hook's answer is captured "where Core accepts it". It is accepted in the
   build's context before the trial run exists, so it belongs to the build trace with a correlation, not the
   trial trace (section 3).
