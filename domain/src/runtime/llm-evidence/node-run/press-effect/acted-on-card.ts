// What a press in no list acted on, in the words of the control's own card,
// for the line a person reads of the act (Core `answer-first/act-record/item-names.ts`).
//
// A press inside an item of a repeating list says its item (`./acted-on.ts`). One in
// no list said nothing, and Core named the act after the page's title: lane B's
// run-mw44rtn1-37dee092 added a product from a cart page's suggestion tiles and the
// card read "Add to cart: Brightaisle.com Shopping Cart". The thing acted on is the
// control's own card, read from the look before the press:
//
//   1. The words the capture gave of the card the control sits in (`within`, on a
//      control that repeats on the page, as an "Add to cart" on each tile does).
//   2. Otherwise the heading the capture said the control sits under (`heading`),
//      only where that heading is on the same part of the page: the same frame, the
//      same dialog or none, the same landmark, and itself in no list item. A press
//      under an item's own title on its own page names that item; a heading of
//      another region is never borrowed.
//   3. Otherwise nothing, and Core's line stays the control's own words.
//
// **Never a row tie.** These words travel as `actedOnCard`, apart from `actedOnItem`:
// Core ties a press to the rows a read returned by `actedOnItem`'s words, and a
// tile's words tying an add to a cart row would hold a later press on that row as
// already done. Every word here was on the page view the model was shown.

import type { WebLlmEvidenceElement } from "../../elements";
import type { WebLlmSnapshotBinding } from "../../sanitize";
import { webLlmItemRow } from "../../structure";
import type { WebRunnableNode } from "../catalog";

/** The most characters of a card's words kept; Core cuts its line shorter. */
const MOST_CHARACTERS = 2_000;

/** The words of the card a press in no list acted on, or `undefined` (header). */
export function webNodeActedOnCard(node: WebRunnableNode, before: WebLlmSnapshotBinding | undefined, handle: string | undefined): string | undefined {
  if (node.effect !== "mutate" || before === undefined || handle === undefined) return undefined;
  const elements = before.evidence.elements;
  const at = elements.findIndex((candidate) => candidate.target === handle);
  const element = elements[at];
  if (element === undefined || webLlmItemRow(before.evidence, handle) !== undefined) return undefined;
  const within = flat(element.within);
  if (within !== undefined) return within;
  const heading = flat(element.heading);
  if (heading === undefined) return undefined;
  const own = elements.slice(0, at).reverse().find((candidate) => isHeading(candidate) && flat(candidate.name ?? candidate.text) === heading);
  return own !== undefined && samePart(own, element) && own.item === undefined && own.cell === undefined ? heading : undefined;
}

function isHeading(element: WebLlmEvidenceElement): boolean {
  return /^h[1-6]$/u.test(element.tag) || element.role?.trim().toLowerCase() === "heading";
}

function samePart(a: WebLlmEvidenceElement, b: WebLlmEvidenceElement): boolean {
  return a.frameId === b.frameId && a.inDialog === b.inDialog && a.landmark === b.landmark;
}

function flat(words: string | undefined): string | undefined {
  const text = words?.replace(/\s+/gu, " ").trim();
  return text === undefined || text === "" ? undefined : text.slice(0, MOST_CHARACTERS);
}
