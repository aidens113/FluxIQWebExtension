// A listener for another event that a press's own work registers, and when it
// can run outside the work this watch follows (t1094).
//
// Until t1094 registering one made the press unknown at once. The radius
// picker on local-classifieds re-wires its Apply button on the first press, a
// `keydown` listener among them, so every such press was unknown, and the
// request count could not tell its beacon from the press's own requests
// (`../request-starts.ts`). A listener can only do work when its event fires,
// so the press stops being followed at that moment instead: a window capture
// listener for the event's type hears it before the target's own listeners
// run, and taints the press that registered one on a target in the event's
// path.
//
// The window hears only what reaches it. A target it may not hear -- anything
// that is not a node connected to the document, the window or the document
// (an `XMLHttpRequest`, a port, a detached element), or a node inside a closed
// shadow root, whose nodes the window's listeners never see in the path --
// still makes the press unknown at once, as before. So does a listener for
// leaving the page (`unload`, `beforeunload`): the window must not listen for
// those itself, since a window `unload` listener alone keeps the page out of
// the browser's back-forward cache.

import type { PressWorkTracker } from "./tracker";

type Owners = ReturnType<PressWorkTracker["current"]>;
type Registration = { target: EventTarget; owners: Owners };

/** Event types the window does not listen for itself (header). */
const NOT_HEARD = new Set(["unload", "beforeunload"]);

/** Registrations kept per event type before the ones of presses no longer watched are dropped. */
const PRUNE_AT = 64;

/** Follows listeners registered by a press's work (header); `add` is the page's own `addEventListener`, taken before it was wrapped. */
export function watchLaterListeners(tracker: PressWorkTracker, add: typeof EventTarget.prototype.addEventListener): { registered(target: EventTarget, type: string, owners: Owners): void } {
  const byType = new Map<string, Registration[]>();
  const host = typeof window === "undefined" ? undefined : window;
  const heard = (target: EventTarget): boolean => {
    if (host === undefined) return false;
    if (target === host || typeof document !== "undefined" && target === document) return true;
    if (typeof Node !== "function" || !(target instanceof Node) || !target.isConnected) return false;
    for (let root = target.getRootNode(); typeof ShadowRoot === "function" && root instanceof ShadowRoot; root = root.host.getRootNode()) {
      if (root.mode !== "open") return false;
    }
    return true;
  };
  const listen = (type: string): Registration[] => {
    const known = byType.get(type);
    if (known) return known;
    const kept: Registration[] = [];
    byType.set(type, kept);
    add.call(host!, type, (event: Event) => {
      let path: EventTarget[];
      try {
        path = event.composedPath();
      } catch {
        path = [];
      }
      for (const registration of kept) {
        if (path.length === 0 || path.includes(registration.target)) tracker.taint(registration.owners);
      }
    }, { capture: true, passive: true });
    return kept;
  };
  return {
    registered(target, type, owners) {
      if (owners.length === 0) return;
      if (NOT_HEARD.has(type) || !heard(target)) {
        tracker.taint(owners);
        return;
      }
      const kept = listen(type);
      if (kept.length >= PRUNE_AT) {
        const live = kept.filter((registration) => tracker.live(registration.owners));
        kept.length = 0;
        kept.push(...live);
      }
      kept.push({ target, owners });
    }
  };
}
