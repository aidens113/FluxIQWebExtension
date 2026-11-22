// A declared record schema decides which columns the answer shows, and nothing
// about which items are read. A column a condition, an ordering or the authored
// `process` reads is stored and hidden (t975, F3); every other safe field also stays.
//
// The first case is live run 11's read (`debugs/run-muq66ff9-cb3767a1.md`,
// cause 8): six fields, two of them -- `plus` and `ad` -- kept only to filter
// by, under the model's own four-column record output. The answer showed all
// six, and the Lab paired no row. Since t975 the six are stored and the answer
// shows the four, so the judge and every replay still carry what the rows were
// kept for (run `run-mwounh32-24f9bc6b`: its judges could not verify "zero
// mutual friends" from the saved read's rows).

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioRecordOutput, validateAutomationStudioRecords } from "fluxiq/automation";
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
  // The capture copies rows by the schema alone; `process` shapes only the answer.
  const { process: _process, ...bare } = recordOutputValue;
  const parsed = parseAutomationStudioRecordOutput(bare);
  assert.equal(parsed.ok, true, JSON.stringify(parsed));
  if (!parsed.ok) throw new Error("unreachable");
  const validated = validateAutomationStudioRecords([row], parsed.output.schema, { maxRecords: parsed.output.maxRecords });
  assert.equal(validated.invalidCount, 0, JSON.stringify(validated));
  return Object.keys(validated.rows[0]!);
}

function schemaIds(recordOutputValue: JsonObject): Array<[string, string | null]> {
  return (recordOutputValue.schema as { fields: { id: string; handling?: string }[] }).fields.map((field) => [field.id, field.handling ?? null]);
}

test("run 11: every column is stored and every condition runs by key, and the answer shows only the four declared columns", () => {
  const sent = dispatched({ extractList, recordOutput });
  assert.deepEqual(Object.keys(sent.extractList.fields), ["name", "price", "rating", "url", "plus", "ad"]);
  assert.deepEqual(schemaIds(sent.recordOutput).map(([id]) => id), ["name", "price", "rating", "url", "plus", "ad"]);
  // The conditions are the author's, untouched, in order.
  assert.deepEqual(sent.extractList.where, extractList.where);
  // A one-page paginate is dropped, and the dedupe now runs over the run's
  // collection, from the record output's process (read-list redesign C3); a
  // minimum of zero stays on the page as well. The answer shows the declared four.
  assert.equal(Object.hasOwn(sent.extractList, "paginate"), false);
  assert.equal(Object.hasOwn(sent.extractList, "dedupe"), false);
  assert.deepEqual(sent.recordOutput.process, { dedupe: extractList.dedupe, minRows: 0, columns: ["name", "price", "rating", "url"] });
  assert.equal(sent.extractList.minItems, 0);
  // The read is one the dispatch's own reader reads back unchanged.
  assert.deepEqual(webAutomationExtractListRequestValue(sent.extractList), sent.extractList);
  // Core's capture, which copies a row by the schema, stores the helpers the page read (an absent `ad` is no key).
  assert.deepEqual(storedColumns(sent.recordOutput, sixColumnRow), ["name", "price", "rating", "url", "plus"]);
});

test("t975: a hidden column is read as optional, so a row the conditions keep never fails for lacking it", () => {
  const required = { ...extractList, fields: { ...extractList.fields, ad: { kind: "text", selector: ".sponsored-label" } } };
  const sent = dispatched({ extractList: required, recordOutput });
  assert.deepEqual(sent.extractList.fields.ad, { kind: "text", selector: ".sponsored-label", required: false });
  // A declared column keeps what its author said of it.
  assert.deepEqual(sent.extractList.fields.name, extractList.fields.name);
  const stored = (sent.recordOutput.schema as { fields: { id: string; required?: boolean }[] }).fields;
  assert.equal(stored.find((field) => field.id === "ad")?.required, false);
  assert.deepEqual(storedColumns(sent.recordOutput, { ...sixColumnRow, ad: null }), ["name", "price", "rating", "url", "plus"]);
});

// Read-list redesign C3: an ordering runs over the stored rows, so the column it
// orders by has to be stored, and it is, with every other helper.
test("a helper an ordering names is stored and not shown", () => {
  const sorted = { ...extractList, sort: [{ field: "plus", order: "desc" }] };
  const sent = dispatched({ extractList: sorted, recordOutput });
  assert.deepEqual(Object.keys(sent.extractList.fields), ["name", "price", "rating", "url", "plus", "ad"]);
  assert.deepEqual(sent.extractList.where?.slice(0, 2), [{ field: "ad", is: "absent" }, { field: "plus", is: "present" }]);
  assert.deepEqual((sent.recordOutput.process as JsonObject).sort, [{ field: "plus", order: "desc" }]);
  assert.deepEqual((sent.recordOutput.process as JsonObject).columns, ["name", "price", "rating", "url"]);
});

test("a helper no current operation reads remains available in storage and hidden from the requested view", () => {
  const unread = { ...extractList, where: extractList.where.slice(2) };
  const sent = dispatched({ extractList: unread, recordOutput });
  assert.deepEqual(Object.keys(sent.extractList.fields), ["name", "price", "rating", "url", "plus", "ad"]);
  assert.deepEqual(storedColumns(sent.recordOutput, sixColumnRow), ["name", "price", "rating", "url", "plus"]);
  assert.ok(schemaIds(sent.recordOutput).some(([id]) => id === "ad"), "an absent optional value does not erase its retained field");
  assert.deepEqual(sent.recordOutput.process, { dedupe: extractList.dedupe, minRows: 0, columns: ["name", "price", "rating", "url"] });
  const dispatch = webAutomationExtractListDispatch({ extractList: unread, recordOutput });
  assert.deepEqual(dispatch.ok ? dispatch.droppedColumns ?? [] : undefined, []);
});

test("no declared schema, a schema naming a column the read does not take, or one naming no column hides nothing", () => {
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
  // before anything is hidden (`../stored-columns.ts`): `link` is the url
  // column, under the author's name, so the declared columns are the read's own
  // four and the helpers are stored hidden as for any declared schema.
  const sent = dispatched({ extractList, recordOutput: renamed });
  assert.deepEqual(Object.keys(sent.extractList.fields), ["name", "price", "rating", "link", "plus", "ad"]);
  assert.deepEqual(sent.extractList.fields.link, extractList.fields.url);
  assert.deepEqual(schemaIds(sent.recordOutput).map(([id]) => id), ["name", "price", "rating", "link", "plus", "ad"]);
  assert.deepEqual((sent.recordOutput.process as JsonObject).columns, ["name", "price", "rating", "link"]);
});

test("a recording's own record output, which declares every field, hides nothing", () => {
  const request = webAutomationExtractListRequestValue(extractList)!;
  const fromRecording = webAutomationRecordOutput({ datasetId: "user.dataset", label: "Results", request, fieldLabels: {} });
  assert.equal(webAutomationDeclaredColumnsRead(fromRecording as never, request), undefined);
});

test("an excluded column is not a helper: it stays in the read and the schema, as the user's exclusion, and is never shown", () => {
  const withExcluded = { ...extractList, fields: { ...extractList.fields, secret: { kind: "text", selector: ".secret", handling: "exclude" } } };
  const sent = dispatched({ extractList: withExcluded, recordOutput });
  assert.deepEqual(Object.keys(sent.extractList.fields), ["name", "price", "rating", "url", "plus", "ad", "secret"]);
  assert.deepEqual(schemaIds(sent.recordOutput), [
    ["name", null], ["price", null], ["rating", null], ["url", null], ["plus", null], ["ad", null], ["secret", "exclude"]
  ]);
  assert.deepEqual((sent.recordOutput.process as JsonObject).columns, ["name", "price", "rating", "url"]);
});

test("actual dispatch keeps authored schema order before the stored helpers and exclusions", () => {
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
  assert.deepEqual(schemaIds(sent.recordOutput).map(([id]) => id), ["gamma", "alpha", "beta", "delta", "epsilon"]);
  assert.deepEqual(Object.keys(sent.extractList.fields), ["alpha", "beta", "gamma", "delta", "epsilon"]);
  assert.deepEqual(sent.extractList.where, [{ field: "delta", is: "present" }]);
  assert.deepEqual((sent.recordOutput.process as JsonObject).sort, [{ field: "beta", order: "asc" }]);
  assert.deepEqual((sent.recordOutput.process as JsonObject).columns, ["gamma", "alpha"]);
  const excluded = (sent.recordOutput.schema as { fields: { id: string; handling?: string }[] }).fields.find((field) => field.id === "epsilon");
  assert.equal(excluded?.handling, "exclude");
  assert.deepEqual(storedColumns(sent.recordOutput, { alpha: "a", beta: "b", gamma: "https://example.invalid/gamma", delta: "d", epsilon: "not retained" }), ["gamma", "alpha", "beta", "delta"]);
});

// t510 (F1): stored is not shown. `process.columns` -- the author's, or the
// declared columns written for them -- keeps every helper out of the answer.

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
const ALL_TASK_COLUMNS = ["title", "owner", "status", "due", "archived"];

test("t510: a schema of the declared columns and a process.sort on a helper stores every helper and shows only the declared columns", () => {
  const sent = dispatched({ extractList: tasks, recordOutput: { datasetId: "tasks", writeMode: "append", schema: taskSchema("title", "owner", "status"), process: { sort: [{ field: "due", order: "asc" }] } } });
  assert.deepEqual(Object.keys(sent.extractList.fields), ALL_TASK_COLUMNS);
  assert.deepEqual(schemaIds(sent.recordOutput), ALL_TASK_COLUMNS.map((id) => [id, null]));
  assert.deepEqual(sent.recordOutput.process, { sort: [{ field: "due", order: "asc" }], columns: ["title", "owner", "status"] });
  // `archived` was read to filter by: it stays a column and its condition still names it.
  assert.deepEqual(sent.extractList.where, [{ field: "archived", is: "absent" }]);
});

test("explicitly excluded fields cannot be silently restored to support an authored sort", () => {
  const recordOutput = {
    datasetId: "tasks",
    writeMode: "append",
    schema: { schemaVersion: "0.1", fields: [...taskSchema("title", "owner", "status").fields, excludedTaskField("due"), excludedTaskField("archived")] },
    process: { sort: [{ field: "due", order: "desc" }], columns: ["title", "owner", "status"] }
  };
  assert.equal(webAutomationExtractListDispatch({ extractList: tasks, recordOutput }).ok, false);
  const declared = webAutomationDeclaredColumnsRead(recordOutput, webAutomationExtractListRequestValue(tasks)!);
  assert.equal((declared?.request.fields.due as JsonObject).handling, "exclude");
  assert.equal((declared?.request.fields.archived as JsonObject).handling, "exclude");
});

test("t510: a helper a process.dedupe or process.where names is stored, and t970: no helper is shown", () => {
  const deduped = dispatched({ extractList: tasks, recordOutput: { datasetId: "tasks", writeMode: "append", schema: taskSchema("title", "owner"), process: { dedupe: { by: ["due"] } } } });
  assert.deepEqual(schemaIds(deduped.recordOutput).map(([id]) => id), ALL_TASK_COLUMNS);
  assert.deepEqual((deduped.recordOutput.process as JsonObject).columns, ["title", "owner"]);
  const filtered = dispatched({ extractList: tasks, recordOutput: { datasetId: "tasks", writeMode: "append", schema: taskSchema("title", "owner"), process: { where: [{ field: "status", contains: "open" }], sort: [{ field: "due", order: "asc" }] } } });
  assert.deepEqual(schemaIds(filtered.recordOutput).map(([id]) => id), ALL_TASK_COLUMNS);
  // Core filters the collected rows, which hold every stored column (t970), so the where's column is stored and not shown.
  assert.deepEqual((filtered.recordOutput.process as JsonObject).columns, ["title", "owner"]);
});

test("t970: a helper Core's anyOf, compare or derive reads is stored and not shown", () => {
  const sent = dispatched({
    extractList: tasks,
    recordOutput: {
      datasetId: "tasks",
      writeMode: "append",
      schema: taskSchema("title", "owner"),
      process: { anyOf: [[{ field: "status", contains: "open" }, { field: "title", contains: "urgent" }]], compare: [{ field: "due", lessThan: "owner" }] }
    }
  });
  assert.deepEqual(schemaIds(sent.recordOutput).map(([id]) => id), ALL_TASK_COLUMNS);
  assert.deepEqual((sent.recordOutput.process as JsonObject).columns, ["title", "owner"]);
  const derived = dispatched({ extractList: tasks, recordOutput: { datasetId: "tasks", writeMode: "append", schema: taskSchema("title", "owner"), process: { derive: [{ id: "year", from: "due", pattern: "([0-9]{4})", as: "number" }], where: [{ field: "year", atLeast: 2026 }] } } });
  assert.deepEqual(schemaIds(derived.recordOutput).map(([id]) => id), ALL_TASK_COLUMNS);
});

test("t510: a helper the read's own sort names is stored and not shown", () => {
  const sent = dispatched({ extractList: { ...tasks, sort: [{ field: "due", order: "asc" }] }, recordOutput: { datasetId: "tasks", writeMode: "append", schema: taskSchema("title", "owner", "status") } });
  assert.deepEqual(schemaIds(sent.recordOutput).map(([id]) => id), ALL_TASK_COLUMNS);
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
function auctionRecordOutput(sortField: string, exclude = true): JsonObject {
  const kept = ["title", "price", "bids", "postage"].map((id) => ({ id, label: id, valueType: "string" }));
  const helpers = ["condition", "ends", "endsAt", "pounds", "bin", "ad"].map((id) => ({ id, label: id, valueType: "string", ...(exclude ? { handling: "exclude" } : {}) }));
  return {
    datasetId: "kestrel35auctions",
    writeMode: "replace",
    schema: { schemaVersion: "0.1", fields: [...kept, ...helpers] },
    process: { sort: [{ field: sortField, order: "asc" }], columns: ["title", "price", "bids", "postage"] }
  };
}

test("campaign-shaped output cannot restore excluded sort fields; safe helpers all stay when only the display excludes them", () => {
  for (const sortField of ["endsAt", "ends"]) {
    assert.equal(webAutomationExtractListDispatch({ extractList: auctionRead, recordOutput: auctionRecordOutput(sortField) }).ok, false);
    const sent = dispatched({ extractList: auctionRead, recordOutput: auctionRecordOutput(sortField, false) });
    const stored = Object.keys(auctionRead.fields);
    assert.deepEqual(schemaIds(sent.recordOutput), stored.map((id) => [id, null]), sortField);
    assert.deepEqual(sent.recordOutput.process, { sort: [{ field: sortField, order: "asc" }], columns: ["title", "price", "bids", "postage"], minRows: 0 }, sortField);
    assert.deepEqual(Object.keys(sent.extractList.fields), stored, sortField);
    // Every hidden column is optional: the schema requires none of them.
    const required = (sent.recordOutput.schema as { fields: { id: string; required?: boolean }[] }).fields.filter((field) => field.required !== false).map((field) => field.id);
    assert.deepEqual(required, ["title", "price", "bids", "postage"], sortField);
    // The conditions over `ad` and `pounds` still run, by key.
    assert.deepEqual(sent.extractList.where, auctionRead.where, sortField);
    // What is stored is a record output Core's parser accepts as it is.
    assert.equal(parseAutomationStudioRecordOutput(sent.recordOutput).ok, true, sortField);
  }
});

test("t510: the record output the dispatch runs, dispatched again, runs unchanged", () => {
  const cases: Array<[JsonObject, JsonObject]> = [
    [auctionRead, auctionRecordOutput("endsAt", false)],
    [tasks, { datasetId: "tasks", writeMode: "append", schema: taskSchema("title", "owner"), process: { sort: [{ field: "due", order: "asc" }] } }],
    [extractList, recordOutput]
  ];
  for (const [read, recordOutput] of cases) {
    const first = dispatched({ extractList: read, recordOutput });
    const again = dispatched({ extractList: read, recordOutput: first.recordOutput });
    assert.deepEqual(again.recordOutput, first.recordOutput);
    assert.deepEqual(again.extractList, first.extractList);
  }
});

// t877, run `run-mw49972k-cebf67e5`: Core's build declared a schema of title
// alone, cut short from "columns title and price exactly as the shop shows
// them", and price left the answer, `ok: true`. The answer keeps exactly the
// declared columns; the narrowing names what it dropped that nothing used, for
// the caller to say. The column a condition reads is stored, hidden (t975).

/** That run's saved read, in stand-in selectors: title and price, and a mark read only to filter by. */
const listings = {
  item: "li.listing",
  fields: { title: { kind: "text", selector: "a.title" }, price: { kind: "text", selector: "span.amount" }, sponsored: { kind: "text", selector: ".sponsored", required: false } },
  where: [{ field: "sponsored", is: "absent" }],
  minItems: 0
};
const listingsRead = () => webAutomationExtractListRequestValue(listings)!;

test("a narrow requested view retains both unused and condition fields without dropping either", () => {
  const declared = webAutomationDeclaredColumnsRead({ datasetId: "listings", writeMode: "append", schema: taskSchema("title") }, listingsRead());
  assert.deepEqual(declared?.dropped, []);
  assert.deepEqual(declared?.hidden, ["price", "sponsored"]);
  // No widening of the answer: it shows the declared column.
  assert.deepEqual(declared?.shown, ["title"]);
  assert.deepEqual(Object.keys(declared!.request.fields), ["title", "price", "sponsored"]);
  assert.deepEqual([...declared!.columns], ["title", "price", "sponsored"]);
});

test("t877: a narrowing that keeps every column something reads names none", () => {
  const declared = webAutomationDeclaredColumnsRead({ datasetId: "listings", writeMode: "append", schema: taskSchema("title", "price") }, listingsRead());
  assert.deepEqual(declared?.dropped, []);
  assert.deepEqual(declared?.hidden, ["sponsored"]);
  const sorted = webAutomationDeclaredColumnsRead({ datasetId: "listings", writeMode: "append", schema: taskSchema("title") }, { ...listingsRead(), sort: [{ field: "price", order: "asc" }] });
  assert.deepEqual(sorted?.dropped, []);
  assert.deepEqual(sorted?.hidden, ["price", "sponsored"]);
});

// t975, F3: the read condition of run `run-mwounh32-24f9bc6b`'s task, "zero mutual friends", in
// stand-in selectors: a request list read with the mutual-friend count kept only to filter by.
test("t975: a read whose condition tests a column the answer does not show stores that column, hidden, on every dispatch", () => {
  const requests = {
    item: "div.request",
    fields: { name: { kind: "text", selector: "a.name" }, url: { kind: "link", selector: "a.name" }, mutuals: { kind: "text", selector: ".mutuals" } },
    where: [{ field: "mutuals", is: "absent" }],
    minItems: 0
  };
  const asked = { datasetId: "removed_requests", writeMode: "append", schema: taskSchema("name", "url") };
  const first = dispatched({ extractList: requests, recordOutput: asked });
  assert.deepEqual(first.extractList.fields.mutuals, { kind: "text", selector: ".mutuals", required: false });
  assert.deepEqual(first.extractList.where, [{ field: "mutuals", is: "absent" }]);
  assert.deepEqual(schemaIds(first.recordOutput).map(([id]) => id), ["name", "url", "mutuals"]);
  assert.deepEqual((first.recordOutput.process as JsonObject).columns, ["name", "url"]);
  // A row that lacks the column -- the very rows the condition keeps -- is stored.
  assert.deepEqual(storedColumns(first.recordOutput, { name: "Someone", url: "https://social.example/people/someone/", mutuals: null }), ["name", "url"]);
  // The saved record output, dispatched again with the read it was written beside, runs unchanged.
  const again = dispatched({ extractList: requests, recordOutput: first.recordOutput });
  assert.deepEqual(again.recordOutput, first.recordOutput);
  assert.deepEqual(again.extractList, first.extractList);
});
