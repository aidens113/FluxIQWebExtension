// T1 coverage of the checkpoint reader both ends of a continued list read
// trust: what it keeps, and every shape it refuses rather than half-reading.

import assert from "node:assert/strict";
import test from "node:test";
import { readExtractionCheckpoint } from "../extraction-continuation";

const CHECKPOINT = { records: [{ name: "One", price: null }], pagesRead: 2, scrolls: 0, missingFields: ["price"] };

test("a checkpoint is read back whole, as a copy", () => {
  const read = readExtractionCheckpoint(CHECKPOINT);
  assert.deepEqual(read, CHECKPOINT);
  assert.notEqual(read?.records[0], CHECKPOINT.records[0]);
});

test("anything that is not a checkpoint is refused rather than partly read", () => {
  const refused: unknown[] = [
    undefined,
    null,
    "checkpoint",
    { ...CHECKPOINT, records: "One" },
    { ...CHECKPOINT, records: [["One"]] },
    { ...CHECKPOINT, records: [{ name: 1 }] },
    { ...CHECKPOINT, records: [{ name: { text: "One" } }] },
    { ...CHECKPOINT, pagesRead: -1 },
    { ...CHECKPOINT, pagesRead: 1.5 },
    { ...CHECKPOINT, scrolls: "0" },
    { ...CHECKPOINT, missingFields: [3] },
    { ...CHECKPOINT, itemsSeen: -1 },
    { ...CHECKPOINT, itemsSeen: 1.5 },
    { ...CHECKPOINT, itemsSeen: "8" },
    { ...CHECKPOINT, itemsSeen: null },
    { records: [], pagesRead: 1, scrolls: 0 }
  ];
  for (const value of refused) assert.equal(readExtractionCheckpoint(value), undefined, JSON.stringify(value));
});

test("the item count crosses the document boundary, and an absent one stays absent rather than becoming a zero", () => {
  // Without this the count restarted at each document, and a paginated read
  // reported its last document's items as the whole read's -- which reads as the
  // selector having matched fewer items than it did, and `itemsSeen` below
  // `recordCount` is the shape that means "every field was read off the wrong
  // element". A wrong count is worse than none, so a checkpoint that carries no
  // count is read as carrying none: absent means "not counted", never zero.
  const counted = { ...CHECKPOINT, itemsSeen: 8 };
  assert.deepEqual(readExtractionCheckpoint(counted), counted);
  const uncounted = readExtractionCheckpoint(CHECKPOINT);
  assert.deepEqual(uncounted, CHECKPOINT);
  assert.equal("itemsSeen" in (uncounted ?? {}), false);
  // Zero is a real count -- a document whose selector named nothing -- and is kept
  // as one rather than folded into absence.
  assert.equal(readExtractionCheckpoint({ ...CHECKPOINT, itemsSeen: 0 })?.itemsSeen, 0);
});
