// What a read's answered records are short of: `blankFields`,
// `incompleteRecords` and `emptyRecords` (`list-reader.ts`). Moved out of
// `list-reader.ts` on 2026-10-20 with the rest of `item-record/`, unchanged.

import type { ExtractedListRecord } from "../list-reader";
import type { FieldReaders } from "./field-readers";

/**
 * What the answered records are short of, read off the records themselves rather
 * than counted through the loop: a declared field is `null` where an optional
 * read found nothing (D16) and absent where a required one did, so the rows say
 * this without anything having to be carried alongside them -- a continued read's
 * resumed rows included.
 *
 * All three are facts, never failures. A field the author did not require is not
 * a shortfall, but a gap nobody states is worse than one nobody minds: the read
 * that keeps forty rows because three lack a rating has to say that three lack a
 * rating, or the answer looks complete.
 */
export function recordGaps(records: readonly ExtractedListRecord[], fields: FieldReaders): { blankFields: string[]; incompleteRecords: number; emptyRecords: number } {
  const blank = new Set<string>();
  let incompleteRecords = 0;
  let emptyRecords = 0;
  for (const record of records) {
    let short = 0;
    for (const [name] of fields) {
      const value = Object.prototype.hasOwnProperty.call(record, name) ? record[name] : undefined;
      if (value !== undefined && value !== null) continue;
      short += 1;
      if (value === null) blank.add(name);
    }
    if (short > 0) incompleteRecords += 1;
    if (short === fields.length && fields.length > 0) emptyRecords += 1;
  }
  return { blankFields: [...blank].sort(), incompleteRecords, emptyRecords };
}
