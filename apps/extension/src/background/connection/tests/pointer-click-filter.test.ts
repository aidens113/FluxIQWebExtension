// T1 coverage of pointer-click-filter.ts: a pointerdown and the click that
// follows it are one user action, recorded once.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { PointerClickFilter } from "../pointer-click-filter";

// A hand-driven stand-in for the filter's timers. node:test's MockTimers would
// do, but on Node 22 it prints an ExperimentalWarning into every test run.
function fakeTimers(t: TestContext) {
  const pending = new Map<number, { callback: () => void; delay: number }>();
  let nextId = 1;
  t.mock.method(globalThis, "setTimeout", (callback: () => void, delay = 0) => {
    const id = nextId;
    nextId += 1;
    pending.set(id, { callback, delay });
    return id;
  });
  t.mock.method(globalThis, "clearTimeout", (id: number) => {
    pending.delete(id);
  });
  return {
    delays: () => [...pending.values()].map((timer) => timer.delay),
    fireAll: () => {
      const due = [...pending.values()];
      pending.clear();
      for (const timer of due) timer.callback();
    }
  };
}

test("the first of a pointerdown and its click claims the signature for 750 ms", (t) => {
  const timers = fakeTimers(t);
  const filter = new PointerClickFilter();
  filter.suppressNext("7|0|#buy");
  assert.equal(filter.isSuppressed("7|0|#buy"), true);
  assert.equal(filter.isSuppressed("7|0|#other"), false);
  assert.deepEqual(timers.delays(), [750]);

  filter.suppressNext("7|0|#buy");
  assert.deepEqual(timers.delays(), [750], "a repeat claim neither restarts nor extends the window");

  timers.fireAll();
  assert.equal(filter.isSuppressed("7|0|#buy"), false);
});

test("clear drops every claimed signature and cancels its timer", (t) => {
  const timers = fakeTimers(t);
  const filter = new PointerClickFilter();
  filter.suppressNext("a");
  filter.suppressNext("b");
  assert.deepEqual(timers.delays(), [750, 750]);
  filter.clear();
  assert.equal(filter.isSuppressed("a"), false);
  assert.equal(filter.isSuppressed("b"), false);
  assert.deepEqual(timers.delays(), []);
});
