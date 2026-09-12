// The clear verb: empty the resolved field, and prove it stayed empty.
//
// The post-condition is the same value read-back the type verb uses: a field
// that a page refills from its own `input` or `change` handler, and a target
// that never had a value to clear, report `failed` with Core's
// `output_not_observed` rather than a success that changed nothing.
//
// A field a person could not have reached -- disabled, hidden, or covered --
// is refused first, by the same actionability gate `web.dom.click` uses, so
// the result says why the field was unreachable instead of only that it did
// not end up empty.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function clearAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const element = deps.resolveTarget(action);
  const evidence = () => ({ element: deps.describeElement(element), snapshot: deps.captureSnapshot() });

  const report = deps.checkActionability(element);
  if (!report.actionable) {
    return deps.rejected(action, startedAt, report.code, "a target that can be cleared", report.detail, evidence());
  }

  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return deps.success(action, startedAt, "The target has no value to clear.", {
      status: "failed",
      expected: "a field whose value can be emptied",
      actual: `the target is a <${element.tagName.toLowerCase()}>, which has no value`
    }, evidence());
  }

  element.focus();
  deps.setElementValue(element, "");
  deps.dispatchInputEvents(element);

  const actual = element.value;
  const empty = actual === "";
  return deps.success(action, startedAt, empty ? "Field cleared." : "The field did not stay empty.", {
    status: empty ? "passed" : "failed",
    expected: "the field is empty",
    actual: empty ? "the field is empty" : `the field holds "${actual}"`
  }, evidence());
}
