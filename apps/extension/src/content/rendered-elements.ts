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
//
// **`includeHidden`** (t223) is a search's capture: `web.find_on_page` and
// `web.describe_element` look for words a closed menu or a collapsed panel
// holds. With it, the walk also lists what it would skip as not rendered -- a
// `hidden` or `display: none` subtree, a hidden-visibility element, an element
// with no box -- and names each in `hidden`, in the same composed order. It
// still never lists `script`, `style`, `noscript`, `template`, the extension's
// overlays, `html` or `body`, nor two things that hold no words a person could
// be shown: the document's `head` (its title and metadata) and an
// `<input type="hidden">`, whose value is form plumbing -- often a token --
// rather than anything on the page. `walked` counts what a capture without the
// option would have counted, so a search's evidence totals read as a look's.

import { ACTIVITY_OVERLAY_HOST_ATTRIBUTE, PICKER_HOST_ATTRIBUTE } from "./picker-host";

/** Tags that draw nothing, together with everything inside them. */
const NOT_RENDERED_TAGS = new Set(["script", "style", "noscript", "template"]);

/** Elements with no box of their own that are still drawn, or still pressed. */
const BOXLESS_RENDERED_TAGS = new Set(["area"]);

/** What a caller may ask of the walk. */
export type RenderedElementsOptions = {
  /** Also list what is not rendered, each named in `hidden`. */
  readonly includeHidden?: boolean | undefined;
};

/** What the walk found, and how many elements it looked at to find it. */
export type RenderedElements = {
  /** Every rendered element, in composed document order -- and, asked with `includeHidden`, every hidden one among them. */
  elements: Element[];
  /** Elements the walk visited, the ones it pruned at included and their insides not. */
  walked: number;
  /** Asked with `includeHidden`: the members of `elements` that are not rendered. Absent otherwise. */
  hidden?: ReadonlySet<Element>;
};

/** How an element the walk reached stands: listed, the page itself, or present without being seen. */
type Standing = "listed" | "page" | "unseen";

/** Every rendered element of `root`, in composed document order. */
export function renderedElements(root: Document = document, options: RenderedElementsOptions = {}): RenderedElements {
  const includeHidden = options.includeHidden === true;
  const elements: Element[] = [];
  const hidden = new Set<Element>();
  let walked = 0;
  const start = root.documentElement;
  if (!start) return includeHidden ? { elements, walked, hidden } : { elements, walked };
  // A stack rather than recursion: a deeply nested page must not exhaust the
  // call stack of the capture that is trying to describe it. The second stack
  // says whether each pending element sits inside a subtree that is not
  // rendered, which only an `includeHidden` walk ever enters.
  const pending: Element[] = [start];
  const insideUnrendered: boolean[] = [false];
  for (let element = pending.pop(); element; element = pending.pop()) {
    const inside = insideUnrendered.pop() === true;
    if (!inside) walked += 1;
    if (isPrunedWithItsSubtree(element)) continue;
    let unrendered = inside || element.hasAttribute("hidden");
    if (unrendered && !includeHidden) continue;
    let standing: Standing;
    if (unrendered) {
      if (isNeverListedHidden(element)) continue;
      standing = isPage(element, root) ? "page" : "unseen";
    } else {
      const style = getComputedStyle(element);
      if (style.display === "none") {
        if (!includeHidden || isNeverListedHidden(element)) continue;
        unrendered = true;
        standing = isPage(element, root) ? "page" : "unseen";
      } else {
        standing = standingOf(element, style, root);
      }
    }
    if (standing === "listed") elements.push(element);
    else if (standing === "unseen" && includeHidden) {
      elements.push(element);
      hidden.add(element);
    }
    const children = composedChildren(element);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      pending.push(children[index]!);
      insideUnrendered.push(unrendered);
    }
  }
  return includeHidden ? { elements, walked, hidden } : { elements, walked };
}

/** The element draws nothing, and nothing inside it is drawn either. */
function isPrunedWithItsSubtree(element: Element): boolean {
  if (NOT_RENDERED_TAGS.has(element.tagName.toLowerCase())) return true;
  // The host is asked, and its inside never reached: the walk is top down, so
  // the ancestor walk `isExtensionUiNode` makes would repeat on every element.
  return element.hasAttribute(PICKER_HOST_ATTRIBUTE) || element.hasAttribute(ACTIVITY_OVERLAY_HOST_ATTRIBUTE);
}

/** Not rendered, and not listed even by an `includeHidden` walk: the document's metadata, and a hidden input's value. */
function isNeverListedHidden(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  if (tagName === "head") return true;
  return tagName === "input" && element.getAttribute("type")?.trim().toLowerCase() === "hidden";
}

function isPage(element: Element, root: Document): boolean {
  return element === root.documentElement || element === root.body;
}

/** Whether a rendered element is one the list carries, the page itself, or only a way to its children. */
function standingOf(element: Element, style: CSSStyleDeclaration, root: Document): Standing {
  if (isPage(element, root)) return "page";
  if (style.visibility === "hidden" || style.visibility === "collapse") return "unseen";
  if (style.display === "contents" || BOXLESS_RENDERED_TAGS.has(element.tagName.toLowerCase())) return "listed";
  // Absent where the browser predates it; every browser this extension ships
  // for has it, and a unit test's hand-built element does not.
  return typeof element.checkVisibility !== "function" || element.checkVisibility() ? "listed" : "unseen";
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
