import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationDedupeLinkIdentity, webAutomationExtractListDispatch } from "..";
import type { WebAutomationExtractListRequest } from "../../../actions/extraction";

const REQUEST: WebAutomationExtractListRequest = { item: "li", fields: { title: "h2", identity: { kind: "link", selector: "a.time" }, url: { kind: "link", selector: "a.time" } } };
const OUTPUT: JsonObject = { datasetId: "entries", writeMode: "append", schema: { schemaVersion: "0.1", fields: [
  { id: "title", label: "Title", valueType: "string" },
  { id: "identity", label: "Identity", valueType: "url", handling: "exclude" },
  { id: "url", label: "URL", valueType: "url" }
] }, process: { dedupe: { by: ["identity"] }, columns: ["title", "url"] } };

test("only an explicitly deduped hidden included helper opts in, while exclusions refuse and displayed URLs remain exact", () => {
  assert.equal(webAutomationDedupeLinkIdentity(OUTPUT, REQUEST), REQUEST);
  assert.equal(webAutomationExtractListDispatch({ extractList: REQUEST as unknown as JsonObject, recordOutput: OUTPUT }).ok, false);
  const included: JsonObject = structuredClone(OUTPUT);
  const field = ((included.schema as JsonObject).fields as JsonObject[])[1]!;
  delete field.handling;
  const read = webAutomationDedupeLinkIdentity(included, REQUEST);
  assert.deepEqual(read.fields.identity, { kind: "link", selector: "a.time", identity: "tracking-free" });
  assert.deepEqual(read.fields.url, REQUEST.fields.url);
  const dispatch = webAutomationExtractListDispatch({ extractList: REQUEST as unknown as JsonObject, recordOutput: included });
  assert.equal(dispatch.ok, true, JSON.stringify(dispatch));
  if (!dispatch.ok) return;
  const parameters = dispatch.payload.parameters as JsonObject;
  const sent = parameters.extractList as unknown as WebAutomationExtractListRequest;
  // Stored for the dedupe and hidden from the answer, so read as optional (`../declared-columns.ts`, t975).
  assert.deepEqual(sent.fields.identity, { ...(read.fields.identity as object), required: false });
  const output = dispatch.payload.recordOutput as JsonObject;
  assert.deepEqual((output.process as JsonObject).columns, ["title", "url"]);
  assert.deepEqual((output.process as JsonObject).dedupe, { by: ["identity"] });
});

test("no implicit normalization of ordinary, displayed, un-deduped or raw attribute fields", () => {
  assert.equal(webAutomationDedupeLinkIdentity(undefined, REQUEST), REQUEST);
  const shown: JsonObject = { ...OUTPUT, process: { dedupe: { by: ["identity"] }, columns: ["title", "identity", "url"] } };
  assert.equal(webAutomationDedupeLinkIdentity(shown, REQUEST), REQUEST);
  const noProjection: JsonObject = { ...OUTPUT, process: { dedupe: { by: ["identity"] } } };
  assert.equal(webAutomationDedupeLinkIdentity(noProjection, REQUEST), REQUEST);
  const unasked: JsonObject = { ...OUTPUT, process: { columns: ["title", "url"] } };
  assert.equal(webAutomationDedupeLinkIdentity(unasked, REQUEST), REQUEST);
  const attribute: WebAutomationExtractListRequest = { ...REQUEST, fields: { ...REQUEST.fields, identity: { kind: "attribute", selector: "a.time", attribute: "href" } } };
  assert.equal(webAutomationDedupeLinkIdentity(OUTPUT, attribute), attribute);
});
