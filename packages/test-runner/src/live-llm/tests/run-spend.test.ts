// Every provider call a live run made, added once.

import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD } from "fluxiq/automation-studio";
import type { LiveLlmObservedUsage } from "../observed-usage.js";
import type { LiveLlmReauthorRecord } from "../reauthor-record.js";
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
  assert.deepEqual(liveLlmRunSpend({}), { calls: 0, totalEstimatedCostUsd: 0, phases: { build: null, runtime: null, judge: null, reauthor: null }, uncountedPhases: [], perBuild: { ceilingUsd: 0.25, builds: [], maxBuildCostUsd: 0, overCeiling: 0 } });
  const build = liveLlmRunSpend({ build: usage({ calls: 22, totalEstimatedCostUsd: 0.04178802 }) });
  assert.equal(build.calls, 22);
  assert.equal(build.totalEstimatedCostUsd, 0.04178802);
});

function reauthor(costs: number[]): LiveLlmReauthorRecord {
  return {
    source: "run-detail",
    attempts: costs.map((estimatedCostUsd, index) => ({ attempt: index + 1, adaptationId: null, calls: 10, callsFrom: "loop", inputTokens: 1, outputTokens: 1, estimatedCostUsd })),
    calls: costs.length * 10,
    uncountedAttempts: 0,
    totalEstimatedCostUsd: Number(costs.reduce((sum, cost) => sum + cost, 0).toFixed(9)),
  };
}

test("spend is reported per build against Core's per-build ceiling, each build on its own", () => {
  // A build, its playback's recovery and two re-author builds at $0.20 each:
  // $0.80 for the run, and every build inside its own $0.25.
  const spend = liveLlmRunSpend({
    build: usage({ calls: 30, totalEstimatedCostUsd: 0.2 }),
    runtime: usage({ calls: 5, totalEstimatedCostUsd: 0.2 }),
    judge: { interventions: [{ requestId: "judge-1", estimatedCostUsd: 0.002 }] },
    reauthor: reauthor([0.2, 0.2]),
  });
  assert.equal(spend.perBuild.ceilingUsd, AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD);
  assert.deepEqual(spend.perBuild.builds.map((item) => [item.phase, item.attempt, item.estimatedCostUsd, item.overCeiling]), [
    ["build", null, 0.2, false], ["runtime", null, 0.2, false], ["reauthor", 1, 0.2, false], ["reauthor", 2, 0.2, false],
  ]);
  assert.equal(spend.perBuild.maxBuildCostUsd, 0.2);
  assert.equal(spend.perBuild.overCeiling, 0);
  // The result check is not a build: it stays in the phases and the run total only.
  assert.equal(spend.totalEstimatedCostUsd, 0.802);
});

test("a build over the per-build ceiling is reported as over it, never folded into a run total that hides it", () => {
  const spend = liveLlmRunSpend({ build: usage({ calls: 48, totalEstimatedCostUsd: 0.26 }), reauthor: reauthor([0.1, 0.3]) });
  assert.deepEqual(spend.perBuild.builds.filter((item) => item.overCeiling).map((item) => [item.phase, item.attempt]), [["build", null], ["reauthor", 2]]);
  assert.equal(spend.perBuild.overCeiling, 2);
  assert.equal(spend.perBuild.maxBuildCostUsd, 0.3);
});

test("the ceiling a run is reported against is its plan's, which may only be lower than Core's", () => {
  const spend = liveLlmRunSpend({ build: usage({ calls: 4, totalEstimatedCostUsd: 0.06 }), ceilingUsd: 0.05 });
  assert.equal(spend.perBuild.ceilingUsd, 0.05);
  assert.equal(spend.perBuild.overCeiling, 1);
});
