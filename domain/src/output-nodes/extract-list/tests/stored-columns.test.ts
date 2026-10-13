// A record output's names for its read's columns, decided once (t489).
//
// The case these rows exist for is lane D round 13 (`run-mv66sc3c-c47e74b8`):
// a detected read of friend requests whose columns are the detector's keys,
// and a record output naming its own columns `name` and `mutualFriends`. Submit
// passed it and the dispatch stored the detector's keys, so the record output's
// `process` named fields nothing stored and every trial failed on its last
// step. `webAutomationStoredColumns` is the one reading both now make.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebAutomationExtractListRequest } from "../../../actions/extraction";
import { webAutomationExtractListDispatch } from "../dispatch";
import { webAutomationStoredColumns } from "../stored-columns";

/** The detector's keys for `extraction.4` of run mv66sc3c (step 0032), with synthetic selectors in the same shape. */
const PROFILE_URL = "a_x1cf2e2r_xu37y6r_xvzo2ll_url";
const NAME = "div_x0531l50_x1r2vv8_x4q0id2_a_x0ybvghy_x130pqy_x1yfagd";
const NAME_URL = "div_x0531l50_x1r2vv8_x4q0id2_a_x0ybvghy_x130pqy_x1yfagd_url";
const MUTUAL = "div_x0531l50_x1r2vv8_x4q0id2_div_x1a4yqcp_xa73opb_xtlve1b";
const AGE = "div_x0531l50_x1r2vv8_x4q0id2_span_x0gwrdxv_x1ksheh_x4q0id2";
const CONFIRM = "div_x0531l50_x1r2vv8_x4q0id2_div_x1507i5_x1mgzeci_xu37y6r";
const DELETE = "div_x0531l50_x1r2vv8_x4q0id2_div_x07beeli_x1ksheh_x4q0id2";

const CARD = "div.x0531l50.x1r2vv8.x4q0id2";
const requests: WebAutomationExtractListRequest = {
  item: "div.x1n2onr6 > div.x9f619",
  fields: {
    [PROFILE_URL]: { kind: "link", selector: "a.x1cf2e2r.xu37y6r.xvzo2ll", required: false },
    [NAME]: { kind: "text", selector: `${CARD} > a.x0ybvghy.x130pqy.x1yfagd`, required: false },
    [NAME_URL]: { kind: "link", selector: `${CARD} > a.x0ybvghy.x130pqy.x1yfagd`, required: false },
    [MUTUAL]: { kind: "text", selector: `${CARD} > div.x1a4yqcp.xa73opb.xtlve1b`, required: false },
    [AGE]: { kind: "text", selector: `${CARD} > span.x0gwrdxv.x1ksheh.x4q0id2`, required: false },
    [CONFIRM]: { kind: "text", selector: `${CARD} > div.x1507i5.x1mgzeci.xu37y6r`, required: false },
    [DELETE]: { kind: "text", selector: `${CARD} > div.x07beeli.x1ksheh.x4q0id2`, required: false }
  },
  minItems: 0
};

/** Revision 4's record output, verbatim (step 0038). */
const revision4 = {
  datasetId: "acceptedRequests",
  writeMode: "replace",
  schema: { schemaVersion: "0.1", fields: [{ id: "name", label: "Name", valueType: "string" }, { id: "mutualFriends", label: "Mutual friends", valueType: "string" }] },
  process: { columns: ["name", "mutualFriends"] }
};

test("run mv66sc3c's record output over its detected read: `name` is the name column, `mutualFriends` names none, and the read's columns are listed", () => {
  const stored = webAutomationStoredColumns(revision4, requests);
  assert.equal(stored.ok, false);
  if (stored.ok) return;
  assert.deepEqual(stored.unread, [{ written: "mutualFriends", path: ["schema", "fields", 1, "id"] }]);
  assert.deepEqual(stored.columns, Object.keys(requests.fields));
});

test("the dispatch refuses that record output before the page is read, saying the names and the read's columns", () => {
  const dispatch = webAutomationExtractListDispatch({ extractList: requests as unknown as JsonObject, recordOutput: revision4 });
  assert.equal(dispatch.ok, false);
  if (dispatch.ok) return;
  assert.equal(dispatch.result.failure?.code, "record_output.invalid");
  assert.equal(dispatch.result.failure?.retryable, false);
  assert.deepEqual(dispatch.result.effects, []);
  // One issue per unread name, in the one shape Core's trial feedback reads: the name, and the read's keys it can use.
  const issues = (dispatch.result.outputs?.error as JsonObject).issues as JsonObject[];
  assert.deepEqual(issues, [{ code: "record_output.column_not_read", field: "mutualFriends", valid: Object.keys(requests.fields) }]);
  // Names and keys only: each passes Core's identifier check (`service/candidate-trial/step-issues.ts`), so none is page text.
  for (const name of [issues[0]!.field, ...(issues[0]!.valid as string[])]) assert.match(name as string, /^[A-Za-z0-9_.:-]{1,120}$/u);
  assert.match(dispatch.result.failure?.actual ?? "", /mutualFriends/u);
  for (const key of Object.keys(requests.fields)) assert.ok(dispatch.result.failure?.expected?.includes(key), key);
});

test("a name matching a column renames it in the read, everywhere the read names it, and the dispatch stores the author's names", () => {
  const where = [{ field: MUTUAL, contains: "mutual" }];
  const read: WebAutomationExtractListRequest = { ...requests, where, sort: [{ field: NAME, order: "asc" }], dedupe: { by: [NAME] } };
  const authored = { ...revision4, schema: { schemaVersion: "0.1", fields: [{ id: "name", label: "Name", valueType: "string" }, { id: MUTUAL, label: "Mutual friends", valueType: "string" }] }, process: { columns: ["name", MUTUAL] } };
  const stored = webAutomationStoredColumns(authored, read);
  assert.equal(stored.ok, true, JSON.stringify(stored));
  if (!stored.ok) return;
  assert.equal(stored.renamed, true);
  assert.deepEqual(stored.assumed.map((entry) => [entry.written, entry.field]), [["name", NAME]]);
  assert.deepEqual(Object.keys(stored.request.fields), [PROFILE_URL, "name", NAME_URL, MUTUAL, AGE, CONFIRM, DELETE]);
  assert.deepEqual(stored.request.fields.name, requests.fields[NAME]);
  assert.deepEqual(stored.request.sort, [{ field: "name", order: "asc" }]);
  assert.deepEqual(stored.request.dedupe, { by: ["name"] });
  assert.deepEqual(stored.request.where, where);

  const dispatch = webAutomationExtractListDispatch({ extractList: read as unknown as JsonObject, recordOutput: authored });
  assert.equal(dispatch.ok, true, JSON.stringify(dispatch));
  if (!dispatch.ok) return;
  const schema = (dispatch.payload.recordOutput as { schema: { fields: { id: string }[] } }).schema;
  assert.deepEqual(schema.fields.map((field) => field.id), ["name", MUTUAL]);
  const sent = (dispatch.payload.parameters as { extractList: WebAutomationExtractListRequest }).extractList;
  assert.deepEqual(Object.keys(sent.fields), ["name", MUTUAL]);
});

test("the read's own names, the detector's keys, and no record output leave the read exactly as it is", () => {
  const keyed = { ...revision4, schema: { schemaVersion: "0.1", fields: [{ id: NAME, label: "Name", valueType: "string" }, { id: MUTUAL, label: "Mutual friends", valueType: "string" }] }, process: { columns: [NAME, MUTUAL] } };
  const outputs: Array<JsonValue | undefined> = [undefined, null, "not an object", {}, keyed];
  for (const recordOutput of outputs) {
    const stored = webAutomationStoredColumns(recordOutput, requests);
    assert.deepEqual(stored, { ok: true, request: requests, renamed: false, assumed: [] }, JSON.stringify(recordOutput));
  }
});

test("a name only a process writes is also Core's own process_unknown_field, beside column_not_read", () => {
  const dispatch = webAutomationExtractListDispatch({ extractList: requests as unknown as JsonObject, recordOutput: { datasetId: "d", process: { sort: [{ field: "status", order: "asc" }] } } });
  assert.equal(dispatch.ok, false);
  if (dispatch.ok) return;
  assert.deepEqual((dispatch.result.outputs?.error as JsonObject).issues, [
    { code: "record_output.column_not_read", field: "status", valid: Object.keys(requests.fields) },
    { code: "record_output.process_unknown_field", field: "status", valid: Object.keys(requests.fields) }
  ]);
});

test("every place a record output names a column is read: process columns, where, sort and dedupe", () => {
  for (const process of [{ columns: ["status"] }, { where: [{ field: "status", contains: "x" }] }, { sort: [{ field: "status", order: "asc" }] }, { dedupe: { by: ["status"] } }]) {
    const stored = webAutomationStoredColumns({ datasetId: "d", process }, requests);
    assert.equal(stored.ok, false, JSON.stringify(process));
    if (!stored.ok) assert.deepEqual(stored.unread.map((name) => [name.written, name.path[0]]), [["status", "process"]]);
  }
});

test("a name that could not be a field key is refused rather than stored under a key it is not", () => {
  const stored = webAutomationStoredColumns({ datasetId: "d", schema: { schemaVersion: "0.1", fields: [{ id: "full name", label: "Name", valueType: "string" }] } }, requests);
  assert.equal(stored.ok, false);
});

test("a strict reading is taken before a guess, and a guess never takes a column a name named exactly", () => {
  const read: WebAutomationExtractListRequest = { item: "li", fields: { productName: { kind: "text", selector: "h2" }, price: { kind: "text", selector: ".price" } } };
  // `ProductName` is `productName` in another case; `name` would otherwise have guessed it.
  const stored = webAutomationStoredColumns({ datasetId: "d", process: { columns: ["name", "ProductName", "price"] } }, read);
  assert.equal(stored.ok, false, "name finds no column once ProductName took its own");
  const alone = webAutomationStoredColumns({ datasetId: "d", process: { columns: ["ProductName", "price"] } }, read);
  assert.equal(alone.ok, true);
  if (alone.ok) assert.deepEqual(Object.keys(alone.request.fields), ["ProductName", "price"]);
});
