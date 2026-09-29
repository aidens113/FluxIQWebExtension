// What a list read's `dedupe` and `sort` did (C2), beside the rest of its
// summary (`./summary.ts`): two counts, copied count by count, so nothing read
// off the page can ride on it.

/**
 * What a read's `dedupe` and `sort` did to it, in counts alone.
 *
 * `duplicates` is the rows `dedupe` left out as repeats of an earlier row, after
 * `where` and before the item bound. `unsortable` is the rows, of those `sort`
 * ordered, whose value for at least one key could not be read as that key's
 * type, and which therefore went after every row that could, whichever the
 * direction. Both are `0` for the half the request did not name.
 *
 * It exists for the same reason the condition report does: live run
 * `run-mulwm2dc-0bd95f22` asked for roles "newest first", and a sort over a
 * column the page states as prose ("3 days ago") that read no row at all would
 * answer in page order and look sorted. `unsortable` equal to `recordCount` is
 * that case, and a repair can name the key.
 *
 * A continued read counts its own document's duplicates alone, since the rows an
 * earlier document dropped did not travel with its checkpoint.
 */
export type WebAutomationExtractionOrderReport = {
  duplicates: number;
  unsortable: number;
};

/** The order report copied count by count, or `undefined` for one that is not well formed. */
export function webAutomationExtractionOrderReportValue(value: unknown): WebAutomationExtractionOrderReport | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const report = value as Record<string, unknown>;
  const duplicates = countValue(report.duplicates);
  const unsortable = countValue(report.unsortable);
  if (duplicates === undefined || unsortable === undefined) return undefined;
  return { duplicates, unsortable };
}

function countValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
