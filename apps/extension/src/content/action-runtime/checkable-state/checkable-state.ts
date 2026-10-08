// Setting a checkbox or radio to a requested state rather than toggling it.
//
// A click toggles, so replaying a recorded click can leave a control in the
// opposite state to the one recorded. This presses only when needed and reports
// what the control was left holding, so the verb can compare `checked` with the
// request. An element that is neither a checkbox nor a radio is refused rather
// than coerced.
//
// Three things are refused instead of faked, because each would otherwise
// report success while the page disagreed:
//
// - a control that is not a checkbox or radio, including one disabled by an
//   ancestor `<fieldset disabled>`, which `:disabled` accounts for and the
//   `disabled` property alone does not;
// - a control a person could not operate: `:disabled` or `aria-disabled`;
// - unchecking a radio, which no user gesture can do -- a group is left without
//   a selection only by resetting the form, so the request names the wrong
//   control and the caller should check the radio it wants instead.
//
// `checked` is read back from the element *after* the events are dispatched, so
// a handler that reverts the change is reported as the control's real state
// rather than as the state that was asked for.
//
// **A control the page draws itself** (t364) -- a `<div>` swatch or chip, a
// toggle button, a tab -- is set by its chosen state where the page shows one
// (`./chosen-state.ts`): already chosen is a success that presses nothing;
// otherwise one press, with the same gesture a click makes, then the state read
// back. A control that shows no chosen state is refused with a sentence that
// says so, because pressing it would toggle a state nobody can confirm. A
// `<label>` bound to a checkbox or radio sets that control.

import { readChosenState } from "./chosen-state";
import { dispatchClickGesture, type ClickPoint } from "../click-gesture";

/** Why a control could not be set; `code` lets the verb choose the failure category. */
export type CheckableStateOutcome =
  | { ok: true; kind: "checkbox" | "radio"; checked: boolean; changed: boolean }
  | { ok: true; kind: "option"; checked: boolean; changed: boolean; shownBy: string }
  | { ok: false; reason: string; code?: "not-checkable" | "disabled" | undefined };

const FIELD_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** Sets the control to `checked`; `point` is where a press on a control the page draws itself lands. */
export async function setCheckedState(element: Element, checked: boolean, point?: ClickPoint): Promise<CheckableStateOutcome> {
  const input = checkableInput(element) ?? labelledInput(element);
  if (input) return setInputState(input, checked);
  // A text field, a dropdown or a file box holds a value, not a chosen state: a press would only focus it.
  if (FIELD_TAGS.has(element.tagName)) return { ok: false, reason: `${describeTarget(element)} is not a checkbox or a radio`, code: "not-checkable" };
  return setChosenState(element, checked, point);
}

async function setInputState(input: HTMLInputElement, checked: boolean): Promise<CheckableStateOutcome> {
  if (isDisabled(input)) {
    return { ok: false, reason: `the ${kindOf(input)} is disabled`, code: "disabled" };
  }
  if (kindOf(input) === "radio" && !checked) {
    return { ok: false, reason: "a radio cannot be unchecked; check another radio in its group instead", code: "not-checkable" };
  }
  const kind = kindOf(input);
  if (input.checked === checked) return { ok: true, kind, checked: input.checked, changed: false };

  input.focus();
  // Native activation updates checked and delivers click/input/change in their
  // browser order. Property assignment bypasses click-controlled application
  // state. One activation only: a revert must fail, never toggle a second time.
  input.click();
  // Bounded observation allows application microtasks/render handlers to revert
  // the control. A timer works in background tabs where rAF may not run. This
  // is a 50ms observation window, not proof against a future delayed change.
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
  if (!input.isConnected) return { ok: false, reason: "the control was detached before its checked state could be confirmed", code: "not-checkable" };
  return { ok: true, kind, checked: input.checked, changed: true };
}

/**
 * A control the page draws itself, set by the chosen state it shows. Disabled
 * is judged first: a sold-out option is drawn apart too, and its refusing
 * cursor is what says why it cannot be chosen.
 */
async function setChosenState(element: Element, checked: boolean, point: ClickPoint | undefined): Promise<CheckableStateOutcome> {
  if (refusesPress(element)) return { ok: false, reason: `${describeTarget(element)} is disabled`, code: "disabled" };
  const before = readChosenState(element);
  if (!before) {
    return { ok: false, reason: `${describeTarget(element)} shows no chosen state to read: it is not a checkbox or a radio, it has no aria-checked, aria-pressed or aria-selected, and it is not one of a row of like options drawn apart when chosen`, code: "not-checkable" };
  }
  if (before.chosen === checked) return { ok: true, kind: "option", checked, changed: false, shownBy: before.shownBy };
  if (!checked && !before.clearable) {
    return { ok: false, reason: `this option cannot be cleared (${before.shownBy}); choose another option in its group instead`, code: "not-checkable" };
  }
  dispatchClickGesture(element, point ?? centreOf(element));
  // The same bounded observation as a native control, for a page that redraws
  // its picker in a handler or a microtask after the press.
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
  if (!element.isConnected) return { ok: false, reason: "the control was detached before its chosen state could be confirmed", code: "not-checkable" };
  const after = readChosenState(element);
  // Pressed but unreadable afterwards: reported as not in the asked state, so the post-condition fails rather than passes.
  if (!after) return { ok: true, kind: "option", checked: !checked, changed: true, shownBy: "no chosen state could be read after the press" };
  return { ok: true, kind: "option", checked: after.chosen, changed: true, shownBy: after.shownBy };
}

/** The element as a checkable input, by tag and type rather than `instanceof`, which a cross-realm node fails. */
function checkableInput(element: Element): HTMLInputElement | undefined {
  if (element.tagName !== "INPUT") return undefined;
  const input = element as HTMLInputElement;
  return input.type === "checkbox" || input.type === "radio" ? input : undefined;
}

/** The checkbox or radio a `<label>` is bound to, by `for=` or by holding it. */
function labelledInput(element: Element): HTMLInputElement | undefined {
  if (element.tagName !== "LABEL") return undefined;
  const control = (element as HTMLLabelElement).control;
  return control ? checkableInput(control) : undefined;
}

function kindOf(input: HTMLInputElement): "checkbox" | "radio" {
  return input.type === "radio" ? "radio" : "checkbox";
}

/** `:disabled` covers an ancestor `<fieldset disabled>`; `aria-disabled` covers a control the page only claims is off. */
function isDisabled(input: HTMLInputElement): boolean {
  return input.matches(":disabled") || input.getAttribute("aria-disabled") === "true";
}

/** `:disabled`, `aria-disabled`, or the cursor a sold-out option shows. Styles are unknown where nothing computes them, as in a unit test's hand-built page. */
function refusesPress(element: Element): boolean {
  if (element.matches(":disabled") || element.getAttribute("aria-disabled") === "true") return true;
  return typeof getComputedStyle === "function" && getComputedStyle(element).cursor === "not-allowed";
}

function centreOf(element: Element): ClickPoint {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function describeTarget(element: Element): string {
  const type = element.tagName === "INPUT" ? `[type=${(element as HTMLInputElement).type}]` : "";
  return `<${element.tagName.toLowerCase()}${type}>`;
}
