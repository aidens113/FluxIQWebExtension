import assert from "node:assert/strict";
import test from "node:test";
import { instructionOnlyFormScenario } from "./scenario.js";

test("instruction-only form has a deterministic submit oracle without a recording script", () => {
  const manifest = instructionOnlyFormScenario.manifest;
  assert.equal(manifest.networkPolicy, "loopback-only");
  assert.deepEqual(manifest.recordingScript, []);
  assert.match(manifest.playbackGoal?.description ?? "", /Enter Ada[\s\S]*Team[\s\S]*submit/u);
  assert.deepEqual(manifest.expected.finalState, [{ id: "instruction-only-submitted", subject: "result", predicate: "text", value: "Submitted: Ada / team" }]);
  assert.equal(manifest.evidencePolicy?.screenshots, "events");
  assert.equal(manifest.evidencePolicy?.sampleFps, 0);
});

test("instruction-only form mutation is bounded and repeatable", () => {
  const initial = instructionOnlyFormScenario.createState(113);
  assert.deepEqual(initial, { submitted: false, submissionCount: 0, values: { name: "", plan: "starter" } });
  assert.deepEqual(instructionOnlyFormScenario.mutate(initial, "submit", { name: "", plan: "team" }), initial);
  const submitted = instructionOnlyFormScenario.mutate(initial, "submit", { name: "Ada", plan: "team" });
  assert.deepEqual(submitted, { submitted: true, submissionCount: 1, values: { name: "Ada", plan: "team" } });
});
