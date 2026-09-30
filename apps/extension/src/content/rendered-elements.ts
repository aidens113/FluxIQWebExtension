// Every element the page renders, in the order a person reads the page: the
// element list of a snapshot (t200).
//
// The list used to be a selection. Candidates were gathered from allow-lists,
// the rest of the page reached them only through a sweep capped at 50,000
// elements, anything `aria-hidden`, transparent, smaller than two pixels or
// without a name was dropped, what survived was ranked, and the ranking was cut
// at 2,000. A cookie wall's backdrop has no name, a custom checkbox is
// transparent, and a modal sets `aria-hidden` on the page behind it that is
// still on screen -- so the model was shown a page with the thing in the way
// removed, and could not answer it. The user's order was to stop: no limit on
// the elements passed to the model, nothing hidden, no ranking.
//
// So this walks the composed tree once, depth first, and keeps what is
// rendered. Composed means across open shadow roots: a host's own root is what
// is drawn, so its content comes first, then the light children its slots
// place. A closed root cannot be entered and is described as its host.
//
// **Not rendered**, and so neither listed nor descended into:
//
// - `script`, `style`, `noscript` and `template`, which draw nothing;
// - an element carrying `hidden`, whatever a stylesheet says about it;
// - an element whose computed `display` is `none`;
// - a light child of an open shadow root's host that no slot places, which is
//   not in the painted tree at all;
// - the extension's own overlays (`picker-host.ts`), which are not the page.
//
// **Not listed, still descended into**, because a descendant can be drawn:
//
// - `html` and `body`, which are the page rather than something on it;
// - an element whose computed `visibility` is `hidden` or `collapse` -- a child
//   may set `visible` again;
// - an element the browser says has no box (`checkVisibility`): the inside of
//   a closed `<details>`, a `content-visibility: hidden` subtree, an SVG
//   gradient's stops. A `display: contents` element has no box of its own and
//   is still listed, because its children are drawn where it stands, and so is
//   an image map's `<area>`, which never has one and is still pressed.
//
// Everything else is listed: `aria-hidden`, `opacity: 0`, a one-pixel input, a
// `<div>` with no name. Whether a reader can use an element is the reader's
// question; this only says what is on the page.

import { ACTIVITY_OVERLAY_HOST_ATTRIBUTE, PICKER_HOST_ATTRIBUTE } from "./picker-host";

/** Tags that draw nothing, together with everything inside them. */
const NOT_RENDERED_TAGS = new Set(["script", "style", "noscript", "template"]);

/** Elements with no box of their own that are still drawn, or still pressed. */
const BOXLESS_RENDERED_TAGS = new Set(["area"]);

/** What the walk found, and how many elements it looked at to find it. */
export type RenderedElements = {
  /** Every rendered element, in composed document order. */
  elements: Element[];
  /** Elements the walk visited, the ones it pruned at included and their insides not. */
  walked: number;
};

/** Every rendered element of `root`, in composed document order. */
export function renderedElements(root: Document = document): RenderedElements {
  const elements: Element[] = [];
  let walked = 0;
  const start = root.documentElement;
  if (!start) return { elements, walked };
  // A stack rather than recursion: a deeply nested page must not exhaust the
  // call stack of the capture that is trying to describe it.
  const pending: Element[] = [start];
  for (let element = pending.pop(); element; element = pending.pop()) {
    walked += 1;
    if (isPrunedWithItsSubtree(element)) continue;
    const style = getComputedStyle(element);
    if (style.display === "none") continue;
    if (isListed(element, style, root)) elements.push(element);
    const children = composedChildren(element);
    for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]!);
  }
  return { elements, walked };
}

/** The element draws nothing, and nothing inside it is drawn either. */
function isPrunedWithItsSubtree(element: Element): boolean {
  if (NOT_RENDERED_TAGS.has(element.tagName.toLowerCase())) return true;
  if (element.hasAttribute("hidden")) return true;
  // The host is asked, and its inside never reached: the walk is top down, so
  // the ancestor walk `isExtensionUiNode` makes would repeat on every element.
  return element.hasAttribute(PICKER_HOST_ATTRIBUTE) || element.hasAttribute(ACTIVITY_OVERLAY_HOST_ATTRIBUTE);
}

/** Whether a rendered element is one the list carries, rather than only a way to its children. */
function isListed(element: Element, style: CSSStyleDeclaration, root: Document): boolean {
  if (element === root.documentElement || element === root.body) return false;
  if (style.visibility === "hidden" || style.visibility === "collapse") return false;
  if (style.display === "contents" || BOXLESS_RENDERED_TAGS.has(element.tagName.toLowerCase())) return true;
  // Absent where the browser predates it; every browser this extension ships
  // for has it, and a unit test's hand-built element does not.
  return typeof element.checkVisibility !== "function" || element.checkVisibility();
}

/**
 * The element's children in the painted tree: its open shadow root's children,
 * then the light children a slot of that root places. An element with no open
 * root -- or a closed one, which cannot be read -- has its light children.
 */
function composedChildren(element: Element): Element[] {
  const shadow = element.shadowRoot;
  if (!shadow) return [...element.children];
  // `assignedSlot` is null for a light child no slot of an open root places.
  return [...shadow.children, ...[...element.children].filter((child) => child.assignedSlot !== null)];
}
