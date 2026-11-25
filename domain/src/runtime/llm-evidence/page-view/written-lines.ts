// The page view's keyed lines (t223, "The format"; keyed since t1036, P-b): the
// header lines, the blank line, then the element lines with their markers. The
// texts, joined by "\n", are the page text a model has read since t223.
//
// Keys are unique within one view. Each header label and each element's handle
// is printed once, so a repeat cannot arise from the writers here; were one to,
// the later line takes `#2`, `#3`, ... rather than two lines sharing a key Core
// would then confuse.

import type { WebLlmPageEvidence } from "../sanitize";
import { webLlmElementKind } from "./element";
import { webLlmGroupNames } from "./group-names";
import { webLlmPageHeader } from "./header";
import { chosenWebLlmLines, renderedWebLlmLines } from "./line";
import { webLlmLinkWriter } from "./link-writer";
import type { WebLlmPageLine } from "./keyed-line";
import { webLlmPageTree } from "./page-tree";

/** The key of the blank line between the header and the element lines. */
const SEPARATOR_KEY = "-";

/** The keyed lines of the page the model is shown in place of the structured packet. */
export function webLlmPageViewLines(evidence: WebLlmPageEvidence): WebLlmPageLine[] {
  const tree = webLlmPageTree(evidence.elements);
  const groups = webLlmGroupNames(evidence.elements, tree);
  const lines = chosenWebLlmLines(evidence.elements, tree, groups);
  const linkHrefs = lines.flatMap((line) => line.role !== "image" && webLlmElementKind(line.element) === "link" && line.element.href !== undefined ? [line.element.href] : []);
  const links = webLlmLinkWriter(evidence.location, linkHrefs);
  const body = renderedWebLlmLines(lines, tree, evidence.viewport, links, groups);
  return uniquelyKeyed([...webLlmPageHeader(evidence, links, lines.length), { key: SEPARATOR_KEY, text: "" }, ...body]);
}

/** The lines with any key a line before already took given a `#n` suffix. */
function uniquelyKeyed(lines: readonly WebLlmPageLine[]): WebLlmPageLine[] {
  const taken = new Set<string>();
  return lines.map((line) => {
    let key = line.key;
    for (let next = 2; taken.has(key); next += 1) key = `${line.key}#${next}`;
    taken.add(key);
    return key === line.key ? line : { ...line, key };
  });
}
