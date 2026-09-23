import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile, type ScenarioExpected } from "@fluxiq-web-extension/test-contracts";
import { assertProviderCallsAsDeclared, declaredProviderCalls } from "../declared-provider-calls.js";
import { planLiveLlmExecution } from "../live-llm-plan.js";
import type { LiveLlmObservedUsage } from "../observed-usage.js";

/**
 * The declaration is an expectation, not an escape hatch, and these pin both
 * halves of that. Without one a zero-call live run still fails, which is the
 * guard that catches a deterministic pass wearing a live run's clothes. With
 * one the check inverts rather than disappearing: the run must spend nothing,
 * so a variant that says the runtime absorbs it and then consults the model
 * fails instead of quietly passing.
 *
 * The live evidence for the first two is `run-mud4xk2c-18c83d3d` (undeclared,
 * zero calls, failed `runtime.behavior`) and `run-mud4zvw9-2d497834` (the same
 * scenario with the declaration, zero calls, passed).
 */

const plan = planLiveLlmExecution({
  schemaVersion: LLM_LAB_SCHEMA_VERSION,
  profileId: "lab-adapt",
  mode: "live",
  provider: "deepseek",
  model: DEFAULT_LLM_MODEL,
  task: "adapt",
  scenarioNetworkPolicy: "loopback-only",
  providerEgressPolicy: "core-trusted-provider-only",
  externalSideEffects: false,
  approvalMode: "manual",
  retainRawPrompts: false,
  retainRawResponses: false,
  maxConcurrentRuns: 1,
  budget: { ...DEFAULT_LLM_LAB_BUDGET, maxCallsPerRun: 2 },
} satisfies LlmExecutionProfile);

function usage(overrides: Partial<LiveLlmObservedUsage> = {}): LiveLlmObservedUsage {
  return {
    calls: 0,
    interventions: 0,
    observedCalls: [],
    perCallRecords: "not recorded",
    unrecordedCalls: null,
    totalEstimatedCostUsd: 0,
    accounting: null,
    gate: null,
    ...overrides,
  };
}

const spent: Partial<LiveLlmObservedUsage> = {
  calls: 1,
  interventions: 1,
  observedCalls: [{ requestId: "request.diagnosis", taskKind: "runtime_diagnosis", stage: "gather", provider: "deepseek", model: DEFAULT_LLM_MODEL, promptVersion: "automation-studio.runtime-diagnosis.v1", validationOk: true, validationCodes: [], inputTokens: 900, outputTokens: 120, totalTokens: 1_020, estimatedCostUsd: 0.0004 }],
  perCallRecords: "recorded",
  unrecordedCalls: 0,
  totalEstimatedCostUsd: 0.0004,
  accounting: { calls: 1, inputTokens: 900, outputTokens: 120, totalTokens: 1_020, estimatedCostUsd: 0.0004, budgetBreaches: 0, pendingCalls: 0 },
  gate: { invoked: true },
};

const expected = (providerCalls?: ScenarioExpected["providerCalls"]): ScenarioExpected => (providerCalls === undefined ? {} : { providerCalls });
const because = "the ladder is expected to re-resolve the renamed control without asking";

test("a scenario that declares nothing yields no declaration, and its zero-call run still fails", () => {
  assert.equal(declaredProviderCalls(expected(), { scenarioId: "basic-form" }), null);
  assert.throws(() => assertProviderCallsAsDeclared(plan, usage(), null), /reached no provider/u);
});

test("a declared zero-call run passes where the same run without the declaration fails", () => {
  const declared = declaredProviderCalls(expected({ count: 0, because }), { scenarioId: "member-directory", workflowId: "roster", variantId: "member-left" });
  assert.deepEqual(declared, { count: 0, because, declaredBy: { scenarioId: "member-directory", workflowId: "roster", variantId: "member-left" } });
  assert.doesNotThrow(() => assertProviderCallsAsDeclared(plan, usage(), declared));
});

test("a declared zero-call run that reached a provider fails, naming where the declaration was written", () => {
  const declared = declaredProviderCalls(expected({ count: 0, because }), { scenarioId: "member-directory", variantId: "member-left" });
  assert.throws(
    () => assertProviderCallsAsDeclared(plan, usage(spent), declared),
    /Declared provider calls exceeded: member-directory\/primary\/member-left .*Core made 1 with 1 intervention/su,
  );
});

test("an intervention Core recorded without a counted call still breaks the declaration", () => {
  const declared = declaredProviderCalls(expected({ count: 0, because }), { scenarioId: "delayed-ui" });
  assert.throws(() => assertProviderCallsAsDeclared(plan, usage({ interventions: 1 }), declared), /Core made 0 with 1 intervention/u);
});

test("the declaration is stamped with the variant, because a variant replaces the workflow's field", () => {
  const workflow: ScenarioExpected = { providerCalls: { count: 0, because: "the workflow's own" } };
  const variant: ScenarioExpected = { providerCalls: { count: 0, because } };
  const resolved = declaredProviderCalls({ ...workflow, ...variant }, { scenarioId: "delayed-ui", variantId: "slow-render" });
  assert.equal(resolved?.because, because);
  assert.deepEqual(resolved?.declaredBy, { scenarioId: "delayed-ui", workflowId: null, variantId: "slow-render" });
});
