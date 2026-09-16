// The result half of `web.dom.extract_list` (contract C2): what a list read
// says about itself, beside the records it returns in `extracted`.
//
// Every value here is a count, a flag, or a declared field key. None is read
// from the page, which is what lets the wire payload carry the summary for any
// element. That holds only while the shape stays this way, so the copy below
// admits nothing else: a string that is not a well-formed field key, or a
// missing field that is not one of the read's own fields, drops the whole
// summary rather than letting page text ride on a field nothing redacts.

import { isWebAutomationExtractFieldKey } from "./field-key";

export type WebAutomationExtractionSummary = {
  /** Records returned, across every page read. */
  recordCount: number;
  /** Pages read, the first included. */
  pagesRead: number;
  /** Whether a cap -- the item bound or the page bound -- cut the read short. */
  truncated: boolean;
  /** Fields at least one record did not yield. Always a subset of `fieldNames`. */
  missingFields: string[];
  /** The request's field keys, excluded fields left out (D12). */
  fieldNames: string[];
};

/**
 * The summary copied field by field, or `undefined` when any part of it is not
 * well formed. Unknown keys are left behind.
 */
export function webAutomationExtractionSummaryValue(value: unknown): WebAutomationExtractionSummary | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const summary = value as Record<string, unknown>;
  const recordCount = countValue(summary.recordCount);
  const pagesRead = countValue(summary.pagesRead);
  const fieldNames = fieldKeyList(summary.fieldNames);
  const missingFields = fieldKeyList(summary.missingFields);
  if (recordCount === undefined || pagesRead === undefined || typeof summary.truncated !== "boolean" || fieldNames === undefined || missingFields === undefined) return undefined;
  if (!missingFields.every((key) => fieldNames.includes(key))) return undefined;
  return { recordCount, pagesRead, truncated: summary.truncated, missingFields, fieldNames };
}

function countValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function fieldKeyList(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every(isWebAutomationExtractFieldKey) ? [...value] : undefined;
}
