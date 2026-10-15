import assert from "node:assert/strict";
import test from "node:test";
import { adaptationGateLaneFailure, classifyAdaptationGate, type AdaptationGateInput } from "../gate.js";

/**
 * Whether a `--replays` run counts toward the adaptation gate (plan, "Gate
 * oracle"): only a run whose drift forced a recovery (P2), whose repair was
 * applied and moved the Flow's steps (P4), and whose in-run replays ran with a
 * known 0 provider calls and held (P5). Everything else is named, never passed
 * quietly.
 */

const replay = { outcome: "ran" as const, providerCalls: 0 as number | null, harnessActivations: 0, modelCalled: false, goalPassed: true, flowSucceeded: true, datasetsReproduced: null as boolean | null };
const counted: AdaptationGateInput = {
  laneFailure: null,
  recovery: { attempted: true },
  unkeptReauthor: false,
  application: { outcome: "applied", flow: { change: "changed" } },
  replays: [replay],
};

test("an attempted recovery, an applied repair that moved the steps, and a known-zero replay that held counts", () => {
  assert.deepEqual(classifyAdaptationGate(counted), { counted: true, reason: "counted" });
  assert.deepEqual(classifyAdaptationGate({ ...counted, application: { outcome: "applied", flow: { change: "changed_in_run" } } }), { counted: true, reason: "counted" });
});

test("a drift absorbed or never met -- nothing proposed and no recovery attempted -- does not count", () => {
  assert.deepEqual(classifyAdaptationGate({ ...counted, recovery: { attempted: false }, application: { outcome: "no_proposal" }, replays: [] }), { counted: false, reason: "no_recovery_attempted" });
  assert.deepEqual(classifyAdaptationGate({ ...counted, application: { outcome: "no_proposal" }, replays: [] }), { counted: false, reason: "no_proposal" });
});

test("a failed oracle does not count, whatever else the run did", () => {
  assert.deepEqual(classifyAdaptationGate({ ...counted, laneFailure: "oracle_failed" }), { counted: false, reason: "oracle_failed" });
  assert.deepEqual(classifyAdaptationGate({ ...counted, laneFailure: "oracle_failed", application: null, replays: [] }), { counted: false, reason: "oracle_failed" });
});

// run-mv9v3u68-6efbd7ae (A8 wave 15): the oracle passed and the record still said `oracle_failed`.
test("a failed judgement is named for what failed, and oracle_failed only when the oracle did", () => {
  assert.equal(adaptationGateLaneFailure({ oracleVerdict: "failed", reportedVerdict: "failed" }), "oracle_failed");
  assert.equal(adaptationGateLaneFailure({ oracleVerdict: "passed", reportedVerdict: "failed" }), "flow_reported_failure");
  assert.equal(adaptationGateLaneFailure({ oracleVerdict: "passed", reportedVerdict: "passed" }), "judgement_failed");
  assert.equal(adaptationGateLaneFailure(undefined), "judgement_failed", "nothing observed is never read as a failed oracle");
  assert.deepEqual(classifyAdaptationGate({ ...counted, laneFailure: "flow_reported_failure", application: null, replays: [] }), { counted: false, reason: "flow_reported_failure" });
});

test("a repair that was not kept, not applied, or did not move the steps does not count", () => {
  assert.equal(classifyAdaptationGate({ ...counted, unkeptReauthor: true, application: null }).reason, "reauthor_not_kept");
  assert.equal(classifyAdaptationGate({ ...counted, application: { outcome: "not_applied" }, replays: [] }).reason, "not_applied");
  assert.equal(classifyAdaptationGate({ ...counted, application: { outcome: "applied", flow: { change: "unchanged" } } }).reason, "steps_unchanged");
  assert.equal(classifyAdaptationGate({ ...counted, application: { outcome: "applied", flow: { change: "unseen_in_run" } } }).reason, "steps_unchanged");
  assert.equal(classifyAdaptationGate({ ...counted, application: { outcome: "applied" } }).reason, "steps_unchanged");
});

test("an applied repair is counted only with its recovery attempted, which a re-author Core applied in the run also is", () => {
  assert.equal(classifyAdaptationGate({ ...counted, recovery: { attempted: false } }).reason, "no_recovery_attempted");
  assert.deepEqual(classifyAdaptationGate({ ...counted, recovery: { attempted: false, resultReauthor: { applied: true } } }), { counted: true, reason: "counted" });
});

test("no replay, a replay with unknown or nonzero calls, and a replay that did not hold do not count", () => {
  assert.equal(classifyAdaptationGate({ ...counted, replays: [] }).reason, "no_replay");
  assert.equal(classifyAdaptationGate({ ...counted, replays: [{ ...replay, providerCalls: null }] }).reason, "replay_not_model_free");
  assert.equal(classifyAdaptationGate({ ...counted, replays: [{ ...replay, providerCalls: 2, modelCalled: true }] }).reason, "replay_not_model_free");
  assert.equal(classifyAdaptationGate({ ...counted, replays: [{ ...replay, harnessActivations: 1 }] }).reason, "replay_not_model_free");
  assert.equal(classifyAdaptationGate({ ...counted, replays: [{ ...replay, outcome: "unreachable" }] }).reason, "replay_not_model_free");
  assert.equal(classifyAdaptationGate({ ...counted, replays: [replay, { ...replay, goalPassed: false }] }).reason, "replay_failed");
  assert.equal(classifyAdaptationGate({ ...counted, replays: [{ ...replay, flowSucceeded: false }] }).reason, "replay_failed");
  assert.equal(classifyAdaptationGate({ ...counted, replays: [{ ...replay, datasetsReproduced: false }] }).reason, "replay_failed");
});
