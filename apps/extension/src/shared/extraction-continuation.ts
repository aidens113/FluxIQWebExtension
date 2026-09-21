// How a paginated `web.dom.extract_list` read outlives the document it began
// in: the checkpoint the page hands the background worker before it follows a
// pagination control, and the continuation the worker hands the next document.
//
// A read runs in the content script, and a Next that loads a new document
// destroys that script with the command unanswered, so everything it had read
// would go with it. So before each control is followed the page sends a
// checkpoint -- the records and pages read so far -- and waits for it to be
// taken. When the command's reply is then lost, `runtime/extract-list-continuation.ts`
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
  const { records, pagesRead, scrolls, missingFields } = value as Record<string, unknown>;
  if (!Array.isArray(records) || !records.every(isRecord)) return undefined;
  if (!isCount(pagesRead) || !isCount(scrolls)) return undefined;
  if (!Array.isArray(missingFields) || !missingFields.every((name) => typeof name === "string")) return undefined;
  return { records: records.map((record) => ({ ...record })), pagesRead, scrolls, missingFields: [...missingFields] };
}

function isRecord(value: unknown): value is ExtractionCheckpointRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((field) => typeof field === "string" || field === null);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
