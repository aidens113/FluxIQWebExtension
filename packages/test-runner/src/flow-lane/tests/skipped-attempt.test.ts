import assert from "node:assert/strict";
import test from "node:test";
import { flowLaneObservation, recordingLaneProbeObservation } from "../lane-observation.js";
import { recoveredByNode } from "../node-recovery.js";
import { executeRecordedFlowRun, type PersistedFlowRunControl } from "../persisted-flow-run.js";
import { absorbedEveryFailure, recoveryAttribution } from "../recovery-attribution.js";

// A sometimes-present step (a popup, a banner) observed absent is skipped by Core,
// not failed (`!FluxIQ` `executor/step-skip/absent-step.ts`), and the run detail
// says so on the attempt (`service/summaries/conversions.ts`). The attempt reads
// `succeeded`, so without this mark the Lab cannot tell a skip from a press.

const attempt = (overrides: Record<string, unknown> = {}) => ({ attemptId: "popup.attempt.1", nodeId: "node.popup", definitionId: "builtin.policy.action", order: 0, status: "succeeded", route: "skipped", startedAt: 1_000, finishedAt: 1_030, ...overrides });

function control(actionAttempts: unknown[]): PersistedFlowRunControl {
  return {
    selectExistingContext: async () => undefined,
    startPersistedFlow: async () => ({ runId: "run.one" }),
    runPersistedFlow: async () => ({ session: { runId: "run.one", status: "succeeded" } }),
    automationStudioCall: async () => ({ runDetail: { summary: { runId: "run.one", status: "succeeded" }, actionAttempts, interventions: [] } }),
  } as unknown as PersistedFlowRunControl;
}

const run = async (actionAttempts: unknown[]) => await executeRecordedFlowRun(control(actionAttempts), { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab", actionTypes: new Map([["node.popup", "web.dom.click"]]) });

test("a skipped attempt is reported as skipped, with its reason, observing code and epoch-ms span, and no failure", async () => {
  const outcome = await run([attempt({ skipped: { reason: "target_absent", code: "web.target.not_found" } })]);
  const action = outcome.actions[0]!;
  assert.deepEqual(action.skipped, { reason: "target_absent", code: "web.target.not_found", startedAt: 1_000, finishedAt: 1_030 });
  assert.equal(action.failure, null);
  assert.equal(action.status, "skipped", "a step that did not run reads neither succeeded nor failed");
  assert.equal(outcome.failure, null);
});

test("an attempt that ran, or a mark that is not Core's closed shape, carries no skip", async () => {
  const outcome = await run([
    attempt({ route: "success" }),
    attempt({ attemptId: "b", skipped: { reason: "target_absent", code: "the Accept button on Shop" } }),
    attempt({ attemptId: "c", skipped: { reason: "something_else", code: "web.target.not_found" } }),
    attempt({ attemptId: "d", skipped: "target_absent" }),
  ]);
  for (const action of outcome.actions) assert.equal("skipped" in action, false, `${action.attemptIndex} carries no skip`);
});

test("a skip that dispatched nothing finished when it started", async () => {
  const outcome = await run([attempt({ finishedAt: undefined, skipped: { reason: "target_absent", code: "executor.ready_state.not_shown" } })]);
  assert.deepEqual(outcome.actions[0]!.skipped, { reason: "target_absent", code: "executor.ready_state.not_shown", startedAt: 1_000, finishedAt: 1_000 });
});

// A skipped step ended its node well: the run went on. So a run whose only
// non-press is a skipped popup is a clean run, never a failed or absorbed one.
test("a run with a skipped step and every other step pressed is judged passed, with nothing absorbed", async () => {
  const outcome = await run([
    attempt({ skipped: { reason: "target_absent", code: "web.target.not_found" } }),
    attempt({ attemptId: "go.attempt.1", nodeId: "node.go", order: 1, route: "success", startedAt: 2_000, finishedAt: 2_040 }),
  ]);
  assert.deepEqual(outcome.actions.map(action => action.status), ["skipped", "succeeded"]);
  assert.equal(flowLaneObservation({ flowCreated: true, oracleVerdict: "passed", run: outcome, automationFailureExpected: null, extraction: [] }).reportedVerdict, "passed");
  assert.deepEqual(recoveredByNode(outcome.actions), [true, true], "each node ended well");
  assert.equal(absorbedEveryFailure(outcome.actions), false);
  assert.equal(recoveryAttribution(outcome.actions).nodes.every(node => node.succeeded), true);
  const timings = outcome.actions.map(action => ({ actionType: action.actionType, startedAt: action.startedAt, status: action.status }));
  assert.equal(recordingLaneProbeObservation({ oracleVerdict: "passed", actions: timings, automationFailure: null, automationFailureExpected: null, extraction: [] }).reportedVerdict, "passed");
});

// A step that could not run because the page was elsewhere is passed over and
// the run continues at the node matching the page (Core t243,
// `executor/state-routing/routed-attempt.ts`): the attempt reads
// `route: "state_routed"` and its mark says where the run went and which way.
const routed = (overrides: Record<string, unknown> = {}) => ({ reason: "state_routed", code: "web.target.not_found", toNodeId: "node.search", direction: "forward", ...overrides });

test("a state-routed attempt is reported as skipped, with where the run went and which way, and no failure", async () => {
  const outcome = await run([attempt({ route: "state_routed", skipped: routed() }), attempt({ attemptId: "back", order: 1, route: "state_routed", startedAt: 2_000, finishedAt: 2_010, skipped: routed({ code: "executor.ready_state.not_shown", toNodeId: "node.store", direction: "backward" }) })]);
  assert.deepEqual(outcome.actions[0]!.skipped, { reason: "state_routed", code: "web.target.not_found", toNodeId: "node.search", direction: "forward", startedAt: 1_000, finishedAt: 1_030 });
  assert.deepEqual(outcome.actions[1]!.skipped, { reason: "state_routed", code: "executor.ready_state.not_shown", toNodeId: "node.store", direction: "backward", startedAt: 2_000, finishedAt: 2_010 });
  assert.deepEqual(outcome.actions.map(action => action.status), ["skipped", "skipped"], "a routed step did not run, so it reads neither succeeded nor failed");
  assert.equal(outcome.failure, null);
  assert.deepEqual(outcome.stateRouted, { forward: 1, backward: 1 }, "the run counts its routed steps");
});

test("a state-routed mark that is not Core's closed shape carries no skip", async () => {
  const outcome = await run([
    attempt({ attemptId: "a", skipped: routed({ code: "Switch to Millbrook" }) }),
    attempt({ attemptId: "b", skipped: routed({ toNodeId: "the search box on ValueRidge" }) }),
    attempt({ attemptId: "c", skipped: routed({ toNodeId: 7 }) }),
    attempt({ attemptId: "d", skipped: routed({ direction: "sideways" }) }),
    attempt({ attemptId: "e", skipped: routed({ page: "Millbrook Crossing Supercenter" }) }),
    attempt({ attemptId: "f", skipped: { reason: "target_absent", code: "web.target.not_found", toNodeId: "node.search" } }),
    attempt({ attemptId: "g", skipped: { reason: "state_routed", code: "web.target.not_found", direction: "forward" } }),
  ]);
  for (const action of outcome.actions) assert.equal("skipped" in action, false, `${action.attemptIndex} carries no skip`);
  assert.equal("stateRouted" in outcome, false, "a run that routed nothing says nothing about routing");
});

test("a run whose only non-press is a state-routed step is judged passed, every node ending well", async () => {
  const outcome = await run([
    attempt({ route: "state_routed", skipped: routed() }),
    attempt({ attemptId: "go.attempt.1", nodeId: "node.go", order: 1, route: "success", startedAt: 2_000, finishedAt: 2_040 }),
  ]);
  assert.equal(flowLaneObservation({ flowCreated: true, oracleVerdict: "passed", run: outcome, automationFailureExpected: null, extraction: [] }).reportedVerdict, "passed");
  assert.deepEqual(recoveredByNode(outcome.actions), [true, true]);
  assert.equal(absorbedEveryFailure(outcome.actions), false);
});

// A routed attempt reads `route: "state_routed"` (or `"skipped"`) with Core's
// `succeeded`; a mark the Lab rejects drops the mark's detail, never the fact
// that the step did not run (t243 W1 open question 3).
test("an attempt down a skip route reads skipped even when its mark is not Core's closed shape", async () => {
  const outcome = await run([
    attempt({ attemptId: "a", route: "state_routed", skipped: routed({ toNodeId: "the search box on ValueRidge" }) }),
    attempt({ attemptId: "b", route: "skipped" }),
    attempt({ attemptId: "c", route: "state_routed", status: "failed" }),
  ]);
  assert.deepEqual(outcome.actions.map(action => action.status), ["skipped", "skipped", "failed"]);
  for (const action of outcome.actions) assert.equal("skipped" in action, false);
});
