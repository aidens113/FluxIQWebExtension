import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import type { ExistingRunDetail, ExistingRunProviderCall } from "../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../failure.js";
import { runLaneWithLiveLlmSettlement } from "../lane-settlement.js";
import { planLiveLlmExecution } from "../live-llm-plan.js";
import { LiveLlmRun } from "../live-llm-run.js";

// `run-mu4rpka7-845d919a` reached DeepSeek three times, and its lane then threw
// "The Flow reported an unexpected target_not_found failure" before the
// runner's settlement line: no `snapshots/live-llm.json`, and `llm.calls: 0`.
// These drive the real `LiveLlmRun` through the helper the runner now uses,
// with a lane that fails the way that one did.

const CREDENTIAL = { name: "DEEPSEEK_API_KEY", source: "test", value: "test-provider-credential-value" };
const PROFILE: LlmExecutionProfile = {
  schemaVersion: LLM_LAB_SCHEMA_VERSION,
  profileId: "lab-adapt-renamed",
  mode: "live",
  provider: "deepseek",
  model: "deepseek-chat",
  task: "adapt",
  scenarioNetworkPolicy: "loopback-only",
  providerEgressPolicy: "core-trusted-provider-only",
  externalSideEffects: false,
  approvalMode: "manual",
  retainRawPrompts: false,
  retainRawResponses: false,
  maxConcurrentRuns: 1,
  budget: { ...DEFAULT_LLM_LAB_BUDGET },
};

/**
 * The run token budget this profile is granted -- Core's default -- and an
 * overspend one request past it. Both are taken from the plan rather than
 * written down: the budget moved from 100,000 to ten full requests, and a
 * literal overspend would simply have stopped breaching.
 */
const RUN_TOKEN_BUDGET = planLiveLlmExecution(PROFILE).maxTotalTokensPerRun;
const OVERSPENT_TOKENS = RUN_TOKEN_BUDGET + DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest;

const call = (taskKind: string, sequence: number): ExistingRunProviderCall => ({
  sequence, requestId: `llm.request.${taskKind}`, taskKind, stage: "gather", allowance: taskKind === "evidence_tool_decision" ? "exploration" : "run",
  promptVersion: "v1", provider: "deepseek", model: "deepseek-chat", validationOk: true, validationCodes: [],
  inputTokens: 900, outputTokens: 100, totalTokens: 1_000, estimatedCostUsd: 0.001,
  charged: { inputTokens: 900, outputTokens: 100, totalTokens: 1_000, estimatedCostUsd: 0.001, tokens: "reported", cost: "reported" },
  budgetBreach: false,
});

/** The failed run's detail: three itemized calls, and Core's accounting of them. */
function failedRunDetail(totalTokens = 3_000): ExistingRunDetail {
  return {
    summary: { runId: "run-failed", projectId: "project-1", flowId: "flow-1", status: "failed", routeDecisionCount: 0, subflowEntryCount: 0, actionAttemptCount: 2, updatedAt: 1 },
    routeDecisions: [],
    subflows: [],
    actionAttempts: [],
    interventions: [
      { interventionId: "i-1", kind: "diagnosis", validationOk: true },
      { interventionId: "i-2", kind: "runtime_patch", validationOk: true },
    ],
    providerCalls: [call("runtime_diagnosis", 1), call("evidence_tool_decision", 2), call("runtime_patch", 3)],
    providerCallsOmitted: 0,
    llmAccounting: { calls: 3, inputTokens: 2_700, outputTokens: 300, totalTokens, estimatedCostUsd: 0.003, budgetBreaches: 0, pendingCalls: 0 },
    llmGate: { invoked: true },
  };
}

function fakeCore() {
  let metadata: unknown;
  return {
    async reauthenticate(): Promise<void> {},
    async secretKeysCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
      if (endpoint === "snapshot") return { keys: [] };
      return { id: "key-1", name: payload.name, kind: "llm", provider: "DeepSeek", scope: "global", enabled: true };
    },
    async automationStudioCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
      if (endpoint === "update-flow-settings") { metadata = (payload.flow as { metadata: unknown }).metadata; return {}; }
      if (endpoint === "get-flow") return { flow: { metadata } };
      if (endpoint === "preflight-llm-execution") return { preflight: {} };
      const maxCalls = payload.maxCalls as number;
      return { grant: { grantId: "llm-grant:test", purpose: payload.purpose, maxCalls, maxTotalTokensPerRun: payload.maxTotalTokensPerRun, maxEstimatedCostUsd: payload.maxEstimatedCostUsd, maxTotalEstimatedCostUsd: Math.min(2, (payload.maxEstimatedCostUsd as number) * maxCalls), timeoutMs: payload.timeoutMs, providerRetryCount: 0 } };
    },
  };
}

/**
 * The raw `get-flow-run-detail` answer the exploration record is read from.
 * The client's parser drops `metadata`, so the settlement reads it itself, and
 * these are the counts Core's own `exploration` stage publishes.
 */
function runDetailWithExploration(stageDetail: Record<string, unknown> = {}): unknown {
  return {
    runDetail: {
      metadata: {
        recoveryTrace: {
          schemaVersion: "automation-studio.recovery-trace.v1",
          stages: [
            { stage: "diagnosis", status: "completed", providerCalled: true, reason: "a sentence Core wrote", detail: {} },
            {
              stage: "exploration", status: "completed", providerCalled: true, reason: "another sentence Core wrote",
              detail: { requested: true, outcome: "evidence_gathered", endedBy: "evidence_gathered", actions: 3, observedActions: 3, refusedActions: 0, unusableDecisions: 1, providerCalls: 4, evidenceBytes: 8_192, durationMs: 9_100, ...stageDetail },
            },
          ],
          refused: [],
        },
      },
    },
  };
}

async function harness(options: { authorize?: boolean; detail?: () => Promise<ExistingRunDetail> } = {}) {
  const live = new LiveLlmRun(planLiveLlmExecution(PROFILE), CREDENTIAL);
  if (options.authorize !== false) await live.authorizer(fakeCore(), { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  const written: Array<{ path: string; value: Record<string, any> }> = [];
  const published: Record<string, unknown>[] = [];
  const reads: string[] = [];
  const explorationReads: string[] = [];
  const settlement = {
    live,
    control: {
      getRunDetail: async (_projectId: string, runId: string) => { reads.push(runId); return options.detail ? await options.detail() : failedRunDetail(); },
      automationStudioCall: async (endpoint: string, payload: Record<string, unknown>) => {
        if (endpoint !== "get-flow-run-detail") throw new Error(`unexpected endpoint ${endpoint}`);
        explorationReads.push(String(payload.runId));
        return runDetailWithExploration();
      },
    },
    projectId: "project-1",
    bundle: { writeStructured: async (path: string, value: unknown) => { written.push({ path, value: value as Record<string, any> }); } },
    publish: async (details: Record<string, unknown>) => { published.push(details); },
  };
  const snapshot = () => written.find((entry) => entry.path === "snapshots/live-llm.json")?.value;
  return { live, written, published, reads, explorationReads, settlement, snapshot };
}

const unexpectedFailure = new RunnerFailure("runtime.behavior", "The Flow reported an unexpected target_not_found failure");

test("a lane that fails after Core ran the Flow still leaves its provider calls itemized, and its own failure stands", async () => {
  const { live, published, reads, explorationReads, settlement, snapshot } = await harness();
  await assert.rejects(
    runLaneWithLiveLlmSettlement(settlement, async (identified) => { identified("run-failed"); throw unexpectedFailure; }),
    (error: unknown) => error === unexpectedFailure,
  );
  assert.deepEqual(reads, ["run-failed"]);
  assert.deepEqual(explorationReads, ["run-failed"], "a lane that failed after exploring did not have its exploration read");
  const written = snapshot();
  assert.ok(written, "no live-LLM snapshot was written");
  assert.equal(written.settlement, "lane_failed");
  assert.equal(written.observed.calls, 3);
  assert.equal(written.observed.perCallRecords, "recorded");
  assert.deepEqual(written.observed.observedCalls.map((line: { taskKind: string }) => line.taskKind), ["runtime_diagnosis", "evidence_tool_decision", "runtime_patch"]);
  assert.equal(written.observed.accounting.totalTokens, 3_000);
  assert.equal(written.granted.maxCalls, 26);
  // What exploring did, from Core's own recovery trace, and nothing Core wrote in prose.
  assert.equal(written.exploration.source, "recovery-trace");
  assert.equal(written.exploration.outcome, "evidence_gathered");
  assert.equal(written.exploration.requested, true);
  assert.deepEqual(written.exploration.counts, { actions: 3, observedActions: 3, refusedActions: 0, unusableDecisions: 1, providerCalls: 4, evidenceBytes: 8_192, durationMs: 9_100 });
  assert.equal(written.exploration.toolDetail, "not-published");
  assert.equal(JSON.stringify(written).includes("sentence Core wrote"), false, "the snapshot carries Core's own prose");
  assert.equal(JSON.stringify(written).includes(CREDENTIAL.value), false, "the snapshot carries the credential");
  assert.deepEqual(published, [{ calls: 3, interventions: 2, totalEstimatedCostUsd: 0.003, llmGate: { invoked: true }, settledAfterLaneFailure: true }]);
  // The evaluation's usage is the run's, not zero.
  assert.equal(live.usage.calls, 3);
});

test("a failed lane whose run broke its budget fails on the budget, not on what the automation did", async () => {
  const { settlement, snapshot } = await harness({ detail: async () => failedRunDetail(OVERSPENT_TOKENS) });
  await assert.rejects(
    runLaneWithLiveLlmSettlement(settlement, async (identified) => { identified("run-failed"); throw unexpectedFailure; }),
    (error: unknown) => error instanceof RunnerFailure && error.category === "performance.budget" && new RegExp(`the run used ${OVERSPENT_TOKENS} total tokens against its run token budget of ${RUN_TOKEN_BUDGET}`, "u").test(error.message),
  );
  assert.equal(snapshot()?.observed.accounting.totalTokens, OVERSPENT_TOKENS, "the breach's evidence is written first");
});

test("a failed lane whose run cannot be read, or was never named, still leaves a snapshot that says so", async () => {
  const unreadable = await harness({ detail: async () => { throw new Error("run detail unavailable"); } });
  await assert.rejects(runLaneWithLiveLlmSettlement(unreadable.settlement, async (identified) => { identified("run-failed"); throw unexpectedFailure; }), (error: unknown) => error === unexpectedFailure);
  assert.equal(unreadable.snapshot()?.settlement, "run_detail_unreadable");
  assert.equal(unreadable.snapshot()?.observed, null);
  assert.equal(unreadable.snapshot()?.granted.maxCalls, 26);
  assert.deepEqual(unreadable.published, []);
  assert.equal(unreadable.live.usage.calls, 0);

  const unnamed = await harness();
  await assert.rejects(runLaneWithLiveLlmSettlement(unnamed.settlement, async () => { throw unexpectedFailure; }), (error: unknown) => error === unexpectedFailure);
  assert.deepEqual(unnamed.reads, []);
  assert.equal(unnamed.snapshot()?.settlement, "run_not_identified");
});

test("a lane that failed before any grant was issued writes nothing, and a snapshot that cannot be written hides nothing", async () => {
  const ungranted = await harness({ authorize: false });
  await assert.rejects(runLaneWithLiveLlmSettlement(ungranted.settlement, async () => { throw unexpectedFailure; }), (error: unknown) => error === unexpectedFailure);
  assert.deepEqual(ungranted.written, []);

  const unwritable = await harness();
  unwritable.settlement.bundle.writeStructured = async () => { throw new Error("disk full"); };
  await assert.rejects(runLaneWithLiveLlmSettlement(unwritable.settlement, async (identified) => { identified("run-failed"); throw unexpectedFailure; }), (error: unknown) => error === unexpectedFailure);
});

test("a finished lane is settled from its own run, once, and its settlement's refusals still fail the run", async () => {
  const finished = await harness();
  const lane = await runLaneWithLiveLlmSettlement(finished.settlement, async () => ({ run: { runId: "run-failed" }, marker: "lane" }));
  assert.equal(lane.marker, "lane");
  assert.deepEqual(finished.reads, ["run-failed"]);
  assert.equal(finished.snapshot()?.settlement, undefined, "a finished lane's snapshot is the ordinary one");
  assert.equal(finished.published.length, 1);

  // An overspend found by the ordinary settlement is not read again, nor replaced.
  const overspent = await harness({ detail: async () => failedRunDetail(OVERSPENT_TOKENS) });
  await assert.rejects(
    runLaneWithLiveLlmSettlement(overspent.settlement, async () => ({ run: { runId: "run-failed" } })),
    (error: unknown) => error instanceof RunnerFailure && error.category === "performance.budget",
  );
  assert.deepEqual(overspent.reads, ["run-failed"]);
  assert.equal(overspent.written.length, 1);
});

test("with no live run the lane simply runs", async () => {
  const identified: string[] = [];
  const lane = await runLaneWithLiveLlmSettlement(
    { live: undefined, control: { getRunDetail: async () => { throw new Error("never read"); }, automationStudioCall: async () => { throw new Error("never read"); } }, projectId: "project-1", bundle: { writeStructured: async () => { throw new Error("never written"); } }, publish: async () => undefined },
    async (report) => { report("run-quiet"); identified.push("run-quiet"); return { run: { runId: "run-quiet" } }; },
  );
  assert.equal(lane.run.runId, "run-quiet");
  assert.deepEqual(identified, ["run-quiet"]);
  await assert.rejects(
    runLaneWithLiveLlmSettlement({ live: undefined, control: { getRunDetail: async () => failedRunDetail(), automationStudioCall: async () => ({}) }, projectId: "project-1", bundle: { writeStructured: async () => undefined }, publish: async () => undefined }, async () => { throw unexpectedFailure; }),
    (error: unknown) => error === unexpectedFailure,
  );
});
