// What a read with `where` conditions answers with, and what it says about
// having done so (contract C5).
//
// It is its own module because it is the one decision in a filtered read that
// has nothing to do with the page: given the rows the conditions kept and the
// rows they rejected, which of the two is the answer. `list-reader.ts` needs a
// document to reach this point and so cannot be unit-tested in Node; this can,
// and the rule below is the part that was wrong.
//
// ## Too much, never nothing
//
// A read whose conditions keep nothing answers with the rows they rejected.
//
// That is a deliberate preference and it was bought with a measurement. On
// 2026-09-24, `run-mug3tnti-9ab80b85` returned **0 records where 13 were
// wanted**: the conditions the model wrote were close but not right, they
// rejected every row, and an empty table is indistinguishable from a page that
// had nothing to find. The run before it returned 55 unfiltered rows and the run
// after returned 10 with 7 right -- so the capability worked, and what was
// missing was any floor under it.
//
// The asymmetry is the whole argument. A superset is **visibly** too wide: the
// loop's own judgement reads the answer against the instruction and says so,
// and a repair narrows the condition that was wrong. Nothing is not visibly
// anything -- it is a plausible answer to a question about a page that might
// really have held nothing, so the judgement passes it and the loop stops. One
// of the two failure modes keeps the loop running and the other ends it.
//
// It follows that a Flow can no longer discover "the page held nothing that
// matched" from an empty table. It discovers it from `unfiltered` and the counts
// beside it, which say that the conditions were applied, how many rows they were
// applied to, and that none survived. That is strictly more than an empty table
// said, and it is the reason the report is not optional.
//
// ## Counts only
//
// Nothing here is read off the page. The report travels on the wire beside the
// extraction summary (`domain/src/actions/extraction/summary.ts`), whose whole
// contract is that it carries counts, flags and declared field keys and never a
// value -- so a row's content cannot ride out on a diagnostic.

import type { ExtractedListRecord } from "./list-reader";

/**
 * What `where` did to a read, in counts alone.
 *
 * `applied` is the items the conditions were asked about and `kept` the items
 * every condition held of. `kept` is not the record count: an item the
 * conditions kept can still be dropped as a duplicate of an earlier page's row,
 * or by the item bound.
 *
 * `rejected` carries one count per condition, positionally, so a read that kept
 * nothing can name **which** condition emptied it. They sum above
 * `applied - kept` when one item failed several conditions at once, which is
 * why they are per-condition counts rather than a partition.
 */
export type ListExtractionConditionReport = {
  applied: number;
  kept: number;
  rejected: number[];
  /** Whether the read answered with rows its conditions rejected, because keeping only the survivors would have answered with none. */
  unfiltered: boolean;
};

/** The rows a read has to choose between, each with the required fields some row of it lacked. */
export type FilteredListRows = {
  kept: readonly ExtractedListRecord[];
  keptMissing: ReadonlySet<string>;
  rejected: readonly ExtractedListRecord[];
  rejectedMissing: ReadonlySet<string>;
  /** Whether the item bound stopped the rejected rows being kept aside, which only matters if they become the answer. */
  rejectedTruncated: boolean;
};

export type FilteredListAnswer = {
  records: ExtractedListRecord[];
  missingFields: string[];
  /** Whether a bound cut short whichever rows became the answer. */
  truncated: boolean;
  unfiltered: boolean;
};

/**
 * The rows a filtered read answers with, and whether they are the rejected ones.
 *
 * The rejected rows are the answer only when the conditions kept nothing **and**
 * there is something to fall back to: a read continued from another document
 * carries its predecessor's counts but not its rejected rows, and answering
 * "unfiltered" with no rows would be a claim about rows that are not there.
 *
 * A row that is being returned is a row whose absent required field is worth
 * reporting, which is why the fallback takes the rejected rows' missing fields
 * as well -- a filtered-out row's missing field is deliberately not reported
 * while it is being left out, and reporting it is what makes the verb's
 * validation honest once it is not.
 */
export function filteredListAnswer(rows: FilteredListRows, truncated: boolean): FilteredListAnswer {
  const unfiltered = rows.kept.length === 0 && rows.rejected.length > 0;
  if (!unfiltered) {
    return { records: [...rows.kept], missingFields: sorted(rows.keptMissing), truncated, unfiltered: false };
  }
  return {
    records: [...rows.rejected],
    missingFields: sorted(new Set([...rows.keptMissing, ...rows.rejectedMissing])),
    truncated: truncated || rows.rejectedTruncated,
    unfiltered: true
  };
}

function sorted(names: ReadonlySet<string>): string[] {
  return [...names].sort();
}
