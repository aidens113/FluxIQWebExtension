// What the page's main region says about itself: the short lines of its own
// text, marked on each such element's descriptor as `leadStatement: true`
// (`dom-snapshot.ts`).
//
// ## The defect this closes
//
// A page's own statement of what it is showing -- "No results for ...", "1-16
// of 42 results for ...", "Your cart is empty" -- reads like any other line of
// text in an element list of thousands. Live run 21 (`run-muntufao-7b7bc04a`,
// everything-store-kettle-to-cart) typed a query the store matched nothing for.
// The page said "No results for ..." twice and "Try checking your spelling or
// use more general terms", the location carries no query, the title reads like
// any results page's, and a page-wide list detection found the page's
// furniture and reported it detected. The model read that page as the
// product's results five times, pressed "add to cart" eight times on a page
// with no such control, and spent all 64 decisions without reaching the
// product.
//
// Until t200 this rule lifted the first three such lines to the head of a
// ranked, capped element list (t174 F10). The list is no longer ranked or cut:
// every rendered element is listed in document order. Removing the lift must
// not remove what it knew, so the rule now marks every element it recognises,
// where it stands, and moves nothing. A reader that wants the page's own
// statements asks for the marked elements.
//
// ## The rule
//
// A lead statement is an element that
//
// 1. has words of its own (its own text nodes), under a parent that has none --
//    so a line is marked once, not once more for the bold query inside it;
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
// A page with no `main` landmark has no lead statements.

import { directVisibleText, visibleText } from "../describe-element";
import { isRecordElement, landmarkRole } from "../identity";

/** Longer than this is prose, not a statement. A status line or a notice is well under it. */
const MAX_STATEMENT_CHARACTERS = 200;

/** Raw text, markup whitespace and all, past which no statement can collapse to `MAX_STATEMENT_CHARACTERS`. Only a bound on work. */
const MAX_RAW_CHARACTERS = 4_000;

/** As `identity/context.ts` bounds its own landmark walk. */
const MAX_LANDMARK_DEPTH = 30;

/** The words of a control, where the tag alone says so: a label names its control, an option is a choice of one. */
const CONTROL_WORD_TAGS: ReadonlySet<string> = new Set(["label", "option", "optgroup", "legend"]);

/** Tags that are controls in their own right: a form field, a button, a link, a disclosure. */
const CONTROL_TAGS: ReadonlySet<string> = new Set(["select", "input", "textarea", "button", "summary", "a"]);

/** Roles that make an element a control whatever its tag. */
const CONTROL_ROLES: ReadonlySet<string> = new Set([
  "button", "checkbox", "radio", "switch", "combobox", "listbox", "textbox", "searchbox",
  "spinbutton", "slider", "link", "menuitem", "tab"
]);

/**
 * Whether the element is one of the main region's own short statements about
 * what the page shows.
 *
 * The cheap questions first: this is asked of every rendered element of every
 * capture, and `visibleText` walks the element's whole subtree, so it is asked
 * last and only of an element whose raw text could be short enough.
 */
export function isLeadStatement(element: Element): boolean {
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

/**
 * Whether the element is a control, or a control's words. The tag and role
 * lists are the ones the snapshot's ranking used to call page and primary
 * controls (`element-traits.ts` until t200); they are only read here now.
 */
function isControlWords(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  if (CONTROL_TAGS.has(tagName) || CONTROL_WORD_TAGS.has(tagName)) return true;
  const role = element.getAttribute("role")?.toLowerCase();
  if (role !== undefined && CONTROL_ROLES.has(role)) return true;
  return element instanceof HTMLElement && element.isContentEditable;
}
