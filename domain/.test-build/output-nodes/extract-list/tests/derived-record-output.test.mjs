// src/output-nodes/extract-list/tests/derived-record-output.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioRecordOutput } from "fluxiq/automation-studio";

// src/extraction/dataset-id.ts
var MAX_ID_LENGTH = 200;
var NONCE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/u;
var SEPARATOR = ":";
var FALLBACK_NAME = "dataset";
var OUTSIDE_NAME_CHARACTERS = /[^a-z0-9._-]+/u;
var COMBINING_MARKS = new RegExp("\\p{M}+", "gu");
function webAutomationDatasetId(label, nonce) {
  if (!NONCE_PATTERN.test(nonce)) {
    throw new RangeError("A dataset id nonce must be 1 to 64 characters of A-Z, a-z, 0-9, '.', '_' or '-'.");
  }
  const words = label.toLowerCase().normalize("NFKD").replace(COMBINING_MARKS, "").split(OUTSIDE_NAME_CHARACTERS).filter((word) => word.length > 0);
  const name = words.join("-").slice(0, MAX_ID_LENGTH - SEPARATOR.length - nonce.length) || FALLBACK_NAME;
  return `${name}${SEPARATOR}${nonce}`;
}

// src/actions/extraction/read-request.ts
var REFUSED = Symbol("refused");

// src/extraction/label-key.ts
var COMBINING_MARKS2 = new RegExp("\\p{M}+", "gu");

// src/output-nodes/extract-list/record-output.ts
var DEFAULT_MAX_RECORDS = 1e3;
var MAX_RECORDS_CEILING = 1e4;
var LABEL_MAX_LENGTH = 200;
function webAutomationRecordOutput(definition) {
  const taken = /* @__PURE__ */ new Set();
  const fields = Object.entries(definition.request.fields).map(([key, field]) => {
    const spec = typeof field === "string" ? void 0 : field;
    return {
      id: key,
      label: distinctLabel(definition.fieldLabels[key] ?? key, key, taken),
      // A link's target is a URL; everything else the page reads is text. A
      // number on the page is text too, because nothing has parsed it.
      valueType: spec?.kind === "link" ? "url" : "string",
      // A field is required unless it was picked as optional: an optional field
      // the page cannot read is `null`, which Core stores as an absent key (D16).
      required: spec?.required !== false,
      ...spec?.handling !== void 0 ? { handling: spec.handling } : {}
    };
  });
  return {
    datasetId: definition.datasetId,
    label: definition.label,
    schema: { schemaVersion: "0.1", fields },
    writeMode: "append",
    maxRecords: Math.min(definition.request.maxItems ?? DEFAULT_MAX_RECORDS, MAX_RECORDS_CEILING)
  };
}
function distinctLabel(label, key, taken) {
  const preferred = label.slice(0, LABEL_MAX_LENGTH);
  const distinct = taken.has(preferred) ? `${preferred} (${key})`.slice(0, LABEL_MAX_LENGTH) : preferred;
  const unique = taken.has(distinct) ? key.slice(0, LABEL_MAX_LENGTH) : distinct;
  taken.add(unique);
  return unique;
}

// src/output-nodes/extract-list/records-path.ts
var WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH = "result.extracted";

// src/output-nodes/extract-list/derived-record-output.ts
var LABEL_MAX_LENGTH2 = 200;
var LABEL_PREFIX = "Extracted list: ";
var DIGEST_SEEDS = [2166136261, 84696351];
var FNV_PRIME = 16777619;
function webAutomationDerivedRecordOutput(request2) {
  const label = derivedLabel(request2);
  return {
    ...webAutomationRecordOutput({ datasetId: webAutomationDatasetId(label, shapeDigest(request2)), label, request: request2, fieldLabels: {} }),
    recordsPath: WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH
  };
}
function derivedLabel(request2) {
  const kept = Object.entries(request2.fields).filter(([, field]) => typeof field === "string" || field.handling !== "exclude").map(([key]) => key);
  return `${LABEL_PREFIX}${kept.join(", ")}`.slice(0, LABEL_MAX_LENGTH2);
}
function shapeDigest(request2) {
  const shape = JSON.stringify([request2.item, Object.entries(request2.fields).map(([key, field]) => [key, fieldShape(field)])]);
  return DIGEST_SEEDS.map((seed) => fnv1a(shape, seed)).join("");
}
function fieldShape(field) {
  if (typeof field === "string") return field;
  return [field.kind, field.selector ?? null, field.attribute ?? null, field.header ?? null, field.required ?? null, field.handling ?? null];
}
function fnv1a(text, seed) {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// src/output-nodes/extract-list/tests/derived-record-output.test.ts
var request = {
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
  const fingerprinted = {
    ...request,
    itemElement: { tagName: "li", text: "Blue kettle" },
    fields: { ...request.fields, link: { kind: "link", selector: "a", element: { tagName: "a", text: "Blue kettle" } } }
  };
  assert.equal(webAutomationDerivedRecordOutput(fingerprinted).datasetId, webAutomationDerivedRecordOutput(request).datasetId);
});
test("anything that changes the rows' shape changes the id", () => {
  const base = webAutomationDerivedRecordOutput(request).datasetId;
  const variants = [
    { ...request, item: "li.card" },
    { ...request, fields: { ...request.fields, name: ".title" } },
    { ...request, fields: { ...request.fields, password: { kind: "text", selector: ".secret" } } },
    { ...request, fields: { ...request.fields, link: { kind: "link", selector: "a", required: false } } },
    { ...request, fields: { link: request.fields.link, name: request.fields.name, password: request.fields.password } }
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
  assert.equal(plain.maxRecords, 1e3);
});
test("a long field list is cut to Core's label bound", () => {
  const fields = Object.fromEntries(Array.from({ length: 40 }, (_, index) => [`field_number_${index}`, `.f${index}`]));
  const output = webAutomationDerivedRecordOutput({ item: "tr", fields });
  assert.equal(output.label?.length, 200);
  assert.equal(parseAutomationStudioRecordOutput(output).ok, true);
});
