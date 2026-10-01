// How a paginated `web.dom.extract_list` read outlives the document it began
// in: the checkpoint the page hands the background worker before it follows a
// pagination control, and the continuation the worker hands the next document.
//
// A read runs in the content script, and a Next that loads a new document
// destroys that script with the command unanswered, so everything it had read
// would go with it. So before each control is followed the page sends a
// checkpoint -- the records and pages read so far, and the counts the read's own
// account is built from -- and waits for it to be taken. When the command's reply is then lost, `runtime/extract-list-continuation.ts`
// waits for the tab's new document and sends the same command again carrying
// that checkpoint, and the new document's read goes on from it
// (`content/extraction/list-reader.ts`).
//
// The checkpoint carries page values, exactly as the command's own reply does.
// It crosses from the content script to the worker and back and is held only in
// the worker's memory for the length of the command -- never in storage, a log,
// or the recording -- which is the same place a reply's records already live.

/** The message a page sends with each checkpoint; the worker and the content script must spell it identically. */
export const EXTRACTION_CHECKPOINT_MESSAGE = "fluxiq.extraction.checkpoint";

/** One record a read took: each included field's value, or `null` for an optional field the page could not read. */
export type ExtractionCheckpointRecord = Record<string, string | null>;

/** What a read had done when it last followed a control. */
export type ExtractionCheckpoint = {
  /** Every record read so far, in the order read. */
  records: ExtractionCheckpointRecord[];
  /** Pages read so far, the first included. */
  pagesRead: number;
  /** Scrolls made so far. */
  scrolls: number;
  /** Required fields some record read so far lacked. */
  missingFields: string[];
  /** Items a `where` condition left out so far, which are not records (C5). Absent in a checkpoint written before conditions existed. */
  filtered?: number | undefined;
  /**
   * Items the `item` selector named so far, across every document read, before
   * any condition, any duplicate and the item bound (C2).
   *
   * It travels because a count that restarted at each document would understate
   * the read: `recordCount` and `pagesRead` are what the whole read did, and a
   * reader comparing them against an item count that means only the last
   * document would conclude the selector had matched fewer items than it had.
   * Summing is exact rather than approximate -- the page counts elements in a set
   * because one document's list can be re-queried, and no element of a destroyed
   * document can recur in its successor, so two documents' items are always
   * distinct.
   *
   * Absent in a checkpoint from a page build that did not count it, and then it
   * stays absent for the rest of the read rather than resuming from a number that
   * is missing its beginning: an absent count says "unknown", and understating is
   * worse than either (`content/extraction/list-reader.ts`).
   */
  itemsSeen?: number | undefined;
  /**
   * What the request's `where` conditions did so far, across every document
   * read: items asked about, items every condition held of, and one rejection
   * count per condition, positionally (C5).
   *
   * It travels for the reason `itemsSeen` does, and its absence was measured.
   * Live run `run-munnhi5q-4867dabe` read five pages, the last a document with
   * no card on it (the store rate-limits a fast sweep), and reported
   * `conditions: {applied: 0, kept: 0, rejected: [0, 0]}` for a read whose two
   * conditions had run on every card of the pages before: the counts restarted
   * at each document, so the read answered with its last document's, and a
   * read that filtered looked like one whose filters did nothing.
   *
   * Absent in a checkpoint from a read that named no conditions, or from a page
   * build that did not carry them.
   */
  conditions?: ExtractionCheckpointConditions | undefined;
  /**
   * Every row each condition rejected so far, one list per condition, for a
   * read the exploring model's node run asked to keep them
   * (`content/extraction/rejected-samples.ts`). They travel for the reason the
   * counts do: a multi-page read would otherwise show only its last document's
   * rows, and a condition that rejected true answers on page one would look as
   * if it had rejected nothing. Nothing caps them.
   *
   * Absent for a read that was not asked for samples.
   */
  rejectedSamples?: ExtractionCheckpointRecord[][] | undefined;
  /**
   * Per condition, how many leading rows of its `rejectedSamples` list that
   * condition removed by itself (`content/extraction/rejected-samples.ts`).
   * Beside `rejectedSamples` only; absent from a page build that did not order
   * them, whose rows then go on as rows another condition also rejected.
   */
  rejectedSamplesAlone?: number[] | undefined;
  /**
   * What the read has spent on pages the server refused: the reloads it made,
   * and the refusals as too fast (429) it met, an unexplained empty page
   * counted as one (`content/extraction/pagination.ts`).
   *
   * It travels because a reload is itself a new document: a read that forgot
   * its retries at every document would reload a refusing page for ever, and
   * one that forgot its refusals could be what makes a limiter flag the
   * session. Absent for a read that met no refused page.
   */
  refusals?: ExtractionCheckpointRefusals | undefined;
};

/** A checkpoint's refused-page counts. */
export type ExtractionCheckpointRefusals = {
  retries: number;
  rateLimits: number;
};

/** The condition counts a checkpoint carries: the report's counts without `unfiltered`, which only the read's answer can decide. */
export type ExtractionCheckpointConditions = {
  applied: number;
  kept: number;
  rejected: number[];
  /**
   * The first value each condition's own read found on an item it held of, or
   * `null` (`content/extraction/item-filter.ts`). It travels so the value a read
   * reports is the whole read's first, not its last document's. Absent from a
   * page build that did not collect it.
   */
  seen?: (string | null)[] | undefined;
  /**
   * Per condition, the items it rejected that every other condition held of
   * (`content/extraction/list-reader.ts`), so the count a read reports is the
   * whole read's. Absent from a page build that did not count them.
   */
  alone?: number[] | undefined;
};

/**
 * What an `executeAction` message carries beside the action when the worker
 * wants a read to survive a navigation: the token its checkpoints are sent
 * under, and the checkpoint to go on from when this document continues a read
 * another one began.
 */
export type ExtractionContinuation = {
  token: string;
  resume?: ExtractionCheckpoint | undefined;
};

/** The checkpoint message itself. */
export type ExtractionCheckpointMessage = {
  type: typeof EXTRACTION_CHECKPOINT_MESSAGE;
  token: string;
  checkpoint: ExtractionCheckpoint;
};

/**
 * `value` as a checkpoint, or `undefined` when it is not one. Both ends read
 * what the other sent through this, because each receives it as a message
 * body: the worker a page's checkpoint, and the page the worker's resume. A
 * record's values are strings or `null`, and nothing else is kept.
 */
export function readExtractionCheckpoint(value: unknown): ExtractionCheckpoint | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { records, pagesRead, scrolls, missingFields, filtered, itemsSeen, conditions, rejectedSamples, rejectedSamplesAlone, refusals } = value as Record<string, unknown>;
  if (!Array.isArray(records) || !records.every(isRecord)) return undefined;
  if (!isCount(pagesRead) || !isCount(scrolls)) return undefined;
  if (!Array.isArray(missingFields) || !missingFields.every((name) => typeof name === "string")) return undefined;
  // Sent but unreadable is refused, as every other member is; absent is a
  // checkpoint from a document that had no conditions to count.
  if (filtered !== undefined && !isCount(filtered)) return undefined;
  // The same rule, and absent is a checkpoint from a page that did not count its
  // items. Refusing rather than dropping the member is what keeps an absent count
  // meaning one thing: not counted, never counted wrongly.
  if (itemsSeen !== undefined && !isCount(itemsSeen)) return undefined;
  // And again: sent but unreadable is refused, never read as no conditions.
  const conditionCounts = conditions === undefined ? undefined : conditionCountsValue(conditions);
  if (conditions !== undefined && conditionCounts === undefined) return undefined;
  // The same rule once more: a read that forgot its retries could reload a
  // refusing page for ever, so unreadable counts refuse rather than reset.
  const refusalCounts = refusals === undefined ? undefined : refusalCountsValue(refusals);
  if (refusals !== undefined && refusalCounts === undefined) return undefined;
  // And the samples: one list of records per condition, or the checkpoint is refused.
  if (rejectedSamples !== undefined && !(Array.isArray(rejectedSamples) && rejectedSamples.every((rows) => Array.isArray(rows) && rows.every(isRecord)))) return undefined;
  // How many of each list lead as rows its condition removed alone: only beside the lists, one count per list, never more than the list holds.
  if (rejectedSamplesAlone !== undefined && !aloneLeadsValid(rejectedSamplesAlone, rejectedSamples)) return undefined;
  return {
    records: records.map((record) => ({ ...record })),
    pagesRead,
    scrolls,
    missingFields: [...missingFields],
    ...(filtered === undefined ? {} : { filtered }),
    ...(itemsSeen === undefined ? {} : { itemsSeen }),
    ...(conditionCounts === undefined ? {} : { conditions: conditionCounts }),
    ...(rejectedSamples === undefined ? {} : { rejectedSamples: (rejectedSamples as ExtractionCheckpointRecord[][]).map((rows) => rows.map((row) => ({ ...row }))) }),
    ...(rejectedSamplesAlone === undefined ? {} : { rejectedSamplesAlone: [...rejectedSamplesAlone as number[]] }),
    ...(refusalCounts === undefined ? {} : { refusals: refusalCounts })
  };
}

/** A checkpoint's refused-page counts, copied, or `undefined` when either is not a count. */
function refusalCountsValue(value: unknown): ExtractionCheckpointRefusals | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const { retries, rateLimits } = value as Record<string, unknown>;
  return isCount(retries) && isCount(rateLimits) ? { retries, rateLimits } : undefined;
}

/** A checkpoint's condition counts, copied, or `undefined` when any member is not a count. */
function conditionCountsValue(value: unknown): ExtractionCheckpointConditions | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const { applied, kept, rejected, seen, alone } = value as Record<string, unknown>;
  if (!isCount(applied) || !isCount(kept) || kept > applied) return undefined;
  if (!Array.isArray(rejected) || !rejected.every(isCount)) return undefined;
  // One value or `null` per condition, or the checkpoint is refused.
  if (seen !== undefined && !(Array.isArray(seen) && seen.length === rejected.length && seen.every((entry) => entry === null || typeof entry === "string"))) return undefined;
  // One count per condition, none above that condition's own rejections, or the checkpoint is refused.
  if (alone !== undefined && !(Array.isArray(alone) && alone.length === rejected.length && alone.every((entry, index) => isCount(entry) && entry <= (rejected[index] as number)))) return undefined;
  return {
    applied,
    kept,
    rejected: [...rejected],
    ...(seen === undefined ? {} : { seen: [...seen as (string | null)[]] }),
    ...(alone === undefined ? {} : { alone: [...alone as number[]] })
  };
}

/** Whether `alone` is one count per list of `lists`, none above its list's length. */
function aloneLeadsValid(alone: unknown, lists: unknown): boolean {
  return Array.isArray(alone) && Array.isArray(lists) && alone.length === lists.length
    && alone.every((entry, index) => isCount(entry) && entry <= (lists[index] as unknown[]).length);
}

function isRecord(value: unknown): value is ExtractionCheckpointRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((field) => typeof field === "string" || field === null);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
