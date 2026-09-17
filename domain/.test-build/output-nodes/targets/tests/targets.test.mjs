// src/output-nodes/targets/tests/targets.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";

// src/constants.ts
var WEB_AUTOMATION_DOMAIN_ID = "web-automation";

// src/actions/safety.ts
var WEB_AUTOMATION_ACTION_SAFETY = {
  "web.browser.navigate": "review",
  "web.dom.click": "review",
  "web.dom.type": "review",
  "web.dom.clear": "review",
  "web.dom.select": "review",
  "web.dom.scroll": "review",
  "web.dom.keypress": "review",
  "web.dom.wait_for_selector": "safe",
  "web.dom.wait_for_text": "safe",
  "web.dom.extract": "safe",
  "web.dom.capture_snapshot": "safe",
  // Added in Week 1 (decision D6). An assertion and a list extraction only read
  // the page, so they are safe; check, upload, and dialog change it, and a tab
  // or download acts on the browser, so all five need approval.
  "web.dom.check": "review",
  "web.dom.assert": "safe",
  "web.dom.extract_list": "safe",
  "web.dom.upload": "review",
  "web.dom.dialog": "review",
  "web.browser.tab": "review",
  "web.browser.download": "review"
};

// src/actions/extraction/field-key.ts
var FIELD_KEY_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
var RESERVED_FIELD_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
function isWebAutomationExtractFieldKey(key) {
  return typeof key === "string" && FIELD_KEY_PATTERN.test(key) && !RESERVED_FIELD_KEYS.has(key);
}

// src/output-nodes/targets/targets.ts
function outputTargetFromPayload(payload) {
  const adaptedTarget = objectValue(payload.target);
  const adaptedFingerprint = objectValue(adaptedTarget?.fingerprint);
  const selectedCandidate = selectedTargetCandidate(adaptedTarget);
  const explicitVisualTarget = objectValue(adaptedTarget?.visualTarget) ?? objectValue(payload.visualTarget);
  const element = firstElementFingerprint(elementFingerprintSources(payload, adaptedTarget, adaptedFingerprint, selectedCandidate));
  const selector = stringValue(selectedCandidate?.selector) ?? stringValue(adaptedFingerprint?.selector) ?? stringValue(adaptedTarget?.selector) ?? stringValue(payload.selector) ?? stringValue(element?.selector) ?? stringValue(explicitVisualTarget?.selector);
  if (!selector && !explicitVisualTarget) return void 0;
  return compact({
    selector,
    ...element ? { element } : {},
    ...explicitVisualTarget ? { visualTarget: explicitVisualTarget } : {}
  });
}
function elementFingerprintSources(payload, adaptedTarget, adaptedFingerprint, selectedCandidate) {
  const adapted = [adaptedTarget?.element, selectedCandidate, adaptedFingerprint, adaptedTarget];
  return adaptedTargetSupersedesRecording(payload) ? [...adapted, payload.element] : [payload.element, ...adapted];
}
function adaptedTargetSupersedesRecording(parameters) {
  const adaptedTarget = objectValue(parameters.target);
  if (!adaptedTarget) return false;
  if (adaptedTarget.selectedCandidate !== void 0) return true;
  if (isRepairResolution(adaptedTarget)) return true;
  const named = firstElementFingerprint([adaptedTarget.element, adaptedTarget.fingerprint, adaptedTarget]);
  if (!named) return false;
  const recorded = recordedStrings(parameters);
  return DESCRIPTIVE_SIGNALS.some((signal) => {
    const value = named[signal];
    return typeof value === "string" && value.trim() !== "" && !recorded.has(comparableText(value));
  });
}
var DESCRIPTIVE_SIGNALS = ["visibleText", "text", "accessibleName", "label", "id", "testId", "tagName", "role", "implicitRole"];
var CORE_SIGNAL_LENGTH = 1e3;
function isRepairResolution(target) {
  return objectValue(target.handles) !== void 0 && (target.handleResolution === "named" || target.handleResolution === "inferred");
}
function recordedStrings(parameters) {
  const element = objectValue(parameters.element);
  const described = [parameters, element].flatMap((source) => source ? [source, objectValue(source.metadata), objectValue(source.visualTarget)] : []);
  const strings = /* @__PURE__ */ new Set();
  for (const source of described) {
    for (const value of [...Object.values(source ?? {}), ...Object.values(objectValue(source?.attributes) ?? {})]) {
      if (typeof value !== "string") continue;
      strings.add(comparableText(value));
      strings.add(comparableText(value.trim().slice(0, CORE_SIGNAL_LENGTH)));
    }
  }
  return strings;
}
function comparableText(value) {
  return value.trim().toLowerCase();
}
function firstElementFingerprint(sources) {
  for (const source of sources) {
    const fingerprint = elementFingerprint(source);
    if (fingerprint && Object.keys(fingerprint).length > 0) return fingerprint;
  }
  return void 0;
}
function selectedTargetCandidate(target) {
  const selectedCandidateId = stringValue(objectValue(target?.selectedCandidate)?.candidateId);
  if (!selectedCandidateId || !Array.isArray(target?.candidates)) return void 0;
  return target.candidates.map(objectValue).find((candidate) => stringValue(candidate?.candidateId) === selectedCandidateId);
}
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
var WEB_AUTOMATION_EXTRACT_READ_MODES = ["text", "attribute", "value", "html"];
var WEB_AUTOMATION_EXTRACT_MAX_PAGES = 50;
var WEB_AUTOMATION_EXTRACT_MAX_ITEMS = 1e3;
var WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS = 1e4;

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
  const readable2 = read(value);
  return readable2 === void 0 ? REFUSED : readable2;
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

// src/actions/extraction/schema.ts
function webAutomationExtractListSchema(elementFingerprintSchema2) {
  const pageBound = { type: "integer", minimum: 1, maximum: WEB_AUTOMATION_EXTRACT_MAX_PAGES };
  const fieldSpecSchema = {
    type: "object",
    label: "Field",
    required: ["kind"],
    properties: {
      kind: { type: "string", label: "Reads", enum: [...WEB_AUTOMATION_EXTRACT_FIELD_KINDS] },
      selector: { type: "string", label: "Selector inside the item" },
      attribute: { type: "string", label: "Attribute" },
      header: { type: "string", label: "Column header" },
      required: { type: "boolean", label: "Required" },
      // `encrypt` is reserved (D13) and refused at dispatch until it is built.
      handling: { type: "string", label: "Column", enum: [...WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS] },
      element: elementFingerprintSchema2
    }
  };
  return {
    type: "object",
    label: "List extraction",
    required: ["item", "fields"],
    properties: {
      item: { type: "string", label: "Item selector" },
      itemElement: elementFingerprintSchema2,
      fields: {
        type: "object",
        label: "Field map",
        description: "Each field key maps to a selector string (`selector`, `selector@attribute`, `column:<header>`) or a field spec.",
        metadata: { fieldSpec: fieldSpecSchema }
      },
      // No member is required of every mode, so nothing is required here: the
      // lift refuses a mode missing its own bound or naming another mode's key.
      paginate: {
        type: "object",
        label: "Pagination",
        properties: {
          mode: { type: "string", label: "Mode", enum: [...WEB_AUTOMATION_EXTRACT_PAGINATION_MODES] },
          next: { type: "string", label: "Next control" },
          control: { type: "string", label: "Load-more control" },
          pages: { type: "string", label: "Page controls" },
          maxPages: { ...pageBound, label: "Maximum pages" },
          maxScrolls: { ...pageBound, label: "Maximum scrolls" }
        }
      },
      maxItems: { type: "integer", label: "Maximum items", minimum: 1, maximum: WEB_AUTOMATION_EXTRACT_MAX_ITEMS },
      // Default 1 where absent, so an empty list fails unless the Flow says empty
      // is an answer; above the item bound no page could satisfy it.
      minItems: { type: "integer", label: "Minimum items", minimum: 0, maximum: WEB_AUTOMATION_EXTRACT_MAX_ITEMS }
    }
  };
}

// src/actions/schemas.ts
var elementFingerprintSchema = {
  type: "object",
  label: "Element fingerprint",
  properties: {
    selector: { type: "string", label: "CSS selector" },
    xpath: { type: "string", label: "XPath" },
    id: { type: "string", label: "ID" },
    classNames: { type: "array", label: "Class names" },
    visibleText: { type: "string", label: "Visible text" },
    tagName: { type: "string", label: "Tag name" },
    role: { type: "string", label: "ARIA role" },
    name: { type: "string", label: "Accessible name" },
    href: { type: "string", label: "Link URL" },
    attributes: { type: "object", label: "Attributes" },
    testId: { type: "string", label: "Test id" },
    accessibleName: { type: "string", label: "Accessible name" },
    label: { type: "string", label: "Label" }
  }
};
var visualTargetSchema = {
  type: "object",
  label: "Visual target",
  properties: {
    namespace: { type: "string", label: "State namespace" },
    statePath: { type: "string", label: "State path" },
    selector: { type: "string", label: "CSS selector" },
    frameId: { type: "string", label: "Visual frame" },
    layerId: { type: "string", label: "Visual layer" },
    documentLayerId: { type: "string", label: "Document visual layer" },
    bounds: { type: "object", label: "Viewport bounds" },
    documentBounds: { type: "object", label: "Document bounds" },
    anchor: { type: "object", label: "Anchor" },
    confidence: { type: "number", label: "Confidence" },
    metadata: { type: "object", label: "Metadata" }
  }
};
var elementProperties = { selector: { type: "string", label: "CSS selector" }, element: elementFingerprintSchema, visualTarget: visualTargetSchema };
var selectorSchema = {
  type: "object",
  required: ["selector"],
  properties: {
    ...elementProperties,
    timeoutMs: { type: "integer", label: "Timeout in ms" }
  }
};
var waitSchema = {
  type: "object",
  label: "Wait condition",
  properties: {
    condition: { type: "string", label: "Condition", enum: ["present", "visible", "enabled", "absent", "url", "stable"] },
    url: { type: "string", label: "URL" },
    stableForMs: { type: "integer", label: "Stable for, in ms" }
  }
};
var keyModifiersSchema = {
  type: "object",
  label: "Modifier keys",
  properties: {
    alt: { type: "boolean", label: "Alt" },
    ctrl: { type: "boolean", label: "Control" },
    meta: { type: "boolean", label: "Meta" },
    shift: { type: "boolean", label: "Shift" }
  }
};
var optionSelectorSchema = {
  type: "object",
  label: "Option",
  required: ["by"],
  properties: {
    by: { type: "string", label: "Match by", enum: ["value", "label", "index"] },
    value: { type: "string", label: "Option value" },
    label: { type: "string", label: "Option label" },
    index: { type: "integer", label: "Option index" }
  }
};
var scrollRequestSchema = {
  type: "object",
  label: "Scroll",
  required: ["mode"],
  properties: {
    mode: { type: "string", label: "Mode", enum: ["by", "toElement", "untilStable"] },
    x: { type: "number", label: "X delta" },
    y: { type: "number", label: "Y delta" },
    maxScrolls: { type: "integer", label: "Maximum scrolls" }
  }
};
var waitForSelectorSchema = {
  type: "object",
  required: ["selector"],
  properties: {
    ...elementProperties,
    timeoutMs: { type: "integer", label: "Timeout in ms" },
    wait: waitSchema
  }
};
var assertSchema = {
  type: "object",
  label: "Assertion",
  required: ["kind"],
  properties: {
    kind: { type: "string", label: "Condition", enum: ["exists", "absent", "text", "url", "visible", "enabled"] },
    expected: { type: "string", label: "Expected" },
    timeoutMs: { type: "integer", label: "Timeout in ms" }
  }
};
var extractListSchema = webAutomationExtractListSchema(elementFingerprintSchema);
var extractReadSchema = {
  type: "object",
  label: "Read",
  required: ["mode"],
  properties: {
    mode: { type: "string", label: "Reads", enum: [...WEB_AUTOMATION_EXTRACT_READ_MODES] },
    attribute: { type: "string", label: "Attribute" }
  }
};
var uploadSchema = {
  type: "object",
  label: "Files",
  required: ["files"],
  properties: {
    files: {
      type: "array",
      label: "Files",
      minItems: 1,
      items: {
        type: "object",
        required: ["name", "mimeType", "contentBase64"],
        properties: {
          name: { type: "string", label: "File name" },
          mimeType: { type: "string", label: "MIME type" },
          contentBase64: { type: "string", label: "Base64 content" }
        }
      }
    }
  }
};
var dialogSchema = {
  type: "object",
  label: "Dialog",
  required: ["response"],
  properties: {
    response: { type: "string", label: "Response", enum: ["accept", "dismiss"] },
    promptText: { type: "string", label: "Prompt text" }
  }
};
var tabSchema = {
  type: "object",
  label: "Tab",
  required: ["operation"],
  properties: {
    operation: { type: "string", label: "Operation", enum: ["open", "switch", "close"] },
    url: { type: "string", label: "URL" },
    active: { type: "boolean", label: "Activate" },
    tabId: { type: "integer", label: "Tab id" },
    urlPattern: { type: "string", label: "URL contains" },
    urlPath: { type: "string", label: "URL path" }
  }
};
var downloadSchema = {
  type: "object",
  label: "Download",
  properties: {
    filename: { type: "string", label: "File name" },
    timeoutMs: { type: "integer", label: "Timeout in ms" }
  }
};
var webAutomationActionDefinitions = [
  {
    actionType: "web.browser.navigate",
    label: "Navigate",
    description: "Navigate a browser tab to a URL.",
    parameterSchema: {
      type: "object",
      required: ["url"],
      properties: { url: { type: "string", label: "URL" }, newTab: { type: "boolean", label: "Open in a new tab" } }
    }
  },
  { actionType: "web.dom.click", label: "Click", description: "Click a DOM element.", parameterSchema: selectorSchema },
  {
    actionType: "web.dom.type",
    label: "Type Text",
    description: "Enter text into an editable DOM element.",
    // `text` is required. It was not, and that is why a recorded password step
    // replayed as a field typed empty: `payloads.ts` filled `text` with `""`
    // when the recorder had withheld the value, `hasExecutableParameters`
    // (`io/input-model.ts`) checks only the parameters this list names, so the
    // node validated, survived, ran, and reported success having typed
    // nothing. An entry the user emptied is `web.dom.clear`, never this, so a
    // type action with no text is always a value that went missing.
    //
    // A withheld value is supplied at run time instead of carried: `text` may
    // therefore also be the secret request `output-nodes/secret-binding.ts`
    // builds, which names the run input the value arrives in and never a value.
    parameterSchema: { type: "object", required: ["selector", "text"], properties: { ...elementProperties, text: { type: "string", label: "Text, or the secret request it is supplied through" }, value: { type: "string" } } }
  },
  { actionType: "web.dom.clear", label: "Clear Field", description: "Clear an editable DOM element.", parameterSchema: selectorSchema },
  {
    actionType: "web.dom.select",
    label: "Select Option",
    description: "Choose an option of a select element by value, label, or index.",
    parameterSchema: {
      type: "object",
      required: ["selector"],
      properties: { ...elementProperties, value: { type: "string" }, option: optionSelectorSchema, timeoutMs: { type: "integer", label: "Timeout in ms" } }
    }
  },
  {
    actionType: "web.dom.scroll",
    label: "Scroll",
    description: "Scroll by a delta, to an element, or until the page stops growing.",
    parameterSchema: {
      type: "object",
      properties: { ...elementProperties, x: { type: "number" }, y: { type: "number" }, smooth: { type: "boolean" }, scroll: scrollRequestSchema }
    }
  },
  {
    actionType: "web.dom.keypress",
    label: "Key Press",
    description: "Dispatch a keyboard event, with modifier keys.",
    parameterSchema: { type: "object", properties: { ...elementProperties, key: { type: "string" }, text: { type: "string" }, modifiers: keyModifiersSchema } }
  },
  {
    actionType: "web.dom.wait_for_selector",
    label: "Wait For Selector",
    description: "Wait until an element is present, visible, enabled, or absent.",
    parameterSchema: waitForSelectorSchema
  },
  {
    actionType: "web.dom.wait_for_text",
    label: "Wait For Text",
    description: "Wait until page text appears or the page settles.",
    parameterSchema: { type: "object", required: ["text"], properties: { text: { type: "string" }, timeoutMs: { type: "integer" }, wait: waitSchema } }
  },
  {
    actionType: "web.dom.extract",
    label: "Extract",
    description: "Extract text, value, or attributes from an element.",
    // `selector` stays required, so this keeps declaring an element target. The
    // structured `extract` says which value to read; the legacy `options.mode`
    // beside it still works for a Flow that authored one.
    parameterSchema: {
      type: "object",
      required: ["selector"],
      properties: { ...elementProperties, timeoutMs: { type: "integer", label: "Timeout in ms" }, extract: extractReadSchema }
    }
  },
  {
    actionType: "web.dom.capture_snapshot",
    label: "Capture Snapshot",
    description: "Capture a structured DOM snapshot.",
    parameterSchema: { type: "object", properties: {} }
  },
  // The seven actions added in Week 1 (decision D6). Each parameter is named
  // and shaped as the field of `WebAutomationActionCommand` it becomes, so a
  // Flow's parameters reach the verb that runs them without being reshaped.
  {
    actionType: "web.dom.check",
    label: "Set Checked",
    description: "Set a checkbox or radio to a checked state.",
    parameterSchema: {
      type: "object",
      required: ["selector"],
      properties: { ...elementProperties, checked: { type: "boolean", label: "Checked" }, timeoutMs: { type: "integer", label: "Timeout in ms" } }
    }
  },
  {
    actionType: "web.dom.assert",
    label: "Assert",
    description: "Verify a condition about the page and fail when it does not hold.",
    parameterSchema: { type: "object", required: ["assert"], properties: { ...elementProperties, assert: assertSchema } }
  },
  {
    actionType: "web.dom.extract_list",
    label: "Extract List",
    description: "Extract a field map from every item of a repeating structure, following pagination.",
    parameterSchema: { type: "object", required: ["extractList"], properties: { extractList: extractListSchema } }
  },
  {
    actionType: "web.dom.upload",
    label: "Upload Files",
    description: "Set the files of a file input.",
    parameterSchema: { type: "object", required: ["selector", "upload"], properties: { ...elementProperties, upload: uploadSchema } }
  },
  {
    actionType: "web.dom.dialog",
    label: "Answer Dialog",
    description: "Arm the answer to the next native alert, confirm, or prompt.",
    parameterSchema: { type: "object", required: ["dialog"], properties: { dialog: dialogSchema } }
  },
  {
    actionType: "web.browser.tab",
    label: "Browser Tab",
    description: "Open, switch to, or close a browser tab.",
    parameterSchema: { type: "object", required: ["tab"], properties: { tab: tabSchema } }
  },
  {
    actionType: "web.browser.download",
    label: "Await Download",
    description: "Wait for a browser download to complete.",
    parameterSchema: { type: "object", properties: { download: downloadSchema } }
  }
];

// src/output-nodes/extract-list/catalog-text.ts
var WEB_AUTOMATION_EXTRACT_LIST_TAGS = [
  "scrape",
  "collect",
  "extract",
  "list",
  "table",
  "rows",
  "records",
  "dataset",
  "every page",
  "next page",
  "load more",
  "infinite scroll",
  "pagination"
];
var WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION = [
  "Scrape every item of a repeating list or table into a dataset, across pages.",
  "The rows are saved without a recordOutput."
].join(" ");
var WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR = [
  "{ item, fields, paginate?, minItems?, maxItems? }. item: CSS selector of each record.",
  'fields: { key: "css" (text) | "css@attr" | "column:Header" (table cell)',
  `| { kind: ${WEB_AUTOMATION_EXTRACT_FIELD_KINDS.join("|")}, selector?, attribute?, header?, required?: false } };`,
  "keys use A-Za-z0-9_-; field selectors are read inside each item.",
  'paginate: { mode: "next", next: css, maxPages } | { mode: "loadMore", control: css, maxPages }',
  `| { mode: "scroll", maxScrolls } | { mode: "numbered", pages: css, maxPages }, at most ${WEB_AUTOMATION_EXTRACT_MAX_PAGES}.`,
  `minItems: default 1; 0 allows an empty list. maxItems: at most ${WEB_AUTOMATION_EXTRACT_MAX_ITEMS}.`
].join(" ");
var WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE = {
  item: "li.product",
  fields: { name: ".name", price: ".price", url: "a@href" },
  paginate: { mode: "next", next: "a.next", maxPages: 5 }
};

// src/extraction/dataset-id.ts
var COMBINING_MARKS = new RegExp("\\p{M}+", "gu");

// src/extraction/label-key.ts
var COMBINING_MARKS2 = new RegExp("\\p{M}+", "gu");

// src/output-nodes/extract-list/records-path.ts
var WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH = "result.extracted";

// src/output-nodes/extract-list/dispatch.ts
import { parseAutomationStudioRecordOutput } from "fluxiq/automation-studio/nodes";

// src/output-nodes/extract-list/issues.ts
var PROBE_REQUEST = { item: "*", fields: { probe: "*" } };
function webAutomationExtractListIssues(value) {
  if (!isPlainObject(value)) return ["web.extract_list.not_object"];
  const keys = declaredKeys();
  const issues = /* @__PURE__ */ new Set();
  if (Object.keys(value).some((key) => !keys.request.has(key))) issues.add("web.extract_list.unknown_key");
  if (!readable({ item: value.item ?? null })) issues.add("web.extract_list.invalid_item");
  if (value.itemElement !== void 0 && !readable({ itemElement: value.itemElement })) issues.add("web.extract_list.invalid_item_element");
  addFieldIssues(value.fields, keys.fieldSpec, issues);
  addPaginateIssues(value.paginate, keys.paginate, issues);
  addItemBoundIssues(value, issues);
  if (issues.size === 0 && webAutomationExtractListRequestValue(value) === void 0) issues.add("web.extract_list.unreadable");
  return [...issues];
}
function addFieldIssues(fields, specKeys, issues) {
  if (!isPlainObject(fields)) {
    issues.add("web.extract_list.invalid_fields");
    return;
  }
  const entries = Object.entries(fields);
  if (entries.length === 0) {
    issues.add("web.extract_list.no_fields");
    return;
  }
  let fieldRefused = false;
  for (const [key, field] of entries) {
    if (isPlainObject(field) && Object.keys(field).some((specKey) => !specKeys.has(specKey))) issues.add("web.extract_list.unknown_field_key");
    if (!isWebAutomationExtractFieldKey(key)) {
      issues.add("web.extract_list.invalid_field_key");
      fieldRefused = true;
    } else if (!readable({ fields: { [key]: field, [key === "probe" ? "probe_2" : "probe"]: "*" } })) {
      issues.add("web.extract_list.invalid_field");
      fieldRefused = true;
    }
  }
  if (!fieldRefused && !readable({ fields })) issues.add("web.extract_list.all_fields_excluded");
}
function addPaginateIssues(paginate, paginateKeys, issues) {
  if (paginate === void 0) return;
  if (isPlainObject(paginate) && Object.keys(paginate).some((key) => !paginateKeys.has(key))) issues.add("web.extract_list.unknown_paginate_key");
  if (!readable({ paginate })) issues.add("web.extract_list.invalid_paginate");
}
function addItemBoundIssues(value, issues) {
  const { maxItems, minItems } = value;
  const maxItemsReadable = maxItems === void 0 || isPositiveInteger(maxItems);
  if (!maxItemsReadable) issues.add("web.extract_list.invalid_max_items");
  if (minItems === void 0) return;
  if (!isNonNegativeInteger(minItems)) {
    issues.add("web.extract_list.invalid_min_items");
    return;
  }
  if (!readable(maxItemsReadable && maxItems !== void 0 ? { minItems, maxItems } : { minItems })) issues.add("web.extract_list.min_items_exceed_max");
}
function readable(overrides) {
  return webAutomationExtractListRequestValue({ ...PROBE_REQUEST, ...overrides }) !== void 0;
}
var declared;
function declaredKeys() {
  if (declared) return declared;
  const schema = webAutomationExtractListSchema({});
  const properties = child(schema, "properties");
  declared = {
    request: propertyNames(schema),
    paginate: propertyNames(child(properties, "paginate")),
    fieldSpec: propertyNames(child(child(child(properties, "fields"), "metadata"), "fieldSpec"))
  };
  return declared;
}
function propertyNames(schema) {
  return new Set(Object.keys(child(schema, "properties") ?? {}));
}
function child(value, key) {
  const next = value?.[key];
  return isPlainObject(next) ? next : void 0;
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isPositiveInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function isNonNegativeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

// src/output-nodes/extract-list/parameter-contract.ts
function webAutomationExtractListParameterContract(input) {
  return input.parameterId === "extractList" ? webAutomationExtractListIssues(input.value) : [];
}

// src/output-nodes/extract-list/parameters.ts
function webAutomationExtractListParameters() {
  return [
    {
      id: "extractList",
      label: "List",
      description: WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR,
      valueType: "object",
      example: structuredClone(WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE),
      ui: { control: "value" }
    },
    {
      id: "timeoutMs",
      label: "Timeout",
      description: "Milliseconds for the whole read. Left at the default, it grows with the pages the list may read.",
      valueType: "number",
      defaultValue: WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS
    },
    {
      id: "recordOutput",
      label: "Save extracted records",
      description: "The dataset the rows are saved into. Leave empty to save every field of the list under a dataset named after its fields.",
      valueType: "json",
      defaultValue: null,
      allowStateBinding: false,
      ui: { control: "record-output" }
    }
  ];
}

// src/output-nodes/definitions.ts
var controlInput = { id: "in", label: "In", valueType: "signal", role: "control" };
var outputPorts = [
  { id: "success", label: "Success", valueType: "any", role: "success" },
  { id: "failed", label: "Failed", valueType: "any", role: "failure" }
];
var recordsPort = { id: "records", label: "Records", valueType: "array", role: "data" };
var recordsPathByOutput = {
  "web.dom.extract_list": WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH
};
var catalogTextByOutput = {
  "web.dom.extract_list": { description: WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION, tags: WEB_AUTOMATION_EXTRACT_LIST_TAGS }
};
var VERIFIES_STATE_METADATA_KEY = "verifiesState";
var stateVerifyingOutputs = /* @__PURE__ */ new Set([
  "web.dom.assert",
  "web.dom.wait_for_text",
  "web.dom.wait_for_selector"
]);
var expectedStateParameter = {
  id: "expectedState",
  label: "Expected State",
  description: "Post-conditions checked after this action, as web.dom.assert conditions: { conditions: [{ kind, selector, expected }], mode, timeoutMs }.",
  valueType: "object",
  ui: { control: "value" }
};
function webAutomationOutputNodeId(outputId) {
  return `web.output.${outputId.replace(/^web\./, "").replace(/\./g, "-")}`;
}
var webAutomationOutputNodeDefinitions = webAutomationActionDefinitions.map(
  (definition) => createWebAutomationOutputNodeDefinition(definition)
);
function createWebAutomationOutputNodeDefinition(definition) {
  const safeOutput = WEB_AUTOMATION_ACTION_SAFETY[definition.actionType] === "safe";
  const requiredParameters = new Set(
    Array.isArray(definition.parameterSchema.required) ? definition.parameterSchema.required.filter((value) => typeof value === "string") : []
  );
  const recordsPath = recordsPathByOutput[definition.actionType];
  const catalogText = catalogTextByOutput[definition.actionType];
  return {
    schemaVersion: "0.1",
    id: webAutomationOutputNodeId(definition.actionType),
    version: "1.0.0",
    label: definition.label,
    description: catalogText?.description ?? definition.description,
    category: "web",
    source: {
      kind: "importer",
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      packageId: "@fluxiq-web-extension/domain",
      implementationKey: definition.actionType
    },
    availability: { kind: "domain", domainId: WEB_AUTOMATION_DOMAIN_ID },
    capabilities: { executable: true, stateAware: true, recordable: true },
    requiredRuntimeCapabilities: ["web.actions"],
    safety: {
      privileged: !safeOutput,
      requiresOperatorApproval: !safeOutput,
      requiredPermissions: ["web-automation.action"]
    },
    outputAction: { fixedOutputId: definition.actionType },
    inputs: [controlInput],
    outputs: recordsPath ? [...outputPorts, recordsPort] : outputPorts,
    // Every web parameter may be filled from state unless it says otherwise.
    // Only `recordOutput` does, for the reason Core gives its own: a binding
    // could replace the dataset schema, and with it the excluded fields.
    parameters: [...parametersForOutput(definition.actionType), expectedStateParameter].map((parameter) => ({
      ...parameter,
      ...requiredParameters.has(parameter.id) ? { required: true } : {},
      allowStateBinding: parameter.allowStateBinding ?? true
    })),
    icon: iconForOutput(definition.actionType),
    tags: ["web-automation", "output", ...catalogText?.tags ?? []],
    metadata: {
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      outputId: definition.actionType,
      parameterSchema: definition.parameterSchema,
      // Core's element-target preparation (`runtime/io-policy.ts`) resolves the
      // recorded fingerprint against the runtime candidates, and applies its
      // confidence floor, only for an output that declares this. The flag is
      // derived from the action's own schema row rather than listed by hand, so
      // it cannot drift from it: an action that requires a selector cannot run
      // without an element, and an action that does not — a delta scroll, a
      // key press to the focused element, a URL assertion, a tab operation —
      // must not declare it, because Core fails an action outright when a
      // declared element target has no fingerprint to resolve.
      ...requiredParameters.has("selector") ? { elementTarget: true } : {},
      ...recordsPath ? { recordsPath } : {},
      ...stateVerifyingOutputs.has(definition.actionType) ? { [VERIFIES_STATE_METADATA_KEY]: true } : {}
    }
  };
}
function parametersForOutput(outputId) {
  const selectorParameters = [
    { id: "target", label: "Adapted Target", valueType: "object", ui: { control: "value" } },
    { id: "selector", label: "Selector", valueType: "string", ui: { control: "text", placeholder: "CSS selector" } },
    { id: "element", label: "Element", valueType: "object", ui: { control: "value" } },
    { id: "visualTarget", label: "Visual Target", valueType: "object", ui: { control: "value" } },
    { id: "timeoutMs", label: "Timeout", valueType: "number", defaultValue: 1e4 }
  ];
  const structured = (id, label) => ({ id, label, valueType: "object", ui: { control: "value" } });
  if (outputId === "web.browser.navigate") return [
    { id: "url", label: "URL", valueType: "string", required: true, ui: { control: "text", placeholder: "https://example.com" } },
    { id: "newTab", label: "New Tab", valueType: "boolean", defaultValue: false }
  ];
  if (outputId === "web.dom.type") return [...selectorParameters, { id: "text", label: "Text", valueType: "string", defaultValue: "", ui: { control: "textarea" } }];
  if (outputId === "web.dom.select") return [...selectorParameters, { id: "value", label: "Value", valueType: "string", defaultValue: "", ui: { control: "text" } }, structured("option", "Option")];
  if (outputId === "web.dom.keypress") return [...selectorParameters, { id: "key", label: "Key", valueType: "string", defaultValue: "", ui: { control: "text" } }, structured("modifiers", "Modifiers")];
  if (outputId === "web.dom.scroll") return [
    ...selectorParameters,
    { id: "x", label: "X", valueType: "number", defaultValue: 0 },
    { id: "y", label: "Y", valueType: "number", defaultValue: 0 },
    { id: "smooth", label: "Smooth", valueType: "boolean", defaultValue: false },
    structured("scroll", "Scroll Mode")
  ];
  if (outputId === "web.dom.extract") return [...selectorParameters, structured("extract", "Read")];
  if (outputId === "web.dom.wait_for_selector") return [...selectorParameters, structured("wait", "Condition")];
  if (outputId === "web.dom.wait_for_text") return [
    { id: "text", label: "Text", valueType: "string", required: true, ui: { control: "text" } },
    { id: "timeoutMs", label: "Timeout", valueType: "number", defaultValue: 1e4 },
    structured("wait", "Condition")
  ];
  if (outputId === "web.dom.capture_snapshot") return [];
  if (outputId === "web.dom.check") return [...selectorParameters, { id: "checked", label: "Checked", valueType: "boolean", defaultValue: true }];
  if (outputId === "web.dom.assert") return [...selectorParameters, structured("assert", "Assertion")];
  if (outputId === "web.dom.extract_list") return webAutomationExtractListParameters();
  if (outputId === "web.dom.upload") return [...selectorParameters, structured("upload", "Files")];
  if (outputId === "web.dom.dialog") return [structured("dialog", "Dialog")];
  if (outputId === "web.browser.tab") return [structured("tab", "Tab")];
  if (outputId === "web.browser.download") return [structured("download", "Download")];
  return selectorParameters;
}
function iconForOutput(outputId) {
  if (outputId === "web.browser.navigate") return "navigation";
  if (outputId === "web.dom.click") return "mouse-pointer-click";
  if (outputId === "web.dom.type") return "text-cursor-input";
  if (outputId === "web.dom.extract") return "scan-search";
  if (outputId === "web.dom.capture_snapshot") return "camera";
  if (outputId === "web.dom.check") return "square-check";
  if (outputId === "web.dom.assert") return "circle-check";
  if (outputId === "web.dom.extract_list") return "table";
  if (outputId === "web.dom.upload") return "upload";
  if (outputId === "web.dom.dialog") return "message-square";
  if (outputId === "web.browser.tab") return "app-window";
  if (outputId === "web.browser.download") return "download";
  return "square-dot";
}

// src/output-nodes/parameter-contracts.ts
var webAutomationOutputNodeParameterContracts = {
  [webAutomationOutputNodeId("web.dom.extract_list")]: webAutomationExtractListParameterContract
};

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

// src/output-nodes/targets/tests/targets.test.ts
test("identity signals are read from the descriptor's own fields", () => {
  const fingerprint = elementFingerprint({
    selector: "#save",
    tagName: "button",
    testId: "save-button",
    accessibleName: "Save changes",
    label: "Save"
  });
  assert.equal(fingerprint?.testId, "save-button");
  assert.equal(fingerprint?.accessibleName, "Save changes");
  assert.equal(fingerprint?.label, "Save");
});
test("a recording made before the producer emitted the fields still resolves them from attributes", () => {
  const fingerprint = elementFingerprint({
    selector: "#save",
    tagName: "button",
    attributes: { "data-testid": "save-button", "aria-label": "Save changes" }
  });
  assert.equal(fingerprint?.testId, "save-button");
  assert.equal(fingerprint?.accessibleName, "Save changes");
});
test("the test id falls back through the attribute names the selector prefers", () => {
  assert.equal(elementFingerprint({ selector: "#a", attributes: { "data-test": "alpha" } })?.testId, "alpha");
  assert.equal(elementFingerprint({ selector: "#a", attributes: { "data-cy": "beta" } })?.testId, "beta");
  assert.equal(elementFingerprint({ selector: "#a", testId: "own", attributes: { "data-testid": "attribute" } })?.testId, "own");
});
test("an element with no identity signals gains no empty ones", () => {
  const fingerprint = elementFingerprint({ selector: "#plain", tagName: "div" });
  assert.deepEqual(fingerprint, { selector: "#plain", tagName: "div" });
});
test("the signals survive into the dispatched target", () => {
  const target = outputTargetFromPayload({
    selector: "#save",
    element: { selector: "#save", tagName: "button", testId: "save-button", accessibleName: "Save changes" }
  });
  assert.equal((target?.element).testId, "save-button");
  assert.equal((target?.element).accessibleName, "Save changes");
});
var recordedElement = {
  selector: "#save-settings",
  xpath: "/html/body/main/form/button",
  tagName: "button",
  id: "save-settings",
  text: "Save changes",
  testId: "save-changes",
  accessibleName: "Save changes",
  label: "Save",
  visibleText: "Save changes",
  implicitRole: "button",
  classNames: ["btn", "btn-primary"],
  attributes: { id: "save-settings", "data-testid": "save-changes" }
};
var signalCount = (target) => Object.keys(target?.element ?? {}).length;
test("Core passed the target through untouched: the recorded identity is the dispatched one", () => {
  const target = outputTargetFromPayload({ selector: "#save-settings", element: recordedElement });
  assert.equal(signalCount(target), 12);
  assert.equal((target?.element).testId, "save-changes");
});
test("Core matched nothing: the recorded identity beats its own lossy re-derivation", () => {
  const target = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: { kind: "element", fingerprint: { selector: "#save-settings", statePath: "web.elements.save.changes" }, source: "runtime" }
  });
  assert.equal(signalCount(target), 12, "all twelve recorded signals reach the wire, not just the selector");
  assert.equal((target?.element).testId, "save-changes");
  assert.equal((target?.element).accessibleName, "Save changes");
  assert.equal((target?.element).implicitRole, "button");
  assert.equal(target?.selector, "#save-settings");
});
test("Core matched a candidate: the drift-corrected candidate beats the recorded identity", () => {
  const target = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: {
      kind: "element",
      fingerprint: { selector: "#save-settings" },
      candidates: [
        { candidateId: "candidate.stale", selector: "#save-settings-old", tagName: "button" },
        { candidateId: "candidate.current", selector: "#settings-save-v2", tagName: "button", testId: "save-changes", accessibleName: "Save changes" }
      ],
      selectedCandidate: { candidateId: "candidate.current", confidence: 0.91, matchedSignals: ["testId"], failedSignals: ["selector"] }
    }
  });
  assert.equal((target?.element).selector, "#settings-save-v2", "the element the page really has, not the one that was recorded");
  assert.equal(target?.selector, "#settings-save-v2");
  assert.ok(signalCount(target) < 12);
});
test("Core matched but adapted only the fingerprint: the adaptation is still not discarded", () => {
  const target = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: {
      kind: "element",
      fingerprint: { selector: "#settings-save-v2", tagName: "button", testId: "save-changes-v2" },
      selectedCandidate: { candidateId: "candidate.current", confidence: 0.88, matchedSignals: ["testId"], failedSignals: [] }
    }
  });
  assert.equal((target?.element).testId, "save-changes-v2");
  assert.equal((target?.element).selector, "#settings-save-v2");
});
test("an adapted target's own element wins when Core matched, and when it names another control", () => {
  const adaptedElement = { selector: "#settings-save-v2", tagName: "button", testId: "save-changes-v2" };
  const matched = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: { element: adaptedElement, selectedCandidate: { candidateId: "candidate.current", confidence: 0.9 } }
  });
  assert.equal((matched?.element).testId, "save-changes-v2");
  const unmatched = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: { element: adaptedElement }
  });
  assert.equal((unmatched?.element).testId, "save-changes-v2", "an element the recording never described is an adaptation");
  const passThrough = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: { element: { selector: "#save-settings", tagName: "BUTTON", testId: "save-changes", visibleText: " Save changes " } }
  });
  assert.equal(signalCount(passThrough), 12, "the recording's own values, however Core spaced or cased them, keep the richer recording");
});
test("a source with no recognized signal does not shadow one that has them", () => {
  const target = outputTargetFromPayload({
    selector: "#save-settings",
    element: { nothingRecognized: true },
    target: { kind: "element", fingerprint: { selector: "#save-settings", tagName: "button" }, source: "runtime" }
  });
  assert.deepEqual(target?.element, { selector: "#save-settings", tagName: "button" });
});
test("the element ordering does not decide the selector or the emptiness guard", () => {
  assert.equal(outputTargetFromPayload({
    selector: "#recorded",
    element: recordedElement,
    target: { kind: "element", fingerprint: { selector: "#adapted" }, source: "runtime" }
  })?.selector, "#adapted");
  assert.equal(outputTargetFromPayload({ element: recordedElement })?.selector, "#save-settings", "an element-only payload still resolves its selector from the element");
  assert.equal(outputTargetFromPayload({ element: { tagName: "button", text: "Save" } }), void 0, "no selector and no visual target is still no target");
});
var repairedSave = {
  handles: { element: "target.2" },
  handleResolution: "named",
  tagName: "button",
  accessibleName: "Apply changes",
  selector: "main > form > section:nth-of-type(1) > div > button:nth-of-type(1)",
  metadata: { controlType: "submit", formId: "settings-form" }
};
var recordedNode = () => webAutomationOutputPayload("web.dom.click", {
  element: recordedElement,
  visualTarget: { namespace: "web", statePath: "web.elements.button.save", documentBounds: { x: 10, y: 20, width: 90, height: 30 } }
});
function dispatched(parameters) {
  const target = normalizeAutomationStudioElementTarget(parameters.target, { source: "runtime" }) ?? normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
  assert.ok(target, "Core found an element target to prepare");
  return { ...parameters, target };
}
test("an applied repair, as the node stores it, names the element the page is asked for", () => {
  const node = { ...recordedNode(), target: repairedSave };
  assert.equal(adaptedTargetSupersedesRecording(node), true);
  const target = outputTargetFromPayload(node);
  assert.equal(target?.selector, repairedSave.selector);
  assert.deepEqual(target?.element, { selector: repairedSave.selector, tagName: "button", accessibleName: "Apply changes" });
});
test("the same repair after Core's dispatch rewrite still names it, though its handles are gone", () => {
  const node = dispatched({ ...recordedNode(), target: repairedSave });
  assert.equal("handles" in node.target, false, "Core's rewrite keeps no marker, which is why the rule reads content");
  assert.equal(adaptedTargetSupersedesRecording(node), true);
  const target = outputTargetFromPayload(node);
  assert.equal(target?.selector, repairedSave.selector);
  assert.deepEqual(target?.element, { selector: repairedSave.selector, tagName: "button", accessibleName: "Apply changes" });
  assert.equal((target?.element).testId, void 0, "nothing of the stale Save rides along");
});
test("Core's rewrite of an unrepaired node is recognised as the recording, whatever the recording looked like", () => {
  const longText = `Save ${"and keep going ".repeat(120)}`.trim();
  const recordings = [
    ["the identity-drift Save", "web.dom.click", { element: { ...recordedElement, role: "", context: { formId: "settings-form", heading: "Workspace settings" } } }],
    ["a typed field, whose typed text is not its identity", "web.dom.type", { inputValue: "Aurora Field Team", element: { selector: "#display-name", tagName: "input", inputType: "text", name: "displayName", label: "Workspace name", implicitRole: "textbox" } }],
    ["signals only in the attributes", "web.dom.click", { element: { selector: "button.go", tagName: "button", attributes: { "aria-label": "Go now", "data-testid": "go" } } }],
    ["padded text and an upper-case tag", "web.dom.click", { element: { selector: "#pad", tagName: "BUTTON", visibleText: "  Save changes  ", text: " Save changes " } }],
    ["text and an implied role only", "web.dom.click", { element: { selector: "#plain", tagName: "a", text: "Read more", implicitRole: "link", href: "https://example.test/more" } }],
    ["text past Core's length bound", "web.dom.click", { element: { selector: "#long", tagName: "button", visibleText: longText } }],
    ["a visual target beside the element", "web.dom.click", { element: { selector: "#v", tagName: "button", visibleText: "Next" }, visualTarget: { namespace: "web", statePath: "web.elements.next", entityId: "next", entityKind: "button" } }]
  ];
  assert.ok(longText.length > 1e3, "the fixture reaches Core's bound");
  for (const [name, outputId, recording] of recordings) {
    const node = webAutomationOutputPayload(outputId, recording);
    const prepared = dispatched(node);
    assert.equal(adaptedTargetSupersedesRecording(prepared), false, name);
    assert.deepEqual(outputTargetFromPayload(prepared)?.element, outputTargetFromPayload(node)?.element, `${name}: the recording is dispatched whole`);
  }
});
test("a target that only moves the recorded control keeps the recorded identity, and still moves the selector", () => {
  const node = dispatched({ ...recordedNode(), target: { tagName: "button", accessibleName: "Save changes", visibleText: "Save changes", selector: "footer > button" } });
  assert.equal(adaptedTargetSupersedesRecording(node), false);
  const target = outputTargetFromPayload(node);
  assert.equal(target?.selector, "footer > button");
  assert.equal(signalCount(target), 12, "the page checks the new place against everything the recording knew");
});
test("a repair with no selector still carries its own identity, beside the recorded selector the page will check against it", () => {
  const fingerprintOnly = { handles: repairedSave.handles, handleResolution: "named", tagName: "button", accessibleName: "Apply changes", metadata: repairedSave.metadata };
  const node = dispatched({ ...recordedNode(), target: fingerprintOnly });
  const target = outputTargetFromPayload(node);
  assert.deepEqual(target?.element, { tagName: "button", accessibleName: "Apply changes" });
  assert.equal(target?.selector, "#save-settings", "the recorded selector is a hint the page vetoes by the repair, not by the recording");
});
test("handles without a resolution are not the domain's mark, and the content rule still decides", () => {
  const sameControl = { ...recordedNode(), target: { handles: { element: "target.1" }, tagName: "button", accessibleName: "Save changes" } };
  assert.equal(adaptedTargetSupersedesRecording(sameControl), false);
  const otherControl = { ...recordedNode(), target: { handles: { element: "target.1" }, handleResolution: "guessed", tagName: "button", accessibleName: "Discard changes" } };
  assert.equal(adaptedTargetSupersedesRecording(otherControl), true);
  assert.equal(adaptedTargetSupersedesRecording(recordedNode()), false, "no target at all is the recording");
});
var recordedContext = {
  formId: "settings-form",
  formName: "settings",
  formAction: "/workspace/settings",
  fieldsetLegend: "General",
  landmark: "main",
  landmarkName: "Workspace",
  heading: "Workspace settings",
  listPosition: { index: 3, total: 24 },
  tablePosition: { row: 2, column: 4, columnHeader: "Total" }
};
test("where the element sat survives into the fingerprint, field by field", () => {
  const fingerprint = elementFingerprint({ selector: "#save", tagName: "button", context: recordedContext });
  assert.deepEqual(fingerprint?.context, recordedContext);
});
test("and into the dispatched target, which is the layer it used to die at", () => {
  const target = outputTargetFromPayload({
    selector: "#save",
    element: { selector: "#save", tagName: "button", context: { formName: "settings", fieldsetLegend: "General" } }
  });
  assert.deepEqual((target?.element).context, { formName: "settings", fieldsetLegend: "General" });
});
test("a context key the normalizer does not know does not reach the page", () => {
  const fingerprint = elementFingerprint({
    selector: "#save",
    context: { formName: "settings", formIdentifier: "settings-form", landmark: 7 }
  });
  assert.deepEqual(fingerprint?.context, { formName: "settings" }, "an unknown key and a mistyped one are both dropped");
});
test("a position is only a position when it is complete", () => {
  const partial = elementFingerprint({
    selector: "#cell",
    context: { listPosition: { index: 3 }, tablePosition: { row: 2, column: 4 } }
  });
  assert.deepEqual(partial?.context, { tablePosition: { row: 2, column: 4 } }, "an index with no total says how far along nothing");
});
test("an element inside no form, list or table carries no context at all", () => {
  assert.equal("context" in (elementFingerprint({ selector: "#plain", tagName: "div" }) ?? {}), false);
  assert.equal("context" in (elementFingerprint({ selector: "#plain", context: {} }) ?? {}), false, "an empty context is absent, not an empty object");
  assert.equal("context" in (elementFingerprint({ selector: "#plain", context: "main" }) ?? {}), false, "a context that is not an object is absent");
});
test("the attribute map is narrowed to the strings Core compares", () => {
  const fingerprint = elementFingerprint({
    selector: "#save",
    attributes: { "data-testid": "save", "aria-hidden": true, "data-config": { nested: 1 } }
  });
  assert.deepEqual(fingerprint?.attributes, { "data-testid": "save" });
  assert.deepEqual(elementFingerprint({ selector: "#save", attributes: {} })?.attributes, {}, "an element that carried an empty map still carries one");
});
test("a checkbox's checked state survives into the fingerprint and the dispatched target, unchecked included", () => {
  assert.equal(elementFingerprint({ selector: "#agree", inputType: "checkbox", checked: true })?.checked, true);
  const target = outputTargetFromPayload({
    selector: "#agree",
    element: { selector: "#agree", tagName: "input", inputType: "checkbox", checked: false }
  });
  assert.equal((target?.element).checked, false, "false is a state, not an absence");
});
test("a checked state that is not a boolean does not reach the page", () => {
  for (const checked of ["true", 1, null, { value: true }]) {
    assert.equal("checked" in (elementFingerprint({ selector: "#agree", checked }) ?? {}), false, JSON.stringify(checked));
  }
});
test("a landmark's name reaches the dispatched target beside the role it names", () => {
  const target = outputTargetFromPayload({
    selector: "#agree",
    element: { selector: "#agree", context: { landmark: "region", landmarkName: "Billing details" } }
  });
  assert.deepEqual((target?.element).context, { landmark: "region", landmarkName: "Billing details" });
  assert.equal("context" in (elementFingerprint({ selector: "#agree", context: { landmarkName: 7 } }) ?? {}), false, "a name that is not text is no context at all");
});
