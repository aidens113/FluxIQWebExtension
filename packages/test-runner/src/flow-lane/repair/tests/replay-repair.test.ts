import assert from "node:assert/strict";
import test from "node:test";
import type { ExistingRunDetail } from "../../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../../failure.js";
import { assertReplaysAccounted, replayRepairedFlow, type RepairReplay, type RepairReplayControl } from "../replay-repair.js";

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
    // Core states a zero accounting for a run that asked no model (Core `result-verification/zero-provider-run.ts`).
    providerCallCount: 0,
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
      runs.push(input.llmExecution ? "live" : "deterministic");
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

test("each replay prepares the page, runs the Flow with no model, and records that no provider was called", async () => {
  const fake = core();
  const replays = await replayRepairedFlow(fake.control, { ...fake.input, replays: 2 });
  assert.equal(replays.length, 2);
  assert.deepEqual(replays.map((replay) => replay.index), [1, 2]);
  assert.deepEqual(fake.prepared, [1, 2], "the page was not put back before each replay");
  assert.deepEqual(fake.goals, [1, 2]);
  assert.deepEqual(fake.runs, ["start", "deterministic", "start", "deterministic"], "a replay must carry no runIntent");
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
  assert.equal(replays[0]?.providerCalls, null, "a replay that never ran has no count, and 0 would be a measurement");
  assert.doesNotThrow(() => assertReplaysAccounted(replays), "an unreachable replay is judged as unreachable, not as unaccounted");
  assert.deepEqual(broken.prepared, [1, 2], "one broken replay stopped the loop");
  assert.equal(JSON.stringify(replays).includes("Core would not start the run"), false, "the record carries the failure's message");
});

/**
 * Whether the replay's Flow succeeded is a question about each step, not each
 * attempt. run-mv4i1cls-463e4b5c (R4b): the replay reached the goal with no
 * model, and was failed because one press had been refused by the page as busy
 * and then pressed again and succeeded -- the failed attempt stays in Core's
 * list beside the success that followed it.
 */
const step = (nodeId: string, order: number, overrides: Record<string, unknown> = {}) => attempt({ attemptId: `${nodeId}.attempt.${order + 1}`, nodeId, order, route: "success", startedAt: 1_000 + order * 100, finishedAt: 1_050 + order * 100, ...overrides });
const BUSY = { category: "action_failed", code: "web.action.rate_limited", retryable: true, stage: "execution", expected: "the page accepts the press", actual: "the page said it was busy", effect: "unacted" };

async function replayOf(attempts: Record<string, unknown>[], status = "succeeded") {
  const fake = core({ status, attempts });
  const [replay] = await replayRepairedFlow(fake.control, { ...fake.input, replays: 1 });
  return replay!;
}

test("a step the page refused as busy and that then succeeded on its retry counts as succeeded (R4b's replay)", async () => {
  const replay = await replayOf([
    step("node.open", 0),
    step("node.add", 1, { status: "failed", route: "failed", failure: BUSY }),
    step("node.add", 2, { metadata: { retry: { attemptNumber: 2, maxAttempts: 4, backoffMs: 250, rung: "retry_node" } } }),
    step("node.checkout", 3),
  ]);
  assert.equal(replay.flowSucceeded, true);
  assert.equal("flowShortfall" in replay, false);
});

test("steps skipped because they were not needed count as succeeded: an absent popup, an effect that already held, an act already done", async () => {
  const replay = await replayOf([
    step("node.popup", 0, { route: "skipped", skipped: { reason: "target_absent", code: "web.target.not_found" } }),
    step("node.coupon", 1, { route: "state_routed", skipped: { reason: "state_routed", code: "web.target.not_found", toNodeId: "node.size", direction: "forward" }, stateRouting: { outcome: "effect_holds" } }),
    step("node.size", 2, { skipped: { reason: "already_done", code: "executor.step.already_done", attemptId: "node.size.attempt.0" } }),
    step("node.add", 3),
  ]);
  assert.equal(replay.flowSucceeded, true);
  assert.equal("flowShortfall" in replay, false);
});

test("a step a person cleared fails the replay: a replay proves the repair holds unattended", async () => {
  const replay = await replayOf([
    step("node.check", 0, { status: "failed", route: "success", metadata: { ask: { personNeeded: true, status: "answered", route: "success" } } }),
    step("node.add", 1),
  ]);
  assert.equal(replay.flowSucceeded, false);
  assert.equal(replay.flowShortfall, "person_cleared");
});

test("a skipped step whose lasting act was not done fails the replay, though Core's run succeeded", async () => {
  const replay = await replayOf([
    step("node.open", 0),
    step("node.claim", 1, { route: "skipped", skipped: { reason: "target_absent", code: "web.target.not_found", notDone: true } }),
  ]);
  assert.equal(replay.status, "succeeded");
  assert.equal(replay.goalPassed, true, "the goal is the fixture's, and is kept as it was");
  assert.equal(replay.flowSucceeded, false);
  assert.equal(replay.flowShortfall, "act_not_done");
});

test("a step whose last attempt did not end well fails the replay, whether it failed, timed out or every retry failed", async () => {
  for (const last of [{ status: "failed", route: "failed", failure: BUSY }, { status: "timed_out" }, { status: "cancelled" }]) {
    const replay = await replayOf([step("node.add", 0, { status: "failed", route: "failed", failure: BUSY }), step("node.add", 1, last)]);
    assert.equal(replay.flowSucceeded, false, `a last attempt that ${last.status}`);
    assert.equal(replay.flowShortfall, "step_not_succeeded");
  }
});

test("a run Core did not finish as succeeded fails the replay first, whatever its steps say", async () => {
  const replay = await replayOf([step("node.add", 0)], "failed");
  assert.equal(replay.flowSucceeded, false);
  assert.equal(replay.flowShortfall, "run_not_succeeded");
});

/** A run detail on which Core published no provider count at all. */
function unaccounted(): ExistingRunDetail {
  const { providerCallCount: _omitted, ...detail } = runDetail();
  return detail;
}

/**
 * `lab replay` refuses a replay Core published no accounting for: "no call"
 * and "nobody counted" are different facts (`provider/free-accounting.ts`).
 * The in-run replay counted the second as the first (adaptation plan G1).
 */
test("a replay Core published no provider accounting for is unknown, not zero, and fails the proof", async () => {
  const silent = core({ detail: unaccounted });
  const replays = await replayRepairedFlow(silent.control, { ...silent.input, replays: 2 });
  assert.deepEqual(replays.map((replay) => replay.providerCalls), [null, null]);
  assert.equal(replays[0]?.modelCalled, false, "nothing says a model was called; nothing says it was not");
  assert.throws(
    () => assertReplaysAccounted(replays),
    (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior"
      && error.message === "Core published no provider call accounting for 2 of 2 replay(s) of the applied Flow, so whether they called a model is unknown"
      && JSON.stringify(error.details?.unaccountedReplays) === "[1,2]",
  );
});

test("itemized provider calls with no count are a model call, and still an unknown count", async () => {
  const itemized = core({ detail: () => ({ ...unaccounted(), providerCalls: [], providerCallsOmitted: 1 }) });
  const [replay] = await replayRepairedFlow(itemized.control, { ...itemized.input, replays: 1 });
  assert.equal(replay?.providerCalls, null);
  assert.equal(replay?.modelCalled, true);
});

test("a known zero passes the accounting check", () => {
  const known: RepairReplay = { index: 1, outcome: "ran", runId: "run.replay", status: "succeeded", providerCalls: 0, harnessActivations: 0, modelCalled: false, goalPassed: true, flowSucceeded: true, datasetsReproduced: null };
  assert.doesNotThrow(() => assertReplaysAccounted([known]));
});
