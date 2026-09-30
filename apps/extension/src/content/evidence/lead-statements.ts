// What the page's main region says about itself: the first few short lines of
// its own text, which the snapshot ranks with the controls that change what the
// region shows (`dom-snapshot.ts`).
//
// ## The defect this closes
//
// The snapshot ranks text behind every control, the footer's links included,
// because a control is something to act on (`dom-snapshot.ts`,
// `snapshotElementBucket`). The packet a model reads describes the head of that
// ranking: forty elements at most and about thirty once the 6,000-byte budget
// bites, which on the everything store's results page are all controls
// (`controls.ts` has the measurement). So a page's own statement of what it is
// showing -- "No results for ...", "1-16 of 42 results for ...", "Your cart is
// empty" -- never reaches the model, on any page with more controls than that.
//
// Live run 21 (`run-muntufao-7b7bc04a`, everything-store-kettle-to-cart) typed a
// query the store matched nothing for. The page said "No results for ..." twice
// and "Try checking your spelling or use more general terms", and the packet
// held none of it: the location carries no query, the title reads like any
// results page's, and a page-wide list detection found the page's furniture
// and reported it detected. The model read that page as the product's results
// five times, pressed "add to cart" eight times on a page with no such control,
// and spent all 64 decisions without ever reaching the product.
//
// ## The rule
//
// A lead statement is an element that
//
// 1. has words of its own (its own text nodes), under a parent that has none --
//    so a line is lifted once, not once more for the bold query inside it;
// 2. is short, at most `MAX_STATEMENT_CHARACTERS` -- a status line, a heading,
//    an empty-state notice, not a passage of prose;
// 3. is the main region's own: the nearest landmark above it is `main`, with a
//    labelled `region` passed through. An `aside`, a `nav`, the header, the
//    footer, a search box and a form are other landmarks, and their words are
//    theirs;
// 4. is not a control's words and not an item's: nothing on the way up to the
//    main region is a control (a label is a control's words), and nothing is a
//    record -- an item's words are the list's, which detection and extraction
//    read.
//
// The first `MAX_LEAD_STATEMENTS` of them in document order are lifted, so the
// packet pays for three short lines at most. A page with no `main` landmark
// lifts nothing and ranks as it always has.

import { directVisibleText, visibleText } from "../describe-element";
import { isPageControlElement, isPrimaryControlElement } from "../element-traits";
import { isRecordElement, landmarkRole } from "../identity";

/** How many of the main region's own lines rank with the page-state controls. */
const MAX_LEAD_STATEMENTS = 3;

/** Longer than this is prose, which ranks as text. A status line or a notice is well under it. */
const MAX_STATEMENT_CHARACTERS = 200;

/** Raw text, markup whitespace and all, past which no statement can collapse to `MAX_STATEMENT_CHARACTERS`. Only a bound on work. */
const MAX_RAW_CHARACTERS = 4_000;

/** As `identity/context.ts` bounds its own landmark walk. */
const MAX_LANDMARK_DEPTH = 30;

/** The words of a control, where the tag alone says so: a label names its control, an option is a choice of one. */
const CONTROL_WORD_TAGS: ReadonlySet<string> = new Set(["label", "option", "optgroup", "legend"]);

/**
 * The main region's lead statements among `candidates`, at most three, the
 * first ones in document order. `documentOrder` is the snapshot's own
 * comparator, so a statement inside an open shadow root is ordered where a
 * person sees it.
 */
export function mainLeadStatements(candidates: readonly Element[], documentOrder: (left: Element, right: Element) => number): ReadonlySet<Element> {
  const statements = candidates.filter(isLeadStatement);
  return new Set([...statements].sort(documentOrder).slice(0, MAX_LEAD_STATEMENTS));
}

/**
 * The cheap questions first: this is asked of every candidate of every
 * capture, and `visibleText` walks the element's whole subtree, so it is asked
 * last and only of an element whose raw text could be short enough.
 */
function isLeadStatement(element: Element): boolean {
  if (!directVisibleText(element)) return false;
  const parent = element.parentElement;
  if (parent && directVisibleText(parent)) return false;
  if ((element.textContent?.length ?? 0) > MAX_RAW_CHARACTERS) return false;
  if (!belongsToMainRegion(element)) return false;
  const words = visibleText(element);
  return words !== undefined && words.length <= MAX_STATEMENT_CHARACTERS;
}

/** Whether the nearest landmark above the element is `main`, with nothing on the way that makes its words a control's or an item's. */
function belongsToMainRegion(element: Element): boolean {
  let current: Element | null = element;
  for (let depth = 0; current && depth < MAX_LANDMARK_DEPTH; depth += 1) {
    if (isControlWords(current) || isRecordElement(current)) return false;
    const role = landmarkRole(current);
    if (role === "main") return true;
    // A labelled region inside the main region is still the main region's; any other landmark is its own.
    if (role !== undefined && role !== "region") return false;
    current = current.parentElement;
  }
  return false;
}

function isControlWords(element: Element): boolean {
  return isPageControlElement(element) || isPrimaryControlElement(element) || CONTROL_WORD_TAGS.has(element.tagName.toLowerCase());
}
