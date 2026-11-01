import type { PressWorkTracker } from "./tracker";

/** Supported causal tasks only. A missing required hook or replaced wrapper makes observation unknown. */
export function installPressWorkScheduling(tracker: PressWorkTracker): { healthy(): boolean } {
  const host = window;
  const installed: Array<{ owner: object; name: string; value: unknown }> = [];
  const describe = Object.getOwnPropertyDescriptor;
  let complete = true;
  const replace = (owner: object, name: string, value: unknown): void => {
    try { if (!Reflect.set(owner, name, value)) complete = false;
      installed.push({ owner, name, value }); } catch { complete = false; }
  };
  for (const [schedule, cancel, repeats] of [
    ["setTimeout", "clearTimeout", false], ["setInterval", "clearInterval", true],
    ["requestAnimationFrame", "cancelAnimationFrame", false], ["requestIdleCallback", "cancelIdleCallback", false]
  ] as const) {
    const original: unknown = Reflect.get(host, schedule);
    const clear: unknown = Reflect.get(host, cancel);
    if (typeof original !== "function" || typeof clear !== "function") {
      if (schedule === "setTimeout" || schedule === "setInterval") complete = false;
      continue;
    }
    const pending = new Map<unknown, () => void>();
    replace(host, schedule, function (this: unknown, callback: unknown, ...args: unknown[]): unknown {
      const owners = tracker.current();
      if (owners.length === 0) return original.call(this, callback, ...args);
      if (typeof callback !== "function") { tracker.taint(owners);
        return original.call(this, callback, ...args); }
      const done = tracker.task(owners);
      let token: unknown;
      const wrapped = function (this: unknown, ...values: unknown[]): unknown {
        if (!repeats) { pending.delete(token);
          done(); }
        tracker.inspect(callback, owners);
        return tracker.run(owners, () => callback.apply(this, values));
      };
      try { token = original.call(this, wrapped, ...args);
        pending.set(token, done);
        return token; }
      catch (error) { done();
        tracker.taint(owners);
        throw error; }
    });
    replace(host, cancel, function (this: unknown, token: unknown): unknown {
      pending.get(token)?.();
      pending.delete(token);
      return clear.call(this, token);
    });
  }
  const microtask: unknown = Reflect.get(host, "queueMicrotask");
  if (typeof microtask !== "function") complete = false;
  else replace(host, "queueMicrotask", function (this: unknown, callback: unknown): void {
    const owners = tracker.current();
    if (owners.length === 0) return microtask.call(this, callback);
    if (typeof callback !== "function") { tracker.taint(owners);
      return microtask.call(this, callback); }
    const done = tracker.task(owners);
    try { microtask.call(this, () => { done();
      tracker.inspect(callback, owners);
      tracker.run(owners, () => callback()); }); }
    catch (error) { done();
      tracker.taint(owners);
      throw error; }
  });
  const owner = Promise.prototype;
  const then = Promise.prototype.then;
  replace(owner, "then", function (this: Promise<unknown>, fulfilled?: ((value: unknown) => unknown) | null, rejected?: ((reason: unknown) => unknown) | null): Promise<unknown> {
    const owners = tracker.current();
    if (owners.length === 0) return then.call(this, fulfilled, rejected);
    const done = tracker.task(owners);
    return then.call(this,
      (value) => { done();
        if (typeof fulfilled === "function") tracker.inspect(fulfilled, owners);
        return tracker.run(owners, () => typeof fulfilled === "function" ? fulfilled(value) : value); },
      (reason) => { done();
        if (typeof rejected === "function") tracker.inspect(rejected, owners);
        return tracker.run(owners, () => { if (typeof rejected === "function") return rejected(reason);
        throw reason; }); });
  });
  // These may schedule work outside the supported causal tracker or commit
  // hidden state. Observing their entry forbids a positive no-effect proof.
  const guard = (owner: unknown, name: string): void => {
    if (owner === null || typeof owner !== "object" && typeof owner !== "function") return;
    const original: unknown = Reflect.get(owner, name);
    if (typeof original !== "function") return;
    replace(owner, name, function (this: unknown, ...args: unknown[]): unknown {
      tracker.taint(tracker.current());
      return original.apply(this, args);
    });
  };
  guard(host, "postMessage");
  for (const [constructor, names] of [
    ["MessagePort", ["postMessage"]], ["Worker", ["postMessage"]], ["ServiceWorker", ["postMessage"]],
    ["IDBDatabase", ["transaction"]], ["IDBObjectStore", ["add", "put", "delete", "clear"]],
    ["Storage", ["setItem", "removeItem", "clear"]]
  ] as const) {
    const constructorValue: unknown = Reflect.get(host, constructor);
    const prototype: unknown = typeof constructorValue === "function" ? Reflect.get(constructorValue, "prototype") : undefined;
    for (const name of names) guard(prototype, name);
  }
  const indexedDB: unknown = Reflect.get(host, "indexedDB");
  guard(indexedDB, "open");
  guard(indexedDB, "deleteDatabase");
  const scheduler: unknown = Reflect.get(host, "scheduler");
  guard(scheduler, "postTask");
  guard(scheduler, "yield");
  return { healthy: () => complete && installed.every(({ owner, name, value }) => {
    const property = describe(owner, name);
    return property !== undefined && Object.hasOwn(property, "value") && property.value === value;
  }) };
}
