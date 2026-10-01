// Where a press's answer is looked for: the pressed control and the section
// around it.
//
// A page changes on its own all the time -- an assistant opens on a timer, a
// promotion is appended to the body, reviews load in below the fold -- and none
// of that answers the press. So a change counts only inside the section the
// control belongs to: the nearest form, dialog, section, article or aside
// landmark, looked for at most `SCOPE_LEVELS` ancestors up. A control with no
// such section that near is scoped to its ancestor that many levels up, and
// never to the body, the document element or the main landmark, which would
// take in the page's own motion. A control inside a shadow root is followed
// out through its host.
//
// The main landmark is the page, not a section of it: until 2026-10-01 it
// bounded a scope, and bigbox's Add to cart (`main > div.atcBar > button`) was
// scoped to the whole of `<main>`, where the buy box's skeleton leaves at
// 700 ms and the reviews arrive at 900 ms after load. A press the page
// swallowed in that first second read as answered and was never pressed again
// (t195-w19b #4). The cost: a press with no request whose only visible answer
// lies elsewhere in `main`, outside every section around the control, is now
// pressed a second time.

import { composedParent } from "../../shadow-dom";

/** How many ancestors up the section around a pressed control is looked for. */
const SCOPE_LEVELS = 4;

/** The element names that bound a section of the page. */
const SECTION_TAGS = new Set(["form", "dialog", "section", "article", "aside"]);

/** The roles that do. */
const SECTION_ROLES = new Set(["dialog", "alertdialog", "form", "region", "complementary"]);

/** The page-wide elements a scope never widens to. */
const PAGE_TAGS = new Set(["body", "html", "main"]);

/** The page-wide roles likewise. */
const PAGE_ROLES = new Set(["main"]);

/** The part of the page a change inside of answers a press on `pressed`. */
export function pressScope(pressed: Element): Element {
  let scope = pressed;
  let current: Element | null = composedParent(pressed);
  for (let level = 0; current && level < SCOPE_LEVELS; level += 1) {
    if (isPageWide(current)) break;
    scope = current;
    if (isSection(current)) break;
    current = composedParent(current);
  }
  return scope;
}

function isPageWide(element: Element): boolean {
  if (PAGE_TAGS.has(tagOf(element))) return true;
  const role = roleOf(element);
  return role !== undefined && PAGE_ROLES.has(role);
}

function isSection(element: Element): boolean {
  if (SECTION_TAGS.has(tagOf(element))) return true;
  const role = roleOf(element);
  return role !== undefined && SECTION_ROLES.has(role);
}

function roleOf(element: Element): string | undefined {
  return element.getAttribute?.("role")?.trim().toLowerCase() ?? undefined;
}

function tagOf(element: Element): string {
  return String(element.tagName ?? "").toLowerCase();
}

