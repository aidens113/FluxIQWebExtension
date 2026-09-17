// The dataset a list extraction saves into when its node names none: Core
// accepts it, its id is a pure function of what shapes the rows, and its name
// holds no excluded column.

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioRecordOutput } from "fluxiq/automation-studio";
import type { WebAutomationExtractListRequest } from "../../../actions/extraction";
import { webAutomationDerivedRecordOutput } from "../derived-record-output";

const request: WebAutomationExtractListRequest = {
  item: "li.product",
  fields: {
    name: ".name",
    link: { kind: "link", selector: "a" },
    password: { kind: "text", selector: ".secret", handling: "exclude" }
  }
};

test("the derived record output parses under Core's rules", () => {
  const parsed = parseAutomationStudioRecordOutput(webAutomationDerivedRecordOutput(request));
  assert.equal(parsed.ok, true, JSON.stringify(parsed));
});

test("the id is the same for the same shape, and the name lists only the kept fields", () => {
  const output = webAutomationDerivedRecordOutput(request);
  assert.deepEqual(webAutomationDerivedRecordOutput(structuredClone(request)), output);
  assert.equal(output.label, "Extracted list: name, link");
  assert.match(output.datasetId, /^extracted-list-name-link:[0-9a-f]{16}$/u);
  assert.equal(output.datasetId.includes("password"), false);
  assert.equal(output.label?.includes("password"), false);
});

test("an element fingerprint does not change the id", () => {
  const fingerprinted: WebAutomationExtractListRequest = {
    ...request,
    itemElement: { tagName: "li", text: "Blue kettle" },
    fields: { ...request.fields, link: { kind: "link", selector: "a", element: { tagName: "a", text: "Blue kettle" } } }
  };
  assert.equal(webAutomationDerivedRecordOutput(fingerprinted).datasetId, webAutomationDerivedRecordOutput(request).datasetId);
});

test("anything that changes the rows' shape changes the id", () => {
  const base = webAutomationDerivedRecordOutput(request).datasetId;
  const variants: WebAutomationExtractListRequest[] = [
    { ...request, item: "li.card" },
    { ...request, fields: { ...request.fields, name: ".title" } },
    { ...request, fields: { ...request.fields, password: { kind: "text", selector: ".secret" } } },
    { ...request, fields: { ...request.fields, link: { kind: "link", selector: "a", required: false } } },
    { ...request, fields: { link: request.fields.link!, name: request.fields.name!, password: request.fields.password! } }
  ];
  const ids = variants.map((variant) => webAutomationDerivedRecordOutput(variant).datasetId);
  assert.equal(ids.includes(base), false);
  assert.equal(new Set(ids).size, ids.length);
});

test("pagination and the item bound change the rows kept, not the dataset", () => {
  const paged = webAutomationDerivedRecordOutput({ ...request, paginate: { mode: "scroll", maxScrolls: 4 }, maxItems: 20 });
  const plain = webAutomationDerivedRecordOutput(request);
  assert.equal(paged.datasetId, plain.datasetId);
  assert.equal(paged.maxRecords, 20);
  assert.equal(plain.maxRecords, 1_000);
});

test("a long field list is cut to Core's label bound", () => {
  const fields = Object.fromEntries(Array.from({ length: 40 }, (_, index) => [`field_number_${index}`, `.f${index}`]));
  const output = webAutomationDerivedRecordOutput({ item: "tr", fields });
  assert.equal(output.label?.length, 200);
  assert.equal(parseAutomationStudioRecordOutput(output).ok, true);
});
