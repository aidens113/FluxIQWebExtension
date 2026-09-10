# Extension Runtime Capabilities Plan

Status: Active
Status detail: Extension as a first-class FluxIQ runtime client; last checkpoint 2026-09-04 added settable output-node parameters.
Created: 2026-08-21
Last updated: 2026-09-10
Owner: Extension runtime
Scope: Building the extension into a first-class FluxIQ runtime client that executes Automation Studio flows and domain-owned web output nodes.
Paired document: `F:\!FluxIQ\docs\working\runtime-kernel-plan.md`
Related: none

---

## Goal

Build the browser extension into a first-class FluxIQ runtime client that can
execute Automation Studio flows and domain-owned web automation output nodes.
The implementation should preserve the current recording model while adding a
clear runtime surface for replay, custom output nodes, flow execution status,
and future importer/native node support.

## Current Architecture Read

### Core FluxIQ runtime

The linked FluxIQ core now exposes a generic runtime service:

- `RuntimeService` registers direct adapters and transports.
- Runtime commands are `execute_action`, `capture_snapshot`, `read_state`,
  `run_flow`, or `custom`.
- Runtime capabilities can advertise `action`, `snapshot`, `state`, `flow`,
  `native-node`, `runtime`, or `custom`.
- Dispatch selects a ready adapter/transport client by `domainId`,
  `capabilityId`, `actionType`, `inputId`, and `outputId`.
- Attempts and runs are persisted as runtime run/command records.
- `ClientGatewayRuntimeTransport` currently projects paired gateway sessions as
  runtime clients and dispatches `execute_action` and `capture_snapshot`.

### Automation Studio runtime

Automation Studio already has the execution engine we should plug into:

- `runAutomationStudioGraph()` executes flow documents node-by-node.
- Built-in nodes run directly through their `execute` callback.
- Non-built-in executable nodes can run through:
  - `nativeNodeExecutor` for trusted-local/importer/code node bindings.
  - `compositeExecutor` for pinned published flows.
  - `effectDispatcher` for side effects such as policy output dispatch.
- `AutomationStudioService.runRuntimeSession()` creates/stores runtime sessions,
  binds IO, dispatches policy output effects, and records graph traces.
- When a core `RuntimeService` is bound, policy output effects prefer runtime
  dispatch when a runtime client advertises the output.
- IO recording explicitly keeps only action-role inputs with output bindings as
  executable policy evidence. State/snapshot/unmapped inputs remain evidence.

### Extension/domain runtime today

The web automation domain already owns the pieces that should become the
runtime package:

- `domain/src/manifest.ts` declares the `web-automation` domain.
- `domain/src/io/manifest-definitions.ts` derives manifest inputs/outputs from
  action schemas and input definitions.
- `domain/src/io/web-automation-io.ts` registers IO adapters and dispatches
  outputs through the paired extension session.
- `domain/src/web-panel/output-nodes.ts` normalizes recorded event payloads
  into output payloads and targets.
- `domain/src/client/gateway-mapping.ts` translates gateway payloads and
  action commands.
- `apps/extension/src/background/connection.ts` connects to the gateway, sends
  recording/state/snapshot evidence, receives execute-action commands, and
  forwards browser work to content scripts.
- `apps/extension/src/content/index.ts` executes page actions and captures DOM
  snapshots.

The important gap is structural: output node definitions, runtime adapters,
command contracts, execution tracing, and extension protocol messages are not
yet organized as a dedicated runtime surface.

## Design Principles

- Keep FluxIQ core generic. Domain semantics stay in
  `@fluxiq-web-extension/domain`.
- Treat the browser extension as a runtime transport client, not as a core
  framework implementation.
- Put browser-page operations in the extension only. Domain code may describe,
  validate, map, and dispatch them; it should not depend on Chrome APIs.
- Keep output IDs as the execution identity. Legacy `actionType` support may be
  mapped for compatibility, but new runtime paths should use `outputId`.
- Do not make state/snapshot telemetry executable. Only output-bound action
  inputs and reviewed output nodes should produce runtime actions.
- Prefer small folders with explicit boundaries over a single large
  `connection.ts`/`web-automation-io.ts` runtime blob.

## Proposed Folder Structure

```text
domain/src/
  runtime/
    index.ts
    service.ts
    capabilities.ts
    commands.ts
    adapter.ts
    errors.ts
    trace.ts
  output-nodes/
    index.ts
    definitions.ts
    payloads.ts
    targets.ts
    registry.ts
    web-browser-navigate.ts
    web-dom-click.ts
    web-dom-type.ts
    web-dom-clear.ts
    web-dom-select.ts
    web-dom-scroll.ts
    web-dom-keypress.ts
    web-dom-wait-for-selector.ts
    web-dom-wait-for-text.ts
    web-dom-extract.ts
    web-dom-capture-snapshot.ts
  io/
    manifest-definitions.ts
    web-automation-io.ts
    gateway-input-hub.ts
    gateway-output-dispatcher.ts
    input-model.ts
  client/
    capabilities.ts
    gateway-mapping.ts
    runtime-mapping.ts

apps/extension/src/
  runtime/
    index.ts
    command-router.ts
    action-runner.ts
    snapshot-runner.ts
    state-reader.ts
    flow-runner.ts
    result-mapping.ts
  background/
    connection.ts
    runtime-controller.ts
    tabs.ts
    storage.ts
  content/
    index.ts
    actions.ts
    snapshots.ts
    element-finder.ts
  shared/
    protocol.ts
    runtime-protocol.ts
```

### Migration notes

- Move `domain/src/web-panel/output-nodes.ts` into
  `domain/src/output-nodes/payloads.ts` and keep a compatibility export from
  the old path until imports are updated.
- Split `GatewayInputHub` out of `web-automation-io.ts`.
- Split `dispatchWebAutomationOutput()` into
  `io/gateway-output-dispatcher.ts`.
- Extract browser command execution from `connection.ts` into
  `apps/extension/src/runtime/command-router.ts`.
- Extract content-script action logic from `content/index.ts` into
  `content/actions.ts`; leave event listener bootstrapping in `content/index.ts`.

## Runtime Capability Model

### Client capabilities

The extension should advertise FluxIQ runtime-facing capabilities in addition
to the existing gateway capabilities:

```ts
[
  {
    id: "web.actions",
    label: "Web actions",
    kind: "action",
    domainId: "web-automation",
    actionTypes: WEB_AUTOMATION_ACTION_TYPES,
    outputIds: WEB_AUTOMATION_ACTION_TYPES
  },
  {
    id: "web.snapshots",
    label: "Web snapshots",
    kind: "snapshot",
    domainId: "web-automation",
    inputIds: ["web.dom.snapshot"]
  },
  {
    id: "web.state",
    label: "Web state",
    kind: "state",
    domainId: "web-automation",
    inputIds: ["web.browser.state", "web.dom.snapshot"]
  },
  {
    id: "web.flow-runtime",
    label: "Web flow runtime",
    kind: "flow",
    domainId: "web-automation",
    metadata: { executionHost: "fluxiq-core", actionTransport: "extension" }
  }
]
```

Core currently maps client gateway capabilities into runtime capabilities but
does not copy `outputIds`; the client-gateway contract should be extended, or
the core bridge should derive `outputIds` from action `actionTypes` for web
automation clients. This is required because `RuntimeService` can select
clients by `outputId`.

### Host runtime binding

`createWebAutomationFluxIQ()` should create and bind the host runtime path:

1. Register the web automation domain.
2. Register web automation IO.
3. Register the recording domain.
4. Register `ClientGatewayRuntimeTransport` with `fluxiq.runtime`.
5. Bind `fluxiq.runtime` into Automation Studio so `runRuntimeSession()` can
   dispatch policy output effects through paired extension clients.

Core `FluxIQ` already exposes `runtime`, but its constructor currently only
binds IO into Automation Studio. If core does not bind `RuntimeService` by
default, the domain host should call the public binding when available or the
core should add a framework-level `bindRuntimeService()`/constructor default.

## Output Node Specification

### Canonical web output IDs

The initial runtime output nodes match the existing action definitions:

- `web.browser.navigate`
- `web.dom.click`
- `web.dom.type`
- `web.dom.clear`
- `web.dom.select`
- `web.dom.scroll`
- `web.dom.keypress`
- `web.dom.wait_for_selector`
- `web.dom.wait_for_text`
- `web.dom.extract`
- `web.dom.capture_snapshot`

Each output node should have:

- a `DomainOutputDefinition` used by the IO manifest,
- an Automation Studio node definition used by authoring surfaces,
- a payload mapper from recorded input events,
- a runtime command mapper to extension/browser commands,
- a result mapper back into graph trace output.

### Node definition shape

Output nodes should use importer-style definitions when they dispatch browser
side effects:

```ts
{
  schemaVersion: "0.1",
  id: "web.output.dom.click",
  version: "1.0.0",
  label: "Click",
  category: "web",
  source: {
    kind: "importer",
    domainId: "web-automation",
    packageId: "@fluxiq-web-extension/domain",
    implementationKey: "web.dom.click"
  },
  availability: { kind: "domain", domainId: "web-automation" },
  capabilities: { executable: true, stateAware: true, recordable: true },
  requiredRuntimeCapabilities: ["web.actions"],
  safety: {
    privileged: true,
    requiresOperatorApproval: true,
    requiredPermissions: ["web-automation.action"]
  },
  outputAction: { fixedOutputId: "web.dom.click" },
  inputs: [{ id: "in", label: "In", valueType: "signal", role: "control" }],
  outputs: [
    { id: "success", label: "Success", valueType: "any", role: "success" },
    { id: "failed", label: "Failed", valueType: "any", role: "failure" }
  ],
  parameters: [...]
}
```

For the first implementation slice, these can also be generated as
policy-action nodes that emit `policy.output.dispatch` effects. The important
part is that the executable side effect remains the output dispatch, not a
hidden browser-specific callback in the editor.

### Payload contract

Every output payload should be a JSON object with only the fields needed to
execute, plus optional target evidence:

- `selector`: CSS selector when known.
- `element`: stable element fingerprint from recording/snapshot.
- `visualTarget`: visual entity target for editor overlays and replay fallback.
- `url`, `text`, `value`, `key`, `x`, `y`, `timeoutMs`, or `options` as required
  by the specific output.

`payloads.ts` owns `webAutomationOutputPayload(outputId, payload)`.
`targets.ts` owns target extraction and fallback ranking.

### Result contract

Every output dispatch result should return:

- `ok`: boolean.
- `outputId`: canonical output id.
- `runtimeCommandId`: when routed through `RuntimeService`.
- `status`: browser action status.
- `url` and `title` after action.
- `element` and `visualTarget` when available.
- `snapshot` for actions that capture or mutate visible page state.
- `extracted` for extraction nodes.
- `error` and `message` on failure.

## Runtime Execution Flow

### Browser tab ownership

When extension runtime execution starts, the extension should open a dedicated
automation tab and run the flow there by default. Later settings can control
whether this tab is foreground/background, reused, closed after completion, or
seeded with a specific start URL.

Initial behavior:

- If a runtime command specifies `tabId`, honor it.
- If no `tabId` is specified, create or reuse one extension-owned automation
  tab.
- If the first runtime command is `web.browser.navigate`, create the automation
  tab directly at that URL.
- Otherwise create a blank automation tab and let the command fail normally if
  the page is not executable yet.
- Keep run/session storage owned by the FluxIQ host; the extension tab is only
  the browser execution surface.

### Flow replay through Automation Studio

```text
Automation Studio runRuntimeSession()
  -> runAutomationStudioGraph()
    -> policy/action/output node emits policy.output.dispatch
      -> createRuntimePolicyEffectDispatcher()
        -> RuntimeService.dispatch({ kind: "execute_action", outputId })
          -> ClientGatewayRuntimeTransport.dispatch()
            -> client gateway server.execute_action
              -> extension background command router
                -> active tab/content script action runner
                  -> client.action_result
```

### Direct output dispatch through IO

```text
Automation Studio/host code
  -> IoRegistry.dispatchOutput()
    -> web automation gateway output dispatcher
      -> automationStudioClientGateway.executeAction()
        -> extension background/content runtime
```

This path remains useful as a fallback when the generic runtime has no matching
ready client. It should share the same command/result mapping as runtime
dispatch.

### Snapshot/read-state flow

```text
RuntimeService.dispatch({ kind: "capture_snapshot" | "read_state" })
  -> ClientGatewayRuntimeTransport or web runtime adapter
    -> extension background runtime router
      -> content snapshot/state reader
      -> client.snapshot or command result payload
```

The generic gateway transport already supports `capture_snapshot`; extension
runtime should add an explicit state read path. If core gateway protocol does
not support `read_state`, add `server.read_state`/`client.state_result` or use
`capture_snapshot` for structured DOM state until the protocol grows.

### `run_flow` command

Recommended first slice: flow execution is host-owned.

- The browser extension advertises action/snapshot/state execution.
- The FluxIQ host executes graph scheduling through Automation Studio.
- Each side-effecting node dispatches to the extension through runtime
  `execute_action`.

Only add extension-owned `run_flow` after there is a concrete offline/local
execution requirement. Extension-owned `run_flow` would require serializing a
flow document, embedding an executor bundle in the extension, and synchronizing
trace/session storage back to the host. That is larger and less useful than
host-owned flow execution for the current architecture.

## Protocol Work

### Client gateway capability contract

Add or preserve these fields on `ClientGatewayCapability`:

- `domainId?: string | null`
- `inputIds?: string[]`
- `outputIds?: string[]`
- `metadata?: JsonObject`

Update `ClientGatewayRuntimeTransport.runtimeCapabilityFromGatewayCapability()`
to project them into `FluxIQRuntimeCapability`.

### Runtime server messages

Current gateway messages cover:

- `server.execute_action`
- `server.capture_snapshot`

Add only when needed:

- `server.read_state`
- `server.run_flow`
- `client.state_result`
- `client.flow_result`

The first implementation can defer `server.run_flow` because host-owned flow
execution is enough for replay and policy output nodes.

## Extension Runtime Modules

### `runtime/command-router.ts`

Owns gateway runtime command handling:

- route `execute_action` to `action-runner`,
- route `capture_snapshot` to `snapshot-runner`,
- route future `read_state` to `state-reader`,
- return normalized `ClientGatewayActionResult`/runtime result payloads,
- emit local activity/status updates.

### `runtime/action-runner.ts`

Owns browser action execution from background perspective:

- choose target tab/frame,
- ensure content script exists,
- send `executeAction`,
- enforce timeout/cancellation,
- normalize content-script failures,
- request follow-up snapshot when action result lacks one.

### `content/actions.ts`

Owns DOM action implementations:

- navigate,
- click,
- type,
- clear,
- select,
- scroll,
- keypress,
- wait-for-selector,
- wait-for-text,
- extract,
- capture-snapshot.

It should reuse `element-finder.ts` and move target resolution out of
`content/index.ts`.

### `content/snapshots.ts`

Owns DOM snapshot construction and visual state capture. `content/index.ts`
should call into this module for both recording and runtime snapshot requests.

## Host/Domain Runtime Modules

### `domain/src/runtime/capabilities.ts`

Exports runtime capability builders:

- `webAutomationRuntimeCapabilities`
- `webAutomationGatewayCapabilities`
- helpers to include `domainId`, `inputIds`, and `outputIds`.

### `domain/src/runtime/commands.ts`

Exports canonical command/result contracts that are browser-independent:

- `WebAutomationRuntimeCommand`
- `WebAutomationRuntimeResult`
- `webAutomationRuntimeCommandFromOutput()`
- `webAutomationOutputResultFromRuntimeResult()`

### `domain/src/runtime/adapter.ts`

Optional direct adapter for tests and non-gateway hosts:

- `createWebAutomationRuntimeAdapter(options)`
- advertises `web.actions`, `web.snapshots`, and `web.state`
- dispatches through injected callbacks rather than Chrome APIs.

### `domain/src/runtime/service.ts`

Host composition helpers:

- `registerWebAutomationRuntime(fluxiq)`
- `bindWebAutomationClientGatewayRuntime(fluxiq)`
- `validateWebAutomationRuntime(fluxiq)`

This should be called from `registerWebAutomationDomain()` or
`createWebAutomationFluxIQ()`.

## Persistence And Trace Expectations

Runtime session records already live under Automation Studio project runtime
storage. The extension runtime work should preserve and enrich trace fields:

- graph run `status`, `startedAt`, `finishedAt`,
- per-node attempts with `inputs`, `outputs`, `effects`,
- runtime command IDs returned by output dispatch,
- selected client/session metadata when dispatch happens through
  `RuntimeService`,
- browser result payloads including target/snapshot/extraction data,
- failure routes for timeout, selector miss, page unsupported, or no paired
  client.

No browser extension storage should become source-of-truth for flow runs. The
extension can keep transient UI activity, but run records belong to the host.

## Safety And Authorization

- Keep `requiresApproval` on review-level outputs by default.
- Safe outputs:
  - `web.dom.extract`
  - wait/capture snapshot actions
- Review outputs:
  - navigation,
  - click,
  - type/clear/select,
  - keypress,
  - scroll when it mutates task context.
- Never replay an action from state evidence alone.
- Require a paired ready client with `domainId: "web-automation"`.
- Prefer explicit `sessionId` when a recording/flow chose a browser context.
- Do not allow importer/code nodes to emit arbitrary undeclared output IDs.
- Preserve native runtime grants as an authorization boundary, not a sandbox.

## Implementation Plan

Progress status:

- [x] Phase 1: Structure and exports.
- [x] Phase 2: Runtime capability projection.
- [x] Phase 3: Output node definitions.
- [x] Phase 4: Extension runtime router.
- [x] Phase 5: Host-owned flow execution.
- [x] Phase 6: State/snapshot runtime.

### Phase 1: Structure and exports

- Create `domain/src/runtime/*` and `domain/src/output-nodes/*`.
- Move output payload/target helpers behind output-node exports.
- Split IO gateway input/output helpers out of `web-automation-io.ts`.
- Update `domain/src/index.ts` and `domain/src/client/index.ts` exports.
- Add compatibility exports for existing import paths.

Acceptance criteria:

- Domain package check passes.
- Existing extension imports keep working.
- No behavior changes in recording or action dispatch.

### Phase 2: Runtime capability projection

- Add domain/client runtime capability builders.
- Include `domainId`, `inputIds`, and `outputIds` in extension capabilities.
- Update or account for client-gateway capability typing so runtime transport
  sees output IDs.
- Register/bind the generic runtime transport in web automation host setup.
- Add runtime snapshot validation for a paired extension client.

Acceptance criteria:

- Runtime snapshot lists the paired extension as a ready web automation client.
- Runtime capabilities include all web output IDs.
- `RuntimeService.dispatch({ kind: "execute_action", outputId })` selects the
  extension client.

### Phase 3: Output node definitions

- Generate node definitions from `webAutomationActionDefinitions`.
- Add per-output parameter metadata and safety metadata.
- Register web output nodes through Automation Studio importer/native node
  registry if needed for authoring.
- Ensure recording-derived nodes continue to materialize output IDs and
  parameters.

Acceptance criteria:

- Authoring can list web output nodes for the web automation domain.
- Output nodes declare `outputAction.fixedOutputId`.
- Invalid output IDs fail validation.

### Phase 4: Extension runtime router

- Extract background command routing into `apps/extension/src/runtime`.
- Normalize all gateway commands through domain runtime mapping helpers.
- Extract content action implementations into `content/actions.ts`.
- Add explicit timeout and unsupported-page handling per command.
- Add result mapping with runtime command IDs and visual targets.

Acceptance criteria:

- Existing execute-action gateway tests/smoke tests pass.
- Runtime action results include status, message/error, target, and payload.
- Content script remains focused on page observation and page action execution.

### Phase 5: Host-owned flow execution

- Add a small host API or script entry point to run a project flow by ID.
- Ensure `runRuntimeSession()` uses `createRuntimePolicyEffectDispatcher()`.
- Pass `authorizedDomainIds: ["web-automation"]`.
- Store runtime sessions and graph traces under project runtime storage.
- Surface run status in the extension UI only as observer/status, not as the
  run record owner.

Acceptance criteria:

- A recorded flow can replay through the paired extension.
- Failed selector/action routes are visible in the graph trace.
- Runtime command attempts are linked to graph node attempts.

### Phase 6: State/snapshot runtime

- Consolidate snapshot creation in `content/snapshots.ts`.
- Add read-state behavior if core protocol supports it; otherwise document
  snapshot-as-state fallback.
- Ensure confirmation inputs from IO are emitted for replay confirmation.

Acceptance criteria:

- `capture_snapshot` works from `RuntimeService`.
- Output confirmation waits on the registered action input when configured.
- Snapshot payloads preserve visual target/state coordinate data.

## Tests

### Domain tests

- Output payload mapper per output ID.
- Target extraction fallback from `selector`, `element.selector`, and
  `visualTarget`.
- Runtime capability builder includes `outputIds`.
- IO validation catches missing output adapters and invalid action bindings.
- Recording input/output binding still marks only action-role events as
  executable.

### Extension tests

- Background command router maps gateway command to content action.
- Unsupported pages reject mutating actions.
- Multiple eligible sessions require explicit selection.
- Action result mapping preserves visual target and snapshot.
- Capture snapshot routes through the same snapshot builder as recording.

### Integration tests

- Pair a mock extension client, dispatch `execute_action` by `outputId`, and
  verify runtime attempt/client selection.
- Run a simple flow: start -> web click output -> end.
- Run a failure flow: start -> missing selector -> failure route -> end.
- Verify runtime session storage includes trace and command IDs.

## Open Questions

- Should core always bind `RuntimeService` into Automation Studio by default, or
  should host packages call an explicit binder?
- Should client gateway protocol grow `read_state` now, or should web state be
  represented as `capture_snapshot(kind: "state")` until another domain needs
  request/response state reads?
- Should authoring use generated importer node definitions for each web output,
  or continue using `builtin.policy.action` nodes with stronger output metadata
  for the first replay slice?
- Should runtime client selection prefer the recording source session by
  default when a flow was generated from that recording?

## Recommended First PR

The first PR should be a low-risk structural slice:

- add `domain/src/runtime` and `domain/src/output-nodes`,
- move payload/target helpers with compatibility exports,
- split IO gateway helpers,
- add capability builders with output IDs,
- update exports,
- add focused domain tests.

That creates the backbone for flow replay without touching the large extension
connection/content scripts yet.

## Progress Log

### 2026-08-20 Phase 1

Completed:

- Added `domain/src/output-nodes` with payload, target, registry, and
  Automation Studio node-definition helpers.
- Kept `domain/src/web-panel/output-nodes.ts` as a compatibility export.
- Split gateway input listening into `domain/src/io/gateway-input-hub.ts`.
- Split gateway output dispatch into
  `domain/src/io/gateway-output-dispatcher.ts`.
- Added `domain/src/runtime` with capability builders, command/result helpers,
  trace helpers, a web automation runtime adapter, and host registration
  helpers.
- Wired `registerWebAutomationDomain()` to register the web runtime adapter,
  optional gateway transport, and Automation Studio runtime service binding.
- Updated package barrels so domain and client consumers can import the new
  runtime/output-node surfaces.

Implementation note:

- The linked core gateway capability contract does not yet expose `outputIds`
  directly. Because `RuntimeService` selection requires `outputIds` when a
  command includes `outputId`, the web automation host now registers a direct
  runtime adapter with explicit output IDs and dispatches through the existing
  client gateway bridge. This preserves the current core package while enabling
  host-owned flow replay.

Verification:

- `pnpm --filter @fluxiq-web-extension/domain check`

### 2026-08-20 Phase 2

Completed:

- Added explicit runtime capabilities for actions, snapshots, state, and
  host-owned flow replay.
- Added gateway/client capability builders that carry `domainId`, `inputIds`,
  and `outputIds` in metadata and typed extension fields.
- Registered the web automation runtime adapter during host setup.
- Bound Automation Studio to the host runtime service during web automation
  domain registration.
- Added smoke-test coverage that verifies runtime capabilities include web
  output IDs.

Verification:

- `pnpm --filter @fluxiq-web-extension/domain check`
- `pnpm --filter @fluxiq-web-extension/domain test`

### 2026-08-20 Phase 3

Completed:

- Added generated Automation Studio output-node definitions for all canonical
  web automation outputs.
- Added per-output parameters, safety metadata, fixed output-action contracts,
  runtime capability requirements, and registry helpers.
- Added smoke-test coverage that validates every generated output-node
  definition through FluxIQ core validation.

Verification:

- `pnpm --filter @fluxiq-web-extension/domain check`
- `pnpm --filter @fluxiq-web-extension/domain test`

### 2026-08-20 Phase 4 Background Router

Completed:

- Added `apps/extension/src/runtime` with background action execution,
  command routing, and result-mapping modules.
- Replaced the inline `execute_action` and `capture_snapshot` branches in
  `connection.ts` with `ExtensionRuntimeCommandRouter`.
- Kept the existing content-script message contract unchanged for this substep.
- Added unsupported-page rejection for mutating runtime actions before content
  execution.

Verification:

- `pnpm --filter @fluxiq-web-extension/extension check`

### 2026-08-20 Phase 4 Content Runtime Split

Completed:

- Added `apps/extension/src/content/actions.ts` as the content-side runtime
  action executor.
- Updated `content/index.ts` to delegate action execution to the new module
  while retaining existing DOM helper implementations.
- Added `apps/extension/src/content/snapshots.ts` for snapshot attachment
  policy used by recording/runtime capture paths.

Verification:

- `pnpm --filter @fluxiq-web-extension/extension check`
- `pnpm --filter @fluxiq-web-extension/extension build`

### 2026-08-20 Phase 5 Host-Owned Flow Execution

Completed:

- Added `runWebAutomationFlow(fluxiq, input)` as the domain-owned helper for
  project flow replay.
- The helper registers the web automation runtime path, authorizes the
  `web-automation` domain, and delegates graph execution to Automation Studio
  `runRuntimeSession()`.
- Updated `domain/src/web-panel-host.ts` so the FluxIQ web-panel host binds the
  same runtime adapter and Automation Studio runtime service path as
  `createWebAutomationFluxIQ()`.

Verification:

- `pnpm --filter @fluxiq-web-extension/domain check`

### 2026-08-20 Phase 6 State/Snapshot Runtime

Completed:

- The web automation runtime adapter implements both `captureSnapshot` and
  `readState`.
- `readState` intentionally uses structured snapshot capture because the
  current gateway protocol has `server.capture_snapshot` but no
  `server.read_state` command.
- Added extension runtime `snapshot-runner.ts` and `state-reader.ts` modules to
  make that fallback explicit.
- Kept snapshot capture source-of-truth in the content script and avoided
  introducing a second state protocol.

Verification:

- `pnpm --filter @fluxiq-web-extension/domain check`
- `pnpm --filter @fluxiq-web-extension/domain test`
- `pnpm --filter @fluxiq-web-extension/extension check`
- `pnpm --filter @fluxiq-web-extension/extension test`

### 2026-08-20 Final Verification

Completed:

- Ran focused domain and extension checks/tests after the runtime slices.
- Ran full workspace check, build, and test commands.
- Build output was regenerated for the extension bundles.

Verification:

- `pnpm --filter @fluxiq-web-extension/domain check`
- `pnpm --filter @fluxiq-web-extension/domain test`
- `pnpm --filter @fluxiq-web-extension/extension check`
- `pnpm --filter @fluxiq-web-extension/extension build`
- `pnpm --filter @fluxiq-web-extension/extension test`
- `pnpm check`
- `pnpm build`
- `pnpm test`

### 2026-08-20 Runtime Automation Tab Note

User requirement:

- Runtime execution should spawn a new browser tab when it first starts and run
  the automation flow in that tab. More detailed settings will come later.

Implementation target:

- [x] Add a small extension runtime tab owner that creates/reuses a dedicated
  automation tab for runtime commands without explicit `tabId`.
- [x] Keep explicit `tabId` commands supported for future advanced settings.

Completed:

- Added `apps/extension/src/runtime/automation-tab.ts`.
- Runtime commands without explicit `tabId` now create/reuse an
  extension-owned automation tab.
- First-command navigation opens the automation tab at the requested URL.
- Explicit `tabId` still bypasses the automation-tab default.

Verification:

- `pnpm --filter @fluxiq-web-extension/extension check`
- `pnpm --filter @fluxiq-web-extension/extension build`

### 2026-08-20 Navigate Readiness Fix

Finding:

- The "flow stops after the start URL" behavior was extension-side, not core.
  Core/Automation Studio awaits each action result before advancing. The
  extension runtime runner was returning `succeeded` immediately after
  `chrome.tabs.update()` for `web.browser.navigate`, before the page completed
  loading and before the content script was attached.
- A second extension-side issue also blocked replay: recorded policy actions
  often include `confirmationInputId`. During replay, the extension emitted
  `client.action_result`, but did not emit a matching action-input
  `client.recording_event` unless recording mode was active. Core therefore
  waited for inputs such as `web.user.navigation_requested` and timed out.

Completed:

- Untargeted runtime navigation now forces a new automation tab.
- Navigation waits for tab load completion.
- Navigation attaches the content script before returning success, so the next
  runtime node can execute in the new tab.
- Existing explicit `tabId` commands still target the requested tab.
- Runtime action success now emits a lightweight confirmation
  `client.recording_event` with the expected web automation action input ID.

Verification:

- `pnpm --filter @fluxiq-web-extension/extension check`
- `pnpm --filter @fluxiq-web-extension/extension build`

### 2026-08-20 Debug Failure / New-Tab Follow-Up

Finding:

- The immediate debug failure is not a core runtime defect. Core correctly
  requires executable importer node definitions to have trusted-local native
  implementations bound at the host boundary.
- The web extension host had declared generated web output nodes as executable
  in the domain package, but `registerFluxIQHost()` registered `nodes: []` and
  `implementations: {}` with `AutomationStudioNativeNodeRuntime`.
- If a debug flow contains generated nodes such as `web.output.browser-navigate`
  directly, core rejects them before any browser tab automation can happen.

Completed:

- Added `domain/src/output-nodes/native-runtime.ts` with the web automation
  importer manifest, runtime grants, and native implementations for every
  generated web output node.
- Updated the web-panel host to bind those node definitions and implementations
  instead of registering an empty native runtime.
- Runtime navigate commands now always create a new automation tab at the
  requested URL, even if an older command path includes a target tab id.
- Extension runtime action execution now catches unexpected action-runner
  errors and reports an explicit failed action result to the gateway.
- The latest runtime artifact showed the immediate failure was actually gateway
  session selection: `A single paired web-automation client must be selected
  before dispatching an output.`
- Domain runtime dispatch now selects eligible clients by the advertised
  `web.actions` capability and accepts both `connected` and `ready` paired
  sessions, instead of requiring duplicate session-level domain metadata.

Verification:

- `pnpm --filter @fluxiq-web-extension/domain check`
- `pnpm --filter @fluxiq-web-extension/domain test`
- `pnpm --filter @fluxiq-web-extension/extension check`
- `pnpm --filter @fluxiq-web-extension/extension build`
- `pnpm --filter @fluxiq-web-extension/extension test`
- `pnpm check`
- `pnpm build`
- `pnpm test`

### 2026-08-20 Extension Runtime Debug UI

Finding:

- After the automation tab opened and navigation succeeded, the runtime could
  still fail with little extension-side visibility.
- Runtime confirmation events also carried `inputId` but not `domainId`; the
  domain input hub filters confirmations by `metadata.domainId`, so core could
  keep waiting after navigation even though the extension emitted an event.

Completed:

- Added `RuntimeCommandStatus` to extension status so popup/sidepanel can show
  the active runtime command, target, tab, result message, and error.
- The background connection now marks runtime commands as running, succeeded,
  or failed and writes matching activity-feed entries.
- Added a runtime status card to the recorder view in the popup/sidepanel.
- Runtime confirmation events now include `domainId: web-automation` alongside
  their `inputId`.
- Rebuilt the extension bundle so the loaded extension can show the new runtime
  diagnostics.
- Follow-up fix: the sidepanel reuses the popup script but has separate HTML,
  so it must include the same runtime-card element IDs as the popup.

### 2026-08-20 Runtime Status Accuracy / Redirect Readiness

Finding:

- A visible click could be reported as failed when the command reached the page
  while Chrome still reported a transient Google `RotateCookiesPage` URL.
- Content target resolution failed immediately on a stale selector and did not
  attempt coordinate, visual-target, or fingerprint fallback.
- The runtime status card preferred `result.url` as the displayed target for DOM
  actions, which made a stale/interstitial URL look like the clicked target.

Completed:

- Navigation readiness now waits for a stable completed tab URL and treats
  Google `RotateCookiesPage` as transient before running the next command.
- Non-navigation actions wait for the automation tab to settle before dispatch.
- Content target resolution now falls back from selector to coordinates,
  visual-target bounds, and recorded element fingerprint before failing.
- DOM action status keeps the command target/element target instead of replacing
  it with the current page URL.

Follow-up finding:

- A failed click artifact showed the content result came from a non-top
  `accounts.google.com/RotateCookiesPage` frame with a zero-size viewport.
  Runtime actions were sent without an explicit frame id, allowing an iframe
  content script to answer instead of the top page.

Follow-up completed:

- Runtime DOM actions now default to frame `0` unless an action explicitly
  targets another frame.
- Runtime action messages now include a top-frame-only guard, and content
  scripts in subframes ignore untargeted runtime actions.
- Added a content-script version handshake so already-open pages get reinjected
  when the extension runtime/content action protocol changes.

Verification:

- `pnpm --filter @fluxiq-web-extension/extension check`
- `pnpm --filter @fluxiq-web-extension/extension build`
- `pnpm --filter @fluxiq-web-extension/extension test`
- `pnpm --filter @fluxiq-web-extension/domain check`
- `pnpm --filter @fluxiq-web-extension/domain test`
- `pnpm check`
- `pnpm build`
- `pnpm test`

Verification:

- `pnpm --filter @fluxiq-web-extension/domain check`
- `pnpm --filter @fluxiq-web-extension/domain test`
- `pnpm --filter @fluxiq-web-extension/extension check`
- `pnpm --filter @fluxiq-web-extension/extension build`
- `pnpm --filter @fluxiq-web-extension/extension test`
- `pnpm check`
- `pnpm build`
- `pnpm test`
