// T1 coverage of the condition counts a continued read starts from.

import assert from "node:assert/strict";
import test from "node:test";
import { carriedConditionCounts } from "../carried-condition-counts";

const HANDED = { records: [], pagesRead: 1, scrolls: 0, missingFields: [] };

test("a read that began here, or was handed no counts, starts every condition from nothing", () => {
  const fresh = { applied: 0, kept: 0, rejected: [0, 0], seen: [null, null], alone: [0, 0] };
  assert.deepEqual(carriedConditionCounts(undefined, 2), fresh);
  assert.deepEqual(carriedConditionCounts(HANDED, 2), fresh);
});

test("a continued read starts from its predecessor's counts, copied", () => {
  const conditions = { applied: 5, kept: 2, rejected: [3, 1], seen: ["$10", null], alone: [2, 0] };
  const carried = carriedConditionCounts({ ...HANDED, conditions }, 2);
  assert.deepEqual(carried, conditions);
  assert.notEqual(carried.rejected, conditions.rejected);
  assert.notEqual(carried.seen, conditions.seen);
  assert.notEqual(carried.alone, conditions.alone);
});

test("counts that do not fit the request's conditions are not added to, and missing per-condition values start from none", () => {
  assert.deepEqual(carriedConditionCounts({ ...HANDED, conditions: { applied: 9, kept: 9, rejected: [0] } }, 2), { applied: 0, kept: 0, rejected: [0, 0], seen: [null, null], alone: [0, 0] });
  assert.deepEqual(carriedConditionCounts({ ...HANDED, conditions: { applied: 4, kept: 1, rejected: [3] } }, 1), { applied: 4, kept: 1, rejected: [3], seen: [null], alone: [0] });
});
