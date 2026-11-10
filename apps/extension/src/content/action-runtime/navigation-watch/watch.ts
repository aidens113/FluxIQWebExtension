// What the document itself says about navigation while one action runs (task
// speed S10).
//
// After a press that answered without navigating, the worker waited a fixed
// 300 ms for a navigation to start (`runtime/click-landing.ts`), because the
// browser's own navigation events reach the worker on another channel than the
// content script's reply, and a navigation the press began could arrive after
// it. The document knows first: the Navigation API's `navigate` event fires in
// the page as a link, a form or a script begins to leave it, synchronously
// with the press that began it, and `beforeunload` and `pagehide` as the
// document goes. So the content script watches its own document from the
// start of the action to its reply and says whether a navigation began. The
// reply comes only once the press's own answer windows have closed
// (`actions/click.ts`), so a navigation or a new tab the press started by then
// has already reached the worker; nothing is left for a fixed wait to catch.
//
// It says nothing -- and the worker keeps its wait -- where it cannot vouch:
// a page with no Navigation API (`window.navigation`), and a control whose page
// opens in another browsing context (a link's or form's `target`, a submit
// button's `formtarget`, or the document's `<base target>`), whose navigation
// is the new tab's and fires no event here.

import type { ActionNavigationSeen } from "../../../shared/protocol";
import { opensElsewhere } from "./opens-elsewhere";

export type ActionNavigationWatch = {
  /** What was seen, for an action whose control was `target` (when it had one); stops the watch. */
  seen(target: Element | undefined): ActionNavigationSeen | undefined;
  /** Stops without an answer; safe to call more than once. */
  stop(): void;
};

/** A destination as the Navigation API's `navigate` event names it: only whether it stays in this document is read. */
type NavigateEvent = Event & { destination?: { sameDocument?: boolean } };

/** Starts watching `view`'s own document for a navigation that leaves it. */
export function watchActionNavigation(view: Window | undefined = typeof window === "undefined" ? undefined : window): ActionNavigationWatch {
  const navigation = (view as (Window & { navigation?: EventTarget }) | undefined)?.navigation;
  if (!view || !navigation || typeof navigation.addEventListener !== "function") return { seen: () => undefined, stop: () => undefined };
  let began = false;
  const onNavigate = (event: Event): void => {
    // A fragment or `history` move stays in the document; anything else leaves it.
    if ((event as NavigateEvent).destination?.sameDocument !== true) began = true;
  };
  const onLeave = (): void => {
    began = true;
  };
  navigation.addEventListener("navigate", onNavigate);
  view.addEventListener("beforeunload", onLeave);
  view.addEventListener("pagehide", onLeave);
  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    navigation.removeEventListener("navigate", onNavigate);
    view.removeEventListener("beforeunload", onLeave);
    view.removeEventListener("pagehide", onLeave);
  };
  return {
    seen(target) {
      stop();
      if (target !== undefined && opensElsewhere(target, view.document)) return undefined;
      return { began };
    },
    stop
  };
}
