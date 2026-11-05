// The search box at the top of the Automations tab: one box over tasks, automations and subflows.
// It only says what was typed; each part that is searched decides what to do with it.

import { createElement } from "../dom";

/** The mounted box. */
export type SearchBox = { readonly element: HTMLElement };

/** The words in the box and its accessible name. */
export const SEARCH_WORDS = "Search tasks, automations and subflows";

/** Builds the box; `onChange` is called with the whole text on every edit. */
export function createSearchBox(onChange: (text: string) => void): SearchBox {
  const input = createElement("input", {
    id: "automationsSearch",
    className: "automations-search-input",
    attrs: { type: "search", placeholder: SEARCH_WORDS, "aria-label": SEARCH_WORDS, autocomplete: "off", spellcheck: "false" }
  });
  input.addEventListener("input", () => onChange(input.value));
  return { element: createElement("div", { className: "automations-search" }, [input]) };
}
