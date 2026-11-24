// Which controls of one page the view shows chosen, and which it shows not
// chosen, by the page's own typed state (t1023).
//
// "Chosen" is a state token the view prints after a line's words
// (`../../page-view/element/state-tokens.ts`): `checked` (a checkbox or a
// radio), `selected` (`aria-selected`), `pressed` (`aria-pressed`), `current`
// (`aria-current`) and `marked` (drawn apart from the like options beside it,
// as a shop draws its chosen size). Never words: a line that only says
// "Pickup today" is no option chosen. A line with words and none of these
// tokens is shown not chosen, which is how a control once seen chosen is known
// to have been un-chosen (`./memory.ts`).

import { webLlmLineFacts } from "../../page-view";
import type { WebLlmPageEvidence } from "../../sanitize";

/** The tokens the view prints for a control the page shows chosen. */
const CHOSEN: readonly string[] = ["checked", "selected", "pressed", "current", "marked"];

/** One line of the view with words: its handle, its words, and whether the page shows it chosen. */
export type WebPageChoiceLine = { handle: string; words: string; chosen: boolean };

/** Every line of the page's view that has words, in page order, each with whether it shows chosen. */
export function webPageChoiceLines(page: WebLlmPageEvidence): WebPageChoiceLine[] {
  return webLlmLineFacts(page).flatMap((line) => {
    const words = line.words?.replace(/\s+/gu, " ").trim();
    return words ? [{ handle: line.handle, words, chosen: line.tokens.some((token) => CHOSEN.includes(token)) }] : [];
  });
}
