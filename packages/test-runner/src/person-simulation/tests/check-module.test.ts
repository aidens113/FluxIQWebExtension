import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { expectedPersonHandOff } from "../expected-hand-off.js";
import { loadPersonChecks, parsePersonChecks } from "../check-module.js";
import { TYPED_CHECK } from "./fake-person.js";

test("a well-formed module is kept, answer and tampered included", () => {
  const parsed = parsePersonChecks(TYPED_CHECK, "everything-store");
  assert.deepEqual(parsed.checks, TYPED_CHECK.checks);
  assert.equal(parsed.answer?.({ image: 2 }), "CODE-2");
  assert.equal(parsed.tampered?.({ wrong: 0 }), null);
});

test("a malformed module refuses the run as fixture.invalid, naming the field and quoting no value", () => {
  const malformed: Array<[unknown, RegExp]> = [
    [{ ...TYPED_CHECK, scenarioId: "other" }, /PERSON_CHECKS\.scenarioId/u],
    [{ ...TYPED_CHECK, checks: [] }, /PERSON_CHECKS\.checks must be a non-empty array/u],
    [{ ...TYPED_CHECK, answer: undefined }, /PERSON_CHECKS\.answer is required by a type-answer step/u],
    [{ ...TYPED_CHECK, checks: [{ ...TYPED_CHECK.checks[0]!, steps: [{ action: "reload" }] }] }, /steps\[0\]\.action/u],
    [{ ...TYPED_CHECK, checks: [{ ...TYPED_CHECK.checks[0]!, clears: "eventually" }] }, /clears must be navigation or in-place/u],
    [{ ...TYPED_CHECK, handOffs: [{ person: "shrugs", required: true, because: "a sentence long enough to say why" }] }, /handOffs\[0\]\.person/u],
  ];
  for (const [value, message] of malformed) {
    assert.throws(() => parsePersonChecks(value, "everything-store"), (error: unknown) => (error as { category?: string }).category === "fixture.invalid" && message.test((error as Error).message));
  }
});

test("the module is loaded from the scenario lab build beside its fixture, and a scenario without one has none", async (t) => {
  const dist = mkdtempSync(path.join(tmpdir(), "fluxiq-person-module-"));
  t.after(() => rmSync(dist, { recursive: true, force: true }));
  mkdirSync(path.join(dist, "scenarios", "crossborder-marketplace"), { recursive: true });
  writeFileSync(path.join(dist, "scenarios", "crossborder-marketplace", "person-check.js"), `export const PERSON_CHECKS = ${JSON.stringify({ scenarioId: "crossborder-marketplace", checks: [{ id: "traffic-screen", description: "press the box", shows: "I'm not a robot", steps: [{ action: "click", text: "I'm not a robot" }], clears: "navigation", clearsWithinMs: 10000 }], handOffs: [] })};\n`);
  assert.equal((await loadPersonChecks(dist, "crossborder-marketplace"))?.checks[0]?.id, "traffic-screen");
  assert.equal(await loadPersonChecks(dist, "job-board"), null);
});

test("the expected hand-off is the task's own, else the row's exactly, else none", () => {
  const task = { person: "completes" as const, required: false, because: "The filters are the third results load, which the screen replaces." };
  assert.deepEqual(expectedPersonHandOff({ module: TYPED_CHECK, workflowId: "first-page-earbuds", variantId: "robot-check", task }), task);
  assert.equal(expectedPersonHandOff({ module: TYPED_CHECK, workflowId: "first-page-earbuds", variantId: "robot-check" })?.required, true);
  assert.equal(expectedPersonHandOff({ module: TYPED_CHECK, workflowId: "first-page-earbuds", variantId: undefined }), null, "a variant's declaration never leaks onto its unarmed workflow");
  assert.equal(expectedPersonHandOff({ module: null, workflowId: undefined, variantId: undefined }), null);
});
