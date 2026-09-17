// src/output-nodes/tests/payloads.test.ts
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
    tablePosition: tablePosition(context.tablePosition),
    record: elementRecord(context.record)
  });
  return Object.keys(fields).length > 0 ? fields : void 0;
}
function listPosition(value) {
  const position = objectValue(value);
  const index = numberValue(position?.index);
  const total = numberValue(position?.total);
  return index === void 0 || total === void 0 ? void 0 : { index, total };
}
function elementRecord(value) {
  const record = objectValue(value);
  if (!record) return void 0;
  const fields = compact({
    keyAttribute: stringValue(record.keyAttribute),
    key: stringValue(record.key),
    text: stringValue(record.text)
  });
  return Object.keys(fields).length > 0 ? fields : void 0;
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
var WEB_AUTOMATION_EXTRACT_READ_MODES = ["text", "attribute", "value", "html"];
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

// src/actions/extraction/recorded-definition.ts
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

// src/sensitivity/signature.ts
var SENSITIVE_CONTROL_TYPES = /* @__PURE__ */ new Set(["password", "one-time-code", "credit-card"]);
var SENSITIVE_AUTOCOMPLETE_TOKENS = /* @__PURE__ */ new Set(["current-password", "new-password", "one-time-code"]);
var SENSITIVE_AUTOCOMPLETE_PREFIX = "cc-";
function isSensitiveFieldSignature(signature) {
  if (isSensitiveControlType(signature.inputType) || isSensitiveControlType(signature.controlType)) return true;
  if (signature.dataSensitive?.trim().toLowerCase() === "true") return true;
  return (signature.autocomplete ?? "").toLowerCase().split(/\s+/u).some((token) => Boolean(token) && (SENSITIVE_AUTOCOMPLETE_TOKENS.has(token) || token.startsWith(SENSITIVE_AUTOCOMPLETE_PREFIX)));
}
function isSensitiveControlType(type) {
  return type !== void 0 && SENSITIVE_CONTROL_TYPES.has(type.trim().toLowerCase());
}

// src/sensitivity/descriptor.ts
function sensitiveFieldSignatureOfDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) return {};
  const record = descriptor;
  const attributes = record.attributes && typeof record.attributes === "object" && !Array.isArray(record.attributes) ? record.attributes : {};
  return {
    inputType: stringField(record.inputType),
    controlType: stringField(attributes.type),
    autocomplete: stringField(attributes.autocomplete),
    dataSensitive: stringField(attributes["data-sensitive"])
  };
}
function isSensitiveElementDescriptor(descriptor) {
  return isSensitiveFieldSignature(sensitiveFieldSignatureOfDescriptor(descriptor));
}
function stringField(value) {
  return typeof value === "string" ? value : void 0;
}

// src/output-nodes/recorded-element-key.ts
function webAutomationRecordedElementKey(payload) {
  const element = objectValue(payload.element);
  const attributes = objectValue(element?.attributes);
  const statePath = stringValue(objectValue(payload.visualTarget)?.statePath);
  const fromStatePath = statePath?.startsWith("web.elements.") ? statePath.slice("web.elements.".length) : void 0;
  const identity = fromStatePath ?? stringValue(element?.testId) ?? stringValue(attributes?.["data-testid"]) ?? stringValue(attributes?.["data-test"]) ?? stringValue(attributes?.["data-cy"]) ?? stringValue(element?.id) ?? stringValue(attributes?.id) ?? stringValue(element?.name) ?? stringValue(attributes?.name) ?? stringValue(element?.selector) ?? stringValue(payload.selector);
  const key = sanitizeRecordedElementKey(identity ?? "");
  return key.length ? key : void 0;
}
function sanitizeRecordedElementKey(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 120);
}

// src/output-nodes/secret-binding.ts
var WEB_AUTOMATION_SECRET_STATE_PREFIX = "web.secret.";
function webAutomationSecretStatePath(key) {
  return `${WEB_AUTOMATION_SECRET_STATE_PREFIX}${key}`;
}
function webAutomationSecretBinding(key) {
  return { $state: { path: webAutomationSecretStatePath(key) } };
}

// src/output-nodes/upload-binding.ts
var WEB_AUTOMATION_UPLOAD_STATE_PREFIX = "web.upload.";
function webAutomationUploadStatePath(key) {
  return `${WEB_AUTOMATION_UPLOAD_STATE_PREFIX}${key}`;
}
function webAutomationUploadBinding(key) {
  return { $state: { path: webAutomationUploadStatePath(key) } };
}

// src/output-nodes/url-path.ts
function webAutomationUrlPath(value) {
  return typeof value === "string" && /^\/(?![/\\])[^?#]*$/u.test(value) ? value : void 0;
}

// src/output-nodes/payloads.ts
function webAutomationOutputPayload(outputId, payload) {
  return withRecordedFrame(outputId, payload, recordedOutputParameters(outputId, payload));
}
function withRecordedFrame(outputId, payload, parameters) {
  const browserFrameId = frameIdValue(payload.browserFrameId);
  if (browserFrameId === void 0 || !outputId.startsWith("web.dom.")) return parameters;
  if (Object.keys(parameters).length === 0) return parameters;
  const browserFrameUrlPath = browserFrameId > 0 ? httpUrlPath(payload.url) : void 0;
  return { ...parameters, browserFrameId, ...browserFrameUrlPath !== void 0 ? { browserFrameUrlPath } : {} };
}
function frameIdValue(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
}
function httpUrlPath(value) {
  if (typeof value !== "string") return void 0;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.pathname : void 0;
  } catch {
    return void 0;
  }
}
function recordedOutputParameters(outputId, payload) {
  const element = elementFingerprint(payload.element);
  const selector = stringValue(element?.selector);
  const visualTarget = objectValue(payload.visualTarget);
  const target = compact({ ...element ? { element } : {}, ...visualTarget ? { visualTarget } : {} });
  const hasTarget = Object.keys(target).length > 0;
  if (outputId === "web.browser.navigate") return compact({ url: stringValue(payload.url) });
  if (outputId === "web.dom.click" || outputId === "web.dom.clear") return compact({ selector, ...hasTarget ? target : {} });
  if (outputId === "web.dom.type") return compact({ selector, text: recordedTypedText(payload), ...hasTarget ? target : {} });
  if (outputId === "web.dom.select") return compact({ selector, value: stringValue(payload.inputValue) ?? "", ...hasTarget ? target : {} });
  if (outputId === "web.dom.keypress") return compact({ selector, key: stringValue(payload.key) ?? "", ...hasTarget ? target : {} });
  if (outputId === "web.dom.scroll") {
    const scroll = objectValue(payload.scroll);
    return compact({ x: numberValue(scroll?.x), y: numberValue(scroll?.y) });
  }
  if (outputId === "web.dom.check") {
    const checked = recordedCheckedState(payload);
    return compact({ selector, checked, ...hasTarget ? target : {} });
  }
  if (outputId === "web.dom.wait_for_selector") return compact({ selector, ...hasTarget ? target : {} });
  if (outputId === "web.dom.wait_for_text") return compact({ text: stringValue(payload.inputValue) ?? stringValue(payload.title) });
  if (outputId === "web.dom.extract") {
    const read = recordedValueRead(payload);
    return compact({ selector, ...hasTarget ? target : {}, ...read !== void 0 ? { extract: read } : {} });
  }
  if (outputId === "web.dom.extract_list") return recordedListExtractionParameters(payload);
  if (outputId === "web.dom.upload") return recordedUploadParameters(payload, selector, target);
  if (outputId === "web.browser.tab") return recordedTabParameters(payload);
  if (outputId === "web.dom.capture_snapshot") return {};
  return {};
}
function recordedListExtractionParameters(payload) {
  const definition = webAutomationRecordedExtraction(payload.extraction);
  return definition?.form === "list" ? { extractList: definition.request } : {};
}
function recordedValueRead(payload) {
  const definition = webAutomationRecordedExtraction(payload.extraction);
  return definition?.form === "value" ? definition.read : void 0;
}
function recordedUploadParameters(payload, selector, target) {
  const key = webAutomationRecordedElementKey(payload);
  if (key === void 0) return {};
  const element = objectValue(target.element);
  const fileTarget = element === void 0 ? target : { ...target, element: Object.fromEntries(Object.entries(element).filter(([name]) => name !== "value")) };
  return compact({ selector, upload: webAutomationUploadBinding(key), ...fileTarget });
}
function recordedTabParameters(payload) {
  const tab = objectValue(payload.tab);
  if (tab?.operation === "close") return { tab: { operation: "close" } };
  if (tab?.operation !== "switch") return {};
  const urlPath = webAutomationUrlPath(tab.urlPath);
  return { tab: { operation: "switch", ...urlPath !== void 0 ? { urlPath } : {} } };
}
function recordedTypedText(payload) {
  const recorded = stringValue(payload.inputValue);
  if (recorded !== void 0) return recorded;
  if (!isSensitiveElementDescriptor(payload.element)) return "";
  const key = webAutomationRecordedElementKey(payload);
  return key === void 0 ? "" : webAutomationSecretBinding(key);
}
function recordedCheckedState(payload) {
  const element = objectValue(payload.element);
  if (!element) return void 0;
  if (typeof element.checked === "boolean") return element.checked;
  const ariaChecked = stringValue(objectValue(element.attributes)?.["aria-checked"]);
  if (ariaChecked === "true") return true;
  if (ariaChecked === "false") return false;
  return isRadioElement(element) ? true : void 0;
}
function isRadioElement(element) {
  return stringValue(element.inputType)?.toLowerCase() === "radio" || stringValue(element.role)?.toLowerCase() === "radio";
}

// src/output-nodes/tests/payloads.test.ts
var checkbox = { selector: "input#terms", tagName: "input", inputType: "checkbox", id: "terms" };
var radio = { selector: "input#plan-team", tagName: "input", inputType: "radio", id: "plan-team" };
test("a checkbox with a recorded checked state maps to that state", () => {
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: { ...checkbox, checked: true }, inputValue: "on" }).checked, true);
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: { ...checkbox, checked: false }, inputValue: "on" }).checked, false);
});
test("a checkbox with no recorded state carries no state, rather than a guess", () => {
  const parameters = webAutomationOutputPayload("web.dom.check", { element: checkbox, inputValue: "on" });
  assert.equal("checked" in parameters, false, "the recorded value 'on' is the value attribute, not the checked state");
  assert.equal(parameters.selector, "input#terms", "the target is still recorded");
});
test("a custom control's aria-checked is a recorded state", () => {
  const widget = { selector: "#toggle", tagName: "div", role: "switch", attributes: { "aria-checked": "true" } };
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: widget }).checked, true);
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: { ...widget, attributes: { "aria-checked": "false" } } }).checked, false);
});
test("a radio needs no recorded state: its change can only mean selected", () => {
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: radio, inputValue: "team" }).checked, true);
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: { selector: "#r", tagName: "div", role: "radio" } }).checked, true);
});
test("a check keeps the fingerprint and visual target replay falls back on", () => {
  const visualTarget = { namespace: "web", statePath: "web.elements.terms", selector: "input#terms" };
  const parameters = webAutomationOutputPayload("web.dom.check", { element: { ...checkbox, checked: true, xpath: "/html/body/form/input" }, visualTarget });
  assert.equal(parameters.element.xpath, "/html/body/form/input");
  assert.deepEqual(parameters.visualTarget, visualTarget);
});
test("the dispatch-only actions have no recorded payload", () => {
  for (const outputId of ["web.dom.assert", "web.dom.dialog", "web.browser.download"]) {
    assert.deepEqual(webAutomationOutputPayload(outputId, { element: checkbox, inputValue: "on" }), {}, outputId);
  }
});
var listRequest = { item: "li.product", fields: { name: { kind: "text", selector: ".name" } }, paginate: { next: "a.next", maxPages: 3 } };
var listExtraction = { form: "list", datasetId: "products:4f1c9a", label: "Products", itemCount: 24, request: listRequest, fieldLabels: { name: "Product name" } };
test("a recorded list extraction carries its request, and the frame it was recorded in", () => {
  const parameters = webAutomationOutputPayload("web.dom.extract_list", { extraction: listExtraction, url: "https://example.test/products", browserFrameId: 2 });
  assert.deepEqual(parameters.extractList, listRequest);
  assert.equal(parameters.browserFrameId, 2, "a list read runs in the document it was recorded in");
});
test("no sample value the picker sent beside the definition reaches the node", () => {
  const sample = "SENTINEL-PAGE-VALUE-FROM-THE-PICKER";
  const parameters = webAutomationOutputPayload("web.dom.extract_list", {
    extraction: { ...listExtraction, samples: [{ name: sample }], preview: sample }
  });
  assert.equal(JSON.stringify(parameters).includes(sample), false);
  assert.deepEqual(Object.keys(parameters), ["extractList"]);
});
test("a definition the reader refuses builds nothing, so the event stays evidence", () => {
  for (const extraction of [void 0, {}, { form: "list" }, { ...listExtraction, datasetId: "products/4f1c" }, { ...listExtraction, request: { item: "li", fields: {} } }]) {
    assert.deepEqual(webAutomationOutputPayload("web.dom.extract_list", { extraction }), {}, JSON.stringify(extraction) ?? "undefined");
  }
});
test("a recorded single-value extraction says which value to read, beside its target", () => {
  const heading = { selector: "h1.total", tagName: "h1", id: "total" };
  const parameters = webAutomationOutputPayload("web.dom.extract", { element: heading, extraction: { form: "value", label: "Order total", read: { mode: "attribute", attribute: "data-total" } } });
  assert.equal(parameters.selector, "h1.total");
  assert.deepEqual(parameters.extract, { mode: "attribute", attribute: "data-total" });
});
test("an extract with no recorded definition is the plain read it has always been", () => {
  const heading = { selector: "h1.total", tagName: "h1", id: "total" };
  const parameters = webAutomationOutputPayload("web.dom.extract", { element: heading });
  assert.equal("extract" in parameters, false, "nothing claims a read mode nobody recorded");
  assert.equal(parameters.selector, "h1.total");
});
test("the two forms do not answer for each other", () => {
  assert.deepEqual(webAutomationOutputPayload("web.dom.extract_list", { extraction: { form: "value", label: "Total", read: { mode: "text" } } }), {}, "a value definition proposes no list read");
  const listAsValue = webAutomationOutputPayload("web.dom.extract", { element: { selector: "ul", tagName: "ul" }, extraction: listExtraction });
  assert.equal("extract" in listAsValue, false, "a list definition proposes no single-value read");
});
test("a DOM action carries the frame it was recorded in", () => {
  const recorded = { element: { ...checkbox, checked: true }, inputValue: "on", browserFrameId: 3 };
  assert.equal(webAutomationOutputPayload("web.dom.check", recorded).browserFrameId, 3);
  assert.equal(webAutomationOutputPayload("web.dom.click", recorded).browserFrameId, 3);
  assert.equal(webAutomationOutputPayload("web.dom.scroll", { scroll: { x: 0, y: 640 }, browserFrameId: 3 }).browserFrameId, 3);
});
test("frame 0 is the top document, and is carried as a frame rather than dropped", () => {
  assert.equal(webAutomationOutputPayload("web.dom.click", { element: checkbox, browserFrameId: 0 }).browserFrameId, 0);
});
test("a frame id that is not a frame is dropped rather than replayed", () => {
  for (const browserFrameId of [-1, 1.5, "3", null, void 0]) {
    const parameters = webAutomationOutputPayload("web.dom.click", { element: checkbox, browserFrameId });
    assert.equal("browserFrameId" in parameters, false, JSON.stringify(browserFrameId));
  }
});
test("a browser-scoped action acts on the tab, so it takes no frame", () => {
  assert.equal("browserFrameId" in webAutomationOutputPayload("web.browser.navigate", { url: "https://example.test", browserFrameId: 3 }), false);
  assert.equal("browserFrameId" in webAutomationOutputPayload("web.browser.tab", { browserFrameId: 3 }), false);
  assert.equal("browserFrameId" in webAutomationOutputPayload("web.browser.tab", { tab: { operation: "close" }, browserFrameId: 3 }), false);
});
test("an unexecutable event stays empty rather than becoming a command carrying only a frame", () => {
  assert.deepEqual(webAutomationOutputPayload("web.dom.assert", { element: checkbox, browserFrameId: 3 }), {});
  assert.deepEqual(webAutomationOutputPayload("web.dom.capture_snapshot", { browserFrameId: 3 }), {});
});
test("a child-frame action also carries its frame's URL path, and nothing else of the URL", () => {
  const url = "http://127.0.0.1:5174/scenarios/iframe-checkout/payment?session=tok-123#card";
  const parameters = webAutomationOutputPayload("web.dom.click", { element: checkbox, url, browserFrameId: 4 });
  assert.equal(parameters.browserFrameId, 4, "the id still travels, as the tie-break");
  assert.equal(parameters.browserFrameUrlPath, "/scenarios/iframe-checkout/payment");
  const serialized = JSON.stringify(parameters);
  for (const leaked of ["127.0.0.1", "5174", "http:", "session", "tok-123", "card"]) {
    assert.equal(serialized.includes(leaked), false, `${leaked} must not reach the node`);
  }
});
test("a child frame whose document is not http(s) gains no path", () => {
  for (const url of ["about:blank", "about:srcdoc", "blob:https://example.test/1", "not a url", void 0]) {
    const parameters = webAutomationOutputPayload("web.dom.click", { element: checkbox, url, browserFrameId: 4 });
    assert.equal(parameters.browserFrameId, 4, String(url));
    assert.equal("browserFrameUrlPath" in parameters, false, String(url));
  }
});
test("every top-frame node's parameters are byte-identical to what they were before the frame path", () => {
  const url = "https://example.test/checkout?session=tok-123";
  const pay = { selector: "#pay", tagName: "button", id: "pay" };
  const email = { selector: "#email", tagName: "input", inputType: "email", id: "email" };
  const plan = { selector: "select#plan", tagName: "select", id: "plan" };
  const exact = [
    ["web.dom.click", { element: pay, url, browserFrameId: 0 }, '{"selector":"#pay","element":{"selector":"#pay","id":"pay","tagName":"button"},"browserFrameId":0}'],
    ["web.dom.click", { element: pay, url }, '{"selector":"#pay","element":{"selector":"#pay","id":"pay","tagName":"button"}}'],
    ["web.dom.type", { element: email, url, inputValue: "ada@example.test", browserFrameId: 0 }, '{"selector":"#email","text":"ada@example.test","element":{"selector":"#email","id":"email","tagName":"input","inputType":"email"},"browserFrameId":0}'],
    ["web.dom.clear", { element: email, url, browserFrameId: 0 }, '{"selector":"#email","element":{"selector":"#email","id":"email","tagName":"input","inputType":"email"},"browserFrameId":0}'],
    ["web.dom.select", { element: plan, url, inputValue: "team", browserFrameId: 0 }, '{"selector":"select#plan","value":"team","element":{"selector":"select#plan","id":"plan","tagName":"select"},"browserFrameId":0}'],
    ["web.dom.keypress", { element: email, url, key: "Enter", browserFrameId: 0 }, '{"selector":"#email","key":"Enter","element":{"selector":"#email","id":"email","tagName":"input","inputType":"email"},"browserFrameId":0}'],
    ["web.dom.scroll", { url, scroll: { x: 0, y: 640 }, browserFrameId: 0 }, '{"x":0,"y":640,"browserFrameId":0}'],
    ["web.dom.check", { element: { ...checkbox, checked: true }, url, inputValue: "on", browserFrameId: 0 }, '{"selector":"input#terms","checked":true,"element":{"selector":"input#terms","id":"terms","tagName":"input","inputType":"checkbox","checked":true},"browserFrameId":0}']
  ];
  for (const [outputId, recorded, json] of exact) {
    assert.equal(JSON.stringify(webAutomationOutputPayload(outputId, recorded)), json, outputId);
  }
});
var fileInput = { selector: "#attachment", tagName: "input", inputType: "file", id: "attachment", value: "C:\\fakepath\\tax-return-2025.pdf" };
test("a file choice asks for its files through an upload request with no fallback", () => {
  const parameters = webAutomationOutputPayload("web.dom.upload", { element: fileInput, inputValue: "C:\\fakepath\\tax-return-2025.pdf" });
  assert.deepEqual(parameters.upload, { $state: { path: "web.upload.attachment" } });
  assert.equal(parameters.selector, "#attachment");
  assert.equal(parameters.element.inputType, "file", "the fingerprint replay falls back on is kept");
});
test("no recorded file name, count or content appears anywhere in an upload's parameters", () => {
  const parameters = webAutomationOutputPayload("web.dom.upload", { element: fileInput, inputValue: "C:\\fakepath\\tax-return-2025.pdf", url: "https://example.test/upload?session=tok-123", browserFrameId: 0 });
  const serialized = JSON.stringify(parameters);
  for (const leaked of ["tax-return", "fakepath", ".pdf", "files", "contentBase64", "session"]) {
    assert.equal(serialized.includes(leaked), false, `${leaked} must not reach the node`);
  }
  assert.equal("value" in parameters.element, false, "a file input's value is its file name");
});
test("a file choice with no identity to key a request on builds nothing", () => {
  assert.deepEqual(webAutomationOutputPayload("web.dom.upload", { element: { tagName: "input", inputType: "file" } }), {});
});
test("a recorded tab switch carries its exact path, and a close carries only its operation", () => {
  assert.deepEqual(
    webAutomationOutputPayload("web.browser.tab", { url: "http://127.0.0.1:4173/scenarios/multi-tab/details?id=7", tab: { operation: "switch", urlPath: "/scenarios/multi-tab/details" } }),
    { tab: { operation: "switch", urlPath: "/scenarios/multi-tab/details" } }
  );
  assert.deepEqual(webAutomationOutputPayload("web.browser.tab", { tab: { operation: "close" } }), { tab: { operation: "close" } });
});
test("tab parameters carry the pathname only, never an origin, a query or a tab id", () => {
  const extras = { operation: "switch", urlPath: "/list", tabId: 41, url: "http://127.0.0.1:4173/list?session=tok-123" };
  const serialized = JSON.stringify(webAutomationOutputPayload("web.browser.tab", { url: "http://127.0.0.1:4173/list?session=tok-123", browserTabId: 41, tab: extras }));
  for (const leaked of ["127.0.0.1", "4173", "http:", "session", "tok-123", "41", "tabId"]) {
    assert.equal(serialized.includes(leaked), false, `${leaked} must not reach the node`);
  }
  assert.deepEqual(webAutomationOutputPayload("web.browser.tab", { tab: { operation: "close", tabId: 41, urlPath: "/list" } }), { tab: { operation: "close" } }, "a close names nothing, even when the recorded change carried more");
});
test("a switch whose path is not a bare pathname is built without one, never trimmed into one", () => {
  for (const urlPath of ["http://127.0.0.1:4173/list", "/list?session=tok-123", "/list#top", "list", "", 7, void 0]) {
    assert.deepEqual(webAutomationOutputPayload("web.browser.tab", { tab: { operation: "switch", urlPath } }), { tab: { operation: "switch" } }, String(urlPath));
  }
});
test("the recording-start marker, which has no tab, builds nothing", () => {
  assert.deepEqual(webAutomationOutputPayload("web.browser.tab", { url: "https://example.test/start", title: "Start", recordingState: "started" }), {});
  assert.deepEqual(webAutomationOutputPayload("web.browser.tab", { tab: { operation: "open", urlPath: "/start" } }), {}, "an operation a recording never produces builds nothing");
});
test("only a control the sensitivity rule marks asks for a withheld value", () => {
  const plain = { selector: "input#nickname", tagName: "input", inputType: "text", id: "nickname" };
  assert.equal(webAutomationOutputPayload("web.dom.type", { element: plain }).text, "");
  const marked = { ...plain, inputType: "password" };
  assert.notEqual(webAutomationOutputPayload("web.dom.type", { element: marked }).text, "");
});
test("a withheld value is asked for by every route the rule recognizes, not only by input type", () => {
  for (const element of [
    { selector: "#pw", attributes: { type: "password" } },
    { selector: "#otp", attributes: { autocomplete: "one-time-code" } },
    { selector: "#card", attributes: { autocomplete: "billing cc-number" } },
    { selector: "#custom", attributes: { "data-sensitive": "true" } }
  ]) {
    assert.notEqual(webAutomationOutputPayload("web.dom.type", { element }).text, "", element.selector);
  }
});
