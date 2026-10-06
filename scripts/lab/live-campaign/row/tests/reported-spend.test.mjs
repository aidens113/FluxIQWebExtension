import assert from "node:assert/strict";
import test from "node:test";
import { reportedSpend } from "../reported-spend.mjs";

// A created Flow's build keeps its totals in `build.accounting`; the repair its
// playback ran under keeps a per-call record beside it as `repair.observed`.
// The row sums the two, and says so, only when the repair called a provider.
const accounting = { provider: "deepseek", model: "deepseek-flash", inputTokens: 57117, outputTokens: 1436, totalTokens: 58553, estimatedCostUsd: 0.027027 };
const build = { accounting };
const repairCalls = [{ totalTokens: 6000, estimatedCostUsd: 0.0031 }, { inputTokens: 2000, outputTokens: 400, estimatedCostUsd: 0.0012 }];

test("a created Flow's row adds a repair that called a provider, and says build+repair", () => {
  assert.deepEqual(reportedSpend({ build, repair: { observed: { calls: 2, observedCalls: repairCalls } } }, null), {
    source: "build+repair", tokens: 58553 + 6000 + 2400, costUsd: 0.031327, callsWithoutReportedTokens: 0,
  });
});

test("a repair that spent nothing leaves the row exactly as a row without one", () => {
  const withoutRepair = reportedSpend({ build }, null);
  assert.deepEqual(withoutRepair, { source: "build", tokens: 58553, costUsd: 0.027027, callsWithoutReportedTokens: null });
  for (const [name, repair] of Object.entries({
    "refused before diagnosis": { observed: { calls: 0, observedCalls: [] } },
    "run detail unreadable": { observed: null, settlement: "run_detail_unreadable" },
    "no repair record": undefined,
  })) {
    assert.deepEqual(reportedSpend({ build, ...(repair === undefined ? {} : { repair }) }, null), withoutRepair, name);
  }
});

test("a repair whose calls report no figure makes the sum unknown, never a partial total", () => {
  assert.deepEqual(reportedSpend({ build, repair: { observed: { calls: 3, observedCalls: [], perCallRecords: "not recorded" } } }, null), {
    source: "build+repair", tokens: null, costUsd: null, callsWithoutReportedTokens: 0,
  });
});

test("a Flow run's per-call spend and an absent record read as before", () => {
  assert.deepEqual(reportedSpend({ observed: { calls: 2, observedCalls: repairCalls } }, null), { source: "per-call", tokens: 8400, costUsd: 0.0043, callsWithoutReportedTokens: 0 });
  assert.deepEqual(reportedSpend({ observed: { calls: 0, observedCalls: [] } }, null), { source: "no calls", tokens: 0, costUsd: 0, callsWithoutReportedTokens: 0 });
  assert.deepEqual(reportedSpend(null, null), { source: null, tokens: null, costUsd: null, callsWithoutReportedTokens: 0 });
});

// `run-musq0b1m-0472cfa0`: the row reported the build's $0.211519044 while the
// run spent $0.212718924 -- the chat's own call is in no build record. The run's
// whole spend (`live-llm.json` `runSpend`) is what the row reports when it is there.
test("a row reports the run's whole spend, the chat's call included, when the run recorded it", () => {
  const proBuild = { accounting: { provider: "deepseek", model: "deepseek-v4-pro", inputTokens: 571116, outputTokens: 4059, totalTokens: 575175, estimatedCostUsd: 0.211519044 } };
  const runSpend = { calls: 31, totalEstimatedCostUsd: 0.212718924, phases: { build: { calls: 27, estimatedCostUsd: 0.203830792 }, chat: { calls: 1, estimatedCostUsd: 0.00119988 } } };
  assert.deepEqual(reportedSpend({ build: proBuild, runSpend }, null), { source: "run", tokens: 575175, costUsd: 0.212718924, callsWithoutReportedTokens: null });
  // A Flow run's per-call record, and a repair beside a build, are both inside the run's spend too.
  assert.equal(reportedSpend({ observed: { calls: 2, observedCalls: repairCalls }, runSpend: { totalEstimatedCostUsd: 0.0051 } }, null).costUsd, 0.0051);
  assert.equal(reportedSpend({ build, repair: { observed: { calls: 2, observedCalls: repairCalls } }, runSpend: { totalEstimatedCostUsd: 0.0316 } }, null).costUsd, 0.0316);
  // A record without one reads as before.
  assert.equal(reportedSpend({ build, runSpend: null }, null).costUsd, 0.027027);
});
