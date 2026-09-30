// The held "FluxIQ is working": a change shows only once it has lasted, so a
// flip back inside the hold never reaches the controls.

import assert from "node:assert/strict";
import test from "node:test";
import { createWorkingHold, WORKING_OFF_MS, WORKING_ON_MS } from "../working-hold";
import { fakeClock } from "./fake-clock";

function setup() {
  const clock = fakeClock();
  const changes: boolean[] = [];
  const hold = createWorkingHold(clock, (working) => changes.push(working));
  return { clock, changes, hold };
}

test("working shows only after it lasts, and idle only after it lasts", () => {
  const { clock, changes, hold } = setup();
  hold.observe(true);
  clock.advance(WORKING_ON_MS - 1);
  assert.equal(hold.working(), false);
  clock.advance(1);
  assert.equal(hold.working(), true);
  hold.observe(false);
  clock.advance(WORKING_OFF_MS - 1);
  assert.equal(hold.working(), true);
  clock.advance(1);
  assert.equal(hold.working(), false);
  assert.deepEqual(changes, [true, false]);
});

test("a short page read never shows", () => {
  const { clock, changes, hold } = setup();
  hold.observe(true);
  clock.advance(WORKING_ON_MS / 2);
  hold.observe(false);
  clock.advance(10_000);
  assert.deepEqual(changes, []);
});

test("a gap shorter than the idle hold never shows, and repeating the same input restarts nothing", () => {
  const { clock, changes, hold } = setup();
  hold.observe(true);
  clock.advance(WORKING_ON_MS);
  hold.observe(false);
  clock.advance(WORKING_OFF_MS / 2);
  hold.observe(true);
  hold.observe(true);
  clock.advance(10_000);
  assert.deepEqual(changes, [true]);
});

test("stop cancels a pending change", () => {
  const { clock, changes, hold } = setup();
  hold.observe(true);
  hold.stop();
  clock.advance(10_000);
  assert.deepEqual(changes, []);
});
