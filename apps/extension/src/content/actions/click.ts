// The click verb: scroll the resolved target into view, then click it.
//
// No actionability gate and no post-condition yet: `w2-click` adds the visible,
// enabled, and hit-test checks and the validation that records them.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function clickAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const element = deps.resolveTarget(action);
  deps.scrollElementIntoView(element);
  (element as HTMLElement).click();
  return deps.success(action, startedAt, "Element clicked.", { status: "none", reason: "not-yet-validated" }, {
    element: deps.describeElement(element),
    snapshot: deps.captureSnapshot()
  });
}
