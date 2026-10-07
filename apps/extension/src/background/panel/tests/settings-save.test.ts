import assert from "node:assert/strict";
import test from "node:test";
import { defaultSettings } from "../../../shared/browser";
import { mergeSettings } from "../settings-save";

test("saving requests always stays OFF while ordinary switches still save", () => {
  for (const requested of [undefined, { requestsEnabled: true }, { requestsEnabled: "yes" }, { requestsEnabled: false }]) {
    assert.equal(mergeSettings({ ...defaultSettings(), requestsEnabled: true }, requested).requestsEnabled, false);
  }
  assert.equal(mergeSettings(defaultSettings(), { captureSnapshots: false }).captureSnapshots, false);
});
