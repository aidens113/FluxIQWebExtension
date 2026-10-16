import assert from "node:assert/strict";
import test from "node:test";
import { playbackListRead } from "../index.js";

test("a read's counts and summary sentence, as the client's payload or under the dispatcher's wrapping", () => {
  const extraction = { recordCount: 3, pagesRead: 1, itemsSeen: 9, truncated: true, paginationStop: "a newer word", conditions: { kept: 3 } };
  const direct = playbackListRead({ extraction, extracted: [{ name: "row" }, {}, {}] });
  assert.deepEqual(direct?.read, { records: 3, pages: 1, itemsSeen: 9, emptyRecords: null, truncated: true, stop: "unknown", conditionsKept: 3, rowsReturned: 3 });
  assert.equal(direct?.said, "3 records over 1 pages (9 items seen, stopped on unknown, cut short by a cap); 3 rows returned");
  assert.deepEqual(playbackListRead({ result: { extraction } })?.read.rowsReturned, null);
});

test("a result with no extraction summary, or one without its counts, is no read", () => {
  for (const outcome of [undefined, {}, { extraction: { recordCount: 3 } }, { extraction: { recordCount: -1, pagesRead: 1 } }]) assert.equal(playbackListRead(outcome), undefined);
});
