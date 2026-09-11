// Setting a checkbox or radio to a requested state rather than toggling it.
//
// A click toggles, so replaying a recorded click can leave a control in the
// opposite state to the one recorded. This sets the state directly and reports
// what the control was left holding, so the verb can compare `checked` with the
// request. An element that is neither a checkbox nor a radio is refused rather
// than coerced.
//
// Owned by `w2-check-assert`, which replaces this stub.

export type CheckableStateOutcome =
  | { ok: true; kind: "checkbox" | "radio"; checked: boolean; changed: boolean }
  | { ok: false; reason: string };

export function setCheckedState(_element: Element, _checked: boolean): CheckableStateOutcome {
  throw new Error("The checkable-state capability is not implemented yet.");
}
