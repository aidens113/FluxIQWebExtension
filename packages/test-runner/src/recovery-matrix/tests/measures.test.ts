import assert from "node:assert/strict";
import test from "node:test";
import type { MatrixCaseEvidence } from "../checks/index.js";
import { matrixCaseMeasures } from "../measures.js";
import type { MatrixAttemptRecord } from "../records/index.js";

const NODE = "node.bootstrap.0123456789abcdef.main";
const attempt = (step: string, status: string, retry = false): MatrixAttemptRecord => ({ order: 0, nodeId: `${NODE}.${step}`, definitionId: null, status, retry, failure: null, framePath: null, lifecycle: null, entry: null, stateRouting: null });

function evidence(attempts: MatrixAttemptRecord[], status: MatrixCaseEvidence["run"]["status"]): MatrixCaseEvidence {
  return {
    run: { status, failure: null, stopCode: null }, attempts,
    steps: [{ subflowKey: "main", nodeKey: "s9", definitionId: "builtin.control.end", lasting: false, endStatus: "failed" }],
    primarySubflowKey: "main", site: { held: true, reasons: [], duplicatedActs: 0, observed: {} }, goalHeld: null,
    model: { calls: 0, interventions: 0, harnessActivations: 0 }, faultFired: null,
  };
}

test("a retried step that then succeeded is an incident closed without a model, and no failure", () => {
  const measures = matrixCaseMeasures(evidence([attempt("s1", "failed"), attempt("s1", "succeeded", true), attempt("s2", "succeeded")], "succeeded"));
  assert.deepEqual({ incidents: measures.incidents, closed: measures.closedWithoutModel, rate: measures.deterministicRecoveryRate, retries: measures.retries, planned: measures.plannedFails, true: measures.trueFailures }, { incidents: 1, closed: 1, rate: 1, retries: 1, planned: 0, true: 0 });
});

test("a failed step the run moved on from is a planned fail; one the run ended on is a true failure, unless it is an authored End", () => {
  const planned = matrixCaseMeasures(evidence([attempt("s1", "failed"), attempt("s9", "failed")], "failed"));
  assert.equal(planned.incidents, 1);
  assert.equal(planned.plannedFails, 1);
  assert.equal(planned.trueFailures, 0);
  const stuck = matrixCaseMeasures(evidence([attempt("s1", "succeeded"), attempt("s2", "failed"), attempt("s2", "failed", true)], "failed"));
  assert.equal(stuck.trueFailures, 1);
  assert.equal(stuck.modelCallsPerTrueFailure, 0);
});
