// The page-world half of the window-open signal (`shared/request-start-event.ts`,
// task speed S10): each time the page calls `window.open`, a bare
// `WINDOW_OPEN_EVENT` on `window`, before the call is made.
//
// A press whose handler opens a tab of its own fires no navigation in its own
// document, so the content script, watching that document
// (`content/action-runtime/navigation-watch/`), could not tell such a press
// from one that did nothing, and the worker had to give every press a fixed
// grace for a tab to appear. The wrapper calls the original with the same
// receiver and arguments and returns what it returns: the page behaves exactly
// as it would without the extension. Nothing about the call -- the address,
// the target, the features -- is read.

import { WINDOW_OPEN_EVENT } from "../shared/request-start-event";
import { inExtensionWorld } from "./extension-world";

type WatchHost = Window & { __fluxiqWindowOpensInstalled?: boolean };

/** Installs the signal in this window, and reports whether it did: false in an isolated world. */
export function installWindowOpenWatch(): boolean {
  if (inExtensionWorld()) return false;
  const host = window as WatchHost;
  if (host.__fluxiqWindowOpensInstalled === true) return true;
  host.__fluxiqWindowOpensInstalled = true;
  const original = window.open;
  if (typeof original !== "function") return false;
  const dispatch = EventTarget.prototype.dispatchEvent;
  const EventClass = Event;
  const wrapped = function (this: unknown, ...args: Parameters<typeof window.open>): ReturnType<typeof window.open> {
    dispatch.call(window, new EventClass(WINDOW_OPEN_EVENT));
    return original.apply(this, args);
  };
  try {
    const enumerable = Object.getOwnPropertyDescriptor(window, "open")?.enumerable ?? true;
    Object.defineProperty(window, "open", { value: wrapped, writable: true, configurable: true, enumerable });
    return true;
  } catch {
    /* a window whose open cannot be redefined says nothing, and the worker keeps its grace */
    return false;
  }
}
