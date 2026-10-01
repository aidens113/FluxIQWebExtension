// Where an element is relative to what the person sees (t223, "Screen"):
// on screen, above it, below the fold, off to one side, outside the document
// altogether, or not rendered at all.
//
// The capture's own `onViewport` decides "on screen" where it said; the
// snapshot's viewport (`../../page-evidence.ts`) then says which side of the
// screen the rest is on. Without a viewport, every element the capture said is
// not on screen reads as below, which is where nearly all of them are.

import type { WebLlmEvidenceElement } from "../../elements";
import type { WebLlmEvidenceViewport } from "../../page-evidence";

export type WebLlmElementWhere = "on screen" | "above" | "below" | "off screen" | "off-page" | "not rendered";

/**
 * Where the element is: `not rendered` when a search capture added it as
 * hidden, `off-page` when its box ends before the document starts. An element
 * a look listed without a box (an image map `area`, a `display: contents`
 * wrapper) is placed by the capture's `onViewport` alone.
 */
export function webLlmElementWhere(element: WebLlmEvidenceElement, viewport: WebLlmEvidenceViewport | undefined): WebLlmElementWhere {
  const box = element.box;
  if (element.hidden === true) return "not rendered";
  if (box === undefined) return element.onViewport === false ? "below" : "on screen";
  if (box.x + box.width <= 0 || box.y + box.height <= 0) return "off-page";
  if (viewport === undefined) return element.onViewport === false ? "below" : "on screen";
  const onScreen = element.onViewport ?? intersects(box, viewport);
  if (onScreen) return "on screen";
  if (box.y >= viewport.scrollY + viewport.height) return "below";
  if (box.y + box.height <= viewport.scrollY) return "above";
  return "off screen";
}

function intersects(box: NonNullable<WebLlmEvidenceElement["box"]>, viewport: WebLlmEvidenceViewport): boolean {
  return box.x < viewport.scrollX + viewport.width && box.x + box.width > viewport.scrollX
    && box.y < viewport.scrollY + viewport.height && box.y + box.height > viewport.scrollY;
}
