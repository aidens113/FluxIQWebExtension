// Full disclosure of an item's text, checked after `where` (`list-reader.ts`).
// An item's fields are read as the page shows them, the conditions judge that,
// and only a kept item must show every field whole: one collapsed "Read more"
// refuses the read with `incomplete_text`. A rejected item refuses it only where
// a condition that rejected it tested a field still collapsed, since that
// rejection judged partial text (`run-mvgw3ve5-294881b5`, 2026-10-20). Moved out
// of `list-reader.ts` on 2026-10-20 with the rest of `item-record/`, unchanged.

import { readField } from "../field-reader";
import type { FieldReaders } from "./field-readers";

/**
 * Refuses an item, read as the page shows it, whose text fields are not whole:
 * every field of an item the conditions kept, and of a rejected one only the
 * fields named in `tested`, one per rejecting condition -- `undefined` for a
 * condition that read its own value, which the item filter holds to the same
 * rule -- since that rejection judged partial text. Only text and column reads
 * can be collapsed, so only they are read again.
 */
export function assertDisclosed(element: Element, fields: FieldReaders, tested?: readonly (string | undefined)[]): void {
  for (const [name, reader] of fields) {
    if (reader.kind !== "text" && reader.kind !== "column") continue;
    if (tested === undefined || tested.includes(name)) readField(element, name, reader, "complete");
  }
}
