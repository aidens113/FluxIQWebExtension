import assert from "node:assert/strict";
import test from "node:test";
import { attempt, resultLine } from "../../tests/attempts.mjs";
import { renderSummaryMarkdown, totalsOf } from "../../summary/index.mjs";
import { CATALOG, REPAIRS } from "../../tests/tasks.mjs";
import { summarizeTask } from "../index.mjs";
import { replaySummary } from "../replay-summary.mjs";

// `--replays N` leaves `snapshots/repair-lane.json`, for a creation task as for a
// repair task: the created Flow's playback runs under a repair grant too. The row
// states whether the repair was applied and how many replays with no model met
// the goal, which is the created Flow's proof of deterministic reuse.
const replay = (index, fields = {}) => ({ index, outcome: "ran", runId: `run-${index}`, status: "succeeded", providerCalls: 0, harnessActivations: 0, modelCalled: false, goalPassed: true, flowSucceeded: true, ...fields });
const applied = (replays, extra = {}) => ({ task: "create-flow", purpose: "diagnose_and_adapt", adaptationIds: ["adaptation-1"], changeProposalIds: ["proposal-1"], application: { outcome: "applied", adaptations: [] }, replaysRequested: replays.length, replays, ...extra });

test("a lane whose repair was applied and replayed states how many replays with no model met the goal", () => {
  assert.equal(replaySummary(null), null, "a run given no --replays left no record");
  const declared = { verdict: "repaired", patchKind: "temporary_target_override", proposals: 1, mismatchedFields: [], refusalCodes: [] };
  assert.deepEqual(replaySummary(applied([replay(1), replay(2)], { declaredRepair: declared })), { application: "applied", declaredRepair: "repaired", replaysRequested: 2, replaysRan: 2, replaysPassed: 2, replayProviderCalls: 0 });
  // A replay that called the model, missed the goal, or could not run is not a pass, and its calls are counted.
  const mixed = replaySummary(applied([replay(1, { providerCalls: 2, modelCalled: true }), replay(2, { goalPassed: false }), replay(3, { outcome: "unreachable", status: "runtime.behavior", flowSucceeded: false, goalPassed: false })]));
  assert.deepEqual([mixed.replaysRan, mixed.replaysPassed, mixed.replayProviderCalls], [2, 0, 2]);
  assert.equal(replaySummary(applied([replay(1, { providerCalls: "many" })])).replayProviderCalls, null, "an unreadable count is not summed");
});

test("a declared repair the lane judged wrong is recorded as not attempted, with its verdict and nothing replayed", () => {
  const judgedWrong = { task: "create-flow", purpose: "diagnose_and_adapt", declaredRepair: { verdict: "wrong_target", mismatchedFields: ["accessibleName"] }, application: null, replaysRequested: 1, replays: [] };
  assert.deepEqual(replaySummary(judgedWrong), { application: "not_attempted", declaredRepair: "wrong_target", replaysRequested: 1, replaysRan: 0, replaysPassed: 0, replayProviderCalls: null });
  assert.equal(replaySummary({ ...judgedWrong, declaredRepair: { verdict: "made-up" } }).declaredRepair, null, "a verdict outside the closed set is dropped");
});

test("a creation row carries its repair lane, and a repair row counts its replays' calls", () => {
  const bundle = (repairLane) => ({ evaluation: { flowCreated: true, oracleVerdict: "passed", actions: [], extraction: [], llm: { mode: "live", calls: 9 } }, run: null, liveLlm: null, flowLane: null, repairLane });
  const created = summarizeTask(CATALOG[0], [{ attempt: 1, exitCode: 0, ramFault: null }], attempt({ stdout: resultLine({}) }), bundle(applied([replay(1)])));
  assert.deepEqual(created.repairLane, { application: "applied", declaredRepair: null, replaysRequested: 1, replaysRan: 1, replaysPassed: 1, replayProviderCalls: 0 });
  assert.equal(summarizeTask(CATALOG[0], [{ attempt: 1, exitCode: 0, ramFault: null }], attempt({ stdout: resultLine({}) }), bundle(null)).repairLane, null);
  const repaired = summarizeTask(REPAIRS[0], [{ attempt: 1, exitCode: 0, ramFault: null }], attempt({ stdout: resultLine({}) }), bundle({ ...applied([replay(1)]), task: "adapt" }));
  assert.equal(repaired.repair.replayProviderCalls, 0);
  const markdown = renderSummaryMarkdown({ campaignId: "c", startedAt: "t", finishedAt: "t", options: { profiles: { create: "p", repair: "q" }, provider: "deepseek", model: "deepseek-chat", maxAttempts: 1 }, totals: totalsOf([created]), tasks: [created] });
  assert.match(markdown, /\| Repair and replays \|/u);
  assert.match(markdown, /\| applied; 1 of 1 replay\(s\) passed, 0 call\(s\) \|/u);
});
