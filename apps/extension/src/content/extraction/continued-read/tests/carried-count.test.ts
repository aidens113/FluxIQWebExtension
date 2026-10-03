// T1 coverage of where a whole-read count starts in a document: zero for a read
// that began there, the predecessor's count for a continued one, and absence
// kept as absence rather than becoming a zero.

import assert from "node:assert/strict";
import test from "node:test";
import { carriedCount } from "../carried-count";

const HANDED = { records: [], pagesRead: 2, scrolls: 0, missingFields: [] };

test("a read that began in this document counts from zero", () => {
  assert.equal(carriedCount(undefined, "itemsSeen"), 0);
  assert.equal(carriedCount(undefined, "earlierPageRepeats"), 0);
});

test("a continued read counts from what its predecessor counted, zero included", () => {
  assert.equal(carriedCount({ ...HANDED, itemsSeen: 8, earlierPageRepeats: 3 }, "itemsSeen"), 8);
  assert.equal(carriedCount({ ...HANDED, itemsSeen: 8, earlierPageRepeats: 3 }, "earlierPageRepeats"), 3);
  assert.equal(carriedCount({ ...HANDED, earlierPageRepeats: 0 }, "earlierPageRepeats"), 0);
});

test("a continued read whose predecessor counted nothing has no beginning, so its count stays unknown", () => {
  assert.equal(carriedCount(HANDED, "itemsSeen"), undefined);
  assert.equal(carriedCount(HANDED, "earlierPageRepeats"), undefined);
});
