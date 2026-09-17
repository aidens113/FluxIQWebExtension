// src/extraction/tests/structure-detection.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// src/actions/extraction/field-key.ts
var FIELD_KEY_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
var RESERVED_FIELD_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
function isWebAutomationExtractFieldKey(key) {
  return typeof key === "string" && FIELD_KEY_PATTERN.test(key) && !RESERVED_FIELD_KEYS.has(key);
}

// src/output-nodes/targets/targets.ts
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

// src/actions/extraction/request.ts
var WEB_AUTOMATION_EXTRACT_PAGINATION_MODES = ["next", "loadMore", "scroll", "numbered"];
var WEB_AUTOMATION_EXTRACT_FIELD_KINDS = ["text", "attribute", "link", "value", "column"];
var WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS = ["include", "exclude", "encrypt"];
var WEB_AUTOMATION_EXTRACT_MAX_PAGES = 50;
var WEB_AUTOMATION_EXTRACT_MAX_ITEMS = 1e3;

// src/actions/extraction/read-request.ts
function webAutomationExtractListRequestValue(value) {
  const request = jsonObject(value);
  const item = nonEmptyString(request?.item);
  const fields = fieldMapValue(request?.fields);
  if (!request || item === void 0 || fields === void 0) return void 0;
  if (FRAME_KEYS.some((key) => request[key] !== void 0)) return void 0;
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
var FRAME_KEYS = ["frame", "frameId", "frameSelector", "frameUrlPath"];
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

// src/extraction/structure-detection.ts
var WEB_AUTOMATION_STRUCTURE_DETECTION_REFUSALS = ["target_not_found", "ambiguous_target", "no_repeating_run", "sensitive_region"];
function webAutomationStructureDetectionRequestValue(value) {
  const request = record(value);
  if (!request || Object.keys(request).some((key) => key !== "selector")) return void 0;
  if (request.selector === void 0) return {};
  return typeof request.selector === "string" && request.selector.trim() !== "" ? { selector: request.selector } : void 0;
}
function webAutomationStructureDetectionValue(value) {
  const detection2 = record(value);
  if (!detection2) return void 0;
  if (detection2.ok === false) {
    const refused = WEB_AUTOMATION_STRUCTURE_DETECTION_REFUSALS.find((code) => code === detection2.refused);
    return refused === void 0 ? void 0 : { ok: false, refused };
  }
  if (detection2.ok !== true) return void 0;
  if (detection2.infiniteScroll !== void 0 && detection2.infiniteScroll !== true) return void 0;
  const proposal = proposalValue(detection2.proposal);
  if (!proposal) return void 0;
  return detection2.infiniteScroll === true ? { ok: true, proposal, infiniteScroll: true } : { ok: true, proposal };
}
function proposalValue(value) {
  const proposal = record(value);
  if (!proposal || typeof proposal.container !== "string" || proposal.container === "") return void 0;
  if (!Array.isArray(proposal.fields) || proposal.fields.length === 0) return void 0;
  const itemCount = count(proposal.itemCount);
  const confidence = unitInterval(proposal.confidence);
  const fields = proposal.fields.map(fieldValue2);
  if (itemCount === void 0 || confidence === void 0) return void 0;
  const named = fields.filter((field) => field !== void 0);
  if (named.length !== fields.length || new Set(named.map((field) => field.key)).size !== named.length) return void 0;
  const request = webAutomationExtractListRequestValue({
    item: proposal.item,
    fields: Object.fromEntries(named.map((field) => [field.key, field.spec])),
    paginate: proposal.pagination
  });
  if (!request) return void 0;
  const copied = [];
  for (const field of named) {
    const spec = request.fields[field.key];
    if (spec === void 0 || typeof spec === "string") return void 0;
    copied.push({ key: field.key, label: field.label, spec, coverage: field.coverage });
  }
  const pagination = request.paginate;
  return pagination === void 0 ? { container: proposal.container, item: request.item, itemCount, fields: copied, confidence } : { container: proposal.container, item: request.item, itemCount, fields: copied, pagination, confidence };
}
function fieldValue2(value) {
  const field = record(value);
  const spec = record(field?.spec);
  if (!field || !spec || spec.element !== void 0) return void 0;
  if (typeof field.key !== "string" || typeof field.label !== "string") return void 0;
  const coverage = unitInterval(field.coverage);
  return coverage === void 0 ? void 0 : { key: field.key, label: field.label, spec, coverage };
}
function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function count(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
}
function unitInterval(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : void 0;
}

// src/extraction/tests/structure-detection.test.ts
function detection() {
  return {
    ok: true,
    proposal: {
      container: "#list",
      item: "#list > li",
      itemCount: 3,
      fields: [
        { key: "name", label: "name", spec: { kind: "text", selector: ".name", required: true }, coverage: 1 },
        { key: "link", label: "link", spec: { kind: "link", selector: "a", required: false }, coverage: 0.67 },
        { key: "secret", label: "secret", spec: { kind: "value", selector: "input", handling: "exclude", required: true }, coverage: 1 }
      ],
      pagination: { next: "a[rel=next]", maxPages: 4 },
      confidence: 0.9
    }
  };
}
test("a well-formed detection is copied exactly, and a refusal is copied by its word alone", () => {
  assert.deepEqual(webAutomationStructureDetectionValue(detection()), detection());
  const feed = { ...detection(), infiniteScroll: true, proposal: { ...detection().proposal, pagination: void 0 } };
  delete feed.proposal.pagination;
  assert.deepEqual(webAutomationStructureDetectionValue(feed), feed);
  for (const refused of WEB_AUTOMATION_STRUCTURE_DETECTION_REFUSALS) {
    assert.deepEqual(webAutomationStructureDetectionValue({ ok: false, refused, detail: "page text" }), { ok: false, refused });
  }
  assert.deepEqual([...WEB_AUTOMATION_STRUCTURE_DETECTION_REFUSALS], ["target_not_found", "ambiguous_target", "no_repeating_run", "sensitive_region"]);
});
test("whatever a producer put beside the declared fields is left behind", () => {
  const noisy = detection();
  noisy.sample = "a page value";
  noisy.proposal.sample = "a page value";
  noisy.proposal.fields[0].sample = "a page value";
  noisy.proposal.fields[0].spec.sample = "a page value";
  noisy.proposal.pagination.sample = "a page value";
  const copied = webAutomationStructureDetectionValue(noisy);
  assert.deepEqual(copied, detection());
  assert.equal(JSON.stringify(copied).includes("a page value"), false);
});
test("a detection any part of which is malformed is refused whole", () => {
  const broken = [
    ["an unknown refusal", (value) => Object.assign(value, { ok: false, refused: "because" })],
    ["no ok flag", (value) => {
      delete value.ok;
    }],
    ["a false infinite-scroll flag", (value) => {
      value.infiniteScroll = false;
    }],
    ["no proposal", (value) => {
      delete value.proposal;
    }],
    ["an empty container", (value) => {
      value.proposal.container = "";
    }],
    ["no item", (value) => {
      delete value.proposal.item;
    }],
    ["a negative count", (value) => {
      value.proposal.itemCount = -1;
    }],
    ["a fractional count", (value) => {
      value.proposal.itemCount = 2.5;
    }],
    ["a confidence above one", (value) => {
      value.proposal.confidence = 1.2;
    }],
    ["no fields", (value) => {
      value.proposal.fields = [];
    }],
    ["a coverage above one", (value) => {
      value.proposal.fields[0].coverage = 1.5;
    }],
    ["a label that is not text", (value) => {
      value.proposal.fields[0].label = 7;
    }],
    ["a malformed key", (value) => {
      value.proposal.fields[0].key = "has space";
    }],
    ["a prototype key", (value) => {
      value.proposal.fields[0].key = "__proto__";
    }],
    ["a repeated key", (value) => {
      value.proposal.fields[1].key = "name";
    }],
    ["an element fingerprint, which holds page values", (value) => {
      value.proposal.fields[0].spec.element = { tagName: "span", text: "Ada" };
    }],
    ["an unknown kind", (value) => {
      value.proposal.fields[0].spec.kind = "html";
    }],
    ["an attribute on a text field", (value) => {
      value.proposal.fields[0].spec.attribute = "href";
    }],
    ["an unknown pagination mode", (value) => {
      value.proposal.pagination = { mode: "teleport", maxPages: 2 };
    }],
    ["a pagination with no bound", (value) => {
      value.proposal.pagination = { next: "a" };
    }],
    ["every field excluded", (value) => {
      for (const field of value.proposal.fields) field.spec.handling = "exclude";
    }]
  ];
  for (const [why, damage] of broken) {
    const value = detection();
    damage(value);
    assert.equal(webAutomationStructureDetectionValue(value), void 0, why);
  }
  for (const value of [void 0, null, "ok", [], 1]) assert.equal(webAutomationStructureDetectionValue(value), void 0);
});
test("the request is empty or names one selector, and nothing else", () => {
  assert.deepEqual(webAutomationStructureDetectionRequestValue({}), {});
  assert.deepEqual(webAutomationStructureDetectionRequestValue({ selector: "#list li" }), { selector: "#list li" });
  for (const value of [void 0, null, [], "#list", { selector: "" }, { selector: "   " }, { selector: 3 }, { selector: "#a", frame: 1 }, { target: "target.1" }]) {
    assert.equal(webAutomationStructureDetectionRequestValue(value), void 0, JSON.stringify(value));
  }
});
