// Whether a layer over the page is a wall: something that stands between a
// person and the whole page, rather than a panel beside what they are doing.
//
// **Why this is asked (t656).** A step whose target is missing clears a layer
// first only when the target may be hidden *behind* it (`presence.ts`): a page
// that draws the target once its consent wall is answered (t174). Until t656
// any layer with a way out counted, and bigbox-retail's cart Flow lost its
// store picker that way (`run-mvac0ddx-f52ba929`): an optional "No thanks"
// step found its promotion already gone, the clearing pressed the close glyph
// of the header's store flyout the step before had opened, and the next step's
// "Set as my store" was left with no box. A popover hanging from the header
// covers four controls; no target is waiting behind it to be drawn.
//
// So a wall is one of two things, both of which take the whole page:
//
// - **a painted modal**: the layer, or a layer around it, declares
//   `aria-modal="true"`, or is a `<dialog>` opened with `showModal()`. The page
//   says by contract that nothing else may be used while it is up. The consent
//   walls of t174 (company-website) and of bigbox-retail are both.
// - **a scrim over the viewport centre**: the layer's own fixed root, or an
//   element beside that root, is fixed and spans the viewport (at least
//   `SCRIM_SHARE` of it each way), and the centre of the viewport is inside
//   that scrim or that root. A page that greys itself out behind an undeclared
//   dialog is still walled off.
//
// A sticky header's popover is neither: its fixed root is the header, whose box
// is one strip of the viewport, and nothing beside it covers the page.
//
// It never throws, for the reason `clear.ts` gives, and answers no for a layer
// it cannot read.

import { deepElementFromPoint } from "../../selector";
import { composedClosest, composedContains } from "../../shadow-dom";
import { outermostFixed } from "./overlays";

/** How much of the viewport's width and height an element must cover to be a scrim. */
const SCRIM_SHARE = 0.9;

/** Whether this layer walls off the whole page: a painted modal, or a layer on a scrim over the viewport's centre. */
export function isPageWall(layer: Element): boolean {
  try {
    return paintedModal(layer) || onScrimOverCentre(layer);
  } catch {
    return false;
  }
}

function paintedModal(layer: Element): boolean {
  const declared = composedClosest(layer, '[aria-modal="true"]');
  if (declared && declared.getClientRects().length > 0) return true;
  return modalPseudoClassSupported() && layer.matches("dialog:modal");
}

function modalPseudoClassSupported(): boolean {
  return typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("selector(dialog:modal)");
}

function onScrimOverCentre(layer: Element): boolean {
  if (typeof window === "undefined") return false;
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (!(width > 0) || !(height > 0)) return false;
  const root = outermostFixed(layer) ?? layer;
  const scrim = [root, root.previousElementSibling, root.nextElementSibling].find((element) => element && coversViewport(element, width, height));
  if (!scrim) return false;
  const centre = deepElementFromPoint(Math.floor(width / 2), Math.floor(height / 2));
  return centre !== null && (composedContains(scrim, centre) || composedContains(root, centre));
}

function coversViewport(element: Element, width: number, height: number): boolean {
  const view = element.ownerDocument.defaultView;
  if (!view || view.getComputedStyle(element).position !== "fixed") return false;
  const box = element.getBoundingClientRect();
  return box.width >= width * SCRIM_SHARE && box.height >= height * SCRIM_SHARE;
}
