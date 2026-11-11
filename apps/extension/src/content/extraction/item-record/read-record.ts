// One item read into a record (`list-reader.ts`): each included field's value,
// and the required fields it lacked. Moved out of `list-reader.ts` on
// 2026-10-20 with the rest of `item-record/`, unchanged.

import { isRenderedItem } from "./rendered-item";
import type { ExtractedListRecord } from "../list-reader";
import { readField } from "../field-reader";
import type { FieldReaders } from "./field-readers";

/** One item read: its record, and the required fields it lacked. */
export type ItemRead = { record: ExtractedListRecord; missing: string[] };

/**
 * An item's record. `"complete"` also refuses a text field whose element still
 * hides part of its text behind a disclosure control (`text-disclosure/`);
 * `"visible"` reads what the page shows, for the conditions to judge first.
 */
export function readRecord(element: Element, fields: FieldReaders, completeness: "visible" | "complete"): ItemRead {
  const record: ExtractedListRecord = {};
  const missing: string[] = [];
  // An item the page does not show is opened before it is read, as a person would (`./rendered-item.ts`, t903):
  // each field reads as one the item has nowhere to read.
  const shown = isRenderedItem(element);
  for (const [name, reader] of fields) {
    const value = shown ? readField(element, name, reader, completeness) : reader.required ? undefined : null;
    if (value === undefined) missing.push(name);
    else record[name] = value;
  }
  return { record, missing };
}
