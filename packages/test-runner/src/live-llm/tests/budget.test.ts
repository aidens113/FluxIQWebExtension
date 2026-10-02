import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import { assertLiveLlmBudgetHeld, assertLiveLlmProviderWasReached, liveLlmBudgetBreaches } from "../budget.js";
import { LAB_CEILING_USD, planAtLabCeiling } from "./lab-ceiling.js";
import { liveLlmObservedUsage, type LiveLlmObservedUsage } from "../observed-usage.js";

/**
 * A parsed cap that nothing checks is how a test run spends real money without
 * limit, so these pin that each one actually bounds a run: the call count, the
 * per-call and per-run cost, and each token limit. The last two pin the other
 * half of fail-closed -- a run that reached no provider is not a pass.
 */

function livePlan(task: LlmExecutionProfile["task"], budget: Partial<LlmExecutionProfile["budget"]>) {
  return planAtLabCeiling({
    schemaVersion: LLM_LAB_SCHEMA_VERSION,
    profileId: `lab-${task}`,
    mode: "live",
    provider: "deepseek",
    model: DEFAULT_LLM_MODEL,
    task,
    scenarioNetworkPolicy: "loopback-only",
    providerEgressPolicy: "core-trusted-provider-only",
    externalSideEffects: false,
    approvalMode: "manual",
    retainRawPrompts: false,
    retainRawResponses: false,
    maxConcurrentRuns: 1,
    budget: { ...DEFAULT_LLM_LAB_BUDGET, ...budget },
  } satisfies LlmExecutionProfile);
}

/** The shared per-request budget, imported rather than copied. */
const PER_REQUEST = DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest;

/** `amount` as a breach message prints it, escaped for a pattern. */
function escaped(amount: number): string {
  return String(amount).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

const plan = livePlan("diagnose", { maxCallsPerRun: 1, maxEstimatedCostUsd: 0.25 });

function usage(overrides: Partial<LiveLlmObservedUsage> = {}): LiveLlmObservedUsage {
  return {
    calls: 1,
    interventions: 1,
    observedCalls: [{ requestId: "request.diagnosis", taskKind: "runtime_diagnosis", stage: "gather", provider: "deepseek", model: DEFAULT_LLM_MODEL, promptVersion: "automation-studio.runtime-diagnosis.v1", validationOk: true, validationCodes: [], inputTokens: 900, outputTokens: 120, totalTokens: 1_020, estimatedCostUsd: 0.0004 }],
    perCallRecords: "recorded",
    unrecordedCalls: 0,
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
    observedCalls: [{ requestId: null, taskKind: null, stage: null, provider: "deepseek", model: DEFAULT_LLM_MODEL, promptVersion: null, validationOk: false, validationCodes: [], inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null }],
    accounting: { calls: 1, inputTokens: DEFAULT_LLM_LAB_BUDGET.maxInputTokens + 1, outputTokens: 120, totalTokens: DEFAULT_LLM_LAB_BUDGET.maxInputTokens + 121, estimatedCostUsd: 9, budgetBreaches: 0, pendingCalls: 0 },
    totalEstimatedCostUsd: 9,
  });
  assert.throws(() => assertLiveLlmBudgetHeld(plan, untracked), /--llm-max-input-tokens/u);
});

test("a call over the cost cap fails the run", () => {
  const over = usage({ observedCalls: [{ ...usage().observedCalls[0]!, estimatedCostUsd: 0.9 }], totalEstimatedCostUsd: 0.9 });
  assert.throws(() => assertLiveLlmBudgetHeld(plan, over), /--llm-max-cost-usd 0\.25/u);
});

test("each token limit bounds the run on its own", () => {
  // Each probe is one token past its own limit, taken from the shared budget. A
  // fixed number stops breaching the moment the budget grows past it, which is
  // exactly what the 40,000 total-token probe did against a 56,000 ceiling.
  const first = usage().observedCalls[0]!;
  assert.throws(() => assertLiveLlmBudgetHeld(plan, usage({ observedCalls: [{ ...first, inputTokens: DEFAULT_LLM_LAB_BUDGET.maxInputTokens + 1 }] })), /--llm-max-input-tokens/u);
  assert.throws(() => assertLiveLlmBudgetHeld(plan, usage({ observedCalls: [{ ...first, outputTokens: DEFAULT_LLM_LAB_BUDGET.maxOutputTokens + 1 }] })), /--llm-max-output-tokens/u);
  assert.throws(() => assertLiveLlmBudgetHeld(plan, usage({ observedCalls: [{ ...first, totalTokens: PER_REQUEST + 1 }] })), /--llm-max-total-tokens/u);
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
  assert.equal(observed.perCallRecords, "not recorded");
  assert.equal(observed.unrecordedCalls, null);
  assert.throws(() => assertLiveLlmProviderWasReached(plan, observed), /reached no provider/u);
});

// An iterating run: many calls are normal, and what bounds it is what it asked
// for -- its call count, its per-call caps and its run token budget.
const adapting = livePlan("adapt", { maxCallsPerRun: 26 });

function adaptingUsage(calls: number, perCall: { inputTokens: number; outputTokens: number; estimatedCostUsd: number }): LiveLlmObservedUsage {
  const totalTokens = perCall.inputTokens + perCall.outputTokens;
  const observedCalls = Array.from({ length: calls }, (_, index) => ({ requestId: `request.${index + 1}`, taskKind: "runtime_diagnosis", stage: "gather", provider: "deepseek", model: DEFAULT_LLM_MODEL, promptVersion: "automation-studio.runtime-diagnosis.v1", validationOk: true, validationCodes: [], ...perCall, totalTokens }));
  const cost = Math.round(perCall.estimatedCostUsd * calls * 1e9) / 1e9;
  return {
    calls,
    interventions: calls,
    observedCalls,
    perCallRecords: "recorded",
    unrecordedCalls: 0,
    totalEstimatedCostUsd: cost,
    accounting: { calls, inputTokens: perCall.inputTokens * calls, outputTokens: perCall.outputTokens * calls, totalTokens: totalTokens * calls, estimatedCostUsd: cost, budgetBreaches: 0, pendingCalls: 0 },
    gate: { invoked: true },
  };
}

test("an iterating run inside its call count and run token budget reports no breach", () => {
  assert.equal(adapting.maxCalls, 26);
  assert.equal(adapting.maxTotalTokensPerRun, PER_REQUEST * 26);
  // 26 calls of 3,800 tokens is 98,800: more than two calls, inside every cap.
  assert.deepEqual(liveLlmBudgetBreaches(adapting, adaptingUsage(26, { inputTokens: 3_000, outputTokens: 800, estimatedCostUsd: 0.002 })), []);
});

test("an iterating run fails the moment it makes more calls than it asked for", () => {
  const over = adaptingUsage(27, { inputTokens: 100, outputTokens: 20, estimatedCostUsd: 0.0001 });
  assert.throws(() => assertLiveLlmBudgetHeld(adapting, over), /27 provider call\(s\) against an authorized 26/u);
  assert.throws(() => assertLiveLlmBudgetHeld(adapting, over), /27 provider call\(s\) against --llm-max-calls 26/u);
});

test("an iterating run fails when its calls together exceed the run token budget, though each is within its own limit", () => {
  // Every call is comfortably inside the per-request ceiling; 26 of them are
  // over a typed run token budget. Both halves of that are asserted, so the
  // probe cannot quietly stop proving what the title says when a limit moves.
  const budget = PER_REQUEST * 2;
  const typed = livePlan("adapt", { maxCallsPerRun: 26, maxTotalTokensPerRun: budget });
  const perCall = { inputTokens: Math.floor(PER_REQUEST / 10), outputTokens: 2_000, estimatedCostUsd: 0.002 };
  const perCallTokens = perCall.inputTokens + perCall.outputTokens;
  assert.ok(perCallTokens < PER_REQUEST, "the probe must be a legal request");
  const runTokens = perCallTokens * 26;
  assert.ok(runTokens > typed.maxTotalTokensPerRun, "26 such calls must overrun the run token budget");
  const over = adaptingUsage(26, perCall);
  assert.throws(() => assertLiveLlmBudgetHeld(typed, over), new RegExp(`the run used ${runTokens} total tokens against its run token budget of ${budget} \\(--llm-max-run-tokens ${budget}\\)$`, "u"));
  // The per-call records bound the run even where Core published no accounting.
  assert.throws(() => assertLiveLlmBudgetHeld(typed, { ...over, accounting: null }), new RegExp(`${runTokens} total tokens against its run token budget of ${budget}`, "u"));
});

test("a typed run token budget is the one the run is held to, and is named", () => {
  // Three requests' worth. A run budget may never sit below one whole request,
  // so the 40,000 this used to type is no longer a budget a plan will accept:
  // it was refused before the assertion it was written for could run.
  const budget = PER_REQUEST * 3;
  const typed = livePlan("adapt", { maxCallsPerRun: 26, maxTotalTokensPerRun: budget });
  assert.equal(typed.maxTotalTokensPerRun, budget);
  // Ten such calls fit the budget and eleven do not, whatever the request size.
  const perCallTokens = Math.floor(budget / 10.5);
  const perCall = { inputTokens: perCallTokens - 2_000, outputTokens: 2_000, estimatedCostUsd: 0.002 };
  assert.throws(() => assertLiveLlmBudgetHeld(typed, adaptingUsage(11, perCall)), new RegExp(`${perCallTokens * 11} total tokens against its run token budget of ${budget} \\(--llm-max-run-tokens ${budget}\\)`, "u"));
  assert.doesNotThrow(() => assertLiveLlmBudgetHeld(typed, adaptingUsage(10, perCall)));
});

test("an iterating build's total cost is held to --llm-max-cost-usd for the whole build, not per call", () => {
  const small = livePlan("adapt", { maxCallsPerRun: 4, maxEstimatedCostUsd: 0.05 });
  const within = adaptingUsage(4, { inputTokens: 100, outputTokens: 20, estimatedCostUsd: 0.0125 });
  assert.doesNotThrow(() => assertLiveLlmBudgetHeld(small, within));
  // Four calls at the old per-call reading of $0.05 each come to $0.20: four times the build's own $0.05.
  const perCallReading = adaptingUsage(4, { inputTokens: 100, outputTokens: 20, estimatedCostUsd: 0.05 });
  assert.throws(() => assertLiveLlmBudgetHeld(small, perCallReading), /the build's estimated cost 0\.2 exceeded its per-build cost ceiling of 0\.05 \(--llm-max-cost-usd 0\.05, held to Core's per-build ceiling\)/u);
  // 26 calls at Core's ceiling each would be 26 times it; the build's spend ceiling is Core's ceiling.
  assert.equal(adapting.maxTotalEstimatedCostUsd, LAB_CEILING_USD);
  // 26 calls at a 25th of the ceiling come to 1.04 times it.
  const perCall = LAB_CEILING_USD / 25;
  const pricey = adaptingUsage(26, { inputTokens: 100, outputTokens: 20, estimatedCostUsd: perCall });
  assert.ok(pricey.totalEstimatedCostUsd > LAB_CEILING_USD);
  assert.throws(() => assertLiveLlmBudgetHeld(adapting, pricey), new RegExp(`the build's estimated cost ${escaped(pricey.totalEstimatedCostUsd)} exceeded its per-build cost ceiling of ${escaped(LAB_CEILING_USD)} \\(.*held to Core's per-build ceiling\\)`, "u"));
});

test("a one-call diagnosis is judged across its one authorized call, not the larger cap typed", () => {
  const diagnosis = livePlan("diagnose", { maxCallsPerRun: 26 });
  assert.equal(diagnosis.maxCalls, 1);
  const usage = adaptingUsage(1, { inputTokens: 8_000, outputTokens: 2_000, estimatedCostUsd: 0.01 });
  assert.doesNotThrow(() => assertLiveLlmBudgetHeld(diagnosis, usage));
  // Core's totals say one token more than a single call may spend: comfortably
  // inside what the 26 calls typed would have allowed, a breach for the one
  // call this diagnosis actually authorized.
  const inflatedInput = DEFAULT_LLM_LAB_BUDGET.maxInputTokens + 1;
  const inflatedTotal = PER_REQUEST + 1;
  const inflated = { ...usage, accounting: { ...usage.accounting!, inputTokens: inflatedInput, totalTokens: inflatedTotal } };
  assert.throws(() => assertLiveLlmBudgetHeld(diagnosis, inflated), new RegExp(`${inflatedInput} input tokens against --llm-max-input-tokens ${DEFAULT_LLM_LAB_BUDGET.maxInputTokens} across 1 authorized call`, "u"));
  assert.throws(() => assertLiveLlmBudgetHeld(diagnosis, inflated), new RegExp(`${inflatedTotal} total tokens against its run token budget of ${PER_REQUEST}`, "u"));
});
