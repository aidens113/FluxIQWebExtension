import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile, type LlmTaskKind } from "@fluxiq-web-extension/test-contracts";
import { planLiveLlmExecution } from "../live-llm-plan.js";

/**
 * The plan is where the Lab's budget vocabulary meets Core's, and the only
 * direction it is allowed to move a number is down. These tests pin that: every
 * effective limit is at or inside what the operator typed, and a profile that
 * cannot be run inside its own stated bounds is refused rather than widened.
 */

function profile(overrides: Partial<LlmExecutionProfile> = {}, budget: Partial<LlmExecutionProfile["budget"]> = {}): LlmExecutionProfile {
  return {
    schemaVersion: LLM_LAB_SCHEMA_VERSION,
    profileId: "lab-diagnose",
    mode: "live",
    provider: "deepseek",
    model: "deepseek-chat",
    task: "diagnose" as LlmTaskKind,
    scenarioNetworkPolicy: "loopback-only",
    providerEgressPolicy: "core-trusted-provider-only",
    externalSideEffects: false,
    approvalMode: "manual",
    retainRawPrompts: false,
    retainRawResponses: false,
    maxConcurrentRuns: 1,
    ...overrides,
    budget: { ...DEFAULT_LLM_LAB_BUDGET, ...budget },
  };
}

test("a diagnose profile plans exactly one authorized provider call", () => {
  const plan = planLiveLlmExecution(profile());
  assert.equal(plan.purpose, "diagnosis_only");
  assert.equal(plan.maxCalls, 1);
  assert.equal(plan.provider, "deepseek");
  assert.equal(plan.model, "deepseek-chat");
});

test("an adapt profile plans the two calls Core requires for diagnose-and-adapt", () => {
  const plan = planLiveLlmExecution(profile({ task: "adapt" }));
  assert.equal(plan.purpose, "diagnose_and_adapt");
  assert.equal(plan.maxCalls, 2);
});

test("a call limit below what the task needs is refused rather than raised", () => {
  assert.throws(() => planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 1 })), /--llm-max-calls 1 cannot authorize the 2 provider call/u);
});

test("the default 30s timeout is clamped down to Core's 25s ceiling, never up", () => {
  assert.equal(planLiveLlmExecution(profile()).timeoutMs, 25_000);
  assert.equal(planLiveLlmExecution(profile({}, { timeoutMs: 9_000 })).timeoutMs, 9_000);
});

test("a cost cap of zero cannot authorize a live call", () => {
  assert.throws(() => planLiveLlmExecution(profile({}, { maxEstimatedCostUsd: 0 })), /cannot authorize a live provider call/u);
});

test("the operator's own budget is carried through untouched for the post-run check", () => {
  const plan = planLiveLlmExecution(profile({}, { maxEstimatedCostUsd: 0.05, timeoutMs: 30_000 }));
  assert.equal(plan.declared.maxEstimatedCostUsd, 0.05);
  assert.equal(plan.declared.timeoutMs, 30_000);
  assert.equal(plan.maxEstimatedCostUsd, 0.05);
});

test("an unsupported provider, model, task or retry count is refused", () => {
  assert.throws(() => planLiveLlmExecution(profile({ provider: "openai" })), /--llm-provider openai is unsupported/u);
  assert.throws(() => planLiveLlmExecution(profile({ model: "gpt-4" })), /--llm-model gpt-4 is unsupported/u);
  assert.throws(() => planLiveLlmExecution(profile({ task: "create-flow" })), /--llm-task create-flow has no live Flow-lane runner/u);
  assert.throws(() => planLiveLlmExecution(profile({}, { maxRetries: 1 })), /--llm-max-retries 1 is unsupported/u);
});

test("token limits are held inside Core's ceiling and must add up", () => {
  assert.throws(() => planLiveLlmExecution(profile({}, { maxInputTokens: 60_000 })), /--llm-max-input-tokens 60000 must be a whole number between 1 and 50000/u);
  assert.throws(() => planLiveLlmExecution(profile({}, { maxInputTokens: 9_000, maxOutputTokens: 2_000, maxTotalTokensPerRequest: 10_000 })), /exceeds --llm-max-total-tokens/u);
});
