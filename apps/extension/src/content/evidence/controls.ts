// Which of a page's controls change what the page shows, and which are the
// site's standing furniture.
//
// ## The defect this closes
//
// The snapshot is a ranked list and the evidence packet describes its head:
// forty elements at most, and fewer once the byte budget bites. Ranking asks
// what kind of control an element is (`element-traits.ts`) and puts the page's
// own form controls first, then everything that reads as a link, button, tab
// or menu item -- one bucket holding the store's filter rail, its pager, its
// global navigation and its footer's twenty legal links alike, ordered inside
// the bucket by a score that a footer link wins because its label is a text
// node while a facet's label is wrapped in a `<span>`.
//
// Measured on the everything store's search page with the real content script
// in headless Chromium (2026-09-23): of 611 elements the snapshot ranked the
// Brightaisle Plus facet 56th, behind "Sell on Brightaisle", "Become an
// Affiliate", "Sustainability", "Careers", "Back to top" and fourteen more of
// the same. The packet carried 27 elements at its 6,000-byte budget and the
// facet was in none of them -- nor at 24,000 bytes, because the cut is the
// forty-element bound, not the budget. Both runs of campaign `ten-sites-r5`
// then read the unnarrowed list, "1-16 of over 1,000 results" where the
// narrowed page reads "of 43". A filter the model is never shown cannot be
// applied, and nothing downstream of the packet can recover it.
//
// ## The three rules
//
// **A page-state control** is one that changes what this page shows rather
// than taking the reader somewhere else: a facet, a sort, a price band, a
// pager, a "clear all filters". The signal is the page's own, not a
// framework's -- a link whose address is *this* document with a different
// query string, and a control of a GET form that submits back to this
// document. That is what a refinement is on a server-rendered site, and it
// separates the rail's twelve links from the footer's twenty without knowing
// anything about either site.
//
// A control with no href is not reached by this rule and does not need to be:
// a `<select>`, a checkbox or a button that filters through script is already
// a page control and already ranks above every link.
//
// **The front layer** is what paints over the page: a consent banner, a cookie
// bar, a sticky action bar. Its controls are ranked with the page-state
// controls rather than with the page's, because the page behind it cannot be
// clicked at all until they are dealt with -- which is the same reason the
// packet puts an open modal's controls first (`front-layer.ts` in the domain),
// applied to the layer a page paints rather than the dialog it opens. On the
// everything store this is the difference between a model that can dismiss the
// cookie banner covering ten of its controls and one that cannot: promoting
// the filter rail pushed Accept out of the packet, and this puts it back.
//
// **Site chrome** is what sits in the page's `contentinfo` landmark -- the
// footer. Its links are the same on every page of the site and change nothing
// about what this one shows, so they rank behind the page's own controls
// instead of ahead of them. They are demoted, never dropped: the snapshot
// still carries them, and a page small enough still describes them.
//
// Nothing here decides what an element is called or how it is addressed, only
// what is worth describing first.

import { landmarkRole } from "../identity";

/** As `identity/context.ts` bounds its own landmark walk. */
const MAX_LANDMARK_DEPTH = 30;

/**
 * How far above a control a positioned layer is looked for. A banner is its
 * control's parent or grandparent; a deeper walk only finds the page's own
 * scroll containers.
 */
const MAX_FRONT_LAYER_DEPTH = 8;

/**
 * Whether acting on this element changes what the page shows -- a facet, a
 * filter, a sort order, a page of results -- rather than navigating away.
 *
 * Two shapes, both read from the page's own markup:
 *
 * 1. A link to this document with a different query string. `?rh=plus` on the
 *    results page is a refinement; `/help` is a destination. A link differing
 *    only in its fragment is not one: "Back to top" is `#top` and moves the
 *    viewport, not the results.
 * 2. A control of a GET form the page *aimed* at this document. The store's
 *    price range is two text inputs and a submit, and that form carries
 *    `action="/.../s"` -- the results path it is already on. The action has to
 *    be written down: a form with none submits to wherever it happens to be,
 *    which says nothing about what it is for, and the store's footer signup is
 *    exactly that shape. Such a form's controls are still page controls and
 *    still rank above every link; they simply do not jump the queue.
 */
export function isPageStateControl(element: Element): boolean {
  return isSameDocumentQueryLink(element) || submitsToThisDocument(element);
}

/**
 * Whether the element sits in a layer that paints over the page: itself or an
 * ancestor positioned `fixed` or `sticky`.
 *
 * Asked only of the page's own controls, never of its links, and the caller
 * enforces that (`dom-snapshot.ts`). A fixed layer's buttons are what has to be
 * pressed before the page is usable; a sticky header's twenty links are the
 * site's navigation wherever they are painted, and promoting those would put
 * back exactly the crowd this ranking exists to clear.
 *
 * Computed style rather than the inline attribute, because the position that
 * matters is the one the page's stylesheet applied.
 */
export function isFrontLayer(element: Element): boolean {
  let current: Element | null = element;
  for (let depth = 0; current && depth < MAX_FRONT_LAYER_DEPTH; depth += 1) {
    if (current === current.ownerDocument?.body || current === current.ownerDocument?.documentElement) return false;
    const position = getComputedStyle(current).position;
    if (position === "fixed" || position === "sticky") return true;
    current = current.parentElement;
  }
  return false;
}

/**
 * Whether the element sits in the page's footer, by the landmark rule the rest
 * of the snapshot uses: the nearest landmark at or above it is `contentinfo`.
 *
 * The nearest one, so a control inside a named `<section>` or a `<nav>` within
 * the footer is that landmark's rather than the footer's, exactly as an
 * element's reported `context.landmark` is.
 */
export function isSiteChrome(element: Element): boolean {
  let current: Element | null = element;
  for (let depth = 0; current && depth < MAX_LANDMARK_DEPTH; depth += 1) {
    const role = landmarkRole(current);
    if (role) return role === "contentinfo";
    current = current.parentElement;
  }
  return false;
}

/**
 * A link addressing this document with a different query string.
 *
 * The document's own side is read from `location` rather than parsed out of
 * `location.href`, because this is asked of every candidate on the page and the
 * three fields are the whole comparison.
 */
function isSameDocumentQueryLink(element: Element): boolean {
  const href = linkAddress(element);
  return href !== undefined && href.origin === location.origin && href.pathname === location.pathname && href.search !== location.search;
}

/**
 * The absolute address of a link, or `undefined` for an element that is not
 * one. The resolved `href` property is preferred where the element exposes one
 * -- it is already resolved against the document base -- and the attribute is
 * resolved by hand for an element given a link role by ARIA alone.
 */
function linkAddress(element: Element): URL | undefined {
  const attribute = element.getAttribute("href");
  if (attribute === null) return undefined;
  const resolved = element instanceof HTMLAnchorElement || element instanceof HTMLAreaElement ? element.href : attribute;
  return safeUrl(resolved, element.ownerDocument?.baseURI);
}

/**
 * A URL, or `undefined` for an address that is not one -- `javascript:`,
 * `mailto:`, a malformed value.
 *
 * `new URL` throws a `TypeError`, and only a `TypeError`, for a string it
 * cannot parse, and a string this page cannot resolve into an address is not a
 * refinement of it. Any other failure is a defect in this module or in the
 * browser and is rethrown rather than read as "not a link".
 */
function safeUrl(value: string, base?: string): URL | undefined {
  try {
    const url = base === undefined ? new URL(value) : new URL(value, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch (error) {
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}

/**
 * Whether the element is a control of a GET form the page aimed at this
 * document. A POST form changes something rather than narrowing what is shown,
 * a form aimed elsewhere is a departure, and a form with no action at all is
 * aimed wherever it stands rather than at anything.
 *
 * Only a real form control asks -- an input, a select, a textarea, a button --
 * so a link that merely sits inside a filter form is judged by the link rule
 * and by nothing else. Its owner is the form the browser says it belongs to,
 * which is the enclosing `<form>` or the one a `form=` attribute names.
 */
function submitsToThisDocument(element: Element): boolean {
  const form = owningForm(element);
  if (!form || (form.getAttribute("method") ?? "get").trim().toLowerCase() !== "get") return false;
  const action = form.getAttribute("action");
  if (action === null || action.trim() === "") return false;
  const target = safeUrl(action, form.ownerDocument?.baseURI);
  return target !== undefined && target.origin === location.origin && target.pathname === location.pathname;
}

/** The form the browser says this control belongs to, or `undefined` for an element that is not one. */
function owningForm(element: Element): HTMLFormElement | undefined {
  const owner = element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLButtonElement
    ? element.form
    : null;
  return owner ?? undefined;
}
