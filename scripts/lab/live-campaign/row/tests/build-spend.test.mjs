import assert from "node:assert/strict";
import test from "node:test";
import { perBuildSpend } from "../index.mjs";
import { totalsOf } from "../../summary/index.mjs";

const CEILING = 0.25;
const perBuild = (builds) => ({ ceilingUsd: CEILING, builds, maxBuildCostUsd: Math.max(0, ...builds.map((item) => item.estimatedCostUsd)), overCeiling: builds.filter((item) => item.overCeiling).length });
const entry = (phase, estimatedCostUsd, attempt = null) => ({ phase, attempt, estimatedCostUsd, overCeiling: estimatedCostUsd > CEILING });

test("a build and its repair at $0.20 each are two builds inside the ceiling, though the row's total is $0.40", () => {
  const liveLlm = { authorized: { maxTotalEstimatedCostUsd: CEILING }, observed: { calls: 40, totalEstimatedCostUsd: 0.4, perBuild: perBuild([entry("build", 0.2), entry("runtime", 0.2)]) } };
  const spend = perBuildSpend(liveLlm, null);
  assert.equal(spend.ceilingUsd, CEILING);
  assert.deepEqual(spend.builds.map((item) => [item.phase, item.costUsd, item.overCeiling]), [["build", 0.2, false], ["runtime", 0.2, false]]);
  assert.equal(spend.maxBuildCostUsd, 0.2);
  assert.equal(spend.overCeiling, 0);
});

test("no campaign row reports a build above the ceiling without flagging it, and each re-author is a build of its own", () => {
  const liveLlm = { authorized: { maxTotalEstimatedCostUsd: CEILING }, observed: { perBuild: perBuild([entry("build", 0.26), entry("reauthor", 0.1, 1), entry("reauthor", 0.3, 2)]) } };
  const spend = perBuildSpend(liveLlm, null);
  assert.deepEqual(spend.builds.filter((item) => item.overCeiling).map((item) => [item.phase, item.attempt]), [["build", null], ["reauthor", 2]]);
  assert.equal(spend.overCeiling, 2);
  // Every build the row reports as within the ceiling is at or under it.
  for (const item of spend.builds) if (!item.overCeiling) assert.ok(item.costUsd <= spend.ceilingUsd);
});

test("an older snapshot is judged per build from its build accounting and its repair, against the plan's ceiling", () => {
  const liveLlm = {
    authorized: { maxTotalEstimatedCostUsd: CEILING },
    build: { accounting: { estimatedCostUsd: 0.21 } },
    observed: { calls: 30, observedCalls: [] },
    repair: { observed: { calls: 2, observedCalls: [{ estimatedCostUsd: 0.2 }, { estimatedCostUsd: 0.1 }] } },
  };
  const spend = perBuildSpend(liveLlm, null);
  assert.deepEqual(spend.builds.map((item) => [item.phase, item.costUsd, item.overCeiling]), [["build", 0.21, false], ["runtime", 0.3, true]]);
  assert.equal(spend.overCeiling, 1);
});

test("the ceiling is the run's own, never one this module supplies: no record or no ceiling reads null", () => {
  assert.equal(perBuildSpend(null, null), null);
  assert.equal(perBuildSpend({ observed: { calls: 1, totalEstimatedCostUsd: 0.01 } }, null), null);
  const lowered = perBuildSpend({ authorized: { maxTotalEstimatedCostUsd: 0.05 }, observed: { calls: 3, totalEstimatedCostUsd: 0.06 } }, null);
  assert.equal(lowered.ceilingUsd, 0.05);
  assert.equal(lowered.overCeiling, 1);
});

test("a build whose cost was not recorded is counted as unrecorded, never as within the ceiling at zero", () => {
  const spend = perBuildSpend({ authorized: { maxTotalEstimatedCostUsd: CEILING }, build: { accounting: null }, observed: { calls: 0 } }, null);
  assert.deepEqual(spend.builds, [{ phase: "build", attempt: null, costUsd: null, overCeiling: false }]);
  assert.equal(spend.unrecorded, 1);
  assert.equal(spend.maxBuildCostUsd, null);
});

test("the campaign totals count every build over the ceiling across its rows", () => {
  const row = (overCeiling) => ({ verdict: "passed", succeeded: true, judgement: { passed: null }, buildOutcome: null, providerCalls: 1, reportedTokens: 1, reportedCostUsd: 0.1, perBuildSpend: overCeiling === null ? null : { overCeiling } });
  assert.equal(totalsOf([row(0), row(2), row(null)]).buildsOverCeiling, 2);
});
