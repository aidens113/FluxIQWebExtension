// Coverage of fan-out-gate.ts: a request after a quiet interval runs at once,
// a burst runs once more at the interval's end, and never faster.

import assert from "node:assert/strict";
import test from "node:test";

import { ACTIVITY_FAN_OUT_INTERVAL_MS, FanOutGate } from "../fan-out-gate";
import { FakeClock } from "./fake-clock";

test("the first request runs at once; a burst inside the interval runs once, at its end", () => {
  const clock = new FakeClock(0);
  const runs: number[] = [];
  const gate = new FanOutGate(clock, () => runs.push(clock.now()));
  gate.request();
  for (let at = 10; at < ACTIVITY_FAN_OUT_INTERVAL_MS; at += 10) {
    clock.advanceTo(at);
    gate.request();
  }
  assert.deepEqual(runs, [0]);
  clock.advanceTo(ACTIVITY_FAN_OUT_INTERVAL_MS);
  assert.deepEqual(runs, [0, ACTIVITY_FAN_OUT_INTERVAL_MS]);
  clock.advance(10_000);
  assert.deepEqual(runs, [0, ACTIVITY_FAN_OUT_INTERVAL_MS], "nothing runs without a request");
});

test("a request every millisecond for ten seconds runs at most four times a second", () => {
  const clock = new FakeClock(0);
  const runs: number[] = [];
  const gate = new FanOutGate(clock, () => runs.push(clock.now()));
  for (let at = 0; at < 10_000; at += 1) {
    clock.advanceTo(at);
    gate.request();
  }
  clock.advance(1_000);
  for (let start = 0; start < 10_000; start += 1) {
    assert.ok(runs.filter((at) => at >= start && at < start + 1_000).length <= 4, `window at ${start}`);
  }
  assert.ok(runs.length >= 39, "and it keeps up: one run per interval");
});
