// A declared record schema decides which columns are stored, and nothing about
// which items are read.
//
// The first case is live run 11's read (`debugs/run-muq66ff9-cb3767a1.md`,
// cause 8): six fields, two of them -- `plus` and `ad` -- kept only to filter
// by, under the model's own four-column record output. The domain rebuilt the
// schema from the field map and stored all six, and the Lab paired no row.

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioRecordOutput, validateAutomationStudioRecords } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { webAutomationExtractListRequestValue, type WebAutomationExtractListRequest } from "../../../actions/extraction";
import { webAutomationDeclaredColumnsRead } from "../declared-columns";
import { webAutomationExtractListDispatch } from "../dispatch";
import { webAutomationRecordOutput } from "../record-output";

const plus = { kind: "attribute", selector: "[data-plus]", attribute: "data-plus", required: false } as const;
const ad = { kind: "text", selector: ".sponsored-label", required: false } as const;

/** Run 11's read, in synthetic selectors. */
const extractList = {
  item: '[data-component="search-result"]',
  fields: {
    name: { kind: "text", selector: "h2 span" },
    price: { kind: "text", selector: ".price" },
    rating: { kind: "text", selector: ".rating" },
    url: { kind: "link", selector: "h2 a" },
    plus,
    ad
  },
  where: [
    { field: "ad", is: "absent" },
    { field: "plus", is: "present" },
    { field: "rating", atLeast: 4 },
    { field: "price", lessThan: 50 },
    { field: "name", contains: ["ear tips", "charging case"], not: true }
  ],
  paginate: { next: "a.next", maxPages: 5 },
  dedupe: { by: ["url"] },
  minItems: 0
};

/** The model's own record output: the four columns the instruction asked for. */
const recordOutput = {
  datasetId: "plus_earbuds",
  label: "Plus earbuds",
  writeMode: "append",
  schema: {
    schemaVersion: "0.1",
    fields: [
      { id: "name", label: "Name", valueType: "string", required: true },
      { id: "price", label: "Price", valueType: "number", required: true },
      { id: "rating", label: "Rating", valueType: "number", required: true },
      { id: "url", label: "URL", valueType: "url", required: true }
    ]
  }
};

/** A row as a page that read every field would hand it back. */
const sixColumnRow = { name: "synthetic-earbuds", price: "$39.99", rating: "4.4", url: "https://store.example/dp/SYNTH1", plus: "true", ad: null };

function dispatched(parameters: JsonObject): { extractList: WebAutomationExtractListRequest; recordOutput: JsonObject } {
  const dispatch = webAutomationExtractListDispatch(parameters);
  assert.equal(dispatch.ok, true, JSON.stringify(dispatch));
  if (!dispatch.ok) throw new Error("unreachable");
  const sent = dispatch.payload.parameters as JsonObject;
  return { extractList: sent.extractList as unknown as WebAutomationExtractListRequest, recordOutput: dispatch.payload.recordOutput as JsonObject };
}

function storedColumns(recordOutputValue: JsonObject, row: JsonObject): string[] {
  const parsed = parseAutomationStudioRecordOutput(recordOutputValue);
  assert.equal(parsed.ok, true, JSON.stringify(parsed));
  if (!parsed.ok) throw new Error("unreachable");
  const validated = validateAutomationStudioRecords([row], parsed.output.schema, { maxRecords: parsed.output.maxRecords });
  assert.equal(validated.invalidCount, 0, JSON.stringify(validated));
  return Object.keys(validated.rows[0]!);
}

test("run 11: the read and the schema keep only the four declared columns, and every condition still runs", () => {
  const sent = dispatched({ extractList, recordOutput });
  assert.deepEqual(Object.keys(sent.extractList.fields), ["name", "price", "rating", "url"]);
  assert.deepEqual(
    (sent.recordOutput.schema as { fields: { id: string }[] }).fields.map((field) => field.id),
    ["name", "price", "rating", "url"]
  );
  // The helpers are read by their conditions, through their own specs; the
  // declared columns' conditions are untouched, and so is the order.
  assert.deepEqual(sent.extractList.where, [
    { read: { kind: "text", selector: ".sponsored-label" }, is: "absent" },
    { read: { kind: "attribute", selector: "[data-plus]", attribute: "data-plus" }, is: "present" },
    { field: "rating", atLeast: 4 },
    { field: "price", lessThan: 50 },
    { field: "name", contains: ["ear tips", "charging case"], not: true }
  ]);
  assert.deepEqual(sent.extractList.paginate, extractList.paginate);
  assert.deepEqual(sent.extractList.dedupe, extractList.dedupe);
  assert.equal(sent.extractList.minItems, 0);
  // The narrowed read is one the dispatch's own reader reads back unchanged.
  assert.deepEqual(webAutomationExtractListRequestValue(sent.extractList), sent.extractList);
  // And Core's capture, which copies a row by the schema, stores the four.
  assert.deepEqual(storedColumns(sent.recordOutput, sixColumnRow), ["name", "price", "rating", "url"]);
});

test("a helper an ordering names stays in the read and is left out of what is stored", () => {
  const sorted = { ...extractList, sort: [{ field: "plus", order: "desc" }] };
  const sent = dispatched({ extractList: sorted, recordOutput });
  assert.deepEqual(Object.keys(sent.extractList.fields), ["name", "price", "rating", "url", "plus"]);
  // `plus` is still a field, so its condition still names it; `ad` is not.
  assert.deepEqual(sent.extractList.where?.slice(0, 2), [
    { read: { kind: "text", selector: ".sponsored-label" }, is: "absent" },
    { field: "plus", is: "present" }
  ]);
  assert.deepEqual(storedColumns(sent.recordOutput, sixColumnRow), ["name", "price", "rating", "url"]);
});

test("a helper no condition reads leaves the read and the schema too", () => {
  const unread = { ...extractList, where: extractList.where.slice(2) };
  const sent = dispatched({ extractList: unread, recordOutput });
  assert.deepEqual(Object.keys(sent.extractList.fields), ["name", "price", "rating", "url"]);
  assert.deepEqual(storedColumns(sent.recordOutput, sixColumnRow), ["name", "price", "rating", "url"]);
});

test("no declared schema, a schema naming a column the read does not take, or one naming no column narrows nothing", () => {
  const request = webAutomationExtractListRequestValue(extractList)!;
  const renamed = { ...recordOutput, schema: { schemaVersion: "0.1", fields: [...recordOutput.schema.fields.slice(0, 3), { id: "link", label: "Link", valueType: "url", required: true }] } };
  for (const authored of [undefined, null, "not an object", { ...recordOutput, schema: undefined }, { ...recordOutput, schema: { schemaVersion: "0.1", fields: [] } }, renamed]) {
    assert.equal(webAutomationDeclaredColumnsRead(authored as never, request), undefined, JSON.stringify(authored));
  }
  // And the dispatch then sends the read exactly as written.
  for (const authored of [null, renamed]) {
    assert.deepEqual(dispatched({ extractList, recordOutput: authored as never }).extractList, extractList);
  }
});

test("a recording's own record output, which declares every field, narrows nothing", () => {
  const request = webAutomationExtractListRequestValue(extractList)!;
  const fromRecording = webAutomationRecordOutput({ datasetId: "user.dataset", label: "Results", request, fieldLabels: {} });
  assert.equal(webAutomationDeclaredColumnsRead(fromRecording as never, request), undefined);
});

test("an excluded column is not a helper: it stays in the read and the schema, as the user's exclusion", () => {
  const withExcluded = { ...extractList, fields: { ...extractList.fields, secret: { kind: "text", selector: ".secret", handling: "exclude" } } };
  const sent = dispatched({ extractList: withExcluded, recordOutput });
  assert.deepEqual(Object.keys(sent.extractList.fields), ["name", "price", "rating", "url", "secret"]);
  const schemaFields = (sent.recordOutput.schema as { fields: { id: string; handling?: string }[] }).fields;
  assert.deepEqual(schemaFields.map((field) => [field.id, field.handling ?? null]), [
    ["name", null], ["price", null], ["rating", null], ["url", null], ["secret", "exclude"]
  ]);
});
