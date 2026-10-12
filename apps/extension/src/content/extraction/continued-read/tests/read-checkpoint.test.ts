// T1 coverage of the checkpoint a read hands on before it follows a control:
// every member copied, and a count the read could not know left out.

import assert from "node:assert/strict";
import test from "node:test";
import { readCheckpoint, type ReadSoFar } from "../read-checkpoint";
import { readExtractionCheckpoint } from "../../../../shared/extraction-continuation";

test("checkpoint round trip retains the optional aligned passive observation companion", () => {
  const observations = [[{ conditionIndex: 0, state: "present" as const, value: "", source: "read" as const, readKind: "attribute" as const, page: 2, item: 3 }]];
  const checkpoint = readCheckpoint({ ...SO_FAR, conditions: { applied: 1, kept: 0, rejected: [1] }, samples: { rows: () => [[{ title: "Record A" }]], alone: () => [1], observations: () => observations } });
  assert.deepEqual(checkpoint.rejectedObservations, observations);
  assert.notEqual(checkpoint.rejectedObservations, observations);
  assert.deepEqual(readExtractionCheckpoint(JSON.parse(JSON.stringify(checkpoint)))?.rejectedObservations, observations);
  assert.equal(readExtractionCheckpoint({ ...checkpoint, rejectedObservations: [[]] }), undefined);
});

const SO_FAR: ReadSoFar = {
  records: [{ name: "A", price: null }],
  pagesRead: 2,
  scrolls: 0,
  missing: new Set(["rating", "price"]),
  filtered: 1,
  itemsSeen: 3,
  conditions: undefined,
  samples: undefined,
  refusals: { retries: 0, rateLimits: 0 },
  earlierPageRepeats: 1
};

test("the read so far becomes a checkpoint that shares nothing with it", () => {
  const conditions = { applied: 2, kept: 1, rejected: [1], seen: ["$5"], alone: [1] };
  const read: ReadSoFar = { ...SO_FAR, conditions, samples: { rows: () => [[{ name: "B", price: "$5" }]], alone: () => [1] }, refusals: { retries: 1, rateLimits: 1 } };
  const checkpoint = readCheckpoint(read);
  assert.deepEqual(checkpoint, {
    records: [{ name: "A", price: null }],
    pagesRead: 2,
    scrolls: 0,
    missingFields: ["price", "rating"],
    filtered: 1,
    itemsSeen: 3,
    conditions,
    rejectedSamples: [[{ name: "B", price: "$5" }]],
    rejectedSamplesAlone: [1],
    refusals: { retries: 1, rateLimits: 1 },
    earlierPageRepeats: 1
  });
  assert.notEqual(checkpoint.records[0], read.records[0]);
  assert.notEqual(checkpoint.conditions?.rejected, conditions.rejected);
  assert.notEqual(checkpoint.conditions?.seen, conditions.seen);
  assert.notEqual(checkpoint.refusals, read.refusals);
});

test("a count the read could not know, conditions it never had, and refusals it never met are left out, never written as zero", () => {
  const checkpoint = readCheckpoint({ ...SO_FAR, itemsSeen: undefined, earlierPageRepeats: undefined });
  for (const member of ["itemsSeen", "earlierPageRepeats", "conditions", "rejectedSamples", "rejectedSamplesAlone", "refusals"]) {
    assert.equal(member in checkpoint, false, member);
  }
  assert.equal(readCheckpoint({ ...SO_FAR, earlierPageRepeats: 0 }).earlierPageRepeats, 0);
});
