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
// ## The four rules
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
// **A drawn control** is one the page built out of something that is not a
// control: a `<div>` with a click handler attached in script and a pointer
// cursor. The browser makes nothing of such an element, so none of the rules
// above reach it and it ranks in the last control band, behind every link on
// the page -- which on a page with a hundred links means it is described
// nowhere. Measured on the crossborder marketplace (2026-09-23): "Spain",
// "Free shipping" and "4★ & up" are `<div class="filterOption">` with their
// listeners added by script, they ranked 58th, 61st and 62nd of 292 elements,
// and the packet's 31 elements reached none of them -- before this change and
// after t100's, which ranked only links and form controls. That site's whole
// instruction depends on those three. `isDrawnControl` says the little that
// can honestly be read from the markup: this is a control *of this page*, so
// it ranks with the page's own form controls. It does not claim that pressing
// it narrows the results, which is what the page-state rule claims and what no
// `<div>` discloses.
//
// Nothing here decides what an element is called or how it is addressed, only
// what is worth describing first -- with one exception, `addressesThisDocument`.
// `link-address.ts` reads it to decide whether a link's address is worth
// carrying at all. It is the question `isSameDocumentQueryLink` already asks,
// less the query, and it lives here so that one reading of "this link points at
// the page it is on" serves both.

import { directVisibleText } from "../describe-element";
import { isActionableElement, isInteractableUiElement, meaningfulText } from "../element-traits";
import { authoredNameAttribute, isRecordElement, landmarkRole } from "../identity";

/** As `identity/context.ts` bounds its own landmark walk. */
const MAX_LANDMARK_DEPTH = 30;

/**
 * How far above a drawn control its clickability is traced. Twelve levels is
 * what `event-elements.ts` walks to find what a pointer press activates, and a
 * handler further up than that is not this element's.
 */
const MAX_DRAWN_CONTROL_DEPTH = 12;

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
 * Whether the page drew this element as a control out of something that is not
 * one: the page dressed it to be pressed, and the browser makes nothing of it.
 *
 * Asked only of what falls through every other control test
 * (`dom-snapshot.ts`), which is why nothing here re-tests for a link or a form
 * control. Four guards, each of which was measured to be load-bearing across
 * the ten campaign sites:
 *
 * 1. **Not something the browser already makes a control of.** A `<label>` is
 *    actionable and is *not* one of these: on the big-box retailer eighteen
 *    facet labels wrap a checkbox that is already a page control, and admitting
 *    them would have doubled that rail in the packet to no purpose.
 * 2. **Not a record, and not a container of records.** A row, card, list item
 *    or anything carrying a per-instance key is the page's content, not a
 *    control of it. The job board draws twelve clickable `<article>` cards; the
 *    products, posts and listings on five other fixtures are the same shape.
 *    Promoting those would rank the page's own content ahead of every link on
 *    it, which is the flood this guard exists to stop.
 * 3. **Its clickability is its own.** A pointer cursor is inherited, so every
 *    descendant of a clickable `<div>` looks clickable too, and a span inside a
 *    label inherits the label's. Only the outermost element of such a run is
 *    the control; the rest are its insides. In the crossborder marketplace's
 *    filter rail this is the difference between eleven controls and twenty-one
 *    elements, ten of them the empty `<span>` a filter option draws its
 *    checkbox with.
 * 4. **It says in its own words what it is.** A clickable region whose every
 *    word belongs to a child is a panel that happens to respond to a click, and
 *    what there is to press is one of those children. The same marketplace's
 *    header wraps its account flyout in one: described, it cost the packet its
 *    most expensive element -- 180 characters of its children's text -- for a
 *    handle that opens a drawer. This is the reading `describeElement` already
 *    takes of a container, and an `aria-label` or `title` the author wrote
 *    counts as the element's own words, so a control drawn as an icon beside a
 *    labelled span is still admitted when it was marked up for a screen reader.
 *
 * Measured with those four guards across all ten campaign sites, the rule
 * admits twenty-five elements on the crossborder marketplace -- its ten filter
 * options, the button that applies its price range, its five sort tabs, its
 * pager and page-jump, its consent banner's four and its two cart controls,
 * every one of them a control a reader can press and none of them reachable any
 * other way -- and **at most two** on each of the other nine, none at all on
 * six of them. The big-box retailer, the job board, the classifieds, the photo
 * and social feeds and the professional network admit nothing; the everything
 * store admits its banner's close box and its delivery-address control, the
 * auction site its "Reject all", the company website its "Request a quote" and
 * "Cookie settings".
 */
export function isDrawnControl(element: Element): boolean {
  if (isActionableElement(element) || !isInteractableUiElement(element)) return false;
  if (isRecordElement(element) || holdsRecords(element)) return false;
  return namesItself(element) && clickabilityIsItsOwn(element);
}

/**
 * Whether the element carries words of its own -- its own text nodes, or a name
 * the author wrote on it -- rather than only its children's.
 */
function namesItself(element: Element): boolean {
  return meaningfulText(directVisibleText(element)) || meaningfulText(authoredNameAttribute(element));
}

/**
 * Whether the element's address is this very page: same origin, same path,
 * whatever the query.
 *
 * Read where the descriptor is assembled, which drops a link's `href` when this
 * holds. The packet reports a link as its origin and pathname and never its
 * query (`domain/src/runtime/llm-evidence/location.ts`, which strips the query
 * because that is where session tokens live), so for a link back to this page
 * the published address is a byte-for-byte copy of the packet's own `location`
 * field. Measured on the everything store's search page (2026-09-23): twenty-two
 * of its thirty-two described elements each carried the identical 58-byte
 * string, 1,320 bytes of a 6,000-byte budget -- 22% of everything the model is
 * given, spent saying where it already knows it is.
 */
export function addressesThisDocument(element: Element): boolean {
  const href = linkAddress(element);
  return href !== undefined && isThisDocument(href);
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
  return href !== undefined && isThisDocument(href) && href.search !== location.search;
}

/**
 * Whether an address names the document this code is running in, query and
 * fragment aside.
 *
 * The document's own side is read from `location` rather than parsed out of
 * `location.href`, because this is asked of every candidate on the page and the
 * two fields are the whole comparison.
 */
function isThisDocument(href: URL): boolean {
  return href.origin === location.origin && href.pathname === location.pathname;
}

/**
 * Whether the element's own handler, rather than an ancestor's, is what makes
 * it clickable: no element above it within the activation walk is interactable.
 *
 * `isInteractableUiElement` covers the actionable elements too, so this closes
 * both a span inside a `<label>` and a span inside a clickable `<div>` with one
 * question.
 */
function clickabilityIsItsOwn(element: Element): boolean {
  let current: Element | null = element.parentElement;
  for (let depth = 0; current && depth < MAX_DRAWN_CONTROL_DEPTH; depth += 1) {
    if (current === current.ownerDocument?.body || current === current.ownerDocument?.documentElement) return true;
    if (isInteractableUiElement(current)) return false;
    current = current.parentElement;
  }
  return true;
}

/**
 * Whether the element is the container of a repeated thing -- a list of rows,
 * cards or list items -- rather than a control.
 *
 * Its own children are asked and no deeper: a container holds its records as
 * children, and a sweep of every descendant would be a subtree query on every
 * candidate of every capture.
 */
function holdsRecords(element: Element): boolean {
  for (const child of element.children) {
    if (isRecordElement(child)) return true;
  }
  return false;
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
