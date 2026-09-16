import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import { assertLiveLlmBudgetHeld, assertLiveLlmProviderWasReached, liveLlmBudgetBreaches } from "../budget.js";
import { planLiveLlmExecution } from "../live-llm-plan.js";
import { liveLlmObservedUsage, type LiveLlmObservedUsage } from "../observed-usage.js";

/**
 * A parsed cap that nothing checks is how a test run spends real money without
 * limit, so these pin that each one actually bounds a run: the call count, the
 * per-call and per-run cost, and each token limit. The last two pin the other
 * half of fail-closed -- a run that reached no provider is not a pass.
 */

const plan = planLiveLlmExecution({
  schemaVersion: LLM_LAB_SCHEMA_VERSION,
  profileId: "lab-diagnose",
  mode: "live",
  provider: "deepseek",
  model: "deepseek-chat",
  task: "diagnose",
  scenarioNetworkPolicy: "loopback-only",
  providerEgressPolicy: "core-trusted-provider-only",
  externalSideEffects: false,
  approvalMode: "manual",
  retainRawPrompts: false,
  retainRawResponses: false,
  maxConcurrentRuns: 1,
  budget: { ...DEFAULT_LLM_LAB_BUDGET, maxCallsPerRun: 1, maxEstimatedCostUsd: 0.25 },
} satisfies LlmExecutionProfile);

function usage(overrides: Partial<LiveLlmObservedUsage> = {}): LiveLlmObservedUsage {
  return {
    calls: 1,
    interventions: 1,
    observedCalls: [{ provider: "deepseek", model: "deepseek-chat", promptVersion: "automation-studio.runtime-diagnosis.v1", validationOk: true, inputTokens: 900, outputTokens: 120, totalTokens: 1_020, estimatedCostUsd: 0.0004 }],
    totalEstimatedCostUsd: 0.0004,
    accounting: { calls: 1, inputTokens: 900, outputTokens: 120, totalTokens: 1_020, estimatedCostUsd: 0.0004, budgetBreaches: 0, pendingCalls: 0 },
    gate: { invoked: true },
    ...overrides,
  };
}

test("a run inside every cap reports no breach", () => {
  assert.deepEqual(liveLlmBudgetBreaches(plan, usage()), []);
  assert.doesNotThrow(() => assertLiveLlmBudgetHeld(plan, usage()));
});

test("more calls than authorized fails the run", () => {
  assert.throws(() => assertLiveLlmBudgetHeld(plan, usage({ calls: 2 })), /Live LLM budget exceeded.*2 provider call/su);
});

test("a breach Core counted itself fails the run, whatever the per-call records say", () => {
  const breached = usage({ accounting: { calls: 1, inputTokens: 900, outputTokens: 120, totalTokens: 1_020, estimatedCostUsd: 0.0004, budgetBreaches: 1, pendingCalls: 0 } });
  assert.throws(() => assertLiveLlmBudgetHeld(plan, breached), /Core recorded 1 budget breach/u);
});

test("Core's run totals bound the run even when no intervention recorded its tokens", () => {
  const untracked = usage({
    observedCalls: [{ provider: "deepseek", model: "deepseek-chat", promptVersion: null, validationOk: false, inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null }],
    accounting: { calls: 1, inputTokens: 90_000, outputTokens: 120, totalTokens: 90_120, estimatedCostUsd: 9, budgetBreaches: 0, pendingCalls: 0 },
    totalEstimatedCostUsd: 9,
  });
  assert.throws(() => assertLiveLlmBudgetHeld(plan, untracked), /--llm-max-input-tokens/u);
});

test("a call over the cost cap fails the run", () => {
  const over = usage({ observedCalls: [{ ...usage().observedCalls[0]!, estimatedCostUsd: 0.9 }], totalEstimatedCostUsd: 0.9 });
  assert.throws(() => assertLiveLlmBudgetHeld(plan, over), /--llm-max-cost-usd 0\.25/u);
});

test("each token limit bounds the run on its own", () => {
  const first = usage().observedCalls[0]!;
  assert.throws(() => assertLiveLlmBudgetHeld(plan, usage({ observedCalls: [{ ...first, inputTokens: 80_000 }] })), /--llm-max-input-tokens/u);
  assert.throws(() => assertLiveLlmBudgetHeld(plan, usage({ observedCalls: [{ ...first, outputTokens: 9_000 }] })), /--llm-max-output-tokens/u);
  assert.throws(() => assertLiveLlmBudgetHeld(plan, usage({ observedCalls: [{ ...first, totalTokens: 40_000 }] })), /--llm-max-total-tokens/u);
});

test("a live run that reached no provider fails, quoting Core's own gate reason", () => {
  assert.throws(
    () => assertLiveLlmProviderWasReached(plan, usage({ calls: 0, interventions: 0, observedCalls: [], totalEstimatedCostUsd: 0, gate: { invoked: false, reason: "LLM provider resolution failed.", code: "llm.provider_resolution_failed" } })),
    /reached no provider.*LLM provider resolution failed\..*llm\.provider_resolution_failed/su,
  );
});

test("an intervention Core recorded without provider tokens is not counted as a call", () => {
  const observed = liveLlmObservedUsage({
    summary: { runId: "run-1", projectId: "p", flowId: "f", status: "failed", routeDecisionCount: 0, subflowEntryCount: 0, actionAttemptCount: 1, updatedAt: 1 },
    routeDecisions: [],
    subflows: [],
    actionAttempts: [],
    interventions: [{ interventionId: "llm.provider-resolution.run-1", kind: "diagnosis", validationOk: false }],
    llmGate: { invoked: false, code: "llm.provider_resolution_failed" },
  });
  assert.equal(observed.calls, 0);
  assert.equal(observed.interventions, 1);
  assert.equal(observed.accounting, null);
  assert.throws(() => assertLiveLlmProviderWasReached(plan, observed), /reached no provider/u);
});
