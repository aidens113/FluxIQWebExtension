// Whether a click at one point would land on nothing (W2 H4, `before.ts`).
//
// Inert means, all at once:
//
//  - the point is inside the viewport and outside the target's box, by a margin;
//  - the hit test there (`deepElementFromPoint`, through open shadow roots)
//    lands on page content: an element of the page, not its root, not the
//    extension's own UI, and not the target or anything inside it;
//  - neither the hit element nor any ancestor of it, walked across shadow
//    roots (`composedParent`), is interactive (`interactive-element.ts`) --
//    so the click cannot bubble into a link, a button, a labelled field, a
//    `cursor: pointer` card or an element with a handler -- or is fixed or
//    sticky, which is a layer or page chrome rather than content, or is a
//    declared dialog or popover, which covers its backdrop too.

import { isExtensionUiNode } from "../../../picker-host";
import { deepElementFromPoint } from "../../../selector";
import { composedContains, composedParent } from "../../../shadow-dom";
import type { ClickPoint } from "../../click-gesture";
import { isInteractiveElement } from "./interactive-element";

/** The least distance kept from the target's box, in pixels. */
const TARGET_MARGIN_PX = 2;

/** Selectors whose element, or anything inside it, is a layer rather than page content. */
const LAYER = 'dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"], [popover]';

/** The element a misclick at `point` would land on, when the point is inert beside `target`; else `undefined`. */
export function inertHitAt(point: ClickPoint, target: Element, document: Document): Element | undefined {
  const view = document.defaultView;
  if (!view || !(point.x >= 0 && point.y >= 0 && point.x < view.innerWidth && point.y < view.innerHeight)) return undefined;
  const box = target.getBoundingClientRect();
  const onTarget = point.x >= box.left - TARGET_MARGIN_PX && point.x <= box.right + TARGET_MARGIN_PX && point.y >= box.top - TARGET_MARGIN_PX && point.y <= box.bottom + TARGET_MARGIN_PX;
  if (onTarget) return undefined;
  const hit = deepElementFromPoint(point.x, point.y, document);
  if (!hit || hit === document.documentElement || isExtensionUiNode(hit) || composedContains(target, hit)) return undefined;
  for (let current: Element | null = hit; current; current = composedParent(current)) {
    if (isInteractiveElement(current) || current.matches(LAYER)) return undefined;
    const position = view.getComputedStyle(current).position;
    if (position === "fixed" || position === "sticky") return undefined;
  }
  return hit;
}
