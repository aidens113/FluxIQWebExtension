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
  const { records, pagesRead, scrolls, missingFields, filtered, itemsSeen } = value as Record<string, unknown>;
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
  return {
    records: records.map((record) => ({ ...record })),
    pagesRead,
    scrolls,
    missingFields: [...missingFields],
    ...(filtered === undefined ? {} : { filtered }),
    ...(itemsSeen === undefined ? {} : { itemsSeen })
  };
}

function isRecord(value: unknown): value is ExtractionCheckpointRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((field) => typeof field === "string" || field === null);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
