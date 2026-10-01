// Which element around a target is the one record it belongs to, when nothing
// around it repeats.
//
// Structure detection finds records by repetition (`infer-list.ts`), and some
// answers are one record with no sibling of its template at any level. On the
// photo-social scenario the price a task asks for arrives as one product card
// in a direct-message reply, beside three message bubbles: aimed at the card,
// detection found nothing around it and answered the inbox's three thread rows
// further out, which carry no price (moon-jar audit cause 1,
// `docs/working/language-driven-flow-loop-plan/reports/t195-w19e-audit-moon-jar.md`).
//
// The record is the nearest element, walking outward from the target, that
// holds two or more values of its own (`content-fields.ts`) and can be named on
// its own. The walk stops without one:
// - at a boundary -- the page's body, its `main`, or a navigation or chrome
//   region -- beyond which an element is a region of the page, not a record;
// - at an element that holds a run, because a record around a list is the
//   list's surroundings (a cart's heading inside the cart's section), and the
//   list is the answer there.
// A table cell is never the record (`infer-list.ts`); its row may be.
//
// Pure: each level is described by the caller (`lone-record.ts`), which is what
// lets the rule be decided without a page.

/** What a lone record needs to hold: two values, so a label or a lone link is not one. */
const MIN_CONTENT_FIELDS = 2;

/** One element on the walk outward from a target, as `lone-record.ts` measures it. */
export type LoneRecordLevel = {
  /** A table cell, which is a column of a record and never the record. */
  cell: boolean;
  /** The page's body, its `main`, or an element inside a navigation or chrome region. */
  boundary: boolean;
  /** The values of its own the element holds, read as a run of one (`content-fields.ts`). */
  contentFields: number;
  /** Whether a run of records sits inside the element (`largest-runs.ts`). */
  holdsRun: boolean;
  /** Whether a selector names this element and nothing else (`item-selector.ts`). */
  namedExactly: boolean;
};

/**
 * The index of the level that is the target's one record, or `undefined` when
 * the walk meets a boundary or a run first, or ends without one. `levels` run
 * from the target outward and may be produced lazily: nothing past the
 * answering level, or past a stop, is asked for.
 */
export function chooseLoneRecordLevel(levels: Iterable<LoneRecordLevel>): number | undefined {
  let index = 0;
  for (const level of levels) {
    if (level.boundary || level.holdsRun) return undefined;
    if (!level.cell && level.contentFields >= MIN_CONTENT_FIELDS && level.namedExactly) return index;
    index += 1;
  }
  return undefined;
}
