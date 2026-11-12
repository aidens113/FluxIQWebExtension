// A control's pressed, checked, selected or disabled state as a column of its
// own (contract CC2): the `state` mark.
//
// A row can say what it is to the person by a control's state and nothing
// else: a pressed toggle, a checked row, a selected option. The control is on
// every row, so its words or its name are a column every row fills, and a
// column every row fills cannot say which rows are pressed. Until t800 the
// only way to keep those rows was a Flow that read the control's state
// attribute and tested its text for `"true"`, and nothing offered that column.
//
// So an element that states one of those ARIA states is also offered as a
// column read only while the state is on: its selector is the element's own
// with `[state="true"]` added, so a row whose control is off has no element for
// it and its record carries nothing. The column reads the control's words, or
// where it has none its name (`aria-label`, `title`), or where it has neither
// the state itself (`"true"`). Each reading is the plain reader's, and a value
// only where the state is on is exactly what `where {field, is: "present"}`
// needs, on the page and in Core's processing of the stored rows alike.
//
// Only `"true"` is on, as ARIA defines it: `"false"`, `"mixed"` and an empty
// value are off. The label is the element's path with the state's own word
// (`(pressed)`), which is page structure, never the control's words. A
// sensitive control is never offered here.
//
// **Disabled is a state too (t885, R1).** A booking calendar marks a taken
// time `aria-disabled="true"` and a free one `"false"`; the page view printed
// `disabled` beside the taken ones, and no read could carry it, so a read of
// "the free times" could not tell them apart (`run-mwc6ut8u-52e3c1b3`). The
// page view calls a control disabled when it says `aria-disabled="true"` or
// the browser has it `:disabled` (a native `disabled`, or a disabled fieldset
// around it), so the disabled column holds a value exactly then: its condition
// is `:is([aria-disabled="true"], :disabled)`. It is offered for an element
// that states `aria-disabled` at all, or a form control written `disabled`,
// form fields included, since a field the person cannot use is a fact about
// its row whatever its value; the other three states are not offered on a form
// field, whose own value already says them. `where {field, is: "absent"}` on
// the disabled column keeps the rows a person can use.

import { textOutsideSensitiveControls } from "../../sensitive-text";

/** The states a control can be on in, with the word its column's label carries. */
const STATES: ReadonlyArray<readonly [attribute: string, word: string]> = [["aria-pressed", "pressed"], ["aria-checked", "checked"], ["aria-selected", "selected"]];

/** What the disabled column adds to the element's selector: on while the page view would call it disabled (see the header). */
const DISABLED_CONDITION = ':is([aria-disabled="true"], :disabled)';

/** The elements a native `disabled` disables. */
const DISABLEABLE_TAGS: ReadonlySet<string> = new Set(["button", "input", "select", "textarea", "option", "optgroup", "fieldset"]);

/** The form fields whose own value says whether they are checked or selected. */
const VALUE_TAGS: ReadonlySet<string> = new Set(["input", "textarea", "select"]);

/** The attributes that name an element, in the order its accessible name is computed from them. */
const NAME_ATTRIBUTES: readonly string[] = ["aria-label", "title"];

/** One state column, in the shape `../infer-fields.ts` measures every source in. */
export type StateMarkSource = {
  kind: "text" | "attribute";
  label: string;
  selector: string;
  attribute?: string | undefined;
  sensitive: false;
  mark: "state";
};

/** One state an element offers a column for: the word its label carries, the condition its selector adds, and the attribute read where the element has no words or name. */
type OfferedState = { word: string; condition: string; state: string };

/**
 * The state columns an element named `name` inside its item offers: one per
 * ARIA state it states, on or off, and the disabled column where it states
 * `aria-disabled` or is a form control written `disabled` (see the header).
 */
export function stateMarkSources(element: Element, name: { selector: string; label: string }, sensitive: boolean): StateMarkSource[] {
  if (sensitive) return [];
  const tag = element.tagName.toLowerCase();
  const offered: OfferedState[] = VALUE_TAGS.has(tag) ? [] : STATES
    .filter(([state]) => element.hasAttribute(state))
    .map(([state, word]) => ({ word, condition: `[${state}="true"]`, state }));
  if (element.hasAttribute("aria-disabled") || (DISABLEABLE_TAGS.has(tag) && element.hasAttribute("disabled"))) {
    offered.push({ word: "disabled", condition: DISABLED_CONDITION, state: element.hasAttribute("aria-disabled") ? "aria-disabled" : "disabled" });
  }
  return offered.map(({ word, condition, state }): StateMarkSource => {
    const base = { label: `${name.label} (${word})`, selector: `${name.selector}${condition}`, sensitive: false as const, mark: "state" as const };
    if (collapsed(textOutsideSensitiveControls(element)) !== "") return { kind: "text" as const, ...base };
    const named = NAME_ATTRIBUTES.find((attribute) => collapsed(element.getAttribute(attribute) ?? "") !== "");
    return { kind: "attribute" as const, ...base, attribute: named ?? state };
  });
}

function collapsed(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}
