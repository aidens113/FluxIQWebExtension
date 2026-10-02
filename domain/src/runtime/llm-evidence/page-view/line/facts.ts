// The page view's element lines as facts rather than text: each line's handle,
// kind, words and state tokens, exactly as the view prints them
// (`./render.ts`). What reads two pages and says what changed between
// them (`../node-run/page-changes.ts`) compares these, so it speaks of the
// lines the model was shown and never of the page's own markup.
//
// The link target is left out of the tokens: it is written relative to the
// lines before it (`./link-repeats.ts`), so it is a fact of the text and not
// of the element.

import type { WebLlmPageEvidence } from "../../sanitize";
import { webLlmStateTokens } from "../element";
import { chosenWebLlmLines } from "./choice";
import { webLlmLineKind } from "./kind";
import { webLlmPageTree } from "../page-tree";

export type WebLlmLineFact = {
  /** The handle the line starts with. */
  handle: string;
  /** The kind word; absent for plain text. */
  kind?: string;
  /** The words the line prints in quotes, withheld words already withheld; absent for a line with none. */
  words?: string;
  /** The state tokens after the words, in the view's order, without the link target. */
  tokens: string[];
};

/** Every element line of the page view, in page order. */
export function webLlmLineFacts(evidence: WebLlmPageEvidence): WebLlmLineFact[] {
  const tree = webLlmPageTree(evidence.elements);
  return chosenWebLlmLines(evidence.elements, tree).map((line) => {
    const kind = webLlmLineKind(line);
    const fact: WebLlmLineFact = { handle: line.element.target, tokens: webLlmStateTokens(line.element, kind, undefined, line.words) };
    if (kind !== undefined) fact.kind = kind;
    if (line.words !== undefined) fact.words = line.words;
    return fact;
  });
}
