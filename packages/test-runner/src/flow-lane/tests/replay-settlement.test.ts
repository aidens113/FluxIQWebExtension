import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { executeRecordedFlowRun, type PersistedFlowRunControl } from "../persisted-flow-run.js";
import { providerFreeReplayFailures } from "../../saved-flow-replay/provider/index.js";

test("explicit deterministic settlement stays bounded and missing accounting still refuses replay", async () => {
  let now = 0;
  let reads = 0;
  const control = {
    selectExistingContext: async () => {},
    startPersistedFlow: async () => ({ runId: "run.unit" }),
    runPersistedFlow: async () => ({ session: { runId: "run.unit", status: "succeeded" } }),
    automationStudioCall: async () => {
      reads += 1;
      return { runDetail: { summary: { runId: "run.unit", status: "succeeded" }, actionAttempts: [{ attemptId: "attempt.unit", nodeId: "node.unit", definitionId: "unit.output", order: 0, status: "succeeded", startedAt: 1, finishedAt: 2 }], interventions: [] } };
    }
  } as unknown as PersistedFlowRunControl;
  await assert.rejects(executeRecordedFlowRun(control, { projectId: "project.unit", flowId: "flow.unit", facilityRunId: "replay.unit" }, {}, {
    awaitVerdict: true, timeoutMs: 100, intervalMs: 20, now: () => now, sleep: async ms => { now += ms; }
  }), (error: unknown) => error instanceof RunnerFailure && error.category === "performance.budget" && error.details?.pending === "verdict" && error.details?.waitedMs === 100);
  assert.ok(reads > 1);
  assert.equal(now, 100);
  assert.deepEqual(providerFreeReplayFailures({}, 0), ["Core published no provider call accounting for the replay"]);
});
