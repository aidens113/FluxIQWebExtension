// Which item an act was on, where the page keyed each item but drew no list around them (t1067).
//
// `./acted-on.ts` names an item by the marker the page view prints for it (`- 1/8`, `- row 3`), which the capture writes
// only for a list's own markup: a `li`, a table row (`listPosition`, `tablePosition`). A results grid is often neither,
// and its cards are `div`s. The capture still knows which card an element sits in when the page keyed each card with a
// per-instance identifier (`data-item-id` and the like, the extension's `identity/record.ts`): that is the record address
// the binding keeps for every element in the card, its words included (`../../elements.ts` `recordAddress`).
//
// **Live evidence.** `run-mwy3btww-31d32e0d`, 0020: the model pressed "+ Add" on the first card of a sorted results grid
// (bigbox's tiles are `div`s keyed by `data-item-id`). The answer carried no `actedOn`, no `actedOnItem` and no
// `actedOnCard`: the card was in no list the view marked, and a keyed record carries no words of its own, only its key.
// No judge could tell what landed in the cart, and one said no over it.
//
// So an element in a keyed record that is one of several records keyed by the same attribute is in an item: its place is
// that record's among them, in page order, and its words are the lines the view printed for that record's elements, read
// as `../../structure/item-row.ts` reads an item's lines (text, images' words, links; never another control's words). A
// lone keyed record is no item, as a one-item list is none. Every word here was on the page view the model was shown.
import { chosenWebLlmLines, webLlmElementKind, webLlmPageTree, type WebLlmViewLine } from "../../page-view";
import type { WebLlmSnapshotBinding } from "../../sanitize";

/** How a keyed record's address begins (`../../elements.ts` `recordAddress`): `key`, its attribute and its key, joined by this. */
const SEPARATOR = String.fromCharCode(31);

/** The keyed item an element sits in: `item i/n`, and the words of its lines in page order. */
export type WebNodeKeyedItem = { place: string; words: readonly string[] };

/** The keyed item the element `handle` names on `before` sits in, or `undefined` (header). */
export function webNodeKeyedItem(before: Pick<WebLlmSnapshotBinding, "evidence" | "records">, handle: string): WebNodeKeyedItem | undefined {
  const address = before.records.get(handle);
  const parts = address?.split(SEPARATOR);
  if (address === undefined || parts === undefined || parts.length !== 3 || parts[0] !== "key") return undefined;
  const kind = `${parts[0]}${SEPARATOR}${parts[1]}${SEPARATOR}`;
  const elements = before.evidence.elements;
  const order: string[] = [];
  for (const element of elements) {
    const held = before.records.get(element.target);
    if (held !== undefined && held.startsWith(kind) && !order.includes(held)) order.push(held);
  }
  if (order.length < 2) return undefined;
  const words: string[] = [];
  for (const line of chosenWebLlmLines(elements, webLlmPageTree(elements))) {
    if (before.records.get(line.element.target) !== address) continue;
    const said = lineWords(line);
    if (said !== undefined && !words.includes(said)) words.push(said);
  }
  return { place: `item ${order.indexOf(address) + 1}/${order.length}`, words };
}

/** A line's words when they tell its item from another: text, an image's words, a link's; never another control's. */
function lineWords(line: WebLlmViewLine): string | undefined {
  if (line.words === undefined || line.words.trim() === "") return undefined;
  if (line.role === "control" && webLlmElementKind(line.element) !== "link") return undefined;
  return line.words.replace(/\s+/gu, " ").trim();
}
