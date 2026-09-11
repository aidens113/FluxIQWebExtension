// The extract verb: read a value from the resolved target.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function extractAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const element = deps.resolveTarget(action);
  const extracted = deps.extractElement(element, action.options);
  return deps.success(action, startedAt, "Value extracted.", deps.describeElement(element), deps.captureSnapshot(), extracted);
}
