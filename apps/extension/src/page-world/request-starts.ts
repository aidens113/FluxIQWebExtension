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
//
// **Only the press's own requests answer for it (t1094).** A page that sends a
// beacon every second began a request inside almost every press's window, and
// the press was taken as answered and never pressed again: local-classifieds'
// radius Apply, which ignores its first press, failed a saved Flow. So each
// request is recorded with what caused it (`./work-cause/`), and a mark asks only
// about the requests the press may have caused:
// - begun in the armed press's own work (its click handlers, and the timers,
//   frames, microtasks and `then` callbacks they chain into, `./press-work/`):
//   the press's;
// - begun in another armed press's work: not this one's;
// - begun in a timer, interval or frame lineage started before the mark
//   (`./work-cause/work-origins.ts`): set in motion before the press, so not
//   the press's;
// - begun anywhere else (an event, a promise continuation, a message): unsure,
//   so the press's -- a press that may have landed is never pressed again --
//   with one exception. When the press's work was wholly followed (its click
//   seen, its handlers synchronous, every hook intact), a `GET` or `HEAD` fetch
//   of an address the page's own background already asked for before the mark,
//   with the same method, is that background running on: a beacon whose next
//   timer was set by the last beacon's answer. A request that can change
//   anything (any other method, an XHR, a `sendBeacon`, a socket message) is
//   never excused this way.
// A request with no record of its cause is the press's.

import { REQUEST_ANSWERED_EVENT, REQUEST_HEALTH_EVENT, REQUEST_MARK_EVENT, REQUEST_PENDING_EVENT, REQUEST_SINCE_EVENT } from "../shared/request-start-event";
import { inExtensionWorld } from "./extension-world";
import { pressOwners, workOrigins } from "./work-cause";

type WatchHost = Window & { __fluxiqRequestStartsInstalled?: boolean };

type Callable = (this: unknown, ...args: unknown[]) => unknown;

/** How a counted request's answer is told: a fetch by its resource entry, an XHR by its `loadend`, a beacon never awaited, a socket message never told. */
type Answer = "fetch" | "xhr" | "beacon" | "socket";

/** The most fetches kept waiting for their resource entry; one dropped stays open, which only keeps a press's window as long as it was. */
const OPEN_FETCHES_MAX = 500;
/** The most requests whose cause is kept; one whose record was dropped is a press's, as an unsure one is. */
const RECORDS_MAX = 1_000;
/** The most background addresses remembered; past it, a new one is not, and its requests stay counted. */
const QUIET_SOURCES_MAX = 2_000;

/** What caused one counted request (header). */
type RequestCause = {
  /** The scheduled lineage it was begun in, if any. */
  origin: number | undefined;
  /** The armed presses whose work it was begun in. */
  owners: readonly object[];
  /** Method and address without query, for a `GET`/`HEAD` fetch; undefined for anything that may change something. */
  quietKey: string | undefined;
  /** A socket message, which never answers. */
  socket: boolean;
};

/** A press's mark: the requests begun before it, and the origin clock at it. */
type Mark = { begun: number; originAt: number };

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
  const causes = new Map<number, RequestCause>();
  // A `GET`/`HEAD` address the page's background asked for, with the first request that asked it.
  const quietSources = new Map<string, number>();
  const fetches: Array<{ id: number; url: string }> = [];
  const listen = EventTarget.prototype.addEventListener;
  const dispatch = EventTarget.prototype.dispatchEvent;
  const EventClass = Event;
  const URLClass = URL;
  const answered = (id: number): void => {
    if (open.delete(id)) dispatch.call(window, new EventClass(REQUEST_ANSWERED_EVENT));
  };
  const note = (answer: Answer, id: number, args: unknown[]): void => {
    const owners = pressOwners.read().owners();
    const quietKey = answer === "fetch" ? fetchQuietKey(args, URLClass) : undefined;
    causes.set(id, { origin: workOrigins.current, owners, quietKey, socket: answer === "socket" });
    if (causes.size > RECORDS_MAX) causes.delete(causes.keys().next().value as number);
    if (quietKey !== undefined && owners.length === 0 && !quietSources.has(quietKey) && quietSources.size < QUIET_SOURCES_MAX) quietSources.set(quietKey, id);
  };
  const track = (answer: Answer, id: number, self: unknown, args: unknown[]): void => {
    if (answer === "beacon" || answer === "socket") return;
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
      note(answer, id, args);
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

  const marks = new WeakMap<EventTarget, Mark>();
  /** Whether request `id`, begun after `mark` on `target`, may be that press's (header). */
  const mayBePress = (id: number, target: EventTarget, mark: Mark): boolean => {
    const cause = causes.get(id);
    if (cause === undefined) return true;
    const reader = pressOwners.read();
    const own = reader.markOf(target);
    if (own !== undefined && cause.owners.includes(own)) return true;
    if (own !== undefined && cause.owners.length > 0) return false;
    if (cause.origin !== undefined && cause.origin < mark.originAt) return false;
    if (own !== undefined && cause.quietKey !== undefined && reader.followed(target)) {
      const first = quietSources.get(cause.quietKey);
      if (first !== undefined && first <= mark.begun) return false;
    }
    return true;
  };
  /** Whether a request begun since `target`'s mark, and kept by `only`, may be its press's. */
  const pressRequests = (target: EventTarget, mark: Mark, only?: (id: number) => boolean): boolean => {
    for (let id = mark.begun + 1; id <= begun; id += 1) if ((only === undefined || only(id)) && mayBePress(id, target, mark)) return true;
    return false;
  };
  // On `window`, in the capture phase, so an element in an open shadow root is
  // heard too; `composedPath()[0]` is the element itself there.
  window.addEventListener(REQUEST_MARK_EVENT, (event: Event) => {
    const target = event.composedPath()[0];
    if (target === undefined) return;
    marks.set(target, { begun, originAt: workOrigins.tick() });
    event.preventDefault();
  }, true);
  window.addEventListener(REQUEST_SINCE_EVENT, (event: Event) => {
    const target = event.composedPath()[0];
    const mark = target === undefined ? undefined : marks.get(target);
    if (mark !== undefined && target !== undefined && pressRequests(target, mark)) event.preventDefault();
  }, true);
  window.addEventListener(REQUEST_PENDING_EVENT, (event: Event) => {
    const target = event.composedPath()[0];
    const mark = target === undefined ? undefined : marks.get(target);
    if (mark === undefined || target === undefined) return;
    if (pressRequests(target, mark, (id) => open.has(id) || causes.get(id)?.socket === true)) event.preventDefault();
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

/** Method and address without query or fragment of a `GET`/`HEAD` fetch (header); undefined for any other, or one whose method cannot be read without running page code. */
function fetchQuietKey(args: unknown[], URLClass: typeof URL): string | undefined {
  const url = requestUrl(args[0], URLClass);
  const method = url === undefined ? undefined : fetchMethod(args[0], args[1]);
  if (url === undefined || method === undefined) return undefined;
  const verb = method.toUpperCase();
  return verb === "GET" || verb === "HEAD" ? `${verb} ${url.split(/[?#]/u, 1)[0]}` : undefined;
}

/**
 * The method a `fetch` will use, read without running page code: a plain data property of its options, else a genuine
 * `Request`'s own, else `GET`. An options `method` the page defined as an accessor is not called, and answers
 * undefined: a request whose method is unknown may change something.
 */
function fetchMethod(input: unknown, init: unknown): string | undefined {
  if (typeof init === "object" && init !== null) {
    for (let owner: object | null = init; owner !== null && owner !== Object.prototype; owner = Object.getPrototypeOf(owner) as object | null) {
      const property = Object.getOwnPropertyDescriptor(owner, "method");
      if (property === undefined) continue;
      if (!Object.hasOwn(property, "value")) return undefined;
      if (property.value === undefined) break;
      return typeof property.value === "string" ? property.value : undefined;
    }
  }
  if (typeof Request === "function" && input instanceof Request) return requestMethod?.call(input) as string | undefined;
  return "GET";
}

/** `Request.prototype.method`'s own getter, taken when this module loads, before any page script runs. */
const requestMethod = typeof Request === "function" ? Object.getOwnPropertyDescriptor(Request.prototype, "method")?.get : undefined;
