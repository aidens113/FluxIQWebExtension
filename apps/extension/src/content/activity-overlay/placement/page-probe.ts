// What lies under one point of the live page, for `choosePlacement`.
//
// The browser's own hit test answers which element is on top at the point
// (`elementFromPoint`, stepping into open shadow roots, where chat widgets
// and consent banners often live). The element and its ancestors then say
// what it is:
//
// - **fixed** -- it is, or sits in, a `position: fixed` or `sticky` box, or a
//   dialog (`<dialog open>`, `role="dialog"`, `aria-modal`): something that
//   stays over the content and that a person may have to reach.
// - A fixed box covering most of the viewport is a **backdrop** -- a modal's
//   scrim, an app shell -- not an obstacle: covering its corner hides nothing
//   the person needs, and the dialog it frames is found on its own. A point
//   where the backdrop's own surface is all there is -- no control and no
//   words of its own -- is looked beneath, since a scrim is see-through: on
//   crossborder-marketplace's home page a coupon dialog's scrim covered the
//   whole viewport, every corner read clear, and the pill sat on the cookie
//   banner's text showing through it (D11 of the t342 round 2 UI review,
//   run-muylu4pp-f9cb2121, moment 2). Beneath it, the cookie banner is fixed.
// - **control** -- an ordinary link, button or field in the page's flow. It
//   scrolls, so it only breaks ties between clear corners.
// - **content** -- something in the page's flow a person reads: an image, a
//   video, a canvas, an SVG drawing, an embedded frame, or an element whose
//   own text is not blank. A box that only holds other boxes (a gallery's
//   background, a layout column) is not content.
//
// The extension's own UI is never an obstacle (`isExtensionUiNode`), and the
// overlay is `pointer-events: none`, so the hit test passes through it.
//
// One probe serves one placement check: it caches what it learns about each
// element, so a check reads each element's computed style at most once and
// writes nothing -- the check is all reads, and the overlay is moved (one
// write) only after it.

import { isExtensionUiNode } from "../../picker-host";
import type { PointCover } from "./choose-placement";

const CONTROL_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "label",
  "[role=button]",
  "[role=link]",
  "[role=checkbox]",
  "[role=tab]",
  "[role=menuitem]",
  "[contenteditable=true]",
  "[contenteditable='']"
].join(",");

/** A fixed box covering at least this share of the viewport is a backdrop, not an obstacle. */
const BACKDROP_SHARE = 0.6;
/** How many nested open shadow roots the hit test steps into. */
const MAX_SHADOW_DEPTH = 4;

type Layer = "fixed" | "backdrop" | "flow";

/** A probe of the page as it is now, for one placement check. */
export function pageProbe(): (x: number, y: number) => PointCover {
  const root = document.documentElement;
  const viewportArea = Math.max(1, root.clientWidth * root.clientHeight);
  const layers = new Map<Element, Layer>();
  const covers = new Map<Element, { cover: PointCover; surface?: Element }>();

  const layerOf = (element: Element): Layer => {
    let layer = layers.get(element);
    if (layer === undefined) {
      layer = floats(element) ? (area(element) >= BACKDROP_SHARE * viewportArea ? "backdrop" : "fixed") : "flow";
      layers.set(element, layer);
    }
    return layer;
  };

  /** What `hit` is, and the backdrop it sits on when only that backdrop's surface is at the point. */
  const coverOf = (hit: Element): { cover: PointCover; surface?: Element } => {
    let control = false;
    for (let element: Element | undefined = hit; element && element !== root && element !== document.body; element = parentOf(element)) {
      if (!control && element.matches(CONTROL_SELECTOR)) control = true;
      const layer = layerOf(element);
      if (layer === "fixed") return { cover: "fixed" };
      if (layer === "backdrop") {
        const cover = control ? "control" : isContent(hit) ? "content" : null;
        return cover === null ? { cover, surface: element } : { cover };
      }
    }
    return { cover: control ? "control" : isContent(hit) ? "content" : null };
  };
  const coverAt = (hit: Element): { cover: PointCover; surface?: Element } => {
    let known = covers.get(hit);
    if (known === undefined) {
      known = coverOf(hit);
      covers.set(hit, known);
    }
    return known;
  };

  return (x, y) => {
    const hit = topmostAt(x, y);
    if (!hit || isExtensionUiNode(hit)) return null;
    const found = coverAt(hit);
    return found.surface === undefined ? found.cover : beneath(found.surface, x, y, coverAt);
  };
}

/**
 * What lies under a backdrop's bare surface at the point: the first element of
 * the page's hit stack that is not the backdrop or inside it, read as any hit
 * is. Nothing when the browser gives no stack, or nothing is beneath.
 */
function beneath(backdrop: Element, x: number, y: number, coverAt: (hit: Element) => { cover: PointCover; surface?: Element }): PointCover {
  if (typeof document.elementsFromPoint !== "function") return null;
  const root = document.documentElement;
  for (const element of document.elementsFromPoint(x, y)) {
    if (element === backdrop || backdrop.contains(element) || isExtensionUiNode(element)) continue;
    if (element === root || element === document.body) return null;
    const found = coverAt(deepestAt(element, x, y));
    // A second backdrop under the first is looked beneath in turn.
    if (found.surface === undefined) return found.cover;
    backdrop = found.surface;
  }
  return null;
}

/** The topmost element at the point, looking into open shadow roots. */
function topmostAt(x: number, y: number): Element | undefined {
  const element = document.elementFromPoint(x, y) ?? undefined;
  return element === undefined ? undefined : deepestAt(element, x, y);
}

/** `element`, or the element at the point inside its open shadow roots. */
function deepestAt(element: Element, x: number, y: number): Element {
  let deepest = element;
  for (let depth = 0; depth < MAX_SHADOW_DEPTH; depth += 1) {
    const inner = deepest.shadowRoot?.elementFromPoint(x, y);
    if (!inner || inner === deepest) break;
    deepest = inner;
  }
  return deepest;
}

/** The element's parent, stepping out of a shadow root to its host. */
function parentOf(element: Element): Element | undefined {
  if (element.parentElement) return element.parentElement;
  // By duck type: a shadow root is the one root node with a host.
  const root = element.getRootNode() as Partial<ShadowRoot>;
  return root.host ?? undefined;
}

const MEDIA_SELECTOR = "img, picture, video, canvas, svg, iframe, object, embed";

/** Content a person reads: media (or a part of an SVG drawing), or an element with its own non-blank text. */
function isContent(element: Element): boolean {
  if (element.matches(MEDIA_SELECTOR) || element.closest("svg")) return true;
  for (const child of element.childNodes) {
    if (child.nodeType === 3 && (child.textContent ?? "").trim() !== "") return true;
  }
  return false;
}

/** A box that stays over the content: fixed, sticky, or a dialog. */
function floats(element: Element): boolean {
  if (element.tagName === "DIALOG" && element.hasAttribute("open")) return true;
  const role = element.getAttribute("role");
  if (role === "dialog" || role === "alertdialog" || element.getAttribute("aria-modal") === "true") return true;
  const position = getComputedStyle(element).position;
  return position === "fixed" || position === "sticky";
}

function area(element: Element): number {
  const rect = element.getBoundingClientRect();
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}
