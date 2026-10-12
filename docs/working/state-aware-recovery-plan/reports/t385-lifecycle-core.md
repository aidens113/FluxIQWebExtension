# t385 R1-lifecycle-core - worker report

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t385/!FluxIQ` (branch `task/t385-lifecycle-core`). Nothing committed.
AS = `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

Done. Every item in the brief is implemented as types and pure functions, with tests, and no graph-run wiring.
The Core typecheck, the web typecheck and the structure audit pass. The new tests pass, and the existing executor,
node, model and validation tests pass unchanged.

| Item | State |
| --- | --- |
| C1 frame and stack types | Done: `AS/runtime/executor/frames/` |
| C2 entry/checkpoint/successCheck types, reader, replay restriction, entry selection | Done |
| C3/C4 events, registration types, scope resolver, failed edge, way-on and interference read as registrations | Done |
| C5 continuation, dispositions by phase, refusals | Done |
| C6 true-failure classifier | Done |
| C7 incident, occurrence key, budget defaults, ledger | Done |
| C9 FactCondition, three-valued result, "all true" evaluator | Done |
| C4 node definitions, Core validation, web validation | Done |

## What changed and why

New, Core:
- `AS/runtime/executor/frames/{invocation-frame,stack,index}.ts`: `AutomationStudioInvocationFrame` and its parts
  (`AutomationStudioFramePhase`, `AUTOMATION_STUDIO_FRAME_PHASES`, `AutomationStudioFrameEntry`,
  `AutomationStudioFrameCursor`), plus `AutomationStudioFrameStack` (outermost first) and `AutomationStudioFramePath`.
  `graphRevision` is `number | null`, as `runtime/flow-version` records it.
- `AS/runtime/executor/lifecycle/` (barrel `index.ts`):
  - `fact-condition.ts`: `AutomationStudioFactCondition`, ops, `AutomationStudioFactTruth = "true"|"false"|"unknown"`,
    `AutomationStudioFactConditionResult {truth, evidenceRef?, capturedAt}`.
  - `fact-conditions-hold.ts`: `automationStudioFactConditionsHold(conditions, results)`. It returns "true" only when
    every condition has a "true" answer. A "false" answer gives "false". A missing or unknown answer gives "unknown",
    never "true". An empty list holds.
  - `fact-conditions-parse.ts`: `parseAutomationStudioFactConditions`. It names malformed conditions and never drops
    one silently.
  - `subflow-contract.ts`: `automationStudioSubflowContract(graph)` reads node metadata `fluxiq.entry` and
    `fluxiq.checkpoint`, and graph metadata `fluxiq.successCheck`. It reports problems and duplicate ids.
  - `entry-selection.ts`: `selectAutomationStudioEntry`. It sorts entries by ascending `order`, then document order.
    The first entry whose `when` is all true and whose `requires` are all bound wins; otherwise the default entry.
    The result also lists every entry it weighed, for traces.
  - `replay-restriction.ts`: `automationStudioNodeReplayRestriction`. The result is "never" for destructive nodes and
    nodes with `requiresApproval`. Otherwise it is "safe" when `RepeatIsSafe` holds, "reconcile" for a lasting act,
    and "safe" for everything else. `metadata.replay` only tightens it.
  - `registration.ts`: the `AutomationStudioHandlerRegistration`, `...Scope` and `...Source` types. The source kinds
    are `handler_node`, `failed_edge`, `optional_way_on` (with `budgetFree: true`) and `clears_interference`.
  - `graph-registrations.ts`: `automationStudioGraphHandlerRegistrations({graphFlowId, subflowId, nodes, edges})`.
    - Handler nodes are read from their parameters.
    - The authored `failed` edge and `error.<id>` ports become node-scoped `fail` registrations.
    - An optional way-on replaces the failed edge, as the ladder does today.
    - Each `clearsInterference` node becomes an implicit automation-scope `retry` registration that carries its
      `readyState`.
    - Authored paths get `order = AUTOMATION_STUDIO_AUTHORED_PATH_ORDER` (MAX_SAFE_INTEGER). An unconditional edge
      therefore comes after every conditional handler at node level. Without this, a node-scoped handler whose `when`
      holds could never run.
  - `scope-resolver.ts`: `resolveAutomationStudioHandlerCandidates({stack, registrations, event, nodeId})`.
    - It returns candidates level by level: node, then the current subflow, then ancestor subflows that `inherit`,
      then automation.
    - Within a level it sorts by `order`, then by nearer ancestor, then by document order.
    - Node scope is exact and keyed to the executing frame's graph, so it never reaches into a child frame.
    - Graphs that no active frame is running are excluded.
    - It returns nothing while any frame's phase is `handler`, so handlers never nest.
    - An interference node is never offered as its own recovery.
  - `continuation.ts`: the `AutomationStudioLifecycleContinuation` and `AutomationStudioHandlerDisposition` types,
    and `AutomationStudioLastingActStatus`.
  - `dispositions.ts`: `decideAutomationStudioDisposition`, which applies these rules in order:
    1. A Core stop wins, and so does an uncertain act, which stops the run as `outcome_uncertain`.
    2. A body that failed returns `unhandled`.
    3. The table is applied again: `resume` is refused at `fail`, and `resolve` is refused anywhere but `fail`.
    4. A `completionCheck` that is not "true" returns `unhandled`.
    5. A route is refused when the checkpoint is missing, its `when` is not true, a required value is unbound, it
       would pass an uncertain act, or it would re-enter a reconcile act without `not_landed`.
    6. A `resolve` must cover `requiredOutputIds`.
  - `true-failure.ts`: `classifyAutomationStudioFailure` returns one of `outcome_uncertain`, `retry_superseded`,
    `skip`, `state_route`, `planned_fail`, `deliberate_stop`, `on_fail_pending` or `true_failure`.
  - `incident.ts`: the `AutomationStudioRecoveryIncident` type and `automationStudioHandlerOccurrenceKey`. The key is
    the handler id, the node arrival (invocation, node and arrival number) and a 64-bit digest of the canonical JSON of
    the evidence. The digest uses FNV-1a, is pure and does not depend on key order.
  - `budget.ts`: `automationStudioLifecycleBudget(settings?)`. Each allowance comes from settings or its default.
    Routes map to `maxReroutesPerRun`, and alternatives map to `maxRecoveryAttemptsPerSubflow`.
  - `budget-ledger.ts`: the `AutomationStudioLifecycleLedger` type, `AUTOMATION_STUDIO_EMPTY_LIFECYCLE_LEDGER` and
    `chargeAutomationStudioLifecycleBudget`.
    - The ledger is keyed by incident, never by frame.
    - A handler run is refused when the same occurrence has used its `maxRuns`, when the incident has used 3 handler
      runs, or when the run has used 12.
    - `optional_way_on` and `retry_attempt` are always allowed and never counted.
- `AS/nodes/control-flow/handler.ts` (`builtin.control.handler`) and `handler-end.ts`
  (`builtin.control.handler-end`) are registered in `controlFlowNodes` and exported from the control-flow barrel.
  - `handler.ts` also holds `AUTOMATION_STUDIO_LIFECYCLE_EVENTS` and the scope kinds.
  - `handler-end.ts` also holds the dispositions, `automationStudioDispositionAllowedAt` (the static half of C5's
    table) and `AUTOMATION_STUDIO_SUBFLOW_CONTRACT_KEYS`.

Edited, Core:
- `AS/model/flows.ts`: four named defaults:
  - `AUTOMATION_STUDIO_DEFAULT_MAX_REROUTES_PER_RUN = 2`
  - `AUTOMATION_STUDIO_DEFAULT_MAX_RECOVERY_ATTEMPTS_PER_SUBFLOW = 2`
  - `AUTOMATION_STUDIO_DEFAULT_MAX_HANDLER_RUNS_PER_INCIDENT = 3`
  - `AUTOMATION_STUDIO_DEFAULT_MAX_HANDLER_RUNS_PER_RUN = 12`

  The stored settings object now uses the first two. Its values are unchanged.
- `AS/model/validation/flow.ts`: `validateAutomationStudioFlow(flow, context = {})`. It adds
  `AutomationStudioFlowValidationContext {subflowRole?, externalCheckpointIds?}` and two checks.
  - `validateFlowHandlers` refuses, with error codes:
    - `flow.handler_unknown_event`
    - `flow.handler_invalid_scope`
    - `flow.handler_scope_node_outside_graph`
    - `flow.handler_automation_scope_outside_recovery`
    - `flow.handler_body_without_end`
    - `flow.handler_inside_body`
    - `flow.handler_unknown_checkpoint`
    - `flow.handler_resolve_missing_outputs`
    - `flow.handler_missing_completion_check`
    - `flow.handler_disposition_not_allowed`
    - `flow.handler_end_unknown_disposition`
  - `validateFlowReachability` is new in Core. It raises a warning, `flow.node_unreachable`, for a node with no
    incoming route, and only when the graph has a Start node.
    - Exempt nodes: Start, Handler nodes, `fluxiq.entry` nodes and `clearsInterference` nodes.
    - Body nodes are entered by the body's route, so they are not reported.
- `apps/web/.../flow-editor/graph-validation.ts`: `automationFlowGraphProblems(nodes, edges, context = {})`.
  - The unreachable check now exempts Handler nodes, entry nodes and interference nodes.
  - It mirrors the Core handler refusals as problems with ids `handler:<code>:<nodeId>`.
  - Events and dispositions come from the node definition's own parameter options.

Tests added:
- `lifecycle/tests/`: scope-resolver, dispositions, budget-ledger, true-failure, fact-conditions, entry-selection,
  graph-registrations, replay-restriction and incident.
- `frames/tests/invocation-frame.test.ts`
- `nodes/control-flow/tests/handler.test.ts`
- `model/validation/tests/flow.test.ts`
- `apps/web/.../flow-editor/tests/graph-validation.test.ts`

## Commands run and observed results

Core commands were run in `packages/fluxiq` unless stated.
- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo` printed
  nothing (clean) on the final run. Earlier runs caught a readonly cast and an `exactOptionalPropertyTypes` test
  error; both are fixed.
- `npx vitest run AS/runtime/executor/lifecycle AS/runtime/executor/frames AS/runtime/executor/tests AS/nodes AS/model`
  printed "Test Files 63 passed (63), Tests 614 passed (614)".
- `npx vitest run AS/runtime/executor/tests AS/model/validation` printed "Test Files 26 passed (26), Tests 332 passed
  (332)".
- As a sanity check, because `validateAutomationStudioFlow` callers live there:
  `npx vitest run AS/runtime/flow-bootstrap/authoring/tests AS/dsl` printed "18 passed, Tests 197 passed".
- `node scripts/structure-audit.mjs` (run from the Core root) printed "structure-audit: passed (298 warning(s), 708
  baselined)".
  - The first run failed on `as never` casts in two of my tests. I replaced them with typed values.
  - New warnings: `lifecycle/` has 16 files (the advisory threshold is 15), and `model/flows.ts` has 13 exported
    values (advisory 8; it was already at 9).
- `pnpm --filter @fluxiq/contracts --filter fluxiq build` (from the Core root): fluxiq rebuilt and printed "Done". The
  web vitest config refuses to run against a stale Core `dist`, which is why I rebuilt it.
- In `apps/web`, `npx tsc --noEmit` exited 0 with no output, both before and after the test fix.
- In `apps/web`, `npx vitest run flow-editor/tests/graph-validation.test.ts views/tests/GraphEditorViews.test.ts
  graph/tests` printed "11 passed, Tests 67 passed". That includes the 2,000-node validation budget test.

## Not verified

- No full suites, by the brief's rule. Core's runtime/service tests, the web's other suites and downstream were not
  run.
- Nothing is wired into graph-run, so none of this has run inside a live run.
- Web validation does not check `resolve` coverage at subflow scope, because the editor has no interface outputs.
  Core does check it.
- The web exempts interference nodes and entry nodes from "unreachable". That changes the editor behaviour a little
  for existing Flows that use `clearsInterference`: those nodes are no longer reported.

## Open questions or contradictions found

1. **Where the vocabulary lives.** `model/` imports no runtime values (`flows.ts` says so), and value-importing the
   lifecycle barrel from `model/validation/flow.ts` would risk an import cycle.
   - I put the handler vocabulary on the node definitions (`nodes/control-flow`) instead: the events, scope kinds,
     dispositions, the allowed-at table and the C2 metadata keys. Lifecycle imports them from there.
   - The contract's names are unchanged.
2. **The web validator copies Core's rules.** `apps/web` can only reach `fluxiq/automation-studio/nodes`, and
   `nodes/index.ts` does not re-export the control-flow barrel. That file was not mine to edit.
   - To share one validator, `nodes/index.ts` would need to export the control-flow vocabulary or a shared validator.
3. **Metadata key form.** I used flat dotted keys: `metadata["fluxiq.entry"]`, `metadata["fluxiq.checkpoint"]` and
   `metadata["fluxiq.successCheck"]`. Authoring (R4) should write them through `AUTOMATION_STUDIO_SUBFLOW_CONTRACT_KEYS`.
4. **The Subflow role is not in the graph document.** `subflowRole` has to come through the validation context.
   - Without it, automation scope is refused (fail-closed).
   - The current callers (`service/flows/writer.ts`, `adaptations/patches.ts` and others) do not pass it yet. A
     recovery graph that holds an automation-scope handler would therefore be refused until they do.
5. **For R2:** `chooseAutomationStudioStartNode` (`start-node.ts`) counts a Handler node, which no edge enters, as a
   root.
   - A graph with no Start node and a Handler would hit `several_roots`, so R2 should exclude handler nodes there.
   - Graph-run will also need to exclude handler nodes and their bodies from ordinary stepping.
6. **For R2:** `runtime/executor/index.ts` was not mine to edit, so the new modules are not re-exported from the
   executor barrel. Import them from `runtime/executor/frames/index.ts` and `runtime/executor/lifecycle/index.ts`, or
   have the supervisor add re-exports.
7. **The Handler node has an `in` port.** `defineBuiltinNode` adds one to every node except Start, and the registry
   test requires it. A Handler therefore shows an `in` port, although nothing should enter it. Validation does not
   refuse an incoming edge to a Handler; that is not in the C4 list.
8. **`on_fail_pending` is an extra classifier verdict.** It means an applicable On Fail handler has not run yet. C6 did
   not name it, but a pure classifier must answer for that case, and it is not a true failure.
