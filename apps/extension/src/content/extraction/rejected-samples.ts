// A few of the rows each `where` condition rejected, kept while the read goes
// on, for a read that was asked for them.
//
// Only the exploring model's own node run asks (the command's
// `rejectedSamples: true`, `domain/src/actions/extraction/rejected-samples.ts`),
// because counts alone cannot show it a condition that removes true answers:
// on `run-munq5s8x-6d620cdf` an accessory rule rejected three earbuds named
// "... Wireless Charging Case ..." and the model saw only `16`. A playback
// never asks, so nothing here reaches a stored result.
//
// Bounded as it is collected: at most three rows per condition, each value cut
// to 80 characters, and a row a condition already has is not added to it again,
// so a page shown twice does not fill a sample with one row. A row several
// conditions rejected is a sample of each. The samples carry across documents
// with the read's checkpoint (`shared/extraction-continuation.ts`), and a
// carried sample is held to the same bounds, so a multi-page read's samples
// are bounded in total by the number of conditions, not the number of pages.

import type { ExtractedListRecord } from "./list-reader";

/** Rows kept per condition; the domain's reader cuts to the same bound. */
const ROWS_PER_CONDITION = 3;
/** Characters kept per value; the domain's reader cuts to the same bound. */
const CHARS_PER_VALUE = 80;

/** The samples a read is keeping: `note` each rejection, `rows` for the checkpoint and the outcome. */
export type RejectedSamples = {
  note(rejectedBy: readonly number[], record: ExtractedListRecord): void;
  rows(): ExtractedListRecord[][];
};

/**
 * A collector for `conditions` conditions, starting from what a continued read
 * carried when it has one list per condition, or `undefined` for a read that
 * was not asked for samples or names no conditions.
 */
export function rejectedSamplesFor(asked: boolean, conditions: number, carried: readonly ExtractedListRecord[][] | undefined): RejectedSamples | undefined {
  if (!asked || conditions === 0) return undefined;
  const lists: ExtractedListRecord[][] = Array.from({ length: conditions }, (_unused, index) =>
    carried?.length === conditions ? (carried[index] ?? []).slice(0, ROWS_PER_CONDITION).map(cut) : []);
  const seen = lists.map((rows) => new Set(rows.map((row) => JSON.stringify(row))));
  return {
    note(rejectedBy, record) {
      for (const index of rejectedBy) {
        const rows = lists[index];
        const keys = seen[index];
        if (rows === undefined || keys === undefined || rows.length >= ROWS_PER_CONDITION) continue;
        const row = cut(record);
        const key = JSON.stringify(row);
        if (keys.has(key)) continue;
        keys.add(key);
        rows.push(row);
      }
    },
    rows: () => lists.map((rows) => rows.map((row) => ({ ...row })))
  };
}

function cut(record: ExtractedListRecord): ExtractedListRecord {
  const row: ExtractedListRecord = {};
  for (const [key, value] of Object.entries(record)) row[key] = typeof value === "string" && value.length > CHARS_PER_VALUE ? value.slice(0, CHARS_PER_VALUE) : value;
  return row;
}
