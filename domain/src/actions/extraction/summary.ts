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
  /** What `where` did, or absent for a read whose request named no conditions. */
  conditions?: WebAutomationExtractionConditionReport | undefined;
};

/**
 * What a read's `where` conditions did to it (C5), in counts alone.
 *
 * It exists because a filtered read that answers with nothing is
 * indistinguishable from a page with nothing on it, and on 2026-09-24 that cost
 * a run: `run-mug3tnti-9ab80b85` returned 0 records where 13 were wanted, from
 * conditions that rejected every row, and neither the person nor the repair
 * could see which of the two had happened. The read now prefers answering with
 * the rows it rejected (`unfiltered`), and this report is how anything
 * downstream knows that is what it is looking at.
 *
 * `applied` is the items the conditions were asked about and `kept` the items
 * every condition held of. `kept` is not `recordCount`: an item the conditions
 * kept can still be dropped as a duplicate of an earlier page's row, or by the
 * item bound. `rejected` carries one count per condition, positionally, so a
 * repair can name the condition that emptied the read rather than guess among
 * four. They sum above `applied - kept` when an item failed several at once.
 *
 * A continued read reports what its own document did, since the rows an earlier
 * document rejected did not travel with its checkpoint.
 *
 * When `unfiltered` is true, `recordCount` counts rows this report also counts
 * as rejected. That is not a contradiction: they are the rows the conditions
 * turned down and the read answered with anyway, and reading the two counts
 * together is the only way to know that is what happened.
 */
export type WebAutomationExtractionConditionReport = {
  applied: number;
  kept: number;
  rejected: number[];
  /** Whether the read answered with rows its conditions rejected, because keeping only the survivors would have answered with none. */
  unfiltered: boolean;
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
  // Absent for a read with no conditions, and, when sent, held to the same rule
  // as everything else here: unreadable drops the whole summary rather than
  // arriving as a report that says something the read did not do.
  const conditions = summary.conditions === undefined ? undefined : conditionReportValue(summary.conditions);
  if (summary.conditions !== undefined && conditions === undefined) return undefined;
  return {
    recordCount,
    pagesRead,
    truncated: summary.truncated,
    missingFields,
    fieldNames,
    ...(conditions !== undefined ? { conditions } : {})
  };
}

/** The condition report copied count by count, or `undefined` for one that is not well formed. */
function conditionReportValue(value: unknown): WebAutomationExtractionConditionReport | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const report = value as Record<string, unknown>;
  const applied = countValue(report.applied);
  const kept = countValue(report.kept);
  const rejected = Array.isArray(report.rejected) && report.rejected.every((entry) => countValue(entry) !== undefined)
    ? report.rejected as number[]
    : undefined;
  if (applied === undefined || kept === undefined || rejected === undefined || typeof report.unfiltered !== "boolean") return undefined;
  // A read cannot have kept more items than it looked at.
  if (kept > applied) return undefined;
  return { applied, kept, rejected: [...rejected], unfiltered: report.unfiltered };
}

function countValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function fieldKeyList(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every(isWebAutomationExtractFieldKey) ? [...value] : undefined;
}
