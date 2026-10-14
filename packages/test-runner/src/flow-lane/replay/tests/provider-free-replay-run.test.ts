import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import type { PersistedFlowRunControl } from "../../persisted-flow-run.js";
import { executeProviderFreeReplayRun, type ProviderFreeReplayRun } from "../provider-free-replay-run.js";

/**
 * The one rule every replay shares: no model, and the run read back only once
 * Core has saved its verdict -- the save that carries a model-free run's zero
 * accounting (run-mv8k9k2e-1f1065a8 was read 0.4 s before it).
 */

const ACCOUNTED = {
  resultVerification: { status: "unverified", performed: false, code: "core.result.no_model_available" },
  llmGate: { invoked: false, ok: true, costAccounting: { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, budgetBreaches: 0, pendingCalls: 0 }, providerCalls: [], providerCallsOmitted: 0 },
};

/** Core saving a run in its two stages: the status its steps earned, then (from `verdictOnRead`) the verdict and the accounting together. */
function stagedCore(options: { status?: string; timedOut?: boolean; verdictOnRead?: number } = {}) {
  const calls = { reads: 0, starts: 0, runs: [] as Record<string, unknown>[] };
  const status = options.status ?? "succeeded";
  const control = {
    selectExistingContext: async () => undefined,
    startPersistedFlow: async () => {
      calls.starts += 1;
      return { runId: "run.replay" };
    },
    runPersistedFlow: async (input: Record<string, unknown>) => {
      calls.runs.push(input);
      if (options.timedOut) throw new RunnerFailure("environment.missing", "FluxIQ HTTP operation timed out", { details: { bounded: "timeout", timeoutMs: 30_000 } });
      return { session: { runId: "run.replay", status } };
    },
    automationStudioCall: async (endpoint: string) => {
      assert.equal(endpoint, "get-flow-run-detail");
      calls.reads += 1;
      // A failed run is never judged, so Core never writes it a verdict.
      const saved = status === "succeeded" && calls.reads >= (options.verdictOnRead ?? 2);
      return { runDetail: {
        summary: { runId: "run.replay", status },
        actionAttempts: [{ attemptId: "attempt.one", nodeId: "node.one", definitionId: "web.dom.click", order: 0, status: status === "succeeded" ? "succeeded" : "failed", startedAt: 1, finishedAt: 2 }],
        interventions: [],
        metadata: saved ? ACCOUNTED : {},
      } };
    },
  } as unknown as PersistedFlowRunControl;
  return { control, calls };
}

const REPLAY: ProviderFreeReplayRun = { projectId: "project-1", flowId: "flow-1", facilityRunId: "run-lab", actionTypes: new Map(), inputs: {} };

for (const timedOut of [false, true]) {
  test(`a succeeded replay is read back until Core has saved its verdict, after ${timedOut ? "a request that outlived its bound" : "Core answered early"}`, async () => {
    const fake = stagedCore({ timedOut });
    const run = await executeProviderFreeReplayRun(fake.control, REPLAY);
    assert.equal(run.status, "succeeded");
    assert.equal(run.resultVerification, "unverified", "the run was taken before Core's verdict save");
    assert.ok(fake.calls.reads >= 2);
    assert.equal(fake.calls.runs.length, 1, "the replay ran once");
  });
}

test("a replay never takes a model along, even one a caller slipped in", async () => {
  const fake = stagedCore({ verdictOnRead: 1 });
  const smuggled = { ...REPLAY, llmExecution: { intent: "explore_and_adapt", permittedConsequences: [] } } as unknown as ProviderFreeReplayRun;
  await executeProviderFreeReplayRun(fake.control, smuggled);
  assert.equal(fake.calls.starts, 1, "a deterministic run starts its own session first");
  assert.equal(fake.calls.runs[0]?.llmExecution, undefined);
  assert.equal(fake.calls.runs[0]?.runIntent, undefined);
});

test("a failed replay is never held up waiting for a verdict Core never writes", async () => {
  const fake = stagedCore({ status: "failed" });
  const run = await executeProviderFreeReplayRun(fake.control, REPLAY);
  assert.equal(run.status, "failed");
  assert.equal(run.resultVerification, null);
  assert.equal(fake.calls.reads, 1, "a failed run was polled for a verdict");
});
