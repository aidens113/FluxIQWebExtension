import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY } from "fluxiq/automation-studio/nodes";
import { requestsChoice } from "../requests-choice";

const allowing = { ...AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY, directRequests: { allowed: true } };

test("a save changes the stored request choice only where the policy allows direct requests", () => {
  assert.equal(requestsChoice(false, true, allowing), true);
  assert.equal(requestsChoice(true, false, allowing), false);
  assert.equal(requestsChoice(true, "yes", allowing), true, "a mistyped request keeps the stored choice");
  assert.equal(requestsChoice(true, false, AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY), true, "a forbidding policy never overwrites the choice");
  assert.equal(requestsChoice(false, true, AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY), false, "nor turns it on");
});
