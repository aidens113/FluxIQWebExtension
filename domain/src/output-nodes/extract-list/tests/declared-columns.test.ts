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
  // One page, which is all a read now reads (read-list redesign S4).
  paginate: { next: "a.next", maxPages: 1 },
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
  // Core's parser does not take `process` until S1 lands; the capture copies rows by the schema alone.
  const { process: _process, ...bare } = recordOutputValue;
  const parsed = parseAutomationStudioRecordOutput(bare);
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
  // A one-page paginate is dropped, and the dedupe now runs over the run's
  // collection, from the record output's process (read-list redesign C3); a
  // minimum of zero stays on the page as well.
  assert.equal(Object.hasOwn(sent.extractList, "paginate"), false);
  assert.equal(Object.hasOwn(sent.extractList, "dedupe"), false);
  assert.deepEqual(sent.recordOutput.process, { dedupe: extractList.dedupe, minRows: 0 });
  assert.equal(sent.extractList.minItems, 0);
  // The narrowed read is one the dispatch's own reader reads back unchanged.
  assert.deepEqual(webAutomationExtractListRequestValue(sent.extractList), sent.extractList);
  // And Core's capture, which copies a row by the schema, stores the four.
  assert.deepEqual(storedColumns(sent.recordOutput, sixColumnRow), ["name", "price", "rating", "url"]);
});

// Read-list redesign C3: an ordering runs over the stored rows, so the column it
// orders by has to be stored. Until S4 the page ordered the rows and the helper
// was left out of the schema.
test("a helper an ordering names stays in the read, and is stored for the ordering to run over", () => {
  const sorted = { ...extractList, sort: [{ field: "plus", order: "desc" }] };
  const sent = dispatched({ extractList: sorted, recordOutput });
  assert.deepEqual(Object.keys(sent.extractList.fields), ["name", "price", "rating", "url", "plus"]);
  // `plus` is still a field, so its condition still names it; `ad` is not.
  assert.deepEqual(sent.extractList.where?.slice(0, 2), [
    { read: { kind: "text", selector: ".sponsored-label" }, is: "absent" },
    { field: "plus", is: "present" }
  ]);
  assert.deepEqual((sent.recordOutput.process as JsonObject).sort, [{ field: "plus", order: "desc" }]);
  assert.deepEqual(storedColumns(sent.recordOutput, sixColumnRow), ["name", "price", "rating", "url", "plus"]);
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
  // And the dispatch then sends the read as written, less what left the page
  // (read-list redesign C3), and asking for the rows it kept.
  const { paginate: _paginate, dedupe: _dedupe, ...onePage } = extractList;
  assert.deepEqual(dispatched({ extractList, recordOutput: null }).extractList, { ...onePage, answer: "kept" });
  // Since t489 a name the read does not take is matched to the column it means
  // before anything is narrowed (`../stored-columns.ts`): `link` is the url
  // column, under the author's name, so the schema is the read's own four and
  // the helpers leave the read as for any declared schema.
  const sent = dispatched({ extractList, recordOutput: renamed });
  assert.deepEqual(Object.keys(sent.extractList.fields), ["name", "price", "rating", "link"]);
  assert.deepEqual(sent.extractList.fields.link, extractList.fields.url);
  assert.deepEqual((sent.recordOutput.schema as { fields: { id: string }[] }).fields.map((field) => field.id), ["name", "price", "rating", "link"]);
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


test("actual dispatch keeps authored schema order before required ordering helpers and exclusions", () => {
  const extractList = {
    item: "li.entry",
    fields: {
      alpha: { kind: "text", selector: ".alpha", required: false },
      beta: { kind: "text", selector: ".beta" },
      gamma: { kind: "link", selector: "a.gamma" },
      delta: { kind: "text", selector: ".delta", required: false },
      epsilon: { kind: "text", selector: ".epsilon", handling: "exclude" }
    },
    where: [{ field: "delta", is: "present" }],
    sort: [{ field: "beta", order: "asc" }]
  };
  const recordOutput = { datasetId: "entries", label: "Entries", writeMode: "append", schema: { schemaVersion: "0.1", fields: [
    { id: "gamma", label: "Destination", valueType: "url", required: true },
    { id: "alpha", label: "Optional text", valueType: "string", required: false }
  ] } };
  const sent = dispatched({ extractList, recordOutput });
  assert.deepEqual((sent.recordOutput.schema as { fields: { id: string }[] }).fields.map((field) => field.id), ["gamma", "alpha", "beta", "epsilon"]);
  assert.deepEqual(Object.keys(sent.extractList.fields), ["alpha", "beta", "gamma", "epsilon"]);
  assert.deepEqual(sent.extractList.where, [{ read: { kind: "text", selector: ".delta" }, is: "present" }]);
  assert.deepEqual((sent.recordOutput.process as JsonObject).sort, [{ field: "beta", order: "asc" }]);
  const excluded = (sent.recordOutput.schema as { fields: { id: string; handling?: string }[] }).fields.find((field) => field.id === "epsilon");
  assert.equal(excluded?.handling, "exclude");
  assert.deepEqual(storedColumns(sent.recordOutput, { alpha: "a", beta: "b", gamma: "https://example.invalid/gamma", epsilon: "not retained" }), ["gamma", "alpha", "beta"]);
});

// t510 (F1): stored is not shown. A column an ordering or a `process` needs is
// stored, whatever the schema said of it, and `process.columns` -- the author's,
// or the declared columns written for them -- keeps it out of the answer.

/** A task list sorted by a due date the answer does not show: generic, not a Lab site. */
const tasks = {
  item: "li.task",
  fields: {
    title: { kind: "text", selector: ".title" },
    owner: { kind: "text", selector: ".owner" },
    status: { kind: "text", selector: ".status" },
    due: { kind: "text", selector: ".due", required: false },
    archived: { kind: "text", selector: ".archived-flag", required: false }
  },
  where: [{ field: "archived", is: "absent" }]
};
const taskSchema = (...ids: string[]) => ({ schemaVersion: "0.1", fields: ids.map((id) => ({ id, label: id, valueType: "string" })) });
const excludedTaskField = (id: string) => ({ id, label: id, valueType: "string", handling: "exclude" });

function schemaIds(recordOutputValue: JsonObject): Array<[string, string | null]> {
  return (recordOutputValue.schema as { fields: { id: string; handling?: string }[] }).fields.map((field) => [field.id, field.handling ?? null]);
}

test("t510: a schema of the declared columns and a process.sort on a helper stores the helper and shows only the declared columns", () => {
  const sent = dispatched({ extractList: tasks, recordOutput: { datasetId: "tasks", writeMode: "append", schema: taskSchema("title", "owner", "status"), process: { sort: [{ field: "due", order: "asc" }] } } });
  assert.deepEqual(Object.keys(sent.extractList.fields), ["title", "owner", "status", "due"]);
  assert.deepEqual(schemaIds(sent.recordOutput), [["title", null], ["owner", null], ["status", null], ["due", null]]);
  assert.deepEqual(sent.recordOutput.process, { sort: [{ field: "due", order: "asc" }], columns: ["title", "owner", "status"] });
  // `archived` was read only to filter by: it leaves the read and is read by its condition.
  assert.deepEqual(sent.extractList.where, [{ read: { kind: "text", selector: ".archived-flag" }, is: "absent" }]);
});

test("t510: a helper the schema marks exclude and process.sort names is stored as a helper, and the author's columns hide it", () => {
  const recordOutput = {
    datasetId: "tasks",
    writeMode: "append",
    schema: { schemaVersion: "0.1", fields: [...taskSchema("title", "owner", "status").fields, excludedTaskField("due"), excludedTaskField("archived")] },
    process: { sort: [{ field: "due", order: "desc" }], columns: ["title", "owner", "status"] }
  };
  const sent = dispatched({ extractList: tasks, recordOutput });
  assert.deepEqual(schemaIds(sent.recordOutput), [["title", null], ["owner", null], ["status", null], ["due", null]]);
  assert.deepEqual(sent.recordOutput.process, recordOutput.process);
  // `archived` was marked exclude and only a condition reads it: never stored.
  assert.deepEqual(Object.keys(sent.extractList.fields), ["title", "owner", "status", "due"]);
  assert.deepEqual(storedColumns(sent.recordOutput, { title: "t", owner: "o", status: "s", due: "d" }), ["title", "owner", "status", "due"]);
});

test("t510: a helper a process.dedupe or process.where names is stored; a where keeps it among the columns written", () => {
  const deduped = dispatched({ extractList: tasks, recordOutput: { datasetId: "tasks", writeMode: "append", schema: taskSchema("title", "owner"), process: { dedupe: { by: ["due"] } } } });
  assert.deepEqual(schemaIds(deduped.recordOutput).map(([id]) => id), ["title", "owner", "due"]);
  assert.deepEqual((deduped.recordOutput.process as JsonObject).columns, ["title", "owner"]);
  const filtered = dispatched({ extractList: tasks, recordOutput: { datasetId: "tasks", writeMode: "append", schema: taskSchema("title", "owner"), process: { where: [{ field: "status", contains: "open" }], sort: [{ field: "due", order: "asc" }] } } });
  assert.deepEqual(schemaIds(filtered.recordOutput).map(([id]) => id), ["title", "owner", "status", "due"]);
  // Core refuses a where over a column `columns` drops, so the where's column is shown.
  assert.deepEqual((filtered.recordOutput.process as JsonObject).columns, ["title", "owner", "status"]);
});

test("t510: a helper the read's own sort names is stored and not shown", () => {
  const sent = dispatched({ extractList: { ...tasks, sort: [{ field: "due", order: "asc" }] }, recordOutput: { datasetId: "tasks", writeMode: "append", schema: taskSchema("title", "owner", "status") } });
  assert.deepEqual(schemaIds(sent.recordOutput).map(([id]) => id), ["title", "owner", "status", "due"]);
  assert.deepEqual(sent.recordOutput.process, { sort: [{ field: "due", order: "asc" }], columns: ["title", "owner", "status"] });
});

/**
 * The auction run's read (`run-mv6qrbgx-06151cdb`, w1 auction debug), with
 * stand-in selectors: the ten columns the model named, and two of its conditions.
 */
const auctionRead = {
  item: "li.listing",
  fields: {
    title: { kind: "text", selector: ".title" },
    price: { kind: "text", selector: ".price" },
    bids: { kind: "text", selector: ".bids" },
    postage: { kind: "text", selector: ".postage" },
    condition: { kind: "text", selector: ".condition", required: false },
    ends: { kind: "text", selector: ".ends" },
    endsAt: { kind: "text", selector: ".ends-at", required: false },
    pounds: { kind: "text", selector: ".pounds", required: false },
    bin: { kind: "text", selector: ".bin", required: false },
    ad: { kind: "attribute", attribute: "data-adid", required: false }
  },
  where: [{ field: "ad", is: "absent" }, { field: "pounds", lessThan: 150 }],
  minItems: 0
};

/** Steps 0022 and 0024 of that run: every helper marked exclude, the sort on one of them, the answer's columns in process. */
function auctionRecordOutput(sortField: string): JsonObject {
  const kept = ["title", "price", "bids", "postage"].map((id) => ({ id, label: id, valueType: "string" }));
  const helpers = ["condition", "ends", "endsAt", "pounds", "bin", "ad"].map((id) => ({ id, label: id, valueType: "string", handling: "exclude" }));
  return {
    datasetId: "kestrel35auctions",
    writeMode: "replace",
    schema: { schemaVersion: "0.1", fields: [...kept, ...helpers] },
    process: { sort: [{ field: sortField, order: "asc" }], columns: ["title", "price", "bids", "postage"] }
  };
}

test("t510: the auction run's 0022 and 0024 record outputs are accepted, the sort key stored and hidden, the other helpers not stored", () => {
  for (const sortField of ["endsAt", "ends"]) {
    const sent = dispatched({ extractList: auctionRead, recordOutput: auctionRecordOutput(sortField) });
    assert.deepEqual(schemaIds(sent.recordOutput), [["title", null], ["price", null], ["bids", null], ["postage", null], [sortField, null]], sortField);
    assert.deepEqual(sent.recordOutput.process, { sort: [{ field: sortField, order: "asc" }], columns: ["title", "price", "bids", "postage"], minRows: 0 }, sortField);
    assert.deepEqual(Object.keys(sent.extractList.fields), ["title", "price", "bids", "postage", sortField], sortField);
    // The conditions over `ad` and `pounds` still run, each through its column's own spec.
    assert.deepEqual(sent.extractList.where, [
      { read: { kind: "attribute", attribute: "data-adid" }, is: "absent" },
      { read: { kind: "text", selector: ".pounds" }, lessThan: 150 }
    ], sortField);
    // What is stored is a record output Core's parser accepts as it is.
    assert.equal(parseAutomationStudioRecordOutput(sent.recordOutput).ok, true, sortField);
  }
});

test("t510: the record output the dispatch runs, dispatched again, runs unchanged", () => {
  const cases: Array<[JsonObject, JsonObject]> = [
    [auctionRead, auctionRecordOutput("endsAt")],
    [tasks, { datasetId: "tasks", writeMode: "append", schema: taskSchema("title", "owner"), process: { sort: [{ field: "due", order: "asc" }] } }]
  ];
  for (const [read, recordOutput] of cases) {
    const first = dispatched({ extractList: read, recordOutput });
    const again = dispatched({ extractList: read, recordOutput: first.recordOutput });
    assert.deepEqual(again.recordOutput, first.recordOutput);
    assert.deepEqual(again.extractList, first.extractList);
  }
});
