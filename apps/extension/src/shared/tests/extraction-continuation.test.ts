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
    { records: [], pagesRead: 1, scrolls: 0 }
  ];
  for (const value of refused) assert.equal(readExtractionCheckpoint(value), undefined, JSON.stringify(value));
});
