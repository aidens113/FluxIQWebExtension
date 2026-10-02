// The page as one string: the header lines, a blank line, then the element
// lines with their markers, joined by "\n" (t223, "The format").

import type { WebLlmPageEvidence } from "../sanitize";
import { webLlmElementKind } from "./element";
import { webLlmPageHeader } from "./header";
import { chosenWebLlmLines, renderedWebLlmLines } from "./line";
import { webLlmLinkWriter } from "./link-writer";
import { webLlmPageTree } from "./page-tree";

/** The text of the page the model is shown in place of the structured packet. */
export function webLlmPageText(evidence: WebLlmPageEvidence): string {
  const tree = webLlmPageTree(evidence.elements);
  const lines = chosenWebLlmLines(evidence.elements, tree);
  const linkHrefs = lines.flatMap((line) => line.role !== "image" && webLlmElementKind(line.element) === "link" && line.element.href !== undefined ? [line.element.href] : []);
  const links = webLlmLinkWriter(evidence.location, linkHrefs);
  const body = renderedWebLlmLines(lines, tree, evidence.viewport, links);
  return [...webLlmPageHeader(evidence, links, lines.length), "", ...body].join("\n");
}
