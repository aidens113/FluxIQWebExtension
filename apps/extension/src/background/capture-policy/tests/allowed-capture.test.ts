import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY } from "fluxiq/automation-studio/nodes";
import { allowedCapture } from "../allowed-capture";

test("only each switch's `allowed` reaches the panel", () => {
  assert.deepEqual(allowedCapture(AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY), { captureMutations: true, captureInputValues: true, captureSnapshots: true, directRequests: false });
  const policy = {
    captureInputValues: { allowed: false, default: true },
    captureSnapshots: { allowed: true, default: false },
    captureMutations: { allowed: false, default: false },
    directRequests: { allowed: true }
  };
  assert.deepEqual(allowedCapture(policy), { captureMutations: false, captureInputValues: false, captureSnapshots: true, directRequests: true });
});
