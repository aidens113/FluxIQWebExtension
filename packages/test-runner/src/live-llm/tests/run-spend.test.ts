// Every provider call a live run made, added once.

import assert from "node:assert/strict";
import test from "node:test";
import type { LiveLlmObservedUsage } from "../observed-usage.js";
import { liveLlmRunSpend } from "../run-spend.js";

function usage(overrides: Partial<LiveLlmObservedUsage>): LiveLlmObservedUsage {
  return { calls: 0, interventions: 0, observedCalls: [], perCallRecords: "not recorded", unrecordedCalls: null, totalEstimatedCostUsd: 0, accounting: null, gate: null, ...overrides };
}

function call(requestId: string | null, estimatedCostUsd: number) {
  return { requestId, taskKind: null, stage: null, provider: "deepseek", model: "deepseek-flash", promptVersion: null, validationOk: true, validationCodes: [], inputTokens: 10, outputTokens: 1, totalTokens: 11, estimatedCostUsd };
}

test("a run whose own accounting leaves the result check out has the check added, not subtracted", () => {
  // Core's accounting and per-call lines never list the result check's calls.
  const runtime = usage({ calls: 3, perCallRecords: "recorded", observedCalls: [call("diag-1", 0.001), call("diag-2", 0.001), call("patch-1", 0.001)], totalEstimatedCostUsd: 0.003, accounting: { calls: 3, inputTokens: 30, outputTokens: 3, totalTokens: 33, estimatedCostUsd: 0.003, budgetBreaches: 0, pendingCalls: 0 } });
  const spend = liveLlmRunSpend({ runtime, judge: { interventions: [{ requestId: "judge-1", estimatedCostUsd: 0.002 }] } });
  assert.deepEqual(spend.phases, { build: null, runtime: { calls: 3, estimatedCostUsd: 0.003 }, judge: { calls: 1, estimatedCostUsd: 0.002 }, reauthor: null });
  assert.equal(spend.calls, 4);
  assert.equal(spend.totalEstimatedCostUsd, 0.005);
});

test("a run read from its interventions counts a check it already itemized once, under the judge", () => {
  const runtime = usage({ calls: 2, interventions: 3, observedCalls: [call("diag-1", 0.001), call("judge-1", 0.002)], totalEstimatedCostUsd: 0.003 });
  const spend = liveLlmRunSpend({ runtime, judge: { interventions: [{ requestId: "judge-1", estimatedCostUsd: 0.002 }] } });
  assert.deepEqual(spend.phases.runtime, { calls: 1, estimatedCostUsd: 0.001 });
  assert.equal(spend.calls, 2);
  assert.equal(spend.totalEstimatedCostUsd, 0.003);
});

test("a run with nothing settled spends nothing, and a build alone is its own total", () => {
  assert.deepEqual(liveLlmRunSpend({}), { calls: 0, totalEstimatedCostUsd: 0, phases: { build: null, runtime: null, judge: null, reauthor: null }, uncountedPhases: [] });
  const build = liveLlmRunSpend({ build: usage({ calls: 22, totalEstimatedCostUsd: 0.04178802 }) });
  assert.equal(build.calls, 22);
  assert.equal(build.totalEstimatedCostUsd, 0.04178802);
});
