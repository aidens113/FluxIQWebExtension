import assert from "node:assert/strict";
import test from "node:test";
import { portableActionability } from "../portable";

test("measured reports project only a boolean and closed cause, leaving the report unchanged", () => {
  const positive = { actionable: true, point: { x: 10, y: 20 }, detail: "local target" } as const;
  assert.deepEqual(portableActionability(positive), { actionable: true });
  for (const code of ["hidden", "disabled", "covered"] as const) {
    const report = { actionable: false, code, point: { x: 10, y: 20 }, detail: "local layer" } as const;
    const before = structuredClone(report);
    assert.deepEqual(portableActionability(report), { actionable: false, cause: code });
    assert.deepEqual(report, before);
  }
});
