// Where an element sits on the page: the form that owns it, the fieldset and
// landmark around it, the heading above it, and its position in a list or
// table. Two controls that look alike -- the same tag, role and name -- are
// told apart by this, which is what a corpus row like "the second Continue
// button" needs (Phase 1.3).
//
// Every lookup is bounded. The context is computed for every described
// element, and a snapshot describes up to two thousand of them, so no rule
// here may walk the whole document.

import { compactObject } from "../compact-object";
import type { DomElementContext } from "../types";
import { boundedText } from "./bounded-text";

const MAX_CONTEXT_TEXT = 200;
const HEADING_SELECTOR = "h1,h2,h3,h4,h5,h6,[role='heading']";
const LIST_ITEM_SELECTOR = "li,[role='listitem'],[role='option'],[role='treeitem']";
const MAX_LANDMARK_DEPTH = 30;
const MAX_HEADING_LEVELS = 10;
const MAX_HEADING_SIBLINGS = 12;
const MAX_HEADING_SUBTREE_QUERIES = 24;

const LANDMARK_ROLES = new Set(["banner", "complementary", "contentinfo", "form", "main", "navigation", "region", "search"]);
const LANDMARK_TAG_ROLES: Record<string, string> = {
  main: "main",
  nav: "navigation",
  header: "banner",
  footer: "contentinfo",
  aside: "complementary",
  search: "search",
  section: "region",
  form: "form"
};

/** The element's surroundings, or `undefined` when it has none worth reporting. */
export function elementContext(element: Element): DomElementContext | undefined {
  const context = compactObject({
    ...formContext(element),
    fieldsetLegend: fieldsetLegend(element),
    landmark: nearestLandmark(element),
    heading: nearestHeading(element),
    listPosition: listPosition(element),
    tablePosition: tablePosition(element)
  });
  return Object.keys(context).length ? context : undefined;
}

/** The owning form, including one claimed through a control's `form="id"` attribute. */
function formContext(element: Element): { formId?: string | undefined; formName?: string | undefined; formAction?: string | undefined } {
  const owned = (element as Element & { form?: HTMLFormElement | null }).form;
  const form = owned ?? element.closest("form");
  if (!form) return {};
  return {
    formId: boundedText(form.getAttribute("id"), MAX_CONTEXT_TEXT),
    formName: boundedText(form.getAttribute("name"), MAX_CONTEXT_TEXT),
    formAction: boundedText(form.getAttribute("action"), MAX_CONTEXT_TEXT)
  };
}

function fieldsetLegend(element: Element): string | undefined {
  const legend = element.closest("fieldset")?.querySelector(":scope > legend");
  return boundedText(legend?.textContent, MAX_CONTEXT_TEXT);
}

/** The nearest landmark role at or above the element. */
function nearestLandmark(element: Element): string | undefined {
  let current: Element | null = element;
  let depth = 0;
  while (current && depth < MAX_LANDMARK_DEPTH) {
    depth += 1;
    const role = landmarkRole(current);
    if (role) return role;
    current = current.parentElement;
  }
  return undefined;
}

function landmarkRole(element: Element): string | undefined {
  const explicit = element.getAttribute("role")?.trim().toLowerCase();
  // An explicit role replaces the tag's own, landmark or not.
  if (explicit) return LANDMARK_ROLES.has(explicit) ? explicit : undefined;
  const tag = element.tagName.toLowerCase();
  const implicit = LANDMARK_TAG_ROLES[tag];
  if (!implicit) return undefined;
  if ((tag === "section" || tag === "form") && !hasAuthoredName(element)) return undefined;
  return implicit;
}

/**
 * The heading that precedes the element: at each level up the tree, the last
 * heading among the preceding siblings or inside one of them. The first hit
 * wins, so the innermost section's own heading beats the page title.
 */
function nearestHeading(element: Element): string | undefined {
  let current: Element | null = element;
  let levels = 0;
  let queries = 0;
  while (current && levels < MAX_HEADING_LEVELS) {
    levels += 1;
    let sibling: Element | null = current.previousElementSibling;
    let scanned = 0;
    while (sibling && scanned < MAX_HEADING_SIBLINGS) {
      scanned += 1;
      if (sibling.matches(HEADING_SELECTOR)) return boundedText(sibling.textContent, MAX_CONTEXT_TEXT);
      if (sibling.firstElementChild && queries < MAX_HEADING_SUBTREE_QUERIES) {
        queries += 1;
        const headings = sibling.querySelectorAll(HEADING_SELECTOR);
        const last = headings[headings.length - 1];
        if (last) return boundedText(last.textContent, MAX_CONTEXT_TEXT);
      }
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }
  return undefined;
}

/** One-based position among the sibling list items, so `{ index: 1, total: 12 }` reads as "1 of 12". */
function listPosition(element: Element): { index: number; total: number } | undefined {
  const item = element.closest(LIST_ITEM_SELECTOR);
  const parent = item?.parentElement;
  if (!item || !parent) return undefined;
  const siblings = [...parent.children].filter((child) => child.matches(LIST_ITEM_SELECTOR));
  const index = siblings.indexOf(item);
  return index < 0 ? undefined : { index: index + 1, total: siblings.length };
}

/** One-based row and column within the table, with the header row's text for that column. */
function tablePosition(element: Element): { row: number; column: number; columnHeader?: string | undefined } | undefined {
  const cell = element.closest("td,th");
  if (!(cell instanceof HTMLTableCellElement)) return undefined;
  const row = cell.closest("tr");
  if (!(row instanceof HTMLTableRowElement) || row.rowIndex < 0 || cell.cellIndex < 0) return undefined;
  return compactObject({
    row: row.rowIndex + 1,
    column: cell.cellIndex + 1,
    columnHeader: columnHeader(row, cell)
  });
}

function columnHeader(row: HTMLTableRowElement, cell: HTMLTableCellElement): string | undefined {
  const table = row.closest("table");
  if (!(table instanceof HTMLTableElement)) return undefined;
  const headerRow = table.tHead?.rows[0] ?? table.rows[0];
  return boundedText(headerRow?.cells[cell.cellIndex]?.textContent, MAX_CONTEXT_TEXT);
}

function hasAuthoredName(element: Element): boolean {
  return element.hasAttribute("aria-label") || element.hasAttribute("aria-labelledby") || element.hasAttribute("title");
}
