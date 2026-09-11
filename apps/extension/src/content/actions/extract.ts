// The extract verb: read a value from the resolved target.
//
// Reading is not acting, so there is no post-condition to check and the
// validation is `evidence-only`. Whether the value is the expected one is an
// authored `web.dom.assert`, not this verb's business.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function extractAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const element = deps.resolveTarget(action);
  const extracted = deps.extractElement(element, action.options);
  return deps.success(action, startedAt, "Value extracted.", { status: "none", reason: "evidence-only" }, {
    element: deps.describeElement(element),
    snapshot: deps.captureSnapshot(),
    extracted
  });
}
