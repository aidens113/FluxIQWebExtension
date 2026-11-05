// Before an answer in no recognised row is acted on as a page-level control, the
// pass's own row is asked about it.
//
// `record.ts` knows a row by markup, `control-row/` by a twin of the control's own
// name, and `own-run.ts` by a run of same-shaped siblings. A whole-row link in a
// plain box of its own (`<div class="wrap"><a class="card" href>...</a></div>`) has
// none of them: a `<div>` is no record, each link is named by its own row so none
// is alike, and it is an only child. So the rows-aside answer, the first row's link
// at its recorded position, read as page-level, and every pass opened the first row
// and pressed that row's Save again, which on a toggle site undid it. A title link in
// a plain card is the same case.
//
// The pass carries what names its row (`context.record.values`). Asked in order:
//
//   1. The page in hand is another row's own page (`item-address.ts`): nothing here is
//      this row's, so nothing is pressed. This is what stops the second press of a
//      pass that reached the wrong row's page by any road.
//   2. The answer is a link and the row has one. Its own: act on it. Another row's:
//      the element of its shape that links to this row is the row's, whatever its
//      position. None on the page: refused.
//   3. The answer sits in a row of same-shaped parts (`rowsAround`). The part that
//      holds every value of the pass is the row. The answer's own: act on it. One
//      beside it, holding a copy of the answer in the same place that differs only by
//      row data: that copy. Anything else that holds them: refused, since a row with no
//      such copy has no such control.
//   4. No part holds them, so the row is not drawn. A link of another row's shape, or a
//      link that is a whole row's card (it holds a picture or words in several places)
//      is another row's: refused. Anything else stands as page-level, as it always did:
//      a toolbar's button and a form's field are the same control on every pass, and
//      no part around them ever holds a row's values.
//
// **A link that goes as page-level leaves the row behind.** Step 4's link is not a row's as far as anything
// shows, so it may go: a pass's own way back to a list is such a link. But it moves the page, and from there
// nothing says the pass stands on its row, so the answer says so (`passRow`), and no later lasting step of that
// pass lands until a step finds its row again (`AS/runtime/llm/node-tools/replay/span.ts`,
// `SVC/answer-first/run-acts/run-gate.ts`). An answer the row placed says that too.
//
// "Refused" is no answer here: the caller goes on to the gated resolution, which fails
// not found, saying the match was another row's, and the step reports that row.

import { carriesOwnContent, rowHoldsValues, type RecordIdentity } from "../../identity";
import { differsOnlyByRowData } from "./row-data";
import { elementLinkingToRow, linkToRow, onAnotherRowsPage } from "./item-address";
import { followSlot, slotPath, type SlotStep } from "./slot-path";

/** Parts climbed from the answer. A control sits within a few boxes of its row's root, not at the top of the page. */
const MAX_CLIMB = 6;
/** Nodes walked counting how many of the answer's shape a part holds. A row is a row, not a page. */
const MAX_PART_NODES = 2_000;

/** What a pass does with an answer in no recognised row. */
export type PassRowAim = { kind: "as-built"; passRow?: "own" | "page-level-link" } | { kind: "copy"; element: Element } | { kind: "refused" };

const AS_BUILT: PassRowAim = { kind: "as-built" };
const OWN: PassRowAim = { kind: "as-built", passRow: "own" };
const LEFT_BEHIND: PassRowAim = { kind: "as-built", passRow: "page-level-link" };
const REFUSED: PassRowAim = { kind: "refused" };

/** The answer `built`, asked about the pass's row (header). */
export function passRowAim(built: Element, record: RecordIdentity): PassRowAim {
  const values = (record.values ?? []).filter((value): value is string => typeof value === "string");
  if (values.length === 0) return AS_BUILT;
  if (onAnotherRowsPage(values)) return REFUSED;
  const link = linkToRow(built, values);
  if (link === "own") return OWN;
  if (link === "another") {
    const own = elementLinkingToRow(values, sameShaped(built));
    return own ? { kind: "copy", element: own } : REFUSED;
  }
  const around = rowsAround(built);
  if (!around) return pageLevel(built);
  if (rowHoldsValues(around.row, values)) return OWN;
  const holding = around.others.filter((other) => rowHoldsValues(other, values));
  const copy = holding.length === 1 ? followSlot(holding[0] as Element, around.slot) : undefined;
  if (copy && sameShape(copy, built) && differsOnlyByRowData(built, copy, values)) return { kind: "copy", element: copy };
  if (holding.length > 0) return REFUSED;
  return built.hasAttribute("href") && carriesOwnContent(built) ? REFUSED : pageLevel(built);
}

/** What goes as page-level says so where it is a link, which moves the page (header). */
function pageLevel(built: Element): PassRowAim {
  return built.hasAttribute("href") ? LEFT_BEHIND : AS_BUILT;
}

/** Whether two elements are two stampings of one template: the same tag, written role and class attribute. */
function sameShape(one: Element, other: Element): boolean {
  return tagOf(one) === tagOf(other)
    && (one.getAttribute("role") ?? "") === (other.getAttribute("role") ?? "")
    && (one.getAttribute("class") ?? "") === (other.getAttribute("class") ?? "");
}

/** Every element of the page's tree of `built`'s shape, in document order. */
function sameShaped(built: Element): Element[] {
  const root = built.getRootNode() as unknown as ParentNode;
  return [...root.querySelectorAll(tagOf(built))].filter((element) => sameShape(element, built));
}

/**
 * The part of the page that is `built`'s row by structure, and the parts beside it: the
 * nearest part at or above it with a same-shaped sibling that holds a copy of `built` in
 * the same place, saying something else. Above the answer itself, a part must hold no
 * other element of its shape: one that holds several is a column of links, not one row's.
 */
function rowsAround(built: Element): { row: Element; others: Element[]; slot: SlotStep[] } | undefined {
  let part: Element | null = built;
  for (let climbed = 0; part && climbed < MAX_CLIMB; climbed += 1) {
    const parent: Element | null = part.parentElement;
    if (!parent) return undefined;
    const row = part;
    const others = [...parent.children].filter((child) => child !== row && sameShape(child, row));
    const slot = slotPath(row, built);
    if (others.length > 0 && slot && (row === built || holdsOneOfShape(row, built))) {
      const told = others.some((other) => {
        const copy = followSlot(other, slot);
        return copy !== undefined && sameShape(copy, built) && (copy.textContent ?? "") + copy.getAttribute("href") !== (built.textContent ?? "") + built.getAttribute("href");
      });
      if (told) return { row, others, slot };
    }
    part = parent;
  }
  return undefined;
}

function holdsOneOfShape(part: Element, built: Element): boolean {
  let budget = MAX_PART_NODES;
  const pending: Element[] = [...part.children];
  for (let element = pending.pop(); element; element = pending.pop()) {
    if (budget <= 0) return false;
    budget -= 1;
    if (element !== built && sameShape(element, built)) return false;
    for (const child of element.children) pending.push(child);
  }
  return true;
}

function tagOf(element: Element): string {
  return element.localName ?? element.tagName?.toLowerCase() ?? "";
}
