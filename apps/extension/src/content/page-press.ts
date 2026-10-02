// The content-script half of the press probe (`../shared/press-probe-event.ts`,
// t229): whether the page bound a press listener to this element in its own
// world, where this script cannot see it.

import { PRESS_PROBE_EVENT } from "../shared/press-probe-event";

/**
 * True when the page world says the page listens for presses on the element.
 * False where nothing answers -- a browser that runs no page-world script, a
 * test's hand-built element -- which is what the capture said before it asked.
 */
export function pageListensForPress(element: Element): boolean {
  if (typeof CustomEvent !== "function" || typeof element.dispatchEvent !== "function") return false;
  return !element.dispatchEvent(new CustomEvent(PRESS_PROBE_EVENT, { cancelable: true, composed: true }));
}
