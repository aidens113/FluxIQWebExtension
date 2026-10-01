// The rows each `where` condition rejected, kept while the read goes on, for a
// read that was asked for them.
//
// Only the exploring model's own node run asks (the command's
// `rejectedSamples: true`, `domain/src/actions/extraction/rejected-samples.ts`),
// because counts alone cannot show it a condition that removes true answers:
// on `run-munq5s8x-6d620cdf` an accessory rule rejected three earbuds named
// "... Wireless Charging Case ..." and the model saw only `16`. A playback
// never asks, so nothing here reaches a stored result.
//
// **Every rejected row, every value whole** (user, 2026-09-30: "Remove ANY AND
// ALL LIMITS ON THE NUMBER OF ELEMENTS PASSED TO MODEL. DO NOT HIDE
// INFORMATION"). There is no row count and no character cut. The one thing
// not added is a row a condition already holds: an identical row is said once,
// so a page shown twice does not say one row twice. A row several conditions
// rejected is a row of each. The rows carry across documents with the read's
// checkpoint (`shared/extraction-continuation.ts`), whole.
//
// Screening happens where the rows become evidence: the domain's node run puts
// them through the same screen as the kept rows
// (`domain/src/runtime/llm-evidence/node-run/rejected-rows.ts`).

import type { ExtractedListRecord } from "./list-reader";

/** The rows a read is keeping: `note` each rejection, `rows` for the checkpoint and the outcome. */
export type RejectedSamples = {
  note(rejectedBy: readonly number[], record: ExtractedListRecord): void;
  rows(): ExtractedListRecord[][];
};

/**
 * A collector for `conditions` conditions, starting from what a continued read
 * carried when it has one list per condition, or `undefined` for a read that
 * was not asked for its rejected rows or names no conditions.
 */
export function rejectedSamplesFor(asked: boolean, conditions: number, carried: readonly ExtractedListRecord[][] | undefined): RejectedSamples | undefined {
  if (!asked || conditions === 0) return undefined;
  const lists: ExtractedListRecord[][] = Array.from({ length: conditions }, (_unused, index) =>
    carried?.length === conditions ? (carried[index] ?? []).map(copy) : []);
  const seen = lists.map((rows) => new Set(rows.map((row) => JSON.stringify(row))));
  return {
    note(rejectedBy, record) {
      for (const index of rejectedBy) {
        const rows = lists[index];
        const keys = seen[index];
        if (rows === undefined || keys === undefined) continue;
        const row = copy(record);
        const key = JSON.stringify(row);
        if (keys.has(key)) continue;
        keys.add(key);
        rows.push(row);
      }
    },
    rows: () => lists.map((rows) => rows.map(copy))
  };
}

function copy(record: ExtractedListRecord): ExtractedListRecord {
  return { ...record };
}
