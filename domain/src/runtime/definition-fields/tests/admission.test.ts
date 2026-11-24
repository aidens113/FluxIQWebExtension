// A read sent to a browser that cannot read semantic definition fields
// (`../admission.ts`): retained-only definition columns are left out, anything
// that depends on one still refuses the whole read.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DEFINITION_FIELDS_CAPABILITY_ID } from "../../capabilities";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../failure";
import { webDefinitionFieldAdmission } from "..";

const DEFINITION = { kind: "text", definition: { term: "Edition", part: "value" } };
const TERM = { kind: "text", definition: { term: "Edition", part: "term" } };
const capable = { capabilities: [{ id: WEB_AUTOMATION_DEFINITION_FIELDS_CAPABILITY_ID, metadata: { version: 1, domainId: "web-automation" } }] };

/** A read of `title` from a list whose detection also found two definition columns, as retention resolves it. */
function retained(change: (parameters: { extractList: JsonObject; recordOutput: JsonObject }) => void = () => undefined): JsonObject {
  const parameters = {
    extractList: { item: "ul > article", fields: { title: { kind: "text", selector: "h3" }, edition: structuredClone(DEFINITION), edition_term: structuredClone(TERM) }, maxItems: 5 },
    recordOutput: {
      datasetId: "extracted-list-title-edition-edition_term:0", label: "Extracted list: title, edition, edition_term", recordsPath: "result.extracted", writeMode: "append",
      process: { columns: ["title"] },
      schema: { schemaVersion: "0.1", fields: [
        { id: "title", label: "Title", valueType: "string", required: false },
        { id: "edition", label: "Edition", valueType: "string", required: false },
        { id: "edition_term", label: "Edition term", valueType: "string", required: false }
      ] }
    }
  };
  change(parameters);
  return parameters as unknown as JsonObject;
}

function fieldsSent(admission: ReturnType<typeof webDefinitionFieldAdmission<JsonObject>>): string[] {
  assert.equal(admission.status, "admitted", JSON.stringify(admission));
  if (admission.status !== "admitted") return [];
  return Object.keys((admission.parameters.extractList as JsonObject).fields as JsonObject);
}

test("an old client gets the read without the definition columns it only retains, and the answer view intact", () => {
  const parameters = retained();
  const before = structuredClone(parameters);
  const admission = webDefinitionFieldAdmission("web.dom.extract_list", parameters, undefined);
  assert.deepEqual(fieldsSent(admission), ["title"]);
  if (admission.status !== "admitted") return;
  // The stored schema still holds both as the optional columns they are; only the read leaves them out.
  assert.deepEqual(admission.parameters.recordOutput, before.recordOutput);
  assert.deepEqual(parameters, before, "the caller's request is not changed in place");
});

test("a client that declares the capability gets the very same read", () => {
  const parameters = retained();
  const admission = webDefinitionFieldAdmission("web.dom.extract_list", parameters, capable);
  assert.equal(admission.status, "admitted");
  if (admission.status === "admitted") assert.equal(admission.parameters, parameters);
});

test("a definition column anything depends on still refuses the whole read on an old client", () => {
  const depends: Array<[string, (parameters: { extractList: JsonObject; recordOutput: JsonObject }) => void]> = [
    ["shown in the answer", (p) => { (p.recordOutput.process as JsonObject).columns = ["title", "edition"]; }],
    ["no answer view, so every column is the answer", (p) => { delete (p.recordOutput.process as JsonObject).columns; }],
    ["no record output at all", (p) => { delete (p as Partial<typeof p>).recordOutput; }],
    ["required", (p) => { ((p.extractList.fields as JsonObject).edition as JsonObject).required = true; }],
    ["a listing condition", (p) => { p.extractList.where = [{ field: "edition", is: "present" }]; }],
    ["a listing sort", (p) => { p.extractList.sort = [{ field: "edition", order: "asc", as: "text" }]; }],
    ["a dedupe key", (p) => { p.extractList.dedupe = { by: ["title", "edition"] }; }],
    ["a whole-row dedupe", (p) => { p.extractList.dedupe = true; }],
    ["an answer condition", (p) => { (p.recordOutput.process as JsonObject).where = [{ field: "edition", is: "present" }]; }],
    ["an identity", (p) => { (p.recordOutput.schema as JsonObject).primaryKey = ["edition"]; }]
  ];
  for (const [why, change] of depends) {
    // Where only `edition` is depended on, leaving `edition_term` out is not enough: `edition` still needs the feature.
    const admission = webDefinitionFieldAdmission("web.dom.extract_list", retained(change), undefined);
    assert.equal(admission.status, "failed", why);
    if (admission.status === "failed") assert.equal(admission.failure.code, WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED, why);
  }
  // An inline condition read is the read's own, never retained.
  const inline = webDefinitionFieldAdmission("web.dom.extract_list", retained((p) => { p.extractList.where = [{ read: DEFINITION, is: "present" }]; }), undefined);
  assert.equal(inline.status, "failed");
});

test("ordinary reads and other actions pass through unchanged", () => {
  const ordinary = { extractList: { item: "ul > article", fields: { title: { kind: "text", selector: "h3" } } } };
  const admitted = webDefinitionFieldAdmission("web.dom.extract_list", ordinary, undefined);
  assert.equal(admitted.status, "admitted");
  if (admitted.status === "admitted") assert.equal(admitted.parameters, ordinary);
  const click = { selector: "#next" };
  const pressed = webDefinitionFieldAdmission("web.dom.click", click, undefined);
  assert.equal(pressed.status === "admitted" && pressed.parameters, click);
});
