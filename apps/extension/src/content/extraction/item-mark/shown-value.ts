// What a `value` field reads when it says `shown` (invariant I7, "anything
// shown can be read"): the state the page view prints after an element's words,
// read from the very source the view is built from, so a column and the view
// never disagree.
//
// The view's element tokens come from the snapshot's descriptor
// (`../../dom-snapshot.ts`, `../../describe-element.ts`), and four of them have
// no attribute a plain read could return:
//
// - `label`, `options`: a select's chosen option's label and its option labels
//   (`selectState`), where a value read returns the option's value, not the
//   words the page shows. The options read as the labels joined by `|`, the
//   view's own spelling;
// - `checked`: a native checkbox or radio's live `checked` property
//   (`checkedState`), else an `aria-checked` the page states. A value read
//   returns `"on"`. It reads `checked` or `unchecked`, as the view prints;
// - `disabled`: the view calls a control disabled when it has a `disabled`
//   attribute, says `aria-disabled="true"`, or its own cursor refuses a press
//   (`ownPressCursor`), which is computed style and no attribute. It reads
//   `disabled`, and nothing where the control is usable;
// - `marked`: drawn apart from the like options beside it (`setApartFromLikeSiblings`),
//   on an element the snapshot would measure it for (one with a cursor of its
//   own, or one a person acts on). It reads `marked`, and nothing otherwise.
//
// A state that is off reads nothing rather than a word that says no, as every
// other mark's column does, so `where {field, is: "present"}` keeps the rows
// that carry it. `checked` is the one that says both, as the view does. A
// sensitive control yields neither its state nor its options, as the snapshot
// withholds them (`selectState`, `checkedState`).

import { checkedState, selectState } from "../../describe-element";
import { isActionableElement } from "../../element-traits";
import { ownPressCursor, setApartFromLikeSiblings } from "../../evidence";

/** What of an element a `value` field can read besides a control's live value: the members of `WebAutomationExtractValueShown`. */
export type ShownValue = "label" | "options" | "checked" | "disabled" | "marked";

/** The element's `shown` reading, or `undefined` where it has none. */
export function shownValue(element: Element, shown: ShownValue): string | undefined {
  switch (shown) {
    case "label": {
      const state = selectState(element);
      const chosen = state?.options.find((option) => option.value === state.selectedValue);
      return state?.selectedValue === undefined ? undefined : chosen?.label;
    }
    case "options": {
      const state = selectState(element);
      return state === undefined || state.options.length === 0 ? undefined : state.options.map((option) => option.label).join("|");
    }
    case "checked": {
      const checked = checkedState(element) ?? ariaTrueOrFalse(element.getAttribute("aria-checked"));
      return checked === undefined ? undefined : checked ? "checked" : "unchecked";
    }
    case "disabled": {
      const refused = ownPressCursor(element) === "not-allowed";
      return refused || element.hasAttribute("disabled") || (element.getAttribute("aria-disabled") ?? "").trim().toLowerCase() === "true" ? "disabled" : undefined;
    }
    case "marked": {
      const cursor = ownPressCursor(element);
      return (cursor !== undefined || isActionableElement(element)) && setApartFromLikeSiblings(element) ? "marked" : undefined;
    }
  }
}

function ariaTrueOrFalse(value: string | null): boolean | undefined {
  const state = value?.trim().toLowerCase();
  return state === "true" ? true : state === "false" ? false : undefined;
}
