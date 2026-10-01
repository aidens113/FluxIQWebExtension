// Which elements the page drew as controls out of something that is not one.
//
// **A drawn control** is one the page built out of an element the browser
// makes nothing of: a `<div>` with a click handler attached in script and a
// pointer cursor. Measured on the crossborder marketplace (2026-09-23):
// "Spain", "Free shipping" and "4★ & up" are `<div class="filterOption">` with
// their listeners added by script, and nothing in the markup says they can be
// pressed. `isDrawnControl` says the little that can honestly be read from the
// markup: this is a control *of this page*. The interference scan asks it of
// what covers a target (`action-runtime/interference/covering-layer.ts`), so a
// layer holding such a control is known to be something a person can answer.
//
// This module also held the rules the snapshot ranked its elements by -- which
// controls change what the page shows, which sit in a layer painted over it,
// which are the site's footer, and whether a link only repeats the page's own
// address. The element list is not ranked any more (t200): every rendered
// element is listed in document order, so those rules had nothing left to
// decide and were removed with the ranking.

import { directVisibleText } from "../describe-element";
import { isActionableElement, isInteractableUiElement, meaningfulText } from "../element-traits";
import { authoredNameAttribute, isRecordElement } from "../identity";

/**
 * How far above a drawn control its clickability is traced. Twelve levels is
 * what `event-elements.ts` walks to find what a pointer press activates, and a
 * handler further up than that is not this element's.
 */
const MAX_DRAWN_CONTROL_DEPTH = 12;

/**
 * Whether the page drew this element as a control out of something that is not
 * one: the page dressed it to be pressed, and the browser makes nothing of it.
 *
 * Nothing here re-tests for a link or a form control: guard 1 excludes
 * everything the browser already makes a control of. Four guards, each of
 * which was measured to be load-bearing across the ten campaign sites:
 *
 * 1. **Not something the browser already makes a control of.** A `<label>` is
 *    actionable and is *not* one of these: on the big-box retailer eighteen
 *    facet labels wrap a checkbox that is already a page control, and admitting
 *    them would have doubled that rail to no purpose.
 * 2. **Not a record, and not a container of records.** A row, card, list item
 *    or anything carrying a per-instance key is the page's content, not a
 *    control of it. The job board draws twelve clickable `<article>` cards; the
 *    products, posts and listings on five other fixtures are the same shape.
 *    Calling those controls would make the page's content read as its
 *    controls, which is the flood this guard exists to stop.
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
 *    header wraps its account flyout in one, a handle that opens a drawer and
 *    whose 180 characters of text are all its children's. This is the reading `describeElement` already
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
