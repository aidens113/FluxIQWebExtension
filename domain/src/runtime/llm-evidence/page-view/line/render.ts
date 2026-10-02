// The chosen lines written out, with the markers between them (t223):
//
//   <handle> [<heading tag>] [<kind>] ["<words>"] [<state tokens>...]
//
// A line whose element sits under a heading that has no line of its own takes
// that heading's tag before its kind, `t246 h2 link "..."`, so a card's title
// link still reads as the card's heading.

import type { WebLlmEvidenceViewport } from "../../page-evidence";
import { quotedWords, webLlmStateTokens } from "../element";
import { webLlmLineKind } from "./kind";
import { webLlmLinkRepeats } from "../link-repeats";
import type { WebLlmLinkWriter } from "../link-writer";
import type { WebLlmPageTree } from "../page-tree";
import { webLlmStructureMarkers } from "../structure-markers";
import type { WebLlmViewLine } from "../view-line";

const HEADING_TAG = /^h[1-6]$/u;

/** Every element line, in order, with the marker lines before the line each marks. */
export function renderedWebLlmLines(lines: readonly WebLlmViewLine[], tree: WebLlmPageTree, viewport: WebLlmEvidenceViewport | undefined, links: WebLlmLinkWriter): string[] {
  const lined = new Set(lines.map((line) => line.element));
  const markersBefore = webLlmStructureMarkers(viewport);
  const linkTarget = webLlmLinkRepeats(links);
  const written: string[] = [];
  for (const line of lines) {
    const element = line.element;
    written.push(...markersBefore(element));
    const kind = webLlmLineKind(line);
    const heading = kind !== undefined && HEADING_TAG.test(kind)
      ? undefined
      : tree.ancestors(element).find((ancestor) => HEADING_TAG.test(ancestor.tag));
    const prefix = heading !== undefined && !lined.has(heading) ? heading.tag : undefined;
    const target = kind === "link" && element.href !== undefined ? linkTarget(element.target, element.href) : undefined;
    const parts = [element.target, prefix, kind, line.words === undefined ? undefined : quotedWords(line.words), ...webLlmStateTokens(element, kind, target, line.words)];
    written.push(parts.filter((part): part is string => part !== undefined && part !== "").join(" "));
  }
  return written;
}
