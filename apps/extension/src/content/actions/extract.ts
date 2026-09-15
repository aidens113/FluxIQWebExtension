// The extract verb: read a value from the resolved target.
//
// Reading is not acting, so there is no post-condition to check and the
// validation is `evidence-only`. Whether the value is the expected one is an
// authored `web.dom.assert`, not this verb's business.
//
// A sensitive control is never read (decision D2). The capability refuses
// before it reads anything, and the refusal is reported the way every other
// reader's is: ACTION_REJECTED with `sensitive_value`, the element described
// by its descriptor, which carries no value, and no `extracted` at all.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function extractAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const { element, resolution } = deps.resolveTarget(action);
  const read = deps.extractElement(element, action.options);
  if (!read.ok) {
    return deps.rejected(
      action,
      startedAt,
      read.refusal,
      "a readable element that is not a sensitive control",
      "the target is a sensitive control, so its value is never read",
      { element: deps.describeElement(element), resolution }
    );
  }
  return deps.success(action, startedAt, "Value extracted.", { status: "none", reason: "evidence-only" }, {
    element: deps.describeElement(element),
    snapshot: deps.captureSnapshot(),
    extracted: read.value,
    resolution
  });
}
