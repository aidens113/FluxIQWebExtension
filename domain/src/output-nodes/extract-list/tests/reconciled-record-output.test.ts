// An authored record output beside an extraction: the field map declares the
// columns, and everything else the author wrote stays as written.
//
// The first row is the measurement the module exists for. A model asked for a
// table of name, price, rating and url gives the columns the types a person
// would -- price and rating as numbers -- and a page can only ever hand back
// the text it read, so Core's record validation refused every row of a live run
// and the dataset stored nothing (`test-runs/run-mueqynzb-ac54aab9`,
// `core.result.every_record_refused`).

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioRecordOutput, validateAutomationStudioRecords } from "fluxiq/automation-studio";
import type { WebAutomationExtractListRequest } from "../../../actions/extraction";
import { webAutomationRecordOutput } from "../record-output";
import { webAutomationReconciledRecordOutput } from "../reconciled-record-output";
import { WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH } from "../records-path";

const request: WebAutomationExtractListRequest = {
  item: '[data-component="search-result"]',
  fields: {
    name: { kind: "text", selector: ":scope > h2 > a > span" },
    price: { kind: "text", selector: ":scope > div > span" },
    rating: { kind: "text", selector: ":scope > div > i > span", required: false },
    url: { kind: "link", selector: ":scope > h2 > a" }
  }
};

/** The rows the page hands back for that request: text, and an absolute URL for the link. */
const rows = [
  { name: "synthetic-first-product", price: "synthetic-price-text", rating: "synthetic-rating-text", url: "https://store.example/dp/SYNTH1" },
  { name: "synthetic-second-product", price: "synthetic-other-price-text", rating: null, url: "https://store.example/dp/SYNTH2" }
];

/** What a model writes when it is shown the record-output contract and asked for a table. */
const authored = {
  datasetId: "products",
  label: "Products",
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

test("reconciliation preserves explicit intermediate ownership and leaves old outputs unmarked", () => {
  const output = webAutomationReconciledRecordOutput({ ...authored, purpose: "intermediate" }, request);
  const parsed = parseAutomationStudioRecordOutput(output);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("expected parsed intermediate");
  assert.equal(parsed.output.purpose, "intermediate");
  assert.deepEqual(stored(output).rows, stored(webAutomationReconciledRecordOutput(authored, request)).rows);
  assert.equal(Object.hasOwn(webAutomationReconciledRecordOutput(authored, request) as object, "purpose"), false);
});

function stored(output: unknown) {
  const parsed = parseAutomationStudioRecordOutput(output);
  assert.equal(parsed.ok, true, JSON.stringify(parsed));
  if (!parsed.ok) throw new Error("unreachable");
  return validateAutomationStudioRecords(rows, parsed.output.schema, { maxRecords: parsed.output.maxRecords });
}

test("the authored schema on its own refuses every row the page produced", () => {
  const refused = stored({ ...authored, recordsPath: WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH });
  assert.equal(refused.rows.length, 0);
  assert.equal(refused.invalidCount, rows.length);
  assert.deepEqual(refused.issues, ["records.invalid_value"]);
});

test("holding the columns the extraction reads, every row is stored", () => {
  const kept = stored(webAutomationReconciledRecordOutput(authored, request));
  assert.equal(kept.invalidCount, 0);
  assert.equal(kept.rows.length, rows.length);
  assert.deepEqual(kept.rows[0], rows[0]);
  // An optional column the page could not read is an absent key, not a refusal.
  assert.deepEqual(kept.rows[1], { name: rows[1]!.name, price: rows[1]!.price, url: rows[1]!.url });
});

test("the columns come from the field map and their names from the author; nothing else changes", () => {
  const output = webAutomationReconciledRecordOutput(authored, request) as typeof authored & { recordsPath: string };
  assert.equal(output.datasetId, "products");
  assert.equal(output.label, "Products");
  assert.equal(output.writeMode, "append");
  assert.equal(output.recordsPath, WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH);
  assert.deepEqual(output.schema.fields.map((field) => field.label), ["Name", "Price", "Rating", "URL"]);
  assert.deepEqual(output.schema.fields.map((field) => field.valueType), ["string", "string", "string", "url"]);
  assert.deepEqual(output.schema.fields.map((field) => field.required), [true, true, false, true]);
});

test("a schema naming columns the extraction does not read stores the rows anyway", () => {
  const renamed = { ...authored, schema: { schemaVersion: "0.1", fields: [{ id: "productName", label: "Product", valueType: "string", required: true }] } };
  const kept = stored(webAutomationReconciledRecordOutput(renamed, request));
  assert.equal(kept.invalidCount, 0);
  assert.equal(kept.rows.length, rows.length);
});

test("a records path naming anywhere else is replaced by the node's own", () => {
  const output = webAutomationReconciledRecordOutput({ ...authored, recordsPath: "records" }, request) as { recordsPath: string };
  assert.equal(output.recordsPath, WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH);
});

test("a key the record-set parser does not take is still refused rather than rebuilt away", () => {
  const parsed = parseAutomationStudioRecordOutput(webAutomationReconciledRecordOutput({ ...authored, nonsense: true }, request));
  assert.equal(parsed.ok, false);
});

test("a recording's own record output is unchanged but for the records path the dispatch always supplied", () => {
  // The panel host writes one built from this very request and the user's own
  // column names (`domain/src/web-panel-host.ts`), so reconciling one must
  // leave a recorded Flow exactly as it was.
  const fromRecording = webAutomationRecordOutput({
    datasetId: "user.dataset",
    label: "Search results",
    request,
    fieldLabels: { name: "Product", price: "Price", rating: "Stars", url: "Link" }
  });
  assert.deepEqual(
    webAutomationReconciledRecordOutput(fromRecording as never, request),
    { ...fromRecording, recordsPath: WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH }
  );
});

test("a value that is not an object is handed on for the dispatch's parse to refuse", () => {
  assert.equal(webAutomationReconciledRecordOutput("not an object", request), "not an object");
});


const orderedRequest: WebAutomationExtractListRequest = {
  item: "li.entry",
  fields: {
    alpha: { kind: "text", selector: ".alpha", required: false },
    beta: { kind: "text", selector: ".beta" },
    gamma: { kind: "link", selector: "a.gamma" }
  }
};
const orderedAuthored = {
  datasetId: "entries", label: "Entries", writeMode: "replace",
  process: { dedupe: { by: ["gamma"] }, columns: ["gamma", "alpha", "beta"], minRows: 0 },
  schema: { schemaVersion: "0.1", fields: [
    { id: "gamma", label: "Destination", valueType: "string", required: false },
    { id: "alpha", label: "Optional text", valueType: "number", required: true },
    { id: "beta", label: "Other text", valueType: "number", required: true }
  ] }
};

test("reconciliation preserves authored column order and extraction-derived cell contracts", () => {
  const output = webAutomationReconciledRecordOutput(orderedAuthored, orderedRequest) as typeof orderedAuthored;
  assert.deepEqual(output.schema.fields.map((field) => field.id), ["gamma", "alpha", "beta"]);
  assert.deepEqual(output.schema.fields.map((field) => field.label), ["Destination", "Optional text", "Other text"]);
  assert.deepEqual(output.schema.fields.map((field) => field.valueType), ["url", "string", "string"]);
  assert.deepEqual(output.schema.fields.map((field) => field.required), [true, false, true]);
  assert.deepEqual(output.process, orderedAuthored.process);
  assert.equal(output.writeMode, "replace");
});

test("missing or unusable authored ordering retains the derived field order", () => {
  for (const schema of [undefined, { fields: [] }, { fields: [{ id: "unknown", label: "Unknown" }] },
    { fields: [{ id: "gamma", label: "First" }, { id: "gamma", label: "Second" }] }]) {
    const authoredValue = { datasetId: "entries", label: "Entries", ...(schema === undefined ? {} : { schema }) };
    const output = webAutomationReconciledRecordOutput(authoredValue, orderedRequest) as { schema: { fields: { id: string }[] } };
    assert.deepEqual(output.schema.fields.map((field) => field.id), ["alpha", "beta", "gamma"]);
  }
});
