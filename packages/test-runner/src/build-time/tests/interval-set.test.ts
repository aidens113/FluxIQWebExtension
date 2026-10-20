import assert from "node:assert/strict";
import test from "node:test";
import { IntervalSet } from "../index.js";

test("of merges overlapping and touching intervals and drops empty ones", () => {
  const set = IntervalSet.of([{ start: 5, end: 8 }, { start: 0, end: 2 }, { start: 2, end: 3 }, { start: 6, end: 10 }, { start: 4, end: 4 }, { start: 9, end: 1 }]);
  assert.deepEqual(set.spans, [{ start: 0, end: 3 }, { start: 5, end: 10 }]);
  assert.equal(set.totalMs, 8);
});

test("a nested interval adds nothing to the union", () => {
  assert.equal(IntervalSet.of([{ start: 0, end: 100 }, { start: 20, end: 30 }]).totalMs, 100);
});

test("intersect and subtract partition a set", () => {
  const a = IntervalSet.of([{ start: 0, end: 10 }, { start: 20, end: 30 }]);
  const b = IntervalSet.of([{ start: 5, end: 25 }]);
  assert.deepEqual(a.intersect(b).spans, [{ start: 5, end: 10 }, { start: 20, end: 25 }]);
  assert.deepEqual(a.subtract(b).spans, [{ start: 0, end: 5 }, { start: 25, end: 30 }]);
  assert.equal(a.intersect(b).totalMs + a.subtract(b).totalMs, a.totalMs);
  assert.equal(a.union(b).totalMs, 30);
  assert.equal(IntervalSet.empty.subtract(a).totalMs, 0);
});
