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
  assert.equal(report.contractRowsMatch, false, "raw equality alone is not schema-contract acceptance");
  assert.equal(report.expectedRecords, 2);
});

test("schema validation cannot replace primary exact equality or invent a valid empty read", () => {
  const result = compareRecordedReadRows({ actual: [{ title: "One", price: 2 }], expected: [{ title: "One", price: "2" }], currentDerivedSchema: { unsupported: true } });
  assert.equal(result.rowsMatch, false);
  assert.equal(result.currentSchema, "invalid");
  assert.equal(compareRecordedReadRows({ actual: [], expected: [] }).rowsMatch, false);
});

test("current validation may normalize optional cells, but cannot turn changed raw rows into parity", () => {
  const schema = { schemaVersion: "0.1", fields: ["title", "price", "note"].map(id => ({ id, label: id, valueType: "string", required: false })) };
  const comparison = compareRecordedReadRows({ actual: [{ title: "Synthetic", price: 2, note: null }], expected: [{ title: "Synthetic", price: "2", note: null }], currentDerivedSchema: schema });
  assert.equal(comparison.currentSchema, "valid");
  assert.equal(comparison.rowsMatch, false);
  assert.equal(comparison.contractRowsMatch, false);
  assert.equal(compareRecordedReadRows({ actual: [{ title: "Synthetic", price: "2", note: null }], expected: [{ title: "Synthetic", price: "2", note: null }], currentDerivedSchema: schema }).contractRowsMatch, true);
});
