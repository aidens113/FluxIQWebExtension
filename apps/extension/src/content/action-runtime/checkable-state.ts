// Setting a checkbox or radio to a requested state rather than toggling it.
//
// A click toggles, so replaying a recorded click can leave a control in the
// opposite state to the one recorded. This sets the state directly and reports
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

/** Why a control could not be set; `code` lets the verb choose the failure category. */
export type CheckableStateOutcome =
  | { ok: true; kind: "checkbox" | "radio"; checked: boolean; changed: boolean }
  | { ok: false; reason: string; code?: "not-checkable" | "disabled" | undefined };

export function setCheckedState(element: Element, checked: boolean): CheckableStateOutcome {
  const input = checkableInput(element);
  if (!input) {
    return { ok: false, reason: `${describeTarget(element)} is not a checkbox or a radio`, code: "not-checkable" };
  }
  if (isDisabled(input)) {
    return { ok: false, reason: `the ${kindOf(input)} is disabled`, code: "disabled" };
  }
  if (kindOf(input) === "radio" && !checked) {
    return { ok: false, reason: "a radio cannot be unchecked; check another radio in its group instead", code: "not-checkable" };
  }
  const kind = kindOf(input);
  if (input.checked === checked) return { ok: true, kind, checked: input.checked, changed: false };

  input.focus();
  input.checked = checked;
  // What a real check fires, in order, and both bubble: the page's handler is
  // as often on an enclosing fieldset as on the control itself.
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return { ok: true, kind, checked: input.checked, changed: true };
}

/** The element as a checkable input, by tag and type rather than `instanceof`, which a cross-realm node fails. */
function checkableInput(element: Element): HTMLInputElement | undefined {
  if (element.tagName !== "INPUT") return undefined;
  const input = element as HTMLInputElement;
  return input.type === "checkbox" || input.type === "radio" ? input : undefined;
}

function kindOf(input: HTMLInputElement): "checkbox" | "radio" {
  return input.type === "radio" ? "radio" : "checkbox";
}

/** `:disabled` covers an ancestor `<fieldset disabled>`; `aria-disabled` covers a control the page only claims is off. */
function isDisabled(input: HTMLInputElement): boolean {
  return input.matches(":disabled") || input.getAttribute("aria-disabled") === "true";
}

function describeTarget(element: Element): string {
  const type = element.tagName === "INPUT" ? `[type=${(element as HTMLInputElement).type}]` : "";
  return `<${element.tagName.toLowerCase()}${type}>`;
}
