import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import type { ExistingRunDetail, ExistingRunProviderCall } from "../../existing-fluxiq-control.js";
import { assertLiveLlmBudgetHeld, liveLlmBudgetBreaches } from "../budget.js";
import { planLiveLlmExecution } from "../live-llm-plan.js";
import { liveLlmObservedUsage } from "../observed-usage.js";

/**
 * An iterating run's evidence calls leave no intervention, so a reader that
 * itemized interventions never saw them: the Lab counted them in Core's totals
 * and held none of them to a per-call cap. These pin that Core's per-call lines
 * are what the Lab now reads, every call included, and that a run detail
 * without them says so instead of pretending.
 */

const adapting = planLiveLlmExecution({
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
  budget: { ...DEFAULT_LLM_LAB_BUDGET, maxCallsPerRun: 26 },
} satisfies LlmExecutionProfile);

function line(sequence: number, taskKind: string, overrides: Partial<ExistingRunProviderCall> = {}): ExistingRunProviderCall {
  const reported = { inputTokens: 900, outputTokens: 100, totalTokens: 1_000, estimatedCostUsd: 0.001 };
  return {
    sequence,
    requestId: `llm.${taskKind}.${sequence}`,
    taskKind,
    stage: taskKind === "runtime_patch" ? "implement" : "gather",
    allowance: taskKind === "evidence_tool_decision" ? "exploration" : "run",
    promptVersion: `automation-studio.${taskKind}.v1+stage.gather`,
    provider: "deepseek",
    model: DEFAULT_LLM_MODEL,
    validationOk: true,
    validationCodes: [],
    ...reported,
    charged: { ...reported, tokens: "reported", cost: "reported" },
    budgetBreach: false,
    ...overrides,
  };
}

function detail(lines: ExistingRunProviderCall[] | undefined, calls: number, omitted = 0): ExistingRunDetail {
  const charged = (lines ?? []).map(item => item.charged);
  const sum = (key: "inputTokens" | "outputTokens" | "totalTokens" | "estimatedCostUsd") => charged.reduce((total, item) => total + item[key], 0);
  return {
    summary: { runId: "run-1", projectId: "p", flowId: "f", status: "failed", routeDecisionCount: 0, subflowEntryCount: 0, actionAttemptCount: 1, updatedAt: 1 },
    routeDecisions: [],
    subflows: [],
    actionAttempts: [],
    interventions: [
      { interventionId: "i-1", kind: "diagnosis", requestId: "llm.runtime_diagnosis.1", provider: "deepseek", model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 900, outputTokens: 100, totalTokens: 1_000, estimatedCostUsd: 0.001 },
      { interventionId: "i-2", kind: "runtime_patch", requestId: `llm.runtime_patch.${calls}`, provider: "deepseek", model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 900, outputTokens: 100, totalTokens: 1_000, estimatedCostUsd: 0.001 },
    ],
    providerCallCount: calls,
    llmAccounting: { calls, inputTokens: sum("inputTokens"), outputTokens: sum("outputTokens"), totalTokens: sum("totalTokens"), estimatedCostUsd: sum("estimatedCostUsd"), budgetBreaches: 0, pendingCalls: 0 },
    llmGate: { invoked: true },
    ...(lines === undefined ? {} : { providerCalls: lines, providerCallsOmitted: omitted }),
  };
}

const iterating = [line(1, "runtime_diagnosis"), line(2, "evidence_tool_decision"), line(3, "evidence_tool_decision"), line(4, "runtime_patch")];

test("every call Core itemized is observed, evidence calls included, in Core's order", () => {
  const observed = liveLlmObservedUsage(detail(iterating, 4));

  assert.equal(observed.calls, 4);
  assert.equal(observed.interventions, 2);
  assert.equal(observed.perCallRecords, "recorded");
  assert.equal(observed.unrecordedCalls, 0);
  assert.deepEqual(observed.observedCalls.map(call => [call.requestId, call.taskKind, call.stage]), [
    ["llm.runtime_diagnosis.1", "runtime_diagnosis", "gather"],
    ["llm.evidence_tool_decision.2", "evidence_tool_decision", "gather"],
    ["llm.evidence_tool_decision.3", "evidence_tool_decision", "gather"],
    ["llm.runtime_patch.4", "runtime_patch", "implement"],
  ]);
  assert.deepEqual(liveLlmBudgetBreaches(adapting, observed), []);
});

test("an evidence call over a per-call cap fails the run, and is named", () => {
  const pricey = [...iterating];
  pricey[2] = line(3, "evidence_tool_decision", { estimatedCostUsd: 0.9, outputTokens: 9_000, inputTokens: 900, totalTokens: 9_900 });
  const observed = liveLlmObservedUsage(detail(pricey, 4));

  assert.throws(() => assertLiveLlmBudgetHeld(adapting, observed), /call 3 \(evidence_tool_decision\) cost 0\.9 against --llm-max-cost-usd 0\.25/u);
  assert.throws(() => assertLiveLlmBudgetHeld(adapting, observed), /call 3 \(evidence_tool_decision\) used 9000 output tokens against --llm-max-output-tokens/u);
  // Read the old way, from the interventions, the same run passed: that call was invisible.
  assert.deepEqual(liveLlmBudgetBreaches(adapting, liveLlmObservedUsage(detail(undefined, 4))), []);
});

test("a figure the provider did not report stays unknown, while Core's charged totals still bound the run", () => {
  const unreported = [...iterating];
  unreported[1] = line(2, "evidence_tool_decision", {
    inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null,
    charged: { inputTokens: 8_000, outputTokens: 2_000, totalTokens: 10_000, estimatedCostUsd: 0.0769, tokens: "reserved", cost: "reserved" },
  });
  const observed = liveLlmObservedUsage(detail(unreported, 4));

  assert.deepEqual(observed.observedCalls[1], { requestId: "llm.evidence_tool_decision.2", taskKind: "evidence_tool_decision", stage: "gather", provider: "deepseek", model: DEFAULT_LLM_MODEL, promptVersion: "automation-studio.evidence_tool_decision.v1+stage.gather", validationOk: true, validationCodes: [], inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null });
  // Summed in Core's order, as its accounting was.
  const charged = [0.001, 0.0769, 0.001, 0.001].reduce((total, cost) => total + cost, 0);
  assert.equal(observed.totalEstimatedCostUsd, charged);
  // No per-call breach is invented for the unreported call ...
  assert.deepEqual(liveLlmBudgetBreaches(adapting, observed), []);
  // ... and the reservation it was charged still counts against the run where Core published no totals.
  const { llmAccounting: _accounting, providerCallCount: _count, ...withoutTotals } = detail(unreported, 4);
  const bare = liveLlmObservedUsage(withoutTotals);
  assert.equal(bare.calls, 4);
  assert.equal(bare.perCallRecords, "recorded");
  assert.equal(bare.totalEstimatedCostUsd, charged);
});

test("a run detail without per-call lines is read from its interventions and says it was not recorded", () => {
  const observed = liveLlmObservedUsage(detail(undefined, 4));

  assert.equal(observed.perCallRecords, "not recorded");
  assert.equal(observed.unrecordedCalls, null);
  assert.equal(observed.calls, 4);
  assert.deepEqual(observed.observedCalls.map(call => [call.requestId, call.taskKind]), [["llm.runtime_diagnosis.1", null], ["llm.runtime_patch.4", null]]);
  assert.deepEqual(liveLlmBudgetBreaches(adapting, observed), []);
});

test("per-call lines that do not cover every counted call fail the run", () => {
  const short = liveLlmObservedUsage(detail([iterating[0]!, iterating[1]!, iterating[3]!].map((item, index) => ({ ...item, sequence: index + 1 })), 4));
  assert.equal(short.perCallRecords, "incomplete");
  assert.equal(short.unrecordedCalls, 1);
  assert.throws(() => assertLiveLlmBudgetHeld(adapting, short), /Core counted 4 provider call\(s\) but itemized 3, so 1 call\(s\) escaped the per-call caps/u);

  const truncated = liveLlmObservedUsage(detail(iterating, 5, 1));
  assert.equal(truncated.perCallRecords, "incomplete");
  assert.throws(() => assertLiveLlmBudgetHeld(adapting, truncated), /so 1 call\(s\) escaped/u);

  const overstated = liveLlmObservedUsage(detail(iterating, 3));
  assert.equal(overstated.perCallRecords, "incomplete");
  assert.throws(() => assertLiveLlmBudgetHeld(adapting, overstated), /Core counted 3 provider call\(s\) but itemized 4; its per-call lines and its accounting disagree/u);
});

test("a call whose answer did not validate carries Core's issue codes, so a failed live run says why", () => {
  // Three live runs ended on one diagnosis call with `validationOk: false` and
  // nothing else to go on, because the snapshot dropped the codes Core recorded.
  const rejected = line(1, "runtime_diagnosis", { validationOk: false, validationCodes: ["llm_schema.invalid_json", "llm_provider.timeout"] });
  const observed = liveLlmObservedUsage(detail([rejected], 1));

  assert.equal(observed.observedCalls[0]?.validationOk, false);
  assert.deepEqual(observed.observedCalls[0]?.validationCodes, ["llm_schema.invalid_json", "llm_provider.timeout"]);
  // A copy, so the snapshot cannot be changed through the run detail it came from.
  assert.notEqual(observed.observedCalls[0]?.validationCodes, rejected.validationCodes);
});
