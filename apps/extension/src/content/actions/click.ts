// The click verb: scroll the resolved target into view, then click it.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function clickAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const element = deps.resolveTarget(action);
  deps.scrollElementIntoView(element);
  (element as HTMLElement).click();
  return deps.success(action, startedAt, "Element clicked.", deps.describeElement(element), deps.captureSnapshot());
}
