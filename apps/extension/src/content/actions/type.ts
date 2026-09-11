// The type verb: enter text into the resolved field.
//
// No value read-back yet: `w2-keyboard-input` adds the per-character key
// sequence and the validation that compares the field with what was requested.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function typeAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const element = deps.resolveTarget(action) as HTMLInputElement | HTMLTextAreaElement;
  element.focus();
  deps.setElementValue(element, action.text ?? action.value ?? "");
  deps.dispatchInputEvents(element);
  return deps.success(action, startedAt, "Text entered.", { status: "none", reason: "not-yet-validated" }, {
    element: deps.describeElement(element),
    snapshot: deps.captureSnapshot()
  });
}
