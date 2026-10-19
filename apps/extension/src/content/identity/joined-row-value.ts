// A pass row's value that the list extraction read as whole lines (job save
// r1, `run-mvectfld-c2f5d958`, Cause 1).
//
// A `lines` field reads each drawn child of a container as one line and joins
// them with the domain's `WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR`
// (`content/extraction/field-reader.ts` `readLines`). A card drawing
// `<span>Name</span><span>Place</span>` therefore gives the value
// "Name · Place", and the separator is drawn nowhere on the page: the
// row gate looked for the value whole, no record could hold it, and every
// pass of a For Each over such a read refused its own row's control.
//
// Each part was read from one child of the record, so the value is held where
// every part is found in that same record. The caller asks about one record at
// a time, which is what keeps two parts found in two different records from
// adding up to a match. A value with no separator in it has no parts and is
// left to the whole-value test.

import { WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR } from "@fluxiq-web-extension/domain/client";

/**
 * Whether `value`, read as joined lines, is held part by part: it carries the
 * line separator, and each non-empty part passes `holds`. `false` for a value
 * that is not joined, and for one whose parts are all empty, so a separator
 * alone never counts as found.
 */
export function heldAsJoinedLines(value: string, holds: (part: string) => boolean): boolean {
  if (!value.includes(WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR)) return false;
  const parts = value.split(WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 && parts.every(holds);
}
