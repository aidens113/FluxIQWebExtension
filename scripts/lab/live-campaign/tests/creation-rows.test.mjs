// A creation task's summary row read from a created Flow's build, and how the summary renders it.

import assert from "node:assert/strict";
import test from "node:test";
import { renderSummaryMarkdown, summarizeTask } from "../index.mjs";
import { attempt, resultLine } from "./attempts.mjs";
import { CATALOG } from "./tasks.mjs";

test("a creation row reads the build's reported totals and the created Flow's nodes, and never shows a missing figure as zero", () => {
  // Shaped like run-mu4t20d1-93b60760: Core itemizes no build call, so the totals are the build's.
  const build = (accounting, failure = null) => ({ adaptationId: "adaptation.bootstrap.1", providerCalls: 1, providerInvocation: "attempted", accounting, evidenceLoop: { decisionCount: 1, toolCallCount: 1, evidenceBytes: 2087, toolIds: ["web.inspect_current_page"], steps: null }, recoveredAfterTimeout: false, durationMs: 7607, outcome: failure ? "failed" : "proposed", failure });
  const accounting = { provider: "deepseek", model: "deepseek-chat", inputTokens: 3924, outputTokens: 465, totalTokens: 4389, estimatedCostUsd: 0.00234036 };
  const flowShape = { nodeCount: 5, actionNodeCount: 3, actionTypes: { "web.dom.type": 1, "web.dom.click": 2, "Press the Save button": 1, "(unrecognized)": 1 }, extractNodes: 0, navigationNodes: 0 };
  const bundle = (buildRecord, observed = { calls: 1, observedCalls: [], perCallRecords: "not recorded", accounting: { calls: 1, totalTokens: 999999, estimatedCostUsd: 9.99 } }) => ({
    evaluation: { flowCreated: true, oracleVerdict: "passed", actions: [{ actionType: "builtin.control.start" }, { actionType: "web.dom.type" }], extraction: [], llm: { mode: "live", calls: 1 } },
    run: null,
    liveLlm: { observed, build: buildRecord },
    flowLane: { lane: "created-flow", build: buildRecord, flowId: "flow.1", flowShape, failure: null },
  });
  const row = (b) => summarizeTask(CATALOG[0], [{ attempt: 1, exitCode: 0, ramFault: null }], attempt({ stdout: resultLine({}) }), b);

  const built = row(bundle(build(accounting)));
  assert.deepEqual([built.spendSource, built.reportedTokens, built.reportedCostUsd, built.callsWithoutReportedTokens], ["build", 4389, 0.00234036, null], "the build's totals, not the run accounting");
  assert.deepEqual(built.createdFlowShape, { nodeCount: 5, actionNodeCount: 3, nodeTypes: { "(unrecognized)": 1, "web.dom.click": 2, "web.dom.type": 1 }, extractNodes: 0, navigationNodes: 0 }, "a name that is not output-shaped is dropped");
  const summed = row(bundle(build({ ...accounting, totalTokens: null })));
  assert.equal(summed.reportedTokens, 4389, "input plus output when Core gave no total");
  const fromFlowLane = row({ ...bundle(build(accounting)), liveLlm: null });
  assert.deepEqual([fromFlowLane.spendSource, fromFlowLane.reportedTokens], ["build", 4389], "the Flow-lane snapshot carries the same build record");

  // A build Core refused before a provider answered: no totals, and that is "not recorded", not zero.
  const refused = row(bundle(build(null, { code: "flow_bootstrap.provider_refused", stage: "gather", httpStatus: 422 })));
  assert.deepEqual([refused.spendSource, refused.reportedTokens, refused.reportedCostUsd], ["not recorded", null, null]);
  assert.ok(refused.issueCodes.includes("flow_bootstrap.provider_refused"));
  const unitemized = row({ ...bundle(null), liveLlm: { observed: { calls: 2, observedCalls: [], perCallRecords: "not recorded" } } });
  assert.deepEqual([unitemized.spendSource, unitemized.reportedTokens], ["not recorded", null]);
  const noCalls = row({ ...bundle(null), liveLlm: { observed: { calls: 0, observedCalls: [], perCallRecords: "recorded" } } });
  assert.deepEqual([noCalls.spendSource, noCalls.reportedTokens, noCalls.reportedCostUsd], ["no calls", 0, 0]);
  assert.equal(row({ evaluation: null, run: null, liveLlm: null, flowLane: null }).spendSource, null);

  const summary = { campaignId: "c", startedAt: "s", finishedAt: "f", options: { profiles: { create: "lab-create-flow", repair: "lab-adapt-repair" }, provider: "deepseek", model: "deepseek-chat", maxAttempts: 3 }, totals: { tasks: 2, passed: 2, succeeded: 2, failed: 0, noResult: 0, judgementsPassed: 2, providerCalls: 2, reportedTokens: 4389, reportedCostUsd: 0.00234036 }, tasks: [built, refused] };
  const markdown = renderSummaryMarkdown(summary);
  // A build Core kept no declarations for reads "not recorded": a Core that published none, never a build that declared nothing.
  assert.match(markdown, /\| proposed \| yes \| 5 nodes: \(unrecognized\) ×1, web\.dom\.click ×2, web\.dom\.type ×1 \| not recorded \| builtin\.control\.start, web\.dom\.type \| playback goal \| yes \| — \| 1 \| 4389 \| 0\.00234036 \|/u);
  assert.match(markdown, /\| playback goal \| yes \| — \| 1 \| not recorded \| not recorded \|/u);
  assert.doesNotMatch(markdown, /Press the Save button/u);
});
