// Whether a record on a captured page holds a loop pass's row: the rule the
// page applies at dispatch (`apps/extension/src/content/identity/record.ts`
// `holdsRowValues`), read from the capture's elements instead of the DOM.
//
// Each value must be found in the record by a way the list extraction can have
// read it: inside the words of its elements, whitespace-collapsed; or equal to
// an attribute value on one of them, a link resolved against the page, or a
// control's current value, each cut as a row value is. Every value, not most:
// a row is told from its neighbours by the values it does not share with them.
// A value read as joined lines is found where each of its lines is, in this
// same record (`joined-row-value.ts` on the page). A record with no elements
// holds nothing.

import { WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR } from "../../../../actions/extraction";
import type { WebLlmEvidenceElement } from "../../../llm-evidence";

/** Characters of one row value, as the domain cut it (`output-nodes/targets` `webAutomationRecordValues`). */
const MAX_ROW_VALUE = 200;

/** Whether the elements of one record, on the page at `location`, hold every one of `values` (header). */
export function webRecordHoldsRowValues(members: readonly WebLlmEvidenceElement[], values: readonly string[], location: string): boolean {
  if (members.length === 0 || values.length === 0) return false;
  const words = collapsed(members.flatMap((element) => [element.name, element.label, element.text]).filter((part) => part !== undefined).join(" ")) ?? "";
  const exact = new Set(members.flatMap((element) => exactValues(element, location)));
  const holds = (value: string): boolean => words.includes(value) || exact.has(value);
  return values.every((value) => holds(value) || heldAsJoinedLines(value, holds));
}

/** An element's attribute values, its resolved link and its current value, each cut as a row value. */
function exactValues(element: WebLlmEvidenceElement, location: string): string[] {
  const found = (element.attributes ?? []).map(([, value]) => value);
  const href = element.attributes?.find(([name]) => name.toLowerCase() === "href")?.[1];
  if (href !== undefined && URL.canParse(href, location || undefined)) found.push(new URL(href, location || undefined).href);
  if (element.value !== undefined) found.push(element.value);
  return found.flatMap((value) => {
    const cut = collapsed(value)?.slice(0, MAX_ROW_VALUE).trimEnd();
    return cut ? [cut] : [];
  });
}

/** A value read as lines joined by the extraction's separator, held part by part; never a separator alone. */
function heldAsJoinedLines(value: string, holds: (part: string) => boolean): boolean {
  if (!value.includes(WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR)) return false;
  const parts = value.split(WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 && parts.every(holds);
}

function collapsed(value: string): string | undefined {
  const text = value.replace(/\s+/gu, " ").trim();
  return text || undefined;
}
