// A record's content as one comparable key, which is what a `scroll` read
// (decision D16), the earlier-page repeat count and `dedupe` compare records by
// (`list-reader.ts`). Moved out of `list-reader.ts` on 2026-10-20 with the rest
// of `item-record/`, unchanged.

import type { ExtractedListRecord } from "../list-reader";
import type { FieldReaders } from "./field-readers";

/**
 * A record's content as one comparable string: each field in declaration
 * order, as `[value]` when the record carries it and `[]` when a required
 * field was missing, so no two different records share a key.
 */
export function contentKey(record: ExtractedListRecord, fields: FieldReaders): string {
  return JSON.stringify(fields.map(([name]) => (Object.prototype.hasOwnProperty.call(record, name) ? [record[name]] : [])));
}
