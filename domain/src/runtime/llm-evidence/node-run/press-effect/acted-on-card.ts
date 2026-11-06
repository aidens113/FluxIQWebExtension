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
//   2. Otherwise, for a control in the page's single main item, the page's own
//      subject: its first main heading (`h1`), in the top frame, in no dialog and in
//      the main landmark. A press on an item's own page names that item. A control in
//      a card or a row the page placed it in, one that repeats or has look-alikes, or
//      one outside the main landmark is not in that item: on a cart or a list page
//      the `h1` names the page, which is the title's mistake again. The nearest
//      heading is not used either: run-mw4a2ywt-f935cbc5 named an add on a product
//      page after its "About this item" section.
//   3. Otherwise nothing, and Core's line stays the control's own words.
//
// **Never a row tie.** These words travel as `actedOnCard`, apart from `actedOnItem`:
// Core ties a press to the rows a read returned by `actedOnItem`'s words, and a
// tile's words tying an add to a cart row would hold a later press on that row as
// already done. Every word here was on the page view the model was shown.

import type { WebLlmSnapshotBinding } from "../../sanitize";
import { webLlmItemRow } from "../../structure";
import type { WebRunnableNode } from "../catalog";

/** The most characters of a card's words kept; Core cuts its line shorter. */
const MOST_CHARACTERS = 2_000;

/** The words of the card a press in no list acted on, or `undefined` (header). */
export function webNodeActedOnCard(node: WebRunnableNode, before: WebLlmSnapshotBinding | undefined, handle: string | undefined): string | undefined {
  if (node.effect !== "mutate" || before === undefined || handle === undefined) return undefined;
  const elements = before.evidence.elements;
  const element = elements.find((candidate) => candidate.target === handle);
  if (element === undefined || webLlmItemRow(before.evidence, handle) !== undefined) return undefined;
  const within = flat(element.within);
  if (within !== undefined) return within;
  const inMainItem = element.landmark === "main" && element.frameId === undefined && element.inDialog === undefined
    && element.repeats === undefined && element.alike === undefined && !before.records?.has(handle);
  if (!inMainItem) return undefined;
  const subject = elements.find((candidate) => candidate.tag === "h1" && candidate.hidden !== true && candidate.frameId === undefined && candidate.inDialog === undefined);
  return subject !== undefined && subject.landmark === "main" && subject.item === undefined && subject.cell === undefined ? flat(subject.name ?? subject.text) : undefined;
}

function flat(words: string | undefined): string | undefined {
  const text = words?.replace(/\s+/gu, " ").trim();
  return text === undefined || text === "" ? undefined : text.slice(0, MOST_CHARACTERS);
}
