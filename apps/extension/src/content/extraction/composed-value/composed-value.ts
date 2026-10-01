// A value the page draws in pieces.
//
// **Until 2026-10-01 such a value was never a column.** The cross-border
// marketplace draws a card's price as
// `<div><span></span><span>16</span><span>,49</span><span> €</span></div>`, so
// that the whole number, the decimals and the currency can be styled apart.
// Detection offered a text source only for an element with words and no
// children, so the proposal held "16", ",49" and "€" as three columns and no
// column held "16,49 €". The one column labelled `(currency amount)` was the
// struck-through original price beside it, and every row of a read built from
// the detection carried the original price
// (`t194-w26-spain-hubs-fixture.md`, G1).
//
// The element holding the pieces states the value whole. It is offered when
// its pieces together have a shape (`value-shape.ts`) that none of them has on
// its own -- a shape, never a reading of the words -- so the original-price row
// beside it, `<div><span>29,99 €</span><span>-45%</span></div>`, is not offered:
// its whole is no amount, and one of its pieces already is one. Its pieces are
// then not offered on their own, since each is a fragment of that one value
// rather than a value of the record, and a column reading "16" labelled
// `(number)` is a trap for a model looking for the price.

import { textOutsideSensitiveControls } from "../../sensitive-text";
import { valueShape } from "../value-shape";

/**
 * Whether the element states one value its children draw in pieces: it has at
 * least two children, none of which has children of its own, and its words
 * together have a shape that no child's words have alone. The words are read
 * through the one sensitive-text reader, only to decide this, and never kept.
 */
export function composesValue(element: Element): boolean {
  const pieces = Array.from(element.children);
  if (pieces.length < 2 || pieces.some((piece) => piece.children.length > 0)) return false;
  const shape = valueShape([textOutsideSensitiveControls(element)]);
  if (shape === undefined) return false;
  return pieces.every((piece) => valueShape([textOutsideSensitiveControls(piece)]) !== shape);
}

/**
 * Whether the element is one piece of a value its parent states whole
 * (`composesValue`), inside the item. A piece of a value the item itself
 * states is still offered, since the item is never a column of its own.
 */
export function isComposedPiece(item: Element, element: Element): boolean {
  const parent = element.parentElement;
  return parent !== null && parent !== item && item.contains(parent) && composesValue(parent);
}
