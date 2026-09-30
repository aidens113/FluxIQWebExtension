// The suite's composition and verdict with its journeys replaced: which
// journeys run, what is `not_built` or `not_run` and why, that a failure keeps
// only its closed code, that the restart journey gets the Flows the earlier
// journeys saved, and the launcher's exit code.

import assert from "node:assert/strict";
import test from "node:test";
import type { DemoWorkspaceConfiguration } from "../../demo-workspace/index.js";
import { RunnerFailure } from "../../failure.js";
import type { ExtractionJourneyResult, FailurePresentationJourneyResult, FirstRunJourneyResult, RestartReuseJourneyResult, SavedJourneyFlow } from "../journeys/index.js";
import { runUiE2eSuite, type UiE2eJourneyDrivers } from "../suite.js";
import { foldUiE2eSuite, uiE2eExitCode } from "../suite-outcome.js";

const config = {} as DemoWorkspaceConfiguration;
const savedExtraction = { label: "extraction", judge: { kind: "dataset", sha256: "a".repeat(64), records: 3 } } as unknown as SavedJourneyFlow;
const savedFailure = { label: "failure", judge: { kind: "final_state" } } as unknown as SavedJourneyFlow;

const extraction = {
  journey: "extraction", status: "verified", scenarioId: "product-catalog",
  ids: { projectId: "p1", flowId: "f1", subflowId: "s1", graphFlowId: "g1", recordingId: "r1", runId: "run1", datasetId: "d1" },
  picker: { proposedFields: 3, includedFields: 3, excludedFields: 0, previewRows: 3, keptFields: 3, renamedFields: 0, removedFields: 0, proposedItems: 3, capturedRecords: 3 },
  run: { actionAttempts: 1, providerCalls: 0, interventions: 0 },
  judgement: { expectedRecords: 3, observedRecords: 3, matchedRecords: 3, matchedInAnyOrder: 3, expectedFields: 3, presentFields: 3, unexpectedFields: 0, nonStringValues: 0, storeTruncated: false, invalidCount: 0, fieldCount: 3, sha256: "a".repeat(64) },
  panel: { storedDatasets: 1, previewRows: 3, previewFields: 3, csvBytes: 90, jsonBytes: 120, jsonRows: 3 },
  saved: savedExtraction,
  checkpoints: [{ stage: "records-judged", elapsedMs: 40 }],
} as ExtractionJourneyResult;

const failure = {
  journey: "failure_presentation", status: "verified", task: "missing-target",
  ids: { projectId: "p2", flowId: "f2", recordingId: "r2", runId: "run2" },
  run: { actionAttempts: 2, failedAttempts: 1, failureCategory: "target", failureCode: "target.missing", providerCalls: 0 },
  presentation: { actionLogShown: true, statusBadge: "failed", statusMetric: "failed", attemptRows: 2, failedAttemptRows: 1, terminalReasonShown: true, terminalReasonCode: "target_missing" },
  oracleReached: false, saved: savedFailure, checkpoints: [],
} as FailurePresentationJourneyResult;

const restart = {
  journey: "restart_reuse", status: "verified",
  stop: { webPortClosed: true, gatewayPortClosed: true, waitedMs: 300, probes: 2 },
  flows: [{ label: "extraction", foundInHierarchy: true, identitiesUnchanged: true, runId: "run3", actionAttempts: 1, providerCalls: 0, oracle: "passed", dataset: { records: 3, sha256Equal: true, expectedRecords: 3, matchedRecords: 3 } }],
  checkpoints: [{ stage: "ports-closed", elapsedMs: 5 }],
} as RestartReuseJourneyResult;

const firstRun = {
  journey: "first_run", status: "verified",
  ids: { projectId: "p0", flowId: "f0", recordingId: "r0", runId: "run0" },
  activity: { providerCalls: 0, accountedCalls: 0, interventions: 0, adaptations: 0, changeProposals: 0 },
  runtimeDebug: { code: "runtime_debug.verified", core: { status: "succeeded", actionCount: 2, attemptCount: 2 }, runRow: { present: true, status: "succeeded", actionCount: 2 }, reopenedLog: { present: true, namesRun: true, status: "succeeded", metricStatus: "succeeded", actionCount: 2, attemptRows: 2, attemptRowsMatch: true }, durationMs: 900 },
  checkpoints: [{ stage: "runtime-debug-verified", elapsedMs: 70 }],
} as FirstRunJourneyResult;

function drivers(overrides: Partial<UiE2eJourneyDrivers> = {}, calls: string[] = [], restartFlows: SavedJourneyFlow[][] = []): UiE2eJourneyDrivers {
  return {
    firstRun: async () => { calls.push("F1"); return firstRun; },
    extraction: async () => { calls.push("F2"); return extraction; },
    failurePresentation: async () => { calls.push("F3"); return failure; },
    restartReuse: async (_config, flows) => { calls.push("F4"); restartFlows.push([...flows]); return restart; },
    ...overrides,
  };
}

test("the default lane runs F1-F4 in order, hands F4 both saved Flows, and reports every provider journey unselected", async () => {
  const calls: string[] = [];
  const restartFlows: SavedJourneyFlow[][] = [];
  const result = await runUiE2eSuite({ lane: "provider-free", journeys: [], config, drivers: drivers({}, calls, restartFlows) });
  assert.deepEqual(calls, ["F1", "F2", "F3", "F4"]);
  assert.deepEqual(restartFlows, [[savedExtraction, savedFailure]]);
  const byId = Object.fromEntries(result.journeys.map(journey => [journey.id, journey]));
  for (const id of ["F1", "F2", "F3", "F4"]) assert.equal(byId[id]!.status, "verified", id);
  assert.deepEqual([byId.F1!.ids.runId, byId.F1!.counts.actionLogAttemptRowsMatch, byId.F1!.timings["runtime-debug-verified"]], ["run0", true, 70]);
  for (const id of ["P1", "P2", "P3", "P4", "P5", "P6"]) assert.deepEqual([byId[id]!.selected, byId[id]!.status, byId[id]!.reasonCode], [false, "not_run", "provider_lane_not_selected"], id);
  assert.equal(byId.F2!.counts.matchedRecords, 3);
  assert.equal(byId.F2!.ids.datasetId, "d1");
  assert.equal(byId.F2!.timings["records-judged"], 40);
  assert.equal(byId.F4!.counts.extractionSha256Equal, true);
  assert.deepEqual({ status: result.status, selected: result.selected, verified: result.verified, notBuilt: result.notBuilt }, { status: "passed", selected: 4, verified: 4, notBuilt: 0 });
  assert.equal(uiE2eExitCode(result), 0);
});

test("only the named journeys run, and the suite passes when all of them verify", async () => {
  const calls: string[] = [];
  const result = await runUiE2eSuite({ lane: "provider-free", journeys: ["F2"], config, drivers: drivers({}, calls) });
  assert.deepEqual(calls, ["F2"]);
  assert.equal(result.status, "passed");
  assert.equal(uiE2eExitCode(result), 0);
  assert.equal(result.journeys.find(journey => journey.id === "F3")!.reasonCode, "journey_not_selected");
});

test("a failed journey keeps its category and closed code, not its message, and F4 does not run without its Flows", async () => {
  const calls: string[] = [];
  const result = await runUiE2eSuite({
    lane: "provider-free", journeys: ["F4"], config,
    drivers: drivers({ extraction: async () => { throw new RunnerFailure("runtime.behavior", "page said: secret row text", { details: { reasonCode: "extraction.item_count" } }); } }, calls),
  });
  const byId = Object.fromEntries(result.journeys.map(journey => [journey.id, journey]));
  assert.deepEqual([byId.F2!.status, byId.F2!.reasonCode, byId.F2!.failureCategory], ["failed", "extraction.item_count", "runtime.behavior"]);
  assert.equal(JSON.stringify(result).includes("secret row text"), false);
  assert.deepEqual([byId.F4!.status, byId.F4!.reasonCode], ["not_run", "prerequisite_not_verified"]);
  assert.deepEqual(calls, ["F3"]);
  assert.equal(uiE2eExitCode(result), 2);
});

test("an error without a closed code is reported as journey.failed", async () => {
  const result = await runUiE2eSuite({ lane: "provider-free", journeys: ["F3"], config, drivers: drivers({ failurePresentation: async () => { throw new Error("Timeout 30000ms exceeded waiting for text 'Hello'"); } }) });
  const f3 = result.journeys.find(journey => journey.id === "F3")!;
  assert.deepEqual([f3.status, f3.reasonCode, f3.failureCategory], ["failed", "journey.failed", "unknown"]);
});

test("the provider lane calls no driver: P6 is not_built and P1-P5 are not wired", async () => {
  const calls: string[] = [];
  const result = await runUiE2eSuite({ lane: "provider", journeys: [], config, drivers: drivers({}, calls) });
  assert.deepEqual(calls, []);
  const byId = Object.fromEntries(result.journeys.map(journey => [journey.id, journey]));
  assert.deepEqual([byId.P6!.status, byId.P6!.reasonCode], ["not_built", "product_ui_not_built"]);
  for (const id of ["P1", "P2", "P3", "P4", "P5"]) assert.deepEqual([byId[id]!.selected, byId[id]!.status, byId[id]!.reasonCode], [true, "not_run", "journey_not_wired"], id);
  assert.equal(result.status, "failed");
});

test("a provider journey named without the provider lane is selected, not run, and fails the suite", async () => {
  const result = await runUiE2eSuite({ lane: "provider-free", journeys: ["P6"], config, drivers: drivers() });
  const p6 = result.journeys.find(journey => journey.id === "P6")!;
  assert.deepEqual([p6.selected, p6.status, p6.reasonCode], [true, "not_run", "provider_lane_not_selected"]);
  assert.equal(result.status, "failed");
});

test("a run that selects nothing does not pass", () => {
  assert.equal(foldUiE2eSuite("provider-free", [], 0).status, "failed");
});
