// A case whose fault names the act it strikes by target (`onTargetSelector`)
// strikes nothing when the Flow's step says its selector any other way: the
// relay compares the selector Core sends exactly. So each such target must be
// a `selector:` line of the case's own Flow, character for character, and the
// step must declare a lasting consequence, since the relay only strikes a
// committing act and the row is about one.

import assert from "node:assert/strict";
import test from "node:test";
import { RECOVERY_MATRIX_ROWS } from "../../matrix-rows.js";
import * as flows from "../index.js";

const scripts = flows as Readonly<Record<string, string>>;

test("every fault named by target is a step selector of its case's Flow, on a step with a lasting consequence", () => {
  const named = RECOVERY_MATRIX_ROWS.flatMap(row => row.cases).flatMap(matrixCase => matrixCase.perturbation?.kind === "drop-action-result" && "onTargetSelector" in matrixCase.perturbation ? [{ matrixCase, selector: matrixCase.perturbation.onTargetSelector }] : []);
  assert.ok(named.length > 0, "row 9 names its act by target");
  for (const { matrixCase, selector } of named) {
    const lines = (scripts[matrixCase.flow] ?? "").split("\n");
    const at = lines.findIndex(line => line.trim() === `selector: ${selector}`);
    assert.ok(at >= 0, `case ${matrixCase.caseId}: no step of ${matrixCase.flow} has selector ${selector}`);
    assert.equal(lines.filter(line => line.trim() === `selector: ${selector}`).length, 1, `case ${matrixCase.caseId}: the selector is on more than one step`);
    const step = lines.slice(at + 1).findIndex(line => /^\s*step\b/u.test(line));
    const body = lines.slice(at, step < 0 ? undefined : at + 1 + step);
    assert.ok(body.some(line => /consequences:\s*(?!none\b)\S/u.test(line)), `case ${matrixCase.caseId}: the named step declares no lasting consequence`);
  }
});
