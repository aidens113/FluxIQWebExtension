// Which lines of the page view are text: what a change list says appeared,
// went or now reads otherwise (`./page-changes.ts`), and what a refusal quotes
// as the page's answer (`./notice.ts`). One rule for both, so a line the change
// list reports and a line a refusal quotes are the same kind of line.

import type { WebLlmLineFact } from "../../page-view";

const HEADING = /^h[1-6]$/u;

/** A line the view prints as text: plain words, or a heading's. */
export function webIsTextLine(line: WebLlmLineFact): boolean {
  return line.words !== undefined && (line.kind === undefined || HEADING.test(line.kind));
}
