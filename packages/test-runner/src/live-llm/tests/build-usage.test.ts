import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import { liveLlmBudgetBreaches } from "../budget.js";
import { liveLlmBuildUsage } from "../build-usage.js";
import { planLiveLlmExecution } from "../live-llm-plan.js";
import type { CreatedFlowBuild, CreatedFlowBuildStep } from "../../flow-lane/index.js";

/**
 * The one paid step of a created-Flow run used to publish no per-call record at
 * all: `observedCalls` was the empty list and `perCallRecords` the constant
 * `not recorded`, so no per-call cap was ever checked on a build and no bundle
 * said what a single call of one cost. These pin the ledger read from Core's
 * own decision rows, and the two ways it must not lie: one paid call itemized
 * once, and a build whose count reaches past the loop reported as a partial
 * record rather than as a call that escaped its caps.
 */

const plan = planLiveLlmExecution({
  schemaVersion: LLM_LAB_SCHEMA_VERSION,
  profileId: "lab-create-flow",
  mode: "live",
  provider: "deepseek",
  model: DEFAULT_LLM_MODEL,
  task: "create-flow",
  scenarioNetworkPolicy: "loopback-only",
  providerEgressPolicy: "core-trusted-provider-only",
  externalSideEffects: false,
  approvalMode: "manual",
  retainRawPrompts: false,
  retainRawResponses: false,
  maxConcurrentRuns: 1,
  budget: DEFAULT_LLM_LAB_BUDGET,
} satisfies LlmExecutionProfile);

function buildWith(steps: readonly CreatedFlowBuildStep[] | null, overrides: Partial<CreatedFlowBuild> = {}): CreatedFlowBuild {
  return {
    outcome: "proposed",
    adaptationId: "adaptation.created",
    providerCalls: 3,
    loopProviderCalls: 3,
    providerInvocation: "attempted",
    accounting: { provider: "deepseek", model: DEFAULT_LLM_MODEL, inputTokens: 30_000, outputTokens: 1_200, totalTokens: 31_200, estimatedCostUsd: 0.02 },
    evidenceLoop: { decisionCount: 3, toolCallCount: 3, evidenceBytes: 18_000, toolIds: ["core.run_node"], steps },
    failure: null,
    recoveredAfterTimeout: false,
    durationMs: 99_375,
    instructedConsequences: [],
    declaredConsequences: null,
    consequenceCrossCheck: null,
    permissionRequest: null,
    ...overrides,
  };
}

const RUN_NODE = "core.run_node";

test("a build's provider calls are itemized from the decision rows that record them", () => {
  const usage = liveLlmBuildUsage(buildWith([
    { toolId: RUN_NODE, iteration: 1, callId: "evidence.1", usage: { inputTokens: 9_000, outputTokens: 400, totalTokens: 9_400, estimatedCostUsd: 0.006 } },
    { toolId: RUN_NODE, iteration: 2, callId: "evidence.2", usage: { inputTokens: 10_000, outputTokens: 400, estimatedCostUsd: 0.007 } },
    { toolId: RUN_NODE, iteration: 3, callId: "evidence.3", usage: { inputTokens: 11_000, outputTokens: 400, totalTokens: 11_400, estimatedCostUsd: 0.007 } },
  ]));

  assert.equal(usage.perCallRecords, "recorded");
  assert.equal(usage.unrecordedCalls, 0);
  assert.deepEqual(usage.observedCalls.map((call) => [call.requestId, call.inputTokens, call.totalTokens, call.estimatedCostUsd]), [
    ["evidence.1", 9_000, 9_400, 0.006],
    // Core keeps `totalTokens === inputTokens + outputTokens`, so a row that
    // reported no total is still held to the per-request ceiling.
    ["evidence.2", 10_000, 10_400, 0.007],
    ["evidence.3", 11_000, 11_400, 0.007],
  ]);
  // The build ran under one grant bound to one provider and model, and those are what its calls carry.
  assert.deepEqual([...new Set(usage.observedCalls.map((call) => `${call.provider}/${call.model}`))], [`deepseek/${DEFAULT_LLM_MODEL}`]);
  assert.deepEqual(liveLlmBudgetBreaches(plan, usage), []);
});

test("one paid call written as two rows is itemized once", () => {
  // A decision that edits the draft and re-runs a step writes its own row and
  // the rerun's row under the single iteration that paid for both. Counting
  // rows would charge the build twice for one call, which is the arithmetic
  // that made every per-call figure of `run-mudw1ktb-0557816b` 27% too low.
  const usage = liveLlmBuildUsage(buildWith([
    { toolId: "core.decision_amend_draft", iteration: 1, usage: { inputTokens: 12_000, outputTokens: 500, totalTokens: 12_500, estimatedCostUsd: 0.008 } },
    { toolId: RUN_NODE, iteration: 1, callId: "evidence.1", usage: { inputTokens: 12_000, outputTokens: 500, totalTokens: 12_500, estimatedCostUsd: 0.008 } },
    { toolId: RUN_NODE, iteration: 2, callId: "evidence.2", usage: { inputTokens: 13_000, outputTokens: 500, totalTokens: 13_500, estimatedCostUsd: 0.009 } },
  ], { providerCalls: 2, loopProviderCalls: 2 }));

  assert.equal(usage.observedCalls.length, 2);
  assert.equal(usage.perCallRecords, "recorded");
  // The call id arrives on the second row of the iteration and is taken; the figures are not added up.
  assert.deepEqual(usage.observedCalls.map((call) => [call.requestId, call.totalTokens]), [["evidence.1", 12_500], ["evidence.2", 13_500]]);
});

test("the deterministic observation before the first decision is not a paid call", () => {
  const usage = liveLlmBuildUsage(buildWith([
    { toolId: "web.inspect_current_page", iteration: 0, callId: "evidence.0", evidenceBytes: 4_000 },
    { toolId: RUN_NODE, iteration: 1, callId: "evidence.1", usage: { inputTokens: 9_000, outputTokens: 400, totalTokens: 9_400, estimatedCostUsd: 0.006 } },
  ], { providerCalls: 1, loopProviderCalls: 1 }));

  assert.deepEqual(usage.observedCalls.map((call) => call.requestId), ["evidence.1"]);
  assert.equal(usage.perCallRecords, "recorded");
});

test("a build whose calls reach past its loop reports the ledger it has, never a call that escaped its caps", () => {
  // Core spends provider calls outside the evidence loop -- reading what the
  // person's instruction already asks for -- and writes no decision row for
  // them. Reporting that as `incomplete`, which is what a run's short ledger
  // means, would fail every correctly accounted build as a budget breach.
  const usage = liveLlmBuildUsage(buildWith([
    { toolId: RUN_NODE, iteration: 1, callId: "evidence.1", usage: { inputTokens: 9_000, outputTokens: 400, totalTokens: 9_400, estimatedCostUsd: 0.006 } },
    { toolId: RUN_NODE, iteration: 2, callId: "evidence.2", usage: { inputTokens: 10_000, outputTokens: 400, totalTokens: 10_400, estimatedCostUsd: 0.007 } },
  ], { providerCalls: 3, loopProviderCalls: 2 }));

  assert.equal(usage.perCallRecords, "not recorded");
  assert.equal(usage.unrecordedCalls, 1);
  // The calls it did itemize are published, and each is still held to every per-call cap.
  assert.equal(usage.observedCalls.length, 2);
  assert.deepEqual(liveLlmBudgetBreaches(plan, usage), []);
});

test("a call over a per-call cap is now a breach of a build, where a build used to be checked by its totals alone", () => {
  const usage = liveLlmBuildUsage(buildWith([
    { toolId: RUN_NODE, iteration: 1, callId: "evidence.1", usage: { inputTokens: DEFAULT_LLM_LAB_BUDGET.maxInputTokens + 1, outputTokens: 400, estimatedCostUsd: 0.006 } },
    { toolId: RUN_NODE, iteration: 2, callId: "evidence.2", usage: { inputTokens: 10_000, outputTokens: 400, totalTokens: 10_400, estimatedCostUsd: 0.007 } },
    { toolId: RUN_NODE, iteration: 3, callId: "evidence.3", usage: { inputTokens: 11_000, outputTokens: 400, totalTokens: 11_400, estimatedCostUsd: 0.007 } },
  ]));

  assert.deepEqual(liveLlmBudgetBreaches(plan, usage), [`call 1 used ${DEFAULT_LLM_LAB_BUDGET.maxInputTokens + 1} input tokens against --llm-max-input-tokens ${DEFAULT_LLM_LAB_BUDGET.maxInputTokens}`]);
});

test("a build Core published no per-call record for says so, rather than reporting one", () => {
  const none = liveLlmBuildUsage(buildWith(null));
  assert.equal(none.perCallRecords, "not recorded");
  assert.deepEqual(none.observedCalls, []);
  assert.equal(none.unrecordedCalls, null);

  // Rows from a Core that publishes the trace but nothing per call itemize nothing.
  const older = liveLlmBuildUsage(buildWith([
    { toolId: RUN_NODE, effectApplied: true, resultCode: "web.action.rejected.target_unobserved" },
    { toolId: RUN_NODE, effectApplied: true, resultCode: "web.action.rejected.target_unobserved" },
  ]));
  assert.equal(older.perCallRecords, "not recorded");
  assert.deepEqual(older.observedCalls, []);
  assert.equal(older.unrecordedCalls, null);

  // A build that reached no provider is unchanged: no ledger, no gate saying it was invoked.
  const refused = liveLlmBuildUsage(buildWith(null, { providerCalls: 0, providerInvocation: "not_attempted", accounting: null, evidenceLoop: null, outcome: "failed", failure: { code: "flow_bootstrap.provider_resolution_failed", stage: "provider_resolution", httpStatus: 400 } }));
  assert.equal(refused.calls, 0);
  assert.deepEqual(refused.gate, { invoked: false, reason: "Core's Flow build stopped at provider_resolution before a provider answered.", code: "flow_bootstrap.provider_resolution_failed" });
});
