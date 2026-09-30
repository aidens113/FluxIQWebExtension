import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { readDecisionTrace, type DecisionTraceControl } from "../read-decision-trace.js";

function control(overrides: Partial<DecisionTraceControl> = {}): DecisionTraceControl {
  return {
    listFlowSummaries: async () => [{ flowId: "flow-1", name: "Kettle", sourceMode: "visual", nodeCount: 9, edgeCount: 8, updatedAt: 1 }],
    listFlowRuns: async () => [
      { runId: "run-old", projectId: "p", flowId: "flow-1", status: "succeeded", routeDecisionCount: 0, subflowEntryCount: 0, actionAttemptCount: 1, updatedAt: 1, startedAt: 1 },
      { runId: "run-new", projectId: "p", flowId: "flow-1", status: "failed", routeDecisionCount: 0, subflowEntryCount: 0, actionAttemptCount: 3, updatedAt: 5, startedAt: 5 },
    ],
    listFlowAdaptations: async () => [{ adaptationId: "ad-1", flowId: "flow-1", projectId: "p", status: "proposed" }],
    getFlowAdaptation: async () => ({ adaptationId: "ad-1", flowId: "flow-1", projectId: "p", status: "proposed", adaptationKind: "flow_bootstrap", sourceRunId: "run-new",
      accounting: { provider: "deepseek", totalTokens: 900 },
      evidenceLoop: { iterationCount: 1, toolCallCount: 1, evidenceBytes: 10, steps: [{ toolId: "web.inspect", iteration: 1, usage: { inputTokens: 700 } }] } as never }),
    automationStudioCall: async (_endpoint: string, payload: Record<string, unknown> = {}) => payload.runId === "run-new"
      ? { runDetail: { metadata: {
        resultReauthor: { routed: true, code: "flow_bootstrap.unexpected_error", stage: "provider_request", attempts: [{ attempt: 1, durationMs: 1_500, accounting: { estimatedInputTokens: 14_280 } }] },
        recoveryState: { state: "threw", code: "recovery.threw" },
        terminalFailureReason: "Kettle not found on https://shop.test/?q=kettle",
      } } }
      : { runDetail: { metadata: { compatibilitySource: "typed" } } },
    ...overrides,
  };
}

test("a run's re-author record and an adaptation's decision loop are copied, newest run first, and nothing else from the run", async () => {
  const trace = await readDecisionTrace(control(), "p", { now: () => 0 });
  assert.equal(trace.unread.length, 0);
  const [flow] = trace.flows;
  assert.deepEqual(flow?.runs.map((run) => run.runId), ["run-new", "run-old"]);
  assert.deepEqual(flow?.runs[0]?.recovery, {
    recoveryState: { state: "threw", code: "recovery.threw" },
    resultReauthor: { routed: true, code: "flow_bootstrap.unexpected_error", stage: "provider_request", attempts: [{ attempt: 1, durationMs: 1_500, accounting: { estimatedInputTokens: 14_280 } }] },
  });
  assert.equal(flow?.runs[1]?.recovery, undefined);
  assert.deepEqual(flow?.adaptations[0]?.evidenceLoop, { iterationCount: 1, toolCallCount: 1, evidenceBytes: 10, steps: [{ toolId: "web.inspect", iteration: 1, usage: { inputTokens: 700 } }] });
  assert.doesNotMatch(JSON.stringify(trace), /shop\.test|Kettle not found/u);
});

test("a read Core refuses is named by code, never by its message, and the rest is still read", async () => {
  const trace = await readDecisionTrace(control({
    listFlowRuns: async () => { throw new RunnerFailure("runtime.behavior", "secret-ish detail from https://core.test/?token=abc"); },
  }), "p", { now: () => 0 });
  assert.deepEqual(trace.unread, [{ what: "runs", id: "flow-1", code: "runtime.behavior" }]);
  assert.equal(trace.flows[0]?.adaptations.length, 1);
  assert.doesNotMatch(JSON.stringify(trace), /token=abc/u);
});

test("the whole trace is bounded in time and says so", async () => {
  let clock = 0;
  const trace = await readDecisionTrace(control({ listFlowRuns: async () => { clock += 100; return []; } }), "p", { now: () => clock, totalMs: 50 });
  assert.equal(trace.truncated, "deadline");
});
