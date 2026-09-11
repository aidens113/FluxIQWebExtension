// The wait-for-selector verb: succeed once an element matches the selector.
//
// Running out of time is not the same as failing, so a timeout reports
// `timed_out` with Core's `timeout` category rather than a flattened `failed`.
// `w2-waits` adds the visible, enabled, absent, url, and stable conditions
// through the wait-conditions capability.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export async function waitForSelectorAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  const expected = `an element matching ${action.selector ?? "(no selector)"}`;
  let element: Element;
  try {
    element = await deps.waitForElement(action.selector, action.timeoutMs);
  } catch (error) {
    return deps.timedOut(action, startedAt, error instanceof Error ? error.message : "Timed out waiting for selector.", {
      status: "failed",
      expected,
      actual: "no element matched before the timeout"
    }, { snapshot: deps.captureSnapshot() });
  }
  return deps.success(action, startedAt, "Selector found.", { status: "passed", expected, actual: "the element was found" }, {
    element: deps.describeElement(element),
    snapshot: deps.captureSnapshot()
  });
}
