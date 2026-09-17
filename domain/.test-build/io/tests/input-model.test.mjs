// src/io/tests/input-model.test.ts
import assert from "node:assert/strict";

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
    const field2 = isWebAutomationExtractFieldKey(key) ? fieldValue(entry) : void 0;
    if (field2 === void 0) return void 0;
    read.push([key, field2]);
  }
  if (read.length === 0 || read.every(([, field2]) => typeof field2 !== "string" && field2.handling === "exclude")) return void 0;
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
  const field2 = {
    kind,
    ...selector !== void 0 ? { selector } : {},
    ...attribute !== void 0 ? { attribute } : {},
    ...header !== void 0 ? { header } : {},
    ...required !== void 0 ? { required } : {},
    ...handling !== void 0 ? { handling } : {},
    ...element !== void 0 ? { element } : {}
  };
  return field2;
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

// src/actions/types.ts
var WEB_AUTOMATION_ACTION_TYPES = [
  "web.browser.navigate",
  "web.dom.click",
  "web.dom.type",
  "web.dom.clear",
  "web.dom.select",
  "web.dom.scroll",
  "web.dom.keypress",
  "web.dom.wait_for_selector",
  "web.dom.wait_for_text",
  "web.dom.extract",
  "web.dom.capture_snapshot",
  "web.dom.check",
  "web.dom.assert",
  "web.dom.extract_list",
  "web.dom.upload",
  "web.dom.dialog",
  "web.browser.tab",
  "web.browser.download"
];

// src/constants.ts
var WEB_AUTOMATION_DOMAIN_ID = "web-automation";
var WEB_AUTOMATION_EVENTS = {
  clientReady: "web.client.ready",
  tabStateChanged: "web.tab.state_changed",
  pageNavigated: "web.page.navigated",
  elementClicked: "web.element.clicked",
  elementInputChanged: "web.element.input_changed",
  elementChanged: "web.element.changed",
  formSubmitted: "web.form.submitted",
  elementFocused: "web.element.focused",
  elementBlurred: "web.element.blurred",
  keyboardPressed: "web.keyboard.pressed",
  mouseWheel: "web.mouse.wheel",
  scrollChanged: "web.scroll.changed",
  domMutated: "web.dom.mutated",
  dataExtractionDefined: "web.data.extraction_defined",
  snapshotCaptured: "web.snapshot.captured",
  actionExecuted: "web.action.executed",
  clientError: "web.client.error"
};

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
  "Detect the list with web.detect_repeating_structure; name it in extractList by its handle.",
  "It saves its rows itself: no recordOutput or save node needed."
].join(" ");
var WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR = [
  `Detected: {handle: "extraction.N", fields?: {key: "detectedKey" | "detectedKey@href"}, paginate?: false (this page only)};`,
  "fields: only those columns, renamed; a link column reads the absolute URL, @href the raw href.",
  `Else {item: css, fields: {key: "css" | "css@attr" | "column:Header" | {kind: ${WEB_AUTOMATION_EXTRACT_FIELD_KINDS.join("|")}, selector?, attribute?, header?, required?: false}},`,
  `paginate?: {mode: "next", next: css, maxPages} ("loadMore": control, "numbered": pages) | {mode: "scroll", maxScrolls}, max ${WEB_AUTOMATION_EXTRACT_MAX_PAGES}}.`,
  `Keys A-Za-z0-9_-. Both take minItems (default 1; 0 allows none), maxItems (max ${WEB_AUTOMATION_EXTRACT_MAX_ITEMS}).`
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
  for (const [key, field2] of entries) {
    if (isPlainObject(field2) && Object.keys(field2).some((specKey) => !specKeys.has(specKey))) issues.add("web.extract_list.unknown_field_key");
    if (!isWebAutomationExtractFieldKey(key)) {
      issues.add("web.extract_list.invalid_field_key");
      fieldRefused = true;
    } else if (!readable({ fields: { [key]: field2, [key === "probe" ? "probe_2" : "probe"]: "*" } })) {
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
function webAutomationSecretBindingPath(value) {
  const path = stringValue(objectValue(objectValue(value)?.$state)?.path);
  return path?.startsWith(WEB_AUTOMATION_SECRET_STATE_PREFIX) ? path : void 0;
}

// src/output-nodes/upload-binding.ts
var WEB_AUTOMATION_UPLOAD_STATE_PREFIX = "web.upload.";
function webAutomationUploadStatePath(key) {
  return `${WEB_AUTOMATION_UPLOAD_STATE_PREFIX}${key}`;
}
function webAutomationUploadBinding(key) {
  return { $state: { path: webAutomationUploadStatePath(key) } };
}
function webAutomationUploadBindingPath(value) {
  const path = stringValue(objectValue(objectValue(value)?.$state)?.path);
  return path?.startsWith(WEB_AUTOMATION_UPLOAD_STATE_PREFIX) ? path : void 0;
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
  const visualTarget2 = objectValue(payload.visualTarget);
  const target = compact({ ...element ? { element } : {}, ...visualTarget2 ? { visualTarget: visualTarget2 } : {} });
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
  const recorded2 = stringValue(payload.inputValue);
  if (recorded2 !== void 0) return recorded2;
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

// src/output-nodes/registry.ts
function listWebAutomationOutputNodeDefinitions() {
  return webAutomationOutputNodeDefinitions.map((definition) => structuredClone(definition));
}

// src/io/input-model.ts
var WEB_AUTOMATION_INPUT_IDS = {
  browserState: "web.browser.state",
  recordingEvidence: "web.recording.evidence",
  navigationRequested: "web.user.navigation_requested",
  elementClicked: "web.user.element_clicked",
  textEntered: "web.user.text_entered",
  fieldCleared: "web.user.field_cleared",
  optionSelected: "web.user.option_selected",
  checkboxToggled: "web.user.checkbox_toggled",
  keyPressed: "web.user.key_pressed",
  pageScrolled: "web.user.page_scrolled",
  filesChosen: "web.user.files_chosen",
  tabSwitched: "web.user.tab_switched",
  tabClosed: "web.user.tab_closed",
  // One input, for the one form of extraction the product can define: a list,
  // which saves a dataset.
  //
  // The single-value form had its own input -- an input maps to exactly one
  // output, and the two forms run different verbs -- and nothing could ever
  // produce it. The worker refuses to start a `value` pick and refuses one that
  // arrives anyway (`background/extraction/control.ts`), `confirm.ts` refuses a
  // `value` definition on the run path, and the picker's recorded event attaches
  // no element for one. A registered action input that no event can reach
  // advertises a trigger that never fires, which is the mirror of an unmapped
  // input becoming executable, so it is not registered.
  //
  // The domain still *reads* a value definition
  // (`actions/extraction/recorded-definition.ts`) and `web.dom.extract` remains
  // an output a Flow may author; a recorded one stays passive evidence. When the
  // picker can record a single value, this is one id and one row again.
  dataExtractionDefined: "web.user.data_extraction_defined"
};
function webAutomationEventTypeForClientKind(kind) {
  if (kind === "content.ready") return WEB_AUTOMATION_EVENTS.clientReady;
  if (kind === "browser.tab") return WEB_AUTOMATION_EVENTS.tabStateChanged;
  if (kind === "browser.navigation") return WEB_AUTOMATION_EVENTS.pageNavigated;
  if (kind === "dom.click") return WEB_AUTOMATION_EVENTS.elementClicked;
  if (kind === "dom.input") return WEB_AUTOMATION_EVENTS.elementInputChanged;
  if (kind === "dom.change") return WEB_AUTOMATION_EVENTS.elementChanged;
  if (kind === "dom.submit") return WEB_AUTOMATION_EVENTS.formSubmitted;
  if (kind === "dom.focus") return WEB_AUTOMATION_EVENTS.elementFocused;
  if (kind === "dom.blur") return WEB_AUTOMATION_EVENTS.elementBlurred;
  if (kind === "dom.keydown") return WEB_AUTOMATION_EVENTS.keyboardPressed;
  if (kind === "dom.wheel") return WEB_AUTOMATION_EVENTS.mouseWheel;
  if (kind === "dom.scroll") return WEB_AUTOMATION_EVENTS.scrollChanged;
  if (kind === "dom.mutation") return WEB_AUTOMATION_EVENTS.domMutated;
  if (kind === "dom.snapshot") return WEB_AUTOMATION_EVENTS.snapshotCaptured;
  if (kind === "data.extract") return WEB_AUTOMATION_EVENTS.dataExtractionDefined;
  if (kind === "action.result") return WEB_AUTOMATION_EVENTS.actionExecuted;
  return WEB_AUTOMATION_EVENTS.clientError;
}
function webAutomationRecordedAction(eventType, payload, metadata = {}) {
  const inputId = recordedActionInputId(eventType, payload, metadata);
  if (inputId === void 0) return void 0;
  const outputId = OUTPUT_FOR_ACTION_INPUT.get(inputId);
  if (outputId === void 0) return void 0;
  const parameters = webAutomationOutputPayload(outputId, payload);
  return hasExecutableParameters(outputId, parameters) ? { inputId, outputId, parameters } : void 0;
}
function webAutomationInputIdForRecordedEvent(payload) {
  return webAutomationRecordedAction(webAutomationEventTypeForClientKind(payload.kind), payload, payload.metadata)?.inputId;
}
var stateInputDefinitions = [
  { id: WEB_AUTOMATION_INPUT_IDS.browserState, title: "Browser state", description: "Current browser, tab, and compact DOM state available for policy conditions.", role: "state" },
  { id: WEB_AUTOMATION_INPUT_IDS.recordingEvidence, title: "Web recording evidence", description: "Passive browser observations that may inform recordings but never execute a policy.", role: "event" }
];
var actionInputDefinitions = [
  [WEB_AUTOMATION_INPUT_IDS.navigationRequested, "Navigation requested", "web.browser.navigate"],
  [WEB_AUTOMATION_INPUT_IDS.elementClicked, "Element clicked", "web.dom.click"],
  [WEB_AUTOMATION_INPUT_IDS.textEntered, "Text entered", "web.dom.type"],
  [WEB_AUTOMATION_INPUT_IDS.fieldCleared, "Field cleared", "web.dom.clear"],
  [WEB_AUTOMATION_INPUT_IDS.optionSelected, "Option selected", "web.dom.select"],
  [WEB_AUTOMATION_INPUT_IDS.checkboxToggled, "Checkbox toggled", "web.dom.check"],
  [WEB_AUTOMATION_INPUT_IDS.keyPressed, "Key pressed", "web.dom.keypress"],
  [WEB_AUTOMATION_INPUT_IDS.pageScrolled, "Page scrolled", "web.dom.scroll"],
  [WEB_AUTOMATION_INPUT_IDS.filesChosen, "Files chosen", "web.dom.upload"],
  [WEB_AUTOMATION_INPUT_IDS.tabSwitched, "Tab switched", "web.browser.tab"],
  [WEB_AUTOMATION_INPUT_IDS.tabClosed, "Tab closed", "web.browser.tab"],
  [WEB_AUTOMATION_INPUT_IDS.dataExtractionDefined, "Data extraction defined", "web.dom.extract_list"]
];
var OUTPUT_FOR_ACTION_INPUT = new Map(
  actionInputDefinitions.map(([inputId, , outputId]) => [inputId, outputId])
);
var RECORDING_START_REASON = "recording_start";
function recordedActionInputId(eventType, payload, metadata) {
  switch (eventType) {
    case WEB_AUTOMATION_EVENTS.pageNavigated:
      return metadata.transition === "typed" && metadata.reason !== RECORDING_START_REASON ? WEB_AUTOMATION_INPUT_IDS.navigationRequested : void 0;
    case WEB_AUTOMATION_EVENTS.elementClicked:
      return WEB_AUTOMATION_INPUT_IDS.elementClicked;
    case WEB_AUTOMATION_EVENTS.keyboardPressed:
      return isSelectValueChangeKeyPress(payload) ? void 0 : WEB_AUTOMATION_INPUT_IDS.keyPressed;
    // The recorder emits `dom.scroll` for wheel and window scrolling alike;
    // `dom.wheel` is never emitted, so its event type maps to no input.
    case WEB_AUTOMATION_EVENTS.scrollChanged:
      return WEB_AUTOMATION_INPUT_IDS.pageScrolled;
    case WEB_AUTOMATION_EVENTS.tabStateChanged:
      return recordedTabInputId(payload);
    // An extraction the user defined with the picker. A definition the reader
    // refuses is not one: it stays evidence rather than becoming an extraction
    // that reads something other than what was picked. A single-value
    // definition stays evidence too -- no input is registered for it, because
    // nothing can produce one (`WEB_AUTOMATION_INPUT_IDS`).
    case WEB_AUTOMATION_EVENTS.dataExtractionDefined: {
      const definition = webAutomationRecordedExtraction(payload.extraction);
      return definition?.form === "list" ? WEB_AUTOMATION_INPUT_IDS.dataExtractionDefined : void 0;
    }
    case WEB_AUTOMATION_EVENTS.elementInputChanged:
    case WEB_AUTOMATION_EVENTS.elementChanged: {
      const element = objectValue2(payload.element);
      if (stringValue2(element?.inputType)?.toLowerCase() === "file") return payload.inputValue === "" || element?.hasValue === false ? void 0 : WEB_AUTOMATION_INPUT_IDS.filesChosen;
      if (stringValue2(element?.tagName)?.toLowerCase() === "select") return WEB_AUTOMATION_INPUT_IDS.optionSelected;
      if (isCheckableElement(element)) return WEB_AUTOMATION_INPUT_IDS.checkboxToggled;
      return payload.inputValue === "" ? WEB_AUTOMATION_INPUT_IDS.fieldCleared : WEB_AUTOMATION_INPUT_IDS.textEntered;
    }
    default:
      return void 0;
  }
}
function isCheckableElement(element) {
  const inputType = stringValue2(element?.inputType)?.toLowerCase();
  if (inputType === "checkbox" || inputType === "radio") return true;
  const role = stringValue2(element?.role)?.toLowerCase();
  return role === "checkbox" || role === "radio" || role === "switch";
}
var SELECT_VALUE_CHANGE_KEYS = /* @__PURE__ */ new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]);
function isSelectValueChangeKeyPress(payload) {
  const element = objectValue2(payload.element);
  if (stringValue2(element?.tagName)?.toLowerCase() !== "select") return false;
  const key = stringValue2(payload.key);
  if (key === void 0) return false;
  return SELECT_VALUE_CHANGE_KEYS.has(key) || [...key].length === 1;
}
function hasExecutableParameters(outputId, parameters) {
  const schema = webAutomationActionDefinitions.find((definition) => definition.actionType === outputId)?.parameterSchema;
  const required = Array.isArray(schema?.required) ? schema.required.filter((key) => typeof key === "string") : [];
  if (!required.every((key) => isExecutableRequiredParameter(key, parameters[key]))) return false;
  if (outputId === "web.dom.keypress") return isNonEmptyString(parameters.key);
  if (outputId === "web.dom.scroll") return typeof parameters.x === "number" || typeof parameters.y === "number";
  if (outputId === "web.dom.check") return typeof parameters.checked === "boolean";
  return true;
}
function isExecutableRequiredParameter(key, value) {
  if (key === "upload") return webAutomationUploadBindingPath(value) !== void 0;
  if (key === "extractList") return webAutomationExtractListRequestValue(value) !== void 0;
  if (key === "tab") {
    const tab = objectValue2(value);
    return tab?.operation === "close" || tab?.operation === "switch" && isNonEmptyString(tab.urlPath);
  }
  return isNonEmptyString(value) || webAutomationSecretBindingPath(value) !== void 0;
}
function recordedTabInputId(payload) {
  const operation = objectValue2(payload.tab)?.operation;
  if (operation === "switch") return WEB_AUTOMATION_INPUT_IDS.tabSwitched;
  if (operation === "close") return WEB_AUTOMATION_INPUT_IDS.tabClosed;
  return void 0;
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}
function objectValue2(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function stringValue2(value) {
  return typeof value === "string" ? value : void 0;
}

// src/io/tests/input-model.test.ts
var button = { selector: "#save", tagName: "button", text: "Save", xpath: "/html/body/form/button", id: "save", role: "button" };
var field = { selector: "input[name=q]", tagName: "input", inputType: "text", name: "q", xpath: "/html/body/form/input" };
var planSelect = { selector: "select#plan", tagName: "select", id: "plan" };
var termsCheckbox = { selector: "input#terms", tagName: "input", inputType: "checkbox", id: "terms" };
var termsCheckboxChecked = { ...termsCheckbox, checked: true };
var planRadio = { selector: "input#plan-team", tagName: "input", inputType: "radio", id: "plan-team" };
var visualTarget = { namespace: "web", statePath: "web.elements.button.save", selector: "#save" };
function recorded(kind, extra = {}) {
  return { kind, url: "https://example.test/form", title: "Form", sequence: 1, ...extra };
}
var rows = [
  { row: "1 content.ready", event: recorded("content.ready"), eventType: WEB_AUTOMATION_EVENTS.clientReady },
  { row: "2 browser.tab", event: recorded("browser.tab"), eventType: WEB_AUTOMATION_EVENTS.tabStateChanged },
  {
    row: "3 browser.navigation, typed",
    event: recorded("browser.navigation", { metadata: { transition: "typed" } }),
    eventType: WEB_AUTOMATION_EVENTS.pageNavigated,
    inputId: WEB_AUTOMATION_INPUT_IDS.navigationRequested,
    outputId: "web.browser.navigate"
  },
  { row: "4 browser.navigation, not typed", event: recorded("browser.navigation", { metadata: { transition: "link" } }), eventType: WEB_AUTOMATION_EVENTS.pageNavigated },
  { row: "4a browser.navigation, explained: a click's landing is evidence", event: recorded("browser.navigation", { metadata: { transition: "explained", explainedBy: 1, explainedByEventId: "web.1.100" } }), eventType: WEB_AUTOMATION_EVENTS.pageNavigated },
  {
    row: "5 dom.click",
    event: recorded("dom.click", { element: button }),
    eventType: WEB_AUTOMATION_EVENTS.elementClicked,
    inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked,
    outputId: "web.dom.click"
  },
  {
    row: "6 dom.input, non-empty",
    event: recorded("dom.input", { element: field, inputValue: "ada" }),
    eventType: WEB_AUTOMATION_EVENTS.elementInputChanged,
    inputId: WEB_AUTOMATION_INPUT_IDS.textEntered,
    outputId: "web.dom.type"
  },
  {
    row: "7 dom.input, empty value",
    event: recorded("dom.input", { element: field, inputValue: "" }),
    eventType: WEB_AUTOMATION_EVENTS.elementInputChanged,
    inputId: WEB_AUTOMATION_INPUT_IDS.fieldCleared,
    outputId: "web.dom.clear"
  },
  {
    row: "8 dom.change, <select>",
    event: recorded("dom.change", { element: planSelect, inputValue: "team" }),
    eventType: WEB_AUTOMATION_EVENTS.elementChanged,
    inputId: WEB_AUTOMATION_INPUT_IDS.optionSelected,
    outputId: "web.dom.select"
  },
  {
    // A checkbox is set, not typed into. Without a recorded checked state the
    // replay would have to guess between checking and unchecking, so the
    // toggle stays evidence rather than becoming a wrong action.
    row: "9 dom.change, checkbox, no recorded state",
    event: recorded("dom.change", { element: termsCheckbox, inputValue: "on" }),
    eventType: WEB_AUTOMATION_EVENTS.elementChanged
  },
  {
    row: "9a dom.change, checkbox with a recorded state",
    event: recorded("dom.change", { element: termsCheckboxChecked, inputValue: "on" }),
    eventType: WEB_AUTOMATION_EVENTS.elementChanged,
    inputId: WEB_AUTOMATION_INPUT_IDS.checkboxToggled,
    outputId: "web.dom.check"
  },
  {
    // A radio's change can only mean "now selected", so it needs no recorded state.
    row: "9b dom.change, radio",
    event: recorded("dom.change", { element: planRadio, inputValue: "team" }),
    eventType: WEB_AUTOMATION_EVENTS.elementChanged,
    inputId: WEB_AUTOMATION_INPUT_IDS.checkboxToggled,
    outputId: "web.dom.check"
  },
  { row: "10 dom.submit", event: recorded("dom.submit", { element: { selector: "form", tagName: "form" } }), eventType: WEB_AUTOMATION_EVENTS.formSubmitted },
  {
    row: "11 dom.keydown",
    event: recorded("dom.keydown", { element: field, key: "Enter" }),
    eventType: WEB_AUTOMATION_EVENTS.keyboardPressed,
    inputId: WEB_AUTOMATION_INPUT_IDS.keyPressed,
    outputId: "web.dom.keypress"
  },
  {
    row: "12 dom.scroll",
    event: recorded("dom.scroll", { scroll: { x: 0, y: 640 }, metadata: { sourceEvent: "wheel", deltaY: 120 } }),
    eventType: WEB_AUTOMATION_EVENTS.scrollChanged,
    inputId: WEB_AUTOMATION_INPUT_IDS.pageScrolled,
    outputId: "web.dom.scroll"
  },
  { row: "13 dom.wheel, never emitted", event: recorded("dom.wheel", { scroll: { x: 0, y: 640 } }), eventType: WEB_AUTOMATION_EVENTS.mouseWheel },
  { row: "14 dom.mutation", event: recorded("dom.mutation"), eventType: WEB_AUTOMATION_EVENTS.domMutated },
  { row: "15 dom.focus, never emitted", event: recorded("dom.focus", { element: field }), eventType: WEB_AUTOMATION_EVENTS.elementFocused },
  { row: "16 dom.blur, never emitted", event: recorded("dom.blur", { element: field }), eventType: WEB_AUTOMATION_EVENTS.elementBlurred },
  { row: "17 dom.snapshot, never emitted", event: recorded("dom.snapshot"), eventType: WEB_AUTOMATION_EVENTS.snapshotCaptured },
  { row: "18 action.result", event: recorded("action.result"), eventType: WEB_AUTOMATION_EVENTS.actionExecuted },
  { row: "19 client.error, never emitted", event: recorded("client.error"), eventType: WEB_AUTOMATION_EVENTS.clientError }
];
var fileInput = { selector: "#attachment", tagName: "input", inputType: "file", id: "attachment" };
rows.push(
  {
    row: "2a browser.tab, a switch with a path",
    event: recorded("browser.tab", { tab: { operation: "switch", urlPath: "/scenarios/multi-tab/details" } }),
    eventType: WEB_AUTOMATION_EVENTS.tabStateChanged,
    inputId: WEB_AUTOMATION_INPUT_IDS.tabSwitched,
    outputId: "web.browser.tab"
  },
  {
    row: "2b browser.tab, a close",
    event: recorded("browser.tab", { tab: { operation: "close" } }),
    eventType: WEB_AUTOMATION_EVENTS.tabStateChanged,
    inputId: WEB_AUTOMATION_INPUT_IDS.tabClosed,
    outputId: "web.browser.tab"
  },
  // A switch naming no tab would go to whichever tab happened to be in front.
  { row: "2c browser.tab, a switch without a path", event: recorded("browser.tab", { tab: { operation: "switch" } }), eventType: WEB_AUTOMATION_EVENTS.tabStateChanged },
  { row: "2d browser.tab, a switch whose path is a full URL", event: recorded("browser.tab", { tab: { operation: "switch", urlPath: "https://example.test/details?session=tok" } }), eventType: WEB_AUTOMATION_EVENTS.tabStateChanged },
  { row: "2e browser.tab, the recording-start marker", event: recorded("browser.tab", { metadata: { recordingState: "started" } }), eventType: WEB_AUTOMATION_EVENTS.tabStateChanged },
  {
    row: "9c dom.change, file input",
    event: recorded("dom.change", { element: fileInput, inputValue: "C:\\fakepath\\tax-return-2025.pdf" }),
    eventType: WEB_AUTOMATION_EVENTS.elementChanged,
    inputId: WEB_AUTOMATION_INPUT_IDS.filesChosen,
    outputId: "web.dom.upload"
  },
  {
    // What the recorder sends once it stops reading a file input's value.
    row: "9d dom.change, file input with no recorded value",
    event: recorded("dom.change", { element: fileInput }),
    eventType: WEB_AUTOMATION_EVENTS.elementChanged,
    inputId: WEB_AUTOMATION_INPUT_IDS.filesChosen,
    outputId: "web.dom.upload"
  },
  // An input the user emptied holds no files: no upload, and never a cleared field.
  { row: "9e dom.change, file input emptied", event: recorded("dom.change", { element: fileInput, inputValue: "" }), eventType: WEB_AUTOMATION_EVENTS.elementChanged },
  { row: "9f dom.input, file input", event: recorded("dom.input", { element: fileInput, inputValue: "C:\\fakepath\\tax-return-2025.pdf" }), eventType: WEB_AUTOMATION_EVENTS.elementInputChanged, inputId: WEB_AUTOMATION_INPUT_IDS.filesChosen, outputId: "web.dom.upload" },
  // What the recorder sends since it withholds a file input's value: presence only.
  { row: "9g dom.change, file input recorded holding files", event: recorded("dom.change", { element: { ...fileInput, hasValue: true } }), eventType: WEB_AUTOMATION_EVENTS.elementChanged, inputId: WEB_AUTOMATION_INPUT_IDS.filesChosen, outputId: "web.dom.upload" },
  // A cancelled choice recorded the same way holds no files. As an upload, the runner would fill it.
  { row: "9h dom.change, file input recorded holding no files", event: recorded("dom.change", { element: { ...fileInput, hasValue: false } }), eventType: WEB_AUTOMATION_EVENTS.elementChanged },
  { row: "9i dom.input, file input recorded holding no files", event: recorded("dom.input", { element: { ...fileInput, hasValue: false } }), eventType: WEB_AUTOMATION_EVENTS.elementInputChanged }
);
var listExtraction = {
  form: "list",
  datasetId: "products:4f1c9a",
  label: "Products",
  itemCount: 24,
  request: { item: "li.product", fields: { name: { kind: "text", selector: ".name" } }, paginate: { next: "a.next", maxPages: 3 } },
  fieldLabels: { name: "Product name" }
};
var valueExtraction = { form: "value", label: "Order total", read: { mode: "text" } };
var heading = { selector: "h1.total", tagName: "h1", id: "total" };
rows.push(
  {
    row: "20 data.extract, a list",
    event: recorded("data.extract", { extraction: listExtraction }),
    eventType: WEB_AUTOMATION_EVENTS.dataExtractionDefined,
    inputId: WEB_AUTOMATION_INPUT_IDS.dataExtractionDefined,
    outputId: "web.dom.extract_list"
  },
  // A single value maps to no input. The picker refuses to start a `value` pick
  // and refuses one that arrives anyway, and the confirm path refuses a `value`
  // definition, so an input for it would be a trigger that never fires.
  {
    row: "20a data.extract, a single value",
    event: recorded("data.extract", { element: heading, extraction: valueExtraction }),
    eventType: WEB_AUTOMATION_EVENTS.dataExtractionDefined
  },
  // A request the lift would refuse at dispatch must not become a node here
  // either: the node would reach Core, dispatch, and be refused with the Flow
  // already built around it.
  { row: "20b data.extract, a request that cannot be read", event: recorded("data.extract", { extraction: { ...listExtraction, request: { item: "li.product", fields: {} } } }), eventType: WEB_AUTOMATION_EVENTS.dataExtractionDefined },
  { row: "20c data.extract, a field key Core would refuse", event: recorded("data.extract", { extraction: { ...listExtraction, request: { item: "li.product", fields: { "Product name": { kind: "text" } } } } }), eventType: WEB_AUTOMATION_EVENTS.dataExtractionDefined },
  { row: "20d data.extract, no definition at all", event: recorded("data.extract"), eventType: WEB_AUTOMATION_EVENTS.dataExtractionDefined },
  // A value read needs a target: the verb reads one element.
  { row: "20e data.extract, a single value with no element", event: recorded("data.extract", { extraction: valueExtraction }), eventType: WEB_AUTOMATION_EVENTS.dataExtractionDefined }
);
var outputNodes = listWebAutomationOutputNodeDefinitions();
for (const { row, event, eventType, inputId, outputId } of rows) {
  assert.equal(webAutomationEventTypeForClientKind(event.kind), eventType, `row ${row}: domain event type`);
  assert.equal(webAutomationInputIdForRecordedEvent(event), inputId, `row ${row}: live input`);
  const action = webAutomationRecordedAction(eventType, event, event.metadata);
  assert.equal(action?.inputId, inputId, `row ${row}: mapped input`);
  assert.equal(action?.outputId, outputId, `row ${row}: registered output`);
  if (inputId === void 0 || outputId === void 0) continue;
  assert.equal(actionInputDefinitions.find(([id]) => id === inputId)?.[2], outputId, `row ${row}: input definition names the output`);
  const node = outputNodes.find((definition) => definition.outputAction?.fixedOutputId === outputId);
  assert.equal(node?.id, webAutomationOutputNodeId(outputId), `row ${row}: output node`);
  assert.deepEqual(action?.parameters, webAutomationOutputPayload(outputId, event), `row ${row}: parameters equal the live output binding payload`);
}
assert.equal(webAutomationOutputNodeId("web.dom.scroll"), "web.output.dom-scroll");
assert.deepEqual(webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.scrollChanged, { scroll: { x: 0, y: 640 } })?.parameters, { x: 0, y: 640 });
assert.equal(webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.mouseWheel, { scroll: { x: 0, y: 640 } }), void 0);
var click = webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.elementClicked, { element: button, visualTarget });
assert.equal(click?.parameters.selector, "#save");
assert.deepEqual(click?.parameters.element, { selector: "#save", xpath: "/html/body/form/button", id: "save", tagName: "button", text: "Save", role: "button" });
assert.deepEqual(click?.parameters.visualTarget, visualTarget);
assert.equal(webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.elementInputChanged, { element: field, inputValue: "ada" })?.parameters.text, "ada");
assert.equal(webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.elementChanged, { element: planSelect, inputValue: "team" })?.parameters.value, "team");
assert.equal(webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.keyboardPressed, { element: field, key: "Enter" })?.parameters.key, "Enter");
assert.deepEqual(webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.pageNavigated, { url: "https://example.test/next" }, { transition: "typed" })?.parameters, { url: "https://example.test/next" });
assert.equal(webAutomationInputIdForRecordedEvent(recorded("browser.navigation")), void 0);
assert.equal(webAutomationInputIdForRecordedEvent(recorded("browser.navigation", { metadata: { reason: "recording_start" } })), void 0);
assert.equal(webAutomationInputIdForRecordedEvent(recorded("browser.navigation", { metadata: { reason: "recording_start", transition: "typed" } })), void 0);
assert.equal(webAutomationInputIdForRecordedEvent(recorded("browser.navigation", { url: "", metadata: { transition: "typed" } })), void 0, "navigation needs a URL");
assert.equal(webAutomationInputIdForRecordedEvent(recorded("dom.click")), void 0, "click needs a target selector");
assert.equal(webAutomationInputIdForRecordedEvent(recorded("dom.input", { inputValue: "ada" })), void 0, "text entry needs a target selector");
assert.equal(webAutomationInputIdForRecordedEvent(recorded("dom.change", { element: { tagName: "select" }, inputValue: "team" })), void 0, "select needs a target selector");
assert.equal(webAutomationInputIdForRecordedEvent(recorded("dom.keydown", { element: field })), void 0, "key press needs a key");
assert.equal(webAutomationInputIdForRecordedEvent(recorded("dom.keydown", { key: "Escape" })), WEB_AUTOMATION_INPUT_IDS.keyPressed, "a key press may target the focused element");
assert.equal(webAutomationInputIdForRecordedEvent(recorded("dom.scroll")), void 0, "scroll needs a coordinate");
assert.equal(webAutomationInputIdForRecordedEvent(recorded("dom.scroll", { scroll: { y: 0 } })), WEB_AUTOMATION_INPUT_IDS.pageScrolled, "scrolling back to the top is a coordinate");
var inputOutputs = actionInputDefinitions.map(([, , outputId]) => outputId);
var recordableOutputs = [...new Set(inputOutputs)];
var dispatchOnlyOutputs = [
  "web.dom.wait_for_selector",
  "web.dom.wait_for_text",
  "web.dom.capture_snapshot",
  // Added in Week 1 (decision D6). `web.dom.check` is recordable, from a
  // checkbox or radio change; `web.dom.upload` from a file choice; and
  // `web.browser.tab` from a tab switch or close. The rest are authored or
  // driven by a Flow and no recorded user event produces one.
  //
  // X4 made `web.dom.extract_list` recordable: the picker records a list
  // definition. `web.dom.extract` stayed dispatch-only -- the picker cannot
  // define a single value, so no recorded event produces one, and no input is
  // registered for it.
  "web.dom.assert",
  "web.dom.dialog",
  "web.browser.download",
  "web.dom.extract"
];
assert.deepEqual(inputOutputs.filter((outputId, index) => inputOutputs.indexOf(outputId) !== index), ["web.browser.tab"], "only the tab operations share an output");
assert.deepEqual([...recordableOutputs, ...dispatchOnlyOutputs].sort(), [...WEB_AUTOMATION_ACTION_TYPES].sort(), "every output is recordable or dispatch-only");
assert.equal(webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.tabStateChanged, { url: "https://example.test/start", title: "Start", sequence: 1, recordingState: "started" }), void 0);
assert.equal(webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.tabStateChanged, { url: "https://example.test/start", recordingState: "started" }, { recordingState: "started", clientKind: "browser.tab" }), void 0);
assert.deepEqual(webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.tabStateChanged, { url: "http://127.0.0.1:4173/details?session=tok", tab: { operation: "switch", urlPath: "/details" } })?.parameters, { tab: { operation: "switch", urlPath: "/details" } });
var chosen = webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.elementChanged, { element: { ...fileInput, value: "C:\\fakepath\\tax-return-2025.pdf" }, inputValue: "C:\\fakepath\\tax-return-2025.pdf" });
assert.deepEqual(chosen?.parameters.upload, { $state: { path: "web.upload.attachment" } });
assert.equal(JSON.stringify(chosen?.parameters).includes("tax-return"), false, "the recorded file name is nowhere in the node");
for (const outputId of dispatchOnlyOutputs) {
  assert.equal(recordableOutputs.includes(outputId), false, `${outputId} is dispatch-only`);
}
var passwordField = { selector: "#password", tagName: "input", inputType: "password", testId: "password", attributes: { type: "password", "data-testid": "password" } };
var withheld = webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.elementInputChanged, { element: passwordField });
assert.equal(withheld?.inputId, WEB_AUTOMATION_INPUT_IDS.textEntered, "a withheld value is still a text entry, not evidence");
assert.equal(withheld?.outputId, "web.dom.type");
assert.deepEqual(withheld?.parameters.text, { $state: { path: "web.secret.password" } }, "the node carries the request, and no value");
assert.equal(webAutomationInputIdForRecordedEvent(recorded("dom.input", { element: passwordField })), WEB_AUTOMATION_INPUT_IDS.textEntered, "the live gateway path agrees with the mapper");
assert.equal(webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.elementInputChanged, { element: field }), void 0, "an empty literal is still not executable");
var recordedList = webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.dataExtractionDefined, recorded("data.extract", { extraction: { ...listExtraction, samples: [{ name: "SENTINEL-PAGE-VALUE" }] } }));
assert.equal(recordedList?.outputId, "web.dom.extract_list");
assert.deepEqual(recordedList?.parameters.extractList, listExtraction.request, "the node carries the request it was recorded with");
assert.equal(JSON.stringify(recordedList?.parameters).includes("SENTINEL-PAGE-VALUE"), false, "no sample value reaches the node");
assert.deepEqual(webAutomationRecordedExtraction({ ...valueExtraction }), { form: "value", label: "Order total", read: { mode: "text" } }, "the domain still reads a value definition");
assert.equal(webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.dataExtractionDefined, recorded("data.extract", { element: heading, extraction: valueExtraction })), void 0, "and it resolves to no input");
assert.equal(Object.values(WEB_AUTOMATION_INPUT_IDS).includes("web.user.value_extraction_defined"), false, "the input it had is not registered");
assert.equal(stateInputDefinitions.every((input) => input.role !== "action"), true);
var stateInputIds = stateInputDefinitions.map((input) => input.id);
for (const { event, eventType } of rows) {
  const inputId = webAutomationRecordedAction(eventType, event, event.metadata)?.inputId;
  assert.equal(inputId !== void 0 && stateInputIds.includes(inputId), false);
}
console.log("Web automation input model tests passed.");
