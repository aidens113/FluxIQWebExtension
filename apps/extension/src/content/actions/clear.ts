// The clear verb: empty the resolved field.
//
// No value read-back yet: `w2-keyboard-input` adds it with the type verb.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function clearAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const element = deps.resolveTarget(action) as HTMLInputElement | HTMLTextAreaElement;
  element.focus();
  deps.setElementValue(element, "");
  deps.dispatchInputEvents(element);
  return deps.success(action, startedAt, "Field cleared.", { status: "none", reason: "not-yet-validated" }, {
    element: deps.describeElement(element),
    snapshot: deps.captureSnapshot()
  });
}
