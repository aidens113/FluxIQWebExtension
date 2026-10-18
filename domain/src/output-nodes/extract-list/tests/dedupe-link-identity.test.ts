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

test("only the explicitly deduped excluded link helper opts in, while displayed URLs remain exact", () => {
  const read = webAutomationDedupeLinkIdentity(OUTPUT, REQUEST);
  assert.deepEqual(read.fields.identity, { kind: "link", selector: "a.time", identity: "tracking-free" });
  assert.deepEqual(read.fields.url, REQUEST.fields.url);
  const dispatch = webAutomationExtractListDispatch({ extractList: REQUEST as unknown as JsonObject, recordOutput: OUTPUT });
  assert.equal(dispatch.ok, true, JSON.stringify(dispatch));
  if (!dispatch.ok) return;
  const parameters = dispatch.payload.parameters as JsonObject;
  const sent = parameters.extractList as unknown as WebAutomationExtractListRequest;
  assert.deepEqual(sent.fields.identity, read.fields.identity);
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
