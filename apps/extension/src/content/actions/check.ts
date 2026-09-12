// The check verb: set a checkbox or radio to a requested state.
//
// The point of a verb separate from click is idempotence: a click toggles, so
// replaying one against a page whose state already moved leaves the control in
// the opposite state to the recorded one. `deps.setCheckedState` sets the state
// asked for, and the validation compares the control's `checked` -- read back
// after its events ran -- with the request, so a handler that reverted the
// change reports a failed post-condition instead of a silent success.
//
// A control that cannot be set is ACTION_REJECTED rather than a failed
// post-condition: nothing was attempted on the page, so there is no observed
// effect to compare. `disabled` is the shared rejection code the actionability
// gate also uses; `not_checkable` covers a target that is not a checkbox or
// radio, and unchecking a radio, which no user gesture can do.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function checkAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const element = deps.resolveTarget(action);
  // Absent `checked`, the request is to check: that is what a recorded check step means.
  const requested = action.checked ?? true;
  deps.scrollElementIntoView(element);

  const outcome = deps.setCheckedState(element, requested);
  // Described after the attempt, so the evidence shows the state the page was left in.
  const evidence = { element: deps.describeElement(element), snapshot: deps.captureSnapshot() };
  const expected = `the control is ${stateWord(requested)}`;
  if (!outcome.ok) {
    const code = outcome.code === "disabled" ? "disabled" : "not_checkable";
    return deps.rejected(action, startedAt, code, expected, outcome.reason, evidence);
  }

  const actual = `the ${outcome.kind} is ${stateWord(outcome.checked)}`;
  const validation = outcome.checked === requested
    ? ({ status: "passed", expected, actual } as const)
    : ({ status: "failed", expected, actual } as const);
  return deps.success(action, startedAt, outcome.changed ? "Check state set." : "Check state already set.", validation, evidence);
}

function stateWord(checked: boolean): string {
  return checked ? "checked" : "unchecked";
}
