import assert from "node:assert/strict";
import test from "node:test";
import { evidenceEvent } from "../evidence-event.js";

test("an event carries its trigger, its summary, and the run and scenario it belongs to", () => {
  const event = evidenceEvent("run-abc", "auth-gate", undefined, "runtime.settle", "Core persisted the completed recording");
  assert.equal(event.trigger, "runtime.settle");
  assert.equal(event.summary, "Core persisted the completed recording");
  assert.equal(event.correlation.runId, "run-abc");
  assert.equal(event.correlation.scenarioId, "auth-gate");
  assert.match(event.correlation.correlationId, /\S/u);
});

/**
 * A step's events are how a reader of `events.ndjson` follows one recording step
 * from start to complete; an event that belongs to no step must carry no `stepId`
 * key at all, because the difference between absent and `undefined` survives into
 * the persisted JSON a bundle is inspected from.
 */
test("a step's id is present only for an event that belongs to a step", () => {
  assert.equal("stepId" in evidenceEvent("run-abc", "auth-gate", "sign-in", "step.start", "Start click").correlation, true);
  assert.equal(evidenceEvent("run-abc", "auth-gate", "sign-in", "step.start", "Start click").correlation.stepId, "sign-in");
  assert.equal("stepId" in evidenceEvent("run-abc", "auth-gate", undefined, "final", "Scenario completed").correlation, false);
  assert.equal("stepId" in evidenceEvent("run-abc", "auth-gate", "", "final", "Scenario completed").correlation, false, "an empty id names no step");
});

test("the same summary published twice is two distinguishable events", () => {
  const first = evidenceEvent("run-abc", "auth-gate", undefined, "error", "the same failure");
  const second = evidenceEvent("run-abc", "auth-gate", undefined, "error", "the same failure");
  assert.notEqual(first.correlation.correlationId, second.correlation.correlationId);
});
