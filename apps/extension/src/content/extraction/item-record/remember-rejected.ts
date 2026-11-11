// The rows a read's conditions rejected, kept aside for a read they emptied (`list-reader.ts`).

import type { ExtractedListRecord } from "../list-reader";
import { contentKey } from "./content-key";
import type { FieldReaders } from "./field-readers";
import type { ItemRead } from "./read-record";

/** The rejected rows a read may have to fall back to, kept to the same item bound and the same deduplication as the records. */
export function rememberRejected(
  aside: { records: ExtractedListRecord[]; missing: Set<string>; seen: Set<string>; truncated: boolean } | undefined,
  itemRead: ItemRead,
  fields: FieldReaders,
  deduplicate: boolean,
  maxItems: number
): void {
  if (aside === undefined) return;
  if (aside.records.length >= maxItems) {
    aside.truncated = true;
    return;
  }
  if (deduplicate) {
    const content = contentKey(itemRead.record, fields);
    if (aside.seen.has(content)) return;
    aside.seen.add(content);
  }
  aside.records.push(itemRead.record);
  for (const name of itemRead.missing) aside.missing.add(name);
}
