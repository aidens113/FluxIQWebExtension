// The checkpoint a read hands the worker before it follows a pagination
// control: the read so far, copied, so the document the control loads goes on
// from it (`shared/extraction-continuation.ts`).
//
// Every count in it is the whole read's so far, its predecessor's included, and
// a count this read could not know is left out rather than written as a number:
// absent is the one thing it may mean (`carried-count.ts`).

import type {
  ExtractionCheckpoint,
  ExtractionCheckpointConditions,
  ExtractionCheckpointRecord,
  ExtractionCheckpointRefusals
} from "../../../shared/extraction-continuation";
import type { RejectedSamples } from "../rejected-samples";

/** What a read has done so far, as the reader holds it. */
export type ReadSoFar = {
  records: readonly ExtractionCheckpointRecord[];
  pagesRead: number;
  scrolls: number;
  /** Required fields some record lacked. */
  missing: ReadonlySet<string>;
  filtered: number;
  itemsSeen: number | undefined;
  /** What the conditions did, or `undefined` for a request that named none. */
  conditions: ExtractionCheckpointConditions | undefined;
  /** The rows each condition rejected, or `undefined` for a read not asked for them. */
  samples: Pick<RejectedSamples, "rows" | "alone"> | undefined;
  /** What the read spent on refused pages; left out while it spent nothing. */
  refusals: ExtractionCheckpointRefusals;
  /** Repeats of an earlier page's records left out, or `undefined` for a read that does not count them. */
  earlierPageRepeats: number | undefined;
};

/** The checkpoint for `read`, sharing no array or record with it. */
export function readCheckpoint(read: ReadSoFar): ExtractionCheckpoint {
  const { conditions, samples, refusals } = read;
  return {
    records: read.records.map((record) => ({ ...record })),
    pagesRead: read.pagesRead,
    scrolls: read.scrolls,
    missingFields: [...read.missing].sort(),
    filtered: read.filtered,
    ...(read.itemsSeen === undefined ? {} : { itemsSeen: read.itemsSeen }),
    ...(conditions === undefined ? {} : { conditions: { applied: conditions.applied, kept: conditions.kept, rejected: [...conditions.rejected], ...copiedPerCondition(conditions) } }),
    ...(samples === undefined ? {} : { rejectedSamples: samples.rows(), rejectedSamplesAlone: samples.alone() }),
    ...(refusals.retries + refusals.rateLimits === 0 ? {} : { refusals: { retries: refusals.retries, rateLimits: refusals.rateLimits } }),
    ...(read.earlierPageRepeats === undefined ? {} : { earlierPageRepeats: read.earlierPageRepeats })
  };
}

/** A condition report's per-condition values and alone counts, copied, each left out where the report has none. */
function copiedPerCondition(conditions: ExtractionCheckpointConditions): Pick<ExtractionCheckpointConditions, "seen" | "alone"> {
  return {
    ...(conditions.seen === undefined ? {} : { seen: [...conditions.seen] }),
    ...(conditions.alone === undefined ? {} : { alone: [...conditions.alone] })
  };
}
