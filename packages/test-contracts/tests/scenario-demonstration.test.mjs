import assert from "node:assert/strict";
import test from "node:test";
import { validateScenarioDemonstration } from "../dist/index.js";

const context = { instruction: "Collect every hub.", expectedDatasetId: "extract-hubs", recordValues: ["Keelson Hub", "9,99 €"] };
const demo = {
  id: "d", scenarioId: "s", taskId: "t", description: "I search, try a sort, switch back, then read the list.",
  steps: [{ id: "sort", operation: "click", target: "x" }, { id: "unsort", operation: "click", target: "y" }, { id: "extract-hubs", operation: "extract", target: "z" }],
  detours: [{ stepIds: ["sort", "unsort"], why: "wrong sort", acts: [{ operation: "click", target: "Orders" }] }],
};
const issues = (value) => {
  const result = validateScenarioDemonstration(value, context);
  return result.valid ? [] : result.issues.map((entry) => `${entry.path} ${entry.message}`);
};

test("a well-formed demonstration validates", () => assert.deepEqual(issues(demo), []));
test("a description that is the instruction, names a record value, or is blank or long is refused", () => {
  assert.equal(issues({ ...demo, description: "Collect  every hub." }).length, 1);
  assert.equal(issues({ ...demo, description: "I read the Keelson Hub row" }).length, 1);
  assert.equal(issues({ ...demo, description: "  " }).length, 1);
  assert.equal(issues({ ...demo, description: "x".repeat(4001) }).length, 1);
});
test("detours must name existing steps and be undone before the first extract", () => {
  assert.equal(issues({ ...demo, detours: [{ ...demo.detours[0], stepIds: ["sort", "ghost"] }] }).length, 1);
  assert.equal(issues({ ...demo, detours: [{ ...demo.detours[0], stepIds: ["sort", "extract-hubs"] }] }).length, 1);
  assert.equal(issues({ ...demo, detours: [] }).length, 1);
});
test("the extract step id must equal the expected dataset id unless the demonstration conflicts", () => {
  const renamed = { ...demo, steps: demo.steps.map((s) => (s.operation === "extract" ? { ...s, id: "other" } : s)) };
  assert.equal(issues(renamed).length, 1);
  assert.deepEqual(issues({ ...renamed, conflictsWithInstruction: true }), []);
});
