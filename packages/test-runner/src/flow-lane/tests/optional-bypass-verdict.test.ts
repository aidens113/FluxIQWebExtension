import assert from "node:assert/strict";
import test from "node:test";
import { flowLaneObservation } from "../lane-observation.js";
import { executeRecordedFlowRun, type PersistedFlowRunControl } from "../persisted-flow-run.js";

// A8 wave 15 pair 2 (`run-mv9v3u68-6efbd7ae`): a "close the chat popup if it
// shows" step failed `web.target.ambiguous`, Core went on past it to its Merge
// by the optional rule, the run succeeded, its result was confirmed and the
// oracle passed -- and the Lab reported the run failed for that step.

const AMBIGUOUS = { category: "target_ambiguous", code: "web.target.ambiguous", retryable: false, stage: "target_resolution", effect: "unacted" };
const WAY_ON = { kind: "deterministic_path", priority: 5, label: "Go on past the optional step", optionalStepWayOn: true, targetNodeId: "part.s3", edgeId: "part.e-failed" };
const FAILED_ROUTE = { kind: "deterministic_path", priority: 5, label: "Follow failed route", targetNodeId: "part.s3", edgeId: "part.e-failed" };

const step = (order: number, nodeId: string, overrides: Record<string, unknown> = {}) => ({ attemptId: `attempt.${order}`, nodeId, definitionId: "builtin.policy.action", order, status: "succeeded", startedAt: 1_000 + order * 10, finishedAt: 1_005 + order * 10, ...overrides });
const failedStep = (order: number, nodeId: string, selected: Record<string, unknown> | undefined) => step(order, nodeId, { status: "failed", failure: AMBIGUOUS, ...(selected ? { metadata: { recoverySelected: selected } } : {}) });

async function runOf(attempts: Record<string, unknown>[], status = "succeeded") {
  const client = {
    selectExistingContext: async () => undefined,
    startPersistedFlow: async () => ({ runId: "run.one" }),
    runPersistedFlow: async () => ({ session: { runId: "run.one", status } }),
    automationStudioCall: async () => ({ runDetail: { summary: { runId: "run.one", status }, actionAttempts: attempts, interventions: [], metadata: { resultVerification: { status: "confirmed" } } } }),
  } as unknown as PersistedFlowRunControl;
  const run = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  return { run, observation: flowLaneObservation({ flowCreated: true, oracleVerdict: "passed", run, automationFailureExpected: null }) };
}

test("a run whose only failure is an optional step Core went on past reads passed, and keeps the failure as a note", async () => {
  const { run, observation } = await runOf([step(0, "part.s1"), failedStep(1, "part.s2", WAY_ON), step(2, "part.s3", { definitionId: "builtin.control.merge" }), step(3, "part.s4")]);
  assert.equal(run.status, "succeeded");
  assert.equal(run.failure, null, "the bypassed step is not the run's failure");
  assert.deepEqual(run.actions[1]?.optionalBypass, { toNodeId: "part.s3" });
  assert.equal(run.actions[1]?.status, "failed", "the attempt itself still reads as Core wrote it");
  assert.deepEqual(run.bypassedOptionalFailures, [{ nodeId: "part.s2", failure: AMBIGUOUS }]);
  assert.equal(observation.reportedVerdict, "passed");
  assert.equal(observation.automationFailureReported, null);
});

test("a retried optional step Core then went on past keeps every one of its failures as a note", async () => {
  const { run, observation } = await runOf([failedStep(0, "part.s2", undefined), failedStep(1, "part.s2", WAY_ON), step(2, "part.s3")]);
  assert.equal(run.failure, null);
  assert.equal(run.bypassedOptionalFailures?.length, 2);
  assert.equal(observation.reportedVerdict, "passed");
});

test("a required step's failure still fails the run, even when Core followed its failed route to a Merge", async () => {
  const { run, observation } = await runOf([step(0, "part.s1"), failedStep(1, "part.s2", FAILED_ROUTE), step(2, "part.s3", { definitionId: "builtin.control.merge" })]);
  assert.deepEqual(run.failure, AMBIGUOUS);
  assert.equal(run.actions[1]?.optionalBypass, undefined);
  assert.equal(run.bypassedOptionalFailures, undefined);
  assert.equal(observation.reportedVerdict, "failed");
  assert.deepEqual(observation.automationFailureReported, { category: "target_ambiguous", code: "web.target.ambiguous" });
});

test("an optional step Core did not go past still fails the run", async () => {
  // Core selected the way-on, and the run went elsewhere: no bypass happened.
  const elsewhere = await runOf([failedStep(0, "part.s2", WAY_ON), step(1, "part.s9")]);
  assert.deepEqual(elsewhere.run.failure, AMBIGUOUS);
  assert.equal(elsewhere.observation.reportedVerdict, "failed");
  // No selection recorded at all: the run stopped on the step.
  const stopped = await runOf([step(0, "part.s1"), failedStep(1, "part.s2", undefined)]);
  assert.deepEqual(stopped.run.failure, AMBIGUOUS);
  assert.equal(stopped.observation.reportedVerdict, "failed");
});

test("a bypassed optional step never turns a run Core failed into a pass", async () => {
  const { run, observation } = await runOf([failedStep(0, "part.s2", WAY_ON), step(1, "part.s3")], "failed");
  assert.equal(run.failure, null);
  assert.equal(observation.reportedVerdict, "failed", "Core's own status decides");
});
