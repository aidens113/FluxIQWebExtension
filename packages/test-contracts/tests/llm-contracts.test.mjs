import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_LLM_LAB_BUDGET,
  LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST,
  assertLlmExecutionProfile,
  createDeterministicDryLlmProfile,
  validateLlmExecutionProfile,
  validateLlmInvocationProvenance,
  validateLlmRunEvaluation,
  validateLlmScenarioTask,
} from "../dist/index.js";

const liveProfile = {
  schemaVersion: "0.1",
  profileId: "deepseek-lab",
  mode: "live",
  provider: "deepseek",
  model: "configured-by-test",
  task: "diagnose",
  scenarioNetworkPolicy: "loopback-only",
  providerEgressPolicy: "core-trusted-provider-only",
  externalSideEffects: false,
  approvalMode: "manual",
  retainRawPrompts: false,
  retainRawResponses: false,
  maxConcurrentRuns: 1,
  budget: { ...DEFAULT_LLM_LAB_BUDGET },
};

test("exports conservative defaults and a non-overridable request ceiling", () => {
  // The only bound on a request is the model's own context window, 1,000,000
  // tokens for both configured DeepSeek models (Core's
  // AUTOMATION_STUDIO_DEEPSEEK_MODEL_LIMITS). At 8,000 and then 48,000 input
  // tokens a real page could not be described: the guard fired before the
  // request was ever sent.
  assert.equal(LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST, 1_000_000);
  assert.deepEqual(DEFAULT_LLM_LAB_BUDGET, {
    maxInputTokens: 992_000, maxOutputTokens: 8_000, maxTotalTokensPerRequest: 1_000_000,
    timeoutMs: 30_000, maxRetries: 0, maxEstimatedCostUsd: 5,
  });
  // The default request must fit under the ceiling, which is the relationship
  // that actually matters and which seven separate copies of these numbers kept
  // breaking.
  assert.ok(DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest <= LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST);
  assert.ok(DEFAULT_LLM_LAB_BUDGET.maxInputTokens + DEFAULT_LLM_LAB_BUDGET.maxOutputTokens <= DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest);
  assert.equal("maxTotalTokensPerRun" in DEFAULT_LLM_LAB_BUDGET, false);
  const dry = createDeterministicDryLlmProfile();
  assert.equal(dry.mode, "deterministic-dry");
  assert.equal("maxCallsPerRun" in dry.budget, false);
  assert.doesNotThrow(() => assertLlmExecutionProfile(dry));
});

test("validates an explicit loopback-only live profile", () => {
  assert.equal(validateLlmExecutionProfile(liveProfile).valid, true);
  assert.equal(validateLlmExecutionProfile({ ...liveProfile, budget: { ...liveProfile.budget, maxEstimatedCostUsd: 0.1 } }).valid, true);
  for (const mutation of [
    { budget: { ...liveProfile.budget, maxTotalTokensPerRequest: 1_000_001 } },
    { budget: { ...liveProfile.budget, maxInputTokens: 9_000, maxOutputTokens: 2_000, maxTotalTokensPerRequest: 10_000 } },
    { scenarioNetworkPolicy: "allowlisted-real-site" },
    { providerEgressPolicy: "flow-configured-endpoint" },
    { externalSideEffects: true },
    { retainRawPrompts: true },
    { maxConcurrentRuns: 2 },
    { budget: { ...liveProfile.budget, maxEstimatedCostUsd: 10.01 } },
    { profileId: "sk-secretvalue12345678" },
    { provider: "api_key_value" },
    { model: "m".repeat(201) },
  ]) assert.equal(validateLlmExecutionProfile({ ...liveProfile, ...mutation }).valid, false);
});

test("no call count exists: the dollar ceiling bounds a run, and a legacy field is ignored", () => {
  assert.equal("maxCallsPerRun" in DEFAULT_LLM_LAB_BUDGET, false);
  for (const maxCallsPerRun of [0, 1, 26, 250, 100_000]) {
    assert.equal(validateLlmExecutionProfile({ ...liveProfile, task: "adapt", budget: { ...liveProfile.budget, maxCallsPerRun } }).valid, true, `maxCallsPerRun ${maxCallsPerRun}`);
  }
});

test("a run token budget is optional, and covers one request", () => {
  // The per-request triple is set together. Overriding only the total while
  // inheriting the default's 992,000 input would make every case below invalid
  // for an unrelated reason -- input plus output may not exceed the total.
  const budget = { ...liveProfile.budget, maxInputTokens: 8_000, maxOutputTokens: 2_000, maxTotalTokensPerRequest: 10_000 };
  for (const maxTotalTokensPerRun of [10_000, 100_000, 100_001, 260_001]) {
    assert.equal(validateLlmExecutionProfile({ ...liveProfile, task: "adapt", budget: { ...budget, maxTotalTokensPerRun } }).valid, true, `maxTotalTokensPerRun ${maxTotalTokensPerRun}`);
  }
  for (const maxTotalTokensPerRun of [0, 9_999, 1.5, "100000"]) {
    const checked = validateLlmExecutionProfile({ ...liveProfile, task: "adapt", budget: { ...budget, maxTotalTokensPerRun } });
    assert.equal(checked.valid, false, `maxTotalTokensPerRun ${maxTotalTokensPerRun}`);
    assert.ok(checked.issues.every(issue => issue.path === "$.budget.maxTotalTokensPerRun"), JSON.stringify(checked.issues));
  }
  const dry = createDeterministicDryLlmProfile();
  assert.equal(validateLlmExecutionProfile({ ...dry, budget: { ...dry.budget, maxTotalTokensPerRun: 10_000 } }).valid, false);
});

test("requires provider and model only for live mode", () => {
  assert.equal(validateLlmExecutionProfile({ ...liveProfile, provider: undefined }).valid, false);
  assert.equal(validateLlmExecutionProfile({ ...liveProfile, model: undefined }).valid, false);
  assert.equal(validateLlmExecutionProfile({ ...createDeterministicDryLlmProfile(), provider: "deepseek" }).valid, false);
});

test("validates bounded tasks and prevents action allow/deny overlap", () => {
  const task = {
    schemaVersion: "0.1", task: "create-flow", goal: "Submit the form",
    allowedEvidence: ["scenario-goal", "registered-capabilities"],
    allowedActions: ["web.click"], forbiddenActions: ["web.navigate"],
    requiredConstraints: ["one Router with one owned Subflow"],
    expectedOutcome: "proposal", reviewRequired: true, deterministicReplayRequired: true,
  };
  assert.equal(validateLlmScenarioTask(task).valid, true);
  assert.equal(validateLlmScenarioTask({ ...task, forbiddenActions: ["web.click"] }).valid, false);
  assert.equal(validateLlmScenarioTask({ ...task, reviewRequired: false }).valid, false);
  assert.equal(validateLlmScenarioTask({ ...task, goal: "x".repeat(4_001) }).valid, false);
  assert.equal(validateLlmScenarioTask({ ...task, requiredConstraints: Array.from({ length: 101 }, (_, i) => "constraint-" + i) }).valid, false);
  assert.equal(validateLlmScenarioTask({ ...task, rawPrompt: "must never be accepted" }).valid, false);
});

test("provenance is sanitized, bounded, and internally consistent", () => {
  const provenance = {
    schemaVersion: "0.1", requestId: "request-1", profileId: "deepseek-lab",
    provider: "deepseek", model: "configured-by-test", task: "diagnose",
    promptSchemaVersion: "diagnosis-1", attempt: 1, inputTokens: 100,
    outputTokens: 20, totalTokens: 120, usageSource: "provider-reported", latencyMs: 42, outcome: "succeeded",
    sanitized: true, rawPromptRetained: false, rawResponseRetained: false,
  };
  assert.equal(validateLlmInvocationProvenance(provenance).valid, true);
  assert.equal(validateLlmInvocationProvenance({ ...provenance, totalTokens: 121 }).valid, false);
  assert.equal(validateLlmInvocationProvenance({ ...provenance, totalTokens: 50_001 }).valid, false);
  assert.equal(validateLlmInvocationProvenance({ ...provenance, rawResponseRetained: true }).valid, false);
  assert.equal(validateLlmInvocationProvenance({ ...provenance, requestId: "sk-secretvalue12345678" }).valid, false);
  assert.equal(validateLlmInvocationProvenance({ ...provenance, outcome: "failed" }).valid, false);
  const unavailable = { ...provenance, outcome: "failed", errorCategory: "transport", usageSource: "unavailable" };
  delete unavailable.inputTokens; delete unavailable.outputTokens; delete unavailable.totalTokens;
  assert.equal(validateLlmInvocationProvenance(unavailable).valid, true);
});

test("evaluation requires a zero-call deterministic replay and safety gate", () => {
  const evaluation = {
    schemaVersion: "0.1", runId: "run-1", profileId: "deepseek-lab", task: "diagnose",
    invocations: [], proposalValidated: true, reviewOutcome: "approved", applyOutcome: "applied",
    deterministicReplay: { required: true, completed: true, passed: true, llmCalls: 0 },
    safetyPassed: true, verdict: "passed", reasons: [],
  };
  assert.equal(validateLlmRunEvaluation(evaluation).valid, true);
  assert.equal(validateLlmRunEvaluation({ ...evaluation, deterministicReplay: { ...evaluation.deterministicReplay, llmCalls: 1 } }).valid, false);
  assert.equal(validateLlmRunEvaluation({ ...evaluation, safetyPassed: false }).valid, false);
  assert.equal(validateLlmRunEvaluation({ ...evaluation, deterministicReplay: { required: true, completed: false, llmCalls: 0 } }).valid, false);
  const invocation = {
    schemaVersion: "0.1", requestId: "request-1", profileId: "deepseek-lab",
    provider: "deepseek", model: "configured-by-test", task: "diagnose",
    promptSchemaVersion: "diagnosis-1", attempt: 1, inputTokens: 10, outputTokens: 5,
    totalTokens: 15, usageSource: "provider-reported", latencyMs: 1, outcome: "succeeded",
    sanitized: true, rawPromptRetained: false, rawResponseRetained: false,
  };
  // Any number of calls may be recorded; no count is declared or held. A legacy field is ignored.
  const iterated = Array.from({ length: 300 }, (_, index) => ({ ...invocation, requestId: `request-${index + 1}` }));
  assert.equal(validateLlmRunEvaluation({ ...evaluation, task: "adapt", invocations: iterated }).valid, true);
  assert.equal(validateLlmRunEvaluation({ ...evaluation, maxCallsPerRun: 1, invocations: iterated }).valid, true);
});

test("a live profile may permit consequence classes, each once, and a dry one none", () => {
  assert.equal(validateLlmExecutionProfile({ ...liveProfile, permittedConsequences: ["send_or_publish", "create_new"] }).valid, true);
  assert.equal(validateLlmExecutionProfile({ ...liveProfile, permittedConsequences: [] }).valid, true);
  for (const permittedConsequences of [["purchase"], ["delete", "delete"], "delete", [1]]) {
    assert.equal(validateLlmExecutionProfile({ ...liveProfile, permittedConsequences }).valid, false, JSON.stringify(permittedConsequences));
  }
  assert.equal(validateLlmExecutionProfile({ ...createDeterministicDryLlmProfile(), permittedConsequences: ["delete"] }).valid, false);
});
