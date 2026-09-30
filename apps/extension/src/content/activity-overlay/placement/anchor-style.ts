// The host's four offsets for an anchor: two pin it, two are `auto`. Written
// all four every time, so a move from one corner to another leaves no offset
// of the old one behind.

import type { OverlayAnchor } from "./choose-placement";

/** `left`, `right`, `top` and `bottom` for a box `height` pixels high at `anchor`, `margin` from the edge. */
export function anchorStyle(anchor: OverlayAnchor, margin: number, height: number): Readonly<Record<"left" | "right" | "top" | "bottom", string>> {
  const edge = `${margin}px`;
  const onRight = anchor === "right" || anchor.endsWith("-right");
  const vertical = anchor.startsWith("top")
    ? { top: edge, bottom: "auto" }
    : anchor.startsWith("bottom")
      ? { top: "auto", bottom: edge }
      : { top: `calc(50% - ${Math.round(height / 2)}px)`, bottom: "auto" };
  return { left: onRight ? "auto" : edge, right: onRight ? edge : "auto", ...vertical };
}
