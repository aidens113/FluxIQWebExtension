import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { createPressWorkTracker } from "../tracker";
import { installPressWorkScheduling } from "../scheduling";

function observed() {
  const tracker = createPressWorkTracker();
  const target = new EventTarget();
  const event = { composedPath: () => [target] };
  tracker.arm(target);
  tracker.capture(event, true);
  return { tracker, target, owners: tracker.forEvent(event) };
}

function scheduling() {
  const globals = globalThis as Record<string, unknown>;
  const previousWindow = globals.window;
  const previousThen = Promise.prototype.then;
  const timers = new Map<number, () => void>();
  const microtasks: VoidFunction[] = [];
  let sequence = 0;
  const schedule = (callback: () => void): number => { const id = ++sequence;
    timers.set(id, callback);
    return id; };
  const clear = (id: number): void => { timers.delete(id); };
  class Port { sends = 0; postMessage(): void { this.sends += 1; } }
  const host = { setTimeout: schedule, clearTimeout: clear, setInterval: schedule, clearInterval: clear,
    queueMicrotask: (callback: VoidFunction) => { if (typeof callback !== "function") throw new TypeError("callback must be callable");
      microtasks.push(callback); }, MessagePort: Port };
  globals.window = host;
  const fixture = observed();
  const watch = installPressWorkScheduling(fixture.tracker);
  return { ...fixture, host, watch, timers, microtasks, Port,
    tick() { const entry = timers.entries().next().value;
      assert.ok(entry);
      timers.delete(entry[0]);
      entry[1](); },
    micro() { for (const task of microtasks.splice(0)) task(); },
    restore() { globals.window = previousWindow;
      Promise.prototype.then = previousThen; }
  };
}

test("a fresh exact observed click can become idle; copied/stale targets cannot", () => {
  const { tracker, target, owners } = observed();
  tracker.run(owners, () => undefined);
  assert.equal(tracker.state(target), "idle");
  assert.equal(tracker.state(new EventTarget()), "unknown");
  tracker.release(target);
  assert.equal(tracker.state(target), "unknown");
  tracker.arm(target);
  assert.equal(tracker.state(target), "unknown", "a fresh mark requires its own captured physical event");
});

test("click-owned timers and microtasks remain pending through nested callbacks", () => {
  const fixture = scheduling();
  try {
    let requests = 0;
    fixture.tracker.run(fixture.owners, () => {
      fixture.host.setTimeout(() => fixture.host.queueMicrotask(() => { requests += 1; }));
    });
    assert.equal(fixture.tracker.state(fixture.target), "pending");
    fixture.tick();
    assert.equal(requests, 0);
    assert.equal(fixture.tracker.state(fixture.target), "pending");
    fixture.micro();
    assert.equal(requests, 1);
    assert.equal(fixture.tracker.state(fixture.target), "idle");
  } finally { fixture.restore(); }
});

test("a returned async handler and its later unreturned timer remain unknown without a settlement observer", async () => {
  const fixture = scheduling();
  try {
    let release: (() => void) | undefined;
    let requests = 0;
    fixture.tracker.run(fixture.owners, async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      fixture.host.setTimeout(() => { requests += 1; });
    });
    assert.equal(fixture.tracker.state(fixture.target), "unknown");
    assert.ok(release);
    release();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(fixture.tracker.state(fixture.target), "unknown");
    fixture.tick();
    assert.equal(requests, 1);
    assert.equal(fixture.tracker.state(fixture.target), "unknown");
  } finally { fixture.restore(); }
});

test("unreturned promise reactions carry their nested scheduled request work", async () => {
  const fixture = scheduling();
  try {
    let requests = 0;
    fixture.tracker.run(fixture.owners, () => {
      Promise.resolve().then(() => { fixture.host.setTimeout(() => { requests += 1; }); });
    });
    assert.equal(fixture.tracker.state(fixture.target), "pending");
    await Promise.resolve();
    assert.equal(fixture.tracker.state(fixture.target), "pending");
    fixture.tick();
    assert.equal(requests, 1);
    assert.equal(fixture.tracker.state(fixture.target), "idle");
  } finally { fixture.restore(); }
});

test("unobserved message work and replaced scheduling hooks remain unknown", () => {
  const fixture = scheduling();
  try {
    const port = new fixture.Port();
    fixture.tracker.run(fixture.owners, () => port.postMessage());
    assert.equal(port.sends, 1, "the original API still runs");
    assert.equal(fixture.tracker.state(fixture.target), "unknown");
    assert.equal(fixture.watch.healthy(), true);
    fixture.host.setTimeout = () => 999;
    assert.equal(fixture.watch.healthy(), false);
  } finally { fixture.restore(); }
});

test("thrown and unsupported async handlers cannot create an idle proof or change their rejection", async () => {
  const { tracker, target, owners } = observed();
  const failure = new Error("synthetic handler rejection");
  const rejected = Promise.reject(failure);
  assert.equal(tracker.run(owners, () => rejected), rejected);
  await assert.rejects(rejected, (error) => error === failure);
  assert.equal(tracker.state(target), "unknown");
  const unsupported = observed();
  unsupported.tracker.run(unsupported.owners, () => ({ then: () => undefined }));
  assert.equal(unsupported.tracker.state(unsupported.target), "unknown");
});

test("invalid microtask callbacks still throw synchronously and noncallable Promise handlers stay native no-ops", async () => {
  const fixture = scheduling();
  try {
    assert.throws(() => fixture.tracker.run(fixture.owners, () => Reflect.apply(fixture.host.queueMicrotask, fixture.host, [12])), TypeError);
    assert.equal(fixture.microtasks.length, 0);
    let reaction: Promise<unknown> | undefined;
    fixture.tracker.run(fixture.owners, () => { reaction = Reflect.apply(Promise.prototype.then, Promise.resolve(17), [1]); });
    assert.ok(reaction);
    assert.equal(await reaction, 17);
  } finally { fixture.restore(); }
});

test("unsupported returned native rejection preserves the original unhandled notification without adding an observer promise", () => {
  const source = `
    const create = (${createPressWorkTracker.toString()});
    const tracker = create(); const target = new EventTarget();
    const event = {composedPath: () => [target]}; tracker.arm(target); tracker.capture(event, true);
    let reports = 0; let same = false;
    process.on('unhandledRejection', (_reason, promise) => { reports += 1; same = promise === original; });
    const original = Promise.reject(new Error('synthetic rejection'));
    tracker.run(tracker.forEvent(event), () => original);
    setTimeout(() => { process.stdout.write(JSON.stringify({reports, same, state:tracker.state(target)})); }, 20);
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", source], { encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), { reports: 1, same: true, state: "unknown" });
});

test("the supported source gate applies to scheduled callbacks that visibly start unreturned native async work", async () => {
  const fixture = scheduling();
  try {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let later = false;
    function onTimer() { void (async () => { await gate;
      later = true; })(); }
    fixture.tracker.run(fixture.owners, () => { fixture.host.setTimeout(onTimer); });
    assert.equal(fixture.tracker.state(fixture.target), "pending");
    fixture.tick();
    assert.equal(fixture.tracker.state(fixture.target), "unknown");
    assert.equal(later, false);
    assert.ok(release);
    release();
    await Promise.resolve();
    assert.equal(later, true);
    assert.equal(fixture.tracker.state(fixture.target), "unknown");
  } finally { fixture.restore(); }
});

test("an accessor replacement cannot appear healthy by returning the saved scheduling hook", () => {
  const fixture = scheduling();
  try {
    const original = fixture.host.setTimeout;
    let reads = 0;
    Object.defineProperty(fixture.host, "setTimeout", { configurable: true, get() { reads += 1;
      return original; } });
    assert.equal(fixture.watch.healthy(), false);
    assert.equal(reads, 0);
  } finally { fixture.restore(); }
});
