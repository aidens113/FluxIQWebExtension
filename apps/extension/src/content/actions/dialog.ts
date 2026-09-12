// The dialog verb: arm the answer to the next native dialog.
//
// Arming has to happen before the dialog opens, because a native dialog blocks
// the page's script: once `confirm()` is on the stack nothing else in the page
// runs, so an action sent afterwards would never be delivered. The dialog this
// arms is therefore opened by a *later* action -- the click that triggers it --
// and the answer is proven by what that action leaves behind on the page.
//
// So this verb's own post-condition is the arming, not the dialog: it passes
// when the page-world override acknowledged it, and is refused when the
// override is absent, which is what makes an unanswerable dialog fail fast
// instead of hanging. The dialog the override handled last is carried as
// evidence, so the action after a dialog reports what was actually answered.

import type { BrowserActionCommand, BrowserActionResult, JsonValue } from "../types";
import type { ObservedDialog } from "../action-runtime";
import type { ContentActionDependencies } from "./types";

export function dialogAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const request = action.dialog;
  if (!request) {
    return deps.rejected(action, startedAt, "dialog_no_response", "a dialog response to arm", "the command carried no dialog request");
  }

  const expected = request.response === "accept"
    ? `the next dialog is accepted${request.promptText === undefined ? "" : " with the supplied text"}`
    : "the next dialog is dismissed";
  const armed = deps.dialogControl.arm(request);
  const previous = deps.dialogControl.observed();
  const evidence = {
    snapshot: deps.captureSnapshot(),
    ...(previous ? { extracted: observedAsJson(previous) } : {})
  };

  if (!armed) {
    return deps.rejected(action, startedAt, "dialog_override_missing", expected, "the page-world dialog override is not installed on this page", evidence);
  }
  return deps.success(action, startedAt, "Dialog response armed.", {
    status: "passed",
    expected,
    actual: "the response was armed and acknowledged by the page"
  }, evidence);
}

/** The handled dialog as evidence. Its message is the page's own text, which Phase 1.4 redacts. */
function observedAsJson(observed: ObservedDialog): JsonValue {
  return {
    kind: observed.kind,
    message: observed.message,
    response: observed.response,
    at: observed.at,
    ...(observed.promptText === undefined ? {} : { promptText: observed.promptText })
  };
}
