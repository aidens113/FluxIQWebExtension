// Every provider call a live run made, added once.

import assert from "node:assert/strict";
import test from "node:test";
import type { LiveLlmObservedUsage } from "../observed-usage.js";
import type { LiveLlmReauthorRecord } from "../reauthor-record.js";
import { liveLlmRunSpend } from "../run-spend.js";
import { LAB_CEILING_USD } from "./lab-ceiling.js";

/** Core's per-build ceiling as the Lab resolves it (`FLUXIQ_LLM_RUN_COST_CEILING_USD`, default $0.10). */
const CEILING = LAB_CEILING_USD;

/** An amount rounded to the nano-dollar, as the spend report rounds it. */
function nano(amount: number): number {
  return Number(amount.toFixed(9));
}

function usage(overrides: Partial<LiveLlmObservedUsage>): LiveLlmObservedUsage {
  return { calls: 0, interventions: 0, observedCalls: [], perCallRecords: "not recorded", unrecordedCalls: null, totalEstimatedCostUsd: 0, accounting: null, gate: null, ...overrides };
}

function call(requestId: string | null, estimatedCostUsd: number) {
  return { requestId, taskKind: null, stage: null, provider: "deepseek", model: "deepseek-flash", promptVersion: null, validationOk: true, validationCodes: [], inputTokens: 10, outputTokens: 1, totalTokens: 11, estimatedCostUsd };
}

test("a run whose own accounting leaves the result check out has the check added, not subtracted", () => {
  // Core's accounting and per-call lines never list the result check's calls.
  const runtime = usage({ calls: 3, perCallRecords: "recorded", observedCalls: [call("diag-1", 0.001), call("diag-2", 0.001), call("patch-1", 0.001)], totalEstimatedCostUsd: 0.003, accounting: { calls: 3, inputTokens: 30, outputTokens: 3, totalTokens: 33, estimatedCostUsd: 0.003, budgetBreaches: 0, pendingCalls: 0 } });
  const spend = liveLlmRunSpend({ runtime, judge: { interventions: [{ requestId: "judge-1", estimatedCostUsd: 0.002 }] }, ceilingUsd: CEILING });
  assert.deepEqual(spend.phases, { build: null, runtime: { calls: 3, estimatedCostUsd: 0.003 }, judge: { calls: 1, estimatedCostUsd: 0.002 }, reauthor: null });
  assert.equal(spend.calls, 4);
  assert.equal(spend.totalEstimatedCostUsd, 0.005);
});

test("a run read from its interventions counts a check it already itemized once, under the judge", () => {
  const runtime = usage({ calls: 2, interventions: 3, observedCalls: [call("diag-1", 0.001), call("judge-1", 0.002)], totalEstimatedCostUsd: 0.003 });
  const spend = liveLlmRunSpend({ runtime, judge: { interventions: [{ requestId: "judge-1", estimatedCostUsd: 0.002 }] }, ceilingUsd: CEILING });
  assert.deepEqual(spend.phases.runtime, { calls: 1, estimatedCostUsd: 0.001 });
  assert.equal(spend.calls, 2);
  assert.equal(spend.totalEstimatedCostUsd, 0.003);
});

test("a run with nothing settled spends nothing, and a build alone is its own total", () => {
  assert.deepEqual(liveLlmRunSpend({ ceilingUsd: CEILING }), { calls: 0, totalEstimatedCostUsd: 0, phases: { build: null, runtime: null, judge: null, reauthor: null }, uncountedPhases: [], perBuild: { ceilingUsd: CEILING, builds: [], maxBuildCostUsd: 0, overCeiling: 0 } });
  const build = liveLlmRunSpend({ build: usage({ calls: 22, totalEstimatedCostUsd: 0.04178802 }), ceilingUsd: CEILING });
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
  // A build, its playback's recovery and two re-author builds at 0.8 of Core's
  // ceiling each: 3.2 times the ceiling for the run, and every build inside its own.
  const each = nano(CEILING * 0.8);
  const spend = liveLlmRunSpend({
    build: usage({ calls: 30, totalEstimatedCostUsd: each }),
    runtime: usage({ calls: 5, totalEstimatedCostUsd: each }),
    judge: { interventions: [{ requestId: "judge-1", estimatedCostUsd: 0.002 }] },
    reauthor: reauthor([each, each]),
    ceilingUsd: CEILING,
  });
  assert.equal(spend.perBuild.ceilingUsd, CEILING);
  assert.deepEqual(spend.perBuild.builds.map((item) => [item.phase, item.attempt, item.estimatedCostUsd, item.overCeiling]), [
    ["build", null, each, false], ["runtime", null, each, false], ["reauthor", 1, each, false], ["reauthor", 2, each, false],
  ]);
  assert.equal(spend.perBuild.maxBuildCostUsd, each);
  assert.equal(spend.perBuild.overCeiling, 0);
  // The result check is not a build: it stays in the phases and the run total only.
  assert.equal(spend.totalEstimatedCostUsd, Number((each * 4 + 0.002).toFixed(9)));
});

test("a build over the per-build ceiling is reported as over it, never folded into a run total that hides it", () => {
  const spend = liveLlmRunSpend({ build: usage({ calls: 48, totalEstimatedCostUsd: CEILING * 1.04 }), reauthor: reauthor([nano(CEILING * 0.4), nano(CEILING * 1.2)]), ceilingUsd: CEILING });
  assert.deepEqual(spend.perBuild.builds.filter((item) => item.overCeiling).map((item) => [item.phase, item.attempt]), [["build", null], ["reauthor", 2]]);
  assert.equal(spend.perBuild.overCeiling, 2);
  assert.equal(spend.perBuild.maxBuildCostUsd, nano(CEILING * 1.2));
});

test("the ceiling a run is reported against is its plan's, which may only be lower than Core's", () => {
  const spend = liveLlmRunSpend({ build: usage({ calls: 4, totalEstimatedCostUsd: 0.06 }), ceilingUsd: 0.05 });
  assert.equal(spend.perBuild.ceilingUsd, 0.05);
  assert.equal(spend.perBuild.overCeiling, 1);
});
