import assert from "node:assert/strict";
import test from "node:test";
import { llmTargetDriftScenario } from "./scenario.js";

test("target drift state is seeded, switchable, restorable, and repeatably inert while missing", () => {
  const baseline = llmTargetDriftScenario.createState(42);
  assert.deepEqual(baseline, {
    seedMarker: "target-drift-seed-42", mode: "baseline", activationCount: 0, transitionCount: 0, lastOperation: "seeded",
    oracle: { recordedTargetTestId: "diagnosis-target", renderedTargetTestId: "diagnosis-target", targetPresent: true, expectedResult: "Ready" },
  });
  const activated = llmTargetDriftScenario.mutate(baseline, "activate", {});
  assert.equal(activated.oracle.expectedResult, "Completed: 1");
  const missing = llmTargetDriftScenario.mutate(activated, "set-mode", { mode: "missing" });
  assert.deepEqual(missing, {
    seedMarker: "target-drift-seed-42", mode: "missing", activationCount: 0, transitionCount: 1, lastOperation: "missing",
    oracle: { recordedTargetTestId: "diagnosis-target", renderedTargetTestId: null, targetPresent: false, expectedResult: "Target missing: deterministic failure armed" },
  });
  assert.deepEqual(llmTargetDriftScenario.mutate(missing, "activate", {}), missing);
  assert.deepEqual(llmTargetDriftScenario.mutate(missing, "activate", {}), missing);
  const renamed = llmTargetDriftScenario.mutate(missing, "set-mode", { mode: "renamed" });
  assert.equal(renamed.oracle.renderedTargetTestId, "diagnosis-target-v2");
  const restored = llmTargetDriftScenario.mutate(renamed, "restore", {});
  assert.match(restored.seedMarker, /42$/);
  assert.equal(restored.mode, "baseline");
  assert.equal(restored.activationCount, 0);
  assert.equal(restored.oracle.expectedResult, "Ready");
});

test("target drift manifest records only the stable baseline action and declares loopback evidence", () => {
  const manifest = llmTargetDriftScenario.manifest;
  assert.equal(manifest.networkPolicy, "loopback-only");
  assert.deepEqual(manifest.recordingScript, [
    { id: "activate-recorded-target", operation: "click", target: "testid:diagnosis-target" },
    { id: "baseline-completed", operation: "checkpoint" },
  ]);
  assert.deepEqual(manifest.expected.actions, [{ action: "web.dom.click", outcome: "succeeded" }]);
  assert.deepEqual(manifest.expected.finalState, [{ id: "baseline-completed", subject: "result", predicate: "text", value: "Completed: 1" }]);
  assert.equal(manifest.evidencePolicy?.reviewRequired, true);
});