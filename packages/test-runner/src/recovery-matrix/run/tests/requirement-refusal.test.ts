import assert from "node:assert/strict";
import test from "node:test";
import { requirementRefusal } from "../requirement-refusal.js";

const REFUSED = new Error("FluxIQ control request failed: /api/programs/automation-studio/run-runtime-session (400): This automation needs handlers for interruptions, which this version of FluxIQ doesn't offer yet. Update FluxIQ and run it again.");

test("the gate refusing a Flow that declared requirements is read as such", () => {
  assert.match(requirementRefusal(REFUSED, ["flow.handlers@1"], false) ?? "", /^run-runtime-session \(400\): This automation needs handlers/);
});

test("a run that ran, a Flow that declared nothing, or another failure is not a requirement refusal", () => {
  assert.equal(requirementRefusal(REFUSED, ["flow.handlers@1"], true), undefined);
  assert.equal(requirementRefusal(REFUSED, [], false), undefined);
  assert.equal(requirementRefusal(new Error("FluxIQ control request failed: /api/programs/automation-studio/run-runtime-session (500): boom"), ["flow.handlers@1"], false), undefined);
});
