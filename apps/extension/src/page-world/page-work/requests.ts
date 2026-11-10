// The requests a page makes for itself, counted from the call until they answer
// (`./tracker.ts`): a `fetch` when its resource-timing entry is written (its
// response has ended), an `XMLHttpRequest` at its own `loadend`. A fetch's answer
// is told by its entry, never by the page's promise: a handler on that promise
// would change whether its rejection reaches the page's `unhandledrejection`.
// One begun by recurring work is not counted (`./timers.ts`). A fetch whose
// entry never comes stays outstanding, and readiness waits on it as on any
// other work the page has not finished.
//
// Each wrapper calls the original with the same receiver and arguments and
// returns what it returns: the page behaves as it would without the extension.
// A fetch's address is held only until its entry arrives.

import type { PageWorkTracker } from "./tracker";

type Callable = (this: unknown, ...args: unknown[]) => unknown;

/** The most fetches kept waiting for their entry; one dropped stays outstanding. */
const WAITING_FETCHES_MAX = 500;

/** Wraps the host's `fetch` and `XMLHttpRequest.prototype.send`; answers false when either could not be followed. */
export function installPageWorkRequests(host: Record<string, unknown>, tracker: PageWorkTracker): boolean {
  const listen = EventTarget.prototype.addEventListener;
  const URLClass = URL;
  const fetches: Array<{ id: number; url: string }> = [];
  let complete = true;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if ((entry as PerformanceResourceTiming).initiatorType !== "fetch") continue;
        const at = fetches.findIndex((waiting) => waiting.url === entry.name);
        if (at >= 0) tracker.end(fetches.splice(at, 1)[0]!.id);
      }
    }).observe({ type: "resource" });
  } catch {
    /* best-effort: with no resource timeline a fetch is never told answered, and readiness waits on it as unfinished work */
    complete = false;
  }
  const wrap = (owner: object | undefined, name: string, track: (self: unknown, args: unknown[], id: number) => void): void => {
    const original = owner === undefined ? undefined : (owner as Record<string, unknown>)[name];
    if (typeof original !== "function") {
      complete = false;
      return;
    }
    const wrapped = function (this: unknown, ...args: unknown[]): unknown {
      const id = tracker.begin("request");
      if (id !== undefined) track(this, args, id);
      try {
        return (original as Callable).apply(this, args);
      } catch (error) {
        // A call that threw began nothing that will answer.
        tracker.end(id);
        throw error;
      }
    };
    try {
      Object.defineProperty(owner, name, { value: wrapped, writable: true, configurable: true, enumerable: Object.getOwnPropertyDescriptor(owner, name)?.enumerable ?? true });
    } catch {
      /* best-effort: a request function the page world may not redefine is not followed */
      complete = false;
    }
  };
  wrap(host, "fetch", (_self, args, id) => {
    const url = requestUrl(args[0], URLClass);
    // One whose address cannot be read can never be matched to its entry: it is not followed.
    if (url === undefined) {
      tracker.end(id);
      return;
    }
    fetches.push({ id, url });
    if (fetches.length > WAITING_FETCHES_MAX) fetches.shift();
  });
  const Xhr = host.XMLHttpRequest as { prototype?: object } | undefined;
  wrap(Xhr?.prototype, "send", (self, _args, id) => {
    try {
      listen.call(self as EventTarget, "loadend", () => tracker.end(id), { once: true });
    } catch {
      /* best-effort: an XHR that cannot be listened to stays outstanding, and readiness waits on it as unfinished work */
    }
  });
  return complete;
}

/** The address a `fetch` was asked for, as its resource entry names it; undefined when it cannot be read. */
function requestUrl(input: unknown, URLClass: typeof URL): string | undefined {
  const asked = typeof input === "object" && input !== null && typeof (input as { url?: unknown }).url === "string" ? (input as { url: string }).url : typeof input === "string" || input instanceof URLClass ? String(input) : undefined;
  const base = typeof document === "undefined" ? undefined : document.baseURI;
  // An address that does not parse is a fetch whose answer cannot be matched: it stays outstanding.
  if (asked === undefined || base === undefined || typeof URLClass.canParse !== "function" || !URLClass.canParse(asked, base)) return undefined;
  return new URLClass(asked, base).href;
}
