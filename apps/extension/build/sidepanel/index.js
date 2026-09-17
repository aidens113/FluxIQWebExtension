// src/shared/constants.ts
var DEFAULT_GATEWAY_URL = "ws://127.0.0.1:4777/client";
var DEFAULT_CORE_API_URL = "http://127.0.0.1:3000";
var RUNTIME_MESSAGES = {
  getStatus: "fluxiq.getStatus",
  connect: "fluxiq.connect",
  disconnect: "fluxiq.disconnect",
  resetSession: "fluxiq.resetSession",
  dismissRecordingLock: "fluxiq.dismissRecordingLock",
  getRecordingLog: "fluxiq.getRecordingLog",
  listRecordings: "fluxiq.listRecordings",
  startRecording: "fluxiq.startRecording",
  stopRecording: "fluxiq.stopRecording",
  contentReady: "fluxiq.contentReady",
  contentEvent: "fluxiq.contentEvent",
  executeAction: "fluxiq.executeAction",
  captureSnapshot: "fluxiq.captureSnapshot",
  statusChanged: "fluxiq.statusChanged",
  testArmScriptedNavigation: "fluxiq.test.armScriptedNavigation",
  testAwaitScriptedNavigation: "fluxiq.test.awaitScriptedNavigation",
  testCancelScriptedNavigation: "fluxiq.test.cancelScriptedNavigation"
};

// src/shared/browser.ts
function defaultSettings() {
  return {
    gatewayUrl: DEFAULT_GATEWAY_URL,
    coreApiUrl: DEFAULT_CORE_API_URL,
    autoReconnect: true,
    captureMutations: true,
    captureInputValues: true,
    captureSnapshots: true
  };
}
function runtimeSendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(response);
    });
  });
}

// src/shared/extraction-messages.ts
var EXTRACTION_RUNTIME_MESSAGES = {
  start: "fluxiq.extractionStart",
  confirm: "fluxiq.extractionConfirm",
  cancel: "fluxiq.extractionCancel",
  getSession: "fluxiq.getExtractionSession",
  testDefineExtraction: "fluxiq.test.defineExtraction"
};

// src/popup/extraction/client.ts
var NO_LISTENER = "FluxIQ's background worker did not answer. Reopen the panel and try again.";
async function startExtractionPick() {
  await command({ type: EXTRACTION_RUNTIME_MESSAGES.start });
}
async function confirmExtraction(request) {
  const response = await runtimeSendMessage({ type: EXTRACTION_RUNTIME_MESSAGES.confirm, request });
  if (!response) throw new Error(NO_LISTENER);
  if (!response.ok) throw new Error(response.error);
  return capturedOutcome(response);
}
function capturedOutcome(response) {
  const { datasetId, label, recordCount, pagesRead, truncated, durationMs: durationMs2 } = response;
  if (typeof datasetId !== "string" || typeof label !== "string") return void 0;
  if (typeof recordCount !== "number" || typeof pagesRead !== "number" || typeof durationMs2 !== "number") return void 0;
  return { datasetId, label, recordCount, pagesRead, truncated: truncated === true, durationMs: durationMs2 };
}
async function cancelExtraction() {
  await command({ type: EXTRACTION_RUNTIME_MESSAGES.cancel });
}
async function readExtractionSession(columns) {
  const message = { type: EXTRACTION_RUNTIME_MESSAGES.getSession, ...columns === void 0 ? {} : { fields: columns } };
  const response = await runtimeSendMessage(message);
  if (!response) throw new Error(NO_LISTENER);
  if (!response.ok) throw new Error(response.error);
  return response.session ?? void 0;
}
async function command(message) {
  const response = await runtimeSendMessage(message);
  if (!response) throw new Error(NO_LISTENER);
  if (!response.ok) throw new Error(response.error);
}

// ../../domain/src/constants.ts
var WEB_AUTOMATION_DOMAIN_ID = "web-automation";

// ../../domain/src/actions/extraction/field-key.ts
var FIELD_KEY_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
var RESERVED_FIELD_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
function isWebAutomationExtractFieldKey(key) {
  return typeof key === "string" && FIELD_KEY_PATTERN.test(key) && !RESERVED_FIELD_KEYS.has(key);
}

// ../../domain/src/output-nodes/targets/targets.ts
function elementFingerprint(value) {
  const element3 = objectValue(value);
  if (!element3) return void 0;
  const attributes = elementAttributes(element3.attributes);
  return compact({
    selector: stringValue(element3.selector),
    xpath: stringValue(element3.xpath),
    id: stringValue(element3.id),
    classNames: Array.isArray(element3.classNames) ? element3.classNames.filter((item) => typeof item === "string") : void 0,
    visibleText: stringValue(element3.visibleText),
    tagName: stringValue(element3.tagName),
    text: stringValue(element3.text),
    value: stringValue(element3.value),
    role: stringValue(element3.role),
    implicitRole: stringValue(element3.implicitRole),
    name: stringValue(element3.name),
    href: stringValue(element3.href),
    inputType: stringValue(element3.inputType),
    checked: booleanValue(element3.checked),
    testId: elementTestId(element3, attributes),
    accessibleName: stringValue(element3.accessibleName) ?? stringValue(attributes?.["aria-label"]),
    label: stringValue(element3.label),
    attributes,
    context: elementContext(element3.context),
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
function elementTestId(element3, attributes) {
  return stringValue(element3.testId) ?? stringValue(attributes?.["data-testid"]) ?? stringValue(attributes?.["data-test"]) ?? stringValue(attributes?.["data-cy"]);
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

// ../../domain/src/actions/extraction/request.ts
var WEB_AUTOMATION_EXTRACT_PAGINATION_MODES = ["next", "loadMore", "scroll", "numbered"];
var WEB_AUTOMATION_EXTRACT_FIELD_KINDS = ["text", "attribute", "link", "value", "column"];
var WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS = ["include", "exclude", "encrypt"];
var WEB_AUTOMATION_EXTRACT_READ_MODES = ["text", "attribute", "value", "html"];
var WEB_AUTOMATION_EXTRACT_MAX_PAGES = 50;
var WEB_AUTOMATION_EXTRACT_MAX_ITEMS = 1e3;
var WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS = 1e4;

// ../../domain/src/actions/extraction/read-request.ts
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
  const element3 = optionalValue(spec.element, fingerprintValue);
  if (selector === REFUSED || required === REFUSED || handling === REFUSED || element3 === REFUSED) return void 0;
  const field = {
    kind,
    ...selector !== void 0 ? { selector } : {},
    ...attribute !== void 0 ? { attribute } : {},
    ...header !== void 0 ? { header } : {},
    ...required !== void 0 ? { required } : {},
    ...handling !== void 0 ? { handling } : {},
    ...element3 !== void 0 ? { element: element3 } : {}
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

// ../../domain/src/actions/extraction/schema.ts
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

// ../../domain/src/actions/types.ts
var WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH = 1024;
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
var WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER = {
  "web.browser.navigate": "browser.navigate",
  "web.dom.click": "dom.click",
  "web.dom.type": "dom.type",
  "web.dom.clear": "dom.clear",
  "web.dom.select": "dom.select",
  "web.dom.scroll": "dom.scroll",
  "web.dom.keypress": "dom.keypress",
  "web.dom.wait_for_selector": "dom.wait_for_selector",
  "web.dom.wait_for_text": "dom.wait_for_text",
  "web.dom.extract": "dom.extract",
  "web.dom.capture_snapshot": "dom.capture_snapshot",
  "web.dom.check": "dom.check",
  "web.dom.assert": "dom.assert",
  "web.dom.extract_list": "dom.extract_list",
  "web.dom.upload": "dom.upload",
  "web.dom.dialog": "dom.dialog",
  "web.browser.tab": "browser.tab",
  "web.browser.download": "browser.download"
};

// ../../domain/src/actions/schemas.ts
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

// ../../domain/src/actions/safety.ts
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

// ../../domain/src/output-nodes/extract-list/catalog-text.ts
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

// ../../domain/src/extraction/dataset-id.ts
var COMBINING_MARKS = new RegExp("\\p{M}+", "gu");

// ../../domain/src/extraction/label-key.ts
var MAX_KEY_LENGTH = 100;
var FALLBACK_KEY = "field";
var RESERVED_KEY_SUFFIX = "_field";
var OUTSIDE_KEY_CHARACTERS = /[^a-z0-9_-]+/u;
var COMBINING_MARKS2 = new RegExp("\\p{M}+", "gu");
function webAutomationExtractionFieldKey(label, taken) {
  const words = label.toLowerCase().normalize("NFKD").replace(COMBINING_MARKS2, "").split(OUTSIDE_KEY_CHARACTERS).filter((word) => word.length > 0);
  let key = words.join("_").slice(0, MAX_KEY_LENGTH) || FALLBACK_KEY;
  if (!isWebAutomationExtractFieldKey(key)) key = `${key}${RESERVED_KEY_SUFFIX}`;
  if (!taken.has(key)) return key;
  for (let ordinal = 2; ; ordinal += 1) {
    const suffix = `_${ordinal}`;
    const candidate = `${key.slice(0, MAX_KEY_LENGTH - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// ../../domain/src/output-nodes/extract-list/records-path.ts
var WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH = "result.extracted";

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/definitions.js
function adaptBuiltinAutomationNodeDefinition(definition) {
  return {
    schemaVersion: "0.1",
    id: definition.id,
    version: "1.0.0",
    label: definition.label,
    description: definition.description,
    category: definition.class === "routine" ? "flow" : definition.class,
    source: { kind: "builtin", implementationKey: definition.implementationKey },
    availability: { kind: "both" },
    capabilities: builtinCapabilities(definition),
    ...definition.privileged ? { safety: { privileged: true } } : {},
    inputs: definition.inputs,
    outputs: definition.outputs,
    parameters: definition.parameters,
    ...definition.icon !== void 0 ? { icon: definition.icon } : {},
    ...definition.tags !== void 0 ? { tags: definition.tags } : {},
    legacyScope: definition.scope
  };
}
function builtinCapabilities(definition) {
  return {
    executable: true,
    ...definition.class === "policy" ? { stateAware: true, recoverable: true } : {},
    ...definition.class === "timing" ? { asynchronous: true, retryable: true } : {},
    ...definition.class === "routine" ? { composite: true } : {}
  };
}

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/shared/definition.js
function defineBuiltinNode(definition) {
  const normalized = normalizeVisualPorts(definition);
  return {
    ...normalized,
    origin: "builtin",
    implementationKey: definition.implementationKey ?? definition.id
  };
}
function normalizeVisualPorts(definition) {
  const inputs = normalizeVisualInputs(definition);
  const outputs = normalizeVisualOutputs(definition);
  return { ...definition, inputs, outputs };
}
function normalizeVisualInputs(definition) {
  const inputs = definition.inputs.map((port) => normalizePortRole(port, "target"));
  if (definition.id === "builtin.control.start")
    return inputs;
  if (inputs.some((port) => port.id === "in" || port.role === "control"))
    return inputs;
  return [controlInput(), ...inputs];
}
function normalizeVisualOutputs(definition) {
  if (definition.id === "builtin.control.end")
    return definition.outputs.map((port) => normalizePortRole(port, "source"));
  const outputs = definition.outputs.map((port) => normalizePortRole(port, "source"));
  if (outputs.some((port) => port.role === "branch"))
    return outputs;
  if (!outputs.some((port) => port.id === "success" || port.role === "success"))
    outputs.unshift(successOutput());
  if (!outputs.some((port) => port.id === "failed" || port.role === "failure")) {
    const insertAt = outputs.some((port) => port.id === "success") ? 1 : outputs.length;
    outputs.splice(insertAt, 0, failedOutput());
  }
  return outputs;
}
function normalizePortRole(port, direction) {
  if (port.role)
    return port;
  if (port.id === "in")
    return { ...port, role: "control" };
  if (port.id === "success")
    return { ...port, role: "success" };
  if (port.id === "failed" || port.id === "failure")
    return { ...port, role: "failure" };
  if (port.id === "error")
    return { ...port, role: "error" };
  if (direction === "source" && ["true", "false", "body", "done", "case", "default", "approved", "rejected", "timeout", "recovered"].includes(port.id))
    return { ...port, role: "branch" };
  if (direction === "source")
    return { ...port, role: "data" };
  return port;
}
function emptyResult(outputs = {}) {
  return { status: "success", route: "success", outputs };
}
function controlInput(label = "In") {
  return { id: "in", label, valueType: "any", role: "control" };
}
function successOutput(label = "Success") {
  return { id: "success", label, valueType: "any", role: "success" };
}
function failedOutput(label = "Failed") {
  return { id: "failed", label, valueType: "any", role: "failure" };
}
function inputValue(context, id) {
  return context.inputs[id] ?? context.parameters[id];
}
function numberValue2(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
function booleanValue3(value) {
  if (typeof value === "boolean")
    return value;
  if (typeof value === "number")
    return value !== 0;
  if (typeof value === "string")
    return ["true", "yes", "1", "on"].includes(value.trim().toLowerCase());
  return Boolean(value);
}
function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}
function stringValue2(value, fallback = "") {
  if (value === void 0 || value === null)
    return fallback;
  return String(value);
}
function objectValue2(value) {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value;
  return {};
}
function getPathValue(source, path) {
  const parts = stringValue2(path).split(".").map((part) => part.trim()).filter(Boolean);
  let current = source;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current)
      current = current[part];
    else
      return void 0;
  }
  return current;
}
function compareBasic(left, right, operator) {
  switch (stringValue2(operator, "equals")) {
    case "not-equals":
      return left !== right;
    case "greater-than":
      return numberValue2(left) > numberValue2(right);
    case "greater-than-or-equal":
      return numberValue2(left) >= numberValue2(right);
    case "less-than":
      return numberValue2(left) < numberValue2(right);
    case "less-than-or-equal":
      return numberValue2(left) <= numberValue2(right);
    case "contains":
      return String(left ?? "").includes(String(right ?? ""));
    case "starts-with":
      return String(left ?? "").startsWith(String(right ?? ""));
    case "ends-with":
      return String(left ?? "").endsWith(String(right ?? ""));
    case "exists":
      return left !== void 0 && left !== null && left !== "";
    case "equals":
    default:
      return left === right;
  }
}

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/control-flow/shared.js
function routeFromCondition(context, trueRoute = "true", falseRoute = "false") {
  return booleanValue3(context.inputs.condition ?? context.parameters.condition) ? trueRoute : falseRoute;
}
function maxIterations(context) {
  return Math.max(0, Math.floor(numberValue2(context.parameters.maxIterations, 25)));
}

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/control-flow/branch.js
var branchNode = defineBuiltinNode({
  id: "builtin.control.branch",
  label: "Branch",
  description: "Choose one of two paths from a yes/no condition.",
  class: "control-flow",
  scope: "both",
  inputs: [{ id: "condition", label: "Condition", valueType: "boolean", required: true }],
  outputs: [
    { id: "true", label: "True", valueType: "any" },
    { id: "false", label: "False", valueType: "any" }
  ],
  parameters: [
    { id: "invert", label: "Swap Yes and No paths", description: "When enabled, true goes to No and false goes to Yes.", valueType: "boolean", defaultValue: false }
  ],
  icon: "git-branch",
  execute: (context) => {
    const route = routeFromCondition(context, "true", "false");
    const finalRoute = context.parameters.invert === true ? route === "true" ? "false" : "true" : route;
    return { status: "success", route: String(finalRoute), outputs: {} };
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/control-flow/end.js
var endNode = defineBuiltinNode({
  id: "builtin.control.end",
  label: "End",
  description: "Terminal point for a policy or routine graph.",
  class: "control-flow",
  scope: "both",
  inputs: [{ id: "in", label: "In", valueType: "any" }],
  outputs: [],
  parameters: [
    {
      id: "resultStatus",
      label: "Final result",
      description: "How this policy or routine should be marked when execution reaches this End node.",
      valueType: "string",
      defaultValue: "success",
      options: [
        { label: "Success", value: "success" },
        { label: "Failed", value: "failed" },
        { label: "Skipped", value: "skipped" }
      ]
    },
    { id: "message", label: "End note", description: "Optional text saved with the final result.", valueType: "string", defaultValue: "", ui: { control: "textarea", placeholder: "Optional note for this ending" } }
  ],
  icon: "circle-stop",
  execute: (context) => ({ status: context.parameters.resultStatus === "failed" ? "failed" : context.parameters.resultStatus === "skipped" ? "skipped" : "success", route: "end", outputs: { message: context.parameters.message ?? "" } })
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/control-flow/for-each.js
var DEFAULT_MAX_ITERATIONS = 100;
var MAX_ITERATIONS_CEILING = 1e4;
var forEachNode = defineBuiltinNode({
  id: "builtin.control.for-each",
  label: "For Each",
  description: "Run a section once for every item in a list.",
  class: "control-flow",
  scope: "both",
  inputs: [{ id: "items", label: "Items", valueType: "array", required: true }],
  outputs: [
    { id: "body", label: "Each item", valueType: "any" },
    { id: "done", label: "Done", valueType: "any" },
    { id: "item", label: "Item", valueType: "any" },
    { id: "index", label: "Index", valueType: "number" },
    { id: "count", label: "Count", valueType: "number" }
  ],
  parameters: [
    {
      id: "maxIterations",
      label: "Maximum items",
      description: "Safety limit: a list with more items than this fails instead of running. At most 10,000.",
      valueType: "number",
      defaultValue: DEFAULT_MAX_ITERATIONS,
      constraints: { minimum: 1, maximum: MAX_ITERATIONS_CEILING, integer: true }
    },
    {
      id: "maxStepsPerIteration",
      label: "Steps per item",
      description: "How many more steps the run may take for each item. A whole run stops at 100,000 steps.",
      valueType: "number",
      defaultValue: 50,
      // The executor reads the authored value to grant the steps, before any binding could be resolved.
      allowStateBinding: false,
      constraints: { minimum: 1, integer: true }
    }
  ],
  icon: "repeat",
  execute: (context) => forEachPass(context)
});
function forEachPass(context) {
  const { iteration } = context;
  if (!iteration)
    return failedPass("for_each.iteration_unavailable", "blocked_by_capability_or_policy", "For Each runs only inside a Flow run, which keeps its place in the list.");
  let state = iteration.get();
  if (!state) {
    const items = context.inputs.items;
    if (!Array.isArray(items))
      return failedPass("for_each.items_invalid", "graph_validation_or_unknown_node", "For Each needs a list in Items.");
    const limit = maxIterations2(context);
    if (items.length > limit)
      return failedPass("for_each.max_iterations_exceeded", "blocked_by_capability_or_policy", `For Each was given ${items.length} items, more than its limit of ${limit}.`);
    state = { items, index: 0 };
  }
  const count2 = state.items.length;
  if (state.index < count2) {
    const index = state.index;
    iteration.set({ items: state.items, index: index + 1 });
    return { status: "success", route: "body", outputs: { item: state.items[index] ?? null, index, count: count2 } };
  }
  iteration.set();
  return { status: "success", route: "done", outputs: { count: count2 } };
}
function maxIterations2(context) {
  const authored = Math.floor(numberValue2(context.parameters.maxIterations, DEFAULT_MAX_ITERATIONS));
  return Math.min(MAX_ITERATIONS_CEILING, Math.max(1, authored));
}
function failedPass(code, category, message) {
  return { status: "failed", route: "failed", outputs: {}, message, failure: { category, code, retryable: false } };
}

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/control-flow/loop.js
var loopNode = defineBuiltinNode({
  id: "builtin.control.loop",
  label: "Loop",
  description: "Repeat a section while a condition is still true.",
  class: "control-flow",
  scope: "routine",
  inputs: [{ id: "condition", label: "Condition", valueType: "boolean", required: true }],
  outputs: [
    { id: "body", label: "Repeat", valueType: "any" },
    { id: "done", label: "Done", valueType: "any" }
  ],
  parameters: [
    { id: "maxIterations", label: "Maximum repeats", description: "Safety limit for how many times this loop may run.", valueType: "number", defaultValue: 25 },
    { id: "startIndex", label: "Starting count", description: "The first count value exposed to the loop body.", valueType: "number", defaultValue: 0 },
    { id: "increment", label: "Count by", description: "How much the loop count changes after each repeat.", valueType: "number", defaultValue: 1 }
  ],
  icon: "repeat",
  execute: (context) => ({ status: "success", route: routeFromCondition(context, "body", "done"), outputs: { maxIterations: maxIterations(context), startIndex: context.parameters.startIndex ?? 0, increment: context.parameters.increment ?? 1 } })
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/control-flow/merge.js
var mergeNode = defineBuiltinNode({
  id: "builtin.control.merge",
  label: "Merge",
  description: "Join several branches back into one path.",
  class: "control-flow",
  scope: "routine",
  inputs: [{ id: "branches", label: "Branches", valueType: "any", multiple: true }],
  outputs: [{ id: "next", label: "Next", valueType: "any" }],
  parameters: [
    {
      id: "mergeMode",
      label: "When to continue",
      description: "Choose whether this node continues after the first branch finishes, after all branches finish, or only with successful branch results.",
      valueType: "string",
      defaultValue: "first",
      options: [
        { label: "As soon as one branch finishes", value: "first" },
        { label: "After every branch finishes", value: "all" },
        { label: "After successful branches only", value: "successful" }
      ]
    }
  ],
  icon: "merge",
  execute: (context) => emptyResult({ next: context.inputs.branches ?? null, mergeMode: context.parameters.mergeMode ?? "first" })
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/control-flow/parallel.js
var parallelNode = defineBuiltinNode({
  id: "builtin.control.parallel",
  label: "Parallel",
  description: "Start multiple branches at the same time.",
  class: "control-flow",
  scope: "routine",
  inputs: [{ id: "in", label: "In", valueType: "any" }],
  outputs: [{ id: "branches", label: "Branches", valueType: "any", multiple: true }],
  parameters: [
    { id: "branchCount", label: "Number of branches", description: "How many parallel paths this node should create.", valueType: "number", defaultValue: 2 },
    {
      id: "failureMode",
      label: "If one branch fails",
      description: "Choose whether the routine stops immediately or waits to collect every branch result.",
      valueType: "string",
      defaultValue: "fail-fast",
      options: [
        { label: "Stop the others", value: "fail-fast" },
        { label: "Wait for all results", value: "collect-all" }
      ]
    }
  ],
  icon: "workflow",
  execute: (context) => emptyResult({ branches: context.inputs.in ?? null, branchCount: context.parameters.branchCount ?? 2, failureMode: context.parameters.failureMode ?? "fail-fast" })
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/control-flow/start.js
var startNode = defineBuiltinNode({
  id: "builtin.control.start",
  label: "Start",
  description: "Entry point for a policy or routine graph.",
  class: "control-flow",
  scope: "both",
  inputs: [],
  outputs: [{ id: "next", label: "Next", valueType: "any" }],
  parameters: [
    { id: "label", label: "Start label", description: "Friendly name shown for this run entry.", valueType: "string", defaultValue: "Start", ui: { control: "text", placeholder: "Start label" } },
    { id: "emitTimestamp", label: "Include start time", description: "Attach the current time to the value sent from this node.", valueType: "boolean", defaultValue: true }
  ],
  icon: "play",
  execute: (context) => emptyResult({ next: true, label: context.parameters.label ?? "Start", startedAt: context.parameters.emitTimestamp === false ? null : context.now?.() ?? Date.now() })
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/control-flow/switch.js
var switchNode = defineBuiltinNode({
  id: "builtin.control.switch",
  label: "Switch",
  description: "Choose a path by matching one value against a list of cases.",
  class: "control-flow",
  scope: "both",
  inputs: [{ id: "value", label: "Value", valueType: "any", required: true }],
  outputs: [
    { id: "case", label: "Cases", valueType: "any", multiple: true },
    { id: "default", label: "Default", valueType: "any" },
    { id: "value", label: "Matched value", valueType: "any" }
  ],
  parameters: [
    { id: "cases", label: "Case list", description: "Values to match. Each item can include a value and optional route name.", valueType: "array", defaultValue: [] },
    { id: "caseSensitive", label: "Match capitalization exactly", description: "When disabled, text like Ready and ready are treated the same.", valueType: "boolean", defaultValue: true },
    {
      id: "matchMode",
      label: "How to match",
      description: "Equals requires an exact match. Contains matches when the input text includes the case text.",
      valueType: "string",
      defaultValue: "equals",
      options: [
        { label: "Equals", value: "equals" },
        { label: "Contains", value: "contains" }
      ]
    }
  ],
  icon: "split",
  execute: (context) => {
    const cases = Array.isArray(context.parameters.cases) ? context.parameters.cases : [];
    const value = context.parameters.caseSensitive === false ? String(context.inputs.value ?? "").toLowerCase() : context.inputs.value;
    const match = cases.find((item) => {
      if (!(typeof item === "object" && item !== null && "value" in item))
        return false;
      const candidate = context.parameters.caseSensitive === false ? String(item.value ?? "").toLowerCase() : item.value;
      return context.parameters.matchMode === "contains" ? String(value ?? "").includes(String(candidate ?? "")) : candidate === value;
    });
    return { status: "success", route: match ? "case" : "default", outputs: { value: context.inputs.value ?? null, matched: match ?? null } };
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/control-flow/index.js
var controlFlowNodes = [startNode, endNode, branchNode, switchNode, parallelNode, mergeNode, loopNode, forEachNode];

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/data/constant.js
var constantNode = defineBuiltinNode({
  id: "builtin.data.constant",
  label: "Constant",
  description: "Provide a fixed value to the graph.",
  class: "data",
  scope: "both",
  inputs: [],
  outputs: [{ id: "value", label: "Value", valueType: "any" }],
  parameters: [
    { id: "value", label: "Value to send", description: "The fixed value this node outputs every time it runs.", valueType: "any", defaultValue: null, ui: { control: "value" } },
    {
      id: "valueLabel",
      label: "Display name",
      description: "Friendly label shown on the node for this constant.",
      valueType: "string",
      defaultValue: "Constant",
      ui: { control: "text", placeholder: "Display name" }
    }
  ],
  icon: "braces",
  execute: (context) => emptyResult({ value: context.parameters.value ?? null })
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/data/filter-list.js
var filterListNode = defineBuiltinNode({
  id: "builtin.data.filter-list",
  label: "Filter List",
  description: "Keep only list items that match a simple rule.",
  class: "data",
  scope: "both",
  inputs: [{ id: "items", label: "Items", valueType: "array", required: true }],
  outputs: [{ id: "items", label: "Items", valueType: "array" }],
  parameters: [
    { id: "path", label: "Field to check", description: "Optional field inside each item, such as status or user.name. Leave blank to check the whole item.", valueType: "string", defaultValue: "", ui: { control: "path", placeholder: "field.path" } },
    {
      id: "operator",
      label: "Match rule",
      description: "How each item is compared with the value below.",
      valueType: "string",
      defaultValue: "exists",
      options: [
        { label: "Field exists", value: "exists" },
        { label: "Equals", value: "equals" },
        { label: "Does not equal", value: "not-equals" },
        { label: "Greater than", value: "greater-than" },
        { label: "Less than", value: "less-than" },
        { label: "Contains", value: "contains" }
      ]
    },
    { id: "value", label: "Value to compare", description: "The value each item is checked against.", valueType: "any", defaultValue: null, ui: { control: "value" } },
    {
      id: "onInvalid",
      label: "If the field is missing",
      description: "Choose whether items with no matching field should stay in the list.",
      valueType: "string",
      defaultValue: "exclude",
      options: [
        { label: "Remove item", value: "exclude" },
        { label: "Keep item", value: "include" }
      ]
    }
  ],
  icon: "list-filter",
  execute: (context) => {
    const items = arrayValue(context.inputs.items);
    const path = context.parameters.path;
    const filtered = items.filter((item) => {
      const left = path ? getPathValue(item, path) : item;
      const result = compareBasic(left, context.parameters.value, context.parameters.operator);
      return result || left === void 0 && context.parameters.onInvalid === "include";
    });
    return emptyResult({ items: filtered });
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/data/shared.js
function variableName(value) {
  return String(value ?? "").trim();
}
function readVariable(variables, name) {
  return variables?.get(name) ?? null;
}
function writeVariable(variables, name, value) {
  variables?.set(name, value);
}
function keptJsonValue(value) {
  if (value === void 0)
    return null;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return value;
  if (Array.isArray(value)) {
    let changed = false;
    const items = value.map((item) => {
      const kept = keptJsonValue(item);
      if (kept !== item)
        changed = true;
      return kept;
    });
    return changed ? items : value;
  }
  if (typeof value === "object") {
    let changed = false;
    const record = {};
    for (const [key, item] of Object.entries(value)) {
      const kept = keptJsonValue(item);
      if (kept !== item)
        changed = true;
      record[key] = kept;
    }
    return changed ? record : value;
  }
  return String(value);
}
function setKeptPathValue(source, path, value) {
  const parts = String(path ?? "").split(".").map((part) => part.trim()).filter(Boolean);
  if (!parts.length)
    return source;
  const next = { ...source };
  let cursor = next;
  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part];
    const child2 = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {};
    cursor[part] = child2;
    cursor = child2;
  }
  cursor[parts[parts.length - 1]] = keptJsonValue(value);
  return next;
}

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/data/get-variable.js
var getVariableNode = defineBuiltinNode({
  id: "builtin.data.get-variable",
  label: "Get Variable",
  description: "Read a named runtime variable.",
  class: "data",
  scope: "both",
  inputs: [],
  outputs: [{ id: "value", label: "Value", valueType: "any" }],
  parameters: [
    { id: "name", label: "Variable name", description: "The saved workflow value to read.", valueType: "string", required: true, ui: { control: "reference", referenceType: "variable", placeholder: "variableName" } },
    { id: "defaultValue", label: "If variable is missing", description: "Value to use when the variable has not been set yet.", valueType: "any", defaultValue: null, ui: { control: "value" } },
    { id: "required", label: "Fail when missing", description: "When enabled, a missing variable sends execution to the failed path.", valueType: "boolean", defaultValue: false }
  ],
  icon: "database",
  execute: (context) => {
    const name = variableName(context.parameters.name);
    const value = readVariable(context.variables, name);
    if (value === null && context.parameters.required === true)
      return { status: "failed", route: "failed", outputs: { value: context.parameters.defaultValue ?? null } };
    return emptyResult({ value: value ?? context.parameters.defaultValue ?? null });
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/data/map-object.js
var mapObjectNode = defineBuiltinNode({
  id: "builtin.data.map-object",
  label: "Map Object",
  description: "Create or reshape fields on an object.",
  class: "data",
  scope: "both",
  inputs: [{ id: "object", label: "Object", valueType: "object", required: true }],
  outputs: [{ id: "object", label: "Object", valueType: "object" }],
  parameters: [
    { id: "mapping", label: "Field changes", description: "Fields to add, pick, or rename depending on the selected mode.", valueType: "object", defaultValue: {} },
    {
      id: "mode",
      label: "How to change the object",
      description: "Choose whether to add fields, keep selected fields, or copy values into new field paths.",
      valueType: "string",
      defaultValue: "merge",
      options: [
        { label: "Add or replace fields", value: "merge" },
        { label: "Keep only selected fields", value: "pick" },
        { label: "Copy fields to new names", value: "rename" }
      ]
    }
  ],
  icon: "file-json",
  execute: (context) => {
    const source = objectValue2(context.inputs.object);
    const mapping = objectValue2(context.parameters.mapping);
    if (context.parameters.mode === "pick") {
      return emptyResult({ object: Object.fromEntries(Object.entries(mapping).map(([target, path]) => [target, getPathValue(source, path)])) });
    }
    if (context.parameters.mode === "rename") {
      let next = { ...source };
      for (const [target, path] of Object.entries(mapping))
        next = setKeptPathValue(next, target, getPathValue(source, path));
      return emptyResult({ object: next });
    }
    return emptyResult({ object: { ...source, ...mapping } });
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/data/set-variable.js
var setVariableNode = defineBuiltinNode({
  id: "builtin.data.set-variable",
  label: "Set Variable",
  description: "Write a named runtime variable.",
  class: "data",
  scope: "both",
  inputs: [{ id: "value", label: "Value", valueType: "any", required: true }],
  outputs: [{ id: "next", label: "Next", valueType: "any" }],
  parameters: [
    { id: "name", label: "Variable name", description: "The saved workflow value to create or update.", valueType: "string", required: true, ui: { control: "reference", referenceType: "variable", placeholder: "variableName" } },
    {
      id: "writeMode",
      label: "How to save the value",
      description: "Choose whether to replace the old value, merge object fields, or append to a list.",
      valueType: "string",
      defaultValue: "replace",
      options: [
        { label: "Replace existing value", value: "replace" },
        { label: "Merge into object", value: "merge-object" },
        { label: "Add to list", value: "append-list" }
      ]
    }
  ],
  icon: "save",
  execute: (context) => {
    const name = variableName(context.parameters.name);
    const current = context.variables?.get(name);
    const incoming = keptJsonValue(context.inputs.value);
    let value = incoming;
    if (context.parameters.writeMode === "merge-object")
      value = { ...typeof current === "object" && current && !Array.isArray(current) ? current : {}, ...typeof incoming === "object" && incoming && !Array.isArray(incoming) ? incoming : {} };
    if (context.parameters.writeMode === "append-list")
      value = [...Array.isArray(current) ? current : [], incoming];
    writeVariable(context.variables, name, value);
    return emptyResult({ next: value });
  }
});

// ../../../!FluxIQ/packages/contracts/src/record-sets/output.ts
var AUTOMATION_STUDIO_RECORD_WRITE_MODES = Object.freeze(["append", "replace"]);
var AUTOMATION_STUDIO_RECORD_OUTPUT_LIMITS = Object.freeze({
  /** Letters, digits, `.`, `_`, `:`, and `-`, 1-200 characters; `.` and `..` are refused. */
  datasetIdPattern: /^[A-Za-z0-9._:-]{1,200}$/u,
  labelMaxLength: 200,
  /** Dot-separated segments of letters, digits, `_`, and `-`. */
  recordsPathMaxLength: 200,
  recordsPathMaxSegments: 8,
  /** Rows kept from one capture when `maxRecords` is not set. */
  maxRecordsDefault: 1e3,
  /** The highest `maxRecords` a record output may set. */
  maxRecordsCeiling: 1e4,
  /** UTF-8 bytes of a row's JSON. A larger row is invalid. */
  rowMaxBytes: 64 * 1024,
  /** Nesting depth of a `json` cell. A deeper value is invalid. */
  jsonCellMaxDepth: 32,
  /** Rows stored per dataset per run; later rows are dropped and the dataset is marked truncated. */
  maxRowsPerDatasetPerRun: 1e5
});

// ../../../!FluxIQ/packages/contracts/src/record-sets/is-plain-record.ts
function isPlainRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

// ../../../!FluxIQ/packages/contracts/src/record-sets/schema.ts
var AUTOMATION_STUDIO_RECORD_VALUE_TYPES = Object.freeze(["string", "number", "boolean", "url", "datetime", "json"]);
var AUTOMATION_STUDIO_RECORD_FIELD_HANDLINGS = Object.freeze(["include", "exclude", "encrypt"]);
var AUTOMATION_STUDIO_RECORD_SCHEMA_LIMITS = Object.freeze({
  maxFields: 200,
  /** Letters, digits, `_`, and `-`, 1-100 characters. */
  fieldIdPattern: /^[A-Za-z0-9_-]{1,100}$/u,
  /** Ids that collide with object machinery when a row is read by key; refused. */
  reservedFieldIds: Object.freeze(["__proto__", "constructor", "prototype"]),
  labelMaxLength: 200
});

// ../../../!FluxIQ/packages/contracts/src/record-sets/parse-schema.ts
var SCHEMA_KEYS = /* @__PURE__ */ new Set(["schemaVersion", "fields", "primaryKey"]);
var FIELD_KEYS = /* @__PURE__ */ new Set(["id", "label", "valueType", "required", "handling"]);
var VALUE_TYPES = new Set(AUTOMATION_STUDIO_RECORD_VALUE_TYPES);
var HANDLINGS = new Set(AUTOMATION_STUDIO_RECORD_FIELD_HANDLINGS);
var RESERVED_FIELD_IDS = new Set(AUTOMATION_STUDIO_RECORD_SCHEMA_LIMITS.reservedFieldIds);
function parseAutomationStudioRecordSchema(value, options = {}) {
  const allowEncrypt = options.allowEncrypt ?? false;
  const issues = /* @__PURE__ */ new Set();
  let schema;
  try {
    schema = parseSchema(value, allowEncrypt, issues);
  } catch {
    issues.add("record_schema.invalid");
    schema = null;
  }
  if (schema === null || issues.size > 0) return { ok: false, issues: issues.size > 0 ? [...issues] : ["record_schema.invalid"] };
  return { ok: true, schema };
}
function parseSchema(value, allowEncrypt, issues) {
  if (!isPlainRecord(value)) {
    issues.add("record_schema.not_object");
    return null;
  }
  if (!Object.keys(value).every((key) => SCHEMA_KEYS.has(key))) issues.add("record_schema.unknown_key");
  if (value.schemaVersion !== "0.1") issues.add("record_schema.invalid_schema_version");
  const fields = parseFields(value.fields, allowEncrypt, issues);
  const primaryKey = value.primaryKey === void 0 ? void 0 : parsePrimaryKey(value.primaryKey, fields, issues);
  if (fields === null || primaryKey === null || issues.size > 0) return null;
  const schema = { schemaVersion: "0.1", fields };
  if (primaryKey !== void 0) schema.primaryKey = primaryKey;
  return schema;
}
function parseFields(value, allowEncrypt, issues) {
  if (!Array.isArray(value)) {
    issues.add("record_schema.invalid_fields");
    return null;
  }
  if (value.length === 0) {
    issues.add("record_schema.no_fields");
    return null;
  }
  if (value.length > AUTOMATION_STUDIO_RECORD_SCHEMA_LIMITS.maxFields) {
    issues.add("record_schema.too_many_fields");
    return null;
  }
  const ids = /* @__PURE__ */ new Set();
  const labels = /* @__PURE__ */ new Set();
  const fields = [];
  let valid = true;
  for (let index = 0; index < value.length; index += 1) {
    const field = parseField(value[index], allowEncrypt, issues);
    if (field === null) {
      valid = false;
      continue;
    }
    if (ids.has(field.id)) {
      issues.add("record_schema.duplicate_field_id");
      valid = false;
    }
    if (labels.has(field.label)) {
      issues.add("record_schema.duplicate_field_label");
      valid = false;
    }
    ids.add(field.id);
    labels.add(field.label);
    fields.push(field);
  }
  if (!valid) return null;
  if (fields.every((field) => field.handling === "exclude")) {
    issues.add("record_schema.no_stored_fields");
    return null;
  }
  return fields;
}
function parseField(value, allowEncrypt, issues) {
  if (!isPlainRecord(value)) {
    issues.add("record_schema.invalid_field");
    return null;
  }
  const found = [];
  if (!Object.keys(value).every((key) => FIELD_KEYS.has(key))) found.push("record_schema.unknown_field_key");
  const { id, label, valueType, required, handling } = value;
  if (typeof id !== "string" || !AUTOMATION_STUDIO_RECORD_SCHEMA_LIMITS.fieldIdPattern.test(id)) found.push("record_schema.invalid_field_id");
  else if (RESERVED_FIELD_IDS.has(id)) found.push("record_schema.reserved_field_id");
  if (!isLabel(label)) found.push("record_schema.invalid_field_label");
  if (!isValueType(valueType)) found.push("record_schema.invalid_value_type");
  if (required !== void 0 && typeof required !== "boolean") found.push("record_schema.invalid_required");
  if (handling !== void 0 && !isHandling(handling)) found.push("record_schema.invalid_handling");
  if (handling === "encrypt" && !allowEncrypt) found.push("record_schema.encrypt_unavailable");
  for (const issue of found) issues.add(issue);
  if (found.length > 0 || typeof id !== "string" || !isLabel(label) || !isValueType(valueType)) return null;
  const field = { id, label, valueType };
  if (typeof required === "boolean") field.required = required;
  if (isHandling(handling)) field.handling = handling;
  return field;
}
function parsePrimaryKey(value, fields, issues) {
  if (!Array.isArray(value) || value.length === 0 || value.length > AUTOMATION_STUDIO_RECORD_SCHEMA_LIMITS.maxFields || !value.every((item) => typeof item === "string")) {
    issues.add("record_schema.invalid_primary_key");
    return null;
  }
  if (fields === null) return null;
  const byId = new Map(fields.map((field) => [field.id, field]));
  const seen = /* @__PURE__ */ new Set();
  let valid = true;
  for (const id of value) {
    const field = byId.get(id);
    let issue = null;
    if (seen.has(id)) issue = "record_schema.primary_key_duplicate_field";
    else if (field === void 0) issue = "record_schema.primary_key_unknown_field";
    else if (field.handling === "exclude") issue = "record_schema.primary_key_excluded_field";
    else if (field.handling === "encrypt") issue = "record_schema.primary_key_encrypted_field";
    if (issue !== null) {
      issues.add(issue);
      valid = false;
    }
    seen.add(id);
  }
  return valid ? [...value] : null;
}
function isLabel(value) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= AUTOMATION_STUDIO_RECORD_SCHEMA_LIMITS.labelMaxLength;
}
function isValueType(value) {
  return typeof value === "string" && VALUE_TYPES.has(value);
}
function isHandling(value) {
  return typeof value === "string" && HANDLINGS.has(value);
}

// ../../../!FluxIQ/packages/contracts/src/record-sets/records-path.ts
var SEGMENT_PATTERN = /^[A-Za-z0-9_-]{1,100}$/u;
var FORBIDDEN_SEGMENTS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
function parseAutomationStudioRecordsPath(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > AUTOMATION_STUDIO_RECORD_OUTPUT_LIMITS.recordsPathMaxLength) return null;
  const segments = value.split(".");
  if (segments.length > AUTOMATION_STUDIO_RECORD_OUTPUT_LIMITS.recordsPathMaxSegments) return null;
  for (const segment of segments) {
    if (!SEGMENT_PATTERN.test(segment) || FORBIDDEN_SEGMENTS.has(segment)) return null;
  }
  return segments;
}

// ../../../!FluxIQ/packages/contracts/src/record-sets/parse-output.ts
var OUTPUT_KEYS = /* @__PURE__ */ new Set(["datasetId", "label", "recordsPath", "schema", "writeMode", "maxRecords"]);
var WRITE_MODES = new Set(AUTOMATION_STUDIO_RECORD_WRITE_MODES);
function parseAutomationStudioRecordOutput(value, options = {}) {
  const issues = /* @__PURE__ */ new Set();
  let output;
  try {
    output = parseOutput(value, options, issues);
  } catch {
    issues.add("record_output.invalid");
    output = null;
  }
  if (output === null || issues.size > 0) return { ok: false, issues: issues.size > 0 ? [...issues] : ["record_output.invalid"] };
  return { ok: true, output };
}
function parseOutput(value, options, issues) {
  if (!isPlainRecord(value)) {
    issues.add("record_output.not_object");
    return null;
  }
  if (!Object.keys(value).every((key) => OUTPUT_KEYS.has(key))) issues.add("record_output.unknown_key");
  const { datasetId, label, recordsPath, schema, writeMode, maxRecords } = value;
  if (!isDatasetId(datasetId)) issues.add("record_output.invalid_dataset_id");
  if (label !== void 0 && !isLabel2(label)) issues.add("record_output.invalid_label");
  if (recordsPath === void 0) issues.add("record_output.missing_records_path");
  else if (parseAutomationStudioRecordsPath(recordsPath) === null) issues.add("record_output.invalid_records_path");
  if (!isWriteMode(writeMode)) issues.add("record_output.invalid_write_mode");
  if (maxRecords !== void 0) {
    if (typeof maxRecords !== "number" || !Number.isInteger(maxRecords) || maxRecords < 1) issues.add("record_output.invalid_max_records");
    else if (maxRecords > AUTOMATION_STUDIO_RECORD_OUTPUT_LIMITS.maxRecordsCeiling) issues.add("record_output.max_records_above_ceiling");
  }
  const parsedSchema = parseAutomationStudioRecordSchema(schema, options);
  if (!parsedSchema.ok) for (const issue of parsedSchema.issues) issues.add(issue);
  if (issues.size > 0 || !parsedSchema.ok || !isDatasetId(datasetId) || typeof recordsPath !== "string" || !isWriteMode(writeMode)) return null;
  const output = { datasetId, recordsPath, schema: parsedSchema.schema, writeMode };
  if (typeof label === "string") output.label = label;
  if (typeof maxRecords === "number") output.maxRecords = maxRecords;
  return output;
}
function isDatasetId(value) {
  return typeof value === "string" && value !== "." && value !== ".." && AUTOMATION_STUDIO_RECORD_OUTPUT_LIMITS.datasetIdPattern.test(value);
}
function isLabel2(value) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= AUTOMATION_STUDIO_RECORD_OUTPUT_LIMITS.labelMaxLength;
}
function isWriteMode(value) {
  return typeof value === "string" && WRITE_MODES.has(value);
}

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/data/write-records.js
var WRITTEN_RECORDS_PATH = "records";
var ENCRYPT_UNAVAILABLE_ISSUE = "record_schema.encrypt_unavailable";
var writeRecordsNode = defineBuiltinNode({
  id: "builtin.data.write-records",
  label: "Write Records",
  description: "Save a list of records to a table for this run.",
  class: "data",
  scope: "both",
  inputs: [{ id: "records", label: "Records", valueType: "array", required: true }],
  outputs: [{ id: "records", label: "Records", valueType: "array", role: "data" }],
  parameters: [
    {
      id: "recordOutput",
      label: "Save as table",
      description: "The table these records are saved to, and which fields each record keeps. The records come from the Records input, so a records path is not used.",
      valueType: "json",
      defaultValue: null,
      // A binding could replace the schema, and with it the excluded fields, at run time.
      allowStateBinding: false,
      ui: { control: "record-output" }
    }
  ],
  icon: "database",
  execute: (context) => writeRecords(context)
});
function writeRecords(context) {
  const parsed = parseAutomationStudioRecordOutput(withWrittenRecordsPath(context.parameters.recordOutput));
  if (!parsed.ok)
    return invalidRecordOutput(parsed.issues);
  return {
    status: "success",
    route: "success",
    outputs: {},
    effects: [{ type: "records.write", payload: { recordOutput: parsed.output, records: context.inputs.records ?? null } }]
  };
}
function withWrittenRecordsPath(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return value ?? null;
  return { ...value, recordsPath: WRITTEN_RECORDS_PATH };
}
function invalidRecordOutput(issues) {
  const encryptUnavailable = issues.includes(ENCRYPT_UNAVAILABLE_ISSUE);
  const code = encryptUnavailable ? "record_output.encrypt_unavailable" : "record_output.invalid";
  const failure = { category: "graph_validation_or_unknown_node", code, retryable: false };
  return {
    status: "failed",
    route: "failed",
    effects: [],
    outputs: { error: { code, issues } },
    message: encryptUnavailable ? "Write Records asks to encrypt a field, which is not available yet, so no records were saved." : "Write Records has no valid table to save to, so no records were saved.",
    failure
  };
}

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/data/index.js
var dataNodes = [constantNode, getVariableNode, setVariableNode, mapObjectNode, filterListNode, writeRecordsNode];

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/database/shared.js
function collectionName(value) {
  return String(value ?? "").trim();
}

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/database/insert.js
var databaseInsertNode = defineBuiltinNode({
  id: "builtin.database.insert",
  label: "Create Record",
  description: "Ask a host database adapter to create one record.",
  class: "database",
  scope: "both",
  inputs: [{ id: "record", label: "Record", valueType: "object", required: true }],
  outputs: [{ id: "record", label: "Record", valueType: "object" }],
  parameters: [
    { id: "collection", label: "Data table", description: "The saved record set/table where the new record should be created.", valueType: "string", required: true, ui: { control: "reference", referenceType: "database-collection", placeholder: "Choose a data table" } },
    { id: "upsert", label: "Update matching record instead", description: "If a matching record already exists, update it instead of creating a duplicate.", valueType: "boolean", defaultValue: false },
    { id: "conflictKey", label: "Match on field", description: "Field used to find an existing record when update-matching is enabled.", valueType: "string", defaultValue: "", ui: { control: "field", placeholder: "uniqueField" } },
    { id: "returnRecord", label: "Return created record", description: "Send the created or updated record to the next node.", valueType: "boolean", defaultValue: true }
  ],
  icon: "file-input",
  privileged: true,
  execute: (context) => ({
    status: "success",
    route: "success",
    outputs: { record: context.inputs.record ?? {} },
    effects: [{ type: "database.insert.requested", payload: { collection: collectionName(context.parameters.collection), record: context.inputs.record ?? {}, upsert: context.parameters.upsert === true, conflictKey: context.parameters.conflictKey ?? "", returnRecord: context.parameters.returnRecord !== false } }]
  })
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/database/query.js
var databaseQueryNode = defineBuiltinNode({
  id: "builtin.database.query",
  label: "Find Records",
  description: "Ask a host database adapter to find records in a data table.",
  class: "database",
  scope: "both",
  inputs: [],
  outputs: [{ id: "records", label: "Records", valueType: "array" }],
  parameters: [
    { id: "collection", label: "Data table", description: "The saved record set/table to search.", valueType: "string", required: true, ui: { control: "reference", referenceType: "database-collection", placeholder: "Choose a data table" } },
    { id: "where", label: "Only include records where", description: "Filter fields and values. Leave empty to include all records.", valueType: "object", defaultValue: {} },
    { id: "limit", label: "Maximum records", description: "Largest number of records to return.", valueType: "number", defaultValue: 100 },
    { id: "orderBy", label: "Sort by field", description: "Optional field used to sort the returned records.", valueType: "string", defaultValue: "", ui: { control: "field", placeholder: "fieldName" } },
    {
      id: "orderDirection",
      label: "Sort direction",
      description: "Choose whether lower values or higher values appear first.",
      valueType: "string",
      defaultValue: "asc",
      options: [
        { label: "Lowest first", value: "asc" },
        { label: "Highest first", value: "desc" }
      ]
    }
  ],
  icon: "database",
  execute: (context) => ({
    status: "success",
    route: "success",
    outputs: { records: [] },
    effects: [{ type: "database.query.requested", payload: { collection: collectionName(context.parameters.collection), where: context.parameters.where ?? {}, limit: context.parameters.limit ?? 100, orderBy: context.parameters.orderBy ?? "", orderDirection: context.parameters.orderDirection ?? "asc" } }]
  })
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/database/update.js
var databaseUpdateNode = defineBuiltinNode({
  id: "builtin.database.update",
  label: "Update Records",
  description: "Ask a host database adapter to update matching records.",
  class: "database",
  scope: "both",
  inputs: [{ id: "patch", label: "Fields to change", valueType: "object", required: true }],
  outputs: [{ id: "result", label: "Result", valueType: "object" }],
  parameters: [
    { id: "collection", label: "Data table", description: "The saved record set/table containing records to update.", valueType: "string", required: true, ui: { control: "reference", referenceType: "database-collection", placeholder: "Choose a data table" } },
    { id: "where", label: "Only update records where", description: "Filter fields and values used to choose records. Be careful leaving this empty.", valueType: "object", defaultValue: {} },
    { id: "limit", label: "Maximum records to update", description: "Safety limit for how many records this request may change.", valueType: "number", defaultValue: 1 },
    { id: "dryRun", label: "Preview only", description: "When enabled, request a preview without actually changing records.", valueType: "boolean", defaultValue: false },
    { id: "returnUpdated", label: "Return updated records", description: "Send updated records to the next node.", valueType: "boolean", defaultValue: true }
  ],
  icon: "database",
  privileged: true,
  execute: (context) => ({
    status: "success",
    route: "success",
    outputs: { result: {} },
    effects: [{ type: "database.update.requested", payload: { collection: collectionName(context.parameters.collection), where: context.parameters.where ?? {}, patch: context.inputs.patch ?? {}, limit: context.parameters.limit ?? 1, dryRun: context.parameters.dryRun === true, returnUpdated: context.parameters.returnUpdated !== false } }]
  })
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/database/index.js
var databaseNodes = [databaseQueryNode, databaseInsertNode, databaseUpdateNode];

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/logic/shared.js
function compareValues(left, right, operator) {
  return compareBasic(left, right, operator);
}
function everyBoolean(values) {
  return values.every(booleanValue3);
}
function someBoolean(values) {
  return values.some(booleanValue3);
}

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/logic/and.js
var andNode = defineBuiltinNode({
  id: "builtin.logic.and",
  label: "And",
  description: "Return true when all input conditions are true.",
  class: "logic",
  scope: "both",
  inputs: [{ id: "conditions", label: "Conditions", valueType: "boolean", required: true, multiple: true }],
  outputs: [
    { id: "true", label: "True", valueType: "any" },
    { id: "false", label: "False", valueType: "any" },
    { id: "result", label: "Result", valueType: "boolean" }
  ],
  parameters: [
    {
      id: "emptyBehavior",
      label: "If no conditions arrive",
      description: "Fallback result when this node receives no boolean inputs.",
      valueType: "string",
      defaultValue: "true",
      options: [
        { label: "Treat as true", value: "true" },
        { label: "Treat as false", value: "false" }
      ]
    }
  ],
  icon: "ampersand",
  execute: (context) => {
    const conditions = arrayValue(context.inputs.conditions);
    const result = conditions.length ? everyBoolean(conditions) : context.parameters.emptyBehavior !== "false";
    return { status: "success", route: result ? "true" : "false", outputs: { result } };
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/logic/compare.js
var compareNode = defineBuiltinNode({
  id: "builtin.logic.compare",
  label: "Compare",
  description: "Compare two values with a selected operator.",
  class: "logic",
  scope: "both",
  inputs: [
    { id: "left", label: "Left", valueType: "any", required: true },
    { id: "right", label: "Right", valueType: "any", required: true }
  ],
  outputs: [
    { id: "true", label: "True", valueType: "any" },
    { id: "false", label: "False", valueType: "any" },
    { id: "result", label: "Result", valueType: "boolean" }
  ],
  parameters: [
    {
      id: "operator",
      label: "Operator",
      description: "Choose how the left input should be checked against the right input or fallback value.",
      valueType: "string",
      defaultValue: "equals",
      options: [
        { value: "equals", label: "Equals" },
        { value: "not-equals", label: "Does not equal" },
        { value: "greater-than", label: "Greater than" },
        { value: "greater-than-or-equal", label: "Greater than or equal" },
        { value: "less-than", label: "Less than" },
        { value: "less-than-or-equal", label: "Less than or equal" },
        { value: "contains", label: "Contains" },
        { value: "starts-with", label: "Starts with" },
        { value: "ends-with", label: "Ends with" },
        { value: "exists", label: "Exists" }
      ]
    },
    { id: "rightDefault", label: "Fallback comparison value", description: "Used when nothing is connected to the Right input.", valueType: "any", defaultValue: null, ui: { control: "value" } },
    { id: "caseSensitive", label: "Match capitalization exactly", description: "When disabled, text comparisons ignore capitalization.", valueType: "boolean", defaultValue: true }
  ],
  icon: "equal",
  execute: (context) => {
    const caseSensitive = context.parameters.caseSensitive !== false;
    const left = !caseSensitive && typeof context.inputs.left === "string" ? context.inputs.left.toLowerCase() : context.inputs.left;
    const rawRight = context.inputs.right ?? context.parameters.rightDefault;
    const right = !caseSensitive && typeof rawRight === "string" ? rawRight.toLowerCase() : rawRight;
    const result = compareValues(left, right, String(context.parameters.operator ?? "equals"));
    return { status: "success", route: result ? "true" : "false", outputs: { result } };
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/logic/not.js
var notNode = defineBuiltinNode({
  id: "builtin.logic.not",
  label: "Not",
  description: "Invert a boolean condition.",
  class: "logic",
  scope: "both",
  inputs: [{ id: "condition", label: "Condition", valueType: "boolean", required: true }],
  outputs: [
    { id: "true", label: "True", valueType: "any" },
    { id: "false", label: "False", valueType: "any" },
    { id: "result", label: "Result", valueType: "boolean" }
  ],
  parameters: [{ id: "missingValue", label: "If condition is missing", description: "Boolean value to assume before this node flips it.", valueType: "boolean", defaultValue: false }],
  icon: "badge-x",
  execute: (context) => {
    const value = context.inputs.condition === void 0 ? context.parameters.missingValue : context.inputs.condition;
    const result = !booleanValue3(value);
    return { status: "success", route: result ? "true" : "false", outputs: { result } };
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/logic/or.js
var orNode = defineBuiltinNode({
  id: "builtin.logic.or",
  label: "Or",
  description: "Return true when any input condition is true.",
  class: "logic",
  scope: "both",
  inputs: [{ id: "conditions", label: "Conditions", valueType: "boolean", required: true, multiple: true }],
  outputs: [
    { id: "true", label: "True", valueType: "any" },
    { id: "false", label: "False", valueType: "any" },
    { id: "result", label: "Result", valueType: "boolean" }
  ],
  parameters: [
    {
      id: "emptyBehavior",
      label: "If no conditions arrive",
      description: "Fallback result when this node receives no boolean inputs.",
      valueType: "string",
      defaultValue: "false",
      options: [
        { label: "Treat as false", value: "false" },
        { label: "Treat as true", value: "true" }
      ]
    }
  ],
  icon: "list-tree",
  execute: (context) => {
    const conditions = arrayValue(context.inputs.conditions);
    const result = conditions.length ? someBoolean(conditions) : context.parameters.emptyBehavior === "true";
    return { status: "success", route: result ? "true" : "false", outputs: { result } };
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/logic/index.js
var logicNodes = [compareNode, andNode, orNode, notNode];

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/math/shared.js
var optionalPrecisionOptions = [
  { label: "Do not round", value: "none" },
  { label: "Whole number", value: "0" },
  { label: "1 decimal place", value: "1" },
  { label: "2 decimal places", value: "2" },
  { label: "3 decimal places", value: "3" },
  { label: "4 decimal places", value: "4" },
  { label: "6 decimal places", value: "6" }
];
var precisionOptions = optionalPrecisionOptions.filter((option) => option.value !== "none");
function binaryNumbers(context) {
  return [numberValue2(context.inputs.left), numberValue2(context.inputs.right)];
}
function applyPrecision(value, precision) {
  const places = Math.floor(numberValue2(precision, -1));
  if (places < 0)
    return value;
  const multiplier = 10 ** Math.min(12, places);
  return Math.round(value * multiplier) / multiplier;
}

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/math/add.js
var addNode = defineBuiltinNode({
  id: "builtin.math.add",
  label: "Add",
  description: "Add two numeric values.",
  class: "math",
  scope: "both",
  inputs: [
    { id: "left", label: "Left", valueType: "number", required: true },
    { id: "right", label: "Right", valueType: "number", required: true }
  ],
  outputs: [{ id: "result", label: "Result", valueType: "number" }],
  parameters: [
    { id: "offset", label: "Add after total", description: "Extra amount added after the two inputs are combined.", valueType: "number", defaultValue: 0 },
    { id: "precision", label: "Round result to", description: "Optional rounding applied after the calculation.", valueType: "string", defaultValue: "none", options: optionalPrecisionOptions }
  ],
  icon: "calculator",
  execute: (context) => {
    const [left, right] = binaryNumbers(context);
    return emptyResult({ result: applyPrecision(left + right + numberValue2(context.parameters.offset), context.parameters.precision) });
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/math/clamp.js
var clampNode = defineBuiltinNode({
  id: "builtin.math.clamp",
  label: "Clamp",
  description: "Clamp a number between minimum and maximum bounds.",
  class: "math",
  scope: "both",
  inputs: [{ id: "value", label: "Value", valueType: "number", required: true }],
  outputs: [{ id: "result", label: "Result", valueType: "number" }],
  parameters: [
    { id: "min", label: "Lowest allowed value", description: "Numbers below this are raised to this value.", valueType: "number", defaultValue: 0 },
    { id: "max", label: "Highest allowed value", description: "Numbers above this are lowered to this value.", valueType: "number", defaultValue: 1 }
  ],
  icon: "between-horizontal-start",
  execute: (context) => {
    const value = numberValue2(inputValue(context, "value"));
    const min = numberValue2(context.parameters.min);
    const max = numberValue2(context.parameters.max, 1);
    return emptyResult({ result: Math.min(Math.max(value, Math.min(min, max)), Math.max(min, max)) });
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/math/divide.js
var divideNode = defineBuiltinNode({
  id: "builtin.math.divide",
  label: "Divide",
  description: "Divide one numeric value by another.",
  class: "math",
  scope: "both",
  inputs: [
    { id: "left", label: "Left", valueType: "number", required: true },
    { id: "right", label: "Right", valueType: "number", required: true }
  ],
  outputs: [{ id: "result", label: "Result", valueType: "number" }],
  parameters: [
    { id: "precision", label: "Round result to", description: "Optional rounding applied after division.", valueType: "string", defaultValue: "none", options: optionalPrecisionOptions },
    {
      id: "divideByZero",
      label: "If dividing by zero",
      description: "Choose what happens when the right input is zero.",
      valueType: "string",
      defaultValue: "fail",
      options: [
        { label: "Fail this path", value: "fail" },
        { label: "Use fallback value", value: "fallback" },
        { label: "Return empty value", value: "null" }
      ]
    },
    { id: "fallback", label: "Fallback value", description: "Number to return when dividing by zero and fallback is selected.", valueType: "number", defaultValue: 0 }
  ],
  icon: "calculator",
  execute: (context) => {
    const [left, right] = binaryNumbers(context);
    if (right === 0) {
      if (context.parameters.divideByZero === "fallback")
        return emptyResult({ result: numberValue2(context.parameters.fallback) });
      if (context.parameters.divideByZero === "null")
        return emptyResult({ result: null });
      return { status: "failed", route: "failed", outputs: { result: null } };
    }
    return emptyResult({ result: applyPrecision(left / right, context.parameters.precision) });
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/math/multiply.js
var multiplyNode = defineBuiltinNode({
  id: "builtin.math.multiply",
  label: "Multiply",
  description: "Multiply two numeric values.",
  class: "math",
  scope: "both",
  inputs: [
    { id: "left", label: "Left", valueType: "number", required: true },
    { id: "right", label: "Right", valueType: "number", required: true }
  ],
  outputs: [{ id: "result", label: "Result", valueType: "number" }],
  parameters: [{ id: "precision", label: "Round result to", description: "Optional rounding applied after multiplication.", valueType: "string", defaultValue: "none", options: optionalPrecisionOptions }],
  icon: "calculator",
  execute: (context) => {
    const [left, right] = binaryNumbers(context);
    return emptyResult({ result: applyPrecision(left * right, context.parameters.precision) });
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/math/round.js
var roundNode = defineBuiltinNode({
  id: "builtin.math.round",
  label: "Round",
  description: "Round a numeric value to a configured precision.",
  class: "math",
  scope: "both",
  inputs: [{ id: "value", label: "Value", valueType: "number", required: true }],
  outputs: [{ id: "result", label: "Result", valueType: "number" }],
  parameters: [
    { id: "precision", label: "Decimal places to keep", description: "How many digits should remain after the decimal point.", valueType: "string", defaultValue: "0", options: precisionOptions },
    {
      id: "mode",
      label: "Rounding method",
      description: "Choose whether to round normally, always down, or always up.",
      valueType: "string",
      defaultValue: "nearest",
      options: [
        { label: "Nearest number", value: "nearest" },
        { label: "Always down", value: "floor" },
        { label: "Always up", value: "ceil" }
      ]
    }
  ],
  icon: "circle-dot",
  execute: (context) => {
    const precision = Math.max(0, Math.floor(numberValue2(context.parameters.precision)));
    const multiplier = 10 ** precision;
    const value = numberValue2(inputValue(context, "value")) * multiplier;
    const rounded = context.parameters.mode === "floor" ? Math.floor(value) : context.parameters.mode === "ceil" ? Math.ceil(value) : Math.round(value);
    return emptyResult({ result: rounded / multiplier });
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/math/subtract.js
var subtractNode = defineBuiltinNode({
  id: "builtin.math.subtract",
  label: "Subtract",
  description: "Subtract one numeric value from another.",
  class: "math",
  scope: "both",
  inputs: [
    { id: "left", label: "Left", valueType: "number", required: true },
    { id: "right", label: "Right", valueType: "number", required: true }
  ],
  outputs: [{ id: "result", label: "Result", valueType: "number" }],
  parameters: [{ id: "precision", label: "Round result to", description: "Optional rounding applied after subtraction.", valueType: "string", defaultValue: "none", options: optionalPrecisionOptions }],
  icon: "calculator",
  execute: (context) => {
    const [left, right] = binaryNumbers(context);
    return emptyResult({ result: applyPrecision(left - right, context.parameters.precision) });
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/math/index.js
var mathNodes = [addNode, subtractNode, multiplyNode, divideNode, clampNode, roundNode];

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/policy/shared.js
function jsonParameter(value, fallback) {
  if (value === void 0)
    return fallback;
  return value;
}

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/policy/action.js
var actionNode = defineBuiltinNode({
  id: "builtin.policy.action",
  label: "Run Output",
  description: "Dispatch one importer-registered domain output.",
  class: "policy",
  scope: "policy",
  inputs: [{ id: "ready", label: "Ready", valueType: "boolean" }],
  outputs: [
    { id: "success", label: "Success", valueType: "any" },
    { id: "failed", label: "Failed", valueType: "any" },
    { id: "records", label: "Records", valueType: "array", role: "data" }
  ],
  parameters: [
    { id: "outputId", label: "Output to run", description: "Choose an importer-registered output node.", valueType: "string", required: true, ui: { control: "reference", referenceType: "action", placeholder: "Choose an output" } },
    { id: "parameters", label: "Output payload", description: "Values passed to the selected output.", valueType: "object", defaultValue: {} },
    { id: "confirmationInputId", label: "Confirmation input", description: "Action input stream that confirms the output occurred. Leave empty for no confirmation.", valueType: "string", defaultValue: "", ui: { control: "identifier", placeholder: "Registered action input ID" } },
    { id: "confirmationTimeoutMs", label: "Confirmation timeout", description: "How long to wait for the confirmation input.", valueType: "number", defaultValue: 5e3 },
    { id: "timeoutMs", label: "Give up after milliseconds", description: "Maximum time to wait before treating this action as failed.", valueType: "number", defaultValue: 5e3 },
    { id: "requiresApproval", label: "Ask before running", description: "Require operator approval before this action executes.", valueType: "boolean", defaultValue: false },
    {
      id: "failureRoute",
      label: "If the action fails",
      description: "Usually failed. Success is available for intentionally ignoring errors.",
      valueType: "string",
      defaultValue: "failed",
      options: [
        { label: "Go to Failed", value: "failed" },
        { label: "Continue as Success", value: "success" }
      ]
    },
    {
      id: "recordOutput",
      label: "Save extracted records",
      description: "Save the records this output returns as a table. Leave off to save none.",
      valueType: "json",
      defaultValue: null,
      // A binding could replace the schema, and with it the excluded fields, at run time.
      allowStateBinding: false,
      ui: { control: "record-output" }
    }
  ],
  icon: "zap",
  privileged: true,
  execute: (context) => {
    const recordOutput = readRecordOutput(context.parameters.recordOutput);
    if (!recordOutput.ok)
      return recordOutputFailure(recordOutput.issues);
    const payload = {
      outputId: context.parameters.outputId ?? "",
      parameters: jsonParameter(context.parameters.parameters, {}),
      confirmationInputId: context.parameters.confirmationInputId ?? "",
      confirmationTimeoutMs: context.parameters.confirmationTimeoutMs ?? 5e3,
      timeoutMs: context.parameters.timeoutMs ?? 5e3,
      requiresApproval: context.parameters.requiresApproval === true,
      failureRoute: context.parameters.failureRoute ?? "failed"
    };
    if (recordOutput.output !== null)
      payload.recordOutput = recordOutput.output;
    return {
      status: "success",
      route: "success",
      outputs: { success: true },
      effects: [{ type: "policy.output.dispatch", payload }]
    };
  }
});
var ENCRYPT_UNAVAILABLE_ISSUE2 = "record_schema.encrypt_unavailable";
function readRecordOutput(value) {
  if (value === void 0 || value === null)
    return { ok: true, output: null };
  return parseAutomationStudioRecordOutput(value);
}
function recordOutputFailure(issues) {
  const encryptUnavailable = issues.includes(ENCRYPT_UNAVAILABLE_ISSUE2);
  const code = encryptUnavailable ? "record_output.encrypt_unavailable" : "record_output.invalid";
  const failure = {
    category: "graph_validation_or_unknown_node",
    code,
    retryable: false,
    stage: "dispatch"
  };
  return {
    status: "failed",
    route: "failed",
    effects: [],
    outputs: { error: { code, issues } },
    message: encryptUnavailable ? "Save extracted records asks to encrypt a field, which is not available yet, so the output was not run." : "Save extracted records is not a valid record output, so the output was not run.",
    failure
  };
}

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/policy/expectation.js
var EXPECTATION_REJECTED_FAILURE = Object.freeze({
  category: "expected_state_missing",
  code: "core.policy.expectation_rejected",
  retryable: true,
  stage: "verification"
});
var expectationNode = defineBuiltinNode({
  id: "builtin.policy.expectation",
  label: "Expectation",
  description: "Check whether expected task state is true after an action.",
  class: "policy",
  scope: "policy",
  inputs: [{ id: "signals", label: "Signals", valueType: "signal", multiple: true }],
  outputs: [
    { id: "passed", label: "Passed", valueType: "boolean" },
    { id: "failed", label: "Failed", valueType: "boolean" }
  ],
  parameters: [
    { id: "conditions", label: "Expected conditions", description: "State checks this node should evaluate.", valueType: "array", defaultValue: [] },
    {
      id: "mode",
      label: "Required matches",
      description: "Choose whether every condition or just one condition must pass.",
      valueType: "string",
      defaultValue: "all",
      options: [
        { label: "All conditions must pass", value: "all" },
        { label: "Any condition may pass", value: "any" }
      ]
    },
    { id: "timeoutMs", label: "Wait up to milliseconds", description: "How long to wait for expected state to appear.", valueType: "number", defaultValue: 1e3 }
  ],
  icon: "list-checks",
  execute: async (context) => {
    const conditions = jsonParameter(context.parameters.conditions, []);
    const mode = typeof context.parameters.mode === "string" ? context.parameters.mode : "all";
    const timeoutMs = typeof context.parameters.timeoutMs === "number" ? context.parameters.timeoutMs : 1e3;
    const effects = [{ type: "policy.expectation.checked", payload: { conditions, mode, timeoutMs } }];
    const evaluation = await evaluateExpectation(context, conditions, mode, timeoutMs);
    if (!evaluation || evaluation.passed) {
      return { status: "success", route: "passed", outputs: { passed: true, failed: false }, effects };
    }
    return {
      status: "failed",
      route: "failed",
      outputs: { passed: false, failed: true },
      effects,
      message: evaluation.message ?? "The host reported that the expected state does not hold.",
      failure: evaluation.failure ?? { ...EXPECTATION_REJECTED_FAILURE }
    };
  }
});
async function evaluateExpectation(context, conditions, mode, timeoutMs) {
  if (!context.expectationEvaluator)
    return void 0;
  return await context.expectationEvaluator(Array.isArray(conditions) ? conditions : [conditions], mode, timeoutMs, { source: "policy_node", ...context.signal ? { signal: context.signal } : {} });
}

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/policy/recovery.js
var recoveryNode = defineBuiltinNode({
  id: "builtin.policy.recovery",
  label: "Recovery",
  description: "Choose how to recover after a failed task action.",
  class: "policy",
  scope: "policy",
  inputs: [{ id: "failure", label: "Failure", valueType: "any" }],
  outputs: [
    { id: "recovered", label: "Recovered", valueType: "any" },
    { id: "failed", label: "Failed", valueType: "any" }
  ],
  parameters: [
    {
      id: "strategy",
      label: "Recovery strategy",
      description: "What this policy should try after a failure.",
      valueType: "string",
      defaultValue: "retry",
      options: [
        { label: "Try the failed step again", value: "retry" },
        { label: "Run a fallback action", value: "fallback-action" },
        { label: "Stop this policy", value: "abort" }
      ]
    },
    { id: "maxAttempts", label: "Maximum tries", description: "How many total attempts are allowed when retrying.", valueType: "number", defaultValue: 2 },
    { id: "fallbackActionDefinitionId", label: "Fallback action", description: "Action to run when the fallback strategy is selected.", valueType: "string", defaultValue: "", ui: { control: "reference", referenceType: "action", placeholder: "Choose fallback action" } }
  ],
  icon: "shield-check",
  execute: (context) => ({ status: "success", route: context.parameters.strategy === "abort" ? "failed" : "recovered", outputs: { recovered: context.inputs.failure ?? null, strategy: context.parameters.strategy ?? "retry", maxAttempts: context.parameters.maxAttempts ?? 2, fallbackActionDefinitionId: context.parameters.fallbackActionDefinitionId ?? "" } })
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/policy/index.js
var policyNodes = [actionNode, expectationNode, recoveryNode];

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/random/shared.js
function randomFloat(context) {
  return context.random ? context.random() : Math.random();
}
function randomInRange(context) {
  const min = numberValue2(context.parameters.min);
  const max = numberValue2(context.parameters.max, 1);
  const includeMax = context.parameters.includeMax === true;
  const value = Math.min(min, max) + randomFloat(context) * Math.abs(max - min);
  return includeMax ? Math.min(Math.max(min, max), value) : value;
}

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/random/jitter.js
var jitterNode = defineBuiltinNode({
  id: "builtin.random.jitter",
  label: "Jitter",
  description: "Add bounded randomness to a numeric value.",
  class: "random",
  scope: "both",
  inputs: [{ id: "value", label: "Value", valueType: "number", required: true }],
  outputs: [{ id: "value", label: "Value", valueType: "number" }],
  parameters: [
    { id: "amount", label: "Maximum change", description: "Largest amount that can be randomly added or subtracted.", valueType: "number", defaultValue: 0.1 },
    { id: "precision", label: "Round result to", description: "Optional rounding after jitter is applied.", valueType: "string", defaultValue: "none", options: optionalPrecisionOptions },
    { id: "min", label: "Lowest allowed value", description: "Final value will not go below this number.", valueType: "number", defaultValue: -999999 },
    { id: "max", label: "Highest allowed value", description: "Final value will not go above this number.", valueType: "number", defaultValue: 999999 }
  ],
  icon: "waves",
  execute: (context) => {
    const amount = Math.max(0, numberValue2(context.parameters.amount, 0.1));
    const offset = (randomFloat(context) * 2 - 1) * amount;
    const min = numberValue2(context.parameters.min, -999999);
    const max = numberValue2(context.parameters.max, 999999);
    const precision = Math.floor(numberValue2(context.parameters.precision, -1));
    const raw = Math.min(Math.max(numberValue2(inputValue(context, "value")) + offset, Math.min(min, max)), Math.max(min, max));
    if (precision >= 0) {
      const multiplier = 10 ** Math.min(12, precision);
      return emptyResult({ value: Math.round(raw * multiplier) / multiplier });
    }
    return emptyResult({ value: raw });
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/random/random-choice.js
var randomChoiceNode = defineBuiltinNode({
  id: "builtin.random.choice",
  label: "Random Choice",
  description: "Select one value from a list.",
  class: "random",
  scope: "both",
  inputs: [{ id: "choices", label: "Choices", valueType: "array", required: true }],
  outputs: [{ id: "choice", label: "Choice", valueType: "any" }],
  parameters: [
    { id: "fallback", label: "If list is empty", description: "Value to return when there are no choices.", valueType: "any", defaultValue: null, ui: { control: "value" } },
    { id: "allowEmpty", label: "Allow empty choices", description: "When disabled, an empty choice list makes this node fail.", valueType: "boolean", defaultValue: true }
  ],
  icon: "shuffle",
  execute: (context) => {
    const choices = arrayValue(context.inputs.choices);
    if (!choices.length) {
      if (context.parameters.allowEmpty === false)
        return { status: "failed", route: "failed", outputs: { choice: context.parameters.fallback ?? null } };
      return emptyResult({ choice: context.parameters.fallback ?? null });
    }
    return emptyResult({ choice: choices[Math.floor(randomFloat(context) * choices.length)] ?? context.parameters.fallback ?? null });
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/random/random-number.js
var randomNumberNode = defineBuiltinNode({
  id: "builtin.random.number",
  label: "Random Number",
  description: "Produce a random number in a configured range.",
  class: "random",
  scope: "both",
  inputs: [],
  outputs: [{ id: "value", label: "Value", valueType: "number" }],
  parameters: [
    { id: "min", label: "Lowest possible number", description: "Start of the random range.", valueType: "number", defaultValue: 0 },
    { id: "max", label: "Highest possible number", description: "End of the random range.", valueType: "number", defaultValue: 1 },
    {
      id: "mode",
      label: "Number type",
      description: "Choose whether to produce a decimal number or a whole number.",
      valueType: "string",
      defaultValue: "float",
      options: [
        { label: "Decimal number", value: "float" },
        { label: "Whole number", value: "integer" }
      ]
    },
    { id: "precision", label: "Decimal places to keep", description: "Only used for decimal numbers.", valueType: "string", defaultValue: "2", options: precisionOptions },
    { id: "includeMax", label: "Include highest number", description: "Allow the random result to equal the highest possible number.", valueType: "boolean", defaultValue: false }
  ],
  icon: "dice-5",
  execute: (context) => {
    const value = randomInRange(context);
    if (context.parameters.mode === "integer") {
      const min = Math.ceil(numberValue2(context.parameters.min));
      const max = Math.floor(numberValue2(context.parameters.max, 1));
      const upper = context.parameters.includeMax === true ? max + 1 : max;
      return emptyResult({ value: Math.floor(min + (context.random ? context.random() : Math.random()) * Math.max(1, upper - min)) });
    }
    const precision = Math.max(0, Math.min(12, Math.floor(numberValue2(context.parameters.precision, 2))));
    const multiplier = 10 ** precision;
    return emptyResult({ value: Math.round(value * multiplier) / multiplier });
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/random/weighted-choice.js
var weightedChoiceNode = defineBuiltinNode({
  id: "builtin.random.weighted-choice",
  label: "Weighted Choice",
  description: "Select one value from weighted options.",
  class: "random",
  scope: "both",
  inputs: [{ id: "choices", label: "Weighted choices", valueType: "array", required: true }],
  outputs: [{ id: "choice", label: "Choice", valueType: "any" }],
  parameters: [
    { id: "defaultWeight", label: "Default chance weight", description: "Used for choices that do not provide their own weight.", valueType: "number", defaultValue: 1 },
    { id: "fallback", label: "If no choice can be picked", description: "Value to return when the list is empty or all weights are zero.", valueType: "any", defaultValue: null, ui: { control: "value" } },
    { id: "normalizeWeights", label: "Balance weights automatically", description: "Treat weights as relative chances instead of requiring them to add up to a specific total.", valueType: "boolean", defaultValue: true }
  ],
  icon: "scale",
  execute: (context) => {
    const choices = arrayValue(context.inputs.choices);
    const defaultWeight = numberValue2(context.parameters.defaultWeight, 1);
    const total = choices.reduce((sum, choice) => sum + Math.max(0, numberValue2(choice.weight, defaultWeight)), 0);
    if (!choices.length || total <= 0)
      return emptyResult({ choice: context.parameters.fallback ?? null });
    let cursor = randomFloat(context) * total;
    for (const choice of choices) {
      cursor -= Math.max(0, numberValue2(choice.weight, defaultWeight));
      if (cursor <= 0)
        return emptyResult({ choice: choice.value ?? null });
    }
    return emptyResult({ choice: choices[0]?.value ?? context.parameters.fallback ?? null });
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/random/index.js
var randomNodes = [randomNumberNode, randomChoiceNode, weightedChoiceNode, jitterNode];

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/routine/approval.js
var approvalNode = defineBuiltinNode({
  id: "builtin.routine.approval",
  label: "Approval",
  description: "Pause a routine until an operator approves or rejects it.",
  class: "routine",
  scope: "routine",
  inputs: [{ id: "in", label: "In", valueType: "any" }],
  outputs: [
    { id: "approved", label: "Approved", valueType: "any" },
    { id: "rejected", label: "Rejected", valueType: "any" }
  ],
  parameters: [
    { id: "prompt", label: "Approval message", description: "Message shown to the operator who approves or rejects this step.", valueType: "string", defaultValue: "Approve this routine step?", ui: { control: "textarea", placeholder: "Approval message" } },
    { id: "timeoutMs", label: "Auto-decide after milliseconds", description: "Use 0 to wait indefinitely.", valueType: "number", defaultValue: 0 },
    {
      id: "defaultRoute",
      label: "If nobody responds",
      description: "Route to use when the approval times out.",
      valueType: "string",
      defaultValue: "rejected",
      options: [
        { label: "Treat as rejected", value: "rejected" },
        { label: "Treat as approved", value: "approved" }
      ]
    }
  ],
  icon: "badge-check",
  execute: (context) => ({ status: "waiting", route: "approved", outputs: { approved: context.inputs.in ?? null, timeoutMs: context.parameters.timeoutMs ?? 0, defaultRoute: context.parameters.defaultRoute ?? "rejected" }, effects: [{ type: "routine.approval.requested", payload: { prompt: context.parameters.prompt ?? "", timeoutMs: context.parameters.timeoutMs ?? 0, defaultRoute: context.parameters.defaultRoute ?? "rejected" } }] })
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/routine/shared.js
function referenceId(value) {
  return String(value ?? "").trim();
}

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/routine/subroutine.js
var subroutineNode = defineBuiltinNode({
  id: "builtin.routine.subroutine",
  label: "Subroutine",
  description: "Run another routine as a reusable graph step.",
  class: "routine",
  scope: "routine",
  inputs: [{ id: "in", label: "In", valueType: "any" }],
  outputs: [
    { id: "success", label: "Success", valueType: "any" },
    { id: "failed", label: "Failed", valueType: "any" }
  ],
  parameters: [
    { id: "routineId", label: "Routine to run", description: "Choose the saved routine this node should call.", valueType: "string", required: true, ui: { control: "reference", referenceType: "routine", placeholder: "Choose a routine" } },
    { id: "inputs", label: "Values to pass in", description: "Input values made available to the called routine.", valueType: "object", defaultValue: {} },
    {
      id: "isolation",
      label: "Context sharing",
      description: "Choose whether the called routine can see the current routine's variables.",
      valueType: "string",
      defaultValue: "shared",
      options: [
        { label: "Share current variables", value: "shared" },
        { label: "Use isolated variables", value: "isolated" }
      ]
    }
  ],
  icon: "boxes",
  execute: (context) => ({
    status: "success",
    route: "success",
    outputs: { success: context.inputs.in ?? null },
    effects: [{ type: "routine.subroutine.requested", payload: { routineId: referenceId(context.parameters.routineId), inputs: context.parameters.inputs ?? {}, isolation: context.parameters.isolation ?? "shared" } }]
  })
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/routine/task-policy.js
var taskPolicyNode = defineBuiltinNode({
  id: "builtin.routine.task-policy",
  label: "Run Task",
  description: "Run a saved task policy from this routine.",
  class: "routine",
  scope: "routine",
  inputs: [{ id: "in", label: "In", valueType: "any" }],
  outputs: [
    { id: "success", label: "Success", valueType: "any" },
    { id: "failed", label: "Failed", valueType: "any" }
  ],
  parameters: [
    { id: "taskId", label: "Task to run", description: "Choose the saved task this routine step should start.", valueType: "string", required: true, ui: { control: "reference", referenceType: "task", placeholder: "Choose a task" } },
    { id: "policyId", label: "Specific policy version", description: "Optional override. Leave blank to use the task's default policy.", valueType: "string", defaultValue: "", ui: { control: "reference", referenceType: "policy", placeholder: "Default policy" } },
    { id: "inputs", label: "Values to pass in", description: "Input values made available to the task.", valueType: "object", defaultValue: {} },
    { id: "waitForCompletion", label: "Wait until task finishes", description: "When enabled, the routine pauses until this task reports success or failure.", valueType: "boolean", defaultValue: true }
  ],
  icon: "network",
  execute: (context) => ({
    status: "success",
    route: "success",
    outputs: { success: context.inputs.in ?? null },
    effects: [{ type: "routine.task-policy.requested", payload: { taskId: referenceId(context.parameters.taskId), policyId: referenceId(context.parameters.policyId), inputs: context.parameters.inputs ?? {}, waitForCompletion: context.parameters.waitForCompletion !== false } }]
  })
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/routine/index.js
var routineNodes = [taskPolicyNode, subroutineNode, approvalNode];

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/timing/shared.js
function durationMs(value, fallback) {
  return Math.max(0, Math.floor(numberValue2(value, fallback)));
}
function durationFromUnit(value, unit, fallbackMs) {
  const amount = numberValue2(value, fallbackMs);
  if (unit === "seconds")
    return durationMs(amount * 1e3, fallbackMs);
  if (unit === "minutes")
    return durationMs(amount * 6e4, fallbackMs);
  return durationMs(amount, fallbackMs);
}

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/timing/debounce.js
var debounceNode = defineBuiltinNode({
  id: "builtin.timing.debounce",
  label: "Debounce",
  description: "Continue only after a signal stops changing for a short time.",
  class: "timing",
  scope: "both",
  inputs: [{ id: "signal", label: "Signal", valueType: "signal", required: true }],
  outputs: [{ id: "stable", label: "Stable", valueType: "boolean" }],
  parameters: [
    { id: "windowMs", label: "Stable for milliseconds", description: "How long the signal must remain unchanged.", valueType: "number", defaultValue: 250 },
    {
      id: "edge",
      label: "When to continue",
      description: "Choose whether to continue at the start, end, or both sides of the stable window.",
      valueType: "string",
      defaultValue: "trailing",
      options: [
        { label: "After it stays stable", value: "trailing" },
        { label: "Immediately, then wait", value: "leading" },
        { label: "Both immediate and stable", value: "both" }
      ]
    }
  ],
  icon: "activity",
  execute: (context) => emptyResult({ stable: Boolean(context.inputs.signal), windowMs: durationMs(context.parameters.windowMs, 250), edge: context.parameters.edge ?? "trailing" })
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/timing/retry.js
var retryNode = defineBuiltinNode({
  id: "builtin.timing.retry",
  label: "Retry",
  description: "Retry a branch with bounded attempts and delay.",
  class: "timing",
  scope: "both",
  inputs: [{ id: "in", label: "In", valueType: "any" }],
  outputs: [
    { id: "success", label: "Success", valueType: "any" },
    { id: "failed", label: "Failed", valueType: "any" }
  ],
  parameters: [
    { id: "attempts", label: "Maximum tries", description: "How many times this branch may be attempted.", valueType: "number", defaultValue: 3 },
    { id: "delayMs", label: "Wait between tries", description: "Base delay in milliseconds before another attempt.", valueType: "number", defaultValue: 500 },
    {
      id: "backoff",
      label: "Delay pattern",
      description: "How the wait time changes after repeated failures.",
      valueType: "string",
      defaultValue: "fixed",
      options: [
        { label: "Same wait every time", value: "fixed" },
        { label: "Increase steadily", value: "linear" },
        { label: "Increase quickly", value: "exponential" }
      ]
    },
    { id: "jitterMs", label: "Random extra wait", description: "Maximum random milliseconds added or subtracted from each delay.", valueType: "number", defaultValue: 0 }
  ],
  icon: "refresh-cw",
  execute: (context) => emptyResult({ success: context.inputs.in ?? null, attempts: durationMs(context.parameters.attempts, 3), delayMs: durationMs(context.parameters.delayMs, 500), backoff: context.parameters.backoff ?? "fixed", jitterMs: durationMs(context.parameters.jitterMs, 0) })
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/timing/timeout.js
var timeoutNode = defineBuiltinNode({
  id: "builtin.timing.timeout",
  label: "Timeout",
  description: "Fail or route when a branch takes too long.",
  class: "timing",
  scope: "both",
  inputs: [{ id: "in", label: "In", valueType: "any" }],
  outputs: [
    { id: "success", label: "Success", valueType: "any" },
    { id: "timeout", label: "Timeout", valueType: "any" }
  ],
  parameters: [
    { id: "timeoutMs", label: "Give up after milliseconds", description: "Maximum time this branch may run before taking the timeout path.", valueType: "number", defaultValue: 5e3 },
    { id: "timeoutRoute", label: "If time runs out", description: "Usually timeout. Success is available when waiting too long is acceptable.", valueType: "string", defaultValue: "timeout", options: [{ label: "Go to Timeout", value: "timeout" }, { label: "Continue as Success", value: "success" }] },
    { id: "cancelOnTimeout", label: "Stop branch when time runs out", description: "Ask the runtime to cancel any still-running work in this branch.", valueType: "boolean", defaultValue: true }
  ],
  icon: "clock-alert",
  execute: (context) => emptyResult({ success: context.inputs.in ?? null, timeoutMs: durationMs(context.parameters.timeoutMs, 5e3), timeoutRoute: context.parameters.timeoutRoute ?? "timeout", cancelOnTimeout: context.parameters.cancelOnTimeout !== false })
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/timing/wait.js
var waitNode = defineBuiltinNode({
  id: "builtin.timing.wait",
  label: "Wait",
  description: "Pause execution for a fixed duration.",
  class: "timing",
  scope: "both",
  inputs: [{ id: "in", label: "In", valueType: "any" }],
  outputs: [{ id: "data", label: "Data", valueType: "any" }],
  parameters: [
    { id: "duration", label: "Wait amount", description: "How long this node should pause before continuing.", valueType: "number", defaultValue: 1e3 },
    {
      id: "unit",
      label: "Time unit",
      description: "Unit used for the wait amount.",
      valueType: "string",
      defaultValue: "milliseconds",
      options: [
        { label: "Milliseconds", value: "milliseconds" },
        { label: "Seconds", value: "seconds" },
        { label: "Minutes", value: "minutes" }
      ]
    },
    { id: "jitterMs", label: "Random extra wait", description: "Maximum random milliseconds added or subtracted from the wait.", valueType: "number", defaultValue: 0 }
  ],
  icon: "timer",
  execute: (context) => {
    const base = durationFromUnit(context.parameters.duration, context.parameters.unit, 1e3);
    const jitter = Math.max(0, Number(context.parameters.jitterMs ?? 0));
    const random = context.random ? context.random() : 0.5;
    return { status: "waiting", route: "success", outputs: { data: context.inputs.in ?? null, durationMs: Math.max(0, Math.round(base + (random * 2 - 1) * jitter)) } };
  }
});

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/timing/index.js
var timingNodes = [waitNode, timeoutNode, retryNode, debounceNode];

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/registry.js
var automationNodeClassGroups = [
  { id: "control-flow", label: "Control Flow", description: "Graph routing, branching, joining, and lifecycle nodes." },
  { id: "policy", label: "Policy", description: "Task policy action, expectation, and recovery nodes." },
  { id: "routine", label: "Routine", description: "Routine orchestration nodes that call tasks or subroutines." },
  { id: "logic", label: "Logic", description: "Boolean and comparison nodes." },
  { id: "math", label: "Math", description: "Numeric transform nodes." },
  { id: "random", label: "Random", description: "Random number, choice, and jitter nodes." },
  { id: "data", label: "Data", description: "Variable, constant, object, and list transform nodes." },
  { id: "database", label: "Database", description: "Database request nodes delegated to host adapters." },
  { id: "timing", label: "Timing", description: "Wait, timeout, retry, and debounce nodes." },
  { id: "runtime", label: "Runtime", description: "Future runtime/debug-specific nodes." },
  { id: "custom", label: "Custom", description: "Host-added node definitions loaded from .fluxiq." }
];
var builtinAutomationNodeDefinitions = [
  ...controlFlowNodes,
  ...policyNodes,
  ...routineNodes,
  ...logicNodes,
  ...mathNodes,
  ...randomNodes,
  ...dataNodes,
  ...databaseNodes,
  ...timingNodes
];
var automationNodeClasses = automationNodeClassGroups.map((group) => group.id);

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/canonical-registry.js
var canonicalBuiltinAutomationNodeDefinitions = builtinAutomationNodeDefinitions.map(adaptBuiltinAutomationNodeDefinition);

// ../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/nodes/layout.js
var automationStudioSourceNodeRoot = "packages/fluxiq/src/programs/automation-studio/nodes";
var automationStudioBuiltinNodeRoots = automationNodeClasses.filter((nodeClass) => nodeClass !== "custom" && nodeClass !== "runtime").map((nodeClass) => `${automationStudioSourceNodeRoot}/${nodeClass}`);
var automationStudioCustomNodeRoot = ".fluxiq/data/programs/automation-studio/nodes/custom";
var automationStudioCustomNodeFolders = automationNodeClasses.map((nodeClass) => `${automationStudioCustomNodeRoot}/${nodeClass}`);

// ../../domain/src/output-nodes/extract-list/issues.ts
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

// ../../domain/src/output-nodes/extract-list/parameter-contract.ts
function webAutomationExtractListParameterContract(input) {
  return input.parameterId === "extractList" ? webAutomationExtractListIssues(input.value) : [];
}

// ../../domain/src/output-nodes/extract-list/parameters.ts
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

// ../../domain/src/output-nodes/definitions.ts
var controlInput2 = { id: "in", label: "In", valueType: "signal", role: "control" };
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
    inputs: [controlInput2],
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
      ...recordsPath ? { recordsPath } : {}
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

// ../../domain/src/output-nodes/parameter-contracts.ts
var webAutomationOutputNodeParameterContracts = {
  [webAutomationOutputNodeId("web.dom.extract_list")]: webAutomationExtractListParameterContract
};

// ../../domain/src/io/input-model.ts
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

// ../../domain/src/runtime/capabilities.ts
var WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID = "web.structure.detection";
var webAutomationRuntimeCapabilities = [
  {
    id: "web.actions",
    label: "Web actions",
    kind: "action",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    actionTypes: WEB_AUTOMATION_ACTION_TYPES,
    outputIds: WEB_AUTOMATION_ACTION_TYPES
  },
  {
    id: "web.snapshots",
    label: "Web snapshots",
    kind: "snapshot",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    inputIds: [WEB_AUTOMATION_INPUT_IDS.recordingEvidence]
  },
  {
    id: "web.state",
    label: "Web state",
    kind: "state",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    inputIds: [WEB_AUTOMATION_INPUT_IDS.browserState, WEB_AUTOMATION_INPUT_IDS.recordingEvidence]
  },
  {
    id: "web.flow-runtime",
    label: "Web flow runtime",
    kind: "flow",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    metadata: { executionHost: "fluxiq-core", actionTransport: "extension" }
  }
];
var webAutomationGatewayCapabilities = [
  {
    id: "web.context.state",
    label: "Web context state",
    kind: "state",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    inputIds: [WEB_AUTOMATION_INPUT_IDS.browserState],
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, inputIds: [WEB_AUTOMATION_INPUT_IDS.browserState] }
  },
  {
    id: "web.structured.snapshot",
    label: "Structured web snapshots",
    kind: "snapshot",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    inputIds: [WEB_AUTOMATION_INPUT_IDS.recordingEvidence],
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, inputIds: [WEB_AUTOMATION_INPUT_IDS.recordingEvidence] }
  },
  {
    // `web.dom.capture_snapshot` answers `detectStructure` with the repeating
    // structure it found (`extraction/structure-detection.ts`). A flag on an
    // existing observe-only action rather than an action of its own, so it
    // lists no action type: nothing new is executable. The authoring evidence
    // runtime refuses its detection tool for a client that does not declare it.
    id: WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID,
    label: "Repeating-structure detection",
    kind: "snapshot",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, actionType: "web.dom.capture_snapshot", parameter: "detectStructure" }
  },
  {
    id: "web.recording.events",
    label: "Web recording events",
    kind: "recording",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID }
  },
  {
    id: "web.actions",
    label: "Web actions",
    kind: "action",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    actionTypes: WEB_AUTOMATION_ACTION_TYPES,
    outputIds: WEB_AUTOMATION_ACTION_TYPES,
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, outputIds: WEB_AUTOMATION_ACTION_TYPES }
  }
];

// ../../domain/src/runtime/failure/codes.ts
var WEB_AUTOMATION_FAILURE_CODES = Object.freeze({
  /** The target was found but refused the action: disabled, hidden, or covered by another element. */
  ACTION_REJECTED: "web.action.rejected",
  /** No element matched the action's target with enough confidence. */
  TARGET_NOT_FOUND: "web.target.not_found",
  /** Several elements matched the action's target and none could be preferred. */
  TARGET_AMBIGUOUS: "web.target.ambiguous",
  /** The action ran and its post-condition did not hold (decision D4). */
  OUTPUT_NOT_OBSERVED: "web.validation.output_not_observed",
  /** An authored `web.dom.assert` condition did not hold. */
  STATE_MISMATCH: "web.validation.state_mismatch",
  /** The browser landed somewhere other than the requested URL, or never left where it was. */
  NAVIGATION_UNEXPECTED: "web.navigation.unexpected",
  /**
   * The document was replaced, or routed away, while the action was running.
   * Produced by `apps/extension/src/content/actions/page-identity.ts`, which
   * remembers the page an action started on and supersedes the verb's own code
   * when it finished somewhere else.
   */
  PAGE_CHANGED: "web.page.changed",
  /** A wait, or an action, ran out of time. */
  TIMEOUT: "web.action.timeout",
  /** The host wants a sign-in before the action can continue. */
  AUTH_REQUIRED: "web.auth.required",
  /**
   * A person must act before the run can continue -- Core's category, stated no
   * more narrowly here than Core states it. Two producers, and they are not the
   * same shape of "act": `content/action-runtime/results.ts` reports it when a
   * modal dialog is standing over the page and the target is behind it, and
   * `runtime/adapter.ts` when no single paired client could be selected, which
   * only the operator can fix. The narrower gloss this carried before -- "a
   * captcha, or a native dialog waiting for an answer" -- described neither,
   * and reading it as the definition made both look wrong.
   */
  USER_INTERVENTION_REQUIRED: "web.intervention.required",
  /** The client does not implement the requested action type at all. */
  UNSUPPORTED_TYPE: "web.action.unsupported_type",
  /** The verb is registered but not built yet, so a Flow that reaches one fails honestly. */
  NOT_IMPLEMENTED: "web.action.not_implemented",
  /**
   * A field the action requires arrived in a shape that cannot be read, so the
   * command was refused before dispatch. `client/gateway-mapping.ts` decides it
   * from what `client/gateway-action-parameters.ts` refused. The Flow's node is
   * authored wrong and only an edit fixes it: a structural fault in the Flow,
   * not a capability the client lacks.
   */
  INVALID_PARAMETER: "web.action.invalid_parameter",
  /** The action ran and failed for a reason no other code names. */
  ACTION_FAILED: "web.action.failed",
  /** Nothing said why the action failed. */
  UNKNOWN: "web.action.unknown"
});
var WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS = Object.freeze({
  "web.action.rejected": { category: "blocked_by_capability_or_policy", retryable: false, stage: "execution" },
  "web.target.not_found": { category: "target_not_found", retryable: true, stage: "target_resolution" },
  "web.target.ambiguous": { category: "target_ambiguous", retryable: false, stage: "target_resolution" },
  "web.validation.output_not_observed": { category: "output_not_observed", retryable: true, stage: "verification" },
  "web.validation.state_mismatch": { category: "unexpected_state", retryable: false, stage: "verification" },
  "web.navigation.unexpected": { category: "navigation_unexpected", retryable: false, stage: "confirmation" },
  "web.page.changed": { category: "page_changed", retryable: true, stage: "execution" },
  "web.action.timeout": { category: "timeout", retryable: true, stage: "execution" },
  "web.auth.required": { category: "auth_required", retryable: false, stage: "confirmation" },
  "web.intervention.required": { category: "user_intervention_required", retryable: false, stage: "execution" },
  "web.action.unsupported_type": { category: "blocked_by_capability_or_policy", retryable: false, stage: "dispatch" },
  "web.action.not_implemented": { category: "blocked_by_capability_or_policy", retryable: false, stage: "dispatch" },
  "web.action.invalid_parameter": { category: "graph_validation_or_unknown_node", retryable: false, stage: "dispatch" },
  "web.action.failed": { category: "action_failed", retryable: true, stage: "execution" },
  "web.action.unknown": { category: "ambiguous_or_unknown", retryable: false, stage: "execution" }
});
function webAutomationFailureRecord(code, comparison = {}) {
  const definition = WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS[code];
  const expected = boundedText(comparison.expected);
  const actual = boundedText(comparison.actual);
  const evidenceDigest = comparison.evidenceDigest !== void 0 && EVIDENCE_DIGEST_PATTERN.test(comparison.evidenceDigest) ? comparison.evidenceDigest : void 0;
  return {
    category: definition.category,
    code,
    retryable: definition.retryable,
    stage: definition.stage,
    ...expected === void 0 ? {} : { expected },
    ...actual === void 0 ? {} : { actual },
    ...evidenceDigest === void 0 ? {} : { evidenceDigest }
  };
}
var EVIDENCE_DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
function boundedText(value) {
  if (value === void 0) return void 0;
  const collapsed = value.replace(/\s+/gu, " ").trim();
  if (collapsed.length === 0) return void 0;
  if (collapsed.length <= WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH) return collapsed;
  return `${collapsed.slice(0, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH - 1)}\u2026`;
}

// ../../domain/src/recording/web-state/evidence/project.ts
var COLLECTION = { elementKind: "collection", comparable: false };
var LIVE_COLLECTION = { ...COLLECTION, volatility: "rapid" };
var SETTLED_COLLECTION = { ...COLLECTION, volatility: "slow" };

// ../../domain/src/client/gateway-mapping.ts
var UNSUPPORTED_ACTION_TYPE_FAILURE = Object.freeze(webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE));
var CANONICAL_ACTION_TYPES = new Set(WEB_AUTOMATION_ACTION_TYPES);
var LEGACY_ACTION_TYPE_ALIASES = new Map(
  Object.entries(WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER).map(([canonical, legacy]) => [legacy, canonical])
);

// src/popup/extraction/confirm-payload.ts
function extractionConfirmPayload(draft) {
  const taken = /* @__PURE__ */ new Set();
  const fields = draft.fields.map((field) => {
    const key = webAutomationExtractionFieldKey(field.label, taken);
    taken.add(key);
    return confirmField(key, field);
  });
  return {
    label: draft.label,
    item: draft.item,
    fields,
    paginate: draft.paginate ? draft.pagination : void 0,
    itemCount: draft.itemCount
  };
}
function confirmField(key, field) {
  return {
    key,
    label: field.label,
    kind: field.kind,
    selector: field.selector,
    attribute: field.kind === "attribute" ? field.attribute : void 0,
    header: field.kind === "column" ? field.header : void 0,
    required: field.required,
    handling: field.handling
  };
}

// src/popup/extraction/view-model.ts
function extractionDraftFromProposal(proposal, label) {
  return {
    label,
    item: proposal.item,
    itemCount: proposal.itemCount,
    fields: proposal.fields.map(fieldRow),
    pagination: proposal.pagination,
    paginate: false
  };
}
function renameExtractionField(draft, sourceKey, label) {
  return mapField(draft, sourceKey, (field) => ({ ...field, label }));
}
function removeExtractionField(draft, sourceKey) {
  return { ...draft, fields: draft.fields.filter((field) => field.sourceKey !== sourceKey) };
}
function setExtractionFieldHandling(draft, sourceKey, handling) {
  return mapField(draft, sourceKey, (field) => ({ ...field, handling, stale: field.stale || handling === "exclude" }));
}
function setExtractionFieldKind(draft, sourceKey, kind) {
  return mapField(draft, sourceKey, (field) => field.kind === kind ? field : { ...field, kind, stale: true });
}
function setExtractionPaginate(draft, paginate) {
  return { ...draft, paginate };
}
function extractionFieldKindOptions(field) {
  const kinds = ["text", "link", "value"];
  if (field.attribute !== void 0) kinds.push("attribute");
  if (field.header !== void 0) kinds.push("column");
  return kinds.includes(field.kind) ? kinds : [...kinds, field.kind];
}
function fieldRow(field) {
  const sensitive = field.spec.handling === "exclude";
  return {
    sourceKey: field.key,
    label: field.label,
    kind: field.spec.kind,
    selector: field.spec.selector,
    attribute: field.spec.attribute,
    header: field.spec.header,
    required: field.spec.required,
    handling: sensitive ? "exclude" : "include",
    coverage: field.coverage,
    sensitive,
    stale: sensitive
  };
}
function mapField(draft, sourceKey, edit) {
  return { ...draft, fields: draft.fields.map((field) => field.sourceKey === sourceKey ? edit(field) : field) };
}

// src/popup/extraction/field-row.ts
var EXCLUDE_HINT = "Exclude a column of private information -- a password, a card number, personal details you don't want collected. An excluded column is never read from the page, so it is in no dataset, no preview, no export and no saved run.";
var SENSITIVE_HINT = "FluxIQ pre-selected Exclude because this looks like a password or another sensitive field. You can include it.";
function extractionFieldRowElement(field, edits) {
  const row = document.createElement("div");
  row.className = "extraction-field";
  row.dataset.field = field.sourceKey;
  row.append(nameRow(field, edits), metaRow(field, edits), handlingRow(field, edits));
  if (field.sensitive) {
    const reason = document.createElement("p");
    reason.className = "extraction-field-reason";
    reason.textContent = SENSITIVE_HINT;
    row.append(reason);
  }
  return row;
}
function nameRow(field, edits) {
  const wrap = document.createElement("div");
  wrap.className = "extraction-field-name";
  const name = document.createElement("input");
  name.type = "text";
  name.className = "extraction-field-label";
  name.spellcheck = false;
  name.autocomplete = "off";
  name.value = field.label;
  name.setAttribute("aria-label", "Column name");
  name.addEventListener("change", () => edits.rename(field.sourceKey, name.value.trim() || field.label));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "small-button extraction-field-remove";
  remove.textContent = "Remove";
  remove.title = "Remove this column from the extraction";
  remove.addEventListener("click", () => edits.remove(field.sourceKey));
  wrap.append(name, remove);
  return wrap;
}
function metaRow(field, edits) {
  const wrap = document.createElement("div");
  wrap.className = "extraction-field-meta";
  const kind = document.createElement("select");
  kind.className = "extraction-field-kind";
  kind.setAttribute("aria-label", "What this column reads");
  for (const option of extractionFieldKindOptions(field)) {
    const choice = document.createElement("option");
    choice.value = option;
    choice.textContent = kindLabel(field, option);
    choice.selected = option === field.kind;
    kind.append(choice);
  }
  kind.addEventListener("change", () => edits.changeKind(field.sourceKey, kind.value));
  const coverage = document.createElement("span");
  coverage.className = "extraction-field-coverage";
  coverage.textContent = coverageLabel(field.coverage);
  wrap.append(kind, coverage);
  return wrap;
}
function handlingRow(field, edits) {
  const wrap = document.createElement("div");
  wrap.className = "extraction-field-handling";
  wrap.setAttribute("role", "radiogroup");
  wrap.setAttribute("aria-label", `How to handle ${field.label}`);
  wrap.append(
    handlingChoice(field, "include", "Include", edits),
    handlingChoice(field, "exclude", "Exclude", edits),
    excludeHint()
  );
  return wrap;
}
function handlingChoice(field, handling, text2, edits) {
  const label = document.createElement("label");
  const choice = document.createElement("input");
  choice.type = "radio";
  choice.name = `extraction-handling-${field.sourceKey}`;
  choice.value = handling;
  choice.checked = field.handling === handling;
  choice.addEventListener("change", () => {
    if (choice.checked) edits.changeHandling(field.sourceKey, handling);
  });
  const caption = document.createElement("span");
  caption.textContent = text2;
  label.append(choice, caption);
  return label;
}
function excludeHint() {
  const mark = document.createElement("span");
  mark.className = "info-hint";
  mark.tabIndex = 0;
  mark.title = EXCLUDE_HINT;
  mark.setAttribute("role", "note");
  mark.setAttribute("aria-label", EXCLUDE_HINT);
  mark.textContent = "i";
  return mark;
}
function kindLabel(field, kind) {
  switch (kind) {
    case "text":
      return "Its text";
    case "link":
      return "Where its link goes";
    case "value":
      return "What is typed in it";
    case "attribute":
      return field.attribute === void 0 ? "An attribute" : `Its ${field.attribute} attribute`;
    case "column":
      return field.header === void 0 ? "A table column" : `The ${field.header} column`;
  }
}
function coverageLabel(coverage) {
  const share = Math.round(Math.min(Math.max(coverage, 0), 1) * 100);
  return share >= 100 ? "in every item" : `in ${share}% of items`;
}

// src/popup/extraction/panel-elements.ts
function extractionPanelElements() {
  return {
    openButton: element("extractDataButton"),
    panel: element("extractionPanel"),
    status: element("extractionStatus"),
    notice: element("extractionNotice"),
    body: element("extractionBody"),
    label: element("extractionLabel"),
    summary: element("extractionSummary"),
    fields: element("extractionFields"),
    paginateRow: element("extractionPaginateRow"),
    paginate: element("extractionPaginate"),
    paginateLabel: element("extractionPaginateLabel"),
    previewHead: element("extractionPreviewHead"),
    previewBody: element("extractionPreviewBody"),
    previewNote: element("extractionPreviewNote"),
    confirmButton: element("extractionConfirmButton"),
    cancelButton: element("extractionCancelButton"),
    closeButton: element("extractionCloseButton")
  };
}
function element(id) {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing extraction panel element: ${id}`);
  return found;
}

// src/popup/extraction/preview.ts
function extractionPreviewColumns(draft) {
  return draft.fields.filter((field) => field.handling === "include" && !field.stale);
}
function extractionPreviewSelection(draft) {
  const shown = new Set(extractionPreviewColumns(draft).map((field) => field.sourceKey));
  return draft.fields.map((field) => ({ key: field.sourceKey, handling: shown.has(field.sourceKey) ? "include" : "exclude" }));
}
function retainExtractionPreview(rows, draft) {
  const keys = extractionPreviewColumns(draft).map((field) => field.sourceKey);
  return rows.map((row) => {
    const kept = {};
    for (const key of keys) if (key in row) kept[key] = row[key] ?? null;
    return kept;
  });
}

// src/popup/extraction/preview-table.ts
var VISIBLE_ROWS = 5;
function renderExtractionPreview(head, body, columns, rows) {
  head.replaceChildren(...columns.map((column) => headerCell(column.label)));
  const drawn = rows.slice(0, VISIBLE_ROWS);
  body.replaceChildren(...drawn.map((row) => bodyRow(columns, row)));
  return drawn.length;
}
function headerCell(label) {
  const cell = document.createElement("th");
  cell.scope = "col";
  cell.textContent = label;
  return cell;
}
function bodyRow(columns, row) {
  const line = document.createElement("tr");
  for (const column of columns) {
    const cell = document.createElement("td");
    const value = row[column.sourceKey] ?? null;
    if (value === null || value === "") {
      cell.classList.add("extraction-preview-empty");
      cell.textContent = "--";
    } else {
      cell.textContent = value;
    }
    line.append(cell);
  }
  return line;
}

// src/popup/extraction/panel.ts
var POLL_MS = 600;
var DEFAULT_LABEL = "Extracted data";
var PICK_PROMPT = "Click one example item on the page -- a product, a row, a card. FluxIQ finds the rest.";
var GENERIC_REFUSAL = "FluxIQ could not read a repeating list from that item.";
var RECORDED_WITHOUT_COUNT = "The extraction is recorded.";
var REFUSALS = {
  target_not_found: "That element is no longer on the page. Try picking another one.",
  no_repeating_run: "That item is not part of a repeating list. Pick an item inside a list or a table row.",
  value_form_unsupported: "FluxIQ cannot record a single value yet. Pick an item in a repeating list."
};
function mountExtractionPanel() {
  const els = extractionPanelElements();
  let draft;
  let rows = [];
  let polling;
  let busy = false;
  function stopPolling() {
    if (polling !== void 0) clearInterval(polling);
    polling = void 0;
  }
  function startPolling() {
    if (polling === void 0) polling = setInterval(() => void refresh2(), POLL_MS);
  }
  function close() {
    stopPolling();
    draft = void 0;
    rows = [];
    els.panel.hidden = true;
    els.notice.hidden = true;
    render();
  }
  function captured(outcome) {
    stopPolling();
    draft = void 0;
    rows = [];
    els.notice.hidden = true;
    els.notice.textContent = "";
    els.status.textContent = outcome === void 0 ? RECORDED_WITHOUT_COUNT : capturedSentence(outcome);
    render();
  }
  function fail(error) {
    els.notice.hidden = false;
    els.notice.textContent = error instanceof Error ? error.message : "The extraction panel hit an unexpected problem.";
  }
  function applySession(session) {
    if (!session) {
      if (els.panel.hidden) return;
      close();
      return;
    }
    if (session.refused !== void 0) {
      els.notice.hidden = false;
      els.notice.textContent = refusalMessage(session.refused);
    } else if (!els.notice.hidden) {
      els.notice.hidden = true;
      els.notice.textContent = "";
    }
    if (session.state === "recorded") {
      close();
      return;
    }
    if (session.state !== "picked" || !session.proposal) {
      els.status.textContent = PICK_PROMPT;
      startPolling();
      render();
      return;
    }
    stopPolling();
    if (!draft) {
      draft = extractionDraftFromProposal(session.proposal, DEFAULT_LABEL);
      rows = retainExtractionPreview(session.preview ?? [], draft);
    }
    els.status.textContent = "Check the columns, then confirm.";
    render();
  }
  async function refresh2() {
    try {
      applySession(await readExtractionSession());
    } catch (error) {
      stopPolling();
      fail(error);
    }
  }
  function edit(next) {
    const before = shownColumnsKey(draft);
    draft = next;
    rows = retainExtractionPreview(rows, next);
    render();
    if (shownColumnsKey(next) !== before) void rereadPreview(next);
  }
  async function rereadPreview(edited) {
    const key = shownColumnsKey(edited);
    try {
      const session = await readExtractionSession(extractionPreviewSelection(edited));
      if (!draft || shownColumnsKey(draft) !== key) return;
      rows = retainExtractionPreview(session?.preview ?? [], draft);
      render();
    } catch (error) {
      fail(error);
    }
  }
  function render() {
    els.body.hidden = !draft;
    els.confirmButton.disabled = busy || !draft || draft.fields.length === 0;
    els.cancelButton.disabled = busy;
    if (!draft) return;
    if (els.label.value !== draft.label) els.label.value = draft.label;
    els.summary.textContent = summaryLabel(draft);
    els.fields.replaceChildren(...draft.fields.map((field) => extractionFieldRowElement(field, {
      rename: (key, label) => edit(renameExtractionField(requireDraft(), key, label)),
      changeKind: (key, kind) => edit(setExtractionFieldKind(requireDraft(), key, kind)),
      changeHandling: (key, handling) => edit(setExtractionFieldHandling(requireDraft(), key, handling)),
      remove: (key) => edit(removeExtractionField(requireDraft(), key))
    })));
    renderPagination(els, draft);
    renderPreview(els, draft, rows);
  }
  function requireDraft() {
    if (!draft) throw new Error("The extraction panel has no proposal to edit.");
    return draft;
  }
  async function run(work) {
    if (busy) return;
    busy = true;
    render();
    try {
      await work();
    } catch (error) {
      fail(error);
    } finally {
      busy = false;
      render();
    }
  }
  els.openButton.addEventListener("click", () => void run(async () => {
    els.panel.hidden = false;
    els.notice.hidden = true;
    els.status.textContent = PICK_PROMPT;
    draft = void 0;
    rows = [];
    await startExtractionPick();
    startPolling();
  }));
  els.label.addEventListener("input", () => {
    if (draft) draft = { ...draft, label: els.label.value };
  });
  els.paginate.addEventListener("change", () => {
    if (draft) edit(setExtractionPaginate(draft, els.paginate.checked));
  });
  els.confirmButton.addEventListener("click", () => void run(async () => {
    captured(await confirmExtraction(extractionConfirmPayload(requireDraft())));
  }));
  for (const button of [els.cancelButton, els.closeButton]) {
    button.addEventListener("click", () => void run(async () => {
      close();
      await cancelExtraction();
    }));
  }
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || els.panel.hidden) return;
    void run(async () => {
      close();
      await cancelExtraction();
    });
  });
  void refresh2().then(() => {
    if (draft || polling !== void 0) els.panel.hidden = false;
  });
  render();
  return {
    setAvailable(available, reason) {
      els.openButton.disabled = !available;
      els.openButton.title = available ? "Pick an example item and FluxIQ records the whole list" : reason ?? "Start recording first.";
    }
  };
}
function capturedSentence(outcome) {
  const records = outcome.recordCount === 1 ? "1 record" : `${outcome.recordCount} records`;
  const pages = outcome.pagesRead > 1 ? ` from ${outcome.pagesRead} pages` : "";
  const stopped = outcome.truncated ? " It stopped at FluxIQ's limit, so the page may hold more." : "";
  return outcome.recordCount === 0 ? `Recorded "${outcome.label}", but the page returned no records. Check the columns and pick again if that is wrong.` : `Captured ${records}${pages} into "${outcome.label}".${stopped}`;
}
function shownColumnsKey(draft) {
  return draft === void 0 ? "" : extractionPreviewColumns(draft).map((field) => field.sourceKey).join(",");
}
function renderPagination(els, draft) {
  els.paginateRow.hidden = draft.pagination === void 0;
  if (draft.pagination === void 0) return;
  els.paginate.checked = draft.paginate;
  els.paginateLabel.textContent = paginationLabel(draft.pagination);
}
function renderPreview(els, draft, rows) {
  const columns = extractionPreviewColumns(draft);
  const shown = renderExtractionPreview(els.previewHead, els.previewBody, columns, rows);
  const hidden = draft.fields.length - columns.length;
  const sample = shown === 0 ? "No preview was read for these columns." : `Showing ${shown} of ${draft.itemCount} ${draft.itemCount === 1 ? "item" : "items"}.`;
  const withheld = hidden === 0 ? "" : ` ${hidden} ${hidden === 1 ? "column is" : "columns are"} not previewed: an excluded column is never read, and one changed since the preview was taken is re-read when the extraction runs.`;
  els.previewNote.textContent = `${sample}${withheld}`;
}
function summaryLabel(draft) {
  const excluded = draft.fields.filter((field) => field.handling === "exclude").length;
  const kept = draft.fields.length - excluded;
  const items = `${draft.itemCount} ${draft.itemCount === 1 ? "item" : "items"} found`;
  const columns = `${kept} ${kept === 1 ? "column" : "columns"}`;
  return excluded === 0 ? `${items}, ${columns}.` : `${items}, ${columns}, ${excluded} excluded.`;
}
function paginationLabel(pagination) {
  switch (pagination.mode) {
    case "loadMore":
      return `Read every page, pressing the load-more control up to ${pagination.maxPages} times`;
    case "scroll":
      return `Read every page, scrolling up to ${pagination.maxScrolls} times`;
    case "numbered":
      return `Read every page, following the numbered page links, up to ${pagination.maxPages} pages`;
    default:
      return `Read every page, following the next-page link, up to ${pagination.maxPages} pages`;
  }
}
function refusalMessage(refused) {
  return refused in REFUSALS ? REFUSALS[refused] : GENERIC_REFUSAL;
}

// src/popup/index.ts
var eventPageSize = 25;
var recordingsPageSize = 10;
var shell = element2("shell");
var gatewayUrl = element2("gatewayUrl");
var coreApiUrl = element2("coreApiUrl");
var autoReconnect = element2("autoReconnect");
var captureMutations = element2("captureMutations");
var captureInputValues = element2("captureInputValues");
var captureSnapshots = element2("captureSnapshots");
var connectButton = element2("connectButton");
var disconnectButton = element2("disconnectButton");
var resetSessionButton = element2("resetSessionButton");
var recordButton = element2("recordButton");
var settingsButton = element2("settingsButton");
var closeSettingsButton = element2("closeSettingsButton");
var recorderTab = element2("recorderTab");
var eventsTab = element2("eventsTab");
var recordingsTab = element2("recordingsTab");
var recorderView = element2("recorderView");
var eventsView = element2("eventsView");
var recordingsView = element2("recordingsView");
var connectionLabel = element2("connectionLabel");
var activeDomain = element2("activeDomain");
var statusDot = element2("statusDot");
var clientId = element2("clientId");
var sessionId = element2("sessionId");
var activeTab = element2("activeTab");
var queueSize = element2("queueSize");
var eventCount = element2("eventCount");
var recordingTimer = element2("recordingTimer");
var recordLabel = element2("recordLabel");
var errorText = element2("errorText");
var runtimeCard = element2("runtimeCard");
var runtimeStateDot = element2("runtimeStateDot");
var runtimeState = element2("runtimeState");
var runtimeCommand = element2("runtimeCommand");
var runtimeTarget = element2("runtimeTarget");
var runtimeTab = element2("runtimeTab");
var runtimeMessage = element2("runtimeMessage");
var unsupportedCard = element2("unsupportedCard");
var unsupportedReason = element2("unsupportedReason");
var activityFeed = element2("activityFeed");
var emptyActivity = element2("emptyActivity");
var lastActivity = element2("lastActivity");
var eventPageLabel = element2("eventPageLabel");
var prevEventsButton = element2("prevEventsButton");
var nextEventsButton = element2("nextEventsButton");
var recordingsList = element2("recordingsList");
var emptyRecordings = element2("emptyRecordings");
var recordingsSource = element2("recordingsSource");
var recordingsPageLabel = element2("recordingsPageLabel");
var refreshRecordingsButton = element2("refreshRecordingsButton");
var prevRecordingsButton = element2("prevRecordingsButton");
var nextRecordingsButton = element2("nextRecordingsButton");
var settingsDrawer = element2("settingsDrawer");
var settingsBackdrop = element2("settingsBackdrop");
var pairingOverlay = element2("pairingOverlay");
var pairingReferenceCode = element2("pairingReferenceCode");
var overlayCancelButton = element2("overlayCancelButton");
var recordingLockOverlay = element2("recordingLockOverlay");
var recordingLockMessage = element2("recordingLockMessage");
var recordingLockDismissButton = element2("recordingLockDismissButton");
var currentStatus;
var currentView = "recorder";
var eventPage = 1;
var eventTotal = 0;
var recordingsPage = 1;
var recordingsTotal;
var timerHandle;
var settingsDraftDirty = false;
var extractionPanel = mountExtractionPanel();
void refresh();
startTimerLoop();
applyLayoutMode();
settingsButton.addEventListener("click", () => {
  setSettingsOpen(true);
});
closeSettingsButton.addEventListener("click", () => {
  setSettingsOpen(false);
});
settingsBackdrop.addEventListener("click", () => setSettingsOpen(false));
connectButton.addEventListener("click", () => {
  const settings = readSettingsFromForm();
  void sendCommand(RUNTIME_MESSAGES.connect, { settings }).then(() => {
    settingsDraftDirty = false;
  });
});
for (const control of [gatewayUrl, coreApiUrl, autoReconnect, captureMutations, captureInputValues, captureSnapshots]) {
  control.addEventListener("input", () => {
    settingsDraftDirty = true;
  });
  control.addEventListener("change", () => {
    settingsDraftDirty = true;
  });
}
disconnectButton.addEventListener("click", () => {
  void sendCommand(RUNTIME_MESSAGES.disconnect);
});
resetSessionButton.addEventListener("click", () => {
  void sendCommand(RUNTIME_MESSAGES.resetSession);
});
recordButton.addEventListener("click", () => {
  if (currentStatus?.recordingState === "recording") {
    void sendCommand(RUNTIME_MESSAGES.stopRecording);
  } else {
    eventPage = 1;
    void sendCommand(RUNTIME_MESSAGES.startRecording);
  }
});
overlayCancelButton.addEventListener("click", () => {
  void sendCommand(RUNTIME_MESSAGES.disconnect);
});
recordingLockDismissButton.addEventListener("click", () => {
  void sendCommand(RUNTIME_MESSAGES.dismissRecordingLock);
});
recorderTab.addEventListener("click", () => switchView("recorder"));
eventsTab.addEventListener("click", () => switchView("events"));
recordingsTab.addEventListener("click", () => switchView("recordings"));
for (const tab of [recorderTab, eventsTab, recordingsTab]) {
  tab.addEventListener("keydown", (event) => handleTabKeydown(event));
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settingsDrawer.hidden) setSettingsOpen(false);
});
prevEventsButton.addEventListener("click", () => {
  if (eventPage <= 1) return;
  eventPage -= 1;
  void refreshEventLog();
});
nextEventsButton.addEventListener("click", () => {
  if (eventPage * eventPageSize >= eventTotal) return;
  eventPage += 1;
  void refreshEventLog();
});
refreshRecordingsButton.addEventListener("click", () => {
  void refreshRecordings();
});
prevRecordingsButton.addEventListener("click", () => {
  if (recordingsPage <= 1) return;
  recordingsPage -= 1;
  void refreshRecordings();
});
nextRecordingsButton.addEventListener("click", () => {
  if (recordingsTotal !== void 0 && recordingsPage * recordingsPageSize >= recordingsTotal) return;
  recordingsPage += 1;
  void refreshRecordings();
});
chrome.runtime.onMessage.addListener((message) => {
  const typed = message;
  if (typed.type === RUNTIME_MESSAGES.statusChanged && typed.status) {
    const previousStartedAt = currentStatus?.recordingStartedAt;
    renderStatus(typed.status);
    if (typed.status.recordingStartedAt !== previousStartedAt) eventPage = 1;
    if (currentView === "events") void refreshEventLog();
  }
});
async function refresh() {
  const response = await runtimeSendMessage({ type: RUNTIME_MESSAGES.getStatus });
  if (response.ok) {
    renderStatus(response.status);
    await refreshEventLog();
  } else {
    renderError(response.error);
  }
}
async function sendCommand(type, payload = {}) {
  setBusy(true);
  try {
    const response = await runtimeSendMessage({ type, ...payload });
    if (response.ok) {
      renderStatus(response.status);
      await refreshEventLog();
    } else {
      renderError(response.error);
    }
  } catch (error) {
    renderError(error instanceof Error ? error.message : "Command failed.");
  } finally {
    setBusy(false);
    if (currentStatus) renderStatus(currentStatus);
  }
}
function renderStatus(status) {
  currentStatus = status;
  const defaults = defaultSettings();
  const settings = { ...defaults, ...status.settings };
  if (!settingsDraftDirty) {
    gatewayUrl.value = settings.gatewayUrl || status.gatewayUrl || defaults.gatewayUrl;
    coreApiUrl.value = settings.coreApiUrl || defaults.coreApiUrl;
    autoReconnect.checked = settings.autoReconnect;
    captureMutations.checked = settings.captureMutations;
    captureInputValues.checked = settings.captureInputValues;
    captureSnapshots.checked = settings.captureSnapshots;
  }
  clientId.textContent = status.clientId;
  sessionId.textContent = status.sessionId ?? "-";
  activeTab.textContent = status.activeTabUrl ?? (status.activeTabId === void 0 ? "-" : String(status.activeTabId));
  activeDomain.textContent = domainLabel(status.activeTabUrl);
  queueSize.textContent = String(status.queueSize);
  eventCount.textContent = String(status.eventCount);
  connectionLabel.textContent = status.connectionState.replace("_", " ");
  lastActivity.textContent = status.lastActivityAt ? relativeTime(status.lastActivityAt) : "Idle";
  statusDot.className = "dot";
  if (status.recordingState === "recording") statusDot.classList.add("recording");
  else if (status.connectionState === "connected") statusDot.classList.add("connected");
  else if (["connecting", "reconnecting", "pairing"].includes(status.connectionState)) statusDot.classList.add("connecting");
  const connected = status.connectionState === "connected";
  const recording = status.recordingState === "recording";
  const unsupported = Boolean(status.unsupportedPage);
  recordButton.classList.toggle("active", recording);
  recordLabel.textContent = recording ? "Stop recording" : "Start recording";
  recordButton.setAttribute("aria-label", recording ? "Stop recording" : "Start recording");
  recordButton.disabled = !connected || unsupported;
  extractionPanel.setAvailable(connected && recording && !unsupported, unsupported ? "This page cannot be recorded." : "Start recording first.");
  connectButton.disabled = status.connectionState === "connected" || status.connectionState === "connecting";
  disconnectButton.disabled = status.connectionState === "disconnected";
  unsupportedCard.hidden = !status.unsupportedPage;
  unsupportedReason.textContent = status.unsupportedPage?.reason ?? "";
  renderPairingOverlay(status);
  renderRecordingLockOverlay(status);
  renderRuntime(status);
  renderError(status.lastError);
  renderTimer();
}
function renderRuntime(status) {
  const runtime = status.runtime;
  const state = runtime?.state ?? "idle";
  runtimeCard.classList.toggle("running", state === "running");
  runtimeCard.classList.toggle("succeeded", state === "succeeded");
  runtimeCard.classList.toggle("failed", state === "failed");
  runtimeStateDot.className = `runtime-state-dot ${state}`;
  runtimeState.textContent = state === "idle" ? "Runtime idle" : state === "running" ? "Runtime running" : state === "succeeded" ? "Runtime succeeded" : "Runtime failed";
  runtimeCommand.textContent = runtime?.label ?? runtime?.actionType ?? "No command running";
  runtimeTarget.textContent = runtime?.target ?? runtime?.url ?? "-";
  runtimeTab.textContent = runtime?.tabId === void 0 ? "-" : `Tab ${runtime.tabId}`;
  runtimeMessage.textContent = runtime?.error ?? runtime?.message ?? (runtime?.startedAt ? relativeTime(runtime.startedAt) : "-");
}
async function refreshEventLog() {
  const response = await runtimeSendMessage({
    type: RUNTIME_MESSAGES.getRecordingLog,
    page: eventPage,
    pageSize: eventPageSize
  });
  if (!response.ok) {
    renderError(response.error);
    return;
  }
  renderActivities(response.log);
}
async function refreshRecordings() {
  recordingsSource.textContent = "Loading...";
  refreshRecordingsButton.disabled = true;
  try {
    const response = await runtimeSendMessage({
      type: RUNTIME_MESSAGES.listRecordings,
      page: recordingsPage,
      pageSize: recordingsPageSize
    });
    if (response.ok) {
      renderRecordings(response.recordings);
    } else {
      renderRecordingsError(response.error);
    }
  } catch (error) {
    renderRecordingsError(error instanceof Error ? error.message : "Could not load recordings.");
  } finally {
    refreshRecordingsButton.disabled = false;
  }
}
function renderActivities(log) {
  eventTotal = log.total;
  eventPage = log.page;
  activityFeed.replaceChildren();
  emptyActivity.hidden = log.items.length > 0;
  for (const activity of log.items) {
    const item = document.createElement("li");
    if (activity.tone) item.classList.add(activity.tone);
    const title = document.createElement("div");
    title.className = "activity-title";
    const label = document.createElement("span");
    label.textContent = activity.label;
    const time = document.createElement("span");
    time.textContent = relativeTime(activity.timestamp);
    title.append(label, time);
    item.append(title);
    if (activity.detail) {
      const detail = document.createElement("div");
      detail.className = "activity-detail";
      detail.textContent = activity.detail;
      item.append(detail);
    }
    activityFeed.append(item);
  }
  const totalPages = Math.max(1, Math.ceil(log.total / log.pageSize));
  eventPageLabel.textContent = `Page ${log.page} of ${totalPages}`;
  prevEventsButton.disabled = log.page <= 1;
  nextEventsButton.disabled = log.page >= totalPages;
}
function renderRecordings(page) {
  recordingsTotal = page.total;
  recordingsPage = page.page;
  recordingsSource.textContent = sourceHost(page.sourceUrl);
  recordingsList.replaceChildren();
  emptyRecordings.hidden = page.items.length > 0;
  for (const recording of page.items) recordingsList.append(recordingItem(recording));
  const totalPages = page.total === void 0 ? void 0 : Math.max(1, Math.ceil(page.total / page.pageSize));
  recordingsPageLabel.textContent = totalPages ? `Page ${page.page} of ${totalPages}` : `Page ${page.page}`;
  prevRecordingsButton.disabled = page.page <= 1;
  nextRecordingsButton.disabled = totalPages ? page.page >= totalPages : page.items.length < page.pageSize;
}
function renderRecordingsError(message) {
  recordingsTotal = 0;
  recordingsList.replaceChildren();
  emptyRecordings.hidden = false;
  emptyRecordings.textContent = message;
  recordingsSource.textContent = "Unavailable";
  recordingsPageLabel.textContent = `Page ${recordingsPage}`;
  prevRecordingsButton.disabled = recordingsPage <= 1;
  nextRecordingsButton.disabled = true;
}
function recordingItem(recording) {
  const item = document.createElement("li");
  const title = document.createElement("div");
  title.className = "recording-row-title";
  const name = document.createElement("span");
  name.textContent = recording.title;
  const status = document.createElement("span");
  status.className = "status-pill";
  status.textContent = recording.status ?? "saved";
  title.append(name, status);
  item.append(title);
  const meta = document.createElement("div");
  meta.className = "recording-meta";
  const count2 = recording.eventCount === void 0 ? "events unknown" : `${recording.eventCount} events`;
  const date = recording.startedAt ? relativeDate(recording.startedAt) : recording.updatedAt ? relativeDate(recording.updatedAt) : recording.id;
  meta.textContent = `${count2} - ${date}`;
  item.append(meta);
  return item;
}
function switchView(view) {
  currentView = view;
  applyLayoutMode();
  if (view === "events") void refreshEventLog();
  if (view === "recordings") void refreshRecordings();
}
function applyLayoutMode() {
  recorderView.hidden = currentView !== "recorder";
  eventsView.hidden = currentView !== "events";
  recordingsView.hidden = currentView !== "recordings";
  for (const button of [recorderTab, eventsTab, recordingsTab]) {
    const selected = button.dataset.view === currentView;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
}
function handleTabKeydown(event) {
  const tabs = [recorderTab, eventsTab, recordingsTab];
  const currentIndex = tabs.indexOf(event.currentTarget);
  const nextIndex = event.key === "ArrowRight" ? (currentIndex + 1) % tabs.length : event.key === "ArrowLeft" ? (currentIndex - 1 + tabs.length) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : void 0;
  if (nextIndex === void 0) return;
  event.preventDefault();
  const nextTab = tabs[nextIndex];
  nextTab.focus();
  switchView(nextTab.dataset.view);
}
function setSettingsOpen(open) {
  settingsDrawer.hidden = !open;
  settingsBackdrop.hidden = !open;
  if (open) closeSettingsButton.focus();
  else settingsButton.focus();
}
function readSettingsFromForm() {
  return {
    gatewayUrl: gatewayUrl.value.trim() || defaultSettings().gatewayUrl,
    coreApiUrl: coreApiUrl.value.trim() || defaultSettings().coreApiUrl,
    autoReconnect: autoReconnect.checked,
    captureMutations: captureMutations.checked,
    captureInputValues: captureInputValues.checked,
    captureSnapshots: captureSnapshots.checked
  };
}
function setBusy(busy) {
  for (const button of [connectButton, disconnectButton, resetSessionButton, overlayCancelButton, recordButton]) button.disabled = busy;
}
function renderError(message) {
  errorText.hidden = !message;
  errorText.textContent = message ?? "";
}
function renderPairingOverlay(status) {
  const shouldShow = status.connectionState === "pairing";
  pairingOverlay.hidden = !shouldShow;
  if (!shouldShow) return;
  pairingReferenceCode.textContent = status.pairingReferenceCode ?? "------";
}
function renderRecordingLockOverlay(status) {
  const block = status.recordingBlock;
  recordingLockOverlay.hidden = !block;
  recordingLockMessage.textContent = block?.message ?? "";
}
function startTimerLoop() {
  timerHandle = setInterval(renderTimer, 1e3);
  window.addEventListener("unload", () => {
    if (timerHandle) clearInterval(timerHandle);
  });
}
function renderTimer() {
  const startedAt = currentStatus?.recordingStartedAt;
  if (!startedAt || currentStatus?.recordingState !== "recording") {
    recordingTimer.textContent = "00:00";
    return;
  }
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1e3));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  recordingTimer.textContent = `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}
function domainLabel(url) {
  if (!url) return "No active page";
  try {
    const parsed = new URL(url);
    return parsed.hostname || parsed.protocol.replace(":", "");
  } catch {
    return url;
  }
}
function sourceHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "FluxIQ Core";
  }
}
function relativeTime(timestamp) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1e3));
  if (seconds < 5) return "Now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}
function relativeDate(timestamp) {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
function element2(id) {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing popup element: ${id}`);
  return found;
}
//# sourceMappingURL=index.js.map
