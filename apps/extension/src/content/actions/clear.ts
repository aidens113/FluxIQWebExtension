// The clear verb: empty the resolved field.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function clearAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const element = deps.resolveTarget(action) as HTMLInputElement | HTMLTextAreaElement;
  element.focus();
  deps.setElementValue(element, "");
  deps.dispatchInputEvents(element);
  return deps.success(action, startedAt, "Field cleared.", deps.describeElement(element), deps.captureSnapshot());
}
