import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY } from "fluxiq/automation-studio/nodes";
import { readCapturePolicy } from "../read-capture-policy";

const strict = {
  captureInputValues: { allowed: false, default: false },
  captureSnapshots: { allowed: true, default: false },
  captureMutations: { allowed: true, default: true },
  directRequests: { allowed: true }
};

test("reads a well-formed policy, Core's default included, as a plain copy", () => {
  assert.deepEqual(readCapturePolicy(strict), strict);
  assert.deepEqual(readCapturePolicy(AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY), AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY);
  assert.deepEqual(readCapturePolicy({ ...strict, extra: 1 }), strict);
});

test("refuses anything missing a part or carrying a non-boolean", () => {
  for (const value of [undefined, null, "policy", [], {}, { ...strict, directRequests: {} }, { ...strict, directRequests: { allowed: "yes" } },
    { ...strict, captureSnapshots: { allowed: true } }, { ...strict, captureMutations: { allowed: 1, default: true } }, { ...strict, captureInputValues: null }]) {
    assert.equal(readCapturePolicy(value), undefined, JSON.stringify(value));
  }
});
