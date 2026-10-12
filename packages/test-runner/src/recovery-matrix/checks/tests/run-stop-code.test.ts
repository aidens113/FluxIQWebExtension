import assert from "node:assert/strict";
import test from "node:test";
import { MATRIX_CHECKS, matrixRunStopCode, type MatrixCaseEvidence } from "../index.js";
import { RECOVERY_MATRIX_ROWS } from "../../matrix-rows.js";

// t412: rows 9 and 11 read the run's own stop code from its run detail and match
// Core's closed code exactly; the failed attempt's timeout never says it.

const caseOf = (caseId: string) => RECOVERY_MATRIX_ROWS.flatMap(row => row.cases).find(item => item.caseId === caseId)!;
const timeout = { category: "timeout", code: "web.action.timeout" };

function stopped(stopCode: string | null): MatrixCaseEvidence {
  return {
    run: { status: "failed", failure: timeout, stopCode },
    attempts: [],
    steps: [],
    primarySubflowKey: "main",
    site: { held: true, reasons: [], duplicatedActs: 0, observed: {} },
    goalHeld: null,
    model: { calls: 0, interventions: 0, harnessActivations: 0 },
    faultFired: true,
  };
}

test("the run's stop code is read from the run detail's metadata, then its summary's", () => {
  assert.equal(matrixRunStopCode({ metadata: { stopCode: "run.outcome_uncertain" } }), "run.outcome_uncertain");
  assert.equal(matrixRunStopCode({ metadata: {}, summary: { metadata: { stopCode: "run.outcome_uncertain" } } }), "run.outcome_uncertain");
  assert.equal(matrixRunStopCode({ metadata: { terminalFailureReason: "Outcome uncertain: ..." } }), null);
  assert.equal(matrixRunStopCode({ metadata: { stopCode: "Outcome uncertain" } }), null);
  assert.equal(matrixRunStopCode(null), null);
});

test("row 9 passes a failed run only on the exact uncertain stop code, never the attempt's failure or a suffix", () => {
  const row9 = MATRIX_CHECKS["outcome-reconciled"];
  assert.equal(row9(stopped("run.outcome_uncertain"), caseOf("9")).verdict, "passed");
  assert.equal(row9(stopped("run.outcome_uncertain"), caseOf("9")).observed.stopCode, "run.outcome_uncertain");
  assert.match(row9(stopped(null), caseOf("9")).reasons.join(" "), /without an uncertain-outcome stop/);
  assert.equal(row9(stopped("web.outcome_uncertain"), caseOf("9")).verdict, "failed");
  assert.equal(row9({ ...stopped(null), run: { status: "failed", failure: { category: "ambiguous_or_unknown", code: "run.outcome_uncertain" }, stopCode: null } }, caseOf("9")).verdict, "failed");
});

test("row 11 reads the same stop code", () => {
  const row11 = RECOVERY_MATRIX_ROWS.flatMap(row => row.cases).find(item => item.check === "worker-restart");
  assert.ok(row11);
  assert.equal(MATRIX_CHECKS["worker-restart"]({ ...stopped("run.outcome_uncertain"), goalHeld: true }, row11).verdict, "passed");
  assert.equal(MATRIX_CHECKS["worker-restart"]({ ...stopped(null), goalHeld: true }, row11).verdict, "failed");
});
