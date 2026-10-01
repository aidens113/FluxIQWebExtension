import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { awaitPageComplete, type ListCompletion } from "../list-wait";
import { STORE_ITEM, STORE_LAZY_TAIL, storePage } from "./store-pager";

type Timer = { id: number; due: number; delay: number; callback(): void };
type Observed = { settled: boolean; outcome?: ListCompletion; error?: unknown; promise: Promise<void> };
const globals = ["setTimeout", "clearTimeout", "document", "window", "HTMLElement", "HTMLInputElement"] as const;
const cards = () => [...document.querySelectorAll(STORE_ITEM)].map(element => element.getAttribute("data-card"));
const checkpoint = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

/** Local scheduled eligibility and explicit macrotask delivery; no production callback is replaced. */
async function onClock(context: TestContext, body: (clock: ReturnType<typeof makeClock>, page: ReturnType<typeof storePage>) => Promise<void>): Promise<void> {
  const previous = new Map(globals.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const previousNow = Object.getOwnPropertyDescriptor(Date, "now");
  const clock = makeClock();
  let page: ReturnType<typeof storePage> | undefined;
  try {
    Object.defineProperty(Date, "now", { configurable: true, writable: true, value: () => clock.now });
    Object.defineProperty(globalThis, "setTimeout", { configurable: true, writable: true, value: (callback: (...args: unknown[]) => void, delay = 0, ...args: unknown[]) => clock.schedule(() => callback(...args), delay) });
    Object.defineProperty(globalThis, "clearTimeout", { configurable: true, writable: true, value: (id: number) => clock.pending.delete(id) });
    assert.deepEqual(STORE_LAZY_TAIL, { eager: 12, lazy: 4, loadMs: 600 });
    page = storePage(2, { lazyTail: STORE_LAZY_TAIL });
    assert.equal(cards().length, 12);
    await body(clock, page);
  } finally {
    try { await clock.finish(); if (page) clock.snapshot("cleanup", page); }
    finally {
      context.diagnostic(JSON.stringify(clock.trace));
      page?.restore(); clock.pending.clear();
      for (const [name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
      if (previousNow) Object.defineProperty(Date, "now", previousNow);
      else Reflect.deleteProperty(Date, "now");
      for (const [name, descriptor] of previous) assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, name), descriptor);
      assert.deepEqual(Object.getOwnPropertyDescriptor(Date, "now"), previousNow);
    }
  }
}

function makeClock() {
  let nextId = 0;
  const pending = new Map<number, Timer>(), observed: Observed[] = [], trace: unknown[] = [];
  const clock = {
    now: 0, pending, trace,
    schedule(callback: () => void, delay: number) {
      assert.ok(Number.isFinite(delay) && delay >= 0);
      const timer = { id: ++nextId, due: clock.now + delay, delay, callback };
      pending.set(timer.id, timer); trace.push({ event: "registered", id: timer.id, due: timer.due, delay }); return timer.id;
    },
    start(deadline = 30_000, records = 16) {
      const state: Observed = { settled: false, promise: Promise.resolve() };
      state.promise = awaitPageComplete(STORE_ITEM, { everything: false, records, taken: () => false }, deadline).then(
        outcome => { state.settled = true; state.outcome = outcome; trace.push({ event: "settled", at: clock.now, outcome, cards: cards().length }); },
        error => { state.settled = true; state.error = error; }
      );
      observed.push(state); return state;
    },
    timer(delay: number) { const timer = [...pending.values()].find(item => item.delay === delay); assert.ok(timer, "actual timer registered for " + delay); return timer; },
    async deliver(timer: Timer) {
      assert.equal(pending.get(timer.id), timer); assert.ok(timer.due <= clock.now, "only eligible timers may run");
      pending.delete(timer.id); trace.push({ event: "delivered", id: timer.id, due: timer.due, at: clock.now }); timer.callback(); await checkpoint();
    },
    async finish() {
      await checkpoint();
      for (let step = 0; observed.some(state => !state.settled); step++) {
        assert.ok(step < 200, "bounded local callback driver must settle original operations");
        const timer = [...pending.values()].sort((left, right) => left.due - right.due || left.id - right.id)[0];
        assert.ok(timer, "pending production continuation has an actual timer"); clock.now = Math.max(clock.now, timer.due); await clock.deliver(timer);
      }
      await Promise.all(observed.map(state => state.promise));
      for (const state of observed) { assert.equal(state.error, undefined); assert.ok(state.outcome === "complete" || state.outcome === "timed_out"); }
    },
    snapshot(event: string, page: ReturnType<typeof storePage>, state?: Observed) {
      trace.push({ event, at: clock.now, cards: cards(), scrolls: page.scrolls(), settled: state?.settled, outcome: state?.outcome,
        pending: [...pending.values()].map(timer => ({ id: timer.id, due: timer.due, delay: timer.delay, eligible: timer.due <= clock.now })) });
    }
  };
  return clock;
}

test("normal eligible timer delivery observes the genuine 600ms page-two tail", async context => onClock(context, async (clock, page) => {
  const state = clock.start(); assert.equal(clock.timer(600).due, 600); assert.equal(clock.timer(50).due, 50);
  await clock.finish(); assert.equal(state.outcome, "complete"); assert.equal(clock.now, 600); assert.equal(cards().length, 16); clock.snapshot("normal", page, state);
}));

for (const loaderFirst of [false, true]) test("same950 observation: " + (loaderFirst ? "loader-first perturbation" : "older-poll-first overdue delivery"), async context => onClock(context, async (clock, page) => {
  const state = clock.start(), loader = clock.timer(600), poll = clock.timer(50);
  clock.now = 950; assert.ok(loader.due <= clock.now && poll.due <= clock.now); assert.equal(cards().length, 12);
  await clock.deliver(loaderFirst ? loader : poll); clock.snapshot("after-first-macrotask", page, state);
  await clock.deliver(loaderFirst ? poll : loader); clock.snapshot("after-second-macrotask", page, state);
  assert.equal(cards().length, 16); await clock.finish(); clock.snapshot("characterized", page, state);
}));

test("500ms command deadline precedes the unchanged 600ms fixture loader", async context => onClock(context, async (clock, page) => {
  const state = clock.start(500); await clock.finish(); assert.equal(state.outcome, "timed_out"); assert.equal(clock.now, 500); assert.equal(cards().length, 12);
  assert.equal(clock.timer(600).due, 600); clock.snapshot("deadline", page, state);
}));

test("900ms negative growth observation while genuine loader remains undelivered", async context => onClock(context, async (clock, page) => {
  const state = clock.start(), loader = clock.timer(600);
  for (let step = 0; step < 18; step++) { const poll = clock.timer(50); clock.now = poll.due; await clock.deliver(poll); }
  assert.equal(clock.now, 900); assert.equal(cards().length, 12); assert.equal(clock.pending.get(loader.id), loader); clock.snapshot("window-before-loader-delivery", page, state);
  await clock.deliver(loader); assert.equal(cards().length, 16); await clock.finish(); clock.snapshot("window-after-loader-delivery", page, state);
}));

test("demand below twelve eager items schedules no reveal or wait", async context => onClock(context, async (clock, page) => {
  const state = clock.start(30_000, 10); await clock.finish(); assert.equal(state.outcome, "complete"); assert.equal(clock.now, 0); assert.equal(page.scrolls(), 0); assert.equal(clock.pending.size, 0); clock.snapshot("low-demand", page, state);
}));

for (const deadline of [900, 901]) test("overdue older-poll deadline boundary " + deadline + " is characterized", async context => onClock(context, async (clock, page) => {
  const state = clock.start(deadline), loader = clock.timer(600), poll = clock.timer(50); clock.now = 950;
  await clock.deliver(poll); clock.snapshot("boundary-before-loader", page, state); await clock.deliver(loader); await clock.finish(); clock.snapshot("boundary-after-loader", page, state);
}));


test("regression: overdue negative poll waits for one queued observation before completion", async context => onClock(context, async (clock, page) => {
  const state = clock.start(), loader = clock.timer(600), poll = clock.timer(50); clock.now = 950;
  await clock.deliver(poll); assert.equal(state.settled, false, "negative poll cannot declare complete before its queued observation");
  const observation = clock.timer(0); assert.equal(observation.due, 950);
  await clock.deliver(loader); assert.equal(cards().length, 16); assert.equal(state.settled, false);
  await clock.deliver(observation); await clock.finish(); assert.equal(state.outcome, "complete"); assert.equal(cards().length, 16); assert.equal(clock.now, 950); clock.snapshot("recovered-overdue-tail", page, state);
}));

test("regression: already elapsed absolute901 deadline prevents completion and queued extension", async context => onClock(context, async (clock, page) => {
  const state = clock.start(901), poll = clock.timer(50); clock.now = 950; await clock.deliver(poll); await clock.finish();
  assert.equal(state.outcome, "timed_out"); assert.equal(cards().length, 12); assert.equal([...clock.pending.values()].some(timer => timer.delay === 0), false); clock.snapshot("absolute-deadline", page, state);
}));

test("regression: deadline reached during queued observation wins even when due growth arrives", async context => onClock(context, async (clock, page) => {
  const state = clock.start(925), loader = clock.timer(600), poll = clock.timer(50); clock.now = 900;
  await clock.deliver(poll); assert.equal(state.settled, false); const observation = clock.timer(0); assert.equal(observation.due, 900);
  clock.now = 925; await clock.deliver(loader); assert.equal(cards().length, 16); await clock.deliver(observation); await clock.finish();
  assert.equal(state.outcome, "timed_out"); assert.equal(clock.now, 925); clock.snapshot("fresh-deadline", page, state);
}));

test("regression: genuine no-loader page completes after one task without another growth window", async context => onClock(context, async (clock, page) => {
  // A local variant removes the real sentinel before reveal; cards and geometry remain genuine.
  const sentinel = [...document.querySelectorAll(STORE_ITEM)].at(-1)?.nextElementSibling; assert.ok(sentinel); assert.equal(sentinel.getAttribute("data-sentinel"), ""); sentinel.replaceWith();
  const state = clock.start(); assert.equal([...clock.pending.values()].some(timer => timer.delay === 600), false);
  for (let step = 0; step < 18; step++) { const poll = clock.timer(50); clock.now = poll.due; await clock.deliver(poll); }
  assert.equal(clock.now, 900); assert.equal(state.settled, false); assert.equal(clock.pending.size, 1);
  const observation = clock.timer(0); await clock.deliver(observation); await clock.finish();
  assert.equal(state.outcome, "complete"); assert.equal(cards().length, 12); assert.equal(clock.now, 900); assert.equal(clock.pending.size, 0);
  assert.equal(clock.trace.filter(event => (event as { event?: string; delay?: number }).event === "registered" && (event as { delay?: number }).delay === 0).length, 1); clock.snapshot("one-task-no-growth", page, state);
}));
