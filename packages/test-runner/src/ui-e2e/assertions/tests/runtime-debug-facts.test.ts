// What the Runtime Debug readings mean against Core. Statuses are closed, the
// run is named by the Action Log hero's first segment and nothing else, attempt
// rows must match Core's attempts in run order, and each failed check maps to
// exactly one code, in the order a reader would trust the view.

import assert from "node:assert/strict";
import test from "node:test";
import type { ExistingRunAction, ExistingRunSummary } from "../../../existing-fluxiq-control.js";
import {
  type ActionLogReading,
  actionLogFacts,
  actionLogMatches,
  closedRuntimeStatus,
  type RefreshFacts,
  runRowFacts,
  RUNTIME_DEBUG_CODES,
  runtimeDebugCoreRun,
  runtimeDebugVerdict,
} from "../runtime-debug-facts.js";

const RUN_ID = "6ba1eedc-2a91-4ac3-b234-e7235bad7ff3";

function attempt(order: number, nodeId: string, status: ExistingRunAction["status"] = "succeeded"): ExistingRunAction {
  return { attemptId: `attempt-${order}`, nodeId, definitionId: "builtin.policy.action", order, status, startedAt: order };
}

const summary: ExistingRunSummary = { runId: RUN_ID, projectId: "project", flowId: "flow", status: "succeeded", routeDecisionCount: 1, subflowEntryCount: 1, actionAttemptCount: 3, updatedAt: 1 };
const core = runtimeDebugCoreRun({ summary, actionAttempts: [attempt(3, "submit"), attempt(1, "name"), attempt(2, "plan")] });

function log(overrides: Partial<ActionLogReading> = {}): ActionLogReading {
  return {
    present: true,
    heroLine: `${RUN_ID} | flow:flow | 3 actions | 1.2s`,
    badge: "succeeded",
    metrics: [["Status", "succeeded"], ["Actions", "3"], ["LLM Calls", "0"]],
    rows: [{ nodeId: "name", status: "succeeded" }, { nodeId: "plan", status: "succeeded" }, { nodeId: "submit", status: "succeeded" }],
    ...overrides,
  };
}

const refresh: RefreshFacts = { documentReplaced: false, mainFrameNavigations: 3, responseObserved: true, logNamedRunBeforeResponse: true, probeFailures: 0 };
const matchingRow = runRowFacts({ index: 0, badge: "succeeded", activity: "3 actions · 0 effects" });

test("a status outside the closed runtime set reads as unknown, never as page text", () => {
  assert.equal(closedRuntimeStatus("Succeeded "), "succeeded");
  assert.equal(closedRuntimeStatus("failed"), "failed");
  assert.equal(closedRuntimeStatus("Submitted: Ada / team"), "unknown");
  assert.equal(closedRuntimeStatus(undefined), "unknown");
});

test("Core's attempts are compared in run order", () => {
  assert.deepEqual(core.attempts.map(item => item.nodeId), ["name", "plan", "submit"]);
  assert.equal(core.actionCount, 3);
});

test("an Action Log that shows Core's run matches, whatever else its metrics hold", () => {
  const facts = actionLogFacts(log(), core);
  assert.deepEqual(facts, { present: true, namesRun: true, status: "succeeded", metricStatus: "succeeded", actionCount: 3, attemptRows: 3, attemptRowsMatch: true });
  assert.equal(actionLogMatches(facts, core), true);
});

test("the run is named only by the hero's first segment", () => {
  assert.equal(actionLogFacts(log({ heroLine: `Loading ${RUN_ID}...` }), core).namesRun, false);
  assert.equal(actionLogFacts(log({ heroLine: `other-run | flow:${RUN_ID} | 3 actions` }), core).namesRun, false);
});

test("attempt rows out of order, with another status, or missing do not match", () => {
  const rows = log().rows;
  assert.equal(actionLogFacts(log({ rows: [rows[1]!, rows[0]!, rows[2]!] }), core).attemptRowsMatch, false);
  assert.equal(actionLogFacts(log({ rows: [rows[0]!, rows[1]!, { nodeId: "submit", status: "failed" }] }), core).attemptRowsMatch, false);
  assert.equal(actionLogFacts(log({ rows: rows.slice(0, 2) }), core).attemptRowsMatch, false);
});

test("a run row's action count is read from its activity cell, and a missing row is absent", () => {
  assert.deepEqual(matchingRow, { present: true, status: "succeeded", actionCount: 3 });
  assert.deepEqual(runRowFacts({ index: 2, badge: "failed", activity: "1 action · 0 effects" }), { present: true, status: "failed", actionCount: 1 });
  assert.deepEqual(runRowFacts({ index: -1, badge: "succeeded", activity: "3 actions" }), { present: false, status: "unknown", actionCount: 3 });
});

test("a view that matches Core everywhere is verified", () => {
  const facts = actionLogFacts(log(), core);
  assert.equal(runtimeDebugVerdict({ core, refresh, inPlaceLog: facts, runRow: matchingRow, reopenedLog: facts }), "runtime_debug.verified");
  assert.equal(runtimeDebugVerdict({ core, runRow: matchingRow, reopenedLog: facts }), "runtime_debug.verified");
});

test("same-document navigations alone are not a reload; a replaced document is", () => {
  const facts = actionLogFacts(log(), core);
  assert.equal(runtimeDebugVerdict({ core, refresh: { ...refresh, mainFrameNavigations: 9 }, inPlaceLog: facts, runRow: matchingRow, reopenedLog: facts }), "runtime_debug.verified");
  assert.equal(runtimeDebugVerdict({ core, refresh: { ...refresh, documentReplaced: true }, inPlaceLog: facts, runRow: matchingRow, reopenedLog: facts }), "runtime_debug.reloaded");
});

test("each failed check maps to its own code, first failure first", () => {
  const good = actionLogFacts(log(), core);
  const verdict = (input: Partial<Parameters<typeof runtimeDebugVerdict>[0]>) => runtimeDebugVerdict({ core, refresh, inPlaceLog: good, runRow: matchingRow, reopenedLog: good, ...input });
  const cases: Array<[string, Partial<Parameters<typeof runtimeDebugVerdict>[0]>]> = [
    ["runtime_debug.core_not_terminal", { core: { ...core, status: "running" } }],
    ["runtime_debug.log_opened_after_response", { refresh: { ...refresh, logNamedRunBeforeResponse: false } }],
    ["runtime_debug.not_refreshed_in_place", { inPlaceLog: actionLogFacts(log({ badge: "running" }), core) }],
    ["runtime_debug.run_row_missing", { runRow: runRowFacts({ index: -1, badge: "", activity: "" }) }],
    ["runtime_debug.run_row_status_mismatch", { runRow: { ...matchingRow, status: "failed" } }],
    ["runtime_debug.run_row_action_count_mismatch", { runRow: { ...matchingRow, actionCount: 2 } }],
    ["runtime_debug.log_missing", { reopenedLog: actionLogFacts(log({ present: false }), core) }],
    ["runtime_debug.log_run_mismatch", { reopenedLog: actionLogFacts(log({ heroLine: "other | flow:flow" }), core) }],
    ["runtime_debug.log_status_mismatch", { reopenedLog: actionLogFacts(log({ metrics: [["Status", "failed"], ["Actions", "3"]] }), core) }],
    ["runtime_debug.log_action_count_mismatch", { reopenedLog: actionLogFacts(log({ metrics: [["Status", "succeeded"], ["Actions", "4"]] }), core) }],
    ["runtime_debug.attempt_rows_mismatch", { reopenedLog: actionLogFacts(log({ rows: log().rows.slice(1) }), core) }],
  ];
  for (const [code, input] of cases) assert.equal(verdict(input), code, code);
  assert.deepEqual(new Set(cases.map(([code]) => code)), new Set(RUNTIME_DEBUG_CODES.filter(code => code !== "runtime_debug.verified" && code !== "runtime_debug.reloaded")));
});
