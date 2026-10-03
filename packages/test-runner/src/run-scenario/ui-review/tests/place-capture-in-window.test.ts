import assert from "node:assert/strict";
import test from "node:test";
import { placeCaptureInWindow, type OverlaySample } from "../index.js";

const startedAt = "2026-10-03T06:06:27.863Z";
const start = Date.parse(startedAt);
const sample = (atMs: number, present: boolean): OverlaySample => ({ atMs, present, hostCount: present ? 1 : 0, visible: present });
// Run murzln6g moment 2's shape: absent for the first seven reads, present after.
const samples = [0, 213, 409, 605, 815, 1013, 1206, 1411, 1607].map((at, index) => sample(at, index >= 7));

test("a picture is placed on the window's clock, between the read before it and the read after it", () => {
  const placed = placeCaptureInWindow({ from: start + 250, to: start + 385 }, { startedAt, samples });
  assert.equal(placed.takenAt, new Date(start + 250).toISOString());
  assert.deepEqual(placed.windowMs, { from: 250, to: 385 });
  assert.deepEqual(placed.overlaySamples, { lastBefore: 1, firstAfter: 2 }, "taken while the overlay was still absent");
});

test("a picture begun before the first read has a negative offset and no read before it", () => {
  const placed = placeCaptureInWindow({ from: start - 40, to: start + 95 }, { startedAt, samples });
  assert.deepEqual(placed.windowMs, { from: -40, to: 95 });
  assert.deepEqual(placed.overlaySamples, { firstAfter: 1 });
});

test("a picture after the last read has no read after it, and a window with no reads places only its clock", () => {
  assert.deepEqual(placeCaptureInWindow({ from: start + 1700, to: start + 1800 }, { startedAt, samples }).overlaySamples, { lastBefore: 8 });
  const empty = placeCaptureInWindow({ from: start + 10, to: start + 20 }, { startedAt, samples: [] });
  assert.deepEqual(empty, { takenAt: new Date(start + 10).toISOString(), windowMs: { from: 10, to: 20 } });
  assert.deepEqual(placeCaptureInWindow({ from: start, to: start + 1 }, { startedAt: "not a time", samples }), { takenAt: startedAt });
});
