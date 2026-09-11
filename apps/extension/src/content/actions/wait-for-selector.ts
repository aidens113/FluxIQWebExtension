// The wait-for-selector verb: succeed once an element matches the selector.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export async function waitForSelectorAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  const element = await deps.waitForElement(action.selector, action.timeoutMs);
  return deps.success(action, startedAt, "Selector found.", deps.describeElement(element), deps.captureSnapshot());
}
