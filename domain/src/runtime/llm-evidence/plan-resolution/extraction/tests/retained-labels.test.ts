// What a read's stored schema labels its fields with: a column the model renamed is labelled by the model's own name
// (t1041, the lead's decision of 2026-11-25, reversing t997): Core's label is the human column name an answer heads
// its column with, and the site's key and words bind a declaration through the name rewrite
// (`stored-columns.test.ts`); a column kept under the site's name keeps the page's words; a label never answers to
// another field's id; a saved read carries the same labels through a fresh handle store; and a saved read from before
// t997 drops the sample-built labels its schema still holds.
//
// Core binds a declaration's name to an exact id, then to the one field whose label folds to it
// (`packages/contracts/src/record-sets/process/binding/bind.ts`). `boundBy` below is that rule, for these
// provider-free tests; the test runner's `read-oracle/tests/collect.test.ts` drives Core's own binding.

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioRecordSchema } from "fluxiq/components/automation";
import type { JsonObject } from "fluxiq/core";
import { webAutomationExtractListDispatch } from "../../../../../output-nodes";
import { createWebLlmExtractionHandles, type WebLlmExtractionBinding } from "../../../structure";
import { resolveWebExtractionSlot } from "../slot";
import { webPlanWithExtractionBinding } from "../saved-list";
import { webPlanRetainedRecordOutput } from "../retained-output";

type Schema = NonNullable<WebLlmExtractionBinding["recordSchema"]>;

const scope = { projectId: "project", flowId: "flow" };

/** A generic listing of rentals as a detection keeps it: one badge column without page words, one with. */
const binding: WebLlmExtractionBinding = {
  handle: "extraction.1", location: "https://example.test/rentals", itemCount: 6,
  extractList: { item: ".rental", fields: {
    title: { kind: "text", selector: ".title" },
    nightly_rate: { kind: "text", selector: ".rate" },
    host_badge: { kind: "attribute", selector: ".host i", attribute: "aria-label", mark: "badge" },
    pet_friendly: { kind: "attribute", selector: ".pets i", attribute: "aria-label", mark: "badge" },
    url: { kind: "link", selector: "a" }
  } },
  recordSchema: { schemaVersion: "0.1", primaryKey: ["url"], fields: [
    { id: "title", label: "Title", valueType: "string", semanticType: "text" },
    { id: "nightly_rate", label: "nightly_rate", valueType: "string", semanticType: "currency" },
    { id: "host_badge", label: "host_badge", valueType: "string", mark: "badge" },
    { id: "pet_friendly", label: "Pet friendly", valueType: "string", mark: "badge" },
    { id: "url", label: "url", valueType: "string", semanticType: "url" }
  ] }
};

/** The id Core binds `name` to, or `undefined` when it binds none (missing or ambiguous). */
function boundBy(schema: Schema, name: string): string | undefined {
  const exact = schema.fields.find((field) => field.id === name);
  if (exact !== undefined) return exact.id;
  const fold = (text: string) => text.replace(/\s+/gu, " ").trim().toLowerCase();
  const matches = schema.fields.filter((field) => fold(field.label) === fold(name));
  return matches.length === 1 ? matches[0]!.id : undefined;
}

/** The schema the read's record output carries to Core, as the dispatch takes it. */
function storedSchema(value: JsonObject, retained = binding, fresh = false): Schema {
  const handles = createWebLlmExtractionHandles();
  if (!fresh) handles.retain(scope, retained);
  const slot = resolveWebExtractionSlot(value, scope, handles, fresh);
  assert.equal(slot.status, "resolved", JSON.stringify(slot));
  if (slot.status !== "resolved") throw new Error("expected a resolved read");
  const recordOutput = webPlanRetainedRecordOutput({ authored: undefined, request: slot.request, schema: slot.recordSchema, requested: slot.requestedColumns, names: [] });
  const dispatch = webAutomationExtractListDispatch({ extractList: slot.request, recordOutput });
  assert.equal(dispatch.ok, true, JSON.stringify(dispatch));
  if (!dispatch.ok) throw new Error("expected a dispatchable read");
  const schema = (dispatch.payload.recordOutput as JsonObject).schema;
  assert.equal(parseAutomationStudioRecordSchema(schema).ok, true, "Core accepts the labels");
  return schema as unknown as Schema;
}

test("a renamed column is labelled by the model's name, and the site's key binds nothing by label", () => {
  const schema = storedSchema({ handle: binding.handle, fields: { host: "host_badge", rate: "nightly_rate" } });
  const host = schema.fields.find((field) => field.id === "host");
  assert.equal(host?.label, "host");
  assert.equal(host?.mark, "badge");
  assert.equal(boundBy(schema, "host"), "host");
  assert.equal(boundBy(schema, "host_badge"), undefined);
  assert.equal(schema.fields.find((field) => field.id === "rate")?.label, "rate");
});

test("a renamed column with page words is labelled by the model's name, not those words", () => {
  const schema = storedSchema({ handle: binding.handle, fields: { pets: "pet_friendly" } });
  assert.equal(schema.fields.find((field) => field.id === "pets")?.label, "pets");
  assert.equal(boundBy(schema, "pets"), "pets");
  assert.equal(boundBy(schema, "pet friendly"), undefined);
});

test("a column kept under the site's name keeps the page's words", () => {
  const schema = storedSchema({ handle: binding.handle, fields: ["title", "pet_friendly"] });
  assert.equal(schema.fields.find((field) => field.id === "title")?.label, "Title");
  assert.equal(schema.fields.find((field) => field.id === "pet_friendly")?.label, "Pet friendly");
});

test("a read whose columns are renamed from the readable names heads them name, price and rating", () => {
  const sourced: WebLlmExtractionBinding = {
    handle: "extraction.2", location: "https://example.test/shop", itemCount: 4,
    extractList: { item: ".card", fields: {
      a_css_1_span_css_2: { kind: "text", selector: ".t" },
      p_css_3: { kind: "text", selector: ".p" },
      div_css_4_span_css_5_number: { kind: "text", selector: ".r" }
    } },
    names: { a_css_1_span_css_2: "link_text", p_css_3: "price", div_css_4_span_css_5_number: "number_2" },
    recordSchema: { schemaVersion: "0.1", fields: [
      { id: "a_css_1_span_css_2", label: "a_css_1_span_css_2", valueType: "string" },
      { id: "p_css_3", label: "p_css_3", valueType: "string", semanticType: "currency" },
      { id: "div_css_4_span_css_5_number", label: "div_css_4_span_css_5_number", valueType: "string" }
    ] }
  };
  const schema = storedSchema({ handle: sourced.handle, fields: { name: "link_text", price: "price", rating: "number_2" } }, sourced);
  assert.deepEqual(schema.fields.map((field) => [field.id, field.label]), [["name", "name"], ["price", "price"], ["rating", "rating"]]);
});

test("the author's own label for a renamed column is its label; an id's label never answers to another id", () => {
  const handles = createWebLlmExtractionHandles();
  handles.retain(scope, binding);
  const slot = resolveWebExtractionSlot({ handle: binding.handle, fields: { host: "host_badge", rate: "nightly_rate" } }, scope, handles);
  if (slot.status !== "resolved") throw new Error("expected a resolved read");
  const authored = { schema: { schemaVersion: "0.1", fields: [{ id: "host", label: "Host badge", valueType: "string" }, { id: "rate", label: "rate", valueType: "string" }] }, process: { columns: ["host", "rate"] } };
  const output = webPlanRetainedRecordOutput({ authored, request: slot.request, schema: slot.recordSchema, requested: slot.requestedColumns, names: [] }) as JsonObject;
  const fields = (output.schema as unknown as Schema).fields;
  assert.equal(fields.find((field) => field.id === "host")?.label, "Host badge");
  assert.equal(fields.find((field) => field.id === "rate")?.label, "rate");
});

test("a detected key the read gives another column binds that column, and the renamed one is labelled by its name", () => {
  const schema = storedSchema({ handle: binding.handle, fields: { host: "host_badge", host_badge: "title" } });
  assert.equal(boundBy(schema, "host_badge"), "host_badge");
  assert.equal(boundBy(schema, "host"), "host");
  assert.equal(schema.fields.find((field) => field.id === "host")?.label, "host");
});

test("an alias that reads another attribute is labelled by its own name; the original keeps the site's label", () => {
  const schema = storedSchema({ handle: binding.handle, fields: { title: "title", link: "url@href" } });
  assert.equal(schema.fields.find((field) => field.id === "link")?.label, "link");
  assert.equal(schema.fields.find((field) => field.id === "url")?.label, "url");
  assert.equal(boundBy(schema, "url"), "url");
});

test("a saved read carries the same labels through a fresh handle store", () => {
  const value = { handle: binding.handle, fields: { host: "host_badge", title: "title" } };
  const live = storedSchema(value);
  const handles = createWebLlmExtractionHandles();
  handles.retain(scope, binding);
  const saved = webPlanWithExtractionBinding({ extractList: value }, scope, handles);
  const restored = storedSchema(JSON.parse(JSON.stringify(saved.extractList)) as JsonObject, binding, true);
  assert.deepEqual(restored, live);
  assert.equal(boundBy(restored, "host"), "host");
});

test("a read saved before t997 loses the labels its schema built from a sample", () => {
  const legacy = structuredClone(binding);
  legacy.recordSchema!.fields[0]!.label = "link: 'A synthetic rental title'";
  legacy.recordSchema!.fields[1]!.label = "price: '$80'";
  const handles = createWebLlmExtractionHandles();
  handles.retain(scope, legacy);
  const saved = webPlanWithExtractionBinding({ extractList: { handle: binding.handle, fields: ["title", "nightly_rate"] } }, scope, handles);
  const schema = storedSchema(JSON.parse(JSON.stringify(saved.extractList)) as JsonObject, legacy, true);
  assert.deepEqual(schema.fields.map((field) => field.label), ["title", "nightly_rate", "host_badge", "Pet friendly", "url"]);
  for (const value of ["synthetic", "$80"]) assert.equal(JSON.stringify(schema).includes(value), false, `the schema quotes ${value}`);
});
