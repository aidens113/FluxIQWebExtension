// The page-world half of the request-start probe (`shared/request-start-event.ts`,
// t465): counts every request the page begins, as the call is made, and
// answers the content script's question about one press.
//
// It wraps `fetch`, `XMLHttpRequest.prototype.send`, `Navigator.prototype.
// sendBeacon` and `WebSocket.prototype.send` at `document_start`, before any
// page script can take a reference to the originals. Each wrapper adds one to a
// count and calls the original with the same receiver and arguments, returning
// what it returns and throwing what it throws: the page behaves exactly as it
// would without the extension. Nothing about the request -- its body, its
// headers -- is read, and nothing leaves this world but whether one began and
// whether it answered. A fetch's address is held here until its resource entry
// arrives, because that entry is how its answer is known (task speed S10);
// nothing of the response is read.

import { REQUEST_ANSWERED_EVENT, REQUEST_HEALTH_EVENT, REQUEST_MARK_EVENT, REQUEST_PENDING_EVENT, REQUEST_SINCE_EVENT } from "../shared/request-start-event";
import { inExtensionWorld } from "./extension-world";

type WatchHost = Window & { __fluxiqRequestStartsInstalled?: boolean };

type Callable = (this: unknown, ...args: unknown[]) => unknown;

/** How a counted request's answer is told: a fetch by its resource entry, an XHR by its `loadend`, a beacon never awaited, a socket message never told. */
type Answer = "fetch" | "xhr" | "beacon" | "socket";

/** The most fetches kept waiting for their resource entry; one dropped stays open, which only keeps a press's window as long as it was. */
const OPEN_FETCHES_MAX = 500;

/** Installs the count in this window, and reports whether it did: false in an isolated world, where it would see no page request. */
export function installRequestStartWatch(): boolean {
  if (inExtensionWorld()) return false;
  const host = window as WatchHost;
  if (host.__fluxiqRequestStartsInstalled === true) return true;
  host.__fluxiqRequestStartsInstalled = true;

  let begun = 0;
  // Which of the counted requests have answered (task speed S10, `../shared/request-start-event.ts`).
  // Taken before any page script runs, so the page cannot change how it is told.
  const open = new Set<number>();
  let unanswerable = 0;
  const fetches: Array<{ id: number; url: string }> = [];
  const listen = EventTarget.prototype.addEventListener;
  const dispatch = EventTarget.prototype.dispatchEvent;
  const EventClass = Event;
  const URLClass = URL;
  const answered = (id: number): void => {
    if (open.delete(id)) dispatch.call(window, new EventClass(REQUEST_ANSWERED_EVENT));
  };
  const track = (answer: Answer, id: number, self: unknown, args: unknown[]): void => {
    if (answer === "beacon") return;
    if (answer === "socket") {
      unanswerable = id;
      return;
    }
    open.add(id);
    if (answer === "xhr") {
      try {
        listen.call(self as EventTarget, "loadend", () => answered(id), { once: true });
      } catch {
        /* best-effort: an XHR that cannot be listened to stays open, which only keeps a press's window as long as it was */
      }
      return;
    }
    const url = requestUrl(args[0], URLClass);
    if (url === undefined) return;
    fetches.push({ id, url });
    if (fetches.length > OPEN_FETCHES_MAX) fetches.shift();
  };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if ((entry as PerformanceResourceTiming).initiatorType !== "fetch") continue;
        const at = fetches.findIndex((waiting) => waiting.url === entry.name);
        if (at >= 0) answered(fetches.splice(at, 1)[0]!.id);
      }
    }).observe({ type: "resource" });
  } catch {
    /* best-effort: with no resource timeline every fetch stays open, and a press's window is as long as it was */
  }
  const checked: Array<() => boolean> = [];
  let complete = true;
  const describe = Object.getOwnPropertyDescriptor;
  const count = (owner: object | undefined, name: string, answer: Answer, required = false): void => {
    if (!owner) { if (required) complete = false;
      return; }
    const original = (owner as Record<string, unknown>)[name];
    if (typeof original !== "function") {
      const before = describe(owner, name);
      if (before && !Object.hasOwn(before, "value")) complete = false;
      checked.push(() => {
        const current = describe(owner, name);
        return before === undefined ? current === undefined
          : current !== undefined && Object.hasOwn(current, "value") && current.value === original;
      });
      if (required) complete = false;
      return;
    }
    const wrapped = function (this: unknown, ...args: unknown[]): unknown {
      begun += 1;
      const id = begun;
      track(answer, id, this, args);
      try {
        return (original as Callable).apply(this, args);
      } catch (error) {
        // A call that threw began nothing that will answer.
        answered(id);
        throw error;
      }
    };
    try {
      const enumerable = Object.getOwnPropertyDescriptor(owner, name)?.enumerable ?? true;
      Object.defineProperty(owner, name, { value: wrapped, writable: true, configurable: true, enumerable });
      checked.push(() => {
        const current = describe(owner, name);
        return current !== undefined && Object.hasOwn(current, "value") && current.value === wrapped;
      });
    } catch {
      complete = false;
      /* best-effort: a property the page world may not redefine is left as it is, and those requests are seen only once their response ends, as before */
    }
  };
  count(window, "fetch", "fetch", true);
  count(globalThis.XMLHttpRequest?.prototype, "send", "xhr", true);
  count(globalThis.Navigator?.prototype, "sendBeacon", "beacon");
  count(globalThis.WebSocket?.prototype, "send", "socket");
  for (const name of ["XMLHttpRequest", "Navigator", "WebSocket"]) {
    const before = describe(globalThis, name);
    if (before && !Object.hasOwn(before, "value")) complete = false;
    checked.push(() => {
      const current = describe(globalThis, name);
      return before === undefined ? current === undefined
        : current !== undefined && Object.hasOwn(current, "value") && current.value === before.value;
    });
  }

  const marks = new WeakMap<EventTarget, number>();
  // On `window`, in the capture phase, so an element in an open shadow root is
  // heard too; `composedPath()[0]` is the element itself there.
  window.addEventListener(REQUEST_MARK_EVENT, (event: Event) => {
    const target = event.composedPath()[0];
    if (target === undefined) return;
    marks.set(target, begun);
    event.preventDefault();
  }, true);
  window.addEventListener(REQUEST_SINCE_EVENT, (event: Event) => {
    const target = event.composedPath()[0];
    const mark = target === undefined ? undefined : marks.get(target);
    if (mark !== undefined && begun > mark) event.preventDefault();
  }, true);
  window.addEventListener(REQUEST_PENDING_EVENT, (event: Event) => {
    const target = event.composedPath()[0];
    const mark = target === undefined ? undefined : marks.get(target);
    if (mark === undefined) return;
    if (unanswerable > mark || [...open].some((id) => id > mark)) event.preventDefault();
  }, true);
  window.addEventListener(REQUEST_HEALTH_EVENT, (event: Event) => {
    const target = event.composedPath()[0];
    if (target !== undefined && marks.has(target) && complete && checked.every((check) => check())) event.preventDefault();
  }, true);
  return true;
}

/** The address a `fetch` was asked for, as its resource entry names it; undefined when it cannot be read. */
function requestUrl(input: unknown, URLClass: typeof URL): string | undefined {
  const asked = typeof input === "object" && input !== null && typeof (input as { url?: unknown }).url === "string" ? (input as { url: string }).url : typeof input === "string" || input instanceof URLClass ? String(input) : undefined;
  const base = typeof document === "undefined" ? undefined : document.baseURI;
  // An address that does not parse is a fetch whose answer cannot be matched: it stays open.
  if (asked === undefined || base === undefined || typeof URLClass.canParse !== "function" || !URLClass.canParse(asked, base)) return undefined;
  return new URLClass(asked, base).href;
}
