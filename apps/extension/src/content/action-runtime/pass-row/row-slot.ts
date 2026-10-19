// The recorded control's slot, in the pass's own row (F2; photo newest-likes
// r1 and job save r1).
//
// A per-row control names itself by its row -- a title link by the row's
// title, id and link, a gallery tile by its counts -- so resolved with the pass
// row's values as the gate, the pass's own copy agrees with the recording on
// nothing distinguishing and is refused (`../../identity/corroboration.ts`).
// What does place it is structure. The build's control, found on the page as
// recorded, sits in a row of several like it (`repeatedRowOf`): a `li` of a
// list, a plain-markup line, or itself as one tile of a run. Its slot is the
// path from that row's root down to it, each step a tag and its index among
// same-tag siblings. The pass's row is the one row beside it, of its tag, whose
// copy of that slot holds every value the pass carries; the copy is the
// control when it differs from the build's only by row data (`row-data.ts`).
//
// Exactly one such row, or none: two rows holding the pass's values say
// nothing of which is meant, a row whose slot holds another kind of control is
// not this control's row, and a row not drawn is not found -- never another
// row's control, and never one outside the list.

import { agreesWithRecordedRecord, repeatedRowOf, type RecordIdentity } from "../../identity";
import { differsOnlyByRowData } from "./row-data";

/** Rows weighed beside the build's. A list is long, but past this it is not read. */
const MAX_ROWS = 1_000;

/** One step down from a row's root: a child of this tag, at this index among its same-tag siblings. */
type Step = { tag: string; index: number };

/**
 * The copy of `built` in the pass's row by the rule in the header, or
 * `undefined` when there is not exactly one.
 */
export function placedInPassRow(built: Element, record: RecordIdentity): Element | undefined {
  const values = record.values?.filter((value): value is string => typeof value === "string") ?? [];
  if (!values.length) return undefined;
  const row = repeatedRowOf(built);
  const list = row?.parentElement;
  const slot = row ? slotIn(row, built) : undefined;
  if (!row || !list || !slot) return undefined;
  const placed: Element[] = [];
  let weighed = 0;
  for (const other of list.children) {
    if (tagOf(other) !== tagOf(row)) continue;
    weighed += 1;
    if (weighed > MAX_ROWS) return undefined;
    const copy = follow(other, slot);
    if (copy && agreesWithRecordedRecord({ values }, copy) && differsOnlyByRowData(built, copy, values)) placed.push(copy);
  }
  return placed.length === 1 ? placed[0] : undefined;
}

/** The path from `row` down to `element`, or `undefined` when `element` is not inside it. */
function slotIn(row: Element, element: Element): Step[] | undefined {
  const steps: Step[] = [];
  for (let current = element; current !== row; ) {
    const parent = current.parentElement;
    if (!parent) return undefined;
    const tag = tagOf(current);
    steps.unshift({ tag, index: [...parent.children].filter((child) => tagOf(child) === tag).indexOf(current) });
    current = parent;
  }
  return steps;
}

/** The element at `slot` below `row`, or `undefined` where the row draws nothing there. */
function follow(row: Element, slot: readonly Step[]): Element | undefined {
  let current: Element | undefined = row;
  for (const step of slot) {
    current = current ? [...current.children].filter((child) => tagOf(child) === step.tag)[step.index] : undefined;
  }
  return current;
}

function tagOf(element: Element): string {
  return element.localName ?? element.tagName?.toLowerCase() ?? "";
}
