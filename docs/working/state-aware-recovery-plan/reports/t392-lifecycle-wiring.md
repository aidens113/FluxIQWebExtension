# t392 C2: lifecycle dispatcher wired into graph-run

Worker report for task t392, unit C2 (state-aware recovery plan C3, C5, C6 steps 1-7, C7).
Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ`, branch `task/t392-executor-integration`. Nothing is committed.
AS = `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

**Done.** All five events fire at the seams the C0 report named. Their outcomes are applied, attempts are stamped, incidents open, close and carry across Call Subflow, `flow.handlers@1` is granted, and the three packed lines are fixed.

A Flow with no Handler nodes runs and is traced exactly as before. A test asserts this: zero fact calls, the same trace with and without a fact host and recovery source, and none of the new keys in the trace.

Checks:
- Typecheck: clean in my files. The one remaining error is in F1's `client-gateway/service/tests/action-result-reading.test.ts`.
- Structure audit: passes.
- Brief suites: all 184 test files pass.

## What changed and why

### Wiring (`AS/runtime/executor/step-loop/`, new files unless marked)

**Dispatch and its outcome**
- `lifecycle-dispatch.ts` contains `automationStudioStepLifecycle(ctx, boundary)`, the one place the step loop calls the dispatcher.
- It moves the frame cursor first, and never overwrites a `handler` phase.
- **Fast path.** After the run's first dispatch (which loads the recovery Subflow once), a run with no Handler in scope returns `pass` without calling the dispatcher. The check is `lifecycle-run/has-handlers.ts`.
- **Mapping:**
  - `none`, `authored` and `unhandled` map to `pass`.
  - `resume` maps to `resume`, and `resolve` to `resolve(outputs)`.
  - `stop` ends the run:
    - `cancel` ends it `cancelled` ("Run cancelled.").
    - `outcome_uncertain` ends it failed with "Outcome uncertain: <reason>".
    - Any other stop ends it failed with its reason.
- **`route`:**
  - To a checkpoint in this frame: the run moves to `routeTarget.nodeId`, the route is pushed onto `incident.routes`, and the partial-run stop rule is asked first.
  - To any other frame: treated as `unhandled`. The handler's `execution.disposition` and `lifecycle.disposition` are rewritten to `unhandled`, and a plain sentence goes on `run.lifecycle.problems`, which the root trace carries as `lifecycleNotes`.
- **Each handler run:** its `bodySteps` are subtracted from `ctx.maxSteps`, and its body's saved attempts are kept for the trace.

**Where each event fires**
- `start`, in `graph-run.ts:333-340`:
  - The frame's graph is registered first, at line 332.
  - Fires once per frame, only when there is no seed and no `options.startNodeId`, so never on a resume, a partial run or a handler body.
  - It fires at the default start node.
- `before`, in `arrival.ts`:
  - After the pace hold and before the readiness gate, on every attempt.
  - A route returns a new `next` outcome, which graph-run applies.
- `retry`, in `on-retry.ts`:
  - **Ladder-permitted retry** (`failed-attempt.ts`): fires inside the retry branch, before the wait.
  - **Could-not-run step** (`could-not-run-retry.ts`): fires before safe state routing. It is skipped when the Flow declares a way past the optional step (`automationStudioAbsentStepSkip`) or the arrival has no attempt left.
  - **When a handler clears the way:**
    - For a dispatched attempt (`state-route.ts`), the step is retried at once: rung `retry_node`, 0 ms backoff. The seam's new `retry` outcome is applied by graph-run.
    - For a readiness gate that did not hold (graph-run lines 380-388), the node is dispatched now instead of routed.
- `fail`, in `on-fail.ts`:
  - Called from `failed-attempt.ts` after the `satisfied` branch, before the failed edge or continuation.
  - Skipped when `fault.actUncertain`, because no rung below an uncertain act runs (C6 step 4).
  - `resolve` writes the outputs into `values` (both `node.key` and `key`) and onto the attempt's `outputs`, then returns `proceed` along `success`.
  - `requiredOutputIds` mirrors the validator's node-scope rule: data edges from the node, plus `metadata.requiredOutputs`.
- `before_next`, in `before-next.ts`:
  - Called from `graph-run.ts:451-459`.
  - Fires only when there is no route override, the route is `success`, the attempt `succeeded`, and it was not `skipped`.

**Route guard** (`lifecycle-route-guard.ts`)
- **`passesUncertainAct`:** any node on `automationStudioStateRouteSpan(from, checkpoint)`, the failing node included, whose latest attempt failed with `fault.actUncertain`.
- **`repeatsCompletedReconcile`:** taken from `automationStudioRepeatedLastingAct` (no observation). Its effect check is `landed` or `unknown`, never `not_landed`, so a repeat is always refused.
- **Other frames:** returns neutral, because routing out is D2's.

**Incidents** (`lifecycle-incident.ts`)
- **Opening:** at the first permitted retry, or at On Fail when no retry opened one. Keyed to `ctx.arrival.ordinal`, a new per-frame arrival count kept in `lifecycle-frame.ts`.
- **Closing:**
  - On a fresh arrival at another node (`arrival.ts`).
  - When the frame's run ends (`graph-run.ts:177`).
- **Carrying:** a Call Subflow child that ends `failed` first records `carried[parentInvocationId/callNodeId] = incidentId`. The parent's failure at that node opens with `carriedIncidentId`.
- **Handler frames** never close their parent's incident. This fixed a bug the tests exposed: each body run closed the incident, so every retry opened a new one and re-ran the handler.

**Stamps** (`lifecycle-stamps.ts`)
- **`failureClass`**, set through C1's `markAutomationStudioIncidentFailure`:
  - `retry`: a ladder retry (`movedBy` `retry`, or `on_retry` when a handler resumed).
  - `skip`: a satisfied state, or a continuation past a non-fatal failure (`movedBy` `optional_way_on`).
  - `state_route` or `skip`: a state route, or a declared way-on.
  - `planned_fail`: a failed edge (the End with `resultStatus: failed` is passed as `deliberateStop`), or a handler `route` or `resolve`.
  - `true_failure` or `uncertain`: the recovery stop. Only a true failure marks the incident.
- **Gating.** Incident marking happens in every run. The trace field is stamped only when the run has a Handler in scope (see Open questions 1).
- **`lifecycle`**, the record of the last handler that ran:
  - On the attempt at the boundary for `retry`, `fail` and `before_next`.
  - On the next attempt for `start` and `before`, through `ctx.lifecycle.pending`.

**Trace** (`lifecycle-trace.ts`)
- Each body's saved attempts are spliced into the frame's saved trace at the point where the body ran. They already carry their handler-frame `framePath`.
- The saved trace only. The executed trace that `onExecutedTrace` receives is unchanged.
- On the root frame only (no `parentInvocationId`), it adds `handlerExecutions`, the run-wide list from `run.lifecycle.executions`, and `lifecycleNotes`.
- Body attempt ids number after the run's own (new `priorAttemptCount` on the dispatch input, passed to the body), so every attempt id stays unique.

**Context** (`loop-context.ts`, `lifecycle-frame.ts`): `ctx.lifecycle`, `ctx.step`, and `arrival.ordinal`.

### `lifecycle-run/` (mine)
- `run-state.ts`: new `executions` (every `handler_execution` record of the run) and `carried`.
- `dispatch.ts`:
  - pushes each record onto `executions`;
  - passes `priorAttemptCount` through to the body;
  - adds `selection` to the attempt `lifecycle` record.
- `dispatch-contracts.ts` and `handler-body.ts`: `priorAttemptCount`.
- New `has-handlers.ts`.

### Contracts and projection
- `executor/contracts.ts`:
  - On `AutomationStudioGraphExecutionTrace`: `handlerExecutions?` and `lifecycleNotes?`.
  - On `AutomationStudioLifecycleTrace`: `selection?`. This carries the brief's "the trace's `selection` says why". The run detail does not project it: `recovery-trace.ts` rebuilds `lifecycle` from known fields.
- `service/summaries/conversions.ts`: `runtimeSessionToFlowRunDetail` projects `session.trace.handlerExecutions` into the detail's `handlerExecutions`, and leaves it absent when empty.

### Gate and packing
- `requirement-gate.ts` grants `flow.handlers@1`. Its test gained "grants situation handlers by default".
- The packed lines are split:
  - `failed-attempt.ts:90`;
  - `lifecycle-run/tests/dispatch.test.ts:196,198` (the IIFE and the arrow body).

### Tests (provider-free, fake page, fake host facts and dispatch)

**`lifecycle-run/tests/wiring.test.ts` (7 tests)**
1. On Before clears a popup before step 1 and again midway:
   - landed presses are `{dismiss: 2, s1: 1, s2: 1, s3: 1}`, and the press sequence shows no spoiled attempt;
   - body attempts sit in place with their own `framePath`, and attempt ids are unique.
2. On Retry before state routing (could-not-run): the retry fires at once, and state routing never runs.
3. On Retry after a ladder-permitted retry of a step that ran and failed.
4. A handler that cannot remove the popup:
   - each handler runs once, and later boundaries are refused;
   - 4 attempts, the first three `retry` and the last `true_failure`;
   - one incident, marked true failure;
   - the run ends failed with a message.
5. Node scope beats subflow (order -5) and automation scope (order -9). `lifecycle.selection` says why, and names the subflow and automation candidates.
6. A handler in a graph no frame runs never runs:
   - the Call Subflow child's retry handler, after the child ended;
   - another Subflow's handler.
7. On Fail `resolve` takes the success edge:
   - the outputs are on the attempt and in `values`;
   - the attempt is `planned_fail`;
   - s3 and done follow.

**`lifecycle-run/tests/wiring-boundaries.test.ts` (6 tests)**
1. No Handlers:
   - zero fact calls and one recovery load;
   - `toEqual` against the same run without a fact evaluator or Subflow source;
   - no `lifecycle`, `failureClass`, `handlerExecutions` or `lifecycleNotes` in the JSON.
2. Retries and planned fails:
   - classed `retry` and `planned_fail`;
   - no incident marked true failure, which is the only trigger for in-run repair;
   - no `llm_diagnosis` selected.
3. Call Subflow carry:
   - the child's automation On Fail handler runs once;
   - at the parent's Call Subflow node it is `refused` under the same incident id;
   - the incident is marked true failure, with origin `c1`.
4. Routes:
   - Same frame: the handler routes to the `cp.s3` checkpoint past s2, recorded on `incident.routes`.
   - Calling frame: the route is refused with a `lifecycleNotes` sentence and an `unhandled` disposition.
5. On Start fires once for a new frame and never on a `startNodeId` run.
6. A cancel during a handler body ends the run `cancelled`.

**Other**
- `lifecycle-run/tests/wiring-fixtures.ts`: test support.
- `service/summaries/tests/handler-executions.test.ts`: 2 tests.

## Commands run and observed results

All in the Core worktree.
- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo` (in `packages/fluxiq`): one error, in `src/client-gateway/service/tests/action-result-reading.test.ts` (F1's file, `exactOptionalPropertyTypes` on `failure`). Nothing in my files. Earlier runs also showed F1's `client-gateway/service/commands.ts` and `inbound.ts` errors, which F1 has since fixed.
- `npx vitest run` over `AS/runtime/executor`, `AS/runtime/tests/composite-executor.test.ts`, `AS/runtime/tests/router-runtime.test.ts`, `AS/runtime/tests/service-flows`, `AS/runtime/tests/authored-call-subflow`, `AS/runtime/tests/live-patch.test.ts` and `AS/runtime/service` (final run): `Test Files 184 passed (184)`, `Tests 1540 passed | 1 skipped (1541)`.
- An earlier run, before my tests existed, gave `70 passed` (executor) plus `110 passed` (the rest). The existing tests passed unchanged.
- `node scripts/structure-audit.mjs 2>&1 | tail -1` (Core root): `structure-audit: passed (308 warning(s), 1160 baselined).`
  - Warnings on my files:
    - `step-loop/` holds 19 source files (advisory 15);
    - `graph-run.ts` is 491 lines and `contracts.ts` 709 (advisory 400, cap 800);
    - C1's `lifecycle-fixtures.ts` has 11 exported values.
  - "3 baseline entries can be lowered": not mine, so I did not run `pnpm structure:baseline`.

## Not verified

- No live browser or Lab run. The Lab's ten realistic scenarios were not exercised.
- No full package suite, per the narrow-checks rule.
- **Parked runs.** A run that parks on a question and resumes keeps only the handler-body attempts of the part after the resume: the seed carries parent attempts only. The same goes for `handlerExecutions`, because the run holder is new on resume.
- **The canonical owner's `runSubflow`** (`composite-execution/owner.ts`) was not exercised for a body or a Call Subflow child. The tests use the bare graph runner.
- **Executed traces.** Handler-body attempts are added to the saved trace only. `onExecutedTrace` receives the run's own attempts.

## Open questions or contradictions found

1. **`failureClass` is gated on Handlers.** The brief requires both "stamp each attempt's `failureClass`" and "a Flow with no Handlers gives an identical trace", and existing tests `toEqual` whole attempts. I stamp the trace field only when a Handler is in scope. Incidents are opened and marked true failure in every run, so R4b's trigger works everywhere. If the chat and measures should count retries and planned fails for every Flow, drop the `automationStudioLifecycleHasHandlers` check in `step-loop/lifecycle-stamps.ts`, and accept trace changes in handler-less runs.
2. **Ancestor routes are partly charged.** The dispatcher has already charged a `route` budget unit and emitted a `succeeded` activity row before graph-run refuses the route. D2 should either take such routes, or have the dispatcher refuse them before charging. My route guard returns neutral for other frames, so it does not refuse them first.
3. **Refused records are noisy.** Every later boundary that meets an already-run occurrence emits a `refused` `handler_execution` record and activity row (C1's design). A failing step with a non-applying retry handler logs one refused row per attempt. The chat may want to hide refusals.
4. **Continuation is classed `skip`.** A failure the Flow walks past as non-fatal fits no class exactly; I chose `skip`. The other candidate was `planned_fail`.
5. **Retry dispatches can repeat on a could-not-run step.** Its On Retry may be dispatched twice in one attempt: before state routing, then after the ladder permits the retry. The second meets the same occurrence and is refused, but it costs one more fact batch when a handler's `when` holds.
6. **Docs not updated.** `docs/architecture/automation-studio.md` (the step loop's lifecycle boundaries) and the trace-contract docs were outside my files. `handlerExecutions`, `lifecycleNotes` and `lifecycle.selection` need documenting.

## Where D2 adds entry selection and the ancestor route

- **Entry selection:**
  - **Where:** `AS/runtime/executor/graph-run.ts`, in `executeAutomationStudioGraph`, directly after the On Start block (lines 335-340, marked "Unit D2 adds entry selection here"). Use the same guard, `!seed && !options.startNodeId`, and skip it when On Start already routed.
  - **What to set:**
    - assign `currentNode` to the chosen entry;
    - set `invocation.frame.entry`;
    - stamp `entry` on the first attempt, as `lifecycle.pending` is stamped at lines 410-413.
  - `ctx.arrival` and `lifecycle.arrivals` start at the default node, and the arrival seam resets both for a different node, so nothing else needs to change.
- **Ancestor route:**
  - **Where it is refused now:** `AS/runtime/executor/step-loop/lifecycle-dispatch.ts`, in `applyOutcome`, the branch `if (!target || target.invocationId !== invocation.frame.invocationId)` at line 135.
  - **What D2 needs:**
    - a new outcome kind that unwinds the child frame's graph run (a trace status, or a marker the Call Subflow attempt carries up);
    - the ancestor's step loop then moves to `target.nodeId`.
  - **Also:** the route guard (`step-loop/lifecycle-route-guard.ts:26`) must judge the ancestor's path, which today it returns neutral for.
