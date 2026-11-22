import assert from "node:assert/strict";
import test from "node:test";
import { compareRecordedReadRows } from "../compare.js";

const rows = [{ title: "One", price: "2", note: null }, { title: "Two", price: "3", note: null }];

test("ordered original rows match without supplying omitted nulls, missing fields or detector samples", () => {
  assert.equal(compareRecordedReadRows({ actual: structuredClone(rows), expected: rows }).rowsMatch, true);
  for (const actual of [[rows[1], rows[0]], [{ title: "One", price: "2" }, rows[1]], [{ ...rows[0], extra: "sample" }, rows[1]], [{ ...rows[0], price: 2 }, rows[1]]]) {
    assert.equal(compareRecordedReadRows({ actual, expected: rows }).rowsMatch, false);
  }
  const report = compareRecordedReadRows({ actual: rows, expected: rows });
  assert.deepEqual(report.expectedFieldCounts, [3]);
  assert.equal(report.currentSchema, "unavailable");
  assert.equal(report.expectedRecords, 2);
});

test("schema validation cannot replace primary exact equality or invent a valid empty read", () => {
  const result = compareRecordedReadRows({ actual: [{ title: "One", price: 2 }], expected: [{ title: "One", price: "2" }], currentDerivedSchema: { unsupported: true } });
  assert.equal(result.rowsMatch, false);
  assert.equal(result.currentSchema, "invalid");
  assert.equal(compareRecordedReadRows({ actual: [], expected: [] }).rowsMatch, false);
});
