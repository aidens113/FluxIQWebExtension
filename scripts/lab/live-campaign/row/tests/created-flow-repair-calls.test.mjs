import assert from "node:assert/strict";
import test from "node:test";
import { attempt, resultLine } from "../../tests/attempts.mjs";
import { CATALOG } from "../../tests/tasks.mjs";
import { summarizeTask } from "../index.mjs";

// A created Flow's playback may run under a repair grant. Its provider calls are
// recorded beside the build's in `snapshots/live-llm.json`, and the row counts
// both, from the same record its tokens and dollars come from, so the three
// figures describe the same spend. Shaped like run-mu7fas8b-66a630b1: six
// build calls, then a repair of six.
const build = { adaptationId: "adaptation.bootstrap.1", providerCalls: 6, providerInvocation: "attempted", accounting: { provider: "deepseek", model: "deepseek-flash", inputTokens: 57117, outputTokens: 1436, totalTokens: 58553, estimatedCostUsd: 0.0270204 }, evidenceLoop: { decisionCount: 6, toolCallCount: 4, evidenceBytes: 22121, toolIds: ["web.inspect_current_page"], steps: null }, recoveredAfterTimeout: false, durationMs: 80590, outcome: "proposed", failure: null };
const repairCalls = [{ totalTokens: 4797, estimatedCostUsd: 0.00244948 }, { totalTokens: 3939, estimatedCostUsd: 0.00180532 }, { totalTokens: 4199, estimatedCostUsd: 0.00191972 }, { totalTokens: 4337, estimatedCostUsd: 0.00199188 }, { totalTokens: 4822, estimatedCostUsd: 0.002398 }, { totalTokens: 7986, estimatedCostUsd: 0.00362032 }];
const bundle = (repair) => ({
  evaluation: { flowCreated: true, oracleVerdict: "failed", actions: [], extraction: [], llm: { mode: "live", calls: 6 + (repair?.observed?.calls ?? 0) } },
  run: null,
  liveLlm: { observed: { calls: 6, observedCalls: [], perCallRecords: "not recorded" }, build, ...(repair ? { repair } : {}) },
  flowLane: { lane: "created-flow", build, flowId: "flow.1", flowShape: { nodeCount: 1, actionNodeCount: 1, actionTypes: {}, extractNodes: 0, navigationNodes: 0 }, failure: null },
});
const row = (b) => summarizeTask(CATALOG[0], [{ attempt: 1, exitCode: 1, ramFault: null }], attempt({ stdout: resultLine({}) }), b);

test("a created Flow's row counts the repair's provider calls with the build's, as it counts their tokens and dollars", () => {
  const repaired = row(bundle({ purpose: "explore_and_adapt", observed: { calls: 6, observedCalls: repairCalls } }));
  assert.deepEqual([repaired.providerCalls, repaired.spendSource, repaired.reportedCostUsd], [12, "build+repair", 0.04120512]);
});

test("a repair that called nothing, or none at all, leaves the call count at the build's", () => {
  assert.equal(row(bundle({ purpose: "explore_and_adapt", observed: { calls: 0, observedCalls: [] } })).providerCalls, 6);
  assert.equal(row(bundle(undefined)).providerCalls, 6);
  assert.equal(row({ ...bundle(undefined), liveLlm: null }).providerCalls, 6, "the evaluation's count, which already holds both, when no live-llm record was left");
});
