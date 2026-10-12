import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import type { PersistedFlowRunControl } from "../../flow-lane/index.js";
import { runProviderFreeReplayFlow } from "../run-flow.js";

for (const timedOut of [false, true]) test(`provider-free replay waits for settled verification after ${timedOut ? "timeout readback" : "normal return"}`, async () => {
  let reads = 0;
  let executions = 0;
  const client = {
    selectExistingContext: async () => {},
    startPersistedFlow: async () => ({ runId: "run.unit" }),
    runPersistedFlow: async (input: Record<string, unknown>) => {
      executions += 1;
      assert.equal(input.llmExecution, undefined);
      if (timedOut) throw new RunnerFailure("runtime.behavior", "Unit request timed out", { details: { bounded: "timeout" } });
      return { session: { runId: "run.unit", status: "succeeded" } };
    },
    automationStudioCall: async (endpoint: string) => {
      assert.equal(endpoint, "get-flow-run-detail");
      reads += 1;
      return { runDetail: {
        summary: { runId: "run.unit", status: "succeeded" }, actionAttempts: [{ attemptId: "attempt.unit", nodeId: "node.unit", definitionId: "unit.output", order: 0, status: "succeeded", startedAt: 1, finishedAt: 2 }], interventions: [],
        metadata: reads === 1 ? {} : {
          resultVerification: { status: "unverified", performed: false, code: "core.result.no_model_available" },
          llmGate: { invoked: false, costAccounting: { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, budgetBreaches: 0, pendingCalls: 0 }, providerCalls: [], providerCallsOmitted: 0 }
        }
      } };
    }
  } as unknown as PersistedFlowRunControl;
  const run = await runProviderFreeReplayFlow(client, { projectId: "project.unit", flowId: "flow.unit", facilityRunId: "replay.unit", actionTypes: new Map(), inputs: {} });
  assert.equal(run.resultVerification, "unverified");
  assert.ok(reads >= 2);
  assert.equal(executions, 1);
  assert.equal(run.harnessActivations, 0);
});
