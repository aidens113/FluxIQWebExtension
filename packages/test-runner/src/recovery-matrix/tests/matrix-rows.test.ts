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
  assert.deepEqual(selectRecoveryMatrixCases({ ready: true }).map(item => item.matrixCase.caseId), ["1", "13a", "13b", "13c"]);
  assert.deepEqual(selectRecoveryMatrixCases({ caseIds: ["4b"], rows: [13] }).map(item => item.matrixCase.caseId), ["4b", "13a", "13b", "13c"]);
  assert.throws(() => selectRecoveryMatrixCases({ caseIds: ["4z"] }), /no case 4z/);
  assert.throws(() => selectRecoveryMatrixCases({ rows: [12] }), /no row 12/);
  assert.throws(() => selectRecoveryMatrixCases({}), /selected no case/);
});

test("all fifteen deterministic browser cases carry explicit task text independent of titles", () => {
  assert.equal(cases.length, 15);
  for (const matrixCase of cases) {
    assert.equal(typeof matrixCase.taskInstructions, "string");
    assert.ok(matrixCase.taskInstructions.trim().length > 0);
    assert.ok(matrixCase.taskInstructions.trim().length <= 4000);
    assert.notEqual(matrixCase.taskInstructions, matrixCase.title);
    assert.notEqual(matrixCase.taskInstructions, matrixCase.flow);
    assert.notEqual(matrixCase.taskInstructions, `Recovery matrix ${matrixCase.caseId}: ${matrixCase.title}`.slice(0, 120));
  }
});

test("a re-acquire case names the saved steps by node key, judges by its own check, and expects no more re-acquired passes than passes", () => {
  const named = cases.filter(item => item.reacquire !== undefined);
  assert.deepEqual(named.map(item => item.caseId), ["13c"]);
  for (const item of named) {
    const spec = item.reacquire!;
    assert.equal(item.check, "row-reacquired");
    // Core keys a saved script's nodes by place (`s1`, `s2`, ...), not by the step labels the script wrote.
    assert.match(spec.step, /^s[1-9][0-9]*$/u);
    assert.match(spec.source, /^s[1-9][0-9]*$/u);
    assert.match((flows as Record<string, string>)[item.flow] ?? "", /^  repeat over: /mu);
    assert.ok(spec.reacquiredPasses >= 1 && spec.reacquiredPasses <= spec.passes);
  }
});
