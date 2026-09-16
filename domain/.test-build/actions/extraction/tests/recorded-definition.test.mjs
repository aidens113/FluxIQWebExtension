// domain/src/actions/extraction/tests/recorded-definition.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// domain/src/actions/extraction/field-key.ts
var FIELD_KEY_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
var RESERVED_FIELD_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
function isWebAutomationExtractFieldKey(key) {
  return typeof key === "string" && FIELD_KEY_PATTERN.test(key) && !RESERVED_FIELD_KEYS.has(key);
}

// domain/src/output-nodes/targets/targets.ts
function elementFingerprint(value) {
  const element = objectValue(value);
  if (!element) return void 0;
  const attributes = elementAttributes(element.attributes);
  return compact({
    selector: stringValue(element.selector),
    xpath: stringValue(element.xpath),
    id: stringValue(element.id),
    classNames: Array.isArray(element.classNames) ? element.classNames.filter((item) => typeof item === "string") : void 0,
    visibleText: stringValue(element.visibleText),
    tagName: stringValue(element.tagName),
    text: stringValue(element.text),
    value: stringValue(element.value),
    role: stringValue(element.role),
    implicitRole: stringValue(element.implicitRole),
    name: stringValue(element.name),
    href: stringValue(element.href),
    inputType: stringValue(element.inputType),
    checked: booleanValue(element.checked),
    testId: elementTestId(element, attributes),
    accessibleName: stringValue(element.accessibleName) ?? stringValue(attributes?.["aria-label"]),
    label: stringValue(element.label),
    attributes,
    context: elementContext(element.context),
    // Core's remaining fingerprint signals, named so their absence is a
    // decision and so a signal Core adds stops this producer compiling. A
    // browser recording has no source for any of them: the first four are a
    // host application's own identifiers and a Core state path, `url` names
    // the page rather than the control, `bounds` are the capture's viewport
    // and not this instant's (which is why `content/identity/score.ts` refuses
    // to compare them), and `metadata` is Core's own passthrough slot, which
    // this normalizer must not start writing into behind the declared fields.
    automationId: void 0,
    entityId: void 0,
    entityKind: void 0,
    statePath: void 0,
    queryPath: void 0,
    url: void 0,
    bounds: void 0,
    metadata: void 0
  });
}
function elementContext(value) {
  const context = objectValue(value);
  if (!context) return void 0;
  const fields = compact({
    formId: stringValue(context.formId),
    formName: stringValue(context.formName),
    formAction: stringValue(context.formAction),
    fieldsetLegend: stringValue(context.fieldsetLegend),
    landmark: stringValue(context.landmark),
    landmarkName: stringValue(context.landmarkName),
    heading: stringValue(context.heading),
    listPosition: listPosition(context.listPosition),
    tablePosition: tablePosition(context.tablePosition)
  });
  return Object.keys(fields).length > 0 ? fields : void 0;
}
function listPosition(value) {
  const position = objectValue(value);
  const index = numberValue(position?.index);
  const total = numberValue(position?.total);
  return index === void 0 || total === void 0 ? void 0 : { index, total };
}
function tablePosition(value) {
  const position = objectValue(value);
  const row = numberValue(position?.row);
  const column = numberValue(position?.column);
  if (row === void 0 || column === void 0) return void 0;
  const columnHeader = stringValue(position?.columnHeader);
  return columnHeader === void 0 ? { row, column } : { row, column, columnHeader };
}
function elementAttributes(value) {
  const attributes = objectValue(value);
  if (!attributes) return void 0;
  const strings = {};
  for (const [name, item] of Object.entries(attributes)) {
    if (typeof item === "string") strings[name] = item;
  }
  return strings;
}
function elementTestId(element, attributes) {
  return stringValue(element.testId) ?? stringValue(attributes?.["data-testid"]) ?? stringValue(attributes?.["data-test"]) ?? stringValue(attributes?.["data-cy"]);
}
function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== void 0));
}
function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function stringValue(value) {
  return typeof value === "string" ? value : void 0;
}
function numberValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function booleanValue(value) {
  return typeof value === "boolean" ? value : void 0;
}

// domain/src/actions/extraction/request.ts
var WEB_AUTOMATION_EXTRACT_PAGINATION_MODES = ["next", "loadMore", "scroll", "numbered"];
var WEB_AUTOMATION_EXTRACT_FIELD_KINDS = ["text", "attribute", "link", "value", "column"];
var WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS = ["include", "exclude", "encrypt"];
var WEB_AUTOMATION_EXTRACT_READ_MODES = ["text", "attribute", "value", "html"];
var WEB_AUTOMATION_EXTRACT_MAX_PAGES = 50;
var WEB_AUTOMATION_EXTRACT_MAX_ITEMS = 1e3;

// domain/src/actions/extraction/read-request.ts
function webAutomationExtractListRequestValue(value) {
  const request = jsonObject(value);
  const item = nonEmptyString(request?.item);
  const fields = fieldMapValue(request?.fields);
  if (!request || item === void 0 || fields === void 0) return void 0;
  const itemElement = optionalValue(request.itemElement, fingerprintValue);
  if (itemElement === REFUSED) return void 0;
  const paginate = request.paginate === void 0 ? void 0 : paginationValue(request.paginate);
  if (request.paginate !== void 0 && paginate === void 0) return void 0;
  const namedMaxItems = positiveInteger(request.maxItems);
  const maxItems = namedMaxItems === void 0 ? void 0 : Math.min(namedMaxItems, WEB_AUTOMATION_EXTRACT_MAX_ITEMS);
  const minItems = nonNegativeInteger(request.minItems);
  if (request.minItems !== void 0 && minItems === void 0) return void 0;
  if (minItems !== void 0 && minItems > (maxItems ?? WEB_AUTOMATION_EXTRACT_MAX_ITEMS)) return void 0;
  return {
    item,
    ...itemElement !== void 0 ? { itemElement } : {},
    fields,
    ...paginate !== void 0 ? { paginate } : {},
    ...maxItems !== void 0 ? { maxItems } : {},
    ...minItems !== void 0 ? { minItems } : {}
  };
}
function webAutomationExtractReadValue(value) {
  const read = jsonObject(value);
  const mode = memberOf(read?.mode, WEB_AUTOMATION_EXTRACT_READ_MODES);
  if (!read || mode === void 0) return void 0;
  const attribute = mode === "attribute" ? nonEmptyString(read.attribute) : void 0;
  if (mode === "attribute" ? attribute === void 0 : read.attribute !== void 0) return void 0;
  return { mode, ...attribute !== void 0 ? { attribute } : {} };
}
function fieldMapValue(value) {
  const fields = jsonObject(value);
  if (!fields) return void 0;
  const read = [];
  for (const [key, entry] of Object.entries(fields)) {
    const field = isWebAutomationExtractFieldKey(key) ? fieldValue(entry) : void 0;
    if (field === void 0) return void 0;
    read.push([key, field]);
  }
  if (read.length === 0 || read.every(([, field]) => typeof field !== "string" && field.handling === "exclude")) return void 0;
  return Object.fromEntries(read);
}
function fieldValue(value) {
  if (typeof value === "string") return value.length > 0 ? value : void 0;
  const spec = jsonObject(value);
  const kind = memberOf(spec?.kind, WEB_AUTOMATION_EXTRACT_FIELD_KINDS);
  if (!spec || kind === void 0) return void 0;
  const attribute = kind === "attribute" ? nonEmptyString(spec.attribute) : void 0;
  const header = kind === "column" ? nonEmptyString(spec.header) : void 0;
  if (kind === "attribute" ? attribute === void 0 : spec.attribute !== void 0) return void 0;
  if (kind === "column" ? header === void 0 : spec.header !== void 0) return void 0;
  const selector = optionalValue(spec.selector, nonEmptyString);
  const required = optionalValue(spec.required, booleanValue2);
  const handling = optionalValue(spec.handling, (entry) => memberOf(entry, WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS));
  const element = optionalValue(spec.element, fingerprintValue);
  if (selector === REFUSED || required === REFUSED || handling === REFUSED || element === REFUSED) return void 0;
  const field = {
    kind,
    ...selector !== void 0 ? { selector } : {},
    ...attribute !== void 0 ? { attribute } : {},
    ...header !== void 0 ? { header } : {},
    ...required !== void 0 ? { required } : {},
    ...handling !== void 0 ? { handling } : {},
    ...element !== void 0 ? { element } : {}
  };
  return field;
}
function paginationValue(value) {
  const paginate = jsonObject(value);
  if (!paginate) return void 0;
  const mode = paginate.mode === void 0 ? "next" : memberOf(paginate.mode, WEB_AUTOMATION_EXTRACT_PAGINATION_MODES);
  if (mode === void 0) return void 0;
  const ownKeys = PAGINATION_KEYS[mode];
  if (Object.values(PAGINATION_KEYS).flat().some((key) => !ownKeys.includes(key) && paginate[key] !== void 0)) return void 0;
  if (mode === "scroll") {
    const maxScrolls = positiveInteger(paginate.maxScrolls);
    return maxScrolls === void 0 ? void 0 : { mode, maxScrolls: Math.min(maxScrolls, WEB_AUTOMATION_EXTRACT_MAX_PAGES) };
  }
  const requestedPages = positiveInteger(paginate.maxPages);
  if (requestedPages === void 0) return void 0;
  const maxPages = Math.min(requestedPages, WEB_AUTOMATION_EXTRACT_MAX_PAGES);
  if (mode === "next") {
    const next = nonEmptyString(paginate.next);
    return next === void 0 ? void 0 : { next, maxPages };
  }
  if (mode === "loadMore") {
    const control = nonEmptyString(paginate.control);
    return control === void 0 ? void 0 : { mode, control, maxPages };
  }
  const pages = nonEmptyString(paginate.pages);
  return pages === void 0 ? void 0 : { mode, pages, maxPages };
}
var PAGINATION_KEYS = {
  next: ["next", "maxPages"],
  loadMore: ["control", "maxPages"],
  scroll: ["maxScrolls"],
  numbered: ["pages", "maxPages"]
};
function fingerprintValue(value) {
  const fingerprint = elementFingerprint(value);
  return fingerprint !== void 0 && Object.keys(fingerprint).length > 0 ? fingerprint : void 0;
}
var REFUSED = Symbol("refused");
function optionalValue(value, read) {
  if (value === void 0) return void 0;
  const readable = read(value);
  return readable === void 0 ? REFUSED : readable;
}
function booleanValue2(value) {
  return typeof value === "boolean" ? value : void 0;
}
function nonNegativeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
}
function positiveInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : void 0;
}
function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function memberOf(value, members) {
  return typeof value === "string" && members.includes(value) ? value : void 0;
}
function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}

// domain/src/actions/extraction/recorded-definition.ts
var DATASET_ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/u;
var RESERVED_DATASET_IDS = /* @__PURE__ */ new Set([".", ".."]);
var LABEL_MAX_LENGTH = 200;
function webAutomationRecordedExtraction(value) {
  const definition = jsonObject2(value);
  if (!definition) return void 0;
  if (definition.form === "value") return recordedValueExtraction(definition);
  return definition.form === "list" ? recordedListExtraction(definition) : void 0;
}
function recordedListExtraction(definition) {
  const datasetId = datasetIdValue(definition.datasetId);
  const label = labelValue(definition.label);
  const request = webAutomationExtractListRequestValue(definition.request);
  const itemCount = nonNegativeInteger2(definition.itemCount);
  if (datasetId === void 0 || label === void 0 || request === void 0 || itemCount === void 0) return void 0;
  const fieldLabels = fieldLabelsValue(definition.fieldLabels, request);
  if (fieldLabels === void 0) return void 0;
  return { form: "list", datasetId, label, request, fieldLabels, itemCount };
}
function recordedValueExtraction(definition) {
  const label = labelValue(definition.label);
  const read = webAutomationExtractReadValue(definition.read);
  return label === void 0 || read === void 0 ? void 0 : { form: "value", label, read };
}
function fieldLabelsValue(value, request) {
  if (value === void 0) return {};
  const labels = jsonObject2(value);
  if (!labels) return void 0;
  const read = [];
  for (const [key, entry] of Object.entries(labels)) {
    if (!isWebAutomationExtractFieldKey(key) || !(key in request.fields)) continue;
    const label = labelValue(entry);
    if (label === void 0) return void 0;
    read.push([key, label]);
  }
  return Object.fromEntries(read);
}
function datasetIdValue(value) {
  return typeof value === "string" && !RESERVED_DATASET_IDS.has(value) && DATASET_ID_PATTERN.test(value) ? value : void 0;
}
function labelValue(value) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= LABEL_MAX_LENGTH ? value : void 0;
}
function nonNegativeInteger2(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
}
function jsonObject2(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}

// domain/src/actions/extraction/tests/recorded-definition.test.ts
var SAMPLE = "SENTINEL-PAGE-VALUE-A-RECORDING-MUST-NOT-CARRY";
function listDefinition(overrides = {}) {
  return {
    form: "list",
    datasetId: "products:4f1c9a",
    label: "Products",
    itemCount: 24,
    request: {
      item: "li.product",
      fields: {
        name: { kind: "text", selector: ".name" },
        price: { kind: "text", selector: ".price" }
      }
    },
    fieldLabels: { name: "Product name", price: "Price" },
    ...overrides
  };
}
test("a sample value planted beside the definition is dropped", () => {
  const definition = webAutomationRecordedExtraction(listDefinition({
    samples: [{ name: SAMPLE, price: SAMPLE }],
    preview: { rows: [[SAMPLE]] },
    itemText: SAMPLE
  }));
  assert.ok(definition, "the definition itself is still read");
  assert.equal(JSON.stringify(definition).includes(SAMPLE), false, "no planted value reaches the recording");
  assert.deepEqual(Object.keys(definition).sort(), ["datasetId", "fieldLabels", "form", "itemCount", "label", "request"]);
});
test("an unknown key inside the request and inside a field spec is dropped too", () => {
  const definition = webAutomationRecordedExtraction(listDefinition({
    request: {
      item: "li.product",
      fields: { name: { kind: "text", selector: ".name", sampleValue: SAMPLE } },
      containerText: SAMPLE
    }
  }));
  assert.ok(definition);
  assert.equal(JSON.stringify(definition).includes(SAMPLE), false);
  assert.deepEqual(definition.form === "list" ? definition.request.fields : void 0, { name: { kind: "text", selector: ".name" } });
});
test("a field key a page could have produced is refused, whole", () => {
  for (const key of ["Product name", "price.amount", "__proto__", "constructor", "prototype", "a".repeat(101), "prix\u20AC"]) {
    const definition = webAutomationRecordedExtraction(listDefinition({
      request: { item: "li.product", fields: { [key]: { kind: "text" } } },
      fieldLabels: {}
    }));
    assert.equal(definition, void 0, `a field keyed ${key} is not recorded`);
  }
  assert.ok(
    webAutomationRecordedExtraction(listDefinition({
      request: { item: "li.product", fields: { "order-total_2": { kind: "text" } } },
      fieldLabels: {}
    })),
    "the key grammar Core accepts is accepted"
  );
});
test("a dataset id Core would refuse is refused here", () => {
  for (const datasetId of ["products/4f1c", "products 4f1c", ".", "..", "", "a".repeat(201), 7, null]) {
    assert.equal(webAutomationRecordedExtraction(listDefinition({ datasetId })), void 0, JSON.stringify(datasetId));
  }
  assert.ok(webAutomationRecordedExtraction(listDefinition({ datasetId: "products.v2:4f1c-9a_b" })), "the id grammar Core accepts is accepted");
});
test("a label for a field the request does not read is dropped, and a malformed one refuses the definition", () => {
  const dropped = webAutomationRecordedExtraction(listDefinition({
    fieldLabels: { name: "Product name", price: "Price", card_number: "Card number" }
  }));
  assert.deepEqual(dropped?.form === "list" ? dropped.fieldLabels : void 0, { name: "Product name", price: "Price" }, "a label for a column that is not read names nothing");
  for (const label of [7, "", "   ", "a".repeat(201)]) {
    assert.equal(webAutomationRecordedExtraction(listDefinition({ fieldLabels: { name: label } })), void 0, JSON.stringify(label));
  }
});
test("a definition whose request cannot be read is not a definition", () => {
  for (const request of [void 0, {}, { item: "li" }, { item: "", fields: { name: "a" } }, { item: "li", fields: {} }, { item: "li", fields: { name: { kind: "sample" } } }]) {
    assert.equal(webAutomationRecordedExtraction(listDefinition({ request })), void 0, JSON.stringify(request));
  }
});
test("the single-value form records what to read and what the user called it", () => {
  assert.deepEqual(
    webAutomationRecordedExtraction({ form: "value", label: "Order total", read: { mode: "attribute", attribute: "data-total" }, value: SAMPLE, text: SAMPLE }),
    { form: "value", label: "Order total", read: { mode: "attribute", attribute: "data-total" } }
  );
  assert.deepEqual(webAutomationRecordedExtraction({ form: "value", label: "Heading", read: { mode: "text" } }), { form: "value", label: "Heading", read: { mode: "text" } });
  assert.equal(webAutomationRecordedExtraction({ form: "value", label: "Heading", read: { mode: "attribute" } }), void 0, "an attribute read must name its attribute");
  assert.equal(webAutomationRecordedExtraction({ form: "value", label: "Heading", read: { mode: "text", attribute: "href" } }), void 0, "a text read must not name one");
  assert.equal(webAutomationRecordedExtraction({ form: "value", label: "Heading", read: { mode: "innerText" } }), void 0, "an unknown mode is not a read");
});
test("anything that is not a declared form is not a definition", () => {
  for (const value of [void 0, null, "list", 7, [], { form: "table" }, {}, listDefinition({ form: void 0 })]) {
    assert.equal(webAutomationRecordedExtraction(value), void 0, JSON.stringify(value) ?? "undefined");
  }
});
test("itemCount is a count, not text the page supplied", () => {
  assert.equal(webAutomationRecordedExtraction(listDefinition({ itemCount: 0 }))?.form === "list", true, "an empty list was still a list when it was picked");
  for (const itemCount of [-1, 1.5, "24", void 0, null]) {
    assert.equal(webAutomationRecordedExtraction(listDefinition({ itemCount })), void 0, JSON.stringify(itemCount));
  }
});
