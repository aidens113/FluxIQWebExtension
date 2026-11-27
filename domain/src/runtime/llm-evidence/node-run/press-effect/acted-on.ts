// Which item of a repeating list a press, a type or a choice acted on, in one
// sentence on its answer (t504).
//
// Lane D round 17 (`run-mv6lgt3s-c3aa6fac`): the model meant "the rows that
// qualify", pressed the first row's control -- a row that did not qualify --
// and the answer listed only the lines that changed. Nothing refuses such a
// press; a person may act on any row. The answer now says, ahead of what
// changed, which item the act was on: its place as the page view marks it
// (`- 1/3`) and that item's words, read from the look before acting
// (`../../structure/item-row.ts`), so the model can hold it against the rows it
// meant at once.
//
// An item the view marks no place for, in a grid whose cards the page keyed one
// by one, is named the same way from its keyed record (`./keyed-item.ts`, t1067):
// run-mwy3btww-31d32e0d's add on the first card of a results grid named nothing.

import { quotedWords, webLlmElementWords } from "../../page-view";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import { webLlmItemRow, webLlmItemWholeWords } from "../../structure";
import type { WebRunnableNode } from "../catalog";
import { webNodeKeyedItem } from "./keyed-item";

/** The most of a keyed item's lines said in the sentence, as an item's are (`../../structure/item-row.ts`). */
const MOST_LINES = 2;
/** The most characters of a keyed item's words said in the sentence, past which they are cut. */
const MOST_CHARACTERS = 80;
/** The most characters of a keyed item's whole words kept for the record. */
const MOST_WHOLE_CHARACTERS = 2_000;

/**
 * The whole words of the item an act was on, or `undefined` as `webNodeActedOn` is: its row for the record to find,
 * with the control's own words left out, since a column repeating a control's name would fit every row.
 */
export function webNodeActedOnItem(node: WebRunnableNode, before: WebLlmSnapshotBinding | undefined, handle: string | undefined): string | undefined {
  if (node.effect !== "mutate" || before === undefined || handle === undefined) return undefined;
  const listed = webLlmItemWholeWords(before.evidence, handle);
  if (listed !== undefined) return listed;
  const keyed = webNodeKeyedItem(before, handle);
  if (keyed === undefined) return undefined;
  const words = keyed.words.join(", ").slice(0, MOST_WHOLE_CHARACTERS);
  return words === "" ? keyed.place : `${keyed.place} (${words})`;
}

/**
 * The sentence for an act on an element inside an item of a list of several
 * (or a table row, or a keyed card of several), or `undefined`: a node that only
 * looks, no page before it, no handle, or an element in no such item.
 */
export function webNodeActedOn(node: WebRunnableNode, before: WebLlmSnapshotBinding | undefined, handle: string | undefined): string | undefined {
  if (node.effect !== "mutate" || before === undefined || handle === undefined) return undefined;
  const item = webLlmItemRow(before.evidence, handle) ?? keyedItemRow(before, handle);
  if (item === undefined) return undefined;
  const element = before.evidence.elements.find((candidate) => candidate.target === handle);
  const words = element === undefined ? undefined : webLlmElementWords(element);
  const through = words === undefined ? "" : `, through its ${quotedWords(words)}`;
  return `This acted on ${item} only${through}; no other item was acted on.`;
}

/** `item i/n (words)` for a keyed card, its words its first lines cut short, as an item's are said. */
function keyedItemRow(before: WebLlmSnapshotBinding, handle: string): string | undefined {
  const keyed = webNodeKeyedItem(before, handle);
  if (keyed === undefined) return undefined;
  const words = keyed.words.slice(0, MOST_LINES).join(", ");
  if (words === "") return keyed.place;
  return `${keyed.place} (${words.length <= MOST_CHARACTERS ? words : `${words.slice(0, MOST_CHARACTERS - 3).trimEnd()}...`})`;
}
