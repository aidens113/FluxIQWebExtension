import type { PressWorkTracker } from "./tracker";

/** Observe supported registered/assigned click handlers without changing their receiver, removal identity or return value. */
export function installPressWorkHandlers(tracker: PressWorkTracker): { healthy(): boolean; covered(event: Event): boolean } {
  const prototype = EventTarget.prototype;
  const add = prototype.addEventListener;
  const remove = prototype.removeEventListener;
  const wrappers = new WeakMap<EventTarget, WeakMap<object, EventListener>>();
  const assigned = new WeakMap<HTMLElement, unknown>();
  const describe = Object.getOwnPropertyDescriptor;
  const parentOf = Object.getPrototypeOf;
  const getAttribute = Element.prototype.getAttribute;
  const canonical = new Map<object, { get: PropertyDescriptor["get"]; set: PropertyDescriptor["set"]; read: PropertyDescriptor["get"] }>();
  const remember = (target: object): void => {
    for (let owner: object | null = target; owner; owner = parentOf(owner)) {
      const property = describe(owner, "onclick");
      if (property) {
        canonical.set(owner, { get: property.get, set: property.set, read: property.get });
        return;
      }
    }
  };
  if (typeof window !== "undefined") remember(window);
  if (typeof document !== "undefined") remember(document);
  let installed = true;
  const stringify = String;
  const eventType = (value: unknown): string => {
    if (typeof value === "symbol") throw new TypeError("Cannot convert a Symbol value to a string");
    return stringify(value);
  };
  const wrappedAdd: typeof add = function (this: EventTarget, type, callback, options) {
    if (arguments.length < 2) return Reflect.apply(add, this, arguments);
    const convertedType = eventType(type);
    if (convertedType !== "click" || callback === null || callback === undefined) {
      if (convertedType !== "click") tracker.taint(tracker.current());
      return add.call(this, convertedType, callback, options);
    }
    let callbacks = wrappers.get(this);
    if (!callbacks) { callbacks = new WeakMap();
      wrappers.set(this, callbacks); }
    let wrapped = callbacks.get(callback);
    if (!wrapped) {
      wrapped = function (this: EventTarget, event) {
        return tracker.run(tracker.forEvent(event), () => {
          const handler = typeof callback === "function" ? callback : callback.handleEvent;
          tracker.inspect(handler, tracker.forEvent(event));
          return handler.call(typeof callback === "function" ? this : callback, event);
        });
      };
      callbacks.set(callback, wrapped);
    }
    return add.call(this, convertedType, wrapped, options);
  };
  const wrappedRemove: typeof remove = function (this: EventTarget, type, callback, options) {
    if (arguments.length < 2) return Reflect.apply(remove, this, arguments);
    const convertedType = eventType(type);
    const wrapped = convertedType === "click" && callback !== null && callback !== undefined ? wrappers.get(this)?.get(callback) : undefined;
    return remove.call(this, convertedType, wrapped ?? callback, options);
  };
  const descriptor = describe(HTMLElement.prototype, "onclick");
  const originals = new WeakMap<Function, Function>();
  const set = descriptor?.set;
  const get = descriptor?.get;
  const wrappedSet = function (this: HTMLElement, value: unknown): void {
    assigned.set(this, value);
    if (typeof value !== "function") { set?.call(this, value);
      return; }
    const wrapped = function (this: HTMLElement, event: Event): unknown {
      tracker.inspect(value, tracker.forEvent(event));
      return tracker.run(tracker.forEvent(event), () => value.call(this, event));
    };
    originals.set(wrapped, value);
    set?.call(this, wrapped);
  };
  const wrappedGet = function (this: HTMLElement): unknown {
    const value = get?.call(this);
    return typeof value === "function" ? originals.get(value) ?? value : value;
  };
  try {
    prototype.addEventListener = wrappedAdd;
    prototype.removeEventListener = wrappedRemove;
    if (!set || !get || !descriptor?.configurable) installed = false;
    else {
      Object.defineProperty(HTMLElement.prototype, "onclick", { ...descriptor, get: wrappedGet, set: wrappedSet });
      canonical.set(HTMLElement.prototype, { get: wrappedGet, set: wrappedSet, read: get });
    }
  } catch { installed = false; }
  return {
    healthy: () => installed && describe(prototype, "addEventListener")?.value === wrappedAdd
      && describe(prototype, "removeEventListener")?.value === wrappedRemove
      && describe(HTMLElement.prototype, "onclick")?.set === wrappedSet
      && describe(HTMLElement.prototype, "onclick")?.get === wrappedGet,
    covered(event): boolean {
      try {
        return event.composedPath().every((target) => {
          if (target instanceof Element && getAttribute.call(target, "onclick") !== null) return false;
          for (let owner: object | null = target; owner; owner = parentOf(owner)) {
            const property = describe(owner, "onclick");
            if (!property) continue;
            const expected = canonical.get(owner);
            if (!expected?.read || property.get !== expected.get || property.set !== expected.set) return false;
            const handler: unknown = expected.read.call(target);
            return typeof handler !== "function" || target instanceof HTMLElement && originals.get(handler) === assigned.get(target);
          }
          return true;
        });
      } catch { return false; }
    }
  };
}
