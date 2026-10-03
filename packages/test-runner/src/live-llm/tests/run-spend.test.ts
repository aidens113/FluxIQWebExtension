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

/** A step log that names no creation judge or read takes nothing out of the build. */
const NOTHING_FROM_BUILD = { judge: { calls: 0, estimatedCostUsd: 0 }, read: { calls: 0, estimatedCostUsd: 0 }, calls: 0, estimatedCostUsd: 0 };

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
  assert.deepEqual(spend.phases, { build: null, runtime: { calls: 3, estimatedCostUsd: 0.003 }, judge: { calls: 1, estimatedCostUsd: 0.002 }, reauthor: null, chat: null, read: null });
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
  assert.deepEqual(liveLlmRunSpend({ ceilingUsd: CEILING }), { calls: 0, totalEstimatedCostUsd: 0, phases: { build: null, runtime: null, judge: null, reauthor: null, chat: null, read: null }, uncountedPhases: [], stepLog: null, perBuild: { ceilingUsd: CEILING, builds: [], maxBuildCostUsd: 0, overCeiling: 0 } });
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

// `run-muqk713g-d08ad3dc`: 35 provider calls for $0.121157 in its step log,
// but `llm.calls` was 17 and the ledger $0.12085128. Core recorded the failed
// re-author's cost and no count of its 17 calls, and the chat's interpreter
// call is in no record the settlement reads.
test("the run's step log fills the calls Core did not count, and adds the chat call, without counting any call twice", () => {
  const uncountedReauthor: LiveLlmReauthorRecord = {
    source: "run-detail",
    attempts: [{ attempt: 1, adaptationId: null, calls: null, callsFrom: "not_recorded", inputTokens: 418_087, outputTokens: 3_452, estimatedCostUsd: 0.061567476 }],
    calls: 0,
    uncountedAttempts: 1,
    totalEstimatedCostUsd: 0.061567476,
  };
  const input = {
    build: usage({ calls: 13, totalEstimatedCostUsd: 0.047871768 }),
    runtime: usage({ calls: 2, totalEstimatedCostUsd: 0.009007356 }),
    judge: { interventions: [{ requestId: "judge-1", estimatedCostUsd: 0.00176142 }, { requestId: "judge-2", estimatedCostUsd: 0.00064326 }] },
    reauthor: uncountedReauthor,
    ceilingUsd: CEILING,
  };
  const withoutLog = liveLlmRunSpend(input);
  assert.equal(withoutLog.calls, 17, "Core's records alone leave the re-author's calls and the chat call out");
  assert.deepEqual(withoutLog.uncountedPhases, ["reauthor"]);

  const stepLog = { calls: 35, estimatedCostUsd: 0.121156656, byKind: { chat: { calls: 1, estimatedCostUsd: 0.000305376 }, decide: { calls: 29, estimatedCostUsd: 0.1 }, judge: { calls: 3, estimatedCostUsd: 0.01 }, diagnose: { calls: 1, estimatedCostUsd: 0.005 }, repair: { calls: 1, estimatedCostUsd: 0.005 } } };
  const spend = liveLlmRunSpend({ ...input, stepLog });
  assert.equal(spend.calls, 35);
  assert.equal(spend.totalEstimatedCostUsd, 0.121156656);
  assert.deepEqual(spend.phases.chat, { calls: 1, estimatedCostUsd: 0.000305376 });
  assert.deepEqual(spend.phases.reauthor, { calls: 17, estimatedCostUsd: 0.061567476 });
  assert.deepEqual(spend.uncountedPhases, []);
  assert.deepEqual(spend.stepLog, { calls: 35, estimatedCostUsd: 0.121156656, filledReauthorCalls: 17, unattributed: { calls: 0, estimatedCostUsd: 0 }, fromBuild: NOTHING_FROM_BUILD });
  // The chat call is not a build: the per-build figures are unchanged.
  assert.deepEqual(spend.perBuild, withoutLog.perBuild);
});

test("a step log that saw calls no phase claims adds them as unattributed, and one that saw fewer takes nothing away", () => {
  const build = usage({ calls: 4, totalEstimatedCostUsd: 0.004 });
  const more = liveLlmRunSpend({ build, stepLog: { calls: 6, estimatedCostUsd: 0.0065, byKind: { decide: { calls: 6, estimatedCostUsd: 0.0065 } } }, ceilingUsd: CEILING });
  assert.equal(more.calls, 6);
  assert.equal(more.totalEstimatedCostUsd, 0.0065);
  assert.deepEqual(more.stepLog?.unattributed, { calls: 2, estimatedCostUsd: 0.0025 });
  const fewer = liveLlmRunSpend({ build, stepLog: { calls: 2, estimatedCostUsd: 0.002, byKind: { decide: { calls: 2, estimatedCostUsd: 0.002 } } }, ceilingUsd: CEILING });
  assert.equal(fewer.calls, 4);
  assert.equal(fewer.totalEstimatedCostUsd, 0.004);
  assert.deepEqual(fewer.stepLog?.unattributed, { calls: 0, estimatedCostUsd: 0 });
});

test("the ceiling a run is reported against is its plan's, which may only be lower than Core's", () => {
  const spend = liveLlmRunSpend({ build: usage({ calls: 4, totalEstimatedCostUsd: 0.06 }), ceilingUsd: 0.05 });
  assert.equal(spend.perBuild.ceilingUsd, 0.05);
  assert.equal(spend.perBuild.overCeiling, 1);
});

// `run-murzln6g-11debe1d`, its real figures: Core's build record counted the
// 30 explore decisions and carried $0.088570608, which is the decisions'
// $0.086255124 plus the judge's two calls ($0.001935936, `S/0069`-`S/0070`) and
// the reading of the instructions ($0.000379548, `S/0015`), booked with no call
// (`phases.ts` `judgeAccounting`). live-llm.json said build 30 calls, judge
// null, and 3 unattributed calls at $0.
const MURZLN6G_STEP_LOG = {
  calls: 34,
  estimatedCostUsd: 0.088887084,
  byKind: { chat: { calls: 1, estimatedCostUsd: 0.000316476 }, decide: { calls: 31, estimatedCostUsd: 0.086634672 }, judge: { calls: 2, estimatedCostUsd: 0.001935936 } },
  byPart: { creation: { explore: { calls: 30, estimatedCostUsd: 0.086255124 }, read: { calls: 1, estimatedCostUsd: 0.000379548 }, judge: { calls: 2, estimatedCostUsd: 0.001935936 } } },
};

test("the creation build's judge and its reading of the instructions are phases of their own, their cost taken out of the build that held it", () => {
  const spend = liveLlmRunSpend({ build: usage({ calls: 30, totalEstimatedCostUsd: 0.088570608 }), stepLog: MURZLN6G_STEP_LOG, ceilingUsd: CEILING });
  assert.deepEqual(spend.phases, {
    build: { calls: 30, estimatedCostUsd: 0.086255124 },
    runtime: null,
    judge: { calls: 2, estimatedCostUsd: 0.001935936 },
    reauthor: null,
    chat: { calls: 1, estimatedCostUsd: 0.000316476 },
    read: { calls: 1, estimatedCostUsd: 0.000379548 },
  });
  assert.equal(spend.calls, 34, "every call in the log is in a phase");
  assert.equal(spend.totalEstimatedCostUsd, 0.088887084, "the run's total is unchanged: nothing is counted twice");
  assert.deepEqual(spend.stepLog?.unattributed, { calls: 0, estimatedCostUsd: 0 });
  assert.deepEqual(spend.stepLog?.fromBuild, { judge: { calls: 2, estimatedCostUsd: 0.001935936 }, read: { calls: 1, estimatedCostUsd: 0.000379548 }, calls: 0, estimatedCostUsd: 0.002315484 });
  // Core's purse held the build to its ceiling with the judge and the read in it.
  assert.deepEqual(spend.perBuild.builds, [{ phase: "build", attempt: null, estimatedCostUsd: 0.088570608, overCeiling: false }]);
});

test("a build figure that never held the judge or the read loses nothing, and one that counted their calls loses those too", () => {
  const apart = liveLlmRunSpend({ build: usage({ calls: 30, totalEstimatedCostUsd: 0.086255124 }), stepLog: MURZLN6G_STEP_LOG, ceilingUsd: CEILING });
  assert.deepEqual(apart.phases.build, { calls: 30, estimatedCostUsd: 0.086255124 });
  assert.deepEqual(apart.phases.judge, { calls: 2, estimatedCostUsd: 0.001935936 });
  assert.equal(apart.totalEstimatedCostUsd, 0.088887084);
  const counted = liveLlmRunSpend({ build: usage({ calls: 33, totalEstimatedCostUsd: 0.088570608 }), stepLog: MURZLN6G_STEP_LOG, ceilingUsd: CEILING });
  assert.deepEqual(counted.phases.build, { calls: 30, estimatedCostUsd: 0.086255124 });
  assert.equal(counted.calls, 34);
  // The playback's result check and the build's judge are one phase, each counted once.
  const checked = liveLlmRunSpend({ build: usage({ calls: 30, totalEstimatedCostUsd: 0.088570608 }), judge: { interventions: [{ requestId: "check-1", estimatedCostUsd: 0.001 }] }, stepLog: { ...MURZLN6G_STEP_LOG, calls: 35, estimatedCostUsd: 0.089887084 }, ceilingUsd: CEILING });
  assert.deepEqual(checked.phases.judge, { calls: 3, estimatedCostUsd: 0.002935936 });
  assert.deepEqual(checked.stepLog?.unattributed, { calls: 0, estimatedCostUsd: 0 });
});
