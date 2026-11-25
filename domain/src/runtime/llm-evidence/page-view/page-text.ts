// The page as one string: the header lines, a blank line, then the element
// lines with their markers, joined by "\n" (t223, "The format"). The text of
// the keyed view (`./written-lines.ts`), for a domain reader that compares or
// searches the words rather than delivering them.

import type { WebLlmPageEvidence } from "../sanitize";
import { webLlmPageViewLines } from "./written-lines";
import { webLlmPageViewText } from "./joined-text";

/** The text of the page the model is shown in place of the structured packet. */
export function webLlmPageText(evidence: WebLlmPageEvidence): string {
  return webLlmPageViewText({ lines: webLlmPageViewLines(evidence) });
}
