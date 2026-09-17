import assert from "node:assert/strict";
import test from "node:test";
import type { ExistingRunDetail } from "../../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../../failure.js";
import { replayRepairedFlow, type RepairReplayControl } from "../replay-repair.js";

/**
 * A repair that only works while a provider is being paid is an expensive
 * retry. These pin what a replay measures: Core's own provider-call count, the
 * run it made, and the fixture's goal -- and that a replay which cannot run is
 * recorded as that rather than as a repair that failed.
 */

const attempt = (overrides: Record<string, unknown> = {}) => ({ attemptId: "attempt.one", nodeId: "node.one", definitionId: "web.dom.click", order: 0, status: "succeeded", startedAt: 1_000, finishedAt: 1_030, ...overrides });

function runDetail(overrides: Partial<ExistingRunDetail> = {}): ExistingRunDetail {
  return {
    summary: { runId: "run.replay", projectId: "project-1", flowId: "flow-1", status: "succeeded", routeDecisionCount: 0, subflowEntryCount: 0, actionAttemptCount: 1, updatedAt: 1 },
    routeDecisions: [], subflows: [], actionAttempts: [], interventions: [],
    ...overrides,
  };
}

function core(options: { detail?: () => ExistingRunDetail; status?: string; attempts?: Record<string, unknown>[]; failRun?: boolean } = {}) {
  const prepared: number[] = [];
  const goals: number[] = [];
  const runs: string[] = [];
  const control = {
    selectExistingContext: async () => undefined,
    startPersistedFlow: async () => { runs.push("start"); return { runId: "run.replay" }; },
    runPersistedFlow: async (input: { llmExecution?: unknown }) => {
      if (options.failRun) throw new RunnerFailure("runtime.behavior", "Core would not start the run");
      runs.push(input.llmExecution ? "granted" : "ungranted");
      return { session: { runId: "run.replay", status: options.status ?? "succeeded" } };
    },
    automationStudioCall: async () => ({ runDetail: { summary: { runId: "run.replay", status: options.status ?? "succeeded" }, actionAttempts: options.attempts ?? [attempt()], interventions: [] } }),
    getRunDetail: async () => options.detail?.() ?? runDetail(),
  } as unknown as RepairReplayControl;
  return {
    control, prepared, goals, runs,
    input: {
      projectId: "project-1", flowId: "flow-1", facilityRunId: "run-lab",
      prepare: async () => { prepared.push(prepared.length + 1); },
      checkGoal: async () => { goals.push(goals.length + 1); return true; },
    },
  };
}

test("each replay prepares the page, runs the Flow with no grant, and records that no provider was called", async () => {
  const fake = core();
  const replays = await replayRepairedFlow(fake.control, { ...fake.input, replays: 2 });
  assert.equal(replays.length, 2);
  assert.deepEqual(replays.map((replay) => replay.index), [1, 2]);
  assert.deepEqual(fake.prepared, [1, 2], "the page was not put back before each replay");
  assert.deepEqual(fake.goals, [1, 2]);
  assert.deepEqual(fake.runs, ["start", "ungranted", "start", "ungranted"], "a replay must carry no execution grant");
  for (const replay of replays) {
    assert.equal(replay.outcome, "ran");
    assert.equal(replay.providerCalls, 0);
    assert.equal(replay.modelCalled, false);
    assert.equal(replay.goalPassed, true);
    assert.equal(replay.flowSucceeded, true);
  }
});

test("zero replays runs none, and is not an error", async () => {
  const fake = core();
  assert.deepEqual(await replayRepairedFlow(fake.control, { ...fake.input, replays: 0 }), []);
  assert.deepEqual(fake.runs, []);
});

test("a provider Core counted is reported however Core counted it", async () => {
  const byLedger = core({ detail: () => runDetail({ llmAccounting: { calls: 2, inputTokens: 1, outputTokens: 1, totalTokens: 2, estimatedCostUsd: 0.001, budgetBreaches: 0, pendingCalls: 0 } }) });
  assert.equal((await replayRepairedFlow(byLedger.control, { ...byLedger.input, replays: 1 }))[0]?.modelCalled, true);
  const byGate = core({ detail: () => runDetail({ providerCallCount: 1 }) });
  assert.equal((await replayRepairedFlow(byGate.control, { ...byGate.input, replays: 1 }))[0]?.providerCalls, 1);
  // An intervention Core recorded is a call the run made, whatever the accounting says.
  const byIntervention = core({ attempts: [attempt()] });
  const withIntervention = {
    ...byIntervention,
    control: { ...byIntervention.control, automationStudioCall: async () => ({ runDetail: { summary: { runId: "run.replay", status: "succeeded" }, actionAttempts: [attempt()], interventions: [{ interventionId: "i-1", kind: "diagnosis" }] } }) } as unknown as RepairReplayControl,
  };
  assert.equal((await replayRepairedFlow(withIntervention.control, { ...withIntervention.input, replays: 1 }))[0]?.modelCalled, true);
});

test("a replay whose Flow failed, or whose goal did not hold, is recorded as the run it was", async () => {
  const failed = core({ status: "failed", attempts: [attempt({ status: "failed" })] });
  const [ran] = await replayRepairedFlow(failed.control, { ...failed.input, replays: 1 });
  assert.equal(ran?.outcome, "ran");
  assert.equal(ran?.status, "failed");
  assert.equal(ran?.flowSucceeded, false);

  const missed = core();
  const [goalless] = await replayRepairedFlow(missed.control, { ...missed.input, replays: 1, checkGoal: async () => false });
  assert.equal(goalless?.goalPassed, false);
  assert.equal(goalless?.flowSucceeded, true, "the Flow ran; it is the fixture's state that did not hold");
});

test("a replay Core could not run at all is unreachable by category, and the rest are still attempted", async () => {
  const broken = core({ failRun: true });
  const replays = await replayRepairedFlow(broken.control, { ...broken.input, replays: 2 });
  assert.deepEqual(replays.map((replay) => replay.outcome), ["unreachable", "unreachable"]);
  assert.equal(replays[0]?.status, "runtime.behavior");
  assert.equal(replays[0]?.goalPassed, false);
  assert.deepEqual(broken.prepared, [1, 2], "one broken replay stopped the loop");
  assert.equal(JSON.stringify(replays).includes("Core would not start the run"), false, "the record carries the failure's message");
});
