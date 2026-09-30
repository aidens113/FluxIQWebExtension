// What is standing over the page right now.
//
// Two questions are asked of the same document and they are not the same
// question, so they are two functions.
//
// `overlaysAt` answers "what covered *this* target": the modals the page
// declares and the browser paints, plus -- when the refusal was `covered` and
// so carries the point the hit test landed on -- the layer at that point, if
// that layer is a dialog or an overlay carrying its own way out. It is what
// `blocking-dialog.ts` has always asked, moved here unchanged so that the
// defence and the classification read one implementation rather than two that
// drift.
//
// `overlaysOverPage` answers "what is in the way at all", and it exists because
// the defence runs one layer up, in `recovery/`, where the hit point is gone:
// the point is page-side evidence that never leaves the frame on a result, and
// the loop sees only the result. So instead of the one point that was blocked,
// the viewport is probed at a few fixed places -- its centre, the middle of
// each edge -- and whatever dialog-like layer sits at each is collected. A
// centred modal is found at the centre, a consent bar at the bottom edge, a
// promotion strip at the top. Seven hit tests cost nothing and need no
// plumbing through a wire contract that would have to carry a coordinate it
// otherwise has no reason to carry.
//
// Both answers are elements of this document, never text off it.
//
// Both look through open shadow roots. A consent platform or chat vendor ships
// its layer as a custom element whose content lives in one, and
// `document.elementFromPoint` answers with that element's host: the layer's
// scrim, its declared dialog and its buttons were all invisible here, so a
// layer drawn that way could be neither classified nor cleared. The hit test
// descends (`deepElementFromPoint`), and every walk up or down crosses the
// boundary (`../../shadow-dom`). A closed root still presents only its host.

import { isExtensionUiNode } from "../../picker-host";
import { deepElementFromPoint } from "../../selector";
import { composedClosest, composedDescendants, composedParent, composedRoots, queryComposed } from "../../shadow-dom";
import { hasDismissalControl } from "./way-out";

/** A viewport coordinate, as the actionability gate's hit test reports it. */
export type Point = { x: number; y: number };

/** How many elements of one overlay are read for a declared dialog inside it. */
const DIALOG_SCAN_LIMIT = 5_000;

/** A dialog the page declares, open or not; which of them is painted is asked separately. */
const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]';

/** Where the viewport is probed when no blocked point is known: its centre, then the middle of each edge. */
const PROBE_FRACTIONS: ReadonlyArray<readonly [number, number]> = Object.freeze([
  [0.5, 0.5],
  [0.5, 0.08],
  [0.5, 0.92],
  [0.08, 0.5],
  [0.92, 0.5],
  [0.5, 0.25],
  [0.5, 0.75]
]);

/**
 * The dialogs that explain a refusal of this target: every painted modal, and
 * the covering layer at `blockedAt` when one was given.
 */
export function overlaysAt(blockedAt?: Point): Element[] {
  const modals = renderedModals();
  const layer = blockedAt ? coveringDialog(blockedAt) : undefined;
  return layer && !modals.includes(layer) ? [...modals, layer] : modals;
}

/**
 * Every dialog-like layer the page is painting over itself, found without being
 * told where the blocked target was.
 *
 * Order matters: a painted modal comes first, because a modal is over
 * everything by contract and closing it is what unblocks the page. The probed
 * layers follow in probe order, deduplicated.
 */
export function overlaysOverPage(): Element[] {
  const found = renderedModals();
  const view = typeof window === "undefined" ? undefined : window;
  if (!view) return found;
  const width = view.innerWidth;
  const height = view.innerHeight;
  if (!(width > 0) || !(height > 0)) return found;
  for (const [fx, fy] of PROBE_FRACTIONS) {
    const layer = coveringDialog({ x: Math.floor(width * fx), y: Math.floor(height * fy) });
    if (layer && !found.includes(layer)) found.push(layer);
  }
  return found;
}

/** Every modal the page declares and the browser paints: ARIA's first, then `<dialog>`s opened with `showModal()`. */
function renderedModals(): Element[] {
  const modals = painted('[aria-modal="true"]');
  // `:modal` is asked about before it is used, because an engine without it
  // would throw on the selector rather than match nothing.
  if (!modalPseudoClassSupported()) return modals;
  for (const element of painted("dialog:modal")) {
    if (!modals.includes(element)) modals.push(element);
  }
  return modals;
}

function modalPseudoClassSupported(): boolean {
  return typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("selector(dialog:modal)");
}

/** What matches a selector this module wrote and has a box on screen. */
function painted(selector: string): Element[] {
  return queryComposed(composedRoots(document), selector).filter((element) => element.getClientRects().length > 0);
}

/**
 * The dialog layer that lies over `point`, when what the hit test landed on is
 * one: inside an element that declares a dialog role, or inside a fixed overlay
 * -- a scrim -- that holds a declared dialog or its own way out.
 */
function coveringDialog(point: Point): Element | undefined {
  const hit = deepElementFromPoint(point.x, point.y);
  // The extension's own overlays (`picker-host.ts`) are never the page's layer.
  if (!hit || isExtensionUiNode(hit)) return undefined;
  const declared = composedClosest(hit, DIALOG_SELECTOR);
  if (declared) return declared;
  const overlay = outermostFixed(hit);
  if (!overlay) return undefined;
  const inner = declaredDialogWithin(overlay);
  if (inner) return inner;
  return hasDismissalControl(overlay) ? overlay : undefined;
}

/** The first painted dialog the overlay declares anywhere beneath it, shadow roots included. */
function declaredDialogWithin(overlay: Element): Element | undefined {
  let read = 0;
  for (const element of composedDescendants(overlay)) {
    if (++read > DIALOG_SCAN_LIMIT) return undefined;
    if (element.matches(DIALOG_SELECTOR) && element.getClientRects().length > 0) return element;
  }
  return undefined;
}

/**
 * The outermost ancestor-or-self below `<body>` that is fixed to the viewport:
 * an overlay's own root. The walk continues from a shadow root to its host,
 * because the fixed element is usually the widget's host and not anything
 * inside it.
 */
export function outermostFixed(element: Element): Element | undefined {
  const view = element.ownerDocument.defaultView;
  if (!view) return undefined;
  let found: Element | undefined;
  for (let current: Element | null = element; current && current !== element.ownerDocument.body && current !== element.ownerDocument.documentElement; current = composedParent(current)) {
    const position = view.getComputedStyle(current).position;
    if (position === "fixed" || position === "sticky") found = current;
  }
  return found;
}

