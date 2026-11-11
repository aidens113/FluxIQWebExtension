// The controls a page draws as plain elements, for a pager's way forward
// (`../detect-pagination.ts`, t885 R4).
//
// A pager is looked for among the elements a page marks as controls -- a link,
// a button, an element whose role is one. A booking widget draws its week
// pager as `<div>Later ›</div>` with a pointer and a listener on the widget,
// so the week's way forward was no candidate, and the one control labelled
// Next near the list -- the booking form's own step button -- was proposed as
// its pager (`run-mwc6ut8u-52e3c1b3`). The page view prints that div
// `clickable`, by the signs the snapshot reads (`../../describe-element.ts`):
// the page listens for presses on it, it carries a click handler, or it sets
// a pointer cursor of its own (`../../evidence/press-cursor.ts`). A drawn
// control is a candidate on the same signs.
//
// Only what `says` accepts is asked about, and only elements small enough to
// be one control: asking the page world about every element of a page is not
// cheap, and a pager's control is a word or two, never a section.

import { hasClickHandler } from "../../element-traits";
import { ownPressCursor } from "../../evidence";
import { pageListensForPress } from "../../page-press";

/** The elements a semantic control already names, which are found as controls without this. */
const SEMANTIC_CONTROL = 'a,button,input,select,textarea,[role="button"],[role="link"]';

/** How many child elements a drawn control holds at most: its words, an arrow or an icon. */
const MAX_CHILDREN = 2;

/** The page-drawn controls under `level` that `says` accepts, in document order; see the header. */
export function pageDrawnControls(level: Element, says: (element: Element) => boolean): Element[] {
  return Array.from(level.querySelectorAll("*")).filter((element) =>
    element.children.length <= MAX_CHILDREN && says(element) && !matchesSemantic(element) && pageMadePressable(element));
}

function matchesSemantic(element: Element): boolean {
  return typeof element.matches === "function" && element.matches(SEMANTIC_CONTROL);
}

/** Whether the page made the element a control, by the signs the page view reads (header). A cursor is unknown where nothing computes styles. */
function pageMadePressable(element: Element): boolean {
  if (hasClickHandler(element) || pageListensForPress(element)) return true;
  return typeof getComputedStyle === "function" && ownPressCursor(element) === "pointer";
}
