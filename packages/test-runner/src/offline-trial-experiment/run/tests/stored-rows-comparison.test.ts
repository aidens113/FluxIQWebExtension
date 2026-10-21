import assert from "node:assert/strict";
import test from "node:test";
import type { FlowRunDataset } from "../../../flow-lane/index.js";
import { compareStoredRows } from "../stored-rows-comparison.js";

function dataset(datasetId: string, records: Array<Record<string, string>>): FlowRunDataset {
  return { datasetId, nodeIds: ["read"], recordCount: records.length, storeTruncated: false, invalidCount: 0, records, nonStringValues: 0, pages: 1 } as unknown as FlowRunDataset;
}

test("the same rows in the same order compare equal", () => {
  const rows = [{ a: "1" }, { a: "2" }];
  assert.deepEqual(compareStoredRows([dataset("d", rows)], [dataset("d", structuredClone(rows))]), { liveDatasets: 1, offlineDatasets: 1, liveRows: 2, offlineRows: 2, equalPositions: 2, equal: true });
});

test("a missing, changed or reordered row is not equal, and only counts come back", () => {
  const live = [dataset("d", [{ a: "1" }, { a: "2" }])];
  assert.deepEqual(compareStoredRows(live, []), { liveDatasets: 1, offlineDatasets: 0, liveRows: 2, offlineRows: 0, equalPositions: 0, equal: false });
  const changed = compareStoredRows(live, [dataset("d", [{ a: "1" }, { a: "3" }])]);
  assert.deepEqual([changed.equalPositions, changed.equal], [1, false]);
  const reordered = compareStoredRows(live, [dataset("d", [{ a: "2" }, { a: "1" }])]);
  assert.deepEqual([reordered.equalPositions, reordered.equal], [0, false]);
  assert.ok(!JSON.stringify(changed).includes("\"a\""));
});

test("the same rows under another dataset are not equal", () => {
  assert.equal(compareStoredRows([dataset("d", [{ a: "1" }])], [dataset("e", [{ a: "1" }])]).equal, false);
});
