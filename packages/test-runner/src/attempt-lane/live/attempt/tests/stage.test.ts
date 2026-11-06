import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../../failure.js";
import type { RunDatasetControl } from "../../../../flow-lane/index.js";
import type { AttemptResultRecord } from "../read.js";
import { readAttemptRows } from "../stage.js";

const result = (totalRows: number): AttemptResultRecord => ({
  attemptId: "attempt.one",
  kind: "rows",
  rows: { runId: "explore.one", datasetId: "apprentices", totalRows, truncated: false, columns: [{ id: "name", label: "Name" }] },
  acts: [],
});

function serving(rows: number): RunDatasetControl {
  return {
    automationStudioCall: async () => ({ dataset: { schema: { fields: [{ id: "name" }] }, rows: Array.from({ length: rows }, (_, at) => ({ name: `Row ${at % 4}` })), nextCursor: null } }),
  };
}

test("the rows the attempt's result names are read whole from its dataset", async () => {
  const read = await readAttemptRows(serving(4), "project.web", result(4));
  assert.equal(read?.extracted[0]?.records.length, 4);
});

// run-mw43h5ew-a04a583d: the 4 was the attempt's result's word, and the 28 the store's unprocessed rows. The failure says which said which.
test("a dataset that serves other than the attempt's result says is a failure that names the result as the count's source", async () => {
  await assert.rejects(readAttemptRows(serving(28), "project.web", result(4)), (error) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "runtime.behavior");
    assert.equal(error.message, "The attempt's result says its dataset holds 4 row(s), and Core's dataset served 28");
    assert.deepEqual(error.details, { storedRecords: 4, readRecords: 28, pages: 1, countFrom: "attempt_result", attemptId: "attempt.one", datasetId: "apprentices" });
    return true;
  });
});

test("an attempt with no rows reads none, and asks Core for nothing", async () => {
  const control: RunDatasetControl = { automationStudioCall: async () => assert.fail("no dataset should be read") };
  assert.equal(await readAttemptRows(control, "project.web", { attemptId: "attempt.one", kind: "done_on_site", acts: [] }), null);
});
