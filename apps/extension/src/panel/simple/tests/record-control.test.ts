// The manual actions table in the UI audit, section 4, one assertion per row.

import assert from "node:assert/strict";
import test from "node:test";
import { recordControl } from "../record-control";
import { statusWith } from "./status-fixture";

const connected = { connectionState: "connected" as const, paired: true, activeTabUrl: "https://shop.example.com/" };

test("connected on a recordable page with nothing running: Start recording is enabled", () => {
  assert.deepEqual(recordControl(statusWith(connected)), { hidden: false, disabled: false });
});

test("recording: hidden, because Stop recording is in the now card", () => {
  assert.equal(recordControl(statusWith({ ...connected, recordingState: "recording" })).hidden, true);
});

test("not connected: disabled, saying so", () => {
  assert.deepEqual(recordControl(statusWith()), { hidden: false, disabled: true, reason: "Connect to FluxIQ to record." });
  assert.equal(recordControl(statusWith({ connectionState: "reconnecting" })).reason, "Connect to FluxIQ to record.");
});

test("unsupported page: disabled, saying so", () => {
  assert.deepEqual(recordControl(statusWith({ ...connected, unsupportedPage: { reason: "Browser pages can't be automated." } })), {
    hidden: false, disabled: true, reason: "FluxIQ can't record this page."
  });
});

test("a run is going: disabled until FluxIQ finishes", () => {
  assert.deepEqual(recordControl(statusWith({ ...connected, runtime: { state: "running", actionType: "web.dom.click" } })), {
    hidden: false, disabled: true, reason: "Wait for FluxIQ to finish."
  });
});
