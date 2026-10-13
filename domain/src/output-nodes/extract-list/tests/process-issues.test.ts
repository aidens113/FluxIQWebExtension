// A record output the dispatch refuses says, for each issue, the field it
// refused and the names it can use instead (t510, F4 and F5): the one shape
// t489 gave a column the read does not read, now for every refusal Core's
// parser gives about a field or a sort key.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationExtractListDispatch } from "../dispatch";
import { webAutomationRecordOutputIssues } from "../process-issues";

/** A generic read: a task list, one of whose columns the field map itself never stores (D12). */
const tasks = {
  item: "li.task",
  fields: {
    title: { kind: "text", selector: ".title" },
    owner: { kind: "text", selector: ".owner" },
    due: { kind: "text", selector: ".due", required: false },
    note: { kind: "text", selector: ".private-note", handling: "exclude" }
  }
};
const schema = { schemaVersion: "0.1", fields: ["title", "owner", "due"].map((id) => ({ id, label: id, valueType: "string" })) };

function refusedIssues(recordOutput: JsonObject): JsonObject[] {
  const dispatch = webAutomationExtractListDispatch({ extractList: tasks, recordOutput });
  assert.equal(dispatch.ok, false, JSON.stringify(dispatch));
  if (dispatch.ok) throw new Error("unreachable");
  return (dispatch.result.outputs?.error as JsonObject).issues as JsonObject[];
}

test("a process naming a column the field map excludes names it, and the stored columns", () => {
  const issues = refusedIssues({ datasetId: "tasks", writeMode: "append", process: { sort: [{ field: "note", order: "asc" }] } });
  assert.deepEqual(issues, [{ code: "record_output.process_excluded_field", field: "note", valid: ["title", "owner", "due"] }]);
});

test("process_invalid_sort names the stray key and the keys a sort key takes, and the order it lacks", () => {
  // The auction run's 0020: `direction` written where a sort key takes `order`.
  const issues = refusedIssues({ datasetId: "tasks", writeMode: "append", schema, process: { sort: [{ field: "due", direction: "asc" }] } });
  assert.deepEqual(issues, [
    { code: "record_output.process_invalid_sort", field: "direction", valid: ["field", "order", "as"] },
    { code: "record_output.process_invalid_sort", field: "order", valid: ["asc", "desc"] }
  ]);
});

test("process_invalid_sort names a wrong order or comparison and the values it takes", () => {
  assert.deepEqual(refusedIssues({ datasetId: "tasks", writeMode: "append", schema, process: { sort: [{ field: "due", order: "ascending" }] } }), [
    { code: "record_output.process_invalid_sort", field: "order", valid: ["asc", "desc"] }
  ]);
  assert.deepEqual(refusedIssues({ datasetId: "tasks", writeMode: "append", schema, process: { sort: [{ field: "due", order: "asc", as: "money" }] } }), [
    { code: "record_output.process_invalid_sort", field: "as", valid: ["auto", "number", "date", "text"] }
  ]);
  assert.deepEqual(refusedIssues({ datasetId: "tasks", writeMode: "append", schema, process: { sort: [{ order: "asc" }] } }), [
    { code: "record_output.process_invalid_sort", field: "field", valid: ["title", "owner", "due"] }
  ]);
});

test("a field issue names each field once, with the stored ids; a where a column list drops names the columns kept", () => {
  const output: JsonObject = {
    schema: { schemaVersion: "0.1", fields: [{ id: "title" }, { id: "owner" }, { id: "secret", handling: "exclude" }] },
    process: { columns: ["title"], where: [{ field: "owner", is: "present" }], sort: [{ field: "missing", order: "asc" }, { field: "secret", order: "asc" }], dedupe: { by: ["missing"] } }
  };
  const codes = ["record_output.process_unknown_field", "record_output.process_excluded_field", "record_output.process_where_column_dropped", "record_output.invalid_dataset_id"];
  assert.deepEqual(webAutomationRecordOutputIssues(codes, output), [
    { code: "record_output.process_unknown_field", field: "missing", valid: ["title", "owner"] },
    { code: "record_output.process_excluded_field", field: "secret", valid: ["title", "owner"] },
    { code: "record_output.process_where_column_dropped", field: "owner", valid: ["title"] },
    { code: "record_output.invalid_dataset_id" }
  ]);
});

test("a code about a field the value does not show is still said, as its code alone", () => {
  assert.deepEqual(webAutomationRecordOutputIssues(["record_output.process_invalid_sort", "record_output.process_unknown_field"], "not an object"), [
    { code: "record_output.process_invalid_sort" },
    { code: "record_output.process_unknown_field" }
  ]);
});
