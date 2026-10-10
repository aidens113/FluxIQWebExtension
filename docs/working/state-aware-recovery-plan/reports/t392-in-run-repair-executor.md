# t392 E2a: the executor holds a run in place on a true failure and asks for an in-run repair

Worker report for task t392, unit E2a (state-aware recovery plan C6 step 8, "What counts as a true failure", C7, C12 "in the run").
Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ`, branch `task/t392-executor-integration`. Nothing is committed.
AS = `packages/fluxiq/src/programs/automation-studio/`. Paths below are under `AS/runtime/executor/` unless marked.

## Outcome

**Done.** On a true failure with `options.repairIncident` supplied, the run holds in place and asks once. An overlay swaps the frame's graph (and, when given, a part's graph) and re-attempts the unit from the saved continuation. A failed trial drops the overlay and ends the run failed. `none` ends the run as before, with its reason recorded. F2's route-guard request is in.

Checks:
- Typecheck: one error, not mine (see below).
- Structure audit: passes.
- Brief suites: 99 files, 803 tests pass, my 9 new tests included.

## What changed and why

### Where the true failure is met

There is one site: `step-loop/failed-attempt.ts`, the "Nothing took the run on" branch (no failed edge, no continuation, On Fail passed).
- `automationStudioStepStampFailureClass` (`step-loop/lifecycle-stamps.ts`) now **returns the classifier's verdict**. The trace stamping is unchanged.
- When the verdict is `true_failure`, the branch calls the new seam `step-loop/incident-repair.ts` (`automationStudioStepRepairIncident`).
  - On `next`, the defence ledger records the fault `retried` and the loop moves to the node in the fixed graph.
  - Otherwise it records `stopped` and returns the same stop trace as before. A cancel during the call returns `cancelled`.
- The arrival's attempt count is captured before the seam resets it.

### The seam (`step-loop/incident-repair.ts`, new)

**Gate.** The seam returns at once, doing and recording nothing, when any of these is missing: the callback, the invocation, or the incident.

**A second true failure of the same incident**, read from `run.lifecycle.repairs`, never asks again:
- If the repair was `held`, the overlay is dropped:
  - the frame's original graph is swapped back, from `ctx.lifecycle.overlays`;
  - the part override is deleted;
  - the attempt gets `repair.outcome: "dropped"`.
- The run then ends failed with the incident.

**When the seam does not ask**, nothing is recorded:
- the signal has aborted;
- `runControl.heldBy()` is set (paused);
- any frame on the stack is in phase `handler` (inside a handler body);
- `fault.actUncertain`;
- the failure category is `external_side_effect_denied` or `blocked_by_capability_or_policy` (a permission gate);
- any attempt of the run is uncertain. This covers every executing frame's view plus `childTrace`s, recursively. An attempt counts as uncertain when its `effectCheck` is `unknown`, or, with no effect check, when it failed with `fault.actUncertain`.

**Which unit it names:**
- `handler`: the last handler that ran for the incident failed (its body failed, or its completion check was not `true`), and it is in this frame's graph.
- `part`: the node is a Call Subflow whose attempt has a `subflowTarget` and whose child trace failed carrying a frame `failure` (a success check or contract break).
- `node`: every other case.

**Asking**
- It emits the existing `repairing` thought, titled **"Fixing a step"**. The wire contract is unchanged.
- It calls the callback once. A throw is read as `none`.
- The request carries:
  - `incident`, `unit`;
  - `graph`: the current frame graph, earlier overlays included;
  - `subflowId`;
  - `framePath`: the stack up to this frame;
  - `failedAttempt`;
  - `attempts`: every executing frame's attempts, outermost first, this frame's last;
  - `signal`.

**`none`**: records `{ unit, outcome: "none", reason }` on the attempt and in `run.lifecycle.repairs`.

**`overlay`**
- If the overlay graph lacks the failing node id, it is recorded as `none` with a reason, and the run ends.
- Otherwise:
  - The original graph is saved per incident.
  - `ctx.flow` and `ctx.nodesById` are swapped, `frame.graphFlowId` is set, and `automationStudioStepLifecycleRegister` re-registers the frame. The registry re-reads a replaced document, and the frame view for routes is updated.
  - When `partGraph` is given, it is put on `run.subflowOverrides`.
  - For a `handler` unit, the handler's occurrence marks are cleared from the incident and the ledger (`lifecycle-run/handler-retrial.ts`), so the fixed handler can run once more. Spent counts stay charged.
  - The attempt gets `repair: { repairId, unit, outcome: "held", reason }`.
  - `incident.ending` is cleared, so the trial decides how the incident ends, as a retry's next attempt does. `trueFailure: true` stays.
  - `ctx.arrival` restarts at the same node with the **same arrival ordinal** (so the same incident), 0 attempts and no consumed rungs. `pendingRetry` is cleared and `defence.leaveNode()` gives a fresh wait allowance. Values, variables, loops, pace and the ledger are untouched.
  - The seam returns `next` to the node in the fixed graph.

### graph-run and context
- `step-loop/loop-context.ts`: `flow` and `nodesById` are no longer `readonly`. Only the repair seam reassigns them.
- `graph-run.ts`: the loop reads `ctx.flow` and `ctx.nodesById` for:
  - state routing;
  - node execution, including the region-timeout path;
  - edge choice;
  - the outgoing routes and End checks;
  - next-node lookup.
- `step-loop/lifecycle-frame.ts`: new `overlays: Map<incidentId, graph>`.

### Run holder and Call Subflow
- `frames/invocation-options.ts` and `run-holder.ts`: `AutomationStudioRunFrames.subflowOverrides: Map<subflowId, AutomationStudioFlowDocument>`, always present.
- `frames/call-subflow.ts`: when the source loads a Subflow that has an override, the child runs the override's graph.

### Lifecycle-run
- `run-state.ts`:
  - `handlerRuns: Map<incidentId, { handlerId, graphFlowId, handlerNodeId, failed }>`;
  - `repairs: Map<incidentId, AutomationStudioRunRepair>`.
- `dispatch.ts` `finish()`: records `handlerRuns` for every handler that ran with an incident.
- `handler-retrial.ts` (new): `automationStudioIncidentHandlerRetrial(run, incidentId, handlerId)`.
- `index.ts`: exports the above and `AutomationStudioRunRepair`.

### `incident-repair.ts`: what changed (E2b codes against it)
1. The `overlay` variant gained an optional **`reason?: string`**: plain words saying what the fix changed. The attempt's `repair.reason` carries it. If it is absent, the executor writes a generic sentence.
2. New exported type **`AutomationStudioRunRepair`** = `{ repairId?, unit, outcome: "held" | "dropped" | "none", reason, partSubflowId? }`, which the run keeps per incident.
3. Doc comments now state the executor's use of an overlay:
   - `graph` must still hold the failing node, by the same id;
   - `partGraph` applies to every call of that Subflow for the rest of the run;
   - one call per incident;
   - a throw reads as `none`.

The request, unit and callback shapes are unchanged.

### Trace (`contracts.ts`)
- New `AutomationStudioAttemptRepairTrace = { repairId?, unit, outcome: "held" | "dropped" | "none", reason }`.
- Attempt field `repair?`.
- Root-trace `repairs?: string[]`: the ids whose overlay was still held at the end. It is added by `step-loop/lifecycle-trace.ts` on the root frame only, and only when non-empty. It feeds the run session's save after the judged end.
- A run with no callback never writes either.

### F2's request (`step-loop/lifecycle-route-guard.ts`)
`lastEndedUncertain` also reads `attempt.effectCheck?.result === "unknown"`.

## Tests

New provider-free tests: `lifecycle-run/tests/in-run-repair.test.ts` (9 tests) and `in-run-repair-fixtures.ts`. They use a fake page and host, and a callback that records its requests.

1. **`replace_unit`, true failure at row 2 of a 3-row For Each:**
   - one call;
   - the request names the unit, the graph, the incident and the attempt;
   - presses `[s1, s2, s1, s2(fail), s2b, s1, s2b]` and landed `{s1:3, s2:1, s2b:2}`;
   - the path visits `each` between rows (row 2, then row 3);
   - the attempt `repair` is `held`, the root `repairs` is `["repair-1"]`, and the incident is `trueFailure`, ending `passed`;
   - exactly one "Fixing a step" row.
2. **`add_handler`:** a popup at row 2, and the fix adds an On Retry closer.
   - one call, status succeeded;
   - landed `{s1:3, s2:3, dismiss:1}` and presses `{s1:3, s2:8, dismiss:1}` (row 2's four spoiled attempts, plus the trial's spoiled first attempt, plus 3 landed);
   - the handler ran once (`resume`), and `repair.reason` is carried.
3. **A failing trial:**
   - one call, status failed;
   - presses `[s1, s2, s1, s2, s2]`;
   - attempt repairs `held`, then `dropped`;
   - no root `repairs`, the incident ends `true_failure`, and the run's `repairs` entry is `dropped`;
   - the registry holds the original document again.
4. **`none`:**
   - one call;
   - the attempt carries `{ unit, outcome: "none", reason }`;
   - with `repair` stripped, the trace `toEqual`s the same run with no callback;
   - the no-callback trace has no `repair` or `repairs` key.
5. **Zero calls for retries, a failed edge, an On Fail resolve and a state route.**
   - Retries and the failed edge: the `retryPlannedTrue` fixture asks only for `fallback`'s own true failure. Incident endings are `passed`, `planned_fail`, `true_failure`.
   - On Fail resolve: 0 calls.
   - State route: 0 calls, and r2 is `state_routed`.
6. **An uncertain act:**
   - In the frame: Outcome uncertain, 0 calls.
   - In a called part: the child stops uncertain, the parent's Call Subflow node then truly fails, and there are still 0 calls (the uncertainty guard).
7. **`part`:**
   - a child's success check is `false`, and the unit is `{ kind: "part", subflowId: "child" }`;
   - the `partGraph` without the check is run on the re-attempt: call attempts are `failed`, then `succeeded`;
   - `subflowOverrides` holds it;
   - c1 landed twice. Re-attempting a part re-runs its child.
8. **`handler`:**
   - an On Fail handler whose completion check stayed `unknown` names `{ kind: "handler", handlerNodeId: "h.fail" }`;
   - the fixed handler runs again as the trial: dispositions `unhandled`, then `resolve`;
   - the run succeeds through s3.
9. **A failing step inside a handler body** makes no call in the body frame. The node's true failure asks once, naming the handler.

## Commands run and observed results

All in the Core worktree.
- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo` (in `packages/fluxiq`):
  - **First run**, after the source changes: no output.
  - **Final run:** one error, **not mine**:
    `src/programs/automation-studio/runtime/conversations/commands/run-flow.ts(105,7): error TS2739: ... missing the following properties from type 'Record<AutomationStudioChangeProposalKind, string>': add_handler, replace_unit`.
    It comes from the new patch kinds in `model/**` (E2b's area), which a record in `conversations/commands/run-flow.ts` does not yet list.
- `npx vitest run .../lifecycle-run/tests/in-run-repair.test.ts`: `Tests 9 passed (9)`.
- `npx vitest run AS/runtime/executor/lifecycle-run`, after the `as never` fix: `Test Files 10 passed (10)`, `Tests 55 passed (55)`.
- `npx vitest run` over `AS/runtime/executor`, `AS/runtime/tests/composite-executor.test.ts`, `router-runtime.test.ts`, `service-flows`, `authored-call-subflow` and `live-patch.test.ts`. It ran twice; the final run gave `Test Files 99 passed (99)`, `Tests 803 passed (803)`. No existing test was changed.
- `node scripts/structure-audit.mjs 2>&1 | tail -1` (Core root):
  - **First run:** `2 violation(s)`, both `[as-never]` in my new test files. I fixed them with typed `AutomationStudioFailureRecord`s.
  - **Final run:** `structure-audit: passed (314 warning(s), 1160 baselined).`
  - Advisory warnings on my files:
    - `step-loop/` has 23 source files (cap 25);
    - `contracts.ts` is 771 lines (cap 800);
    - `graph-run.ts` is 508 lines;
    - `in-run-repair-fixtures.ts` has 10 exported values.

## Not verified

- **No live browser or Lab run**, and no real run session or model. E2b's callback was not exercised.
- **The canonical owner's `runSubflow`** (`composite-execution/owner.ts`) with a part override. Only the bare runner was tested, though the override is read in `call-subflow.ts`, which both runners use.
- **Parked or resumed runs.** The holder is new on resume, so repairs and overrides do not survive a park.
- **A held overlay in a Call Subflow child** whose trial then fails the child by its success check, with no true failure in the child. The parent's true failure under the same incident then marks it `dropped` and deletes any part override, but it has no frame graph to restore (the child frame is gone). This is reasoned from the code, not tested.
- No full package suite, per the narrow-checks rule.

## Open questions or contradictions found

1. **Handler units outside the frame's graph.** A handler registered in an ancestor frame's graph or in the recovery Subflow is not named as the unit. Overlaying another frame's graph from a child's hold is not built, so the unit falls back to `node`. To repair those, the request would need the handler's graph, and the overlay would need to replace a registry entry rather than the frame graph.
2. **A node fix in a child frame lasts only for that frame.** A `node` or `handler` overlay inside a Call Subflow child applies only to that child frame. A later call of the same Subflow in the run uses the original, unless E2b also returns `partGraph`. The brief said "for the rest of the frame", so I followed it literally.
3. **Incident counts after a held fix.** `incident.ending` is cleared when the overlay is applied, so a held repair's incident ends `passed` (the trial decides), and `failureCounts.trueFailures` does not count it. `trueFailure: true` and the attempt's `repair` record still show it. If the measures should count a repaired true failure as a true failure, set the ending back, or count `trueFailure` in `service/summaries/failure-counts.ts`, which is not mine.
4. **Permission categories.** I read `external_side_effect_denied` and `blocked_by_capability_or_policy` as the permission stop. The second also covers a client that rejects an action as unsupported, which a fix might address. Narrow it if E2b wants those repaired.
5. **Root success-check failures still open no incident**, so they never reach repair (D2's open question 3 stands).
6. **Docs** (`docs/architecture/automation-studio.md`, trace contract) are not updated; they are outside my files. Undocumented: `repair`, `repairs`, `subflowOverrides`, and the hold-in-place behaviour.
