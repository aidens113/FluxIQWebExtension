import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "../../dist/index.js";

const scenario = {
  schemaVersion: "0.1", id: "manual-demo", title: "Demonstration", tags: [], seed: 1, startPath: "/", capabilities: [], networkPolicy: "loopback-only",
  recordingDescription: "Shows opening a menu and reading its entries.",
  recordingScript: [{ id: "open", operation: "click", target: "#open" }], expected: {},
  workflows: [{ id: "inspect", description: "Read the item list.", recordingScript: [{ id: "open", operation: "click", target: "#open" }], expected: {} }]
};

test("explicit demonstration description survives workflow resolution without title or instruction fallback", () => {
  assert.equal(resolveScenarioWorkflow(scenario).recordingDescription, scenario.recordingDescription);
  assert.equal(resolveScenarioWorkflow(scenario, { workflowId: "inspect" }).recordingDescription, undefined);
  const described = { ...scenario, workflows: [{ ...scenario.workflows[0], recordingDescription: "Shows navigating the item list." }] };
  assert.equal(resolveScenarioWorkflow(described, { workflowId: "inspect" }).recordingDescription, "Shows navigating the item list.");
});

test("manifest validator recognizes explicit descriptions and rejects empty or oversized fields", () => {
  for (const value of ["", "   ", "x".repeat(4001), 7]) {
    const result = validateWebScenario({ ...scenario, recordingDescription: value });
    assert.equal(result.valid, false);
    if (!result.valid) assert.ok(result.issues.some(issue => issue.path === "$.recordingDescription"));
  }
  const result = validateWebScenario(scenario);
  if (!result.valid) assert.equal(result.issues.some(issue => issue.path.includes("recordingDescription")), false);
});
