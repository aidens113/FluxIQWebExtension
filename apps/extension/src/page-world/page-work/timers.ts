// The timers and animation frames a page schedules for itself, counted from the
// call until their callback has run (`./tracker.ts`). Each wrapper calls the
// original with the same receiver and arguments and returns what it returns;
// the callback it passes on calls the page's own with the same receiver and
// arguments and returns what it returns, so the page behaves as it would without
// the extension.
//
// What is never counted, by evidence rather than by a time limit:
// - a timer due later than `PAGE_WORK_HORIZON_MS` -- the page acting in its own
//   time, not drawing itself;
// - a callback scheduled again once it has already run as one (a polling loop,
//   an animation loop, `setTimeout(poll)` from inside `poll` or after an
//   `await` in it): it recurs, and it runs as recurring work, so nothing it
//   begins in its own run is counted either;
// - an interval once it has fired, and every later run of it;
// - a callback given as a string, which cannot be followed.

import { PAGE_WORK_HORIZON_MS } from "../../shared/scheduled-work-event";
import type { PageWorkTracker } from "./tracker";

type Callable = (...args: unknown[]) => unknown;
type Host = Record<string, unknown>;

/** Wraps the host's timer and frame functions; answers false when one it needs is missing. */
export function installPageWorkTimers(host: Host, tracker: PageWorkTracker): boolean {
  /** The page's own callbacks running now, innermost last, and every one that has run: one scheduled again recurs. */
  const running: unknown[] = [];
  const ran = new WeakSet<object>();
  const recurs = (callback: Callable): boolean => running.includes(callback) || ran.has(callback);
  const follow = (callback: Callable, self: unknown, args: unknown[], id: number | undefined, recurs: boolean): unknown => {
    running.push(callback);
    ran.add(callback);
    try {
      return recurs ? tracker.recurring(() => callback.apply(self, args)) : callback.apply(self, args);
    } finally {
      running.pop();
      tracker.end(id);
    }
  };
  const wrap = (name: string, wrapped: Callable): boolean => {
    try {
      Object.defineProperty(host, name, { value: wrapped, writable: true, configurable: true, enumerable: Object.getOwnPropertyDescriptor(host, name)?.enumerable ?? true });
      return true;
    } catch {
      /* best-effort: a function the page world may not redefine is not followed, and readiness falls back to the old second for nothing */
      return false;
    }
  };
  const functions = (name: string): Callable | undefined => (typeof host[name] === "function" ? host[name] as Callable : undefined);
  const setTimeoutOriginal = functions("setTimeout");
  const clearTimeoutOriginal = functions("clearTimeout");
  const setIntervalOriginal = functions("setInterval");
  const clearIntervalOriginal = functions("clearInterval");
  if (!setTimeoutOriginal || !clearTimeoutOriginal || !setIntervalOriginal || !clearIntervalOriginal) return false;

  const timeouts = new Map<unknown, number>();
  let complete = wrap("setTimeout", function (this: unknown, callback: unknown, delay?: unknown, ...rest: unknown[]): unknown {
    if (typeof callback !== "function") return setTimeoutOriginal.call(this, callback, delay, ...rest);
    const again = recurs(callback as Callable);
    const due = Number(delay) || 0;
    const id = again || due > PAGE_WORK_HORIZON_MS ? undefined : tracker.begin("timer");
    let token: unknown;
    const passed = function (this: unknown, ...values: unknown[]): unknown {
      timeouts.delete(token);
      return follow(callback as Callable, this, values, id, again);
    };
    token = setTimeoutOriginal.call(this, passed, delay, ...rest);
    if (id !== undefined) timeouts.set(token, id);
    return token;
  });
  complete = wrap("clearTimeout", function (this: unknown, token: unknown): unknown {
    const id = timeouts.get(token);
    timeouts.delete(token);
    tracker.end(id);
    return clearTimeoutOriginal.call(this, token);
  }) && complete;

  const intervals = new Map<unknown, number>();
  complete = wrap("setInterval", function (this: unknown, callback: unknown, delay?: unknown, ...rest: unknown[]): unknown {
    if (typeof callback !== "function") return setIntervalOriginal.call(this, callback, delay, ...rest);
    const due = Number(delay) || 0;
    // Counted until its first run; from then on it recurs.
    let id = recurs(callback as Callable) || due > PAGE_WORK_HORIZON_MS ? undefined : tracker.begin("timer");
    let fired = false;
    let token: unknown;
    const passed = function (this: unknown, ...values: unknown[]): unknown {
      const first = !fired;
      fired = true;
      const ending = first ? id : undefined;
      if (first) {
        intervals.delete(token);
        id = undefined;
      }
      return follow(callback as Callable, this, values, ending, !first);
    };
    token = setIntervalOriginal.call(this, passed, delay, ...rest);
    if (id !== undefined) intervals.set(token, id);
    return token;
  }) && complete;
  complete = wrap("clearInterval", function (this: unknown, token: unknown): unknown {
    const id = intervals.get(token);
    intervals.delete(token);
    tracker.end(id);
    return clearIntervalOriginal.call(this, token);
  }) && complete;

  const frameOriginal = functions("requestAnimationFrame");
  const cancelFrameOriginal = functions("cancelAnimationFrame");
  if (frameOriginal && cancelFrameOriginal) {
    const frames = new Map<unknown, number>();
    complete = wrap("requestAnimationFrame", function (this: unknown, callback: unknown): unknown {
      if (typeof callback !== "function") return frameOriginal.call(this, callback);
      const again = recurs(callback as Callable);
      const id = again ? undefined : tracker.begin("frame");
      let token: unknown;
      const passed = function (this: unknown, ...values: unknown[]): unknown {
        frames.delete(token);
        return follow(callback as Callable, this, values, id, again);
      };
      token = frameOriginal.call(this, passed);
      if (id !== undefined) frames.set(token, id);
      return token;
    }) && complete;
    complete = wrap("cancelAnimationFrame", function (this: unknown, token: unknown): unknown {
      const id = frames.get(token);
      frames.delete(token);
      tracker.end(id);
      return cancelFrameOriginal.call(this, token);
    }) && complete;
  }
  return complete;
}
