// The assert verb: check an authored expectation about the page.
//
// Registered so the action type is reachable and fails honestly; the behaviour
// is `w2-check-assert`'s, through `deps.evaluateAssertion`. An expectation that
// does not hold is STATE_MISMATCH with the expected and actual values.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function assertAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  return deps.notImplemented(action, startedAt, "web.dom.assert");
}
