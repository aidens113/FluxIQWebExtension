// Where a count of the whole read starts in the document reading now.
//
// `recordCount` and `pagesRead` are what the whole read did, however many
// documents it crossed, so a count reported beside them has to be the whole
// read's too: a reader comparing them against one document's count concludes
// the read did less than it did. A continued read therefore adds what its own
// document counted to what its predecessor checkpointed.
//
// `undefined` is a checkpoint from a page build -- or a read -- that did not
// count: there is no beginning to add to, so the read says nothing rather than
// reporting one document's count as the whole read's, and that absence travels
// on to the next document in place of a number that would be missing its start.
// An absent count says "unknown"; understating is worse than either.

import type { ExtractionCheckpoint } from "../../../shared/extraction-continuation";

/** The checkpoint's whole-read counts that keep their absence across documents. */
export type CarriedCountName = "itemsSeen" | "earlierPageRepeats";

/** 0 for a read that began in this document, else what its predecessor counted, or `undefined` when it counted nothing. */
export function carriedCount(resume: ExtractionCheckpoint | undefined, name: CarriedCountName): number | undefined {
  return resume === undefined ? 0 : resume[name];
}
