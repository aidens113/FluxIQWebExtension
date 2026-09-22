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
//
// The actionability gate runs first, as it does for click, type and select.
// This verb skipped it until 2026-09-22, and skipping it is how a checkbox
// behind a consent dialog's scrim was set through the scrim: `checked` is a
// property, so setting it succeeds on a page no person could touch, the result
// said `succeeded`, and the run carried on against a page that had filtered
// nothing. A covered control is now refused, and because a modal dialog is
// what covers it, `results.ts` reports BLOCKED_BY_DIALOG -- a state recovery
// can do something about -- rather than a capability refusal.
//
// The gate is read against the thing a person would press. A page that draws
// its own checkbox hides the real input behind a styled label, so a control
// with no box of its own is not out of reach: the label is what is pressed and
// what an overlay would cover, so the label is what is judged. Only a hidden
// control with no label at all is refused as hidden.

import type { ActionabilityReport } from "../action-runtime";
import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function checkAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const { element, resolution } = deps.resolveTarget(action);
  // Absent `checked`, the request is to check: that is what a recorded check step means.
  const requested = action.checked ?? true;
  const expected = `the control is ${stateWord(requested)}`;

  // The gate scrolls the control to the viewport centre before hit-testing it,
  // which is the scroll this verb used to make on its own.
  const report = reachable(element, deps);
  if (!report.actionable) {
    return deps.rejected(action, startedAt, report.code, expected, report.detail, {
      element: deps.describeElement(element),
      snapshot: deps.captureSnapshot(),
      resolution,
      ...(report.point ? { blockedAt: report.point } : {})
    });
  }

  const outcome = deps.setCheckedState(element, requested);
  // Described after the attempt, so the evidence shows the state the page was left in.
  const evidence = { element: deps.describeElement(element), snapshot: deps.captureSnapshot(), resolution };
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

/**
 * Whether the page would let a person set this control: judged on the control
 * itself, and, when the page keeps the control out of sight, on the label
 * bound to it.
 *
 * Only a `hidden` refusal is retried on the label. A disabled control stays
 * disabled however it is drawn, and a covered one is covered where it is.
 */
function reachable(element: Element, deps: ContentActionDependencies): ActionabilityReport {
  const report = deps.checkActionability(element);
  if (report.actionable || report.code !== "hidden") return report;
  const label = pressedInstead(element);
  return label ? deps.checkActionability(label) : report;
}

/**
 * The label bound to the control: `for=` first, then an enclosing `<label>`.
 *
 * The `for=` lookup runs in the control's own tree rather than the document,
 * because an id inside a shadow root names nothing outside it -- the same rule
 * the resolver's shadow scope follows.
 */
function pressedInstead(element: Element): Element | undefined {
  const id = element.getAttribute("id");
  const tree = element.getRootNode() as Document | ShadowRoot;
  const bound = id ? tree.querySelector(`label[for="${cssEscape(id)}"]`) : null;
  return bound ?? element.closest("label") ?? undefined;
}

/** `CSS.escape` where the engine has it, and the two characters that could end the attribute where it does not. */
function cssEscape(value: string): string {
  const api = (globalThis as { CSS?: { escape?: (value: string) => string } }).CSS;
  return typeof api?.escape === "function" ? api.escape(value) : value.replace(/["\\]/gu, "\\$&");
}

function stateWord(checked: boolean): string {
  return checked ? "checked" : "unchecked";
}
