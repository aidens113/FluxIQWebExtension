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
  assert.deepEqual(initial, { submitted: false, submissionCount: 0, targetMode: "baseline", targetTransitionCount: 0, values: { name: "", plan: "starter" } });
  assert.deepEqual(instructionOnlyFormScenario.mutate(initial, "submit", { name: "", plan: "team" }), initial);
  const submitted = instructionOnlyFormScenario.mutate(initial, "submit", { name: "Ada", plan: "team" });
  assert.deepEqual(submitted, { submitted: true, submissionCount: 1, targetMode: "baseline", targetTransitionCount: 0, values: { name: "Ada", plan: "team" } });
});

test("instruction-only target drift changes one action identity while preserving the remaining flow", () => {
  const initial = instructionOnlyFormScenario.createState(113);
  const drifted = instructionOnlyFormScenario.mutate(initial, "introduce-target-drift", {});
  assert.deepEqual(drifted, { ...initial, targetMode: "drifted", targetTransitionCount: 1 });
  assert.deepEqual(instructionOnlyFormScenario.mutate(drifted, "introduce-target-drift", {}), drifted);

  const driftedHtml = instructionOnlyFormScenario.render(drifted, { runToken: "bounded-token", seed: 113 });
  assert.match(driftedHtml, /data-testid="instruction-name-adapted"/u);
  assert.doesNotMatch(driftedHtml, /data-testid="instruction-name"/u);
  assert.doesNotMatch(driftedHtml, /instruction-plan-adapted|instruction-submit-adapted/u);
  assert.match(driftedHtml, /data-testid="instruction-plan"/u);
  assert.match(driftedHtml, /data-testid="instruction-submit"/u);
  assert.match(driftedHtml, /<label>Name <textarea data-field="name"/u);
  assert.doesNotMatch(driftedHtml, /<input name="name"/u);
  assert.match(driftedHtml, /<label>Plan <select name="plan"/u);
  assert.match(driftedHtml, />Submit<\/button>/u);
  assert.match(driftedHtml, /data-testid="instruction-target-drift-status">Target mode: drifted/u);

  const submitted = instructionOnlyFormScenario.mutate(drifted, "submit", { name: "Ada", plan: "team" });
  assert.equal(submitted.submitted, true);
  assert.equal(submitted.submissionCount, 1);
  assert.deepEqual(submitted.values, { name: "Ada", plan: "team" });
  const reset = instructionOnlyFormScenario.mutate(submitted, "reset-target-drift", {});
  assert.deepEqual(reset, { ...submitted, targetMode: "baseline", targetTransitionCount: 2 });
  assert.deepEqual(instructionOnlyFormScenario.mutate(reset, "reset-target-drift", {}), reset);
});

test("instruction-only target drift renders bounded introduce, reset, and status controls", () => {
  const html = instructionOnlyFormScenario.render(instructionOnlyFormScenario.createState(113), { runToken: "bounded-token", seed: 113 });
  for (const testId of ["instruction-introduce-target-drift", "instruction-reset-target-drift", "instruction-target-drift-status"]) {
    assert.match(html, new RegExp(`data-testid="${testId}"`, "u"));
  }
  assert.match(html, /Target mode: baseline/u);
  assert.match(html, /transition\('introduce-target-drift'\)/u);
  assert.match(html, /transition\('reset-target-drift'\)/u);
});
