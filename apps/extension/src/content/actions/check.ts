// The check verb: set a checkbox or radio to a requested state.
//
// Registered so the action type is reachable and fails honestly; the behaviour
// is `w2-check-assert`'s, through `deps.setCheckedState`. The validation
// compares the control's `checked` with the request.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function checkAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  return deps.notImplemented(action, startedAt, "web.dom.check");
}
