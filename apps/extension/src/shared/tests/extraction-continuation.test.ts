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

test("the condition counts cross the document boundary, and unreadable ones refuse the checkpoint rather than becoming none", () => {
  // Without them a read that filtered four pages and ended on a fifth with no
  // item reported `applied: 0` (`run-munnhi5q-4867dabe`).
  const counted = { ...CHECKPOINT, conditions: { applied: 56, kept: 28, rejected: [20, 8] } };
  const read = readExtractionCheckpoint(counted);
  assert.deepEqual(read, counted);
  assert.notEqual(read?.conditions?.rejected, counted.conditions.rejected);
  assert.equal("conditions" in (readExtractionCheckpoint(CHECKPOINT) ?? {}), false);
  for (const conditions of [
    null,
    [],
    { applied: 1, kept: 1 },
    { applied: -1, kept: 0, rejected: [] },
    { applied: 1, kept: 2, rejected: [] },
    { applied: 2, kept: 1, rejected: [1.5] },
    { applied: 2, kept: 1, rejected: "1" }
  ]) {
    assert.equal(readExtractionCheckpoint({ ...CHECKPOINT, conditions }), undefined, JSON.stringify(conditions));
  }
});

test("what a read spent on refused pages crosses the document boundary, and unreadable counts refuse the checkpoint rather than reset", () => {
  // A reload is a new document: a read that forgot its retries would reload a
  // refusing page for ever (`content/extraction/pagination.ts`).
  const spent = { ...CHECKPOINT, refusals: { retries: 1, rateLimits: 1 } };
  const read = readExtractionCheckpoint(spent);
  assert.deepEqual(read, spent);
  assert.notEqual(read?.refusals, spent.refusals);
  assert.equal("refusals" in (readExtractionCheckpoint(CHECKPOINT) ?? {}), false);
  for (const refusals of [null, [], { retries: 1 }, { retries: -1, rateLimits: 0 }, { retries: 1, rateLimits: 0.5 }, { retries: "1", rateLimits: 0 }]) {
    assert.equal(readExtractionCheckpoint({ ...CHECKPOINT, refusals }), undefined, JSON.stringify(refusals));
  }
});
