# t392 unit A: Call Subflow and invocation frames (C1)

Worker report. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ`, branch `task/t392-executor-integration`, uncommitted.
AS = `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

Done. All seven items of the brief are implemented. Typecheck is clean, the structure audit passes, and the new and existing narrow tests pass.

## What changed and why

**Frames (item 1)**, new files under `AS/runtime/executor/frames/`:
- `invocation-options.ts` (refined). `AutomationStudioRunFrames` gains an optional `runSubflow` (new type `AutomationStudioSubflowGraphRunner`), which says how this run executes a called Subflow graph. `AutomationStudioSubflowGraph` gains an optional `artifact` (the persisted graph Flow, which supplies the interface, declared errors, regions and timeout). Both fields are optional so unit B's code keeps compiling.
- `run-holder.ts`: `automationStudioRunFrames(runSubflow?)`. It holds the stack, and its ids are numbered within the run (`invocation-1`, `invocation-2`, ...).
- `graph-frame.ts`:
  - `automationStudioRootInvocation(flow, options, runSubflow?)` builds the root frame: subflowId = `options.currentSubflowId ?? null`, graphFlowId = flow id, graphRevision from `metadata.graphRevision` (read through `automationStudioFlowGraphVersion`), entry default, inputs = the run's inputs, and the cursor on the start node with phase `before_attempt`.
  - `runAutomationStudioGraphInFrame` pushes the frame, runs, and pops it in `finally`, so the pop also happens on failure or throw. A frame already on the stack is not pushed twice.
  - A bare run's holder gets a runner that strips the parent's `regionRuntime`/`nodeRegionIds`.
- `child-frame.ts`: `automationStudioChildInvocation(parent, {callNodeId, subflowId, graph, graphRevision, inputs})`. It shares `parent.run` by reference.
- `framed-trace.ts`: `automationStudioTraceInFrame` stamps `framePath` (the stack's ids up to this frame) on every attempt that has none.
- `graph-run.ts` changed by 3 lines (now 796 lines). `runGraphFromSeed` runs `runGraphToTrace` inside `runAutomationStudioGraphInFrame`, passing `runAutomationStudioGraph` as the bare runner. `runGraphToTrace` stamps the executed trace before the saved trace is derived, so the WeakMap identities of saved traces are unchanged.
- `executor/` itself gained no file. `expected-transition.ts` lost its one subroutine line.

**Node (item 2).** `AS/nodes/control-flow/call-subflow.ts` defines `builtin.control.call-subflow` and exports `AUTOMATION_STUDIO_CALL_SUBFLOW_DEFINITION_ID`:
- Parameters: `subflowId`, `inputs` (child input id -> parent value key), `outputs` (child output id -> parent value key), and `errors` (declared error id -> parent key for the message). `errors` is my addition: without it, `error.<id>` could never be chosen.
- Ports: `success`, `failed`. `error.<id>` routes resolve by edge `sourcePortId`, exactly as Call Flow's do.
- It is registered in the control-flow barrel, and therefore in the registry.
- It has an `execute` because `nodes/tests/registry.test.ts` requires one on every built-in. That `execute` only answers "runs only inside a run" and is never called by the executor.
- `retry-policy.ts` returns a one-attempt policy for this definition only. Its child nodes keep the four-attempt floor.

**Execution (item 3).**
- `AS/runtime/composite-execution/boundary.ts` (`automationStudioCallAcrossBoundary`) is `owner.ts`'s typed boundary, generalised:
  - no ambient values cross;
  - the child's inputs are its declared defaults plus its input bindings;
  - outputs come back as declared interface outputs plus the output bindings;
  - a failure becomes `error.<id>` only for a bound declared error;
  - the child runs under the earlier of the parent's and its own deadline;
  - the parent's start/stop nodes and its `invocation` are stripped;
  - the child frame's `outputs` are set from what it returns.
- `runChildWithBounds` moved verbatim into `child-bounds.ts`.
- `owner.ts`:
  - Its Call Flow now calls the boundary, with a child frame of `subflowId: null`.
  - It creates the root invocation when none is given.
  - It supplies and registers its own `runSubflow`: the child's regions are compiled and its Call Flow nodes run against the same snapshots.
- `frames/call-subflow.ts` (`automationStudioCallSubflow`):
  - It loads the target through `options.subflowGraphs.load`, runs it once through `invocation.run.runSubflow` as a new frame (parentInvocationId, callNodeId, subflowId, graphFlowId, graphRevision, sharing `run`), and returns `childTrace` and `subflowTarget`.
  - It refuses each of these as a failed result with a plain message and a non-retryable failure record, without running anything: no subflowId, a cycle (target subflowId already on the stack), no source, an unknown or unowned Subflow (`missing_router_or_subflow_target`), and no runner.
  - A failed child gives the container the message `Subflow X failed: <child's saved message>`.
- `node-execution/attempt.ts` dispatches Call Subflow before the native/composite path. It never offers the node to a host's `nativeNodeExecutor`. Binding scope is the same as for parameters: run inputs, live variables, values, then wired inputs. With `commandRun`, the holder's `runSubflow` must pass `acceptsComposite`, as Call Flow's executor must, so required-command runs accept only the owner's registered runner.

**Router-selected Subflow (item 4).** `AS/runtime/service/runtime-session/subflow-frame.ts` (`automationStudioBindRouterSubflowFrame`) binds `graphOptions` in place, only for a selected Subflow whose graph is owned:
- `inputMapping` is applied additively: the Flow's own inputs stay, so nothing that read them stops working.
- `currentSubflowId` is set to the selected Subflow, so the root frame is that Subflow.
- `subflowGraphs` is set:
  - ownership is checked with `automationStudioSubflowGraphIsOwned`;
  - graphs are loaded with the same getFlow + `materializeRecordingDerivedFlow` loader as the selected graph;
  - each graph is read once per run;
  - `recovery()` returns the `recovery`-role Subflow's graph.

It mutates `graphOptions` on purpose, so a re-run after a repair, which is handed the same options, runs as the same frame.

It returns `withOutputs(trace)` (applies `outputMapping` to `trace.values`) and `calledVersions(trace)`.

`service.ts` stays at 4380 lines. The selected-graph loader became a named lambda on the same line count, the bind call shares the `let routedFailedTraceAttempt` line, and the trace and metadata expressions were edited in place.

**flowVersions (item 5).** `calledVersions` walks the attempts recursively through `childTrace` for `subflowTarget`. The service spreads the result into `automationStudioRunFlowVersions([...])`.

**Subroutine removed (item 6).** Deleted `nodes/routine/subroutine.ts` and removed it from the routine barrel, the registry group description, `expected-transition.ts` and `canonical-registry.test.ts`, which now asserts that it is absent. Core and downstream docs mention it only in dated working reports, which I left alone.

**Requirement (item 7).** `AUTOMATION_STUDIO_EXECUTOR_GRANTED_REQUIREMENTS = [flowSubflowCalls]`. A test was added for the default grant.

**Tests added:**
- `AS/runtime/executor/frames/tests/call-subflow.test.ts` (7 tests):
  - only bound values cross the boundary, and an unbound parent value falls back;
  - `framePath` is `[invocation-1]` on the parent and `[invocation-1, invocation-2]` on the child;
  - a shared holder pops every frame, including when the runner throws;
  - a self cycle and a child-to-caller cycle are both refused;
  - a missing Subflow and a missing source are both refused;
  - the container is not re-run: 4 child dispatches and 1 container attempt;
  - a bound declared error routes `error.sold-out`.
- `AS/runtime/service/runtime-session/tests/subflow-frame.test.ts` (5 tests):
  - the Router input and output mappings are applied, through `runCanonicalAutomationStudioFlow`;
  - flowVersions names `graph.tally` at revision 7;
  - foreign graphs and unknown ids are refused, and each graph is read once;
  - nothing is bound for an unowned selection;
  - a Call Flow child gets a frame.

## Commands run and observed results

All of these were run in `packages/fluxiq` unless noted.

- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`: the final run printed no errors. Earlier runs showed errors in `live-patch.ts` and `live-patch/unit-replace.ts`, which come from concurrent work and are not my files; they are gone now.
- `node scripts/structure-audit.mjs 2>&1 | tail -1` at the Core root printed `structure-audit: passed (300 warning(s), 708 baselined).` Of my files, only `graph-run.ts` has a warning: 796 lines, past the 400-line advisory.
- `npx vitest run` over `runtime/executor/tests`, `runtime/tests/{composite-executor,executor,router-runtime}.test.ts`, `runtime/tests/service-flows`, `runtime/service/runtime-session`, `runtime/service/command-execution`, `runtime/flow-version`, `nodes` and `runtime/executor/frames` printed `Test Files 1 failed | 70 passed (71)`, `Tests 1 failed | 643 passed (644)`.
  - The one failure was `command-execution/tests/service.test.ts > io: real service ... admit two captured effects`, at 15074 ms, which is a timeout under the parallel load.
  - Re-running that test alone passed in 1728 ms.
  - Re-running `runtime/service/command-execution` as a whole printed `2 passed, 16 tests passed`.
- `npx vitest run` over the flow-bootstrap {answerability, authoring, plan, reachability, verification}, `llm/harness-options`, `llm/node-tools` and `build-judge` tests (these enumerate the built-in nodes) printed `81 passed | 1 skipped`, `958 passed | 2 skipped`.
- `npx vitest run model/validation/tests/flow.test.ts runtime/executor/lifecycle/tests/graph-registrations.test.ts` printed `2 passed, 17 tests`.

## Not verified

- No live browser or Lab run.
- No service-level test drives a Router run end to end with a Call Subflow node. The service wiring is covered by the unchanged Router and service-flows tests plus the module test of the bind function.
- Call Subflow under a required-commands (`commandRun`) run has no dedicated test.
- The full package suite was not run (the brief says narrow only).

## Open questions or contradictions found

1. **Flow validation (model/**, not mine).** I did not check whether a saved graph with a `builtin.control.call-subflow` node and `error.<id>` edges passes the model validator. That needs checking, together with authoring support (`run subflow` in the candidate script) and a `referenceType: "subflow"` UI option, which `nodes/contracts.ts` does not have, so `subflowId` uses a text control.
2. **The requirement gate does not include called graphs.** The C10 gate checks `[orchestration, selected]` only, not graphs a Call Subflow reaches. A called graph's `metadata.requires` is not checked.
3. **The Call Flow container can still be re-run.** The graph-level retry floor still applies to Call Flow containers (unchanged behaviour), so up to four container attempts are possible when the failure is absorbable. Only Call Subflow is exempt, per the brief. Decide whether Call Flow should follow C1's rule.
4. **No cursor updates.** The frame `cursor` is set at creation (start node, `before_attempt`) and never updated. I assume C3 wiring (unit B or R2) owns that.
5. **Subflow-index bookkeeping lists only the Router's choice.** `routedRunDetail.subflows` still lists only the selected Subflow; called Subflows appear only in `flowVersions` and the trace.
6. **Options other than inputs still cross the boundary.** `options.variables` (the seed) and `approvedRuntimePatchNodeIds` still pass to children through the inherited options, exactly as they did for Call Flow before.
7. **contracts.ts.** No field was missing; `subflowTarget`, `framePath`, `invocation` and `subflowGraphs` were sufficient.
