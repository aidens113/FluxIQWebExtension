import assert from "node:assert/strict";
import test from "node:test";
import { PeriodicCapture } from "../periodic-capture.js";

/** Timers the test fires by hand, so "every 15 s" is checked without waiting 15 s. */
function manualTimers() {
  const pending = new Map<number, { callback: () => void; ms: number }>();
  let next = 0;
  return {
    pending,
    timers: {
      set: (callback: () => void, ms: number) => { next += 1; pending.set(next, { callback, ms }); return next; },
      clear: (handle: unknown) => { pending.delete(handle as number); },
    },
    /** Fires every pending timer once, as if its interval had elapsed. */
    fire: async () => {
      const due = [...pending.entries()];
      for (const [id, timer] of due) { pending.delete(id); timer.callback(); }
      await new Promise(resolve => setImmediate(resolve));
    },
  };
}

type Published = { summary: string; details: Record<string, unknown> };

function periodic(policy: { screenshots: "none" | "checkpoints" | "events"; maxScreenshots: number }, answer: (count: number) => Promise<{ screenshot?: { suppressed?: "quota" } }> = async () => ({ screenshot: {} })) {
  const clock = manualTimers();
  const published: Published[] = [];
  const capture = new PeriodicCapture({ policy, timers: clock.timers, trigger: (summary, details) => { published.push({ summary, details }); return answer(published.length); } });
  return { capture, clock, published };
}

test("a picture every interval while the run works, and none after stop, however long the run then takes", async () => {
  const { capture, clock, published } = periodic({ screenshots: "events", maxScreenshots: 100 });
  capture.start();
  assert.equal([...clock.pending.values()][0]!.ms, 15_000);
  await clock.fire();
  await clock.fire();
  await clock.fire();
  assert.equal(published.length, 3);
  assert.deepEqual(published.map(item => item.details.sequence), [1, 2, 3]);
  await capture.stop({ finalCapture: false });
  assert.equal(clock.pending.size, 0);
  await clock.fire();
  assert.equal(published.length, 3);
});

test("stop waits for a picture in flight and then takes the closing picture when asked", async () => {
  let release: () => void = () => undefined;
  const { capture, clock, published } = periodic({ screenshots: "checkpoints", maxScreenshots: 100 }, count => count === 1 ? new Promise(resolve => { release = () => resolve({ screenshot: {} }); }) : Promise.resolve({ screenshot: {} }));
  capture.start();
  await clock.fire();
  let stopped = false;
  const stopping = capture.stop({ finalCapture: true }).then(() => { stopped = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stopped, false);
  release();
  await stopping;
  assert.deepEqual(published.map(item => item.summary), ["Periodic view of the browser", "The browser as the run ended"]);
  assert.equal(published[1]!.details.final, true);
  assert.equal(clock.pending.size, 0);
});

test("the periodic share of the quota, or the controller answering quota, stops the pictures", async () => {
  const bounded = periodic({ screenshots: "events", maxScreenshots: 5 });
  bounded.capture.start();
  for (let index = 0; index < 10; index += 1) await bounded.clock.fire();
  assert.equal(bounded.published.length, 4, "80% of five screenshots");
  const spent = periodic({ screenshots: "events", maxScreenshots: 100 }, async count => (count === 2 ? { screenshot: { suppressed: "quota" } } : { screenshot: {} }));
  spent.capture.start();
  for (let index = 0; index < 10; index += 1) await spent.clock.fire();
  assert.equal(spent.published.length, 2);
});

test("nothing is scheduled or taken under a policy of no screenshots, and nothing closes a run that never started", async () => {
  const none = periodic({ screenshots: "none", maxScreenshots: 100 });
  none.capture.start();
  assert.equal(none.clock.pending.size, 0);
  await none.capture.stop({ finalCapture: true });
  assert.equal(none.published.length, 0);
  const neverStarted = periodic({ screenshots: "events", maxScreenshots: 100 });
  await neverStarted.capture.stop({ finalCapture: true });
  assert.equal(neverStarted.published.length, 0);
});

test("a publish that fails stops the pictures and is kept, and stop still does not throw", async () => {
  const { capture, clock, published } = periodic({ screenshots: "events", maxScreenshots: 100 }, async () => { throw new Error("bundle write failed"); });
  capture.start();
  await clock.fire();
  await clock.fire();
  assert.equal(published.length, 1);
  assert.match(String(capture.failure), /bundle write failed/u);
  await capture.stop({ finalCapture: true });
  assert.equal(published.length, 1);
});
