// A control's pressed, checked or selected state as a column of its own
// (contract CC2): the `state` mark.
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

import { textOutsideSensitiveControls } from "../../sensitive-text";

/** The states a control can be on in, with the word its column's label carries. */
const STATES: ReadonlyArray<readonly [attribute: string, word: string]> = [["aria-pressed", "pressed"], ["aria-checked", "checked"], ["aria-selected", "selected"]];

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

/** The state columns an element named `name` inside its item offers: one per ARIA state it states, on or off. */
export function stateMarkSources(element: Element, name: { selector: string; label: string }, sensitive: boolean): StateMarkSource[] {
  if (sensitive) return [];
  return STATES.flatMap(([state, word]): StateMarkSource[] => {
    if (!element.hasAttribute(state)) return [];
    const base = { label: `${name.label} (${word})`, selector: `${name.selector}[${state}="true"]`, sensitive: false as const, mark: "state" as const };
    if (collapsed(textOutsideSensitiveControls(element)) !== "") return [{ kind: "text" as const, ...base }];
    const named = NAME_ATTRIBUTES.find((attribute) => collapsed(element.getAttribute(attribute) ?? "") !== "");
    return [{ kind: "attribute" as const, ...base, attribute: named ?? state }];
  });
}

function collapsed(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}
