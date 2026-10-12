// The page-world half of the request-start probe (`shared/request-start-event.ts`,
// t465): counts every request the page begins, as the call is made, and
// answers the content script's question about one press.
//
// It wraps `fetch`, `XMLHttpRequest.prototype.send`, `Navigator.prototype.
// sendBeacon` and `WebSocket.prototype.send` at `document_start`, before any
// page script can take a reference to the originals. Each wrapper adds one to a
// count and calls the original with the same receiver and arguments, returning
// what it returns and throwing what it throws: the page behaves exactly as it
// would without the extension. Nothing about the request -- its address, its
// body, its headers -- is read or kept; only that one began.

import { REQUEST_MARK_EVENT, REQUEST_SINCE_EVENT } from "../shared/request-start-event";
import { inExtensionWorld } from "./extension-world";

type WatchHost = Window & { __fluxiqRequestStartsInstalled?: boolean };

type Callable = (this: unknown, ...args: unknown[]) => unknown;

/** Installs the count in this window, and reports whether it did: false in an isolated world, where it would see no page request. */
export function installRequestStartWatch(): boolean {
  if (inExtensionWorld()) return false;
  const host = window as WatchHost;
  if (host.__fluxiqRequestStartsInstalled === true) return true;
  host.__fluxiqRequestStartsInstalled = true;

  let begun = 0;
  const count = (owner: object | undefined, name: string): void => {
    if (!owner) return;
    const original = (owner as Record<string, unknown>)[name];
    if (typeof original !== "function") return;
    const wrapped = function (this: unknown, ...args: unknown[]): unknown {
      begun += 1;
      return (original as Callable).apply(this, args);
    };
    try {
      const enumerable = Object.getOwnPropertyDescriptor(owner, name)?.enumerable ?? true;
      Object.defineProperty(owner, name, { value: wrapped, writable: true, configurable: true, enumerable });
    } catch {
      /* best-effort: a property the page world may not redefine is left as it is, and those requests are seen only once their response ends, as before */
    }
  };
  count(window, "fetch");
  count(globalThis.XMLHttpRequest?.prototype, "send");
  count(globalThis.Navigator?.prototype, "sendBeacon");
  count(globalThis.WebSocket?.prototype, "send");

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
  return true;
}
