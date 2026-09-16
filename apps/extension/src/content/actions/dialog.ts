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
// instead of hanging. The dialog the override handled last is carried as the
// result's `dialog`, so the action after a dialog reports what was actually
// answered. It never rides on `extracted`, which holds only what a read took
// off the page.
//
// A prompt's `promptText` is not the page's text: `page-world/dialog-override.ts`
// records the answer the prompt returned. That is the text a Flow supplied,
// which may be a run input, or the page's default when none was supplied, or
// what a person typed into a prompt nothing had armed. It is user data, as a
// typed value is, and there is no element whose sensitivity could clear it, so
// it is always withheld the way a sensitive typed value is (decision D2): by
// `describeFieldValue`'s length marker, never its content. The page's own
// `message` is carried as it was.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ObservedDialog } from "../action-runtime";
import type { ContentActionDependencies } from "./types";
import { describeFieldValue } from "./value-redaction";

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
    ...(previous ? { dialog: observedDialogEvidence(previous) } : {})
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

/**
 * The handled dialog as evidence, field by field. Its message is the page's own
 * text, which Phase 1.4 redacts; a prompt's answer is withheld to its length.
 */
function observedDialogEvidence(observed: ObservedDialog): NonNullable<BrowserActionResult["dialog"]> {
  return {
    kind: observed.kind,
    message: observed.message,
    response: observed.response,
    at: observed.at,
    ...(observed.promptText === undefined ? {} : { promptText: describeFieldValue(observed.promptText, true) })
  };
}
