// The page-world half of the press probe (`shared/press-probe-event.ts`,
// t229): remembers every element the page gives a press listener, and answers
// the content script's question about one.
//
// It wraps `EventTarget.prototype.addEventListener` and the `onclick` setter
// at `document_start`, before any page script can add a listener, and records
// the element and nothing else: the listener is passed through untouched, the
// page behaves exactly as it would without the extension, and nothing is
// written to the document. A listener the page removes again is still
// remembered; a probe answers "the page bound a press here", not "a press here
// does something now".

import { PRESS_BINDING_MARK_EVENT, PRESS_BINDING_RELEASE_EVENT, PRESS_BINDING_SINCE_EVENT, PRESS_PROBE_EVENT } from "../shared/press-probe-event";
import { inExtensionWorld } from "./extension-world";

/** The events a person's press fires on what they press. */
const PRESS_EVENTS: ReadonlySet<string> = new Set(["click", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend"]);

type WatchHost = Window & { __fluxiqPressWatchInstalled?: boolean };

/** Installs the watch in this window, and reports whether it did: false in an isolated world, where it would see no page listener. */
export function installPressListenerWatch(): boolean {
  if (inExtensionWorld()) return false;
  const host = window as WatchHost;
  if (host.__fluxiqPressWatchInstalled === true) return true;
  host.__fluxiqPressWatchInstalled = true;

  const listened = new WeakSet<EventTarget>();
  const bindings = new WeakMap<EventTarget, number>();
  const marked = new WeakMap<EventTarget, Map<string, number>>();
  let generation = 0;
  const remember = (target: EventTarget): void => {
    if (target instanceof Element && target !== document.documentElement && target !== document.body) {
      listened.add(target);
      bindings.set(target, ++generation);
    }
  };

  const nativeAdd = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function addEventListener(this: EventTarget, type: string, ...rest: unknown[]): void {
    if (PRESS_EVENTS.has(type) && rest[0] !== null && rest[0] !== undefined) remember(this);
    return (nativeAdd as (this: EventTarget, ...args: unknown[]) => void).call(this, type, ...rest);
  } as typeof EventTarget.prototype.addEventListener;

  const onclick = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "onclick");
  if (onclick?.set && onclick.get && onclick.configurable) {
    const nativeSet = onclick.set;
    Object.defineProperty(HTMLElement.prototype, "onclick", {
      ...onclick,
      set(this: HTMLElement, value: unknown) {
        if (typeof value === "function") remember(this);
        nativeSet.call(this, value);
      }
    });
  }

  // On `window`, in the capture phase, so a probe of an element in an open
  // shadow root is heard too; `composedPath()[0]` is the element itself there.
  nativeAdd.call(window, PRESS_PROBE_EVENT, (event: Event) => {
    const target = event.composedPath()[0];
    if (target !== undefined && listened.has(target)) event.preventDefault();
  }, true);
  // Capture's historical probe above keeps its meaning. Readiness asks a
  // different question: whether a fresh binding was observed after its own
  // first-press mark. An old listener removed before delayed rehydration must
  // not release the second press early.
  nativeAdd.call(window, PRESS_BINDING_MARK_EVENT, (event: Event) => {
    const target = event.composedPath()[0];
    const token: unknown = (event as CustomEvent<unknown>).detail;
    if (target !== undefined && typeof token === "string") {
      const marks = marked.get(target) ?? new Map<string, number>();
      marks.set(token, generation);
      marked.set(target, marks);
      event.preventDefault();
    }
  }, true);
  nativeAdd.call(window, PRESS_BINDING_SINCE_EVENT, (event: Event) => {
    const path = event.composedPath();
    const target = path[0];
    const token: unknown = (event as CustomEvent<unknown>).detail;
    const since = target === undefined || typeof token !== "string" ? undefined : marked.get(target)?.get(token);
    if (since !== undefined && path.some(item => (bindings.get(item) ?? 0) > since)) event.preventDefault();
  }, true);
  nativeAdd.call(window, PRESS_BINDING_RELEASE_EVENT, (event: Event) => {
    const target = event.composedPath()[0];
    const token: unknown = (event as CustomEvent<unknown>).detail;
    if (target === undefined || typeof token !== "string") return;
    const marks = marked.get(target);
    marks?.delete(token);
    if (marks?.size === 0) marked.delete(target);
  }, true);
  return true;
}
