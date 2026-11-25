// One item read into a record (`list-reader.ts`): each included field's value,
// and the required fields it lacked. Moved out of `list-reader.ts` on
// 2026-10-20 with the rest of `item-record/`, unchanged.

import type { ExtractedListRecord } from "../list-reader";
import { readField } from "../field-reader";
import type { FieldReaders } from "./field-readers";

/** One item read: its record, and the required fields it lacked. */
export type ItemRead = { record: ExtractedListRecord; missing: string[] };

/**
 * An item's record. `"complete"` also refuses a text field whose element still
 * hides part of its text behind a disclosure control (`text-disclosure/`);
 * `"visible"` reads what the page shows, for the conditions to judge first.
 * `whole`, when given, names the only fields held to `"complete"`: a field kept
 * but never asked for is read as it shows (t1033).
 */
export function readRecord(element: Element, fields: FieldReaders, completeness: "visible" | "complete", whole?: ReadonlySet<string>): ItemRead {
  const record: ExtractedListRecord = {};
  const missing: string[] = [];
  for (const [name, reader] of fields) {
    const value = readField(element, name, reader, whole === undefined || whole.has(name) ? completeness : "visible");
    if (value === undefined) missing.push(name);
    else record[name] = value;
  }
  return { record, missing };
}
