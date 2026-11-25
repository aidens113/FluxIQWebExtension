// The chosen lines written out, with the markers between them (t223):
//
//   <handle> [<heading tag>] [<kind>] ["<words>"] [icon ...] [<state tokens>...] [group="<group>"]
//
// A control with no words drawn as an icon says so, with the class tokens and
// symbols the page gave it (`../element/icon-hints.ts`).
//
// A line whose element sits under a heading that has no line of its own takes
// that heading's tag before its kind, `t246 h2 link "..."`, so a card's title
// link still reads as the card's heading. A control in a fieldset ends with
// its legend, `group="Size"` (t605), which is what a bare option filters by, and
// so does a control in a named ARIA group (t610, `../group-names.ts`).
//
// Each line is keyed for Core's page channel (t1036, P-b): an element line by
// its handle, and a marker line by the element line it stands before, `^t62`
// for the first marker before `t62` and `^t62.2` for the second, so a marker
// that moves with its element is the same line.

import type { WebLlmEvidenceViewport } from "../../page-evidence";
import { quotedWords, webLlmGroupToken, webLlmStateTokens } from "../element";
import { webLlmLineKind } from "./kind";
import { webLlmLinkRepeats } from "../link-repeats";
import type { WebLlmGroupNames } from "../group-names";
import type { WebLlmLinkWriter } from "../link-writer";
import type { WebLlmPageLine } from "../keyed-line";
import type { WebLlmPageTree } from "../page-tree";
import { webLlmStructureMarkers } from "../structure-markers";
import type { WebLlmViewLine } from "../view-line";

const HEADING_TAG = /^h[1-6]$/u;

/** Every element line, in order, with the marker lines before the line each marks, each keyed. */
export function renderedWebLlmLines(lines: readonly WebLlmViewLine[], tree: WebLlmPageTree, viewport: WebLlmEvidenceViewport | undefined, links: WebLlmLinkWriter, groups: WebLlmGroupNames): WebLlmPageLine[] {
  const lined = new Set(lines.map((line) => line.element));
  const markersBefore = webLlmStructureMarkers(viewport);
  const linkTarget = webLlmLinkRepeats(links);
  const written: WebLlmPageLine[] = [];
  for (const line of lines) {
    const element = line.element;
    markersBefore(element).forEach((marker, index) => written.push({ key: index === 0 ? `^${element.target}` : `^${element.target}.${index + 1}`, text: marker }));
    const kind = webLlmLineKind(line);
    const heading = kind !== undefined && HEADING_TAG.test(kind)
      ? undefined
      : tree.ancestors(element).find((ancestor) => HEADING_TAG.test(ancestor.tag));
    const prefix = heading !== undefined && !lined.has(heading) ? heading.tag : undefined;
    const target = kind === "link" && element.href !== undefined ? linkTarget(element.target, element.href) : undefined;
    const group = line.role === "control" ? webLlmGroupToken(groups.groupOf(element)) : undefined;
    const parts = [element.target, prefix, kind, line.words === undefined ? undefined : quotedWords(line.words), ...(line.icon ?? []), ...webLlmStateTokens(element, kind, target, line.words), group];
    written.push({ key: element.target, text: parts.filter((part): part is string => part !== undefined && part !== "").join(" ") });
  }
  return written;
}
