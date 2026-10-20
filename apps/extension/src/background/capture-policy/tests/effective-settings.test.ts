import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY } from "fluxiq/automation-studio/nodes";
import type { FluxIQSettings } from "../../../shared/protocol";
import { effectiveSettings } from "../effective-settings";

const settings: FluxIQSettings = {
  gatewayUrl: "ws://127.0.0.1:4777/client",
  coreApiUrl: "http://127.0.0.1:3000",
  autoReconnect: true,
  captureMutations: true,
  captureInputValues: false,
  captureSnapshots: true,
  requestsEnabled: true
};

test("Core's default keeps every capture switch as the person set it and direct requests off", () => {
  assert.deepEqual(effectiveSettings(settings, AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY), { ...settings, requestsEnabled: false });
  const allOn = { ...settings, captureInputValues: true, requestsEnabled: false };
  assert.deepEqual(effectiveSettings(allOn, AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY), allOn);
});

test("a switch the policy forbids is off, and direct requests follow the person only where allowed", () => {
  const policy = {
    captureInputValues: { allowed: true, default: true },
    captureSnapshots: { allowed: false, default: true },
    captureMutations: { allowed: false, default: false },
    directRequests: { allowed: true }
  };
  assert.deepEqual(effectiveSettings(settings, policy), { ...settings, captureSnapshots: false, captureMutations: false, captureInputValues: false, requestsEnabled: true });
  assert.equal(effectiveSettings({ ...settings, requestsEnabled: false }, policy).requestsEnabled, false);
  assert.equal(settings.captureSnapshots, true, "the person's settings are not changed");
});
