// The host's four offsets for a corner: two pin it, two are `auto`. Written
// all four every time, so a move from one corner to another leaves no offset
// of the old one behind.

import type { OverlayAnchor } from "./choose-placement";

/** `left`, `right`, `top` and `bottom` for a box at `anchor`, `margin` from the edge and `offset` pixels further in from its top or bottom edge. */
export function anchorStyle(anchor: OverlayAnchor, margin: number, offset = 0): Readonly<Record<"left" | "right" | "top" | "bottom", string>> {
  const edge = `${margin}px`;
  const inset = `${margin + Math.max(0, Math.round(offset))}px`;
  const onRight = anchor.endsWith("-right");
  const vertical = anchor.startsWith("top") ? { top: inset, bottom: "auto" } : { top: "auto", bottom: inset };
  return { left: onRight ? "auto" : edge, right: onRight ? edge : "auto", ...vertical };
}
