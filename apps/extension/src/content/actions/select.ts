// The select verb: choose an option in the resolved select element.
//
// A value matching no option still reports success today: `w2-select` adds
// selection by label and index and the validation that compares the selected
// value with the request.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function selectAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const element = deps.resolveTarget(action) as HTMLSelectElement;
  element.focus();
  element.value = action.value ?? "";
  deps.dispatchInputEvents(element);
  return deps.success(action, startedAt, "Option selected.", { status: "none", reason: "not-yet-validated" }, {
    element: deps.describeElement(element),
    snapshot: deps.captureSnapshot()
  });
}
