// What a read's stored schema labels its fields with (t997): a column the
// model renamed keeps the site's label -- the detected key, or the page's own
// column words -- under the model's id, so a declaration binds it by either; a
// label never answers to another field's id; a saved read carries the same
// labels through a fresh handle store; and a saved read from before t997 drops
// the sample-built labels its schema still holds.
//
// Core binds a declaration's name to an exact id, then to the one field whose
// label folds to it (`packages/contracts/src/record-sets/process/binding/bind.ts`).
// `boundBy` below is that rule, for these provider-free tests; the test runner's
// `read-oracle/tests/collect.test.ts` drives Core's own binding.

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

test("a renamed column without page words binds by the model's name and by the detected key", () => {
  const schema = storedSchema({ handle: binding.handle, fields: { host: "host_badge", rate: "nightly_rate" } });
  const host = schema.fields.find((field) => field.id === "host");
  assert.equal(host?.label, "host_badge");
  assert.equal(host?.mark, "badge");
  assert.equal(boundBy(schema, "host"), "host");
  assert.equal(boundBy(schema, "host_badge"), "host");
  assert.equal(boundBy(schema, "rate"), "rate");
  assert.equal(boundBy(schema, "nightly_rate"), "rate");
});

test("a renamed column with page words binds by the model's name and by those words", () => {
  const schema = storedSchema({ handle: binding.handle, fields: { pets: "pet_friendly" } });
  assert.equal(schema.fields.find((field) => field.id === "pets")?.label, "Pet friendly");
  assert.equal(boundBy(schema, "pets"), "pets");
  assert.equal(boundBy(schema, "pet friendly"), "pets");
  // The lead's decision (t997): the page's words win over the key, so the key binds nothing here.
  assert.equal(boundBy(schema, "pet_friendly"), undefined);
});

test("a detected key the read gives another column binds that column, and the renamed one's label steps aside", () => {
  const schema = storedSchema({ handle: binding.handle, fields: { host: "host_badge", host_badge: "title" } });
  assert.equal(boundBy(schema, "host_badge"), "host_badge");
  assert.equal(boundBy(schema, "host"), "host");
  const host = schema.fields.find((field) => field.id === "host");
  assert.equal(host?.label, "host_badge (host 2)");
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
  assert.equal(boundBy(restored, "host_badge"), "host");
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
