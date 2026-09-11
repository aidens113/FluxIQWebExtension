// The scroll verb: scroll the window to the requested position.
//
// Absolute top-window offsets only: `w2-scroll` adds the `by`, `toElement`, and
// `untilStable` modes and the validation that records the position change.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function scrollAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  window.scrollTo({
    left: Number(action.options?.x ?? action.coordinates?.x ?? window.scrollX),
    top: Number(action.options?.y ?? action.coordinates?.y ?? window.scrollY),
    behavior: action.options?.smooth === true ? "smooth" : "instant"
  });
  return deps.success(action, startedAt, "Page scrolled.", { status: "none", reason: "not-yet-validated" }, {
    snapshot: deps.captureSnapshot()
  });
}
