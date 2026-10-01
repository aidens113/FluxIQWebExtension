// Listens on the page, from just before a press, for any sign the press was
// answered (`press-again.ts` says what each sign is and why any one of them
// forbids a second press). Four listeners, each reporting its own sign:
//
// - **request**: a resource entry of initiator type fetch, xmlhttprequest or
//   beacon that started after the press. Read through a `PerformanceObserver`
//   (which still sees entries once the timeline buffer is full), flushed with
//   `takeRecords`, and through `getEntriesByType` where there is no observer.
//   A resource entry is only written once its response ends, so a request
//   still in flight when the window closes, on a press that changed nothing
//   else, is not seen: the one way this can let a second press follow a first
//   that reached the server. A page that sends a request on a press nearly
//   always marks it too -- the control disabled, a spinner -- and that is seen.
// - **change**: any mutation -- a child added or removed, an attribute, text --
//   inside the pressed control's scope (`press-scope.ts`), the control's own
//   `disabled` and `aria-*` included, and inside every shadow root in that
//   scope (`scope-roots.ts`): the roots the scope's walk crossed on its way up
//   from the control, closed ones too, and every open root beneath the scope,
//   nested ones included. A `MutationObserver` does not descend into a shadow
//   root, so until 2026-10-01 a widget that answers a press only inside its own
//   root was read as ignoring it and pressed twice: bigbox's store chip opens
//   its chooser inside `vr-fulfillment-picker`'s root, and the second press
//   shut it again, so no store could be picked (lane A, `t174-w33`);
//   crossborder's coupon was claimed twice the same way (`t174-w32`);
//   local-classifieds' radius chip, itself inside the picker's root, shut its
//   own panel (lane C, `t194-w24`). Mutations elsewhere on the page are its own
//   motion and are not observed at all.
// - **navigation**: the address differs from the one at the press, or the
//   document began to leave (`beforeunload`, `pagehide`, the Navigation API's
//   `navigate`, which a history-API move fires too).
// - **focus**: focus moved to an element that neither holds nor is held by the
//   pressed control. The press's own focus move lands on the control or the
//   focusable ancestor it sits in, so it is not counted.
//
// Nothing here presses anything, and nothing the page wrote is read.

import { composedContains } from "../../shadow-dom";
import { scopeRoots } from "./scope-roots";
import { pressScope } from "./press-scope";
import type { PressSignal } from "./press-again";

/** A running listener: `flush` delivers what the page has queued but not yet reported; `stop` ends it. */
export type PressListener = { flush(): void; stop(): void };

/** The resource initiators that are the page talking to a server. */
const REQUEST_INITIATORS = new Set(["fetch", "xmlhttprequest", "beacon"]);

const OBSERVED: MutationObserverInit = { childList: true, subtree: true, attributes: true, characterData: true };

type ResourceEntry = { startTime: number; initiatorType?: string };

type PressWindow = Window & { navigation?: EventTarget };

/**
 * The observers the listener builds, and the timeline it reads. The content
 * script's own by default, as every other watch in this directory uses them:
 * the script runs in each frame, so its globals are the pressed element's
 * frame's. Injected by tests, which run where there is no DOM.
 */
export type PressPage = {
  MutationObserver?: typeof MutationObserver | undefined;
  PerformanceObserver?: typeof PerformanceObserver | undefined;
  performance?: Performance | undefined;
};

function contentScriptPage(): PressPage {
  return {
    MutationObserver: globalThis.MutationObserver,
    PerformanceObserver: globalThis.PerformanceObserver,
    performance: globalThis.performance
  };
}

/** Starts listening on `pressed`'s page; each sign seen is handed to `note`, possibly more than once. */
export function listenForPressAnswer(pressed: Element, note: (signal: PressSignal) => void, page: PressPage = contentScriptPage()): PressListener {
  const document = pressed.ownerDocument;
  const view = (document?.defaultView ?? undefined) as PressWindow | undefined;
  const listeners = [
    listenForChange(pressed, page, note),
    listenForRequests(page, note),
    listenForLeaving(document, view, note),
    listenForFocus(pressed, document, note)
  ];
  let stopped = false;
  return {
    flush() {
      if (!stopped) listeners.forEach((listener) => listener.flush());
    },
    stop() {
      if (stopped) return;
      stopped = true;
      listeners.forEach((listener) => listener.stop());
    }
  };
}

const NOTHING: PressListener = { flush: () => undefined, stop: () => undefined };

function listenForChange(pressed: Element, page: PressPage, note: (signal: PressSignal) => void): PressListener {
  const Observer = page.MutationObserver;
  if (typeof Observer !== "function") return NOTHING;
  const observer = new Observer((records) => {
    if (records.length > 0) note("change");
  });
  const scope = pressScope(pressed);
  observer.observe(scope, OBSERVED);
  // A subtree observation stops at every shadow boundary; each root inside
  // the scope is observed in its own right (`scope-roots.ts`).
  for (const root of scopeRoots(pressed, scope)) observer.observe(root, OBSERVED);
  return {
    flush() {
      if (observer.takeRecords().length > 0) note("change");
    },
    stop: () => observer.disconnect()
  };
}

function listenForRequests(page: PressPage, note: (signal: PressSignal) => void): PressListener {
  const performance = page.performance;
  if (!performance || typeof performance.now !== "function") return NOTHING;
  const since = performance.now();
  const read = (entries: readonly ResourceEntry[]): void => {
    if (entries.some((entry) => isPressRequest(entry, since))) note("request");
  };
  const Observer = page.PerformanceObserver;
  if (typeof Observer === "function") {
    const observer = new Observer((list) => read(list.getEntries() as unknown as ResourceEntry[]));
    observer.observe({ type: "resource" });
    return {
      flush: () => read(observer.takeRecords() as unknown as ResourceEntry[]),
      stop: () => observer.disconnect()
    };
  }
  if (typeof performance.getEntriesByType !== "function") return NOTHING;
  return {
    flush: () => read(performance.getEntriesByType("resource") as unknown as ResourceEntry[]),
    stop: () => undefined
  };
}

/** A request the page began at or after the press. */
function isPressRequest(entry: ResourceEntry, since: number): boolean {
  return entry.startTime >= since && REQUEST_INITIATORS.has(String(entry.initiatorType ?? ""));
}

function listenForLeaving(document: Document | undefined, view: PressWindow | undefined, note: (signal: PressSignal) => void): PressListener {
  const address = document?.location?.href;
  const moved = (): void => {
    const now = document?.location?.href;
    if (address !== undefined && now !== undefined && now !== address) note("navigation");
  };
  if (!view || typeof view.addEventListener !== "function") return { flush: moved, stop: () => undefined };
  const leave = (): void => note("navigation");
  const navigation = view.navigation && typeof view.navigation.addEventListener === "function" ? view.navigation : undefined;
  view.addEventListener("beforeunload", leave);
  view.addEventListener("pagehide", leave);
  navigation?.addEventListener("navigate", leave);
  return {
    flush: moved,
    stop() {
      view.removeEventListener("beforeunload", leave);
      view.removeEventListener("pagehide", leave);
      navigation?.removeEventListener("navigate", leave);
    }
  };
}

function listenForFocus(pressed: Element, document: Document | undefined, note: (signal: PressSignal) => void): PressListener {
  if (!document || typeof document.addEventListener !== "function") return NOTHING;
  const focused = (event: Event): void => {
    const target = event.target as Node | null;
    if (!target || typeof (target as Element).tagName !== "string") return;
    if (composedContains(pressed, target) || composedContains(target as Element, pressed)) return;
    note("focus");
  };
  document.addEventListener("focusin", focused, true);
  return { flush: () => undefined, stop: () => document.removeEventListener("focusin", focused, true) };
}
