import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_LLM_LAB_BUDGET,
  LLM_LAB_MAX_CALLS_PER_RUN,
  LLM_LAB_SCHEMA_VERSION,
  type LlmExecutionProfile,
  type LlmTaskKind,
} from "@fluxiq-web-extension/test-contracts";
import type { PersistedFlowLlmExecution } from "../../flow-lane/index.js";
import { planLiveLlmExecution, type LiveLlmPurpose } from "../live-llm-plan.js";

/**
 * The plan is where the Lab's budget vocabulary meets Core's, and the only
 * direction it is allowed to move a number is down. These tests pin that: every
 * effective limit is at or inside what the operator typed, and a profile that
 * cannot be run inside its own stated bounds is refused rather than widened.
 *
 * They also pin the call-count model Core now has. A purpose that does not
 * iterate makes one call; one that does takes the operator's number, bounded
 * only by Core's runaway backstop. The Lab used to pin adaptation at exactly
 * two calls, which left a real recovery no call to gather evidence with.
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

test("a diagnose profile plans exactly one authorized provider call, whatever cap was typed", () => {
  for (const maxCallsPerRun of [1, 2, DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun, LLM_LAB_MAX_CALLS_PER_RUN]) {
    const plan = planLiveLlmExecution(profile({}, { maxCallsPerRun }));
    assert.equal(plan.purpose, "diagnosis_only");
    assert.equal(plan.maxCalls, 1, `--llm-max-calls ${maxCallsPerRun}`);
    assert.equal(plan.declared.maxCallsPerRun, maxCallsPerRun);
  }
  const plan = planLiveLlmExecution(profile());
  assert.equal(plan.provider, "deepseek");
  assert.equal(plan.model, "deepseek-chat");
});

test("a diagnose profile still needs a cap of at least one, and no more than Core's backstop", () => {
  assert.throws(() => planLiveLlmExecution(profile({}, { maxCallsPerRun: 0 })), /--llm-max-calls 0 must be a whole number between 1 and 64/u);
  assert.throws(() => planLiveLlmExecution(profile({}, { maxCallsPerRun: 65 })), /--llm-max-calls 65 must be a whole number between 1 and 64/u);
});

test("an adapt profile iterates for the operator's call count, defaulting to Core's twenty-six", () => {
  const byDefault = planLiveLlmExecution(profile({ task: "adapt" }));
  assert.equal(byDefault.purpose, "diagnose_and_adapt");
  assert.equal(byDefault.maxCalls, 26);
  assert.equal(byDefault.maxCalls, DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun);

  const ten = planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 10 }));
  assert.equal(ten.purpose, "diagnose_and_adapt");
  assert.equal(ten.maxCalls, 10);
});

test("an adapt profile is never refused for asking for more than two calls", () => {
  for (const maxCallsPerRun of [1, 2, 3, 7, 32, 64]) {
    assert.equal(planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun })).maxCalls, maxCallsPerRun, `--llm-max-calls ${maxCallsPerRun}`);
  }
});

test("an adapt call limit above Core's backstop or below one is refused, naming the option", () => {
  assert.throws(() => planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 65 })), /Live LLM execution refused: --llm-max-calls 65 must be a whole number between 1 and 64/u);
  assert.throws(() => planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 0 })), /--llm-max-calls 0 must be a whole number between 1 and 64/u);
  assert.throws(() => planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 2.5 })), /--llm-max-calls 2\.5 must be a whole number/u);
});

test("explore_and_adapt is a purpose the Lab can type and carry into a Flow run", () => {
  // Compile-time as much as run-time: the purpose must be one the plan names
  // and one the Flow lane will carry to Core.
  const purpose: LiveLlmPurpose = "explore_and_adapt";
  const carried: PersistedFlowLlmExecution = { grantId: "llm-grant:test", purpose };
  assert.equal(carried.purpose, "explore_and_adapt");
  // No --llm-task selects it yet; adapt stays the narrow grant.
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" })).purpose, "diagnose_and_adapt");
});

test("without --llm-max-run-tokens the run token budget is Core's default, so a default adapt run needs no confirmation", () => {
  // 26 calls at 10,000 tokens could use 260,000; Core's default budget holds the run to 100,000.
  const byDefault = planLiveLlmExecution(profile({ task: "adapt" }));
  assert.equal(byDefault.maxTotalTokensPerRun, 100_000);
  assert.deepEqual(
    { required: byDefault.highTokenConfirmation.required, authorizedTokens: byDefault.highTokenConfirmation.authorizedTokens, threshold: byDefault.highTokenConfirmation.threshold },
    { required: false, authorizedTokens: 100_000, threshold: 100_000 },
  );
  assert.match(byDefault.highTokenConfirmation.reason, /budget of 100000 \(Core's default: the smaller of --llm-max-total-tokens 10000 x 26 authorized call\(s\) = 260000 and 100000\) is within Core's 100000-token confirmation threshold/u);
  // Fewer calls than the threshold covers: the budget is what those calls could use.
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 3 })).maxTotalTokensPerRun, 30_000);
  assert.equal(planLiveLlmExecution(profile()).maxTotalTokensPerRun, 10_000);
});

test("Core's high-token confirmation is planned exactly when the run token budget exceeds its threshold", () => {
  const atThreshold = planLiveLlmExecution(profile({ task: "adapt" }, { maxTotalTokensPerRun: 100_000 }));
  assert.equal(atThreshold.maxTotalTokensPerRun, 100_000);
  assert.equal(atThreshold.highTokenConfirmation.required, false);
  assert.match(atThreshold.highTokenConfirmation.reason, /budget of 100000 \(--llm-max-run-tokens 100000\) is within/u);

  const above = planLiveLlmExecution(profile({ task: "adapt" }, { maxTotalTokensPerRun: 100_001 }));
  assert.equal(above.maxTotalTokensPerRun, 100_001);
  assert.equal(above.highTokenConfirmation.required, true);
  assert.equal(above.highTokenConfirmation.authorizedTokens, 100_001);
  assert.match(above.highTokenConfirmation.reason, /budget of 100001 \(--llm-max-run-tokens 100001\) is above Core's 100000-token confirmation threshold; the explicit --live-llm budget is the operator's confirmation/u);

  // Calls alone never trigger it: 64 calls at the default budget still need none.
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 64 })).highTokenConfirmation.required, false);
});

test("a run token budget only moves down: held to what the authorized calls could use, refused below one request", () => {
  const held = planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 2, maxTotalTokensPerRun: 500_000 }));
  assert.equal(held.maxTotalTokensPerRun, 20_000);
  assert.equal(held.highTokenConfirmation.required, false);
  assert.match(held.highTokenConfirmation.reason, /--llm-max-run-tokens 500000, held to --llm-max-total-tokens 10000 x 2 authorized call\(s\) = 20000/u);
  // A diagnosis makes one call however high the typed budget, so one request is all it can spend.
  const diagnosis = planLiveLlmExecution(profile({}, { maxCallsPerRun: 64, maxInputTokens: 40_000, maxOutputTokens: 10_000, maxTotalTokensPerRequest: 50_000, maxTotalTokensPerRun: 3_000_000 }));
  assert.equal(diagnosis.maxTotalTokensPerRun, 50_000);
  assert.equal(diagnosis.highTokenConfirmation.required, false);
  assert.throws(() => planLiveLlmExecution(profile({ task: "adapt" }, { maxTotalTokensPerRun: 9_999 })), /--llm-max-run-tokens 9999 must be a whole number of at least --llm-max-total-tokens 10000/u);
  assert.throws(() => planLiveLlmExecution(profile({ task: "adapt" }, { maxTotalTokensPerRun: 10_000.5 })), /--llm-max-run-tokens 10000\.5 must be a whole number/u);
});

test("the default 30s timeout is clamped down to Core's 25s ceiling, never up", () => {
  assert.equal(planLiveLlmExecution(profile()).timeoutMs, 25_000);
  assert.equal(planLiveLlmExecution(profile({}, { timeoutMs: 9_000 })).timeoutMs, 9_000);
});

test("a cost cap of zero cannot authorize a live call", () => {
  assert.throws(() => planLiveLlmExecution(profile({}, { maxEstimatedCostUsd: 0 })), /cannot authorize a live provider call/u);
});

test("the run's total cost limit is the per-call limit across the authorized calls, held to Core's $2", () => {
  assert.equal(planLiveLlmExecution(profile()).maxTotalEstimatedCostUsd, 0.25);
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" })).maxTotalEstimatedCostUsd, 2);
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 4, maxEstimatedCostUsd: 0.05 })).maxTotalEstimatedCostUsd, 0.2);
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 4, maxEstimatedCostUsd: 0.9 })).maxTotalEstimatedCostUsd, 1);
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

test("the call and token numbers the Lab mirrors are Core's own", async () => {
  // Core's built output can lag its source, so the source is what this reads:
  // it is what the next Core build will enforce.
  const source = await readFile(new URL("../../../src/programs/automation-studio/runtime/llm/execution-grants.ts", import.meta.resolve("fluxiq/automation-studio")), "utf8");
  const constant = (name: string): number => {
    const match = new RegExp(`^(?:export )?const ${name} = ([0-9_.]+);`, "mu").exec(source);
    assert.ok(match?.[1], `${name} is no longer a plain numeric constant in Core's execution-grants.ts`);
    return Number(match[1].replaceAll("_", ""));
  };
  assert.equal(constant("AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_CALLS"), LLM_LAB_MAX_CALLS_PER_RUN);
  assert.equal(constant("AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_DEFAULT_MAX_CALLS"), DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun);
  assert.equal(constant("AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD"), planLiveLlmExecution(profile()).highTokenConfirmation.threshold);
  // Not exported by Core: the ceiling on a grant's total cost, which a 64-call plan reaches.
  assert.equal(constant("MAX_TOTAL_COST_USD"), planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 64 })).maxTotalEstimatedCostUsd);
});
