import assert from "node:assert/strict";
import test from "node:test";
import { MATRIX_CHECKS } from "../checks/index.js";
import * as flows from "../flows/index.js";
import { RECOVERY_MATRIX_ROWS } from "../matrix-rows.js";
import { isRealisticScenario } from "../../realistic-scenarios/index.js";
import { recoveryMatrixStatus, selectRecoveryMatrixCases } from "../run-recovery-matrix.js";

const cases = RECOVERY_MATRIX_ROWS.flatMap(row => row.cases);

test("the matrix has every row but the paid one, in order, each case once", () => {
  assert.deepEqual(RECOVERY_MATRIX_ROWS.map(row => row.row), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13]);
  assert.equal(new Set(cases.map(item => item.caseId)).size, cases.length);
  for (const row of RECOVERY_MATRIX_ROWS) for (const item of row.cases) assert.ok(item.caseId === String(row.row) || item.caseId.startsWith(String(row.row)) && /^[a-z]$/u.test(item.caseId.slice(String(row.row).length)), item.caseId);
});

test("every case opens a realistic scenario, names a Flow flows/ exports and a check that exists", () => {
  for (const item of cases) {
    assert.ok(isRealisticScenario(item.scenarioId), item.scenarioId);
    assert.equal(typeof (flows as Record<string, unknown>)[item.flow], "string", item.flow);
    assert.equal(typeof MATRIX_CHECKS[item.check], "function", item.check);
  }
});

test("a row is ready, pending on what it needs, or blocked by an authoring gap, and says how to run it", () => {
  const status = recoveryMatrixStatus();
  assert.deepEqual(status.filter(row => row.status === "ready").map(row => row.row), [1, 13]);
  assert.ok(status.filter(row => row.status === "pending").every(row => row.needs.length > 0));
  assert.ok(status.filter(row => row.status === "blocked").every(row => row.authoringGap !== null));
  assert.equal(status.find(row => row.row === 4)?.command, "pnpm lab recovery-matrix --row 4");
});

test("--ready selects only rows that need nothing and have no authoring gap; unknown cases and rows are refused", () => {
  assert.deepEqual(selectRecoveryMatrixCases({ ready: true }).map(item => item.matrixCase.caseId), ["1", "13a", "13b"]);
  assert.deepEqual(selectRecoveryMatrixCases({ caseIds: ["4b"], rows: [13] }).map(item => item.matrixCase.caseId), ["4b", "13a", "13b"]);
  assert.throws(() => selectRecoveryMatrixCases({ caseIds: ["4z"] }), /no case 4z/);
  assert.throws(() => selectRecoveryMatrixCases({ rows: [12] }), /no row 12/);
  assert.throws(() => selectRecoveryMatrixCases({}), /selected no case/);
});
