// The select verb: choose an option in the resolved select element.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function selectAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const element = deps.resolveTarget(action) as HTMLSelectElement;
  element.focus();
  element.value = action.value ?? "";
  deps.dispatchInputEvents(element);
  return deps.success(action, startedAt, "Option selected.", deps.describeElement(element), deps.captureSnapshot());
}
