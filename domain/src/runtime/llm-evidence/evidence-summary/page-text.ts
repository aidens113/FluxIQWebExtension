// The page text a tool's evidence carries, for Core's step log (`page.txt`).
//
// Since t1036 a page arrives as its keyed view (`pageView`, `web-llm-page.v4`),
// whose lines are read back as the one text (`../shown-page/`); a
// result recorded before carries the text itself as `page`.

import { webLlmShownPageText } from "../shown-page";

/** How deep a page is looked for: `value.page.pageView` is depth 2 (a published page under a result's `value`). */
const MAX_DEPTH = 4;

/**
 * The compact page text a tool's evidence carries: the first object within
 * four levels of the evidence that carries a page view or a string `page`,
 * breadth first so the shallowest wins. Undefined when there is none. Core's
 * step log writes this to `page.txt`; no model is ever sent it from here.
 */
export function webLlmEvidencePageText(evidence: unknown): string | undefined {
  let level: unknown[] = [evidence];
  for (let depth = 1; depth <= MAX_DEPTH && level.length; depth += 1) {
    const next: unknown[] = [];
    for (const value of level) {
      if (typeof value !== "object" || value === null) continue;
      const text = Array.isArray(value) ? undefined : webLlmShownPageText(value);
      if (text !== undefined) return text;
      next.push(...(Array.isArray(value) ? value : Object.values(value)));
    }
    level = next;
  }
  return undefined;
}
