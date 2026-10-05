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
//   the person needs, and the dialog it frames is found on its own. What is
//   beneath it is not looked at, since the backdrop covers it too.
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
  const covers = new Map<Element, PointCover>();

  const layerOf = (element: Element): Layer => {
    let layer = layers.get(element);
    if (layer === undefined) {
      layer = floats(element) ? (area(element) >= BACKDROP_SHARE * viewportArea ? "backdrop" : "fixed") : "flow";
      layers.set(element, layer);
    }
    return layer;
  };

  const coverOf = (hit: Element): PointCover => {
    let control = false;
    for (let element: Element | undefined = hit; element && element !== root && element !== document.body; element = parentOf(element)) {
      if (!control && element.matches(CONTROL_SELECTOR)) control = true;
      const layer = layerOf(element);
      if (layer === "fixed") return "fixed";
      if (layer === "backdrop") break;
    }
    return control ? "control" : isContent(hit) ? "content" : null;
  };

  return (x, y) => {
    const hit = topmostAt(x, y);
    if (!hit || isExtensionUiNode(hit)) return null;
    let cover = covers.get(hit);
    if (cover === undefined) {
      cover = coverOf(hit);
      covers.set(hit, cover);
    }
    return cover;
  };
}

/** The topmost element at the point, looking into open shadow roots. */
function topmostAt(x: number, y: number): Element | undefined {
  let element = document.elementFromPoint(x, y) ?? undefined;
  for (let depth = 0; element && depth < MAX_SHADOW_DEPTH; depth += 1) {
    const inner = element.shadowRoot?.elementFromPoint(x, y);
    if (!inner || inner === element) break;
    element = inner;
  }
  return element;
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
