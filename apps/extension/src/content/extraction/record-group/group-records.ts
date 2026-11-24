// A run whose items are groups of records is answered as the records of the
// target's group, never as one row per group (t1022).
//
// A shop's home page draws its shelves as sibling sections of one template: a
// heading ("Pickup today at ...") and a "View all" link over a list of product
// cards. Two such sections are a pair of records by every structural test
// (`../record-pair.ts`), so a detection aimed at a shelf's heading answered the
// pair: two items, each holding its shelf's cards flattened into columns by
// their place in the shelf -- `li:1 > ... price`, `li:2 > ... price` and on to
// `li:8`. A read naming the first card's columns kept one row per shelf, the
// first card of each, and nothing on the page or in the answer said that eight
// cards stood under the heading. The bigbox build read that list for 219 steps,
// "2 rows from 1 page", while the cheapest qualifying card was the seventh
// (`run-mwuxd2v9-33928ea3`, debug under
// `docs/working/language-driven-flow-loop-plan/debugs/`).
//
// **A group is a heading over a list.** An item is a group when it holds a run
// of records of its own -- three or more children of one template, or a pair
// that is plainly two records -- and outside that run it holds nothing but a
// heading and controls: every word it shows outside its records sits in a
// heading or in a link or button ("View all", a carousel's arrows). An order
// card holding its line items is not a group: its number, date and total are
// words of its own, so a list of orders stays the orders.
//
// **A run is a list of groups when the target's own item is a group and so are
// more than half of its items** -- the measure a field's coverage uses
// (`../detect-structure.ts`). Its records are then the run inside the target's
// own group: what a person pointing at a shelf's heading means is that shelf's
// cards. The section's "View all" is then the run's section link
// (`../section-link/`), which says where the whole of it is.
//
// The records' run is the one inside the group that covers the most of it, so a
// card's rating stars, a run of their own, never stand in for the cards. A run
// drawn from the group's own template is a thread's replies, which
// `../nested-run/` already reads with their comment, and is never a group's
// records.
//
// Nothing here reads a value: templates, tags, roles, and whether a text node
// holds anything but white space.

import { isRecordPair } from "../record-pair";

/** What the page's own repeating evidence calls a template rather than a coincidence (`../infer-list.ts`). */
const MIN_ITEMS_PER_RUN = 3;

/** Elements walked inside one group, so a huge region costs a bounded walk. */
const MAX_WALKED_ELEMENTS = 5_000;

const HEADING_TAG = /^H[1-6]$/u;
const CONTROL_TAGS = new Set(["A", "BUTTON"]);
const HEADING_OR_CONTROL_ROLES = new Set(["button", "link", "heading"]);
/** The elements that are a record's columns, never a record (`../infer-list.ts`). */
const FIELD_CELL_TAGS = new Set(["TD", "TH"]);

const TEXT_NODE = 3;

/**
 * The first record of the run inside `level`'s own group, when `run` -- `level`
 * and its same-template siblings -- is a list of groups; `undefined` otherwise.
 * `signatureOf` is the template signature every grouping here uses.
 */
export function groupRecordsStart(level: Element, run: readonly Element[], signatureOf: (element: Element) => string): Element | undefined {
  if (run.length < 2 || !run.includes(level)) return undefined;
  const own = groupRecords(level, signatureOf);
  if (own === undefined) return undefined;
  const groups = run.filter((item) => item === level || groupRecords(item, signatureOf) !== undefined).length;
  return groups * 2 > run.length ? own[0] : undefined;
}

/** The records `item` holds when it is a group (header), or `undefined` when it is not one. */
function groupRecords(item: Element, signatureOf: (element: Element) => string): readonly Element[] | undefined {
  const records = widestRunInside(item, signatureOf);
  return records !== undefined && onlyHeadingAndControlsOutside(item, new Set(records)) ? records : undefined;
}

/** The run of records inside `item` that covers the most of it, or `undefined` when it holds none. */
function widestRunInside(item: Element, signatureOf: (element: Element) => string): Element[] | undefined {
  const itemSignature = signatureOf(item);
  let best: { run: Element[]; covered: number } | undefined;
  let walked = 0;
  const pending: Element[] = [item];
  while (pending.length > 0 && walked < MAX_WALKED_ELEMENTS) {
    const container = pending.shift()!;
    walked += 1;
    const children = Array.from(container.children);
    pending.push(...children);
    if (children.length < 2) continue;
    for (const run of templateGroups(children, signatureOf)) {
      if (signatureOf(run[0]!) === itemSignature) continue;
      if (run.length < MIN_ITEMS_PER_RUN && !isRecordPair(run)) continue;
      const covered = run.reduce((total, element) => total + elementCount(element), 0);
      if (best === undefined || covered > best.covered) best = { run, covered };
    }
  }
  return best?.run;
}

/** The children grouped by template, in document order of each group's first member; a table cell is never a record. */
function templateGroups(children: readonly Element[], signatureOf: (element: Element) => string): Element[][] {
  const groups = new Map<string, Element[]>();
  for (const child of children) {
    if (FIELD_CELL_TAGS.has(child.tagName.toUpperCase())) continue;
    const signature = signatureOf(child);
    const group = groups.get(signature);
    if (group) group.push(child);
    else groups.set(signature, [child]);
  }
  return [...groups.values()];
}

/** The element and its descendants, counted to the walk's bound. */
function elementCount(element: Element): number {
  let count = 0;
  const pending: Element[] = [element];
  while (pending.length > 0 && count < MAX_WALKED_ELEMENTS) {
    count += 1;
    pending.push(...Array.from(pending.pop()!.children));
  }
  return count;
}

/** Whether every word `item` shows outside `records` sits in a heading or a control; see the header. */
function onlyHeadingAndControlsOutside(item: Element, records: ReadonlySet<Element>): boolean {
  let walked = 0;
  const pending: Element[] = [item];
  while (pending.length > 0) {
    walked += 1;
    if (walked > MAX_WALKED_ELEMENTS) return false;
    const element = pending.pop()!;
    if (records.has(element) || (element !== item && isHeadingOrControl(element))) continue;
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === TEXT_NODE && (node.textContent ?? "").trim() !== "") return false;
    }
    pending.push(...Array.from(element.children));
  }
  return true;
}

function isHeadingOrControl(element: Element): boolean {
  const tag = element.tagName.toUpperCase();
  const role = element.getAttribute("role")?.trim().toLowerCase();
  return HEADING_TAG.test(tag) || CONTROL_TAGS.has(tag) || (role !== undefined && HEADING_OR_CONTROL_ROLES.has(role));
}
