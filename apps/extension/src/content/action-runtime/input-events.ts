// The events a user's edit fires, so page scripts see a programmatic change.

import { actedClock } from "./acted-at";

export function dispatchInputEvents(element: Element): void {
  actedClock.note();
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
