// The host's four offsets for an anchor: two pin it, two are `auto`. Written
// all four every time, so a move from one corner to another leaves no offset
// of the old one behind.

import type { OverlayAnchor } from "./choose-placement";

/**
 * `left`, `right`, `top` and `bottom` for a box `height` pixels high at
 * `anchor`, `margin` from the edge, and a docked corner `offset` pixels further
 * in from its top or bottom edge.
 */
export function anchorStyle(anchor: OverlayAnchor, margin: number, height: number, offset = 0): Readonly<Record<"left" | "right" | "top" | "bottom", string>> {
  const edge = `${margin}px`;
  const docked = `${margin + Math.max(0, Math.round(offset))}px`;
  const onRight = anchor === "right" || anchor.endsWith("-right");
  const vertical = anchor.startsWith("top")
    ? { top: docked, bottom: "auto" }
    : anchor.startsWith("bottom")
      ? { top: "auto", bottom: docked }
      : { top: `calc(50% - ${Math.round(height / 2)}px)`, bottom: "auto" };
  return { left: onRight ? "auto" : edge, right: onRight ? edge : "auto", ...vertical };
}
