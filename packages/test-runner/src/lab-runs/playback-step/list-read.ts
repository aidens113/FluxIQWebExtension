// What a playback list read (`web.dom.extract_list`) said about itself: counts
// and closed words from its `extraction` summary, never a row, field value or
// field name (`run-musp39u8-9ac026ab` wrote `validation: null` and nothing else).

import { RUN_EXTRACTION_PAGINATION_STOP } from "@fluxiq-web-extension/test-contracts";

type Json = Record<string, unknown>;
const record = (value: unknown): Json | undefined => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Json : undefined;
const count = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
const STOPS: readonly string[] = RUN_EXTRACTION_PAGINATION_STOP;

/** What a list read said about itself: counts and closed words, never a row. */
type ListRead = { records: number; pages: number; itemsSeen: number | null; emptyRecords: number | null; truncated: boolean | null; stop: string | null; conditionsKept: number | null; rowsReturned: number | null };

/**
 * The read's counts, and the sentence a step summary ends with, from the action
 * result's `extraction` summary beside its `extracted` rows. Looked for at the
 * two depths Core looks (`service/summaries/extraction-summary.ts`): the
 * client's payload as it is, or wrapped by the domain's gateway dispatcher as
 * `{ status, message, result }`. A summary without its record and page counts
 * is no read; a stop word this package does not know is `unknown`, as the
 * published contract has it.
 */
export function playbackListRead(outcome: Json | undefined): { read: ListRead; said: string } | undefined {
  const dispatched = record(outcome?.result) ?? outcome;
  const summary = record(dispatched?.extraction);
  const records = count(summary?.recordCount);
  const pages = count(summary?.pagesRead);
  if (!summary || records === null || pages === null) return undefined;
  const stop = typeof summary.paginationStop === "string" ? (STOPS.includes(summary.paginationStop) ? summary.paginationStop : "unknown") : null;
  const read: ListRead = {
    records,
    pages,
    itemsSeen: count(summary.itemsSeen),
    emptyRecords: count(summary.emptyRecords),
    truncated: typeof summary.truncated === "boolean" ? summary.truncated : null,
    stop,
    conditionsKept: count(record(summary.conditions)?.kept),
    rowsReturned: Array.isArray(dispatched?.extracted) ? dispatched.extracted.length : null,
  };
  const detail = [read.itemsSeen === null ? undefined : `${read.itemsSeen} items seen`, read.stop === null ? undefined : `stopped on ${read.stop}`, read.truncated ? "cut short by a cap" : undefined].filter(Boolean).join(", ");
  return { read, said: `${read.records} records over ${read.pages} pages${detail ? ` (${detail})` : ""}${read.rowsReturned === null ? "" : `; ${read.rowsReturned} rows returned`}` };
}
