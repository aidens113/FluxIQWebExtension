// The extraction entry's rows: when it can be pressed, and what it says.

import assert from "node:assert/strict";
import test from "node:test";
import { statusWith } from "../../tests/status-fixture";
import { extractControl } from "../extract-control";

const connected = { connectionState: "connected" as const, paired: true, activeTabUrl: "https://shop.example.com/" };

test("not connected: disabled, saying so", () => {
  assert.deepEqual(extractControl(statusWith()), { disabled: true, startsRecording: false, line: "Connect to FluxIQ to extract data." });
});

test("connected and idle: enabled, and pressing starts a recording first", () => {
  const control = extractControl(statusWith(connected));
  assert.equal(control.disabled, false);
  assert.equal(control.startsRecording, true);
});

test("recording: enabled, adding to the recording rather than starting one", () => {
  const control = extractControl(statusWith({ ...connected, recordingState: "recording" }));
  assert.deepEqual([control.disabled, control.startsRecording], [false, false]);
});

test("an unsupported page: disabled, saying so", () => {
  assert.equal(extractControl(statusWith({ ...connected, unsupportedPage: { reason: "x" } })).line, "FluxIQ can't read this page.");
});

test("a run is going and nothing is recording: wait for it", () => {
  const control = extractControl(statusWith({ ...connected, runtime: { state: "running" } }));
  assert.deepEqual([control.disabled, control.line], [true, "Wait for FluxIQ to finish."]);
});
