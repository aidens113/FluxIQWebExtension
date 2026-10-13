import assert from "node:assert/strict";
import test from "node:test";
import { repairLaneSummary } from "../lane-summary.js";

test("a run that applied and replayed nothing never reads as an applied repair, and says it does not count", () => {
  assert.equal(
    repairLaneSummary({ application: "no_proposal", adaptationGate: { counted: false, reason: "no_recovery_attempted" } }),
    "The repair lane ran and applied nothing; the run does not count toward the adaptation gate (no_recovery_attempted)",
  );
});

test("a proven repair says it was applied and replayed and counts", () => {
  assert.equal(repairLaneSummary({ application: "applied", adaptationGate: { counted: true, reason: "counted" } }), "The live repair was applied and replayed; the run counts toward the adaptation gate");
});

test("a failed judgement names the failure first", () => {
  assert.match(repairLaneSummary({ laneFailure: { category: "runtime.behavior", code: null }, application: null, adaptationGate: { counted: false, reason: "oracle_failed" } }), /^The created Flow's judgement failed.*\(oracle_failed\)$/u);
});
