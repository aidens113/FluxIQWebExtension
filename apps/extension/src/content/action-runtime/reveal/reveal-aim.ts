// Where to scroll so that a target the page has not shown may be shown, decided
// without moving anything.
//
// A person told to press "Show more people" who cannot see it scrolls down to
// where it would be: to the end of the list it belongs below. A page that loads
// its content as it is scrolled -- an `IntersectionObserver` on a sentinel at a
// grid's end, a scroll listener that fades a section in -- answers exactly that
// and nothing else, so a runtime that only waits never sees the control (live,
// install-core: every press of a team page's "Show more people" was refused
// `display: none` four attempts running while the grid that would have
// unhidden it waited for a scroll nobody made).
//
// **What is scrolled.**
// - A target with no box -- not rendered, `display: none` on itself or an
//   ancestor, a zero-size box -- has no position of its own, so the aim is the
//   end of its nearest rendered ancestor: the place the page would draw it, and
//   where a lazy list's sentinel sits. When that ancestor scrolls its own
//   content, its content is scrolled to the end as well, since that is where a
//   scrolling list loads more. An ancestor that is the page's body is the page.
// - A target with a box outside the viewport, hidden by `opacity: 0` or
//   `visibility: hidden`, is scrolled to itself: a section that fades in when
//   it is scrolled to is drawn exactly like that until it is. One already
//   inside the viewport is not scrolled, because scrolling it cannot change
//   anything a scroll listener has not already seen.
//
// **What is never scrolled for**, because scrolling cannot reveal it and would
// only move the page under the person: an inert target (a modal's backdrop
// owns it), and a target held by a layer -- a closed `<dialog>`, a popover, a
// fixed-position element, a closed `<details>`, a menu, listbox, dialog or
// tooltip role. Those are shown by being opened, which is a press the Flow
// makes, never a scroll the runtime makes.
//
// The reads are computed styles and boxes only, never the page's words, and
// nothing here is acted on: the aim is a scroll, made by `reveal-by-scroll.ts`.

import { composedClosest, composedParent } from "../../shadow-dom";

/** One scroll that may reveal a target: which element, which edge, and whether its own content goes to the end first. */
export type RevealAim = {
  element: Element;
  /** `end` for an ancestor the target would be drawn in; `center` for a target with a box of its own. */
  block: "end" | "center";
  /** The element scrolls its own content, and it is not at the end of it yet. */
  ownContent: boolean;
};

/** Roles whose content is shown by opening it, not by scrolling to it. */
const LAYER_ROLES: ReadonlySet<string> = new Set(["dialog", "alertdialog", "menu", "listbox", "tooltip"]);

/** How far, in CSS pixels, an edge may sit past the viewport and still count as inside it: sub-pixel layout rounding. */
const EDGE_SLACK_PX = 1;

/** The scroll that may reveal `target`, or `undefined` when scrolling plausibly cannot. */
export function revealAim(target: Element): RevealAim | undefined {
  if (!target.isConnected) return undefined;
  const view = target.ownerDocument.defaultView;
  if (!view) return undefined;
  // Inertness reaches into a shadow root from its host, so it is asked across the boundary, as the gate asks it.
  if (composedClosest(target, "[inert]")) return undefined;
  const box = target.getBoundingClientRect();
  if (box.width > 0 && box.height > 0) {
    if (heldByLayer(target, undefined, view) || insideViewport(box, view)) return undefined;
    return { element: target, block: "center", ownContent: false };
  }
  const anchor = renderedAncestor(target, view);
  // A closed `<details>` draws its summary and nothing else, so it is the nearest rendered ancestor of what it holds.
  if (!anchor || closedDetails(anchor) || heldByLayer(target, anchor, view)) return undefined;
  const ownContent = scrollsOwnContent(anchor, view) && !atContentEnd(anchor);
  if (!ownContent && endInView(anchor, view)) return undefined;
  return { element: anchor, block: "end", ownContent };
}

/** The nearest ancestor, across shadow boundaries, that is displayed and has a box. */
function renderedAncestor(target: Element, view: Window): Element | undefined {
  for (let current = composedParent(target); current; current = composedParent(current)) {
    if (view.getComputedStyle(current).display === "none") continue;
    const box = current.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) return current;
  }
  return undefined;
}

/**
 * Whether the target, or anything between it and `anchor` (exclusive), is a
 * layer the page opens rather than content it lays out in the flow. Computed
 * styles are read for undisplayed elements too, so `position: fixed` on a
 * hidden overlay is still known.
 */
function heldByLayer(target: Element, anchor: Element | undefined, view: Window): boolean {
  for (let current: Element | null = target; current && current !== anchor; current = composedParent(current)) {
    if (isLayer(current, view)) return true;
    // A target with a box is judged on itself and its nearest ancestors up to the page; the first one that
    // is not hidden ends the walk, since a layer above that is open and is not what hides the target.
    if (anchor === undefined && current !== target && !hiddenByStyle(current, view)) return false;
  }
  return false;
}

function isLayer(element: Element, view: Window): boolean {
  const tag = element.tagName.toLowerCase();
  if (tag === "dialog" || element.hasAttribute("popover")) return true;
  if (closedDetails(element)) return true;
  const role = element.getAttribute("role");
  if (role && LAYER_ROLES.has(role.trim().toLowerCase())) return true;
  return view.getComputedStyle(element).position === "fixed";
}

function closedDetails(element: Element): boolean {
  return element.tagName.toLowerCase() === "details" && !element.hasAttribute("open");
}

function hiddenByStyle(element: Element, view: Window): boolean {
  const style = view.getComputedStyle(element);
  return style.visibility !== "visible" || style.opacity === "0";
}

function insideViewport(box: DOMRect, view: Window): boolean {
  return box.bottom > 0 && box.right > 0 && box.top < view.innerHeight && box.left < view.innerWidth;
}

/** The anchor's end edge is inside the viewport and inside the nearest container that clips it. */
function endInView(anchor: Element, view: Window): boolean {
  const bottom = anchor.getBoundingClientRect().bottom;
  const container = scrollingContainer(anchor, view);
  const limit = container ? Math.min(view.innerHeight, container.getBoundingClientRect().bottom) : view.innerHeight;
  return bottom >= 0 && bottom <= limit + EDGE_SLACK_PX;
}

/** The nearest ancestor of `element` that scrolls its own content, below the page itself. */
function scrollingContainer(element: Element, view: Window): Element | undefined {
  for (let current = composedParent(element); current; current = composedParent(current)) {
    if (isPageScroller(current)) return undefined;
    if (scrollsOwnContent(current, view)) return current;
  }
  return undefined;
}

/** Whether the element scrolls its own content vertically: it overflows, and its style lets it scroll. The page's own scroller is the page, scrolled by `scrollIntoView`. */
function scrollsOwnContent(element: Element, view: Window): boolean {
  if (isPageScroller(element)) return false;
  if (element.scrollHeight <= element.clientHeight + EDGE_SLACK_PX) return false;
  const overflow = view.getComputedStyle(element).overflowY;
  return overflow === "auto" || overflow === "scroll" || overflow === "overlay";
}

function atContentEnd(element: Element): boolean {
  return element.scrollTop + element.clientHeight >= element.scrollHeight - EDGE_SLACK_PX;
}

function isPageScroller(element: Element): boolean {
  const document = element.ownerDocument;
  return element === document.documentElement || element === document.body;
}
