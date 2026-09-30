// The manual actions table in the UI audit, section 4, one assertion per row.

import assert from "node:assert/strict";
import test from "node:test";
import { statusWith } from "../../tests/status-fixture";
import { recordControl } from "../record-control";

const connected = { connectionState: "connected" as const, paired: true, activeTabUrl: "https://shop.example.com/" };

test("connected on a recordable page with nothing running: Start recording is enabled", () => {
  assert.deepEqual(recordControl(statusWith(connected), false), { hidden: false, disabled: false });
});

test("recording: hidden, because Stop recording is in the recording bar", () => {
  assert.equal(recordControl(statusWith({ ...connected, recordingState: "recording" }), true).hidden, true);
});

test("not connected: disabled, saying so", () => {
  assert.deepEqual(recordControl(statusWith(), false), { hidden: false, disabled: true, reason: "Connect to FluxIQ to record." });
  assert.equal(recordControl(statusWith({ connectionState: "reconnecting" }), false).reason, "Connect to FluxIQ to record.");
});

test("unsupported page: disabled, saying so", () => {
  assert.deepEqual(recordControl(statusWith({ ...connected, unsupportedPage: { reason: "Browser pages can't be automated." } }), false), {
    hidden: false, disabled: true, reason: "FluxIQ can't record this page."
  });
});

test("FluxIQ is working: disabled until it finishes", () => {
  assert.deepEqual(recordControl(statusWith(connected), true), {
    hidden: false, disabled: true, reason: "Wait for FluxIQ to finish."
  });
});

test("the runtime reading a page is not working: only the held signal disables it", () => {
  assert.deepEqual(recordControl(statusWith({ ...connected, runtime: { state: "running" } }), false), {
    hidden: false, disabled: false
  });
});
