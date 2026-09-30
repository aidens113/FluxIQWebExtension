// Where a press's answer is looked for: the pressed control and the section
// around it.
//
// A page changes on its own all the time -- an assistant opens on a timer, a
// promotion is appended to the body, reviews load in below the fold -- and none
// of that answers the press. So a change counts only inside the section the
// control belongs to: the nearest form, dialog, section, article, aside or main
// landmark, looked for at most `SCOPE_LEVELS` ancestors up. A control with no
// such section that near is scoped to its ancestor that many levels up, and
// never to the body or the document element, which would take in the page's
// own motion. A control inside a shadow root is followed out through its host.

import { composedParent } from "../../shadow-dom";

/** How many ancestors up the section around a pressed control is looked for. */
const SCOPE_LEVELS = 4;

/** The element names that bound a section of the page. */
const SECTION_TAGS = new Set(["form", "dialog", "section", "article", "aside", "main"]);

/** The roles that do. */
const SECTION_ROLES = new Set(["dialog", "alertdialog", "form", "region", "main", "complementary"]);

/** The page-wide elements a scope never widens to. */
const PAGE_TAGS = new Set(["body", "html"]);

/** The part of the page a change inside of answers a press on `pressed`. */
export function pressScope(pressed: Element): Element {
  let scope = pressed;
  let current: Element | null = composedParent(pressed);
  for (let level = 0; current && level < SCOPE_LEVELS; level += 1) {
    if (PAGE_TAGS.has(tagOf(current))) break;
    scope = current;
    if (isSection(current)) break;
    current = composedParent(current);
  }
  return scope;
}

function isSection(element: Element): boolean {
  if (SECTION_TAGS.has(tagOf(element))) return true;
  const role = element.getAttribute?.("role")?.trim().toLowerCase();
  return role !== undefined && SECTION_ROLES.has(role);
}

function tagOf(element: Element): string {
  return String(element.tagName ?? "").toLowerCase();
}

