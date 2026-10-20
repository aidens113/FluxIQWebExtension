# Lane T, U2b: runtime ports map

Brief: `lane-t-u2b-runtime-ports`. Core worktree read: `C:/Users/osrs_/FluxStuff/fxwork/t729/!FluxIQ`
(branch `task/t729-traces-offline-trials`, head `f1170cb1`). Unless a path says otherwise, it is relative to
`packages/fluxiq/src/` in that worktree. `AS/` means `programs/automation-studio/runtime/`. Downstream paths
(`domain/src/...`) are in `C:/Users/osrs_/FluxStuff/fxwork/t729/!FluxIQWebExtension`. I read them only to
follow a Core port to the place where it reaches the client. Line numbers in files that L1 (t724) is editing
will move when L1 merges.

## Outcome

Done. All five sections are written, and a recommended design closes the report. Nothing outside this
report was edited.

## What changed and why

Only this report changed. It maps every path along which the executor, the evidence loop and the trial
runner send a command to a client and read back a result. It finds where those paths meet, lists the other
nondeterministic inputs they read, proposes one environment port, and lists the call sites the wiring unit
will have to switch.

---

## 1. How each consumer sends commands and reads results

### Runtime kernel (`runtime/`)

- **`FluxIQRuntimeAdapter`** (`runtime/contracts.ts:202-222`) handles commands in the same process:
  `execute`, `executeWithCommandContext`, `captureSnapshot`, `readState`. Each one takes
  `FluxIQRuntimeCommand` (`contracts.ts:60-72`) and returns `FluxIQRuntimeCommandResult` (`contracts.ts:82-102`).
- **`FluxIQRuntimeTransport`** (`runtime/contracts.ts:224-235`) handles remote clients: `clients()`, `dispatch`,
  `dispatchWithCommandContext`, and `onEvent(FluxIQRuntimeEventHandler)`. The events, listed at
  `contracts.ts:237-249`, include `state.update`, `snapshot` and `recording.event`.
- **`FluxIQRuntimeClient`** (`contracts.ts:40-51`) is a descriptor only (id, session, capabilities). It has no
  methods.
- **`RuntimeService.dispatch`** (`runtime/service.ts:188-245`) is the kernel's single dispatch:
  - It chooses a target with `selectTarget` (`service.ts:256-265`). Adapters are tried first, then transport
    clients.
  - It calls the target through `dispatchToTarget` (`service.ts:267-286`), bounded by `withRuntimeBounds`
    (`service.ts:367-408`).
  - It records a command attempt (`service.ts:207-226`, `288-297`) and re-emits events (`service.ts:252-254`).
- **`ClientGatewayRuntimeTransport`** (`runtime/client-gateway-transport.ts:29-143`) is the only Core transport.
  - `dispatch` sends `execute_action` to `ClientGatewayService.executeAction` (`client-gateway-transport.ts:61-74`)
    and `capture_snapshot` to `ClientGatewayService.captureSnapshot`. The second is fire-and-forget: it returns
    `succeeded` without waiting for an answer (`client-gateway-transport.ts:75-85`).
  - It translates gateway events into runtime events (`client-gateway-transport.ts:118-138`).
  - It picks a session from `gateway.snapshot().sessions` (`client-gateway-transport.ts:103-116`).
- **Production wiring.** One `RuntimeService` is created with this transport and bound to Automation Studio
  (`programs/_shared/runtime.ts:58-60`). The web domain also registers a `direct` adapter,
  `web-automation.gateway` (`domain/src/runtime/service.ts:16-22`). Because adapters are tried first, that
  adapter wins every web command.

### Client gateway (where every command reaches a client)

- **`ClientGatewayService`** (`client-gateway/service.ts:61-259`) is a facade. These are its command and intake
  methods:

  | Method | Line |
  | --- | --- |
  | `snapshot()` (session view) | `:114` |
  | `onEvent` | `:161` |
  | `onLateActionResult` | `:171` |
  | `receive` / `receiveRaw` (the intake) | `:175-181` |
  | `captureSnapshot` | `:191` |
  | `executeAction` (plain and durable) | `:195-199` |
  | `reconcileAction` | `:209` |

- **Sending.** `ClientGatewayCommands.executeAction` (`client-gateway/service/commands.ts:89-113`) mints the
  command id (`:95`), stamps the host lease (`:97`) and arms the wait for an answer (`:107`). It then calls
  `ClientGatewayTransport.send`, which pushes the message to the session's outbound queue and its
  `ClientGatewaySocket` (`client-gateway/service/transport.ts:31-42`). The socket contract is
  `send(message: string)` plus an optional `close` (`packages/contracts/src/client-gateway.ts:587`).
- **Receiving.** Results come back through `receive`, then `ClientGatewayInbound.receive`
  (`client-gateway/service/inbound.ts:56`), then `commands.settle` (`inbound.ts:109`;
  `commands.ts:120-131`). Other client messages are emitted on the event bus (`inbound.ts:78-112`).
- **`AutomationStudioClientGatewayBridge.executeAction`** (`programs/automation-studio/client-gateway/bridge.ts:202-216`)
  wraps the gateway's `executeAction`. It also appends each action result to the active client recording
  (`bridge.ts:208`, `213`). It is exposed as `fluxiq.programs.automationStudioClientGateway`
  (`programs/_shared/runtime.ts:90`).

### Executor (`AS/executor/**`)

The executor never imports the gateway or `RuntimeService`. It reaches the world only through fields of
`AutomationStudioGraphExecutionOptions` (`AS/executor/contracts.ts:676-794`):

- **`effectDispatcher`** (`contracts.ts:722`). This is the only client path for built-in and importer nodes.
  `policy.output.dispatch` effects are handed to it in `node-execution/attempt.ts:264-269`, and a required
  command context is issued at `attempt.ts:265`.
  - In production it is `createRuntimePolicyEffectDispatcher` (`AS/io-policy.ts:78-130`), set by
    `graph-options.ts:42-44`. That function calls `RuntimeService.dispatch` (`io-policy.ts:91`).
  - It falls back to `IoRegistry.dispatchOutput` (`io-policy.ts:89`, `22-37`) when the runtime has no
    capability for the output (`io-policy.ts:342-345`).
  - It waits for confirmation inputs through `io.waitForInput` (`io-policy.ts:142-144`). That is a second
    path by which client events come in.
- **`nativeNodeExecutor`** (`contracts.ts:745`), bound to `AutomationStudioNativeNodeRuntime.execute` at
  `graph-options.ts:51`. It is called at `node-execution/attempt.ts:135-150`.
  - The web domain's native nodes do not talk to the client themselves. They return a
    `policy.output.dispatch` effect (`domain/src/output-nodes/native-runtime.ts:212`), which goes back through
    `effectDispatcher` (`attempt.ts:154`).
- **`hostRuntime`** (`contracts.ts:779`), of type `AutomationStudioHostRuntimeBoundary`
  (`AS/host-runtime.ts:87-201`). The executor uses these methods:

  | Method | Called at |
  | --- | --- |
  | `captureStateSnapshot` | `executor/host-state.ts:37-41`, before and after every attempt (`attempt.ts:119`, `host-state.ts:58`) |
  | `inspectStateDiff` | `host-state.ts:60-69` |
  | `expectationEvaluator` | `attempt.ts:182-185` |
  | `factEvaluator` | `executor/lifecycle-run/fact-observation.ts:82` |
  | `actLanded` | `executor/defensive/host-act-landed.ts:27` |
  | `routeEffectSeen` / `observeRouteState` | `executor/node-execution/recorded-effect.ts:75` |

  The web host implements all of them with `dispatchWebAutomationOutput`
  (`domain/src/runtime/host-runtime.ts:190`, `240`, `283-285`), which calls the bridge's `executeAction`
  directly (`domain/src/io/gateway-output-dispatcher.ts:30`, `41`). It does not go through `RuntimeService`.
- **`compositeExecutor`** (`contracts.ts:739`) and Call Subflow (`attempt.ts:124-133`) recurse into graph runs.
  They have no client path of their own.
- **`commandRun`** (`contracts.ts:677`; `graph-run.ts:181`; `attempt.ts:70-75`, `264-313`) covers required
  (durable) commands. It turns off the native executor (`attempt.ts:135`) and sends required effects through
  `effectDispatcher` with a `commandContext`. Through `RuntimeService.dispatch`'s required-handler branch
  (`runtime/service.ts:269-273`) that reaches the gateway's durable `executeAction`.
- **Pacing** (`executor/pacing/run-wait.ts:13-31`; `pace-keeper.ts:85-89`). It uses `options.delay` and
  `options.now` and has no client path.
- **Record capture** (`executor/record-capture.ts:55`, `123`). It reads rows from dispatch result payloads; the
  sink is `options.onRecordBatch` (`attempt.ts:414`). It has no client path of its own.
- **People's input** reaches the executor through `options.parking` (`step-loop/ask-or-park.ts:138-153`) and
  `options.runControl` (`graph-run.ts:367`).
- **`step-loop`** reaches the client only indirectly: through node execution, `factEvaluator` and parking.

### Graph options builder (shared by runs and trials)

- `automationStudioRunGraphOptions` (`AS/service/runtime-session/graph-options.ts:26-58`) is the one place that
  binds `effectDispatcher`, `nativeNodeExecutor`, `hostRuntime`, `onRecordBatch` and `parking`. Its header
  states that this is so a trial runs exactly as a run does (`graph-options.ts:3-10`).
- It sets **no** `now`, `delay` or `random` (`graph-options.ts:39`).
- It is called for a normal run at `AS/service.ts:2501` and for every whole trial at `AS/service.ts:1586`.

### Trial runner

- **Candidate trial.** `automationStudioCandidateTrialPort` (`AS/service/candidate-trial/port.ts:26-74`) leads to
  `runAutomationStudioCandidateTrial` (`candidate-trial/run.ts`).
  - That function calls `ports.execute ?? runAutomationStudioDetachedCandidate` with
    `options: ports.graphOptions({ runId, signal })` (`run.ts:111-117`).
  - Its clock and run id come from the ports: `ports.now ?? Date.now` (`run.ts:92`) and
    `ports.newRunId?.() ?? trial.${randomUUID()}` (`run.ts:100`).
  - The ports type is `AutomationStudioCandidateTrialPorts` (`candidate-trial/contracts.ts:100-136`).
- **Subflow trial.** It uses the same shape (`AS/service/subflow-trial/types.ts:36-60`; `subflow-trial/run.ts:118`,
  `139`, `147-163`), running `runAutomationStudioDetachedSubflow`.
- **Detached run.** `runAutomationStudioDetachedCandidate` (`AS/flow-bootstrap/verification/detached-execution.ts:18-121`)
  routes the run with `routeAutomationStudioRun({ hostRuntime: options.hostRuntime, now })`
  (`detached-execution.ts:66-67`). It then runs `runCanonicalAutomationStudioFlow` with the caller's options
  (`:115`), so the trial reaches the client exactly as the executor does.
- **Ports in production.** They are built at `AS/service.ts:1585-1587` as `trialEnvironment`. They set neither
  `now` nor `newRunId`.
- **Trial gate.** `AutomationStudioCandidateTrialGate.test` (`AS/flow-bootstrap/candidate/trial-gate.ts:386-470`;
  L1 file) calls the trial port's `prepareStart` (`:412`), then `reset.beforeTrial` (`:414`), then the port
  (`:418`, through `ask`).
  - The reset is the site-reset start check, which acts through evidence `executeTool` calls
    (`AS/flow-bootstrap/site-reset/start-check.ts:158`, `181`; L1 files).
- **Project build.** It wires the same ports in `AS/service/project-build/brief-ports.ts:220-252` (L1) and
  `whole-trials.ts`. It adds its own wrappers around `executeTool` (`brief-ports.ts:305-316`, `389-407`).

### Evidence loop (`AS/llm/evidence-loop.ts`, `AS/llm/evidence-loop/`)

- The loop is written against its input's ports (`AS/llm/loop-configuration.ts:42-422`):
  - `decide(...)` (`:68-75`) for the model;
  - `executeTool({ callId, toolId, value, signal })` (`:81`) for the client;
  - `captureStateDigest` (`:268`);
  - `budget.now` (`AS/llm/loop-budget.ts:146`).
- Its opening free look calls `input.executeTool` (`evidence-loop.ts:548`; L1 file).
- **Where `executeTool` comes from.** It is the domain's `AutomationStudioLlmEvidenceRuntimeBinding`
  (`AS/llm/harness-options/binding.ts:40-420`; L1 file).
  - Relevant methods: `executeTool` (`:287-312`), `startState` (`:72-79`), `observeResult` (`:80-86`),
    `captureStateDigest` (`:331-347`), `captureSanitizedFailureEvidence` (`:358`) and
    `clearedControlHandles` (`:100-104`).
  - Each option adapts to the binding through `executionFor` (`binding.ts:650-665`).
  - It is bound once on the service: as a constructor option (`AS/service.ts:305`, `425`) or through
    `bindLlmEvidenceRuntime` (`AS/service.ts:486-487`).
- **The wrapper chain, innermost first:**
  1. harness option registry;
  2. permission gate (`AS/flow-bootstrap/action-permissions.ts:327`, `379`; L1 file);
  3. person-needed;
  4. `routing.recording` (`AS/service.ts:1620`);
  5. the site-reset placed call (`AS/flow-bootstrap/candidate/authoring-loop.ts:154-155`; L1 file).
- **Other callers of `executeTool`:**
  - `llm/node-tools/replay-draft.ts:513` (the dry-run test);
  - `node-tools/rerun-check.ts:130`;
  - `node-tools/step-place.ts:245`;
  - `flow-bootstrap/candidate/trial-view.ts:52`;
  - `service/end-view/run-reader.ts:24-33`, which calls `observeResult`;
  - `recovery/annotation/exploration.ts:359`;
  - `recovery/runtime-exploration.ts:292`;
  - `project-agents/supervisor/supervisor-loop.ts:292`.
- **The web binding's tools** call the bridge's `executeAction` directly
  (`domain/src/runtime/llm-evidence/tools.ts:703-710`; `capture.ts:541`, `696`; `node-run/retries/dispatch.ts:91`).
  They pick a session with `fluxiq.programs.clientGateway.snapshot().sessions`
  (`domain/src/runtime/llm-evidence/tools.ts:714-718`). They do not go through `RuntimeService`.
- **Model calls.** `decide` runs through `runAutomationStudioLlmHarness` (`AS/llm/harness/run.ts:28-41`) to an
  `AutomationStudioLlmProvider.runTask` (`AS/llm/harness/provider.ts:43-66`). The provider is resolved from the
  service's `llmProviderResolver` (`AS/service.ts:304`, `424`, `481-482`).

### `io-bridge.ts` and `adapters.ts`

- `AutomationStudioIoRecorder` (`AS/io-bridge.ts:10-71`) converts IO input envelopes into recording entries
  through `appendRecordingEvent`. It is used only for recording. It is not on any run, trial or loop path, and
  I found no caller in those three (unverified beyond a grep of the consumers above).
- `AutomationStudioRuntimeAdapter` and `AutomationStudioAdapterRegistry` (`AS/adapters.ts:19-44`) declare
  `captureObservation` and `executeAction`. None of the three consumers calls them (grep: no `executeAction(`
  or `captureObservation(` on that registry under `AS/executor`, `AS/llm` or `AS/service/*-trial`; unverified
  for every other caller).

### `engine/`

`engine/index.ts` is the generic `FlowDocument` component engine (`runCurrentNode` `:42`, `stepFlow` `:108`,
`runFlow` `:165`, `createRuntimeOutputs` `:209`). The only file that imports it is the package root
`index.ts` (grep). Automation Studio's executor does not use it, so it plays no part in this map.

---

## 2. Where the paths meet today

**Inside Core there is no single seam. There are four ports, all supplied by the domain**, and the three
consumers use different subsets:

| Consumer | Ports it uses | Bound at |
| --- | --- | --- |
| Executor (run) | `effectDispatcher` (→ `RuntimeService.dispatch`), `nativeNodeExecutor`, `hostRuntime` | `graph-options.ts:26-58`, called from `service.ts:2501` |
| Trial runner | Exactly the executor's ports, through `ports.graphOptions` | `service.ts:1586` → `graph-options.ts` |
| Trial gate's reset | Evidence `executeTool` and `startState` on the binding | `site-reset/start-check.ts` (L1) |
| Evidence loop | `AutomationStudioLlmEvidenceRuntimeBinding` (`executeTool`, `startState`, `observeResult`, `captureStateDigest`) | `service.ts:425`, `486` |
| Build routing | `hostRuntime.observeRouteState` | `service.ts:1561`; `route-state/observe.ts:17` |

- **The executor and the trial runner already meet** at `automationStudioRunGraphOptions`, by design
  (`graph-options.ts:3-10`).
- **`RuntimeService.dispatch` is not the meeting point.** Only `policy.output.dispatch` effects go through it
  (`io-policy.ts:91`). Host-runtime commands and evidence tool calls skip it.
- **In the deployed web stack, every command meets at one place below the domain: the client gateway's command
  channel.** The four routes are:
  - effect dispatch → `RuntimeService` → web adapter → `dispatchWebAutomationOutput`
    (`domain/src/runtime/adapter.ts:61`, `100`) → bridge `executeAction` (`gateway-output-dispatcher.ts:30`, `41`);
  - host runtime → the same dispatcher (`host-runtime.ts:283-285`);
  - evidence tools → bridge `executeAction` (`tools.ts:708`);
  - Core's own transport → gateway `executeAction` (`client-gateway-transport.ts:64`, `68`).

  All four reach `ClientGatewayCommands.executeAction` / `executeDurable` (`commands.ts:89-113`, `194`), then
  `ClientGatewayTransport.send` to the session's socket (`transport.ts:31-42`). Every answer comes back through
  `ClientGatewayService.receive` (`client-gateway/service.ts:179`).
- **Every session choice reads `clientGateway.snapshot().sessions`.** The readers are:
  - `targetSessionId` (`domain/src/io/gateway-output-dispatcher.ts:129-137`);
  - `eligibleWebSessionIds` (`domain/src/runtime/llm-evidence/tools.ts:714-718`);
  - `ClientGatewayRuntimeTransport.selectSession` (`client-gateway-transport.ts:103-116`).

  That view comes from `ClientGatewayViews.snapshot` (`client-gateway/service/views.ts:40-45`).
- This is the boundary at which Decision 4 already places capture.
- **The channel is a process-wide singleton**, not something injected per run: the domain's closures hold
  `fluxiq`. So no Core-side injection can reach it today without either an ambient scope or a contract change
  in the domain's ports.
- **The gateway already has the needed precedent.** It reads per-dispatch context ambiently: the command owner
  (`commands.ts:225-226`; wired at `programs/_shared/runtime.ts:82`) and the host lease
  (`client-gateway/service/host-lease/source.ts:11-24`; wired at `programs/_shared/runtime.ts:84`, backed by
  `AsyncLocalStorage` in `AS/project-agents/host-resources/lease-scope.ts:1-12`).

---

## 3. Other nondeterministic inputs and how each is injected

### Clocks and timers

| Where | What | How it is injected |
| --- | --- | --- |
| Executor | `options.now`, `options.delay`, `options.random` (`executor/contracts.ts:700-707`) | Per-run options. Fallbacks to `Date.now` at `graph-run.ts:144`, `151`, `155`, `287`; `host-state.ts:88`; `ladder-run.ts:180`; `lifecycle-run/dispatch.ts:94`; `lifecycle-run/fact-observation.ts:52`; `node-execution.ts:45`; `node-execution/attempt.ts:68`, `105`, `121`, `132`, `155`, `163`, `170`, `201`; `node-execution/failure.ts:14`; `resume.ts:52`; `step-loop/ask-or-park.ts:161`. Production never sets them (`graph-options.ts:39`). |
| Executor waits | `automationStudioRunWait` (`pacing/run-wait.ts:13-31`): retries, pace, Wait nodes | `options.delay`, with a default `setTimeout` (`:27`) |
| Executor region timeout | `executor/region-execution.ts:6-11` | A raw `setTimeout`; **not injectable** |
| Retries outside the graph | `executor/outside-graph/retries.ts:93-97`, `139` | `input.now` and `input.delay`. The web domain passes its own `webNodeRetryWait` (`domain/src/runtime/llm-evidence/node-run/retries/dispatch.ts:94`; `wait.ts:8`), a wall clock owned by the domain. |
| Native nodes | 30 s timeout `setTimeout` (`AS/native-node-runtime.ts:90-95`) | Module global |
| Trial runner | `ports.now`, `ports.newRunId` (`candidate-trial/contracts.ts:134-135`; `run.ts:92`, `100`; `subflow-trial/run.ts:118`, `139`) | Port fields; unset in production (`service.ts:1585`) |
| Detached run | `options.now ?? Date.now` (`detached-execution.ts:39`) | Through graph options |
| Evidence loop | `input.budget?.now ?? Date.now` (`evidence-loop.ts:257`; L1). The trace stamps wall-clock `Date.now()` on purpose (`evidence-loop/trace.ts:196`, `277`). | Loop input; module global for the trace stamp |
| LLM harness | `input.now ?? Date.now` (`llm/harness/run.ts:29`) | Harness input |
| Provider retry | Backoff timer and deadline (`llm/provider-retry/call.ts:180`, `198`) | `setTimeout`, module global |
| DeepSeek | Pricing clock `options.now` (`llm/deepseek/provider.ts:51`, `70`); call timeout `setTimeout` (`:143`) | Provider options; module global |
| Step logs | Output only, not an input: `llm/step-log/model-step.ts:68`, `87`; `tool-step.ts:63`, `80` | Module global |
| Project build | `brief-ports.ts:224`, `344` (L1); `entry-preparation.ts:94`, `120`; `draft-record.ts:26` | Module global `Date.now` |
| Runtime kernel | `RuntimeServiceOptions.now` (`runtime/service.ts:23`, `44`); the dispatch bound timer (`service.ts:387`) | Constructor; module global |
| Client gateway | `config.now` (`client-gateway/service/config.ts:27`). Answer-wait timers: `commands.ts:107`; `command-ledger/dispatch.ts:67`, `115`; `command-reconcile/reconciler.ts:95`, `125` | Constructor; module global timers |
| Bridge | `Date.now` at `bridge.ts:126`, `507`, `532`, `715`, `747`, `753` | Module global |

### Randomness and ids

| Where | What | How it is injected |
| --- | --- | --- |
| Attempt ids | `${node.id}.attempt.${n}` (`node-execution/attempt.ts:69`) | Deterministic |
| Required-command invocation id | `randomUUID()` (`attempt.ts:71`) | Module global |
| Person-needed ask id | `randomUUID()` (`executor/person-needed.ts:82`) | Module global |
| Random nodes | `options.random` (`attempt.ts:193`) | Per-run options |
| Trial run id | `ports.newRunId` (`candidate-trial/run.ts:100`) | Port, with a `randomUUID` fallback |
| Candidate id, build id | `randomUUID()` (`AS/service.ts:1585`, `1588`) | Module global |
| Project build | `project-build/decisions.ts:24`; `entry-preparation.ts:91` | `randomUUID`; `newRunId?` |
| LLM request id | `randomUUID()` (`llm/harness/run.ts:41`) | Module global, unless `input.requestId` is given |
| Provider backoff | `input.random ?? Math.random` (`llm/provider-retry/call.ts:60`, `77`) | Input |
| Runtime kernel ids | runtime id, run id, command id, attempt id (`runtime/service.ts:43`, `158`, `196`, `208`) | `randomUUID`, module global |
| Gateway | Command id (`commands.ts:95`), message id (`transport.ts:22`), ping nonce (`commands.ts:231`) | `randomUUID`, module global |
| Mock client | `Math.random` (`client-gateway/testing/mock-client.ts:9`, `27`) | Test only |

### Model calls

- The provider is resolved by the service's `llmProviderResolver`. It is set in the constructor
  (`AS/service.ts:304`, `424`) or through `bindLlmExecutionProvider` (`AS/service.ts:481-482`). Production
  binds the session-key resolver at `programs/_shared/runtime.ts:45`.
- Result-check models are resolved separately (`AS/service.ts:307`, `426`).
- `llm/model-caller.ts:12-15` names only whose key pays. It is not a seam.
- `llm/provider-factories.ts:1-5` only re-exports the DeepSeek factory.
- The evidence loop reaches the model only through `input.decide` (`loop-configuration.ts:68-75`). The trial
  judges reach it through `ports.judge` (`candidate-trial/contracts.ts:131`).

### Stored data that a client produced and Core reads back later

| What | Written at | Read back at | How it is injected |
| --- | --- | --- | --- |
| Command attempts (withheld) | `runtime/service.ts:306-316` | `FileRuntimeStore` | Constructor (`programs/_shared/runtime.ts:58`) |
| Runtime-session attempts with host `stateRefs` | `executor/host-state.ts:74-84` | Trials, for example `candidate-trial/contracts.ts:120` (`actionAttempts`) and `landed-acts.ts` (L1), which reads `stateDiff.items` | Through the session store (`AS/service.ts` `writeRuntimeSession`, `getFlowRunDetail`) |
| Host snapshots kept in host memory | — | Core hands one back as `previousStateRef` (`host-state.ts:35-41`; `domain/src/runtime/host-runtime.ts:176`, `186-189`) | `hostRuntime` boundary |
| Run dataset rows from dispatch payloads | `attempt.ts:414` | `ports.recordSets` / `processDatasets` (`candidate-trial/contracts.ts:117-118`) | `onRecordBatch` and service ports |
| Client recordings | `bridge.ts:218-236`, and `appendActionResult` at `bridge.ts:208` and `213` | Recording-as-evidence | Bridge; constructor (`programs/_shared/runtime.ts:90`) |
| Late action results | `gateway.onLateActionResult` (`client-gateway/service.ts:171`) | Run detail (`AS/service.ts:413`) | — |
| End view | `binding.observeResult` (`service/end-view/run-reader.ts:24-33`) | — | Binding |
| Cleared-control handles | `binding.clearedControlHandles` (`service/project-build/trial-reads.ts:15`) | — | Binding |
| Route state | `hostRuntime.observeRouteState` (`route-state/observe.ts:17`) | — | `hostRuntime` boundary |

---

## 4. Proposal: one environment port

### Principle

Reuse the seam where all three paths already meet: the client gateway's command channel and its session
view. Do not add a second set of trace-backed implementations of the four domain ports. Swapping at the domain
ports would mean replaying the domain's own answers, so the web domain's extraction and target code would not
run offline, and replayed data would skip the ingress. That would contradict Decisions 4 and 5 and P3's
intake parity. Swapping at the gateway keeps the same code path all the way down to the socket.

### The port

Name it **`AutomationStudioRunEnvironment`**. It is program-owned, in the runtime layer and in a feature
directory of its own: `programs/automation-studio/runtime/environment/` (`environment.ts`, `live.ts`,
`index.ts`), following `docs/architecture/code-structure.md:30-62` and `155-170`. Its kernel half is
domain-neutral and lives beside the host-lease source as `client-gateway/service/channel-scope/`. The two
halves together:

```ts
// programs/automation-studio/runtime/environment/environment.ts
export type AutomationStudioRunEnvironment = {
  /** "live" today; "trace" from P4; "fixture" in unit tests. Carried into the result contract as the evidence origin. */
  kind: "live" | "trace" | "fixture";
  /** Reuses the executor's own option shapes (executor/contracts.ts:700-707). */
  now(): number;
  delay(ms: number, signal?: AbortSignal): Promise<void>;
  random(): number;
  newRunId(prefix: string): string;
  /**
   * Runs `work` with this environment's client channel in force: every gateway command
   * issued and every gateway session read inside it sees only this environment's sessions.
   * Live: runs `work` unchanged (no scope).
   */
  within<T>(work: () => Promise<T>): Promise<T>;
};

// client-gateway/service/channel-scope/source.ts  (kernel, domain-neutral; mirrors host-lease/source.ts)
export type ClientGatewayChannelScopeSource = {
  /** The replay/fixture sessions the dispatching async context may use, or undefined outside any scope (live). */
  current(): ReadonlySet<string> | undefined;
  /** Whether `sessionId` is a scoped (non-live) session at all. */
  isScoped(sessionId: string): boolean;
};
```

**What it reuses.**

- The clock fields copy the shapes of `AutomationStudioGraphExecutionOptions.now`, `delay` and `random`.
- `newRunId` copies the shape of `AutomationStudioCandidateTrialPorts.newRunId`.
- The channel is not a new interface. It is `ClientGatewayService` itself (`executeAction`, `snapshot`,
  `receive`), reached through the bridge, plus a scoped session whose `ClientGatewaySocket` is:
  - for a trace environment, a trace matcher (P4);
  - for a unit test, a scripted client (section 5).
- That socket answers each `server.execute_action` by calling `gateway.receive(sessionId, client.action_result)`.
  Replayed answers therefore pass the same decode, validation and settle path as live answers
  (`inbound.ts:56-112`; `commands.ts:120-131`), which is what P3 needs. An unmatched command is answered at once
  with a non-retryable failure record coded as an evidence gap. That code belongs to the result-contract unit
  (U5); I did not check its exact name.

**The live implementation** (`live.ts`): `Date.now`, an unreferenced `setTimeout` delay (the same as
`run-wait.ts:21-30`), `Math.random`, `randomUUID`, and `within = (work) => work()`. This reproduces today's
behaviour byte for byte, because every one of those is the fallback used today.

**What the scope guarantees mechanically.**

- Inside a scope, the gateway's session view and command admission see only that scope's sessions.
- Outside any scope, scoped sessions are invisible and refuse commands.
- A command issued inside a scope to a live session is refused.
- So an offline trial cannot touch the live site (Decision 6), and nothing live can select the replay session.

### Call sites the wiring unit must switch

"L1" means the file appears in `git -C C:/Users/osrs_/FluxStuff/fxwork/t724/!FluxIQ status --short`, observed on
2026-10-19. That branch has no commits ahead of `dev` (`git log dev..HEAD` printed nothing), so the status list
is L1's whole footprint.

**Kernel: client gateway (all domain-neutral, all not L1)**

| # | Site | Change |
| --- | --- | --- |
| 1 | `client-gateway/service/types.ts:50` (`ClientGatewayServiceOptions`, beside `hostLease`) | Add `channelScope?: ClientGatewayChannelScopeSource` |
| 2 | `client-gateway/service.ts:72-96` (constructor) | Pass the source to `ClientGatewayViews`, `ClientGatewayCommands` and `ClientGatewayLifecycle` |
| 3 | `client-gateway/service/views.ts:40-45` (`snapshot().sessions`) | Filter by scope: in scope, only scoped sessions; out of scope, hide scoped ones |
| 4 | `client-gateway/service/commands.ts:89-97` (`executeAction`), `:194` (`executeDurable`) and `:81-87` (`captureSnapshot`) | Admission check beside the lease stamp at `:97`: refuse a cross-scope target |
| 5 | `client-gateway/service.ts` facade | Add one method to attach a scoped session (`connect` + `hello` with a socket, made `ready` without pairing and never written to trusted-client storage). It needs a unique `clientId`, because a `hello` disconnects other sessions of the same client (`client-gateway/service/lifecycle.ts:28-29`, `75-79`). This changes the facade contract (`client-gateway/service.ts:52-59` says so). |
| 6 | `programs/_shared/runtime.ts:82-84` | Wire the scope source, the way `hostLease` is wired |
| 7 | `programs/automation-studio/client-gateway/bridge.ts:208`, `213` (`appendActionResult`) and `:218-236` (`handleGatewayEvent`) | Never append to or store recordings from a scoped session. Replayed data must not be taken in as live observations (consultant section 4, last paragraph). |
| 8 | `client-gateway/service/inbound.ts:78-112` (event bus emit) | Tag or suppress events from scoped sessions for global listeners (activity, `ClientGatewayRuntimeTransport.forwardGatewayEvent` at `runtime/client-gateway-transport.ts:118-138`). **Unverified** whether any listener other than the bridge acts on them. |

**Automation Studio: environment threading**

| # | Site | L1? | Change |
| --- | --- | --- | --- |
| 9 | New: `AS/environment/` (`environment.ts`, `live.ts`, `index.ts`), plus a scope implementation like `AS/project-agents/host-resources/lease-scope.ts` | No | Create |
| 10 | `AS/service/runtime-session/graph-options.ts:26-58` | No | Add an `environment` input; set `options.now`, `options.delay` and `options.random` from it |
| 11 | `AS/service.ts:1585-1586` (trial `trialEnvironment`: `graphOptions`, plus `now` / `newRunId` from the environment) and `AS/service.ts:2501` (normal run) | No | Pass the live environment. `service.ts` does not appear in the t724 status list. |
| 12 | `AS/service/candidate-trial/contracts.ts:100-136` | No | Add `environment?`, or replace `now`, `newRunId` and `graphOptions`' clock with it |
| 13 | `AS/service/candidate-trial/run.ts:92`, `100`, `111-117` | No | Take `now` and `runId` from the environment; wrap `execute(...)` in `environment.within` |
| 14 | `AS/service/subflow-trial/types.ts:36-60` | No | Same as #12 |
| 15 | `AS/service/subflow-trial/run.ts:118`, `139`, `147-163` | **L1** | Same as #13 |
| 16 | `AS/flow-bootstrap/candidate/trial-gate.ts:412-415` | **L1** | Skip `prepareStart` and `reset.beforeTrial` when `environment.kind !== "live"` (Decision 6) |
| 17 | `AS/service/project-build/brief-ports.ts:220-252` and `whole-trials.ts` | **L1** (brief-ports) | Hand the build's trials the environment chosen for the phase |
| 18 | `AS/flow-bootstrap/candidate/authoring-loop.ts` and `candidate/contracts.ts` (where the trial port is chosen) | **L1** | Choose offline or live per trial in the test and repair phases only (Decision 2). This is P6, not P1. |

**Automation Studio: no change needed (reads options already)**

- `AS/flow-bootstrap/verification/detached-execution.ts:39`, `66-67`, `115`.
- `executor/**`.
- `AS/io-policy.ts:78-130`.
- `runtime/service.ts`.
- `runtime/client-gateway-transport.ts`. Its `clients()` (`:45-47`) and `selectSession` (`:103-116`) read the
  scoped `snapshot()` without any change.

**Evidence loop (P5 and P6 only; no P1 change)**

- Exploration stays live (Decision 2), so `evidence-loop.ts:257` (L1) and the binding (`binding.ts`, L1) keep the
  live clock and channel.
- The one later wrap point is an offline-eligible repair call, such as a read rerun at
  `llm/node-tools/rerun-check.ts:130` (not L1). That call would run inside `environment.within`.

**Downstream (out of Core's scope; report to the supervisor)**

- No change is needed for the channel. `targetSessionId` (`gateway-output-dispatcher.ts:129-137`) and
  `eligibleWebSessionIds` (`tools.ts:714-718`) read the scoped `snapshot()` unchanged.
- One wall clock still escapes the environment: `webNodeRetryWait` (`domain/src/runtime/llm-evidence/node-run/retries/wait.ts:8`).
  It only matters if a recorded failure is replayed into the domain's retry loop. A later downstream unit
  could take its delay from `request` or from the scope.

**Residual clocks**

- These stay on the wall clock: `executor/region-execution.ts:11`, `AS/native-node-runtime.ts:95`,
  `runtime/service.ts:387` and the gateway answer timers.
- None of them fires when an answer arrives at once, but none follows the virtual clock either. If P4 needs
  that, `region-execution.ts` should take `options.delay`.

---

## 5. Non-browser fixture adapter

**What already exists, from the shortest path to the longest:**

1. **The executor alone.** Call `runAutomationStudioGraph(flow, { effectDispatcher })` with one
   `builtin.policy.action` node (`AS/executor/tests/node-execution.test.ts:13-23`, `56-58`). This drives a real
   node but skips `RuntimeService`, the gateway and graph options.
2. **Through `RuntimeService`.** Use `createRuntimePolicyEffectDispatcher(io, domainId, runtime)` with:
   - `ioWith()`, an `IoRegistry` with the output registered (`AS/tests/io-policy.test.ts:312-320`). It is
     needed because of `io.hasOutput` (`io-policy.ts:85`).
   - `runtimeReturning()`, a `direct` adapter whose capability lists `outputIds` (`io-policy.test.ts:322-333`).
     It is needed because of `runtimeCanDispatchOutput` (`io-policy.ts:342-345`).

   It is run through `runAutomationStudioGraph` (`io-policy.test.ts:149-150`, `217-219`).
3. **Through the gateway wire.**
   - `runtime/tests/client-gateway-transport.test.ts:21-45` pairs a client with `connect` plus `client.hello`
     plus `approvePairing` (`:252-268`). It reads `gateway.outbound(sessionId)` for `server.execute_action` and
     answers with `gateway.receive(sessionId, client.action_result{ commandId, status })`.
   - `MockClientGatewayClient` (`client-gateway/testing/mock-client.ts:4-40`) wraps `connect`, `hello`, `send`
     and `outbound`. It does not answer commands and has no socket.
4. **The evidence-loop stand-in.** `automationStudioReplayingBinding` (`AS/tests/replaying-binding.ts:38-60`)
   is a binding-level fake for evidence tools. It operates above the gateway, so it is not the seam
   recommended here.

**What a minimal fixture client has to implement** to drive one node through the production executor and the
production graph options, entirely through the channel the proposal uses:

- **A socket.** A `ClientGatewaySocket` (`packages/contracts/src/client-gateway.ts:587`) whose `send(raw)`
  parses `server.execute_action` (and `server.capture_snapshot`, if used). Each one is answered on a microtask
  with `gateway.receive(sessionId, { type: "client.action_result", payload: { commandId, status, payload?, failure? } })`,
  looked up from a fixture table. The key is `actionType` plus canonical `parameters`, plus the occurrence, so
  the matching key is the external call, not a node id (consultant 7.2).
- **A hello.** `clientId` (unique), `clientType: "custom"`, and `capabilities: [{ id: "fixture.actions", kind:
  "action", actionTypes: [<outputId>], metadata: { domainId: "fixture" } }]`. This follows the shape at
  `client-gateway-transport.test.ts:254-264`. Before item 5 of section 4 exists, a unit test can pair with
  `createPairing` and `approvePairing` on an in-memory `ClientGatewayService`; nothing is stored without a
  store.
- **The rest of the wiring:**
  - `new RuntimeService().registerTransport(new ClientGatewayRuntimeTransport({ gateway }))`
    (`runtime/client-gateway-transport.ts:29-43`);
  - an `IoRegistry` with `registerOutput("fixture", defineOutput({ definition: { id: <outputId> }, mode: "request", dispatch }))`,
    as in `io-policy.test.ts:313-318`;
  - `automationStudioRunGraphOptions({ io: { io, domainId: "fixture" }, runtimeService, signal, authorizedDomainIds: ["fixture"] })`
    (`graph-options.ts:26-58`);
  - `runAutomationStudioGraph(flowWithOnePolicyActionNode, options)`.
- **Why it is domain-neutral.** Nothing in this fixture mentions pages, selectors, URLs or tabs, which proves the
  channel contract carries no web-specific fields (the P1 gate). The commands and answers are plain
  `ClientGatewayActionCommand` and `ClientGatewayActionResult`.
- **What it does not cover.** `hostRuntime` methods stay unbound, so the executor skips state capture
  (`host-state.ts:37-38`). A second fixture test can bind a tiny `hostRuntime` whose `captureStateSnapshot`
  goes out through the same channel. Either way, nothing more is required to drive one node.

---

## Commands run and observed results

- `grep -n "^#" docs/working/trace-offline-trials-plan.md` and `sed -n 1,122p` (Core): read Current State,
  Decisions, Tiers and Phases.
- `sed` on the consultant plan, sections 4 and 7.1-7.3: read.
- `git -C C:/Users/osrs_/FluxStuff/fxwork/t724/!FluxIQ status --short` printed 37 modified, 1 deleted and 15
  untracked files under `AS/action-permissions`, `AS/flow-bootstrap/{action-permissions,candidate,site-reset,subflow-candidate}`,
  `AS/llm/{evidence-loop.ts,harness-options/binding.ts,repeat-guard,repeat-policy.ts,refused-action-retest.ts}`,
  `AS/project-agents/dispatch`, `AS/service/candidate-trial/landed-acts.ts`, `AS/service/project-build/brief-ports.ts`
  and `AS/service/subflow-trial/run.ts`. The branch is `task/t724-reset-settlement-redesign`.
  `git log dev..HEAD` and `git diff --name-only dev...HEAD` printed nothing.
- Grep and sed reads of every file cited above. The clock and id inventory came from a grep for
  `Date\.now|setTimeout|Math\.random|randomUUID|performance\.now` over `AS/executor`, `AS/llm/{evidence-loop*,loop-*,harness*,provider-*,deepseek,step-log,...}`
  and `AS/service/project-build`, excluding `tests/`.

No build, typecheck or tests were run, because the work was read-only mapping and none was named in the brief.

## Not verified

- Whether any gateway event listener other than the bridge and `ClientGatewayRuntimeTransport` would act on
  events from a scoped session (section 4, item 8).
- `io-bridge.ts` and `adapters.ts`: I found no caller in the three consumers by grep, but did not prove there is
  none anywhere.
- The exact evidence-gap failure code. That belongs to the result-contract unit (U5); I did not read it.
- Whether `AsyncLocalStorage` context survives every hop from `transport.send` through the fixture socket's
  microtask to `receive`. Node propagates it through promises and microtasks, but this was not tested here.
- The downstream `targetSessionId` rule beyond line 137 (its single-session requirement was not read in full).

## Open questions or contradictions found

- **The plan's premise needs correcting.** P1 says "one environment interface that the executor, the evidence
  loop and the trial runner already go through". In Core they go through four domain ports (section 2). They
  meet only below the domain, at the client gateway's command channel. The recommendation treats that channel
  as the seam, so the plan's "already go through" holds there and nowhere above it.
- **Facade contract change.** Attaching a scoped session (section 4, item 5) is a change to the facade contract
  of `ClientGatewayService`. The supervisor may want it cleared as a contract change.
- **Single-instance assumption.** The web domain reads the gateway as a singleton through `fluxiq`, so an
  ambient scope is the only way to switch it per run without changing the domain's port contracts across
  repositories. The alternative is to add an explicit channel or environment field to `executeTool`,
  `captureStateSnapshot` and the runtime adapter's execution context. That is explicit but touches both
  repositories and several L1 files.

## Recommended design

Add one program-owned port, `AutomationStudioRunEnvironment` in `programs/automation-studio/runtime/environment/`.
It holds `kind`, `now`, `delay`, `random`, `newRunId` and `within(work)`. Thread it through the one place runs and
trials already share, `automationStudioRunGraphOptions` (`graph-options.ts:26-58`), and through the trial ports'
existing `now`/`newRunId` fields. Its live implementation is exactly today's fallbacks. For the client channel,
reuse the gateway rather than inventing a new interface. `within` installs a domain-neutral
`ClientGatewayChannelScopeSource`, read by the gateway's session view (`views.ts:40-45`) and command admission
(`commands.ts:89-97`, `194`, `81-87`) the same way the host lease already is (`host-lease/source.ts`). Inside the
scope, the only client is a scoped session whose `ClientGatewaySocket` is either a trace matcher (P4) or a
scripted fixture (unit tests). That socket answers through `gateway.receive`, so replayed data enters by the same
intake as live data. Outside the scope, nothing changes, and scoped sessions can neither be seen nor reached. All
of the executor's, the trial runner's and the evidence tools' commands, from Core and from the web domain alike,
already meet at that channel. So live versus offline becomes a choice of environment with no second code path:
no domain change for the channel, the environment's `kind` skipping the trial reset, and a mechanical guarantee
that an offline trial cannot reach the live site. P1 wiring touches the gateway (not L1), `graph-options.ts`,
`service.ts`, `candidate-trial/*` and `subflow-trial/types.ts` (not L1). It also touches `subflow-trial/run.ts`,
`trial-gate.ts` and `brief-ports.ts`, which are L1 files and should be switched only after t724 merges.
