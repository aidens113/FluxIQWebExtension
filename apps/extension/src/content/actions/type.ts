// The type verb: enter text into the resolved field.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function typeAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const element = deps.resolveTarget(action) as HTMLInputElement | HTMLTextAreaElement;
  element.focus();
  deps.setElementValue(element, action.text ?? action.value ?? "");
  deps.dispatchInputEvents(element);
  return deps.success(action, startedAt, "Text entered.", deps.describeElement(element), deps.captureSnapshot());
}
