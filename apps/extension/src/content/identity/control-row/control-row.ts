// The row a control's own kind marks out, on a page that draws its rows as
// plain `<div>`s.
//
// `record.ts` names a control's record when the page drew one -- a `tr`, an
// `li`, an `article`, a keyed element. bigbox's cart draws none: each line is a
// `<div>` holding a title link, a price, a "Qty" select and two buttons, and
// every line's select is named "Qty". A step saved on the second line's select
// carried nothing that said which line (lane B round 8, `run-mv5jnc62-01c3609a`,
// step 27 refused as ambiguous; step 26 acted on whichever line its positional
// selector reached). The row is told here by the controls themselves.
//
// **The row is the largest ancestor that holds this control and no other
// control alike to it** -- same role, same accessible name -- found as the
// child, on the control's path, of the nearest ancestor that holds two. The
// cart's soap line holds one "Qty"; the group around it holds the towels' too,
// so the soap's line is the soap's row. Not the *smallest* ancestor holding
// one: that is the select's own label, which holds the control and none of the
// line's words.
//
// Moved out of `record.ts` (t463), where it served only a For Each pass's row
// values (t195-w20e), because a recording now names the same row by its words
// and a replay checks it by the same walk. One rule, three callers: the values
// gate, the capture of a row's words, and the check that a candidate sits in
// the row those words name.
//
// Every walk is bounded by depth and by a shared node budget (`row-bounds.ts`);
// an answer the budget cut short is no answer, and each caller fails closed on
// it. The climb itself is `sole-ancestors.ts`, which inside a capture scope
// answers from one index per root instead of walking (t733).

import { ROW_BOUNDS } from "./row-bounds";
import { soleAncestors } from "./sole-ancestors";

const ELEMENT_NODE = 1;

/** A control's row, and the alike control in the neighbouring part of the page that marked the row's edge. */
export type ControlRow = {
  /** The largest ancestor holding this control and no other alike to it. */
  row: Element;
  /** The other alike control found just outside `row`, in the ancestor that holds both. */
  twin: Element;
  /** The child of that ancestor that holds `twin`: the twin's row, at the same level as `row`. */
  twinRow: Element;
};

/**
 * The control's row by the rule in the header, or `undefined`, so a caller
 * fails closed, when the control has no name to tell its kind by, when no
 * ancestor within the depth bound holds a second one (a lone control marks out
 * no row), when the row would be the control and nothing more, or when the
 * bounded scan ran out before it could tell.
 */
export function controlRow(control: Element): ControlRow | undefined {
  const { ancestors, twin } = soleAncestors(control);
  const row = ancestors[ancestors.length - 1];
  if (!twin || !row || !holdsMoreThan(row, control)) return undefined;
  const twinRow = childHolding(row.parentElement, twin);
  return twinRow ? { row, twin, twinRow } : undefined;
}

/** The child of `parent` that holds `element`, or `undefined` when `element` is not inside `parent` within the depth bound. */
function childHolding(parent: Element | null, element: Element): Element | undefined {
  if (!parent) return undefined;
  let current: Element | null = element;
  for (let depth = 0; current && depth <= ROW_BOUNDS.depth * 2; depth += 1) {
    if (current.parentElement === parent) return current;
    current = current.parentElement;
  }
  return undefined;
}

/** Whether the row holds anything besides the control and the wrappers around it: an element or words off the control's path. */
function holdsMoreThan(row: Element, control: Element): boolean {
  for (let current = control; current !== row; ) {
    const parent = current.parentElement;
    if (!parent) return false;
    for (const sibling of parent.childNodes) {
      if (sibling === current) continue;
      if (sibling.nodeType === ELEMENT_NODE || /\S/u.test(sibling.nodeValue ?? "")) return true;
    }
    current = parent;
  }
  return false;
}
