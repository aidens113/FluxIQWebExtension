import assert from "node:assert/strict";
import test from "node:test";
import { UiReviewSchedule, type UiReviewLabel, type UiReviewTimers } from "../index.js";

function fakeTimers(): UiReviewTimers & { tick(): void; active(): number } {
  const running = new Map<number, () => void>();
  let next = 1;
  return {
    setInterval: run => { const id = next++; running.set(id, run); return id; },
    clearInterval: handle => { running.delete(handle as number); },
    tick: () => { for (const run of [...running.values()]) run(); },
    active: () => running.size,
  };
}

test("each phase takes one moment of its label, in order; a build or a Flow run then takes one per period", async () => {
  const timers = fakeTimers();
  const taken: UiReviewLabel[] = [];
  const schedule = new UiReviewSchedule({ take: async label => { taken.push(label); }, timers });
  await schedule.enter("start");
  assert.equal(timers.active(), 0, "start takes no periodic moments");
  await schedule.enter("build");
  assert.equal(timers.active(), 1);
  timers.tick(); await schedule.idle();
  timers.tick(); await schedule.idle();
  await schedule.enter("flow-run");
  assert.equal(timers.active(), 1, "the build's timer is replaced, not added to");
  timers.tick(); await schedule.idle();
  await schedule.enter("end");
  assert.equal(timers.active(), 0);
  assert.deepEqual(taken, ["start", "mid-build", "mid-build", "mid-build", "flow-run", "flow-run", "end"]);
});

test("a tick that finds a moment still being taken is skipped and counted, not queued", async () => {
  const timers = fakeTimers();
  const taken: UiReviewLabel[] = [];
  const releases: Array<() => void> = [];
  const schedule = new UiReviewSchedule({ take: label => { taken.push(label); return new Promise<void>(resolve => { releases.push(resolve); }); }, timers });
  const build = schedule.enter("build");
  timers.tick(); timers.tick();
  assert.equal(schedule.skippedTicks, 2);
  await new Promise(resolve => setImmediate(resolve));
  releases.shift()?.(); await build;
  timers.tick();
  await new Promise(resolve => setImmediate(resolve));
  releases.shift()?.(); await schedule.idle();
  assert.deepEqual(taken, ["mid-build", "mid-build"]);
});

test("after end or failure nothing more is taken, and the first terminal phase is the one kept", async () => {
  const timers = fakeTimers();
  const taken: UiReviewLabel[] = [];
  const schedule = new UiReviewSchedule({ take: async label => { taken.push(label); }, timers });
  await schedule.enter("failure");
  await schedule.enter("end");
  await schedule.enter("build");
  timers.tick(); await schedule.idle();
  assert.deepEqual(taken, ["failure"]);
  assert.equal(schedule.phase, "failure");
});

test("a moment that fails is kept as a failure and the queue goes on; periodic moments stop at the cap", async () => {
  const timers = fakeTimers();
  const taken: UiReviewLabel[] = [];
  const schedule = new UiReviewSchedule({ take: async label => { taken.push(label); if (taken.length === 1) throw new Error("screenshot timed out"); }, timers, maxMoments: 3 });
  await schedule.enter("build");
  for (let tick = 0; tick < 5; tick += 1) { timers.tick(); await schedule.idle(); }
  assert.deepEqual(taken, ["mid-build", "mid-build", "mid-build"]);
  assert.deepEqual(schedule.failures, ["mid-build: screenshot timed out"]);
  assert.equal(timers.active(), 0, "the timer is cleared at the cap");
  schedule.stop();
  await schedule.enter("end");
  assert.equal(taken.length, 3, "stop ends the schedule: a later end takes nothing");
});
