import assert from "node:assert/strict";
import test from "node:test";
import { validateAutomationStudioRecords, storedAutomationStudioRecordSchema } from "fluxiq/components/automation";
import type { JsonObject } from "fluxiq/core";
import type { WebAutomationExtractFieldSpec } from "../../../../../actions/extraction";
import { webAutomationExtractListDispatch } from "../../../../../output-nodes";
import { createWebLlmExtractionHandles, type WebLlmExtractionBinding } from "../../../structure";
import { resolveWebExtractionSlot } from "../slot";
import { webPlanWithExtractionBinding } from "../saved-list";
import { webPlanRetainedRecordOutput } from "../retained-output";

const scope = { projectId: "project", flowId: "flow" };
const binding: WebLlmExtractionBinding = {
  handle: "extraction.1", location: "https://example.test/list", itemCount: 6,
  extractList: { item: ".row", fields: {
    title: { kind: "text", selector: ".title" }, price: { kind: "text", selector: ".price" },
    shipping: { kind: "text", selector: ".shipping" }, plus: { kind: "text", selector: ".plus", mark: "badge" },
    promoted: { kind: "text", selector: ".ad", mark: "flag" }, posted: { kind: "text", selector: ".posted" },
    url: { kind: "link", selector: "a" }, private: { kind: "text", selector: ".private", handling: "exclude" }
  } },
  recordSchema: { schemaVersion: "0.1", primaryKey: ["url"], fields: [
    { id: "title", label: "Title", valueType: "string", semanticType: "text" },
    { id: "price", label: "Price", valueType: "string", semanticType: "currency" },
    { id: "shipping", label: "Shipping", valueType: "string", semanticType: "currency" },
    { id: "plus", label: "Plus", valueType: "string", semanticType: "flag", mark: "badge" },
    { id: "promoted", label: "Promoted", valueType: "string", semanticType: "flag", mark: "flag" },
    { id: "posted", label: "Posted", valueType: "string", semanticType: "date" },
    { id: "url", label: "URL", valueType: "string", semanticType: "url" },
    { id: "private", label: "Private", valueType: "string", handling: "exclude" }
  ] }
};

function resolve(value: JsonObject, retained = binding, fresh = false) {
  const handles = createWebLlmExtractionHandles();
  if (!fresh) handles.retain(scope, retained);
  const slot = resolveWebExtractionSlot(value, scope, handles, fresh);
  assert.equal(slot.status, "resolved");
  if (slot.status !== "resolved") throw new Error("expected resolved list");
  const recordOutput = webPlanRetainedRecordOutput({ authored: undefined, request: slot.request, schema: slot.recordSchema, requested: slot.requestedColumns, names: [] });
  const dispatch = webAutomationExtractListDispatch({ extractList: slot.request, recordOutput });
  assert.equal(dispatch.ok, true);
  if (!dispatch.ok) throw new Error("expected dispatchable read");
  return { slot, dispatch, output: dispatch.payload.recordOutput as JsonObject };
}

test("a requested table retains every omitted filter, ordering, identity and mark field", () => {
  const { slot, dispatch, output } = resolve({ handle: binding.handle, fields: ["title", "price"] });
  assert.deepEqual(Object.keys(slot.request.fields as JsonObject), Object.keys(binding.extractList.fields));
  assert.deepEqual((output.process as JsonObject).columns, ["title", "price"]);
  const schema = output.schema as unknown as NonNullable<WebLlmExtractionBinding["recordSchema"]>;
  assert.deepEqual(schema.primaryKey, ["url"]);
  assert.equal(schema.fields.find((field) => field.id === "shipping")?.semanticType, "currency");
  assert.equal(schema.fields.find((field) => field.id === "promoted")?.mark, "flag");
  assert.equal((((dispatch.payload.parameters as JsonObject).extractList as JsonObject).fields as JsonObject).private && ((((dispatch.payload.parameters as JsonObject).extractList as JsonObject).fields as JsonObject).private as JsonObject).handling, "exclude");
  const rows = [
    { title: "Synthetic item", price: "$12.50", shipping: "$0.00", plus: "Plus", promoted: "Sponsored", posted: "2 days ago", url: "https://example.test/item", private: "excluded synthetic cell" },
    { title: "Synthetic item", price: "$11.75", shipping: "$0.00", plus: "Plus", posted: "1 day ago", url: "https://example.test/item" }
  ];
  const kept = validateAutomationStudioRecords(rows, schema);
  assert.equal(kept.invalidCount, 0);
  assert.equal(kept.rows.length, 2, "actual promoted and organic occurrences are not merged");
  assert.equal(kept.rows[0]?.promoted, "Sponsored");
  assert.equal(kept.rows[1]?.posted, "1 day ago");
  assert.equal(kept.rows[1]?.shipping, "$0.00");
  assert.equal(JSON.stringify(kept).includes("private"), false);
  assert.equal(JSON.stringify(storedAutomationStudioRecordSchema(schema)).includes("private"), false);
});

test("summary/detail reads in a child frame retain full metadata after the handle store is gone", () => {
  const framed = structuredClone(binding);
  framed.oneRecord = true;
  framed.itemCount = 1;
  framed.frameId = 7;
  framed.frameUrlPath = "/embedded/summary";
  const handles = createWebLlmExtractionHandles();
  handles.retain(scope, framed);
  const saved = webPlanWithExtractionBinding({ extractList: { handle: framed.handle, fields: ["title"] } }, scope, handles);
  const restored = resolve(JSON.parse(JSON.stringify(saved.extractList)) as JsonObject, framed, true);
  assert.equal(restored.slot.frameId, 7);
  assert.equal(restored.slot.frameUrlPath, "/embedded/summary");
  assert.equal(restored.slot.request.maxItems, 1);
  assert.deepEqual(restored.slot.recordSchema.primaryKey, ["url"]);
  assert.equal(restored.slot.recordSchema.fields.length, 8);
  assert.equal(restored.slot.recordSchema.fields.find((field) => field.id === "price")?.semanticType, "currency");
  assert.equal(JSON.stringify(saved).includes("parsed"), false);
});

test("an arbitrary shared link is not promoted to identity when detection validated none", () => {
  const unproven = structuredClone(binding);
  delete unproven.recordSchema!.primaryKey;
  const { slot } = resolve({ handle: binding.handle, fields: ["title"] }, unproven);
  assert.equal(slot.recordSchema.primaryKey, undefined);
});

test("a raw href alias retains the validated canonical identity reading under its own key", () => {
  const canonical = structuredClone(binding);
  canonical.extractList.fields.url = { kind: "link", selector: "a", identity: "tracking-free" };
  const { slot } = resolve({ handle: canonical.handle, fields: { url: "url@href" } }, canonical);
  assert.deepEqual(slot.request.fields && (slot.request.fields as JsonObject).url, { kind: "attribute", selector: "a", attribute: "href" });
  assert.deepEqual((slot.request.fields as JsonObject).url_2, { kind: "link", selector: "a", identity: "tracking-free" });
  assert.deepEqual(slot.recordSchema.primaryKey, ["url_2"]);
});

test("intermediate reads retain complete fields without inventing a durable presentation process", () => {
  const { slot } = resolve({ handle: binding.handle, fields: ["title"] });
  const output = webPlanRetainedRecordOutput({ authored: { purpose: "intermediate", datasetId: "computation", writeMode: "append" }, request: slot.request, schema: slot.recordSchema, requested: slot.requestedColumns, names: [] }) as JsonObject;
  assert.equal(output.process, undefined);
  assert.equal(((output.schema as JsonObject).fields as JsonObject[]).length, 8);
  const dispatch = webAutomationExtractListDispatch({ extractList: slot.request, recordOutput: output });
  assert.equal(dispatch.ok, true, JSON.stringify(dispatch));
  if (dispatch.ok) assert.equal((dispatch.payload.recordOutput as JsonObject).process, undefined);
});

test("retaining safe metadata does not erase malformed output or unknown authored columns", () => {
  const { slot } = resolve({ handle: binding.handle, fields: ["title"] });
  for (const authored of ["malformed output", { datasetId: "items", schema: { schemaVersion: "0.1", fields: [{ id: "unknownField", label: "Unknown", valueType: "string" }] } }]) {
    const output = webPlanRetainedRecordOutput({ authored, request: slot.request, schema: slot.recordSchema, requested: slot.requestedColumns, names: [] });
    assert.deepEqual(output, authored);
    assert.equal(webAutomationExtractListDispatch({ extractList: slot.request, recordOutput: output }).ok, false);
  }
});

test("a saved binding with rejected metadata never falls through to another binding in memory", () => {
  const handles = createWebLlmExtractionHandles();
  handles.retain(scope, binding);
  const saved = webPlanWithExtractionBinding({ extractList: { handle: binding.handle, fields: ["title"] } }, scope, handles);
  const list = saved.extractList as JsonObject;
  const held = list.extractionBinding as JsonObject;
  ((held.recordSchema as JsonObject).fields as JsonObject[])[0]!.semanticType = "unrecognized";
  const slot = resolveWebExtractionSlot(list, scope, handles, true);
  assert.equal(slot.status, "refused");
  if (slot.status === "refused") assert.deepEqual(slot.path, ["extractionBinding"]);
});

test("retained campaign-shaped rows report their storage overhead using counts only", () => {
  const campaigns: Array<{ family: string; count: number; shown: string[]; sample: JsonObject; typed: Record<string, "currency" | "date" | "count" | "flag">; marks: string[] }> = [
    { family: "earbuds", count: 12, shown: ["title", "price"], sample: { title: "Synthetic earbuds", price: "$12.50", shipping: "$0.00", plus: "Plus", promoted: "Sponsored", posted: "2 days ago", url: "https://example.test/item" }, typed: { price: "currency", shipping: "currency", plus: "flag", promoted: "flag", posted: "date" }, marks: ["plus", "promoted"] },
    { family: "jobs", count: 20, shown: ["title", "company"], sample: { title: "Synthetic engineer", company: "Synthetic company", location: "Remote", salary: "$120000", posted: "1 day ago", easyApply: "Easy apply", url: "https://example.test/job" }, typed: { salary: "currency", posted: "date", easyApply: "flag" }, marks: ["easyApply"] },
    { family: "photo-social", count: 9, shown: ["username", "caption"], sample: { username: "synthetic", caption: "Synthetic caption", likes: "12 likes", posted: "3 days ago", sponsored: "Sponsored", verified: "Verified", url: "https://example.test/photo" }, typed: { likes: "count", posted: "date", sponsored: "flag", verified: "flag" }, marks: ["sponsored", "verified"] }
  ];
  for (const { family, count, shown: displayed, sample, typed, marks } of campaigns) {
    const keys = Object.keys(sample);
    const retained = structuredClone(binding);
    retained.extractList = { item: ".row", fields: {} };
    const recordSchema: NonNullable<WebLlmExtractionBinding["recordSchema"]> = { schemaVersion: "0.1", primaryKey: ["url"], fields: [] };
    for (const id of keys) {
      const spec: WebAutomationExtractFieldSpec = { kind: id === "url" ? "link" : "text", selector: `.${id}` };
      const field: NonNullable<WebLlmExtractionBinding["recordSchema"]>["fields"][number] = { id, label: id, valueType: "string" };
      const semantic = typed[id];
      if (semantic !== undefined) field.semanticType = semantic;
      if (marks.includes(id)) {
        spec.mark = "badge";
        field.mark = "badge";
      }
      retained.extractList.fields[id] = spec;
      recordSchema.fields.push(field);
    }
    retained.recordSchema = recordSchema;
    const { output } = resolve({ handle: retained.handle, fields: displayed }, retained);
    const schema = output.schema as unknown as NonNullable<WebLlmExtractionBinding["recordSchema"]>;
    const rows = Array.from({ length: count }, (_, index) => ({ ...sample, url: `${sample.url}/${index}` }));
    const full = validateAutomationStudioRecords(rows, schema).rows;
    const shown = full.map((row) => Object.fromEntries(displayed.map((id) => [id, row[id]])));
    const bytes = Buffer.byteLength(JSON.stringify(full), "utf8");
    const viewBytes = Buffer.byteLength(JSON.stringify(shown), "utf8");
    assert.equal(full.length, count);
    assert.equal(Object.keys(full[0]!).length, 7);
    for (const id of keys.filter((id) => !displayed.includes(id))) assert.equal(full[0]![id], rows[0]![id], `${family} retains omitted ${id}`);
    assert.deepEqual(schema.primaryKey, ["url"]);
    for (const id of marks) assert.equal(schema.fields.find((field) => field.id === id)?.mark, "badge");
    assert.ok(bytes > viewBytes);
    console.log(`retained-cost family=${family} rows=${count} stored_fields=7 displayed_fields=2 stored_bytes=${bytes} displayed_bytes=${viewBytes}`);
  }
});
