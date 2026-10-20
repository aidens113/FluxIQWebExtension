# Lane T, P2b: extension and Lab map for page-snapshot tracing

## Outcome

Done, read-only. All eight items are mapped below with file:line references, and the report ends with a recommended
design. Paths are relative to the t736 downstream tree unless they start with `Core:`, which means
`C:/Users/osrs_/FluxStuff/fxwork/t736/!FluxIQ/`. "Unverified" marks every claim I did not trace to the end.

Five findings change the design:

1. **An unknown top-level key on an action result loses the whole result.** On the durable path, Core's `parseResult`
   throws on any key outside its allowlist, `accept` catches it and returns `"suppressed"`, and the command is left
   to time out (Core: `packages/fluxiq/src/client-gateway/service/command-ledger/dispatch.ts:85-86`, `:206-208`). So
   trace references must go under `metadata`, never in a new top-level field.
2. **`metadata` is mostly safe from the model, but it does reach recordings.** The domain's dispatcher throws away the
   client's `metadata` (`domain/src/io/gateway-output-dispatcher.ts:79`), and the evidence tools read only `status`,
   `payload` and `failure`. But Core's bridge copies `result.metadata` into recording action entries whenever a
   recording is active (Core: `programs/automation-studio/client-gateway/bridge.ts:727`). Core should therefore strip
   `metadata.trace` when the result comes in.
3. **`state-assets` accepts only images, scoped to a project.** It takes png, jpeg, webp and gif, and HTML and CSS
   get a 415. The route needs a project and the cookie-or-bearer project check. A page document cannot use it as it
   stands.
4. **The offline flush mints a new id and timestamp for each queued message.** The flush passes only the message's
   `type` and `payload` to `client.send`, and `send` mints a new `id` and `timestamp` (Core:
   `packages/client-gateway-websocket/src/connection/connection.ts:210` and `src/transport.ts:97-101`).
5. **The capture must stay off `BrowserActionResult`.** That object travels raw into recording evidence
   (`background/connection/gateway-payloads.ts:60`) and into `recordEvent` (`server-command-channel.ts:351`). Keep the
   page capture out of it and handle it in the background.

## What changed and why

No code changed. I wrote this report only.

### 1. Observation and read sites

**Action types that observe or read.** The domain classifies these as `observe` in
`domain/src/output-nodes/definitions.ts:167-175`: `web.dom.scroll`, `wait_for_selector`, `wait_for_text`, `extract`,
`extract_list`, `capture_snapshot` and `assert`. The extension's own list of non-mutating actions is in
`apps/extension/src/runtime/action-runner.ts:571-577` and leaves out scroll. The model's tools reduce to these:

- look: `capture_snapshot` with `{}` (`domain/src/runtime/llm-evidence/capture.ts:541-545`)
- find and describe: `capture_snapshot` with `includeHidden: true` (`page-find/run.ts:37`, `page-find/run-description.ts:20`)
- detect structure: `capture_snapshot` with `detectStructure` (`structure/detect.ts:199`)
- act then look: `actAndCapture` (`capture.ts:696`, then `captureAfterAction`)
- failure evidence: `capture_snapshot` (`tools.ts:646-660`)
- the Flow runtime's state read before and after an action: `capture_snapshot` (`domain/src/runtime/host-runtime.ts:190-200`)

**Fact checks** (`evaluate_facts`) are reads too. They travel inside `server.execute_action`. The gateway session maps
them at `background/connection/gateway-session.ts:129-139`, they run in `runtime/fact-check-runner.ts:79` (the
`FACT_CHECK_MESSAGE` to the page), and they are answered through `sendGatewayResult` (`runtime/command-router.ts:76-89`,
`server-command-channel.ts:213-225`, `:309`). They never pass through `sendActionResult`.

**Legacy `server.capture_snapshot`.** Core's transport sends it for its `capture_snapshot` and `read_state` commands
(Core: `packages/fluxiq/src/runtime/client-gateway-transport.ts:75-85`; domain `runtime/adapter.ts`
`captureWebAutomationSnapshot`). The extension runs it at `server-command-channel.ts:193-212` through
`recording-evidence.ts:202-214`, which answers with `client.snapshot` rather than an action result.

**Content-script production.**
- Message entry: `apps/extension/src/content/message-handler.ts:136-143` (`executeAction`). The frame merge uses
  `captureSnapshot` at `:131-134`, and fact checks use `:145-153`.
- Verb routing: `content/actions/execute.ts:266-319` (`routeContentAction`), wrapped by `executeContentAction` at
  `:146`.
- Every result goes through `buildResult` at `content/action-runtime/results.ts:569-605`. It attaches the structured
  `DomSnapshot` when the action failed or snapshot capture is on (`:594-595`).
- Capture verb: `content/actions/capture-snapshot.ts:18-25`.
- Dependencies are wired at `content/action-runtime/execute-action.ts:37-62`.

**Background assembly and send.**
- `ServerCommandChannel.handleCommand` handles `execute_action` at `server-command-channel.ts:226-265`. It calls
  `runtimeRouter().executeAction`, which goes to `runtime/command-router.ts:43-68`, then `runBrowserActionCommand` in
  `runtime/action-runner.ts:84-173`.
- Inside that, the frame send is `runActionInFrame` at `:409-454`, then `sendAction` at `:479-500`, and the merged look
  is `lookAcrossFrames` at `:156` (the merge itself is `server-command-channel.ts:316-323`).
- The result comes back to `ServerCommandChannel.sendActionResult` (`server-command-channel.ts:327-353`). That method
  finishes the status, runs the test-only boundary hook `captureActionBoundary("after")` (`:333`), maps the result with
  `gatewayActionResultFromBrowserResult` (`runtime/result-mapping.ts:49-77`), sends `client.action_result` (`:338`),
  settles reconciliation (`:340`), and then records the event (`:342-352`).
- Lease refusals go out directly (`:220`, `:238`). Rejections go out from `gateway-session.ts:146-150`.

**Where a "capture the page now" step fits.** There is one choke point for every web action:
`sendActionResult`, between `:333` and `:337`. The existing `captureActionBoundary` dependency
(`ServerCommandChannelDeps`, `:69`, implemented in `background/action-evidence.ts:26-64` as a test-only port that only
`packages/test-runner/src/demo-workspace/browser-session.ts` connects to) is the model to copy: a dependency the
channel awaits at that point. Fact checks need the same call in the `sendGatewayResult` path at `:309`, or before
`command-router.ts:82`.

The alternative is to capture inside the page, in `buildResult` (`results.ts:569`), in the same task as the verb.
That gives the exact document the verb read, but it puts the capture on `BrowserActionResult`, which leaks (finding 5),
and it adds the serialization to every action's latency.

**Cost.** The page view the extension already sends is not this capture. `payload.snapshot` is a structured element
list (`content/dom-snapshot.ts`), which the domain sanitizes into the page view (`capture.ts:553-560`). Core's trace
gets it in-band with the `client.action_result`. The tier-2 page document (HTML, a resource map and form state) is new
work. Measured in the spike (`reports/lane-t-u3-snapshot-spike.md`, "Sizes and capture time"):

- capture time: 24 to 154 ms in total, 6 to 118 ms of it in the page
- document size: 32 to 193 KB raw, 7 to 18 KB gzipped
- carried images: up to about 72 KB of re-encoded PNG on the store page

The spike serializer is `apps/extension/e2e/content/tests/snapshot-fidelity/tests/serialize-document.ts:44`. It
withholds only password and file values (`:147`), so the sensitivity rule still needs to be applied (see the design).

### 2. Uploads: the state-assets PUT path

- **Client:** `background/connection/core-api.ts:77-104`. It sends `PUT
  /api/programs/automation-studio/state-assets/{projectId}/{sha256}` with `content-type`, `x-content-sha256` and the
  bearer pairing token, and expects `payload.contentRef`. Its only caller is `StateAssetStore.captureFreshVisualSample`
  (`state-assets.ts:29-58`), which hashes with SHA-256 hex at `:87-90`.
- **Content addressing:** the address is the SHA-256 of the raw bytes, in lowercase hex. The route checks the format
  (Core: `apps/web/src/app/api/programs/automation-studio/state-assets/[projectId]/[sha256]/route.ts:51-52`). The
  service checks that the stored digest matches the requested one (Core: `runtime/service/object-documents.ts:68-71`,
  409 at route `:81`). Core's trace artifact digest uses the same hex SHA-256 (Core:
  `client-gateway/trace/artifact-digest.ts:8-9`), so the addresses agree.
- **Dedupe:** this happens on the server only. `putBytes` returns the existing reference when it already holds the
  same sha256 at the same size (Core: `programs/automation-studio/storage/object-store.ts:51-54`). The client always
  uploads the bytes: there is no exists check. GET needs a cookie session (route `:21-25`), so a paired extension
  cannot probe for an object.
- **Size and media types:** at most 20 MB (route `:15`, `:59-68`). Only `image/png|jpeg|webp|gif` are accepted (route
  `:16`, `:54-57`, 415 otherwise), and the service checks again
  (`isAutomationStudioRenderableAssetMediaType`, object-documents `:63-65`).
- **Scope:** the PUT is bound to a project. A bearer client must belong to that project (route `:100-102`) and to its
  domain (`:104-107`). The object is filed under the session's active recording when there is one (route `:108`, object
  store path `:58`).
- **Ordering:** today the upload finishes before the referencing message. `createStateFromDomSnapshot` awaits the
  upload (`recording-evidence.ts:270`) before it builds the state (`:291`) and sends it. The PUT runs outside the
  socket and outside the offline queue.
- **Verdict:** page documents (`text/html`), stylesheets (`text/css`) and fonts cannot use this route today.
  Same-origin images can, as their original bytes. Storing each object once per sha256 works per project on the
  server, but bandwidth is not saved unless the extension remembers what it already uploaded. To carry traces, Core
  needs either a trace-artifact route (bearer, session-bound, writing through `recordArtifact` and `writeArtifact`;
  Core: `client-gateway/trace/types.ts:287`, `:345`) or a wider media-type set on this route. That decision belongs to
  the P2a Core lane.

### 3. How action results reach Core and the domain

- **Wire type:** `ClientGatewayActionResult` has `metadata?: JsonObject` (Core: `packages/contracts/src/client-gateway.ts:154-168`).
  The extension sets no `metadata` on browser results (`result-mapping.ts:49-77`). Only rejections set one, with
  `requestedActionType` (`:37-46`).
- **The payload is an allowlist.** `webAutomationActionResultPayload` copies named fields only
  (`domain/src/client/gateway-mapping.ts:329-357`). An extra field on `BrowserActionResult` never reaches `payload`,
  but it does reach `recordingEvidencePayload`'s raw `actionResult` (`gateway-payloads.ts:44-64`, `:60`) and the
  `action.result` recorded event (`server-command-channel.ts:342-352`).
- **Core intake:** `inbound.ts:103-113` reads `interrupted`, runs `commands.settle`, and then emits the
  `client.action_result` event with the whole result to listeners (`:112`).
- **The durable allowlist:** `["commandId","status","startedAt","completedAt","message","target","payload","error","clearedWait","failure","metadata"]`
  (dispatch.ts:207). An unknown top-level key throws `durable_command.invalid_result`, which `accept` turns into
  `"suppressed"` (`:85-86`). Nothing is filtered: the answer is lost, and the command eventually times out as unknown.
  The command allowlist has `metadata` too (`:201`).
- **The non-durable runtime transport** keeps `...result`, `metadata` included (Core: `runtime/client-gateway-transport.ts:70-73`).
- **What the domain reads:**
  - `dispatchWebAutomationOutput` returns `metadata: { sessionId }` only and drops the client's `metadata`
    (`domain/src/io/gateway-output-dispatcher.ts:79`). The runtime adapter's merge of `result.metadata`
    (`domain/src/runtime/adapter.ts:128-131`) therefore sees `{sessionId}` only.
  - The evidence tools read `status`, `payload.snapshot`, `payload.sourceId` and `failure` (`capture.ts:541-574`), and
    `WebFailedActionResult` declares `status`, `failure` and `payload` (`action-failure/result.ts:13-27`).
  - `host-runtime.ts:215` reads `result.metadata.sessionId`. That is the dispatcher's metadata, not the client's.
- **Where client `metadata` does land in Core:**
  - Recording action entries, when a recording is active (`bridge.ts:727`).
  - Attempt records on the generic runtime path (Core: `runtime/attempt-withholding.ts:68`).
  - Every `client.action_result` event listener (`inbound.ts:112`).
  - Unverified: whether any of these reach model guidance. Recordings are build evidence, so this is plausible.
- **Conclusion:** a `metadata.trace` reference list does not reach the domain's model evidence. To keep it out of
  recordings and listeners, Core should take it off at `inbound.ts:103-113`, before `settle` or the emit, after
  handing it to the trace recorder (P2a).

### 4. Tracing-mode flag

- **Recording capture today:** `CapturePolicySource` (`background/capture-policy/capture-policy-source.ts:27-60`)
  calls the paired program endpoint `get-recording-capture-policy` (`:16`, `:48`; Core endpoint
  `programs/automation-studio/api/contracts/endpoints.ts:84`). It parses the answer strictly (`read-capture-policy.ts:9-18`:
  extra keys are ignored, and a malformed answer keeps the previous policy). It refreshes on session ready
  (`background/connection.ts:171`) and on each recording start (`:468`).
  - The policy is applied through `effectiveSettings` (`capture-policy/effective-settings.ts:25-39`) and through
    `allowedCapture` (`connection.ts:353`).
  - It reaches the page in the `recording` message (`content/message-handler.ts:115-130`), which clamps it again.
- **`requestsEnabled`** is the person's stored switch, clamped by the policy's `directRequests`
  (`capture-policy/requests-choice.ts:11-15`, `effective-settings.ts:30`, `background/index.ts:186`).
- **`server.session_ready`** carries `{sessionId, token, projectId}` only (Core contracts `client-gateway.ts:566`).
- **Where a tracing flag would be read:**
  - (a) A new optional `tracing` part in the capture-policy answer. `readCapturePolicy` would read it, and the
    channel would ask `capturePolicy.current()`. This is session-coarse and depends on an HTTP read whose timing is
    loose.
  - (b) Per command, beside the action, the way the lease rides. The gateway session strips every unknown field off
    the mapped action and passes only the lease (`gateway-session.ts:141-146`, `withLease`). A trace request in the
    command's `metadata` (allowed: dispatch.ts:201) can be lifted at the same place and passed into
    `handleCommand`, then on to `sendActionResult`. Unverified: that Core forwards `command.metadata` to the client
    unchanged in `server.execute_action`.

### 5. The offline queue (after lane G)

- **Queue:** `ClientGatewayOutbox` (Core: `packages/client-gateway-websocket/src/outbox/outbox.ts:46-207`).
  - Each entry is `{binding, message, bytes}` (`outbox/types.ts:234-238`), and `message` is the full envelope with
    its `id` and `timestamp`.
  - The envelope is minted when the message is queued, by `createClientGatewayMessage` (`src/messages.ts:16-31`,
    called from `connection/connection.ts:179`), and queued at `:181`.
  - The binding check (lineage, project, recording) is `outbox/deliverable.ts:278-296`.
- **Extension store:** `chrome.storage.session` under `fluxiq.outbox` (`background/connection/outbox/store.ts:15-33`).
  The budget is 80% of the session quota (`outbox/byte-budget.ts:15-21`) and the count limit is 1,000
  (`shared/constants.ts:7`). It is wired in at `background/connection.ts:154-161`.
- **Flush:** `FluxIQClientGatewayConnection.flushQueue` (Core `connection/connection.ts:203-214`) runs on session
  ready (`server-command-channel.ts:162`). `outbox.flush` (`outbox.ts:116-141`) calls `send(deliver[i].message)`
  (`:132`).
- **The re-mint.** The flush's `send` is `(message) => client.send(message.type, message.payload)` at
  `connection/connection.ts:210`. `ClientGatewayWebSocketClient.send` (`src/transport.ts:91-111`) builds a new
  envelope:
  - a new `id` at `:98`
  - a new `timestamp` at `:101`
  - the current `sessionId`
  - and it drops any queued `correlationId`, because no options are passed.

  The fix is two edits: `transport.ts` `send` accepts `{ id, timestamp, correlationId }` (or a new
  `sendEnvelope(message)`), and `connection.ts:210` passes the queued envelope's values through. `sessionId` should
  stay the current socket's, because Core mints one per socket (`outbox/types.ts:214-218`). Unverified: whether
  Core's intake de-duplicates by envelope `id`.

### 6. The Lab

- **Entry:** `pnpm lab`, which is `scripts/lab/run-lab.mjs`. It runs the build phase and the live-run guards
  (`admitLiveRunOrExit`, `:272-285`, which return null when no provider call is made), then starts the runner.
  `runScenario` calls `startTopology` (`packages/test-runner/src/run-scenario.ts:237`) for live and provider-free runs
  alike.
- **Core launch:** `startTopology` (`packages/test-runner/src/coordinator.ts:80-191`) starts the Scenario Lab
  (`:129-132`) and then Core (`:141-145`, `coreWebServerProcessSpec`), with `env: buildFluxIQEnvironment(...)`.
- **Env vars**, set by `buildFluxIQEnvironment` (`packages/test-runner/src/environment.ts:131-166`):
  - `FLUXIQ_BUILD_PROGRESS_TRACE=1`
  - the inherited environment, minus provider secrets and the step-log, model, authoring-mode, call-limit and
    start-hook variables (`:141`)
  - the cost ceiling and its scope (`:145-146`) and the build call limit (`:147`)
  - `FLUXIQ_MODEL_PROVIDERS_ENABLED`
  - the default model and authoring mode
  - the candidate start-hook endpoint and token (`:151`, `:175-181`)
  - `FLUXIQ_LLM_STEP_LOG_DIR`
  - `PORT`, `FLUXIQ_ROOT`, the importer, host and data directories, `FLUXIQ_HOST_MODULE`
  - `FLUXIQ_CLIENT_GATEWAY_ENABLED`, `_HOST`, `_PORT`, `_PATH`, and `FLUXIQ_PUBLIC_CLIENT_WS_URL` (`:153-164`)
- **Extension launch:** `run-scenario/browser-session/launch-browser.ts:34` (`launchPersistentContext` with
  `--load-extension`, headed by default). Nothing tells the extension about tracing. It must learn from Core (item 4).
- **The one place to turn tracing on:** the object `buildFluxIQEnvironment` returns (`environment.ts:142-165`). Put
  the Core trace variable (named by P2a) after `...inherited`, so an inherited value cannot switch it off.
  - Every Lab-started Core goes through this function: `coordinator.ts:143`, which serves run, replay, interactive,
    the chat check, perturbations and the recovery matrix, and `demo-workspace/core-process.ts:124`.
  - For the off-versus-on measurement, add a `tracing?: boolean` to `TopologyPaths` and `TopologyOptions`, true by
    default, passed down the way `stepLogDirectory` is (`coordinator.ts:143`).
  - Exception: the `existing` target starts no Core (`coordinator.ts:204`), so tracing cannot be set there.

### 7. Provider-free measurement route

- **Recommended:** `pnpm lab replay <scenario> --workspace <name> --flow <id> [--instruction-task <id>]`. The CLI is
  `packages/test-runner/src/cli.ts:53-55` and `commands.ts:120-127`, and the implementation is
  `saved-flow-replay/replay-saved-flow.ts`.
  - It starts a fresh Core with `modelProvidersEnabled: false` (`:155-161`). It refuses to start if a provider
    credential is in the environment (`:139-141`) and requires zero provider accounting (header `:11-12`).
  - It runs the saved Flow on a realistic scenario (`cli.ts:33`, the realistic-only check) through Core's runtime,
    the gateway and the real extension, and judges the result as its task is judged.
  - It exercises:
    - `capture_snapshot` state reads before and after each step (`host-runtime.ts:190-200`)
    - `extract_list` and `extract` reads
    - assert and wait steps
    - fact checks (`runtime/facts/evaluate.ts:119`)
    - every mutation through `sendActionResult`
  - It does not exercise the evidence tools (look, find, describe, detect structure). Those issue the same
    `capture_snapshot` command with different parameters, so the extension's capture path is identical.
  - It goes through `startTopology` (`replay-saved-flow.ts:155`), so the item 6 toggle applies.
  - It needs a Flow saved in a persistent workspace by an earlier persistent-isolated build. Unverified: whether this
    tree's runs directory holds four. I did not look in the lane trees. `--target clone --workspace --flow`
    (`commands.ts:20`, `run-scenario/clone-target/`) can import a saved Flow into an isolated Core. Unverified: whether
    that path is provider-free.
- **For the in-page cost only:** `node scripts/test-content.mjs -- --headed --workers=1 snapshot-fidelity`, run from
  `apps/extension` (the spike's harness). It runs the real content script on four realistic pages with no Core and
  no background.
- **Unsuitable:**
  - `pnpm ui:e2e`: its journeys open `product-catalog`, `llm-target-drift` and `instruction-only-form`, which are not
    realistic scenarios (`ui-e2e/realistic-selection.ts:16-23`, `journeys/recorded-task.ts:57`, `:74`).
  - `demo:run`: it uses a demo workspace. Unverified, and not realistic-scoped.
  - The zero-call replay of a live run (`--replays`): it needs a paid build first (`commands.ts:18`).

### 8. Collisions with lane t737

t737 owns four areas:
- `apps/extension/e2e/fixtures/extension-context.ts`
- the background start path, for the missing hello after a service-worker restart
- shown-addresses (`domain/src/runtime/llm-evidence/node-run/shown-addresses.ts` and the node-run build state)
- `scripts/lab/live-campaign/row/summarize-task.mjs`

| Proposed touch point | Collides? |
| --- | --- |
| Core `client-gateway-websocket/src/connection/connection.ts:210` (flush keeps the envelope) | **Likely.** It is the same file that handles hello and session ready (`:314-331`), where a missing-hello fix may land |
| Core `client-gateway-websocket/src/transport.ts:91-111` | Possible, if t737 fixes the hello in the transport |
| `background/connection/gateway-session.ts:141-146` (lift a per-command trace request) | Possible: the hello is built here (`:157`) |
| `background/connection.ts` constructor (wire a trace dependency into the channel at `:292-304`) | Possible, if "background start path" includes `FluxIQConnection` construction; `background/index.ts:56` constructs it |
| `server-command-channel.ts`, `result-mapping.ts`, new `background/trace-capture/`, `core-api.ts` | No |
| `content/message-handler.ts` (one new message), new `content/trace-capture/` | No |
| `packages/test-runner/src/environment.ts`, `coordinator.ts` (tracing toggle) | No |
| `extension-context.ts`, shown-addresses, `summarize-task.mjs` | Not proposed: measurement uses `lab replay`, and any overhead report gets its own reporter |

## Recommended design

1. **Flag (Core-owned, per command).** Core's trace recorder stamps `metadata.trace = { page: true }` on every
   command it traces. Command metadata is already allowed (dispatch.ts:201).
   - `GatewaySession.mapExecuteAction` lifts it beside the action, as it lifts the lease (`gateway-session.ts:141-146`).
     It covers fact checks too.
   - Firefox and older Cores send nothing, so nothing is captured.
   - Fallback if P2a prefers a session flag: a `tracing` part on the capture-policy answer, read through
     `CapturePolicySource.current()`.
2. **Capture point (background).** Add a `captureTracePage(commandId, tabId, frameId)` dependency on
   `ServerCommandChannelDeps`, awaited in `sendActionResult` after `:333` and before mapping at `:337`. Await it in
   the fact-check path at `:309` too, and for the legacy `client.snapshot` (`recording-evidence.ts:212`) if Core
   traces that.
   - The dependency sends one new content message, `fluxiq.tracePage`, to the top frame. The page side handles it in
     `content/message-handler.ts` with a productionized `content/trace-capture/serialize-document.ts`. The spike's
     serializer already carries same-origin frames.
   - Sensitive controls must be withheld using the same rule the result path uses, not only passwords and file
     inputs.
   - Images go as original bytes, fetched in the page, instead of canvas PNG.
   - Nothing is added to `BrowserActionResult`.
3. **Upload.**
   - The background hashes each part (document, stylesheets, same-origin images) with SHA-256 hex, the same hash as
     `state-assets.ts:87-90`.
   - It skips any hash already uploaded in this worker (an in-memory set per Core URL and trace).
   - It PUTs each part to a Core trace-artifact route (P2a), with the bearer token, bound to the session.
   - The upload is awaited before the result is sent, with a bound. A part that fails or times out is sent as a
     reference, and Core's completeness reports it missing.
   - Snapshot bytes never go into the socket outbox (8 MB session budget).
4. **Reference.** After `gatewayActionResultFromBrowserResult`, set
   `metadata: { trace: { page: { document: sha, resources: [{url, sha, mediaType}] } } }`. Never use a top-level key
   (finding 1).
   - Core takes `metadata.trace` off at `inbound.ts:103-113`, before `settle` and the event emit, so it never reaches
     recordings (`bridge.ts:727`), attempts or listeners.
   - The domain already drops client metadata (`gateway-output-dispatcher.ts:79`).
5. **Outbox.** `transport.send` takes the envelope's `id`, `timestamp` and `correlationId`, and the flush
   (`connection/connection.ts:210`) passes the queued values. This needs to be coordinated with t737.
6. **Lab.** Put the trace env var in `buildFluxIQEnvironment` (`environment.ts:142-165`), on by default, with a
   `tracing: false` topology option for the off measurement.
7. **Measurement.** Run `pnpm lab replay` on four realistic tasks with saved Flows, once with tracing off and once
   with it on. Record wall time per command and bytes uploaded per sha (deduped and total). Add
   `node scripts/test-content.mjs -- --headed --workers=1 snapshot-fidelity` for the in-page time.

## Commands run and observed results

Only read-only inspection: `grep`, `sed -n`, `cat -n`, `ls` and `wc -l` over the two t736 trees, plus
`git show ddf41bf4` for t737's brief. No builds, tests or Lab runs. Nothing printed is page data or a secret.

## Not verified

- Whether Core forwards `command.metadata` to the client unchanged in `server.execute_action`.
- Whether recording entries or attempt metadata reach model guidance.
- Whether Core de-duplicates envelope ids.
- The gateway socket's maximum frame size. `apps/web/src/server/client-gateway-websocket.ts` uses its own frame
  parser, and I found no limit.
- Whether this tree holds saved Flows for four realistic tasks, and whether the clone target is provider-free.
- Whether a content script can fetch same-origin image bytes with the page's credentials. The manifest has
  `<all_urls>` host permissions (`manifest.chrome.json`), so a background fetch is the alternative.
- Edge behaviour.
- How the missing-hello fix will be placed in t737.

## Open questions or contradictions found

1. The brief says the durable allowlist "suppresses unknown top-level keys". It actually suppresses the whole result
   (dispatch.ts:85-86, `:207-208`), which then times out. Any key added at the top level is a regression that loses
   the answer.
2. A small shape mismatch: `content/message-handler.ts:95-99` treats `directRequests` as an allowed-and-default switch,
   but `read-capture-policy.ts:75-77` produces `{allowed}` only, so `default` arrives undefined. Unverified whether
   anything on the page reads it. This is not related to tracing.
3. P2a must choose between a new trace-artifact route and widening state-assets. State-assets is bound to a project
   and to the active recording, while traces are bound to a gateway episode.
