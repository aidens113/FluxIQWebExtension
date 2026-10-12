# t392 D2: alternative entries, checkpoint routes across frames, the success check, and incident counts

Worker report for task t392, unit D2 (state-aware recovery plan C2, C5, C6 steps 6-7, C7).
Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ`, branch `task/t392-executor-integration`. Nothing is committed.
AS = `packages/fluxiq/src/programs/automation-studio/`. Paths below are under `AS/runtime/executor/` unless marked.

## Outcome

**Done.** All seven brief items are built, and every requested proof has a provider-free test.

Checks:
- Typecheck: clean (exit 0, no output).
- Structure audit: passes.
- Narrow suites: 107 files, 844 tests pass.
- `AS/runtime/service` and `live-patch`: pass as well.

**One existing test was changed.** The second half of C2's `lifecycle-run/tests/wiring-boundaries.test.ts` "routes ... calling frame" test asserted that an ancestor route is refused, which is exactly what this brief replaces. It now asserts that the route is taken. No other existing test changed.

## What changed and why

### 1. Entry selection (`step-loop/entry.ts`, new; `graph-run.ts`)

**When it runs.** `automationStudioStepEntry(ctx, defaultNode)` runs directly after On Start, under the same guard: `!seed && !options.startNodeId`. It is skipped when On Start routed. A handler body always has a `startNodeId`, so it never selects an entry.

**How it chooses.**
- It reads the entries with `automationStudioSubflowContract` and decides with t385's `selectAutomationStudioEntry`.
- Every entry's `when` goes into one `observeAutomationStudioFacts` call. A graph with no entries returns before any observation, so it makes zero calls and records nothing.
- `requires` is bound from the frame's inputs (`invocation.frame.inputs`). A `null` input counts as unbound.
- An entry whose declaration has a parse problem is never taken, so a condition the parser dropped cannot loosen it.

**What it sets for a chosen entry.**
- `frame.entry = { kind: "entry", id }`, and the frame cursor.
- `ctx.arrival` and `lifecycle.arrivals` move to the entry, so its first arrival is there.
- It emits an activity `recovery` row: `{ kind: "entry", subject: <node label>, outcome: "succeeded", targetId: <entry id> }`.

**The first attempt's `entry` stamp.** The stamp is kept on the new `lifecycle.entry` (`step-loop/lifecycle-frame.ts`) and stamped in graph-run the same way `lifecycle.pending` is.
- For a chosen entry: `{ kind, id, evidence }`.
- For the default, in a graph that declares entries: `{ kind: "default", evidence: [] }`.
- A graph with no entries gets no stamp.

**The chosen node** goes through the ordinary loop, so it passes its readiness gate and On Before. A test asserts On Before ran at an entry node.

### 2. Route refusals before any charge (`lifecycle-run/dispatch.ts`, `dispatch-contracts.ts`; `step-loop/lifecycle-dispatch.ts`)

- **`when` and `requires`.** These were already decided by `decideAutomationStudioDisposition` before `routeAllowed` charged anything.
- **What C2 found.** The charge-then-refuse problem came from graph-run refusing a route after the dispatcher had decided it: for an ancestor frame, or a node the graph lacks.
- **The fix.** The route guard now returns `unreachable?: string`, and the dispatcher turns it into `found: false`. Every refusal therefore happens before the route budget is charged and before a `succeeded` row is emitted.
- **`applyOutcome`** keeps one defensive last check, which cannot trigger after the guard.
- Checkpoints remain the only Route targets: `route-target.ts` searches only declared `fluxiq.checkpoint`s.

### 3. Ancestor route

**Judging the path** (`step-loop/lifecycle-route-guard.ts`, rewritten)
- For a target in a calling frame, the guard finds where that frame is: the `callNodeId` of the frame just below it on the stack.
- It judges that frame's path from that node to the checkpoint:
  - an uncertain act on the span, with the failing node in this frame included;
  - a completed lasting act repeated, through `automationStudioRepeatedLastingAct`.
- It reads that frame through a new per-frame view on the run holder, `lifecycle.frames` (`lifecycle-run/run-state.ts`):
  - the view is `{ flow, attempts, values }`, held by reference;
  - it is registered in `automationStudioStepLifecycleRegister` and removed when the frame ends.
- All of this happens before anything unwinds.

**`requires` in the target frame.** `route-target.ts` takes `valuesOf(invocationId)`, so a checkpoint's `requires` are checked against the target frame's inputs and values, not the child's.

**Unwinding**
- **In the child** (`lifecycle-dispatch.ts` `applyOutcome`):
  - The route is pushed onto `incident.routes`.
  - The frame ends with `{ kind: "return", trace }`. The trace is `failed`, with the message "Handed back to checkpoint ..." and `checkpointRoute: { checkpointId, invocationId, graphFlowId, nodeId }`.
  - The `return` outcome now also carries the handler's `lifecycle` record.
  - `on-fail.ts` and `on-retry.ts` stamp the failed attempt `planned_fail`. `before-next.ts` stamps the record on a route-out as well.
- **At frame end** (`step-loop/lifecycle-incident.ts`): a frame that ended with `checkpointRoute` does not carry its incident to the parent, because the route settled it.
- **In each calling frame** (`step-loop/checkpoint-route.ts`, new; called in graph-run right after an attempt is pushed):
  - A Call Subflow attempt whose `childTrace.checkpointRoute` is set is stamped with the same `checkpointRoute`.
  - If the checkpoint is in this frame, the run moves there (the partial-run stop rule is asked first).
  - Otherwise this frame ends with the same marker. This runs before ask-or-park and the failed-attempt ladder, so no On Fail fires on the way up.

**Budget.** The route is charged once, in the child's dispatch. A test asserts `ledger.routesForRun === 1`.

**At the boundary**
- `composite-execution/boundary.ts` binds no declared error output for a hand-back.
- `frames/call-subflow.ts` words the message as "Subflow X handed the run back to checkpoint "Y"."

### 4. Success check (`step-loop/success-check.ts`, new; `graph-run.ts`)

`automationStudioStepFrameSucceeded(ctx, nodeId)` replaces graph-run's literal succeeded return at a frame's End. That covers the explicit End and the graph-complete case. The root is included.

**When the check is skipped**
- With no `fluxiq.successCheck` metadata, there is no call, and the trace is byte-identical to before.
- A handler body frame (phase `handler`) is never checked.

**What it answers**
- The check is one observation with the frame's inputs and values.
- `true`: the trace gains `successCheck: { truth, evidence }`.
- `false`: the trace is `failed`, with `failure: { category: "expected_state_missing", code: "executor.success_check.false", retryable: false, stage: "verification" }`.
- `unknown`: the same failure, with code `executor.success_check.unknown`.
- A declaration that does not parse is checked with an unsendable condition, so it reads `unknown` rather than being skipped.

**In a child.** `boundary.ts` copies the child trace's `failure` onto the Call Subflow result. The parent's attempt is then non-retryable, and its node's On Fail paths apply. A test asserts the child ran once and the failed edge was taken.

**Decision on the open question.** Absent means no check. The End node's `expectedState` is not used as a default (brief: decided no). A test asserts that an End with an `expectedState` and no `successCheck` makes zero fact calls.

### 5. Counts for every run

**The incident record**
- `lifecycle-run/run-state.ts` defines `AutomationStudioRunIncident`: the C7 record plus `ending?` and `retries?`.
- The type in `lifecycle/incident.ts` is not mine, so I did not edit it.
- `retries` is absent until the first retry, so C1's existing whole-record test passes unchanged.

**How an incident settles** (`lifecycle-run/incident-true-failure.ts`, `markAutomationStudioIncidentFailure`)
- A retry verdict adds one retry and clears any ending.
- Any other verdict, except `on_fail_pending`, sets the ending. The latest verdict stands. So a child's true failure that its Call Subflow node's failed edge then handles ends as `planned_fail`.
- `closeAutomationStudioRecoveryIncident(run, id, ending = "passed")` fills an unsettled ending: `passed` on arrival elsewhere, or at a successful frame end, and `ended` at any other frame end.

**On the trace.** `contracts.ts` adds `AutomationStudioIncidentEnding` and `AutomationStudioIncidentTraceRecord`. `step-loop/lifecycle-trace.ts` puts `incidents` on the root trace only, and only when there are any. A run that met no failure keeps an identical trace (a test checks its exact key set).

**In the summaries**
- `AS/runtime/service/summaries/failure-counts.ts` (new) provides `automationStudioRunFailureCounts`, which parses defensively.
- `conversions.ts` sets `failureCounts: { retries, plannedFails, trueFailures }` on every run summary and every run detail built from a session.
- `AS/model/flow-adaptation.ts` adds `AutomationStudioFlowRunFailureCounts` and the two optional fields. I left the lead's `"interrupted"` status alone.

**Whole-trace comparisons** did not break, so the records stay on the trace, as the brief preferred.

### 6. Noise (`lifecycle-run/dispatch.ts`, `dispatch-records.ts`)

A refusal because the handler already ran keeps its `handler_execution` record but emits no activity row (`quiet`). "Already ran" means either:
- its occurrence charge is at its cap; or
- the handler was already tried for this incident.

Other refusals (budget, no body) still emit a `refused` row.

### 7. Packing

The audit's `statement-packing` rule passes. I also folded the evidence mapper, which `dispatch-records.ts` had privately, into one exported `lifecycle-run/condition-evidence.ts` that three callers share.

### Tests (all provider-free, fake page and fake host)

**`lifecycle-run/tests/entries.test.ts` (4)**
- An alternative entry is chosen when its facts hold and `requires` are bound: one batched call of 2 conditions, the `entry` stamp, `frame.entry`, and the `entry` row.
- An unbound or `null` `requires`, and no holding entry, give the default.
- A later entry is chosen, and On Before still runs at it.
- A graph without entries makes zero fact calls, and so does a `startNodeId` run.

**`lifecycle-run/tests/checkpoint-routes.test.ts` (4)**
- A route to the checkpoint after the confirm act does not re-dispatch the confirm: `confirm` landed once, one route was charged, and the incident is `planned_fail`.
- A route back across the completed confirm act is refused, and so is a checkpoint whose `when` is `false`. Both refusals have 0 routes charged and a `failed` (not `succeeded`) row.
- An ancestor route unwinds the child and continues at the parent's checkpoint: the marker is on the Call Subflow attempt and the child trace, and one route is charged.
- The ancestor guard refuses a path back across a completed lasting act in the parent (0 charged). The parent's quiet refusal is on the trace with no row.

**`lifecycle-run/tests/success-check.test.ts` (4)**
- An On Fail handler whose body calls the `alt` Subflow and ends `resolve` with its output passes the root's check (`good`).
- The same handler with a `bad` output fails the root with `executor.success_check.false`.
- A child's `false` or `unknown` check becomes the Call Subflow node's non-retryable failure, and the parent's failed edge takes it.
- An absent check makes no call.

**`lifecycle-run/tests/incident-counts.test.ts` (2)**
- A run with no Handlers has incidents s1 `passed` with 1 retry, s2 `planned_fail`, and fallback `true_failure`, and no `failureClass` stamps.
- A clean run's trace is unchanged.

**`AS/runtime/service/summaries/tests/failure-counts.test.ts` (2)**
- The same real run yields `{ retries: 1, plannedFails: 1, trueFailures: 1 }` on both the summary and the detail.
- A clean run counts zeros, and malformed records count nothing.

**Shared support:** `lifecycle-run/tests/recovery-paths-fixtures.ts`.

## Commands run and observed results

All in the Core worktree.
- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo` (in `packages/fluxiq`): no output, exit 0. No other workers' errors were present at the time.
- **Baseline before my changes**, `npx vitest run` over the brief's set: `Test Files 99 passed (99)`, `Tests 806 passed (806)`.
- **First run after the changes:**
  - `Test Files 2 failed | 99 passed (101)`, `Tests 2 failed | 823 passed`.
  - The failures:
    - `wiring-boundaries` asserted the old ancestor refusal; I updated it.
    - `incident.test.ts`'s whole-record `toEqual` met the new `retries: 0`; I made `retries` optional, and that test is unchanged.
  - The count went from 99 to 101 files because another worker added files meanwhile.
- **Final run, the brief's set** (`AS/runtime/executor`, `tests/composite-executor.test.ts`, `tests/router-runtime.test.ts`, `tests/service-flows`, `tests/authored-call-subflow`, `service/summaries`): `Test Files 107 passed (107)`, `Tests 844 passed (844)`.
- **Extra:** `npx vitest run AS/runtime/service AS/runtime/tests/live-patch.test.ts`: `Test Files 98 passed (98)`, `Tests 820 passed | 1 skipped (821)`.
- **Extra:** `npx vitest run AS/runtime/tests` (all of it): `Test Files 1 failed | 111 passed (112)`, `Tests 1 failed | 645 passed (646)`.
  - The one failure is `tests/deepseek-bootstrap/tests/exploration.test.ts`, "saves a creation that looked more than sixteen times": `run.failure` is `{ totalProviderCallCount: 16, ... }`, a Flow-bootstrap exploration call limit.
  - It touches none of my code (no executor trace, entry, route, success check or summary).
  - Other workers have uncommitted `flow-bootstrap/` edits in this tree.
  - I did not investigate further or attribute it.
- `node scripts/structure-audit.mjs 2>&1 | tail -1` (Core root):
  - First: one `[imports]` violation, in my new fixtures (activity imported past its barrel). I fixed it.
  - Final: `structure-audit: passed (312 warning(s), 1160 baselined).`
  - Advisory warnings on my files:
    - `step-loop/` has 22 source files (advisory 15, cap 25);
    - `contracts.ts` is 753 lines (cap 800; I compressed the new doc comments to stay under);
    - `graph-run.ts` is 507 lines;
    - `recovery-paths-fixtures.ts` has 9 exported values.

## Not verified

- No live browser or Lab run, and no real web-host `factEvaluator`.
- **Paths not exercised:**
  - The canonical owner's runner (`composite-execution/owner.ts`) carrying a route-out from a Call Flow child. The marker path is generic (`childTrace.checkpointRoute`), but only the bare runner was tested.
  - Parked and resumed runs: the holder is new on resume, so incidents and counts cover only the part after the resume.
  - An ancestor route issued from On Before, On Start or Before Next. Only On Fail routes were tested. The code returns the same marker from every boundary.
- **Persistence.** `failureCounts` was not checked through persistence or listing: the typed run-summary store and any SQL projection.
- **Not counted:**
  - A root frame failed by its success check opens no incident, so it is not counted as a true failure, and no frame-scope On Fail is dispatched for the root.
  - The `failed-attempt.ts` defence ledger records an On Fail route-out as `stopped`. That file is F2's.
- Documentation (`docs/architecture/automation-studio.md`, trace contract) is not updated; it is outside my files.

## Open questions or contradictions found

1. **The changed test.** "Existing tests must pass unchanged" conflicts with item 3 for C2's assertion that ancestor routes are refused. I changed that one half-test (`wiring-boundaries.test.ts`, the second half of "routes to a checkpoint ...").
2. **The End node's `expectedState`** is deliberately not a default success check (the plan's open question; decided no, per the brief).
3. **A root success-check failure** is a frame failure with no incident. Should it mark a `true_failure` incident (and so reach in-run repair) or dispatch frame-scope On Fail? Neither was asked, and I did neither.
4. **Unattributed failure.** The Flow-bootstrap exploration test above fails in this tree. I did not attribute it; it needs an owner.
5. **Ancestor-route judgement.** A route's checkpoint `when` is observed with the child's context (`nodeId`, values), not the ancestor's. Only `requires` is checked against the target frame's inputs and values.
