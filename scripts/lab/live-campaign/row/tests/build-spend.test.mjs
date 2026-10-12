import assert from "node:assert/strict";
import test from "node:test";
import { perBuildSpend } from "../index.mjs";
import { totalsOf } from "../../summary/index.mjs";

// t438: one purse per Flow. The user's words (2026-10-01): "bring the ceiling
// down to $0.1 per flow max". The ceiling here is any run's own, never Core's.
const CEILING = 0.25;
/** A snapshot from before the runner judged the Flow: each part a "build" of its own. */
const perBuild = (builds) => ({ ceilingUsd: CEILING, builds, maxBuildCostUsd: Math.max(0, ...builds.map((item) => item.estimatedCostUsd)), overCeiling: builds.filter((item) => item.overCeiling).length });
const entry = (phase, estimatedCostUsd, attempt = null) => ({ phase, attempt, estimatedCostUsd, overCeiling: estimatedCostUsd > CEILING });

test("the runner's own Flow figure is read as it was recorded, with its parts", () => {
  const recorded = { ceilingUsd: 0.1, builds: [{ phase: "flow", attempt: null, estimatedCostUsd: 0.120331128, overCeiling: true }], parts: [entry("build", 0.04248), entry("runtime", 0.00424), entry("reauthor", 0.07345, 1)], maxBuildCostUsd: 0.120331128, overCeiling: 1 };
  const spend = perBuildSpend({ authorized: { maxTotalEstimatedCostUsd: 0.1 }, observed: { calls: 75, totalEstimatedCostUsd: 0.120331128, perBuild: recorded } }, null);
  assert.deepEqual(spend.builds, [{ phase: "flow", attempt: null, costUsd: 0.120331128, overCeiling: true }]);
  assert.deepEqual(spend.parts.map((item) => [item.phase, item.attempt, item.costUsd]), [["build", null, 0.04248], ["runtime", null, 0.00424], ["reauthor", 1, 0.07345]]);
  assert.equal(spend.maxBuildCostUsd, 0.120331128);
  assert.equal(spend.overCeiling, 1);
});

// `run-mv4912r9-53b05a51`, as its snapshot recorded it: every part inside $0.10, the Flow not.
test("an older snapshot's parts are one Flow: a build and its repairs inside the ceiling each are over it together", () => {
  const liveLlm = { authorized: { maxTotalEstimatedCostUsd: 0.1 }, observed: { calls: 75, totalEstimatedCostUsd: 0.120331128, perBuild: { ...perBuild([]), ceilingUsd: 0.1, builds: [{ phase: "build", attempt: null, estimatedCostUsd: 0.04248, overCeiling: false }, { phase: "runtime", attempt: null, estimatedCostUsd: 0.00424, overCeiling: false }, { phase: "reauthor", attempt: 1, estimatedCostUsd: 0.0734, overCeiling: false }] } } };
  const spend = perBuildSpend(liveLlm, null);
  assert.equal(spend.ceilingUsd, 0.1);
  // The run's recorded total is larger than its parts (the chat call was in no part), and is the Flow's.
  assert.deepEqual(spend.builds, [{ phase: "flow", attempt: null, costUsd: 0.120331128, overCeiling: true }]);
  assert.equal(spend.parts.length, 3);
  assert.equal(spend.overCeiling, 1);
});

test("the Flow is the sum of its parts where the run recorded no total, and a Flow inside the ceiling is not flagged", () => {
  const over = perBuildSpend({ authorized: { maxTotalEstimatedCostUsd: CEILING }, observed: { perBuild: perBuild([entry("build", 0.2), entry("runtime", 0.2)]) } }, null);
  assert.equal(over.maxBuildCostUsd, 0.4);
  assert.equal(over.overCeiling, 1);
  const inside = perBuildSpend({ authorized: { maxTotalEstimatedCostUsd: CEILING }, observed: { perBuild: perBuild([entry("build", 0.1), entry("reauthor", 0.1, 1)]) } }, null);
  assert.deepEqual(inside.builds, [{ phase: "flow", attempt: null, costUsd: 0.2, overCeiling: false }]);
  assert.equal(inside.overCeiling, 0);
});

test("an older snapshot is judged as one Flow from its build accounting and its repair, against the plan's ceiling", () => {
  const liveLlm = {
    authorized: { maxTotalEstimatedCostUsd: CEILING },
    build: { accounting: { estimatedCostUsd: 0.11 } },
    observed: { calls: 30, observedCalls: [] },
    repair: { observed: { calls: 2, observedCalls: [{ estimatedCostUsd: 0.1 }, { estimatedCostUsd: 0.05 }] } },
  };
  const spend = perBuildSpend(liveLlm, null);
  assert.deepEqual(spend.parts.map((item) => [item.phase, item.costUsd]), [["build", 0.11], ["runtime", 0.15]]);
  assert.deepEqual(spend.builds, [{ phase: "flow", attempt: null, costUsd: 0.26, overCeiling: true }]);
  assert.equal(spend.overCeiling, 1);
});

test("the ceiling is the run's own, never one this module supplies: no record or no ceiling reads null", () => {
  assert.equal(perBuildSpend(null, null), null);
  assert.equal(perBuildSpend({ observed: { calls: 1, totalEstimatedCostUsd: 0.01 } }, null), null);
  const lowered = perBuildSpend({ authorized: { maxTotalEstimatedCostUsd: 0.05 }, observed: { calls: 3, totalEstimatedCostUsd: 0.06 } }, null);
  assert.equal(lowered.ceilingUsd, 0.05);
  assert.equal(lowered.overCeiling, 1);
});

test("a Flow whose cost was not recorded is counted as unrecorded, never as within the ceiling at zero", () => {
  const spend = perBuildSpend({ authorized: { maxTotalEstimatedCostUsd: CEILING }, build: { accounting: null }, observed: { calls: 0 } }, null);
  assert.deepEqual(spend.builds, [{ phase: "flow", attempt: null, costUsd: null, overCeiling: false }]);
  assert.deepEqual(spend.parts, [{ phase: "build", attempt: null, costUsd: null }]);
  assert.equal(spend.unrecorded, 1);
  assert.equal(spend.maxBuildCostUsd, null);
});

test("the campaign totals count every Flow over the ceiling across its rows", () => {
  const row = (overCeiling) => ({ verdict: "passed", succeeded: true, judgement: { passed: null }, buildOutcome: null, providerCalls: 1, reportedTokens: 1, reportedCostUsd: 0.1, perBuildSpend: overCeiling === null ? null : { overCeiling } });
  assert.equal(totalsOf([row(0), row(1), row(null)]).buildsOverCeiling, 1);
});
