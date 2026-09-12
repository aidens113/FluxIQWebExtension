// What has just been interacted with, whether or not anyone is recording.
//
// `event-elements.ts` already remembers the elements an event path touched, but
// only `dom-events.ts` feeds it and every one of those listeners returns early
// unless recording is on. So during a run -- which is when a reader needs to
// know what the last action touched -- the queue is empty. This ledger is the
// runtime half: the same events, no recording gate, and nothing emitted.
//
// Trusted and untrusted events both count, and that is deliberate. The recorder
// filters untrusted events because a synthetic one is not something a person
// did; here the automation's own clicks and input are exactly what "recently
// interacted" has to include, because they are what changed the page between
// one snapshot and the next.
//
// The listeners are installed when this module loads, in the capture phase, so
// a page that calls `stopPropagation` cannot hide its own interactions. They do
// nothing but push into a bounded list: no `preventDefault`, no reads of the
// DOM, and no allocation per event beyond the list itself.

import { actionEventTarget, eventTargetElement } from "../event-elements";

const MAX_TRACKED_INTERACTIONS = 25;
const TRACKED_EVENTS = ["pointerdown", "click", "input", "change", "submit", "keydown"] as const;

/** Most recent last. Bounded, so a long session cannot grow it. */
const recent: Element[] = [];

/** The elements interacted with most recently, for the snapshot to flag. */
export function recentlyInteractedElements(): ReadonlySet<Element> {
  return new Set(recent);
}

/** Records one element as just interacted with, moving a repeat to the front of the queue. */
export function rememberInteractedElement(element: Element | null | undefined): void {
  if (!element) return;
  const existing = recent.indexOf(element);
  if (existing >= 0) recent.splice(existing, 1);
  recent.push(element);
  while (recent.length > MAX_TRACKED_INTERACTIONS) recent.shift();
}

/** Clears the ledger. Exists for tests; nothing in the content script calls it. */
export function forgetInteractedElements(): void {
  recent.length = 0;
}

function trackInteractions(): void {
  const remember = (event: Event): void => {
    const target = eventTargetElement(event);
    if (!target) return;
    rememberInteractedElement(target);
    rememberInteractedElement(actionEventTarget(target));
  };
  for (const type of TRACKED_EVENTS) document.addEventListener(type, remember, { capture: true, passive: true });
}

// Installed on load rather than from `content/index.ts`: the ledger has to be
// listening before the first action runs, and the entry point wires behaviour
// the recorder owns, not evidence the snapshot owns. The guard keeps the module
// importable from a Node test, which has no document.
if (typeof document !== "undefined") trackInteractions();
