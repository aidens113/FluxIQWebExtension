# t392 C1: host fact evaluation and the lifecycle dispatcher runtime

Worker report for task t392, unit C1 (state-aware recovery plan C3, C4 resolution, C5, C7, C9).
Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ`, branch `task/t392-executor-integration`. Nothing is committed.
AS = `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

**Done.** All seven items are built and tested. Nothing is wired into graph-run (that is C2). The Core typecheck is clean, the structure audit passes, and 418 tests in 43 files pass across `lifecycle-run`, `lifecycle`, `frames`, `executor/tests` and the new host test. The domain's real `WebAutomationHostRuntime` was typechecked against Core's boundary, and it is assignable.

## What changed and why

### 1. Host interface (`AS/runtime/host-runtime.ts`)
- Added the capability `"fact-evaluation"`.
- Added `AutomationStudioFactEvaluationContext`: `{ inputs?, values?, signal?, nodeId?, attemptId? }`.
- Added `AutomationStudioHostFactResult`: `{ result: "true"|"false"|"unknown"; evidence?: unknown; evidenceRef?: string | undefined; capturedAt: number }`.
- Added the boundary method:
  ```ts
  factEvaluator?(conditions: readonly AutomationStudioFactCondition[], context: AutomationStudioFactEvaluationContext):
    readonly AutomationStudioHostFactResult[] | Promise<readonly AutomationStudioHostFactResult[]>;
  ```
- The host result field is `result`, not `truth`, so the domain's `WebAutomationFactResult` fits unchanged. `evidence` is `unknown` because Core never reads it; it only digests it.
- Type-level test: `AS/runtime/tests/host-runtime/tests/fact-evaluation.test.ts`. It restates the domain's declarations and checks them with `expectTypeOf`. The check is strict (a plain function type, not a bivariant method), and it includes a negative case. A runtime case then sends a domain-shaped evaluator through an observation.

### 2. Observation (`lifecycle-run/fact-observation.ts`, `host-fact-result.ts`)
- **`observeAutomationStudioFacts({ hostRuntime, groups, context, now })`:**
  - Makes at most one host call per observation for every group, and makes no call when nothing is to be sent.
  - Each group gets its results back by key.
  - Returns `calls: 0 | 1` and an optional `problem`.
- **Never sent, answered `unknown`.** Each gets a `core:` evidence reference that says why:
  - `core:malformed`: the condition does not parse with t385's parser.
  - `core:unresolved_handle`: a `handle` key appears anywhere in `target`.
- **Every sent condition answered `unknown`** in these cases:
  - `core:no_fact_evaluation`: no host, or no method.
  - `core:host_failed`: the host threw. The error text goes in `problem`.
  - `core:host_batch_length`: the host returned the wrong number of results.
  - `core:cancelled`: the signal was aborted.
- **Context.** `{ input }` and `{ value }` reach the host through `context.inputs` (the frame's inputs) and `context.values` (the run values).
- **Mapping one answer** (`automationStudioHostFactConditionResult`):
  - A `result` outside the three truths becomes `unknown` with `core:unreadable_answer`.
  - A non-finite `capturedAt` is replaced by `now`.
  - The host's `evidenceRef` is kept only when it is a short plain token (`/^[A-Za-z0-9._:/#-]{1,120}$/`).
  - Otherwise the reference is `evidence:<16-hex digest>` of the evidence, with sorted keys and bounded depth. Page text never reaches Core's records; the tests assert that.

### 3. Registry and run state (`run-state.ts`, `registry.ts`, `frames/invocation-options.ts`, `frames/run-holder.ts`)
- **The holder.** `AutomationStudioRunFrames` gained a required `lifecycle: AutomationStudioLifecycleRunState`. It is created in `automationStudioRunFrames()`, so there is one per run, shared by reference with every child, Call Flow and handler frame, and never replaced.
- **The state holds:**
  - `graphs`: the registry cache, keyed by graph Flow id. It is read again only when the document object changes, as with an in-run overlay.
  - `recovery`: `{ loaded, graph? }`.
  - `budget?`: fixed at the first dispatch from `options.recoveryBudget`.
  - `ledger`, `incidents`, `openByArrival`, `problems`, and `nextId("incident" | "handler-execution")`.
- **`automationStudioRegisterLifecycleGraph(state, { subflowId, graph, graphRevision, artifact? })`** reads a graph once per run with t385's `automationStudioGraphHandlerRegistrations`.
- **`automationStudioActiveLifecycleRegistrations(run, subflowGraphs)`** offers only the graphs of frames on the stack, plus the recovery graph. The recovery graph is loaded with `subflowGraphs.recovery()` at most once per run. A load failure goes to `problems` and offers nothing. A cached graph whose frame has ended is not offered.

### 4. The dispatcher (`dispatch.ts`, `dispatch-contracts.ts`, `handler-body.ts`, `route-target.ts`, `dispatch-records.ts`)

Exact signature (exported from `AS/runtime/executor/lifecycle-run/index.ts`):

```ts
export async function dispatchAutomationStudioLifecycleEvent(
  input: AutomationStudioLifecycleDispatchInput
): Promise<AutomationStudioLifecycleDispatchOutcome>;

export type AutomationStudioLifecycleDispatchInput = {
  event: AutomationStudioLifecycleEvent;          // "start" | "before" | "retry" | "fail" | "before_next"
  nodeId: string;
  graph: AutomationStudioLifecycleGraph;          // { subflowId: string | null; graph: AutomationStudioFlowDocument; graphRevision: number | null; artifact?: AutomationStudioFlowArtifact }
  options: AutomationStudioGraphExecutionOptions; // must carry `invocation`; uses hostRuntime, subflowGraphs, recoveryBudget, signal, now
  arrival: number;                                // which arrival at nodeId in this frame (1-based)
  attemptNumber: number;
  values: Readonly<Record<string, JsonValue>>;    // run values; handed to the body as its inputs
  attemptId?: string;
  outputsSoFar?: JsonObject;
  lastingActStatus?: AutomationStudioLastingActStatus;  // default "none"
  incidentId?: string;                            // at retry / fail
  requiredOutputIds?: readonly string[];          // what a resolve must cover
  remainingSteps?: number;                        // body run's maxSteps
  coreStop?: AutomationStudioCoreStop;
  routeGuard?: AutomationStudioLifecycleRouteGuard;     // without one, a route is never taken
};

export type AutomationStudioLifecycleRouteGuard = (target: AutomationStudioLifecycleRouteTarget) => {
  passesUncertainAct: boolean; repeatsCompletedReconcile: boolean; effectCheck?: "landed" | "not_landed" | "unknown";
};
export type AutomationStudioLifecycleRouteTarget = { checkpointId: string; invocationId: string; graphFlowId: string; nodeId: string };

export type AutomationStudioLifecycleDispatchOutcome =
  | { kind: "none"; observations: number; runs: AutomationStudioLifecycleHandlerRun[] }
  | { kind: "authored"; source: Exclude<AutomationStudioHandlerSource, { kind: "handler_node" }>;
      registration: AutomationStudioHandlerRegistration; level: AutomationStudioHandlerLevel;
      observations: number; runs: AutomationStudioLifecycleHandlerRun[] }
  | { kind: "handled"; decision: AutomationStudioDispositionDecision; routeTarget?: AutomationStudioLifecycleRouteTarget;
      observations: number; runs: AutomationStudioLifecycleHandlerRun[] };

export type AutomationStudioLifecycleHandlerRun = {
  handlerId: string;
  level: AutomationStudioHandlerLevel;            // "node" | "subflow" | "ancestor" | "automation"
  selection: string;                              // plain words: why this one (level rule, earlier candidates' truths, not-reached ones)
  occurrence: string;                             // t385 occurrence key
  decision: AutomationStudioDispositionDecision;  // resume | route | resolve | unhandled(reason) | stop
  lifecycle?: AutomationStudioLifecycleTrace;     // the attempt's `lifecycle`; absent on a refusal
  execution: AutomationStudioFlowRunHandlerExecutionRecord; // the `handler_execution` record
  recovery: ClientGatewayActivityRecovery;        // the activity row's detail, already emitted
  bodyTrace?: AutomationStudioGraphExecutionTrace;// saved trace of the body
  bodySteps: number;                              // count against maxSteps
  readyState?: AutomationStudioFactTruth;         // re-observed, when readyState is written as fact conditions
  routeTarget?: AutomationStudioLifecycleRouteTarget;
};
```

**Behaviour**
- **No dispatch.** No invocation, or a frame on the stack in phase `handler` (no nesting): `none`, 0 observations.
- **Candidates.** The dispatcher registers `input.graph`, gathers the active registrations, and calls t385's `resolveAutomationStudioHandlerCandidates`. With no `handler_node` candidate it returns `none` with no fact call and spends nothing. This also holds when authored paths exist, so a Flow without Handlers behaves exactly as before.
- **Walk.** It walks the candidates in order:
  - An authored candidate (`failed_edge`, `optional_way_on`, `clears_interference`) reached first returns `authored`. Its `runs` hold any handler that ended `unhandled` before it.
  - Otherwise every `handler_node` candidate before the next authored one is observed in one batch, and the first whose `when` holds `"true"` is taken. `unknown` never passes.
- **Charging.** The chosen handler is charged with `chargeAutomationStudioLifecycleBudget` (`handler_run`, its occurrence key, `maxRuns`). It is refused in these cases, each giving a `refused` record and row, after which the walk goes on:
  - the budget or occurrence charge is refused;
  - the handler has no body;
  - at `fail`, the handler already ran for this incident.
- **Body run (`runAutomationStudioHandlerBody`).**
  - A new frame: `cursor.phase: "handler"`, parent = the current frame, `incidentId` carried.
  - It runs through the holder's frame runner `run.runSubflow`, with `startNodeId` set to the `body` port's target.
  - The handler frame gets the parent options minus `startNodeId`, `stopAfterNodeId` and `maxSteps`; its inputs are `values`, and `maxSteps` is `remainingSteps` when given.
  - The disposition is read off the last succeeded Handler End attempt's outputs (`disposition`, `checkpointId`, `outputs`).
  - These count as a failed body: a body status other than `succeeded`, a run with no runner, or no Handler End reached. A `cancelled` body becomes Core stop `cancel`.
- **Re-observation.** After a body that did not fail, one observation covers the completion check, the node's `readyState` (only when it is written as fact conditions), and the route checkpoint's `when` (`automationStudioLifecycleRouteTarget` searches the current frame, then its ancestors).
- **Decision.** `decideAutomationStudioDisposition` decides. A decided `route` then also needs:
  - the `routeGuard` (otherwise `unhandled`, "could not check what the route would pass");
  - a `route` budget charge.
- **Records.** `automationStudioLifecycleRunRecords` builds the `lifecycle` record (the trace disposition reads `unhandled` for a stop), the `handler_execution` record (`outcome` is about the body), and the `recovery` row (`kind: "handler"`; subject = the Handler node's `label` or "A recovery step"). It emits the row with B's `emitAutomationStudioActivityStepRecovery`.
- **Continue or stop.** `unhandled` goes on to the next candidate after re-observing. At `before`, `resume` also goes on, so On Before handlers run one at a time, each at most once per dispatch. Any other decision ends the dispatch with `handled`. At the end of the walk:
  - with no runs, the result is `none`;
  - otherwise it is `handled`, with `resume` at `before` when any handler resumed, else the last decision.

### 5. Incident ledger (C7) (`incident-open.ts`, `incident-true-failure.ts`)
- **`openAutomationStudioRecoveryIncident(run, { invocationId, nodeId, arrival, failureCode, at, carriedIncidentId? })`** returns the incident open at that arrival (key `invocationId/nodeId#arrival`), or opens `incident-N`. A child's incident is carried by passing `carriedIncidentId`. It sets the frame's `incidentId`.
- **`closeAutomationStudioRecoveryIncident(run, incidentId)`** unmaps the incident and clears the frame's `incidentId`. The record stays.
- **`markAutomationStudioIncidentFailure(run, incidentId, facts)`** runs t385's classifier. It sets `incident.trueFailure = true` on `true_failure` and returns `{ verdict, failureClass? }`.
- **`automationStudioAttemptFailureClass(facts)`** gives graph-run the attempt's `failureClass` through B's mapper (`automationStudioTraceFailureClass`).

### 6. `graph-navigation.ts`
- **`automationStudioNodeEndsRun(definitionId)`** is true for End and Handler End.
- **`hasUnvisitedAutomationStudioNodes`** no longer counts:
  - Handler nodes;
  - nodes reached only through a Handler's `body` (nodes the main path also reaches still count);
  - anything in a run whose last attempt is a Handler End (a body run).

  So a Flow that holds Handlers succeeds exactly as before, and a body run started at its body node succeeds at its Handler End. This works without any graph-run change.

### 7. `start-node.ts`
A Handler node is never a root. Its body nodes are entered by the `body` edge, so they never were roots either. A graph whose only extra parentless nodes are Handlers chooses the Start it always did.

### Tests added
- `lifecycle-run/tests/dispatch.test.ts` (12 tests). Covers:
  - no handler candidates means zero fact calls, for every event;
  - one batched call per boundary;
  - `unknown` is never true;
  - node scope beats subflow scope, and `selection` says why;
  - a handler in a graph no frame runs never runs;
  - resume, route (with and without a guard), resolve and unhandled are each decided;
  - a failed completion check becomes `unhandled`;
  - the same occurrence is refused, and a later arrival runs;
  - the budget is shared across parent and child frames;
  - an authored path is returned after a non-applicable handler;
  - On Before handlers run one at a time with re-observation;
  - the recovery Subflow is loaded once per run.

  These tests run the real graph run for bodies.
- `lifecycle-run/tests/fact-observation.test.ts` (5) and `incident.test.ts` (2).
- `frames/tests/run-holder.test.ts` (1).
- `executor/tests/graph-navigation/tests/handlers.test.ts` (5).
- 3 Handler cases added to `executor/tests/start-node.test.ts`.
- `runtime/tests/host-runtime/tests/fact-evaluation.test.ts` (1, type-level plus runtime).
- The two new files sit in `tests/<feature>/tests/` because `executor/tests/` and `runtime/tests/` are at the audit's 25-file limit. This follows the existing `runtime/tests/earlier-output/tests/` pattern.

## Commands run and observed results

- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo` in `packages/fluxiq` printed nothing and exited 0.
  - An earlier run showed 3 errors in `runtime/tests/authored-call-subflow.test.ts` (another worker's file: `AutomationStudioFlowArtifact` passed as a `AutomationStudioFlowDocument`). They were gone on later runs.
- `npx vitest run src/programs/automation-studio/runtime/executor/lifecycle-run src/programs/automation-studio/runtime/executor/lifecycle src/programs/automation-studio/runtime/executor/frames src/programs/automation-studio/runtime/executor/tests src/programs/automation-studio/runtime/tests/host-runtime` printed `Test Files 43 passed (43)`, `Tests 418 passed (418)`.
  - One earlier run had one transient failure in `frames/tests/call-subflow.test.ts` ("reads a declared output from where its binding points in the child, a node named by its key"). That file belongs to another worker, who was editing it. It passed alone, then in the full rerun.
- `node scripts/structure-audit.mjs 2>&1 | tail -1` at the Core root printed `structure-audit: passed (304 warning(s), 708 baselined).`
  - My only warning: `lifecycle-run/tests/lifecycle-fixtures.ts` has 11 exported values, past the 8-value advisory.
- **Domain assignability, against the real downstream types.** I used a scratch tsconfig in my scratchpad (not in either repository) that maps `fluxiq` to Core source and typechecks `assign.ts`. That file:
  - imports `WebAutomationHostRuntime` and `createWebAutomationHostRuntime` from `domain/src/runtime/host-runtime`;
  - assigns `(r: WebAutomationHostRuntime) => AutomationStudioHostRuntimeBoundary` and `createWebAutomationHostRuntime(...).factEvaluator` to `NonNullable<Boundary["factEvaluator"]>`;
  - asserts the domain type is not `any`.

  `npx tsc -p <scratch>/tsconfig.json` exited 0. A negative control (an evaluator returning `{ truth, capturedAt }`) failed with TS2353, as it should.

## Not verified

- Nothing is wired into graph-run (C2), so no live dispatch at a real `retry`, `fail` or `before` boundary and no browser run. The body run itself was exercised through the real graph run with the bare frame runner. The canonical owner's `runSubflow` was not exercised for a body. It does pass `startNodeId` and `invocation` through (read in `composite-execution/owner.ts`), but it recompiles regions from the target graph.
- `pnpm --filter @fluxiq-web-extension/domain check` was not run, because it needs a Core dist build. The scratch check above typechecked the domain's host-runtime module graph against Core source instead.
- No full suites were run, per the narrow-checks rule.
- Alternatives (`alternative` budget charge) are not charged by the dispatcher: it cannot tell an On Fail body that calls an alternative Subflow from any other. `incident.routes` and `incident.alternatives` are not filled. Only `handlersRun` is.

## Open questions or contradictions found

1. **For C2, graph-run wiring:**
   - Register each frame's graph at frame start with `automationStudioRegisterLifecycleGraph(options.invocation.run.lifecycle, {...})`. Without this, an ancestor's inherited handlers are unknown until that ancestor itself dispatched. The dispatcher only registers the current frame's graph.
   - **Never overwrite `cursor.phase` on a frame whose phase is `"handler"`.** The no-nesting guard reads it.
   - Subtract `bodySteps` from the remaining steps.
   - Supply `routeGuard`, or routes are always refused.
   - On `authored`, run today's ladder code.
   - Open an incident at the first permitted retry and close it when the run passes the node.
   - Pass `carriedIncidentId` at the Call Subflow boundary.
   - `automationStudioNodeEndsRun` is available to replace graph-run's `=== "builtin.control.end"`. It is optional, because `hasUnvisitedAutomationStudioNodes` already ends a body run at its Handler End.
2. **The recovery Subflow is loaded on the first dispatch of every run.** That is one `subflowGraphs.recovery()` read per run, cached, before the candidate check. A Flow with no Handlers therefore still pays one store read, never a fact call. Avoiding it would need a cheaper way to know whether a recovery graph exists.
3. **Ledger keys for events with no incident.** At `start`, `before` and `before_next`, handler runs are charged in the ledger under the pseudo incident `arrival:<invocationId>/<nodeId>#<arrival>`. The per-incident cap (3) is per arrival there. The `handler_execution` record still has no `incidentId`.
4. **A cross-frame exclusion I added.** At `fail`, a handler whose id is already in the incident's `handlersRun` is refused ("already tried for this incident"). That is how C6 step 7 ("handlers already tried for that incident are not re-run at the parent") is applied, because occurrence keys include the node arrival and would otherwise differ at the parent.
5. **Changes I would ask of `lifecycle/` (not edited):**
   - `lifecycle/incident.ts` keeps its FNV digest private, so `host-fact-result.ts` repeats it. Exporting one digest would remove the copy.
   - `AutomationStudioSubflowGraph.subflowId` (frames) is `string`. A body in a root graph with no Subflow passes the graph Flow id there, which the runners do not read.
6. The required `lifecycle` field on `AutomationStudioRunFrames` means any hand-built holder literal must now use `automationStudioRunFrames()`. tsc found none.
