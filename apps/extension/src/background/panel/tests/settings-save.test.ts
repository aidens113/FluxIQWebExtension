import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "../../../shared/browser";
import { AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY } from "fluxiq/automation-studio/nodes";
import { mergeSettings } from "../settings-save";

test("saving requests always stays OFF while ordinary switches still save", () => {
  for (const requested of [undefined, { requestsEnabled: true }, { requestsEnabled: "yes" }, { requestsEnabled: false }]) {
    assert.equal(mergeSettings({ ...defaultSettings(), requestsEnabled: true }, requested).requestsEnabled, false);
  }
  assert.equal(mergeSettings(defaultSettings(), { captureSnapshots: false }).captureSnapshots, false);
});

test("requests save ON only when Core's policy allows them and the save asked for them", () => {
  const allowing = { ...AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY, directRequests: { allowed: true } };
  assert.equal(mergeSettings(defaultSettings(), { requestsEnabled: true }, allowing).requestsEnabled, true);
  assert.equal(mergeSettings({ ...defaultSettings(), requestsEnabled: true }, {}, allowing).requestsEnabled, true);
  assert.equal(mergeSettings({ ...defaultSettings(), requestsEnabled: true }, { requestsEnabled: false }, allowing).requestsEnabled, false);
  assert.equal(mergeSettings(defaultSettings(), { requestsEnabled: "yes" }, allowing).requestsEnabled, false);
  assert.equal(mergeSettings(defaultSettings(), { requestsEnabled: true }, AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY).requestsEnabled, false);
});
