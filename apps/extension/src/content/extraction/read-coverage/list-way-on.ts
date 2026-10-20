// Whether a list or table the page shows goes on past what it shows, as one
// closed word on the passive snapshot (l1 D1).
//
// A reset of a build's acts is settled only against an original list the page
// vouched was whole: a remove that left an item out of a list proves nothing
// when the list holds only its first page. ARIA's set sizes can vouch for that
// and most sites write none, so a plain `<ul>` or `<table>` could never vouch,
// and no act on one could ever settle. The domain therefore asks the capture
// how each list goes on (`domain/src/runtime/llm-evidence/control-spot/collection.ts`).
//
// **No new heuristic.** The answer is the read's own detection
// (`list-continues.ts`) asked about the list's items with nothing scrolled, as
// a passive capture is: a pager's Next or the page after the current one says
// `next_page`, a Load more says `load_more`. A capture does not scroll, so it
// cannot see a feed grow; a list the page itself declares a feed
// (`isDeclaredFeed`: `role="feed"`, an unknown set size, or more rows declared
// than are mounted) says `feed`. Anything else says `none`. A disabled way on,
// or a pager on its last page, is a list that ended, as a read finds it.
//
// A container is a list (`ul`, `ol`, `role="list"`) or a table (`table`,
// `role="table"` or `"grid"`) by its role, written or implied, the role the
// domain finds it by. Its items are its own: `listitem`s, or a table's `row`s
// less its header rows, with a nested list's or table's items left to it. A
// container with no item says nothing, and the word never names an item, a
// control or a label: nothing read here leaves the page but the word.

import { implicitRole } from "../../identity";
import { isDeclaredFeed } from "../feed-signal";
import { listContinuesPast } from "./list-continues";

/** How a list goes on past what the capture shows of it (`DomElementDescriptor.listWayOn`). */
export type ListWayOn = "none" | "next_page" | "load_more" | "feed";

type Family = "list" | "table";

/** The container's way on, or `undefined` for an element that is no list or table, or holds no item. */
export function listWayOn(container: Element): ListWayOn | undefined {
  const family = familyOf(container);
  if (family === undefined) return undefined;
  const items = ownItems(container, family);
  if (items.length === 0) return undefined;
  const way = listContinuesPast(items, false);
  if (way?.kind === "next_page") return "next_page";
  if (way?.kind === "load_more") return "load_more";
  return isDeclaredFeed(items, items[0]!.parentElement) ? "feed" : "none";
}

/** The tags whose implied role is one a list or table is made of; no other tag's is asked. */
const STRUCTURE_TAGS: ReadonlySet<string> = new Set(["ul", "ol", "menu", "li", "table", "tr", "td", "th"]);

/** The element's role: the first word of the one the page wrote, else the one its markup implies. */
function roleOf(element: Element): string | undefined {
  const written = element.getAttribute("role")?.trim().toLowerCase().split(/\s+/u)[0];
  if (written) return written;
  return STRUCTURE_TAGS.has(element.tagName.toLowerCase()) ? implicitRole(element) : undefined;
}

function familyOf(element: Element): Family | undefined {
  const role = roleOf(element);
  if (role === "list") return "list";
  return role === "table" || role === "grid" ? "table" : undefined;
}

/** The container's own items, in document order: a nested list or table keeps its items to itself. */
function ownItems(container: Element, family: Family): Element[] {
  const items: Element[] = [];
  const visit = (element: Element): void => {
    for (const child of Array.from(element.children)) {
      if (familyOf(child) === family) continue;
      const role = roleOf(child);
      if (family === "list" ? role === "listitem" : role === "row" && !isHeaderRow(child, container)) items.push(child);
      visit(child);
    }
  };
  visit(container);
  return items;
}

/** A row in the table's `thead`, or one whose every cell is a column header. */
function isHeaderRow(row: Element, table: Element): boolean {
  for (let above = row.parentElement; above !== null && above !== table; above = above.parentElement) {
    if (above.tagName.toLowerCase() === "thead") return true;
  }
  const cells = Array.from(row.children).filter((cell) => CELL_ROLES.has(roleOf(cell) ?? ""));
  return cells.length > 0 && cells.every((cell) => roleOf(cell) === "columnheader");
}

const CELL_ROLES: ReadonlySet<string> = new Set(["cell", "gridcell", "columnheader", "rowheader"]);
