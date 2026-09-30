// The first-run checklist (plan 4.2): one assertion per row that matters.

import assert from "node:assert/strict";
import test from "node:test";
import { statusWith } from "../../tests/status-fixture";
import { setupSteps } from "../setup-steps";

const states = (status = statusWith(), key: "present" | "missing" | "unknown" = "unknown") => setupSteps(status, key).steps.map((step) => `${step.key}:${step.state}`);

test("a fresh browser: every step to do, and the checklist is open", () => {
  assert.deepEqual(states(), ["runtime:todo", "pair:todo", "model:check"]);
  assert.equal(setupSteps(statusWith(), "unknown").complete, false);
});

test("FluxIQ is not answering: the runtime step says to start it", () => {
  const runtime = setupSteps(statusWith({ connectionState: "error" }), "unknown").steps[0];
  assert.equal(runtime?.line, "FluxIQ isn't answering. Start it on this computer, then press Connect.");
});

test("a code is waiting for approval: FluxIQ is reached, the pairing step is under way", () => {
  assert.deepEqual(states(statusWith({ connectionState: "pairing" })), ["runtime:done", "pair:waiting", "model:check"]);
});

test("connected and approved with a key: complete", () => {
  const status = statusWith({ connectionState: "connected", paired: true });
  assert.deepEqual(states(status, "present"), ["runtime:done", "pair:done", "model:done"]);
  assert.equal(setupSteps(status, "present").complete, true);
});

test("connected and approved, key unknown: complete, because recordings and extraction need no key", () => {
  assert.equal(setupSteps(statusWith({ connectionState: "connected", paired: true }), "unknown").complete, true);
});

test("a missing key keeps the checklist open and says where to add one", () => {
  const result = setupSteps(statusWith({ connectionState: "connected", paired: true }), "missing");
  assert.equal(result.complete, false);
  assert.equal(result.steps[2]?.state, "todo");
});

test("paired before but disconnected now: approval is done, FluxIQ must be started", () => {
  assert.deepEqual(states(statusWith({ paired: true })), ["runtime:todo", "pair:done", "model:check"]);
});
