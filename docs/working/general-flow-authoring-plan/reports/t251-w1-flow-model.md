# t251-w1-flow-model: Flow inputs, bindings and For Each rows in Core

Paths are relative to `C:/Users/osrs_/FluxStuff/!FluxIQ/packages/fluxiq/src/programs/automation-studio/`.
Core HEAD read: `424a70b3`. Read only, nothing edited.

## Outcome

Done. All five questions are answered below. Each has file:line citations and a conclusion.

## What changed and why

Nothing changed in code. The only file written is this report.

## Findings

### Q1. Does the Flow document declare inputs?

- The deprecated `AutomationStudioFlowDocument` (`model/artifacts.ts:33-45`) has **no** inputs, interface or variables. It holds only `nodes`, `edges` and `metadata`. It is the shape the executor runs (`runtime/executor/graph-run.ts:70`, `runtime/executor/node-inputs.ts:9`).
- The canonical `AutomationStudioFlowArtifact` (`model/flows.ts:197-226`) **does** declare inputs:
  - `interface: AutomationStudioFlowInterface` at `model/flows.ts:207`, which is `{ inputs: AutomationStudioFlowPort[]; outputs: AutomationStudioFlowPort[] }` (`model/flows.ts:143-146`).
  - Each port is `{ id, name, valueType, description?, required?, defaultValue?, metadata? }` (`model/flows.ts:133-141`). Its value type is a structured `AutomationStudioFlowValueType`, including `array`, `record` and `schema` (`model/flows.ts:128-131`).
  - The artifact also declares `variables: AutomationStudioFlowVariable[]` (`model/flows.ts:209`), each with an `initialValue` (`model/flows.ts:154-161`).
  - A new blank Flow starts with `interface: { inputs: [], outputs: [] }` (`model/flows.ts:380`).
- The store persists the ports as rows: portId, name, valueType, required, defaultValue (`runtime/service/flows/store.ts:342`).
- A published snapshot carries a frozen `interface` (`model/flows.ts:178`).

### Q2. How a run receives inputs, and how a native node receives them

- **Service entry.** `runFlow`/the run entry copies `input.inputs` into `startRuntimeSession` (`runtime/service.ts:2522`). Session metadata keeps only the input keys, with withheld values (`runtime/service.ts:2417`).
  - `graphOptions.inputs` is set to `input.inputs ?? {}` verbatim (`runtime/service.ts:2554-2556`).
  - No input is checked against `interface.inputs` at this point: neither required ports nor types.
  - Declared defaults are **not** applied to the root run. `runCanonicalAutomationStudioFlow` runs the root with `options.inputs ?? {}` (`runtime/composite-executor.ts:89`).
  - Defaults are applied only to a Call Flow child, from the snapshot interface (`runtime/composite-executor.ts:47-53`). The child's other inputs come only from the call's `inputBindings` (`targetPortId`/`valueKey`) (`model/composites.ts:45-46`).
- **Executor options.** `AutomationStudioGraphExecutionOptions.inputs`, `declaredInputDefaults` and `variables` are defined at `runtime/executor/contracts.ts:401-409`.
  - The run's `values` map is seeded from `options.inputs` (`runtime/executor/graph-run.ts:338`).
  - Every run input is marked withheld before the first node runs (`runtime/executor/graph-run.ts:160`, `:177`).
- **Native node (t209, 9f56c0dd).** A native node receives `{ ...options.inputs, ...collectWiredNodeInputs(flow, node, values) }` (`runtime/executor/node-execution.ts:150-156`).
  - `collectWiredNodeInputs` maps each incoming edge's `${sourceNodeId}.${sourcePortId}` value onto `edge.targetPortId`. It skips `in` and port-less edges (`runtime/executor/node-inputs.ts:22-29`).
  - The native runtime then keeps only the ports the definition declares (`runtime/native-node-runtime.ts:86`).
  - **So a Flow input reaches a native node only when the input's id equals one of that node's declared input port ids.** It travels by port id, not by parameter.
  - A native node's parameters are the resolved `executionNode.parameterValues` (`runtime/executor/node-execution.ts:119-121`, `runtime/native-node-runtime.ts:87`).
- **Builtin node.** A builtin node receives `collectNodeInputs`, which is every run value plus the wired ports on top (`runtime/executor/node-inputs.ts:9-11`, `runtime/executor/node-execution.ts:105`, `:194`).

### Q3. Binding syntax for a parameter

There is exactly one binding form, the **`$state` binding**. No template or expression syntax exists: `"expression"` is only a declared value type (`nodes/contracts.ts:44`), and nothing in `nodes/` or `runtime/executor/` evaluates `{{...}}`.

- **Shape.** `{ "$state": { "path": string, "fallback"?: JsonValue } }` (`nodes/contracts.ts:66-72`). The builder is at `nodes/parameter-bindings.ts:24-26` and the type guard at `:28-32`.
- **Resolution.** `resolveAutomationNodeParameterValues` resolves bindings at any depth up to 16 (`nodes/parameter-bindings.ts:13`, `:41-72`).
  - A missing path with no fallback leaves the value out and reports it (`:58-62`). The node then fails with `executor.parameter.unresolved_state_path`, which is not retryable (`runtime/executor/node-execution.ts:122-142`).
- **The state a path reads.** It is built by spreading, later entries winning (`runtime/executor/node-execution.ts:106-115`), in this order:
  1. `options.inputs`, the **Flow inputs**.
  2. Live run variables.
  3. `values`, which holds **every earlier output** twice, as `${nodeId}.${outputId}` and as the bare `outputId` (`runtime/executor/graph-run.ts:443-446`).
  4. This node's wired inputs.
- **Path lookup** (`nodes/parameter-bindings.ts:105-138`). An exact key wins. Otherwise the longest dotted prefix that is an own key is tried, then the rest of the path is walked. That is what lets node ids containing dots work.
- Therefore, at run time:
  - **A Flow input**: `{"$state":{"path":"<inputId>"}}` resolves, unless a bare node output or a variable with the same key overwrote it. Inputs are spread first, so they lose collisions.
  - **An earlier output**: `{"$state":{"path":"<nodeId>.<outputId>[.field...]"}}` resolves.
  - **The current For Each row**: `{"$state":{"path":"<forEachNodeId>.item[.field]"}}` resolves. So does the bare `item`, but the bare key is ambiguous across loops.
- **Opt-out.** Parameters are bindable by default, and `allowStateBinding: false` opts a parameter out (`nodes/contracts.ts:53-54`). These opt out: For Each `maxStepsPerIteration` (`nodes/control-flow/for-each.ts:43`), policy action `recordOutput` (`nodes/policy/action.ts:47-48`), and write-records (`nodes/data/write-records.ts:27`).
- **Plan validation** (`runtime/flow-bootstrap/plan/validation.ts:225-231`, `:484-497`).
  - It refuses a binding that is disallowed, has an empty path, or names the output id to run.
  - It does **not** check that the path names a declared Flow input or an upstream output. A binding to nothing passes validation and fails only at run time.
  - The catalog tells the model which parameters are not bindable (`stateBindable: false`) (`runtime/flow-bootstrap/plan/parameter-text.ts:55`, `runtime/flow-bootstrap/plan/contracts.ts:91`).
- **The node-id gap.** A plan node's key becomes the Flow node id `node.bootstrap.<namespace>.<subflowKey>.<nodeKey>`, or a reused id (`runtime/flow-bootstrap/adaptation.ts:202-205`). Parameters are copied verbatim (`:213`). No step rewrites a `$state` path that names a plan key. **An authored binding to "the output of step X" by plan key would therefore never resolve.** Only bare output keys and Flow input ids are stable across materialisation.
- **Coercion caveat.** An authoring `array` parameter wraps a non-array value in a list (`runtime/flow-bootstrap/authoring/normalise.ts:156`). A `$state` object written for an array parameter would become `[binding]` and resolve to `[value]`.
- **The other modules named in the brief hold no binding syntax.**
  - `io-bridge.ts` maps an IO input event to an output through `resolveInputOutputBinding` (`runtime/io-bridge.ts:33-53`). That is recording evidence, not a Flow parameter.
  - `io-policy.ts` receives `action.parameters` already resolved (`runtime/io-policy.ts:213-231`).
  - `runtime/contracts.ts:4-8` only carries a `variables` record.
  - `authoring/values.ts` and `authoring/keys.ts` only turn written text into typed values and normalise keys (`authoring/values.ts:34-48`, `authoring/keys.ts:9-11`). Neither knows `$state`.

### Q4. How For Each hands `item` to a node

- **Each pass.** `forEachPass` stores `{ items, index }` in the run's iteration state. A pass returns route `body` with outputs `{ item, index, count }`; the last pass returns `done` with `{ count }` (`nodes/control-flow/for-each.ts:56-75`).
  - The `items` input is read from `context.inputs.items` (`:61`), which is the merged view: a wired `items` edge, or any run value keyed `items`.
  - The `item` output port is `multiple: true` (`:23`).
- **Into the run.** `graph-run.ts` writes the outputs into `values` as both `<forEachId>.item` and bare `item` (`runtime/executor/graph-run.ts:443-446`). It grants the body extra steps each pass (`:227-239`).
- **Into a node, two ways:**
  1. **By edge (the intended way).** An edge from For Each `item` to a target port `item` is collected by `collectWiredNodeInputs` (`runtime/executor/node-inputs.ts:22-29`). Authoring draws that edge to every body step whose node declares an `item` input (`runtime/flow-bootstrap/authoring/draft-routing.ts:24-26`, `:68-72`, `:259-268`). A native node sees it only if `item` is a declared port (`runtime/native-node-runtime.ts:86`).
  2. **By `$state` binding**, through the state described in Q3 (`runtime/executor/node-execution.ts:106-115`).
- **Leak guard.** Bare `item` deliberately does not reach a native node unless an edge wires it (`runtime/executor/node-inputs.ts:13-21`, `runtime/executor/node-execution.ts:151-155`). A builtin node and parameter resolution can still read the bare key.

### Q5. How an authored plan declares inputs, and what the bootstrap contract allows

- **The plan has no inputs section.** `AutomationStudioFlowBootstrapPlan` is `{ schemaVersion, router, subflows }` (`runtime/flow-bootstrap/plan/contracts.ts:71-75`).
  - A subflow is `{ key, name, role, nodes, edges }` (`:44-50`).
  - A node is `{ key, definitionId, definitionVersion, parameters?, outputActionId?, consequences?, routeSignatures? }` (`:12-36`).
  - An edge runs from `{nodeKey, portId}` to `{nodeKey, portId}` (`:38-42`).
- **The build context has no Flow-input list either.** `AutomationStudioFlowBootstrapContext` holds the catalog, the routing, `startLocation` and node descriptions (`:100-153`). The catalog entry lists node ports and parameters, not Flow inputs (`:77-98`).
- **The JSON-plan reader adds nothing.** `json-plan.ts` builds subflows, nodes and edges only (`runtime/flow-bootstrap/authoring/json-plan.ts:59-95`, `:112-205`). When no edge was written, it wires a node's first input port (`:275`, `:285`).
- **Inputs come from the parent Flow.** When a plan is materialised, the primary subflow's graph copies the parent Flow's existing `interface` (`runtime/flow-bootstrap/adaptation.ts:207`). It also receives an identity `inputMapping` from each parent input to a subflow input of the same id (`:248-254`). Other subflows get an empty interface (`:207`).
- **Build routing.** It is handed `flowInputs: parent.interface.inputs` (`runtime/service.ts:1541`).
- **In short,** a build can read Flow inputs that someone else declared, by id, through `$state`. It cannot declare, type or default an input itself.

## Conclusion

**What exists.**
- The canonical Flow declares typed inputs with defaults (`model/flows.ts:133-146`, `:207`), and run-scoped variables.
- A run takes free-form `inputs`, and they are visible to every node.
- One binding mechanism, `$state`, lets any bindable parameter, at any depth, read four things:
  - a Flow input, by id;
  - an earlier output, as `<nodeId>.<outputId>[.path]` or the bare output id;
  - a variable;
  - the current row, as `<forEachId>.item` or bare `item`.
- An unresolved binding fails the step without retry.
- For Each rows also travel by edge to a node's declared `item` port. That is what drafts do today, and it is the only way a native web step receives the row as an input.

**What is missing for "a step bound to a Flow input, an earlier output, or the current row".**
1. The bootstrap plan cannot declare Flow inputs: no names, types or defaults (`plan/contracts.ts:71-75`). The parent interface is copied as is.
2. A `$state` path that names a plan node key is not rewritten to the materialised id `node.bootstrap.<ns>.<subflow>.<key>` (`adaptation.ts:202-213`). Bindings to earlier outputs are therefore unusable from a plan, except through ambiguous bare output ids.
3. Plan validation does not check that a binding's path names a declared input or an upstream reachable output (`plan/validation.ts:225-231`). The error appears only at run time.
4. Root runs neither apply `interface.inputs` defaults nor enforce `required` (`composite-executor.ts:89`, `service.ts:2554-2556`). A bound input that was not supplied fails at the node instead of at run start.
5. Bare keys collide in a flat namespace: Flow inputs are overwritten by same-named outputs (`node-execution.ts:106-115`, `graph-run.ts:445`). There is no reserved namespace such as `input.<id>`, `step.<key>.<out>` or `row`.
6. A native node's *parameters* can be bound, but its *ports* are filled only by edges or by a Flow input whose id matches the port id (`node-execution.ts:156`, `native-node-runtime.ts:86`). No mapping from a Flow input to a differently named port exists outside Call Flow `inputBindings` (`model/composites.ts:45-46`).

## Commands run and observed results

These were read-only `grep`, `sed -n` and `cat -n` over Core source, plus `git log -1` (HEAD `424a70b3`) and `git show --stat 9f56c0dd`. That commit touched `runtime/executor/node-execution.ts` and its test, as described in Q2. No builds or tests were run, as the brief asked.

## Not verified

- No test was run to confirm the resolution behaviour in practice: for example, that `<forEachId>.item.field` resolves in a live run, or that an input collides with a bare output.
- I did not trace the extension-side web native nodes to see which of them declare an `item` port or other input ports.
- The `flowInputs` use inside build routing (`route-state/build-routing.ts`) was not read.
- The flow-script (non-JSON) authoring format (`plan/flow-script-format.ts`) was not checked for any binding spelling.

## Open questions or contradictions found

- `collectNodeInputs` (the merged view, `node-inputs.ts:9-11`) still feeds builtin nodes and parameter resolution with bare keys. The leak guard covers native ports only, so a builtin node after a loop can still read the last `item`.
- Should the general authoring design reserve namespaced binding paths, and rewrite plan keys to node ids on materialisation, rather than rely on bare keys?
