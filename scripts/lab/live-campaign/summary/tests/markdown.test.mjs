import assert from "node:assert/strict";
import test from "node:test";
import { renderSummaryMarkdown, totalsOf } from "../index.mjs";

const creation = (taskId, verdict, fields = {}) => ({
  taskId, scenarioId: "bigbox-retail", variantId: null, kind: "form", runId: `run-${taskId}`, verdict, buildOutcome: null, flowCreated: verdict === "passed",
  createdFlowShape: null, consequences: null, actionTypes: [], judgeBy: "goal", expectedDatasetId: null, judgement: { passed: null }, repairLane: null,
  providerCalls: 0, reportedTokens: 0, reportedCostUsd: 0, spendSource: "provider", failureCategory: null, runnerMessage: null, automationFailure: null,
  declaredFailure: null, issueCodes: [], attempts: 1, ramFaults: [], repeatedFailure: null, succeeded: verdict === "passed", ...fields,
});
const summaryOf = (tasks, totals = totalsOf(tasks)) => ({
  campaignId: "c", startedAt: "2026-09-30T00:00:00.000Z", finishedAt: null,
  options: { profiles: { create: "p", repair: "p" }, provider: "deepseek", model: "m", maxAttempts: 1 }, totals, tasks,
});

test("the headline counts a permission stop on its own, never as a pass", () => {
  const markdown = renderSummaryMarkdown(summaryOf([
    creation("pickup-order", "passed"),
    creation("pickup-order-2", "stopped_for_permission", { buildOutcome: "permission_required", runnerMessage: "stopped for permission to purchase (control matched); no Flow was built, so this is not a pass" }),
    creation("pickup-order-3", "failed"),
  ]));
  assert.match(markdown, /\*\*1 of 3 runs passed\*\* \(1 failed, 1 stopped for permission and built no Flow, 0 produced no result\)/u);
  assert.match(markdown, /\| pickup-order-2 \| bigbox-retail \| form \| run-pickup-order-2 \| stopped_for_permission \| permission_required \| no \|[^\n]*no Flow was built, so this is not a pass/u);
});

test("a summary written before the stop count existed renders it as zero", () => {
  const { stoppedForPermission, ...older } = totalsOf([creation("a", "passed")]);
  assert.equal(stoppedForPermission, 0);
  assert.match(renderSummaryMarkdown(summaryOf([creation("a", "passed")], older)), /\(0 failed, 0 stopped for permission and built no Flow, 0 produced no result\)/u);
});
