import assert from "node:assert/strict";
import test from "node:test";
import { MATRIX_CHECKS } from "../checks/index.js";
import { MATRIX_SIGNED_EFFECTS } from "../effects/index.js";
import * as flows from "../flows/index.js";
import { RECOVERY_MATRIX_ROWS } from "../matrix-rows.js";
import { isRealisticScenario } from "../../realistic-scenarios/index.js";
import { recoveryMatrixStatus, selectRecoveryMatrixCases } from "../run-recovery-matrix.js";

const cases = RECOVERY_MATRIX_ROWS.flatMap(row => row.cases);

test("the matrix has every row but the paid one, in order, each case once", () => {
  assert.deepEqual(RECOVERY_MATRIX_ROWS.map(row => row.row), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15]);
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
  assert.deepEqual(status.filter(row => row.status === "ready").map(row => row.row), [1, 13, 14, 15]);
  assert.ok(status.filter(row => row.status === "pending").every(row => row.needs.length > 0));
  assert.ok(status.filter(row => row.status === "blocked").every(row => row.authoringGap !== null));
  assert.equal(status.find(row => row.row === 4)?.command, "pnpm lab recovery-matrix --row 4");
});

test("--ready selects only rows that need nothing and have no authoring gap; unknown cases and rows are refused", () => {
  assert.deepEqual(selectRecoveryMatrixCases({ ready: true }).map(item => item.matrixCase.caseId), ["1", "13a", "13b", "13c", "14", "14b", "15"]);
  assert.deepEqual(selectRecoveryMatrixCases({ caseIds: ["4b"], rows: [13] }).map(item => item.matrixCase.caseId), ["4b", "13a", "13b", "13c"]);
  assert.throws(() => selectRecoveryMatrixCases({ caseIds: ["4z"] }), /no case 4z/);
  assert.throws(() => selectRecoveryMatrixCases({ rows: [12] }), /no row 12/);
  assert.throws(() => selectRecoveryMatrixCases({}), /selected no case/);
});

test("all eighteen deterministic browser cases carry explicit task text independent of titles", () => {
  assert.equal(cases.length, 18);
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

test("a person-cleared case names its steps by place, ends on the Flow's last step, and judges by its own check (t972)", () => {
  const named = cases.filter(item => item.personCleared !== undefined);
  assert.deepEqual(named.map(item => item.caseId), ["15"]);
  for (const item of named) {
    assert.equal(item.check, "person-cleared-resume");
    const steps = item.personCleared!.steps;
    assert.ok(steps.length >= 2, "a check met mid-Flow and one at the last step");
    for (const step of steps) assert.match(step, /^s[1-9][0-9]*$/u);
    // The last cleared step is the script's last step: the shape live run `run-mwoq9g4l-dbd69bd6` ended failed on.
    // Core keys nodes by place and puts a merge after each optional step (matrix run rmx-2026-11-20T10-04-51-026Z-2f5801).
    const script = (flows as Record<string, string>)[item.flow] ?? "";
    const nodes = script.split("\n").filter(line => /^step\b/u.test(line)).length + script.split("\n").filter(line => /^  optional: yes$/u.test(line)).length;
    assert.equal(steps.at(-1), `s${nodes}`);
    assert.ok(Number(steps[0]!.slice(1)) < nodes);
    assert.deepEqual(item.site, { kind: "crossborder-checks-passed", checksPassed: steps.length });
  }
});

test("case 14b saves case 14's Flow with a signed effect on its search, and the effect is one the bot check does not show", () => {
  const plain = cases.find(item => item.caseId === "14")!;
  const signed = cases.find(item => item.caseId === "14b")!;
  assert.equal(plain.routeEffects, undefined);
  assert.deepEqual({ flow: signed.flow, variantId: signed.variantId, check: signed.check }, { flow: plain.flow, variantId: plain.variantId, check: plain.check });
  assert.deepEqual(signed.routeEffects, { s1: "HOOD_SEARCH_EFFECT" });
  const effect = MATRIX_SIGNED_EFFECTS[signed.routeEffects!.s1!]!;
  // The shape t1083 signs for a step that moved: its start and its destination, so a page on neither is "between".
  assert.equal(effect.v, "web-effect.v1");
  assert.equal(typeof effect.path, "string");
  assert.equal(typeof effect.from, "string");
  assert.notEqual(effect.from, effect.path);
});
