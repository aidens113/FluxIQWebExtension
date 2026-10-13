// Which item of a repeating list -- or which row of a table -- a page-view
// handle sits in, said with that item's own words, as the model was shown them
// under the item's marker (`../page-view/structure-markers.ts`: `- 1/8`,
// `- row 3`): `item 1/8 (Ana Ruiz, Invoice for March)`.
//
// t504, lane D round 17 (`run-mv6lgt3s-c3aa6fac`): a detected list's button
// column carried `at`, the handle of that button in the list's first item, and
// the model, meaning "the rows that qualify", pressed it -- the first row,
// which did not. Nothing beside the handle said it was one row's control, and
// nothing in the press's answer said which row it had acted on. Both now say it
// with this: the column's `atItem` (`./packet.ts`) and the press's `actedOn`
// (`../node-run/press-effect/acted-on.ts`).
//
// The words are the lines the view printed in the same item, in order: its
// text, its images' words and its links -- never another button's or field's
// words, which repeat in every row and tell no row from another -- at most two
// of them, cut short. Where the element's line stands apart from its item's
// (the copies of a control every row repeats can be listed after the page's
// distinct lines) the item's own words the capture sent (`within`) stand in;
// with none, the place alone is said. Every word was already on the page view
// the model was shown, screened as it was there.

import type { WebLlmEvidenceElement } from "../elements";
import { chosenWebLlmLines, webLlmElementKind, webLlmPageTree, type WebLlmViewLine } from "../page-view";
import type { WebLlmPageEvidence } from "../sanitize";

/** The most of an item's lines said. */
const MOST_LINES = 2;
/** The most characters of an item's words said, past which they are cut. */
const MOST_CHARACTERS = 80;

/**
 * `item i/n (words)` or `row r (words)` for the element `handle` names on
 * `evidence`, or `undefined` when it names none or the element sits in no item
 * of a list of several and no table row.
 */
export function webLlmItemRow(evidence: Pick<WebLlmPageEvidence, "elements">, handle: string): string | undefined {
  const element = evidence.elements.find((candidate) => candidate.target === handle);
  if (element === undefined) return undefined;
  const place = placeOf(element);
  if (place === undefined) return undefined;
  const words = lineWords(evidence.elements, element) ?? element.within;
  return words === undefined || words.trim() === "" ? place : `${place} (${cut(words)})`;
}

/** Where the element is, as the page view's marker says it; a one-item list is no place. */
function placeOf(element: WebLlmEvidenceElement): string | undefined {
  if (element.item !== undefined && element.item.total > 1) return `item ${element.item.index}/${element.item.total}`;
  if (element.cell !== undefined) return `row ${element.cell.row}`;
  return undefined;
}

/** The words of the lines printed under the same marker as the element's own line, or `undefined` when it has no line or they say nothing. */
function lineWords(elements: readonly WebLlmEvidenceElement[], element: WebLlmEvidenceElement): string | undefined {
  const lines = chosenWebLlmLines(elements, webLlmPageTree(elements));
  const at = lines.findIndex((line) => line.element === element);
  if (at < 0) return undefined;
  const block = blockKey(element);
  let first = at, last = at;
  while (first > 0 && blockKey(lines[first - 1]!.element) === block) first -= 1;
  while (last < lines.length - 1 && blockKey(lines[last + 1]!.element) === block) last += 1;
  const said: string[] = [];
  for (const line of lines.slice(first, last + 1)) {
    const words = rowWords(line);
    if (words !== undefined && !said.includes(words)) said.push(words);
    if (said.length === MOST_LINES) break;
  }
  return said.length > 0 ? said.join(", ") : undefined;
}

/** A line's words when they tell its row from another: text, an image's words, a link's. */
function rowWords(line: WebLlmViewLine): string | undefined {
  if (line.words === undefined || line.words.trim() === "") return undefined;
  if (line.role === "control" && webLlmElementKind(line.element) !== "link") return undefined;
  return line.words.trim();
}

/** What a line's marker block is: the region it is printed in, and its item or table row. */
function blockKey(element: WebLlmEvidenceElement): string {
  return JSON.stringify([element.frameId, element.inDialog, element.landmark, element.form, placeOf(element)]);
}

function cut(words: string): string {
  const flat = words.replace(/\s+/gu, " ").trim();
  return flat.length <= MOST_CHARACTERS ? flat : `${flat.slice(0, MOST_CHARACTERS - 3).trimEnd()}...`;
}
