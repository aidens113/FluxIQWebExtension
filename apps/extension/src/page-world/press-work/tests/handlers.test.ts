import assert from "node:assert/strict";
import test from "node:test";
import { installPressWorkHandlers } from "../handlers";
import { createPressWorkTracker } from "../tracker";
import { installPressWorkScheduling } from "../scheduling";

function fixture() {
  const globals = globalThis as Record<string, unknown>;
  const previous = { Element: globals.Element, HTMLElement: globals.HTMLElement };
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  class ElementStandin extends EventTarget {
    private handler: unknown;
    get onclick(): unknown { return this.handler; }
    set onclick(value: unknown) { this.handler = value; }
    getAttribute(): null { return null; }
  }
  globals.Element = ElementStandin;
  globals.HTMLElement = ElementStandin;
  const tracker = createPressWorkTracker();
  const handlers = installPressWorkHandlers(tracker);
  const target = new ElementStandin();
  add.call(target, "click", (event: Event) => tracker.capture(event, handlers.covered(event)));
  tracker.arm(target);
  return { target, tracker, handlers, restore() {
    EventTarget.prototype.addEventListener = add;
    EventTarget.prototype.removeEventListener = remove;
    Object.assign(globals, previous);
  } };
}

test("truthy capture and side-effectful capture getters retain native add/remove identity without an extra read", () => {
  const f = fixture();
  try {
    let calls = 0;
    let reads = 0;
    const callback = () => { calls += 1; };
    const options = { get capture() { reads += 1;
      return 1; } };
    Reflect.apply(f.target.addEventListener, f.target, ["click", callback, options]);
    assert.equal(reads, 1, "only the native dictionary conversion reads capture");
    f.target.dispatchEvent(new Event("click"));
    assert.equal(calls, 1);
    Reflect.apply(f.target.removeEventListener, f.target, ["click", callback, { capture: true }]);
    f.target.dispatchEvent(new Event("click"));
    assert.equal(calls, 1, "native capture identity removes the original callback wrapper");
  } finally { f.restore(); }
});

test("visible unreturned native async work is unknown even when the click handler returns undefined", async () => {
  const f = fixture();
  try {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let later = false;
    f.target.addEventListener("click", () => { void (async () => { await gate;
      later = true; })(); });
    f.target.dispatchEvent(new Event("click"));
    assert.equal(f.tracker.state(f.target), "unknown");
    assert.equal(later, false);
    assert.ok(release);
    release();
    await Promise.resolve();
    assert.equal(later, true);
    assert.equal(f.tracker.state(f.target), "unknown");
  } finally { f.restore(); }
});

test("a synchronous registered handler is observed and later-event registration becomes unknown", () => {
  const f = fixture();
  try {
    f.target.addEventListener("click", () => undefined);
    f.target.dispatchEvent(new Event("click"));
    assert.equal(f.tracker.state(f.target), "idle");
    f.tracker.arm(f.target);
    f.target.addEventListener("click", () => f.target.addEventListener("message", () => undefined));
    f.target.dispatchEvent(new Event("click"));
    assert.equal(f.tracker.state(f.target), "unknown");
  } finally { f.restore(); }
});

test("native event type coercion happens once, removal finds its wrapper and nullish callbacks remain no-ops", () => {
  const f = fixture();
  try {
    let conversions = 0;
    let calls = 0;
    const callback = () => { calls += 1; };
    const type = { toString() { conversions += 1;
      return "click"; } };
    Reflect.apply(f.target.addEventListener, f.target, [type, callback]);
    assert.equal(conversions, 1);
    f.target.dispatchEvent(new Event("click"));
    assert.equal(calls, 1);
    Reflect.apply(f.target.removeEventListener, f.target, [type, callback]);
    assert.equal(conversions, 2);
    f.target.dispatchEvent(new Event("click"));
    assert.equal(calls, 1);
    assert.doesNotThrow(() => Reflect.apply(f.target.addEventListener, f.target, ["click", undefined]));
    assert.doesNotThrow(() => Reflect.apply(f.target.removeEventListener, f.target, ["click", undefined]));
  } finally { f.restore(); }
});

test("dynamic handleEvent lookup enters the click's causal frame before it can schedule work", () => {
  const f = fixture();
  const globals = globalThis as Record<string, unknown>;
  const previousWindow = globals.window;
  const previousThen = Promise.prototype.then;
  const tasks: VoidFunction[] = [];
  const host = { setTimeout: (callback: VoidFunction) => { tasks.push(callback);
    return tasks.length; }, clearTimeout: () => undefined,
    setInterval: () => 1, clearInterval: () => undefined, queueMicrotask: (callback: VoidFunction) => tasks.push(callback) };
  globals.window = host;
  try {
    installPressWorkScheduling(f.tracker);
    let later = false;
    const listener = { get handleEvent() { host.setTimeout(() => { later = true; });
      return () => undefined; } };
    f.target.addEventListener("click", listener);
    f.target.dispatchEvent(new Event("click"));
    assert.equal(f.tracker.state(f.target), "pending");
    assert.equal(later, false);
    const task = tasks.shift();
    assert.ok(task);
    task();
    assert.equal(later, true);
    assert.equal(f.tracker.state(f.target), "idle");
  } finally { Promise.prototype.then = previousThen;
    globals.window = previousWindow;
    f.restore(); }
});

test("custom own or inherited onclick accessors are refused without executing page getters", () => {
  for (const inherited of [false, true]) {
    const f = fixture();
    try {
      let reads = 0;
      const tasks: VoidFunction[] = [];
      const owner = inherited ? Object.create(Object.getPrototypeOf(f.target)) : f.target;
      Object.defineProperty(owner, "onclick", { configurable: true, get() { reads += 1;
        tasks.push(() => undefined);
        return null; } });
      if (inherited) Object.setPrototypeOf(f.target, owner);
      f.target.dispatchEvent(new Event("click"));
      assert.equal(f.tracker.state(f.target), "unknown");
      assert.equal(reads, 0);
      assert.equal(tasks.length, 0, "the coverage query cannot schedule page work");
    } finally { f.restore(); }
  }
});

test("coverage reads attributes through the captured Element method instead of a page override", () => {
  const f = fixture();
  try {
    let reads = 0;
    Reflect.set(f.target, "getAttribute", () => { reads += 1;
      return null; });
    f.target.dispatchEvent(new Event("click"));
    assert.equal(f.tracker.state(f.target), "idle");
    assert.equal(reads, 0);
  } finally { f.restore(); }
});
