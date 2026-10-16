// The number of results a page states, as data (t655).
//
// A step that narrows a list changes how many results the page says it holds:
// "40 results" before a format is chosen, "12 results" after. Core reports the
// two beside the step (its `result-verification/narrowed-before.ts`) and
// interprets neither. This reads only a statement the page makes in a line of
// text of its own: a whole number followed by one of a few generic nouns for
// what a list holds ("results", "items", "matches"). Where the page states more
// than one such number, or none, it states no count, and nothing is said.

import { webLlmElementWords, webLlmViewTraits } from "../page-view";
import type { WebLlmPageEvidence } from "../sanitize";

/** A whole number, then a noun for what a list holds. Generic, never any site's. */
const STATED = /(?:^|[^\p{L}\p{N}.,])(\d{1,3}(?:,\d{3})+|\d+)\s+(?:results?|items?|matches|products|listings)\b/giu;

/** The one number of results the page states in its text lines, or `undefined` for none or several (header). */
export function webLlmPageResultCount(evidence: WebLlmPageEvidence): number | undefined {
  const stated = new Set<number>();
  for (const element of evidence.elements) {
    const traits = webLlmViewTraits(element);
    if (!traits.visible || traits.lineRole !== "text") continue;
    const words = webLlmElementWords(element);
    if (words === undefined) continue;
    for (const match of words.matchAll(STATED)) {
      const count = Number(match[1]!.replace(/,/gu, ""));
      if (Number.isSafeInteger(count)) stated.add(count);
    }
  }
  return stated.size === 1 ? [...stated][0] : undefined;
}
