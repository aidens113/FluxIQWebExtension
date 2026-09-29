// The "Right now" table in the UI audit, section 4, one assertion per row,
// and which row wins when several hold.

import assert from "node:assert/strict";
import test from "node:test";
import type { RuntimeCommandStatus } from "../../../shared/protocol";
import { DONE_WINDOW_MS, nowCopy } from "../now-copy";
import { statusWith } from "./status-fixture";

const NOW = 1_800_000_000_000;
const connected = { connectionState: "connected" as const, paired: true, activeTabUrl: "https://shop.example.com/cart" };

function runtime(overrides: Partial<RuntimeCommandStatus>): RuntimeCommandStatus {
  return { state: "running", actionType: "web.dom.click", target: "#submit > button.primary", targetName: "Search", ...overrides };
}

test("nothing running, nothing recording", () => {
  assert.deepEqual(nowCopy(statusWith(connected), NOW), {
    kind: "idle", title: "Nothing running", detail: "Ask FluxIQ below, or record the steps yourself.", recordingDot: false, details: false
  });
});

test("recording: mm:ss, the step count and the hostname, with the red dot", () => {
  const recording = statusWith({ ...connected, recordingState: "recording", recordingStartedAt: NOW - 83_000, eventCount: 4 });
  assert.deepEqual(nowCopy(recording, NOW), {
    kind: "recording", title: "Recording your steps", detail: "01:23 · 4 steps on shop.example.com", recordingDot: true, details: false
  });
  const one = statusWith({ ...connected, activeTabUrl: undefined, recordingState: "recording", recordingStartedAt: NOW, eventCount: 1 });
  assert.equal(nowCopy(one, NOW).detail, "00:00 · 1 step");
});

test("running: the present-tense step, never the selector", () => {
  const copy = nowCopy(statusWith({ ...connected, runtime: runtime({}) }), NOW);
  assert.deepEqual(copy, { kind: "running", title: "FluxIQ is working", detail: "Clicking \"Search\"", recordingDot: false, details: false });
  assert.doesNotMatch(copy.detail, /#submit/);
  assert.equal(nowCopy(statusWith({ ...connected, runtime: runtime({ targetName: undefined }) }), NOW).detail, "Clicking a button");
});

test("succeeded under a minute ago: Done with the past-tense step; after a minute, nothing running", () => {
  const done = (finishedAt: number) => nowCopy(statusWith({
    ...connected, runtime: runtime({ state: "succeeded", actionType: "web.dom.type", targetName: "Email", finishedAt })
  }), NOW);
  assert.deepEqual(done(NOW - 5_000), { kind: "done", title: "Done", detail: "Last step: Typed into \"Email\"", recordingDot: false, details: false });
  assert.equal(done(NOW - DONE_WINDOW_MS).kind, "idle");
});

test("failed: A step didn't work, the past-tense sentence, and Details", () => {
  const failed = statusWith({ ...connected, runtime: runtime({ state: "failed", error: "Element not found: #submit > button.primary" }) });
  assert.deepEqual(nowCopy(failed, NOW), {
    kind: "failed", title: "A step didn't work", detail: "Clicked \"Search\" didn't work.", recordingDot: false, details: true
  });
});

test("a recording refusal shows its own title and message, and wins over everything", () => {
  const block = { code: "project_missing", title: "Open a project first", message: "Open a FluxIQ project before recording." };
  assert.deepEqual(nowCopy(statusWith({ ...connected, recordingBlock: block, runtime: runtime({}) }), NOW), {
    kind: "block", title: "Open a project first", detail: "Open a FluxIQ project before recording.", recordingDot: false, details: false
  });
});

test("recording refused because not connected: Connect first, until connected", () => {
  const refused = statusWith({ lastError: "Connect to FluxIQ before recording." });
  assert.deepEqual(nowCopy(refused, NOW), {
    kind: "connectFirst", title: "Connect first", detail: "Connect to FluxIQ before recording.", recordingDot: false, details: false
  });
  assert.equal(nowCopy({ ...refused, ...connected }, NOW).kind, "idle");
});

test("recording wins over a running step", () => {
  assert.equal(nowCopy(statusWith({ ...connected, recordingState: "recording", runtime: runtime({}) }), NOW).kind, "recording");
});

test("a paused recording says so, with its clock and step count (SEAM t180: the controls are that lane's)", () => {
  const copy = nowCopy(statusWith({ ...connected, recordingState: "paused", recordingStartedAt: NOW - 65_000, eventCount: 2 }), NOW);
  assert.equal(copy.kind, "paused");
  assert.equal(copy.title, "Recording paused");
  assert.match(copy.detail, /^01:05 · 2 steps/);
});
