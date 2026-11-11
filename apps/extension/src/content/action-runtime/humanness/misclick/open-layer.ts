// Whether anything is open over the page (W2 H4, `before.ts`).
//
// A page closes its dialogs, popovers and menus on an outside click, so a
// misclick while one is open is not inert, whatever it lands on: no misclick is
// made while any is. Open means painted (a box on screen and not hidden), and
// it is read across open shadow roots (`../../../shadow-dom`):
//
//  - a declared layer: a native `dialog[open]`, an open `[popover]`, an element
//    with a dialog, alertdialog, menu or listbox role, or `aria-modal="true"`;
//  - the layers the interference defence finds over the page
//    (`../../interference/overlays.ts`, `overlaysOverPage`), asked of the
//    content script's own document, which is the target's;
//  - a fixed or sticky layer standing over a large share of the viewport at any
//    of the points the defence probes (`../../interference/probe-points.ts`): a
//    scrim, a drawer, a full-screen sheet. A fixed header or a corner badge is
//    not one, and the misclick point itself is never on any fixed or sticky
//    element (`inert-point.ts`).
//
// Anything this cannot read is taken as a layer: the misclick is skipped.

import { isExtensionUiNode } from "../../../picker-host";
import { deepElementFromPoint } from "../../../selector";
import { composedParent, composedRoots, queryComposed } from "../../../shadow-dom";
import { overlaysOverPage, probePoints } from "../../interference";

/** Layers a page declares, open when painted. */
const DECLARED_LAYER = 'dialog[open], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [aria-modal="true"]';

/** The share of the viewport a fixed or sticky element must cover to count as a layer over the page. */
const COVERING_SHARE = 0.35;

/** Whether a dialog, popover, menu, listbox or layer stands open over `document`'s page; `true` when it cannot be told. */
export function pageHasOpenLayer(document: Document): boolean {
  try {
    const roots = composedRoots(document);
    if (queryComposed(roots, DECLARED_LAYER).some(painted)) return true;
    if (openPopover(roots)) return true;
    if (sameDocument(document) && overlaysOverPage().length > 0) return true;
    return coveringLayerAtProbe(document);
  } catch {
    return true;
  }
}

/** Whether a popover is open; any painted `[popover]` counts when the engine cannot say which are open. */
function openPopover(roots: ReturnType<typeof composedRoots>): boolean {
  try {
    return queryComposed(roots, ":popover-open").length > 0;
  } catch {
    return queryComposed(roots, "[popover]").some(painted);
  }
}

/** Whether `document` is the content script's own, which the interference defence reads. */
function sameDocument(document: Document): boolean {
  return typeof globalThis.document !== "undefined" && globalThis.document === document;
}

/** Whether a fixed or sticky element over a large share of the viewport is hit at any probe point. */
function coveringLayerAtProbe(document: Document): boolean {
  const view = document.defaultView;
  if (!view) return true;
  const area = view.innerWidth * view.innerHeight;
  for (const point of probePoints(view.innerWidth, view.innerHeight)) {
    const hit = deepElementFromPoint(point.x, point.y, document);
    if (!hit || isExtensionUiNode(hit)) continue;
    const layer = outermostFixedLayer(hit);
    if (!layer) continue;
    const box = layer.getBoundingClientRect();
    const shown = Math.max(0, Math.min(box.right, view.innerWidth) - Math.max(box.left, 0)) * Math.max(0, Math.min(box.bottom, view.innerHeight) - Math.max(box.top, 0));
    if (area > 0 && shown / area >= COVERING_SHARE) return true;
  }
  return false;
}

/**
 * The outermost fixed or sticky ancestor-or-self below `<body>`, walked across
 * shadow roots: the walk `outermostFixed` in `../../interference/overlays.ts`
 * makes, which that directory's barrel does not export.
 */
function outermostFixedLayer(element: Element): Element | undefined {
  const view = element.ownerDocument.defaultView;
  if (!view) return undefined;
  let found: Element | undefined;
  for (let current: Element | null = element; current && current !== element.ownerDocument.body && current !== element.ownerDocument.documentElement; current = composedParent(current)) {
    const position = view.getComputedStyle(current).position;
    if (position === "fixed" || position === "sticky") found = current;
  }
  return found;
}

/** Whether the element has a box on screen and is not hidden. */
function painted(element: Element): boolean {
  if (element.getClientRects().length === 0) return false;
  const view = element.ownerDocument.defaultView;
  return !view || view.getComputedStyle(element).visibility !== "hidden";
}
