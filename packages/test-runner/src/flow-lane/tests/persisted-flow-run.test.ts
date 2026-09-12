import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { executeRecordedFlowRun, type PersistedFlowRunControl } from "../persisted-flow-run.js";

const attempt = (overrides: Record<string, unknown> = {}) => ({ attemptId: "attempt.one", nodeId: "node.one", definitionId: "web.dom.type", order: 0, status: "succeeded", startedAt: 1_000, finishedAt: 1_030, ...overrides });

function control(overrides: Partial<Record<string, unknown>> = {}, detail: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const client = {
    selectExistingContext: async () => { calls.push("select"); },
    startPersistedFlow: async () => { calls.push("start"); return { runId: "run.one" }; },
    runPersistedFlow: async () => { calls.push("run"); return { session: { runId: "run.one", status: "succeeded" } }; },
    automationStudioCall: async (endpoint: string) => {
      calls.push(endpoint);
      return { runDetail: { summary: { runId: "run.one", status: "succeeded" }, actionAttempts: [attempt()], interventions: [], ...detail } };
    },
    ...overrides,
  } as unknown as PersistedFlowRunControl;
  return { client, calls };
}

test("an attempt is identified by its node, because every recorded action shares one node definition", async () => {
  // Core stores definitionId "builtin.policy.action" for all of them and drops the node inputs.
  const { client } = control({}, { actionAttempts: [attempt({ definitionId: "builtin.policy.action", nodeId: "recorded.one" })] });
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab", actionTypes: new Map([["recorded.one", "web.dom.type"]]) });
  assert.equal(outcome.actions[0]?.actionType, "web.dom.type");

  const { client: unmapped } = control({}, { actionAttempts: [attempt({ definitionId: "builtin.policy.action", nodeId: "other" })] });
  const fallback = await executeRecordedFlowRun(unmapped, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab", actionTypes: new Map() });
  assert.equal(fallback.actions[0]?.actionType, "builtin.policy.action");
});

test("a clean Flow run reports its actions and no failure", async () => {
  const { client, calls } = control();
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.equal(outcome.runId, "run.one");
  assert.equal(outcome.status, "succeeded");
  assert.equal(outcome.failure, null);
  assert.deepEqual(outcome.actions.map(action => [action.actionType, action.status, action.durationMs]), [["web.dom.type", "succeeded", 30]]);
  assert.equal(outcome.harnessActivations, 0);
  assert.deepEqual(calls, ["select", "start", "run", "get-flow-run-detail"]);
});

test("a failed Flow is a result, not a runner fault: the structured failure survives to be asserted", async () => {
  const failure = { category: "auth_required", code: "session.expired", retryable: false };
  const { client } = control(
    { runPersistedFlow: async () => { throw new RunnerFailure("runtime.behavior", "Flow finished with status failed"); } },
    { summary: { runId: "run.one", status: "failed" }, actionAttempts: [attempt({ status: "failed", failure })] },
  );
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.equal(outcome.status, "failed");
  assert.deepEqual(outcome.failure, failure);
  assert.equal(outcome.actions[0]?.status, "failed");
});

test("a failure record Core's own parser rejects is treated as absent, never half-read", async () => {
  // Core forbids this category from being retryable, so the record is dropped whole.
  const { client } = control({}, { summary: { runId: "run.one", status: "failed" }, actionAttempts: [attempt({ status: "failed", failure: { category: "blocked_by_capability_or_policy", retryable: true } })] });
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.equal(outcome.failure, null);
});

test("harness activations and extracted records come from Core's run detail", async () => {
  const { client } = control({}, {
    interventions: [{ interventionId: "one" }, { interventionId: "two" }],
    actionAttempts: [attempt({ definitionId: "web.dom.extract_list", metadata: { result: { extracted: [{ name: "Alpha" }, { name: "Beta" }] } } })],
  });
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.equal(outcome.harnessActivations, 2);
  assert.deepEqual(outcome.extracted, [[{ name: "Alpha" }, { name: "Beta" }]]);
});

test("a run with no durable action, or a detail for another run, is refused", async () => {
  const { client: empty } = control({}, { actionAttempts: [] });
  await assert.rejects(
    () => executeRecordedFlowRun(empty, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" }),
    (error: unknown) => error instanceof RunnerFailure && error.category === "action.dispatch",
  );
  const { client: other } = control({}, { summary: { runId: "run.other", status: "succeeded" } });
  await assert.rejects(() => executeRecordedFlowRun(other, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" }), /different run/);
});
