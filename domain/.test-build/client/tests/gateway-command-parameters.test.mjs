// src/client/tests/gateway-command-parameters.test.ts
import assert from "node:assert/strict";

// src/actions/extraction/field-key.ts
var FIELD_KEY_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
var RESERVED_FIELD_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
function isWebAutomationExtractFieldKey(key) {
  return typeof key === "string" && FIELD_KEY_PATTERN.test(key) && !RESERVED_FIELD_KEYS.has(key);
}

// src/output-nodes/targets/targets.ts
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
var WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH = 1024;
var WEB_AUTOMATION_UPLOAD_MAX_FILE_BYTES = 1048576;
var WEB_AUTOMATION_UPLOAD_MAX_TOTAL_BYTES = 4194304;
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

// src/extraction/structure-detection.ts
function webAutomationStructureDetectionRequestValue(value) {
  const request = record(value);
  if (!request || Object.keys(request).some((key) => key !== "selector")) return void 0;
  if (request.selector === void 0) return {};
  return typeof request.selector === "string" && request.selector.trim() !== "" ? { selector: request.selector } : void 0;
}
function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}

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
  const requiredParameters2 = new Set(
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
      ...requiredParameters2.has(parameter.id) ? { required: true } : {},
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
      ...requiredParameters2.has("selector") ? { elementTarget: true } : {},
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

// src/output-nodes/secret-binding.ts
var WEB_AUTOMATION_SECRET_STATE_PREFIX = "web.secret.";
function webAutomationSecretBindingPath(value) {
  const path = stringValue(objectValue(objectValue(value)?.$state)?.path);
  return path?.startsWith(WEB_AUTOMATION_SECRET_STATE_PREFIX) ? path : void 0;
}
function webAutomationUnresolvedSecretParameters(parameters) {
  return Object.entries(parameters).flatMap(([parameter, value]) => {
    const path = webAutomationSecretBindingPath(value);
    return path === void 0 ? [] : [{ parameter, path }];
  });
}

// src/output-nodes/upload-binding.ts
var WEB_AUTOMATION_UPLOAD_STATE_PREFIX = "web.upload.";
function webAutomationUploadBindingPath(value) {
  const path = stringValue(objectValue(objectValue(value)?.$state)?.path);
  return path?.startsWith(WEB_AUTOMATION_UPLOAD_STATE_PREFIX) ? path : void 0;
}

// src/output-nodes/url-path.ts
function webAutomationUrlPath(value) {
  return typeof value === "string" && /^\/(?![/\\])[^?#]*$/u.test(value) ? value : void 0;
}

// src/runtime/failure/codes.ts
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

// src/client/gateway-action-parameters.ts
function webAutomationReadActionParameters(parameters) {
  const lifted = {
    // Which tab and frame the action runs in, as opposed to the tab a
    // `web.browser.tab` operation acts on, which travels inside `tab`.
    tabId: nonNegativeInteger2(parameters.browserTabId ?? parameters.tabId),
    frameId: nonNegativeInteger2(parameters.browserFrameId ?? parameters.frameId),
    // The child frame's document path, which finds the frame again after Chrome
    // renumbers it. Only the recorded node's name is read.
    frameUrlPath: webAutomationUrlPath(parameters.browserFrameUrlPath),
    newTab: booleanValue3(parameters.newTab),
    option: optionSelectorValue(parameters.option),
    scroll: scrollRequestValue(parameters.scroll),
    wait: waitRequestValue(parameters.wait),
    modifiers: keyModifiersValue(parameters.modifiers),
    checked: booleanValue3(parameters.checked),
    assert: assertRequestValue(parameters.assert),
    extract: webAutomationExtractReadValue(parameters.extract),
    extractList: webAutomationExtractListRequestValue(parameters.extractList),
    // Only `web.dom.capture_snapshot` reads it, and only the authoring runtime
    // sends it (`extraction/structure-detection.ts`).
    detectStructure: webAutomationStructureDetectionRequestValue(parameters.detectStructure),
    upload: uploadRequestValue(parameters.upload),
    dialog: dialogRequestValue(parameters.dialog),
    tab: tabRequestValue(parameters.tab),
    download: downloadRequestValue(parameters.download)
  };
  const refused = Object.keys(lifted).filter((field) => lifted[field] === void 0 && suppliedParameter(parameters, field) !== void 0);
  return { lifted, refused };
}
function suppliedParameter(parameters, field) {
  if (field === "tabId") return parameters.browserTabId ?? parameters.tabId;
  if (field === "frameId") return parameters.browserFrameId ?? parameters.frameId;
  if (field === "frameUrlPath") return parameters.browserFrameUrlPath;
  return parameters[field];
}
function optionSelectorValue(value) {
  const request = jsonObject2(value);
  if (!request) return void 0;
  if (request.by === "value") {
    const optionValue = stringValue2(request.value);
    return optionValue === void 0 ? void 0 : { by: "value", value: optionValue };
  }
  if (request.by === "label") {
    const label = stringValue2(request.label);
    return label === void 0 ? void 0 : { by: "label", label };
  }
  const index = nonNegativeInteger2(request.index);
  return request.by === "index" && index !== void 0 ? { by: "index", index } : void 0;
}
function scrollRequestValue(value) {
  const request = jsonObject2(value);
  const mode = memberOf2(request?.mode, ["by", "toElement", "untilStable"]);
  if (!request || mode === void 0) return void 0;
  if (mode === "toElement") return { mode };
  const y = finiteNumber(request.y);
  if (mode === "by") {
    const x = finiteNumber(request.x);
    return { mode, ...x !== void 0 ? { x } : {}, ...y !== void 0 ? { y } : {} };
  }
  const maxScrolls = positiveInteger2(request.maxScrolls);
  return maxScrolls === void 0 ? void 0 : { mode, maxScrolls, ...y !== void 0 ? { y } : {} };
}
function waitRequestValue(value) {
  const request = jsonObject2(value);
  const condition = memberOf2(request?.condition, WAIT_CONDITIONS);
  if (!request || condition === void 0) return void 0;
  const url = nonEmptyString2(request.url);
  const stableForMs = positiveInteger2(request.stableForMs);
  return { condition, ...url !== void 0 ? { url } : {}, ...stableForMs !== void 0 ? { stableForMs } : {} };
}
function keyModifiersValue(value) {
  const request = jsonObject2(value);
  if (!request) return void 0;
  const modifiers = {
    ...typeof request.alt === "boolean" ? { alt: request.alt } : {},
    ...typeof request.ctrl === "boolean" ? { ctrl: request.ctrl } : {},
    ...typeof request.meta === "boolean" ? { meta: request.meta } : {},
    ...typeof request.shift === "boolean" ? { shift: request.shift } : {}
  };
  return Object.keys(modifiers).length > 0 ? modifiers : void 0;
}
function assertRequestValue(value) {
  const request = jsonObject2(value);
  const kind = memberOf2(request?.kind, ASSERT_KINDS);
  if (!request || kind === void 0) return void 0;
  const expected = stringValue2(request.expected);
  const timeoutMs = positiveInteger2(request.timeoutMs);
  return { kind, ...expected !== void 0 ? { expected } : {}, ...timeoutMs !== void 0 ? { timeoutMs } : {} };
}
function uploadRequestValue(value) {
  const request = jsonObject2(value);
  const supplied = Array.isArray(request?.files) ? request.files : void 0;
  if (supplied === void 0 || supplied.length === 0) return void 0;
  const files = [];
  let totalBytes = 0;
  for (const entry of supplied) {
    const file = jsonObject2(entry);
    const name = nonEmptyString2(file?.name);
    const mimeType = nonEmptyString2(file?.mimeType);
    const contentBase64 = typeof file?.contentBase64 === "string" ? file.contentBase64 : void 0;
    if (name === void 0 || mimeType === void 0 || contentBase64 === void 0) return void 0;
    const bytes = base64ByteLength(contentBase64);
    if (bytes === void 0 || bytes > WEB_AUTOMATION_UPLOAD_MAX_FILE_BYTES) return void 0;
    totalBytes += bytes;
    if (totalBytes > WEB_AUTOMATION_UPLOAD_MAX_TOTAL_BYTES) return void 0;
    files.push({ name, mimeType, contentBase64 });
  }
  return { files };
}
function base64ByteLength(content) {
  if (content.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(content)) return void 0;
  const padding = content.endsWith("==") ? 2 : content.endsWith("=") ? 1 : 0;
  return content.length / 4 * 3 - padding;
}
function dialogRequestValue(value) {
  const request = jsonObject2(value);
  const response = memberOf2(request?.response, ["accept", "dismiss"]);
  if (!request || response === void 0) return void 0;
  const promptText = response === "accept" ? stringValue2(request.promptText) : void 0;
  return { response, ...promptText !== void 0 ? { promptText } : {} };
}
function tabRequestValue(value) {
  const request = jsonObject2(value);
  const operation = memberOf2(request?.operation, ["open", "switch", "close"]);
  if (!request || operation === void 0) return void 0;
  const tabId = nonNegativeInteger2(request.tabId);
  if (operation === "open") {
    const url = nonEmptyString2(request.url);
    const active = booleanValue3(request.active);
    return { operation, ...url !== void 0 ? { url } : {}, ...active !== void 0 ? { active } : {} };
  }
  if (operation === "switch") {
    const urlPattern = nonEmptyString2(request.urlPattern);
    const urlPath = webAutomationUrlPath(request.urlPath);
    if (request.urlPath !== void 0 && urlPath === void 0) return void 0;
    return { operation, ...tabId !== void 0 ? { tabId } : {}, ...urlPattern !== void 0 ? { urlPattern } : {}, ...urlPath !== void 0 ? { urlPath } : {} };
  }
  return { operation, ...tabId !== void 0 ? { tabId } : {} };
}
function downloadRequestValue(value) {
  const request = jsonObject2(value);
  if (!request) return void 0;
  const filename = nonEmptyString2(request.filename);
  const timeoutMs = positiveInteger2(request.timeoutMs);
  return { ...filename !== void 0 ? { filename } : {}, ...timeoutMs !== void 0 ? { timeoutMs } : {} };
}
var WAIT_CONDITIONS = ["present", "visible", "enabled", "absent", "url", "stable"];
var ASSERT_KINDS = ["exists", "absent", "text", "url", "visible", "enabled"];
function booleanValue3(value) {
  return typeof value === "boolean" ? value : void 0;
}
function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function nonNegativeInteger2(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
}
function positiveInteger2(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : void 0;
}
function stringValue2(value) {
  return typeof value === "string" ? value : void 0;
}
function nonEmptyString2(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function memberOf2(value, members) {
  return typeof value === "string" && members.includes(value) ? value : void 0;
}
function jsonObject2(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
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

// src/recording/web-state/evidence/project.ts
var COLLECTION = { elementKind: "collection", comparable: false };
var LIVE_COLLECTION = { ...COLLECTION, volatility: "rapid" };
var SETTLED_COLLECTION = { ...COLLECTION, volatility: "slow" };

// src/client/gateway-mapping.ts
function webAutomationActionFromGatewayCommand(command) {
  const normalized = normalizeWebAutomationActionType(command.actionType);
  if (!normalized.ok) {
    return { commandId: command.commandId, status: "rejected", actionType: command.actionType, message: normalized.message, failure: normalized.failure };
  }
  const parameters = command.parameters ?? {};
  const uploadPath = webAutomationUploadBindingPath(parameters.upload);
  const unmet = [...webAutomationUnresolvedSecretParameters(parameters), ...uploadPath !== void 0 ? [{ parameter: "upload", path: uploadPath }] : []];
  if (unmet.length > 0) {
    return { commandId: command.commandId, status: "rejected", actionType: command.actionType, message: unsuppliedValueMessage(unmet), failure: unsuppliedValueFailure(unmet) };
  }
  const { lifted, refused } = webAutomationReadActionParameters(parameters);
  const required = requiredParameters(normalized.actionType);
  const unreadable = refused.filter((field) => required.includes(field));
  if (unreadable.length > 0) {
    return { commandId: command.commandId, status: "rejected", actionType: command.actionType, message: unreadableFieldMessage(normalized.actionType, unreadable), failure: unreadableFieldFailure(normalized.actionType, unreadable) };
  }
  const encrypted = normalized.actionType === "web.dom.extract_list" ? encryptedFieldKeys(lifted.extractList) : [];
  if (encrypted.length > 0) {
    return { commandId: command.commandId, status: "rejected", actionType: command.actionType, message: encryptedFieldMessage(encrypted), failure: encryptedFieldFailure(encrypted) };
  }
  const target = command.target ?? {};
  return compactJsonObject2({
    commandId: command.commandId,
    actionType: normalized.actionType,
    selector: stringValue3(target.selector) ?? stringValue3(parameters.selector),
    text: stringValue3(parameters.text),
    value: stringValue3(parameters.value),
    key: stringValue3(parameters.key),
    url: stringValue3(parameters.url),
    timeoutMs: numberValue2(command.timeoutMs ?? parameters.timeoutMs),
    coordinates: pointValue(target.coordinates ?? parameters.coordinates),
    visualTarget: jsonObject3(target.visualTarget ?? parameters.visualTarget),
    element: commandElementFingerprint(target, parameters),
    ...lifted,
    options: parameters
  });
}
function commandElementFingerprint(target, parameters) {
  for (const source of elementFingerprintSources(target, parameters)) {
    const fingerprint = elementFingerprint(source);
    if (fingerprint && Object.keys(fingerprint).length > 0) return fingerprint;
  }
  return void 0;
}
function elementFingerprintSources(target, parameters) {
  if (!adaptedTargetSupersedesRecording(parameters)) return [parameters.element, target.element, target.fingerprint];
  const adaptedTarget = jsonObject3(parameters.target);
  return [target.element, target.fingerprint, adaptedTarget?.element, adaptedTarget?.fingerprint, adaptedTarget, parameters.element];
}
function normalizeWebAutomationActionType(actionType) {
  if (CANONICAL_ACTION_TYPES.has(actionType)) return { ok: true, actionType };
  const canonical = LEGACY_ACTION_TYPE_ALIASES.get(actionType);
  if (canonical !== void 0) return { ok: true, actionType: canonical };
  const requested = typeof actionType === "string" && actionType.length > 0 ? actionType : "(missing)";
  return { ok: false, failure: UNSUPPORTED_ACTION_TYPE_FAILURE, message: `Unsupported web automation action type: ${requested}` };
}
var UNSUPPORTED_ACTION_TYPE_FAILURE = Object.freeze(webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE));
function unsuppliedValueFailure(unmet) {
  return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED, {
    expected: `values supplied at run time for ${unmet.map((entry) => entry.path).join(", ")}`,
    actual: "the run supplied none, so the action was not dispatched"
  });
}
function unsuppliedValueMessage(unmet) {
  return `Not dispatched: these parameters need values supplied at run time that this run did not supply: ${unmet.map((entry) => `${entry.parameter} (${entry.path})`).join(", ")}`;
}
function unreadableFieldFailure(actionType, fields) {
  return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER, {
    expected: `${actionType} with a well-formed ${fields.join(", ")}`,
    actual: `${fields.join(", ")} could not be read, so the action was not dispatched`
  });
}
function unreadableFieldMessage(actionType, fields) {
  return `Not dispatched: ${actionType} requires ${fields.join(", ")}, and what was sent could not be read.`;
}
function encryptedFieldKeys(request) {
  if (request === void 0) return [];
  return Object.entries(request.fields).filter(([, field]) => typeof field !== "string" && field.handling === "encrypt").map(([key]) => key);
}
function encryptedFieldFailure(keys) {
  return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED, {
    expected: "web.dom.extract_list fields whose column is included or excluded",
    actual: `${namedFieldKeys(keys)} asked to be encrypted, which is not implemented yet, so the action was not dispatched`
  });
}
function encryptedFieldMessage(keys) {
  return `Not dispatched: web.dom.extract_list asks to encrypt ${namedFieldKeys(keys)}, and the Encrypt column is not implemented yet.`;
}
function namedFieldKeys(keys) {
  const named = keys.slice(0, 5).join(", ");
  return keys.length > 5 ? `${named} and ${keys.length - 5} more` : named;
}
function requiredParameters(actionType) {
  const schema = webAutomationActionDefinitions.find((definition) => definition.actionType === actionType)?.parameterSchema;
  return Array.isArray(schema?.required) ? schema.required.filter((key) => typeof key === "string") : [];
}
var CANONICAL_ACTION_TYPES = new Set(WEB_AUTOMATION_ACTION_TYPES);
var LEGACY_ACTION_TYPE_ALIASES = new Map(
  Object.entries(WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER).map(([canonical, legacy]) => [legacy, canonical])
);
function stringValue3(value) {
  return typeof value === "string" ? value : void 0;
}
function numberValue2(value) {
  return typeof value === "number" ? value : void 0;
}
function pointValue(value) {
  if (!value || typeof value !== "object") return void 0;
  const point = value;
  return typeof point.x === "number" && typeof point.y === "number" ? { x: point.x, y: point.y } : void 0;
}
function jsonObject3(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function compactJsonObject2(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}

// src/client/tests/gateway-command-parameters.test.ts
function mapped(actionType, parameters, extra = {}) {
  const command = webAutomationActionFromGatewayCommand({
    commandId: `command.${actionType}`,
    actionType,
    parameters,
    ...extra.target !== void 0 ? { target: extra.target } : {},
    ...extra.timeoutMs !== void 0 ? { timeoutMs: extra.timeoutMs } : {}
  });
  assert.equal("status" in command, false, `${actionType} was rejected`);
  return command;
}
function refusedWhole(actionType, parameters, fields, why) {
  const command = webAutomationActionFromGatewayCommand({ commandId: `command.${actionType}`, actionType, parameters });
  assert.equal("status" in command, true, `${actionType} was dispatched: ${why}`);
  const rejection = command;
  assert.equal(rejection.failure.code, WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER, why);
  assert.equal(rejection.message, `Not dispatched: ${actionType} requires ${fields.join(", ")}, and what was sent could not be read.`, why);
}
function base64OfBytes(bytes) {
  return "A".repeat(bytes / 3 * 4);
}
assert.equal(mapped("web.dom.click", { browserTabId: 12, browserFrameId: 3, selector: "#go" }).tabId, 12);
assert.equal(mapped("web.dom.click", { browserTabId: 12, browserFrameId: 3, selector: "#go" }).frameId, 3);
assert.equal(mapped("web.dom.click", { tabId: 7, frameId: 0, selector: "#go" }).tabId, 7);
assert.equal(mapped("web.dom.click", { tabId: 7, frameId: 0, selector: "#go" }).frameId, 0, "frame 0 is the top frame, not an absent frame");
assert.equal(mapped("web.dom.click", { browserTabId: -1, browserFrameId: 1.5, selector: "#go" }).tabId, void 0);
assert.equal(mapped("web.dom.click", { browserTabId: -1, browserFrameId: 1.5, selector: "#go" }).frameId, void 0);
assert.equal(mapped("web.dom.click", { selector: "#go" }).tabId, void 0);
assert.equal(mapped("web.browser.navigate", { url: "https://example.test", newTab: true }).newTab, true);
assert.equal(mapped("web.browser.navigate", { url: "https://example.test", newTab: false }).newTab, false, "an explicit false is a decision, not an absence");
assert.equal(mapped("web.browser.navigate", { url: "https://example.test" }).newTab, void 0);
assert.equal(mapped("web.browser.navigate", { url: "https://example.test", newTab: "yes" }).newTab, void 0);
assert.equal(mapped("web.dom.check", { selector: "#terms", checked: false }).checked, false);
assert.equal(mapped("web.dom.check", { selector: "#terms", checked: true }).checked, true);
assert.equal(mapped("web.dom.check", { selector: "#terms", checked: "false" }).checked, void 0);
assert.deepEqual(mapped("web.dom.assert", { assert: { kind: "text", expected: "Saved", timeoutMs: 2e3 } }).assert, { kind: "text", expected: "Saved", timeoutMs: 2e3 });
assert.deepEqual(mapped("web.dom.assert", { assert: { kind: "visible" } }).assert, { kind: "visible" });
for (const kind of ["exists", "absent", "text", "url", "visible", "enabled"]) {
  assert.deepEqual(mapped("web.dom.assert", { assert: { kind } }).assert, { kind }, kind);
}
refusedWhole("web.dom.assert", { assert: { kind: "contains" } }, ["assert"], "an unknown kind is no assertion");
refusedWhole("web.dom.assert", { assert: { expected: "Saved" } }, ["assert"], "an assertion with no kind claims nothing");
assert.equal(mapped("web.dom.assert", { assert: { kind: "text", expected: "Saved", timeoutMs: 0 } }).assert?.timeoutMs, void 0, "a zero timeout is not a timeout");
assert.deepEqual(mapped("web.dom.extract_list", {
  extractList: { item: "tr.row", fields: { name: "td.name", href: "a@href", price: "column:Price" }, paginate: { next: "a.next", maxPages: 3 }, maxItems: 40 }
}).extractList, { item: "tr.row", fields: { name: "td.name", href: "a@href", price: "column:Price" }, paginate: { next: "a.next", maxPages: 3 }, maxItems: 40 });
assert.deepEqual(mapped("web.dom.extract_list", { extractList: { item: "li", fields: { title: "h3" } } }).extractList, { item: "li", fields: { title: "h3" } });
assert.deepEqual(mapped("web.dom.extract_list", { extractList: { item: "li", fields: { title: "h3" }, paginate: { next: "a.next", maxPages: 5e3 } } }).extractList?.paginate, { next: "a.next", maxPages: WEB_AUTOMATION_EXTRACT_MAX_PAGES });
refusedWhole("web.dom.extract_list", { extractList: { item: "li", fields: {} } }, ["extractList"], "no fields extracts nothing");
refusedWhole("web.dom.extract_list", { extractList: { item: "li", fields: { title: "" } } }, ["extractList"], "a field naming no selector would extract a column of nothing");
refusedWhole("web.dom.extract_list", { extractList: { fields: { title: "h3" } } }, ["extractList"], "no item selector selects no records");
refusedWhole("web.dom.extract_list", { extractList: { item: "li", fields: { title: "h3" }, paginate: { maxPages: 3 } } }, ["extractList"], "a paginate with no next link");
assert.equal(mapped("web.dom.extract_list", { extractList: { item: "li", fields: { title: "h3" }, maxItems: 5e3 } }).extractList?.maxItems, WEB_AUTOMATION_EXTRACT_MAX_ITEMS);
assert.deepEqual(mapped("web.dom.extract_list", { extractList: { item: "li", fields: { title: "h3" }, minItems: 0 } }).extractList, { item: "li", fields: { title: "h3" }, minItems: 0 }, "zero is a declaration, not an absent minimum");
assert.equal(mapped("web.dom.extract_list", { extractList: { item: "li", fields: { title: "h3" }, minItems: 3, maxItems: 3 } }).extractList?.minItems, 3, "a minimum equal to the maximum can be met");
refusedWhole("web.dom.extract_list", { extractList: { item: "li", fields: { title: "h3" }, minItems: -1 } }, ["extractList"], "a negative minimum");
refusedWhole("web.dom.extract_list", { extractList: { item: "li", fields: { title: "h3" }, minItems: "1" } }, ["extractList"], "a minimum sent as a string is not read as a number");
refusedWhole("web.dom.extract_list", { extractList: { item: "li", fields: { title: "h3" }, minItems: 5, maxItems: 3 } }, ["extractList"], "a minimum above the maximum");
refusedWhole("web.dom.extract_list", { extractList: { item: "li", fields: { title: "h3" }, minItems: WEB_AUTOMATION_EXTRACT_MAX_ITEMS + 1 } }, ["extractList"], "a minimum above the bound a request naming no maximum is held to");
var specRows = [
  ["text", { kind: "text", selector: "h3" }],
  ["attribute", { kind: "attribute", selector: "a", attribute: "href" }],
  ["link", { kind: "link", selector: "a.product" }],
  ["value", { kind: "value", selector: "input[name=qty]" }],
  ["column", { kind: "column", header: "Price" }],
  ["a spec reading the item itself", { kind: "text" }],
  ["an optional included field", { kind: "text", selector: "p.note", required: false, handling: "include" }]
];
for (const [what, spec] of specRows) {
  assert.deepEqual(mapped("web.dom.extract_list", { extractList: { item: "li", fields: { field: spec } } }).extractList, { item: "li", fields: { field: spec } }, what);
}
assert.deepEqual(
  mapped("web.dom.extract_list", { extractList: { item: "tr", fields: { name: "td.name", card: { kind: "text", selector: "td.card", handling: "exclude" } } } }).extractList?.fields,
  { name: "td.name", card: { kind: "text", selector: "td.card", handling: "exclude" } }
);
var recordedField = { selector: "td.price", tagName: "td", testId: "price", unrelated: "dropped by the normalizer" };
assert.deepEqual(
  mapped("web.dom.extract_list", { extractList: { item: "tr", fields: { price: { kind: "text", element: recordedField } } } }).extractList?.fields.price,
  { kind: "text", element: elementFingerprint(recordedField) },
  "a field's element is the fingerprint normalizer's output"
);
assert.deepEqual(
  mapped("web.dom.extract_list", { extractList: { item: "tr.row", itemElement: { selector: "tr.row", tagName: "tr", testId: "row-1" }, fields: { name: "td.name" } } }).extractList?.itemElement,
  elementFingerprint({ selector: "tr.row", tagName: "tr", testId: "row-1" }),
  "the item element is the fingerprint normalizer's output"
);
assert.deepEqual(
  webAutomationReadActionParameters({ extractList: { item: "li", fields: { card: { kind: "text", handling: "encrypt" } } } }).lifted.extractList?.fields,
  { card: { kind: "text", handling: "encrypt" } }
);
var malformedSpecs = [
  ["an attribute field naming no attribute", { href: { kind: "attribute", selector: "a" } }],
  ["an attribute field naming an empty attribute", { href: { kind: "attribute", selector: "a", attribute: "" } }],
  ["a column field naming no header", { price: { kind: "column" } }],
  ["an attribute on a kind that reads none", { title: { kind: "text", selector: "h3", attribute: "title" } }],
  ["a header on a kind that reads none", { title: { kind: "link", header: "Title" } }],
  ["an unknown kind", { title: { kind: "html", selector: "h3" } }],
  ["a spec with no kind", { title: { selector: "h3" } }],
  ["an empty selector", { title: { kind: "text", selector: "" } }],
  ["a required flag that is not a boolean", { title: { kind: "text", required: "yes" } }],
  ["an unknown handling", { title: { kind: "text", handling: "mask" } }],
  ["an element with no identity signal", { title: { kind: "text", element: { unrelated: true } } }],
  ["an element that is not an object", { title: { kind: "text", element: "h3" } }],
  ["a field that is neither a string nor a spec", { title: 3 }],
  ["one malformed field among good ones", { name: "td.name", price: { kind: "column" } }],
  ["every field excluded, which reads nothing", { card: { kind: "text", handling: "exclude" }, cvc: { kind: "value", selector: "input", handling: "exclude" } }]
];
for (const [why, fields] of malformedSpecs) {
  refusedWhole("web.dom.extract_list", { extractList: { item: "li", fields } }, ["extractList"], why);
}
refusedWhole("web.dom.extract_list", { extractList: { item: "tr", itemElement: { unrelated: true }, fields: { name: "td.name" } } }, ["extractList"], "an item element with no identity signal");
refusedWhole("web.dom.extract_list", { extractList: { item: "tr", itemElement: "tr.row", fields: { name: "td.name" } } }, ["extractList"], "an item element that is not an object");
assert.deepEqual(mapped("web.dom.extract_list", { extractList: { item: "li", fields: { "product-name_2": "h3", [`k${"x".repeat(99)}`]: "p" } } }).extractList?.fields, { "product-name_2": "h3", [`k${"x".repeat(99)}`]: "p" }, "a 100-character key is a key");
for (const key of ["Product name", "price.amount", "prix\u20AC", `k${"x".repeat(100)}`, "constructor", "prototype"]) {
  refusedWhole("web.dom.extract_list", { extractList: { item: "li", fields: { [key]: "h3" } } }, ["extractList"], `a field key Core would refuse: ${JSON.stringify(key)}`);
}
refusedWhole("web.dom.extract_list", { extractList: { item: "li", fields: JSON.parse('{"__proto__":"h3"}') } }, ["extractList"], "the __proto__ key");
var paginationRows = [
  ["next, named", { mode: "next", next: "a.next", maxPages: 3 }, { next: "a.next", maxPages: 3 }],
  ["loadMore", { mode: "loadMore", control: "button.more", maxPages: 4 }, { mode: "loadMore", control: "button.more", maxPages: 4 }],
  ["scroll", { mode: "scroll", maxScrolls: 6 }, { mode: "scroll", maxScrolls: 6 }],
  ["numbered", { mode: "numbered", pages: "[data-testid^=pagination-page-]", maxPages: 2 }, { mode: "numbered", pages: "[data-testid^=pagination-page-]", maxPages: 2 }],
  ["loadMore past the bound", { mode: "loadMore", control: "button.more", maxPages: 5e3 }, { mode: "loadMore", control: "button.more", maxPages: WEB_AUTOMATION_EXTRACT_MAX_PAGES }],
  ["scroll past the bound", { mode: "scroll", maxScrolls: 5e3 }, { mode: "scroll", maxScrolls: WEB_AUTOMATION_EXTRACT_MAX_PAGES }]
];
for (const [what, sent, lifted] of paginationRows) {
  assert.deepEqual(mapped("web.dom.extract_list", { extractList: { item: "li", fields: { title: "h3" }, paginate: sent } }).extractList?.paginate, lifted, what);
}
var malformedPagination = [
  ["an unknown mode", { mode: "infinite", maxScrolls: 3 }],
  ["a mode that is not a string", { mode: 2, next: "a.next", maxPages: 3 }],
  ["loadMore with no control", { mode: "loadMore", maxPages: 3 }],
  ["numbered with no page controls", { mode: "numbered", maxPages: 3 }],
  ["scroll with no bound", { mode: "scroll" }],
  ["loadMore with no bound", { mode: "loadMore", control: "button.more" }],
  ["scroll carrying another mode's key", { mode: "scroll", maxScrolls: 3, next: "a.next" }],
  ["next carrying another mode's key", { next: "a.next", maxPages: 3, control: "button.more" }],
  ["scroll carrying a page bound", { mode: "scroll", maxScrolls: 3, maxPages: 3 }]
];
for (const [why, paginate] of malformedPagination) {
  refusedWhole("web.dom.extract_list", { extractList: { item: "li", fields: { title: "h3" }, paginate } }, ["extractList"], why);
}
assert.deepEqual(mapped("web.dom.upload", { selector: "input[type=file]", upload: { files: [{ name: "a.txt", mimeType: "text/plain", contentBase64: "aGk=" }] } }).upload, {
  files: [{ name: "a.txt", mimeType: "text/plain", contentBase64: "aGk=" }]
});
refusedWhole("web.dom.upload", { selector: "#f", upload: { files: [] } }, ["upload"], "an upload of no files");
refusedWhole("web.dom.upload", { selector: "#f", upload: { files: [{ name: "a.txt", mimeType: "text/plain" }] } }, ["upload"], "a file with no content is not a file");
refusedWhole("web.dom.upload", { selector: "#f", upload: { files: [{ name: "a.txt", mimeType: "text/plain", contentBase64: "not base64!" }] } }, ["upload"], "content that is not base64");
var oversized = base64OfBytes(WEB_AUTOMATION_UPLOAD_MAX_FILE_BYTES + 2);
refusedWhole("web.dom.upload", { selector: "#f", upload: { files: [{ name: "big.bin", mimeType: "application/octet-stream", contentBase64: oversized }] } }, ["upload"], "a file past the per-file bound");
var nearLimit = { name: "part.bin", mimeType: "application/octet-stream", contentBase64: base64OfBytes(1048575) };
assert.equal(mapped("web.dom.upload", { selector: "#f", upload: { files: [nearLimit] } }).upload?.files.length, 1, "a file inside the per-file bound is carried");
refusedWhole("web.dom.upload", { selector: "#f", upload: { files: [nearLimit, nearLimit, nearLimit, nearLimit, nearLimit] } }, ["upload"], "five near-limit files exceed the total bound");
assert.deepEqual(mapped("web.dom.dialog", { dialog: { response: "accept", promptText: "Ada" } }).dialog, { response: "accept", promptText: "Ada" });
assert.deepEqual(mapped("web.dom.dialog", { dialog: { response: "dismiss" } }).dialog, { response: "dismiss" });
assert.deepEqual(mapped("web.dom.dialog", { dialog: { response: "dismiss", promptText: "Ada" } }).dialog, { response: "dismiss" }, "a dismissal answers nothing, so it carries no reply");
refusedWhole("web.dom.dialog", { dialog: { response: "ignore" } }, ["dialog"], "a response that is neither accept nor dismiss");
assert.equal(mapped("web.dom.dialog", {}).dialog, void 0, "an absent field is not a refused one: the verb still decides what an empty request means");
assert.deepEqual(mapped("web.browser.tab", { tab: { operation: "open", url: "https://example.test/report", active: true } }).tab, { operation: "open", url: "https://example.test/report", active: true });
assert.deepEqual(mapped("web.browser.tab", { tab: { operation: "switch", urlPattern: "/report" } }).tab, { operation: "switch", urlPattern: "/report" });
assert.deepEqual(mapped("web.browser.tab", { tab: { operation: "switch", tabId: 9 } }).tab, { operation: "switch", tabId: 9 });
assert.deepEqual(mapped("web.browser.tab", { tab: { operation: "close", tabId: 9 } }).tab, { operation: "close", tabId: 9 });
assert.deepEqual(mapped("web.browser.tab", { tab: { operation: "close", url: "https://example.test", active: true, tabId: 4 } }).tab, { operation: "close", tabId: 4 });
refusedWhole("web.browser.tab", { tab: { operation: "reload" } }, ["tab"], "an operation that is not open, switch or close");
assert.equal(mapped("web.browser.tab", { tab: { operation: "close", tabId: 9 } }).tabId, void 0);
assert.deepEqual(mapped("web.browser.download", { download: { filename: "report.csv", timeoutMs: 3e4 } }).download, { filename: "report.csv", timeoutMs: 3e4 });
assert.deepEqual(mapped("web.browser.download", { download: {} }).download, {}, "waiting for whichever download finishes next is a request");
assert.equal(mapped("web.browser.download", {}).download, void 0);
assert.deepEqual(mapped("web.browser.tab", { tab: { operation: "switch", urlPath: "/scenarios/multi-tab/list" } }).tab, { operation: "switch", urlPath: "/scenarios/multi-tab/list" });
for (const urlPath of ["http://127.0.0.1:4173/scenarios/multi-tab/list", "/list?session=tok", "/list#top", "list", "", 7, null]) {
  refusedWhole("web.browser.tab", { tab: { operation: "switch", urlPath } }, ["tab"], `a switch path that is not a bare pathname: ${JSON.stringify(urlPath)}`);
}
assert.deepEqual(mapped("web.browser.tab", { tab: { operation: "close", urlPath: "/list" } }).tab, { operation: "close" }, "a close names no tab, so it carries no path");
var childFrameClick = mapped("web.dom.click", { browserFrameId: 4, browserFrameUrlPath: "/scenarios/iframe-checkout/payment", selector: "#pay" });
assert.equal(childFrameClick.frameUrlPath, "/scenarios/iframe-checkout/payment");
assert.equal(childFrameClick.frameId, 4, "the id still travels, as the tie-break");
assert.equal(mapped("web.dom.click", { browserFrameId: 0, selector: "#pay" }).frameUrlPath, void 0, "a top-frame command names no path");
assert.equal(mapped("web.dom.click", { frameUrlPath: "/payment", selector: "#pay" }).frameUrlPath, void 0, "only the recorded node's name is read");
for (const browserFrameUrlPath of ["", "http://127.0.0.1:5174/payment", "/payment?session=tok", "payment", 4, null]) {
  const command = mapped("web.dom.click", { browserFrameId: 4, browserFrameUrlPath, selector: "#pay" });
  assert.equal(command.frameUrlPath, void 0, `refused: ${JSON.stringify(browserFrameUrlPath)}`);
  assert.equal(command.frameId, 4, "a refused path does not take the frame id with it");
}
assert.deepEqual(mapped("web.dom.select", { selector: "#country", option: { by: "label", label: "Ireland" } }).option, { by: "label", label: "Ireland" });
assert.deepEqual(mapped("web.dom.select", { selector: "#country", option: { by: "index", index: 0 } }).option, { by: "index", index: 0 }, "the first option is index 0");
assert.deepEqual(mapped("web.dom.select", { selector: "#country", option: { by: "value", value: "" } }).option, { by: "value", value: "" }, "an option's value may legitimately be empty");
assert.equal(mapped("web.dom.select", { selector: "#country", option: { by: "label" } }).option, void 0);
assert.equal(mapped("web.dom.select", { selector: "#country", option: { label: "Ireland" } }).option, void 0, "without `by`, nothing says how to match");
assert.deepEqual(mapped("web.dom.scroll", { scroll: { mode: "by", y: 640 } }).scroll, { mode: "by", y: 640 });
assert.deepEqual(mapped("web.dom.scroll", { selector: "#row-40", scroll: { mode: "toElement" } }).scroll, { mode: "toElement" });
assert.deepEqual(mapped("web.dom.scroll", { scroll: { mode: "untilStable", maxScrolls: 12, y: 800 } }).scroll, { mode: "untilStable", maxScrolls: 12, y: 800 });
assert.equal(mapped("web.dom.scroll", { scroll: { mode: "untilStable" } }).scroll, void 0, "untilStable without maxScrolls would scroll forever");
assert.equal(mapped("web.dom.scroll", { scroll: { mode: "down" } }).scroll, void 0);
assert.deepEqual(mapped("web.dom.wait_for_selector", { selector: "#row", wait: { condition: "visible" } }).wait, { condition: "visible" });
assert.deepEqual(mapped("web.dom.wait_for_selector", { selector: "#row", wait: { condition: "url", url: "https://example.test/done" } }).wait, { condition: "url", url: "https://example.test/done" });
assert.deepEqual(mapped("web.dom.wait_for_text", { text: "Saved", wait: { condition: "stable", stableForMs: 500 } }).wait, { condition: "stable", stableForMs: 500 });
assert.equal(mapped("web.dom.wait_for_selector", { selector: "#row", wait: { condition: "settled" } }).wait, void 0);
assert.deepEqual(mapped("web.dom.keypress", { key: "Enter", modifiers: { ctrl: true, shift: false } }).modifiers, { ctrl: true, shift: false });
assert.equal(mapped("web.dom.keypress", { key: "Enter", modifiers: {} }).modifiers, void 0, "a modifier set naming nothing is no modifier set");
assert.deepEqual(mapped("web.dom.keypress", { key: "Enter", modifiers: { alt: true, meta: "yes" } }).modifiers, { alt: true }, "only the modifiers actually named are carried");
var withBadScroll = mapped("web.dom.scroll", { scroll: { mode: "down" } });
assert.equal(withBadScroll.scroll, void 0);
assert.deepEqual(withBadScroll.options, { scroll: { mode: "down" } }, "a refused optional value stays in options rather than vanishing");
assert.deepEqual(webAutomationActionFromGatewayCommand({ commandId: "command.type", actionType: "dom.type", target: { selector: "input[name=q]" }, parameters: { text: "ada" } }), {
  commandId: "command.type",
  actionType: "web.dom.type",
  selector: "input[name=q]",
  text: "ada",
  options: { text: "ada" }
});
assert.deepEqual(webAutomationActionFromGatewayCommand({ commandId: "command.snapshot", actionType: "web.dom.capture_snapshot" }), {
  commandId: "command.snapshot",
  actionType: "web.dom.capture_snapshot",
  options: {}
});
var LIFTED_PARAMETER_NAMES = ["browserTabId", "tabId", "browserFrameId", "frameId", "browserFrameUrlPath", "newTab", "option", "scroll", "wait", "modifiers", "checked", "assert", "extractList", "upload", "dialog", "tab", "download"];
var refusedPairs = WEB_AUTOMATION_ACTION_TYPES.flatMap((actionType) => LIFTED_PARAMETER_NAMES.filter((name) => "status" in webAutomationActionFromGatewayCommand({ commandId: "command.matrix", actionType, parameters: { [name]: "unreadable" } })).map((name) => `${actionType} ${name}`));
assert.deepEqual(refusedPairs.sort(), ["web.browser.tab tab", "web.dom.assert assert", "web.dom.dialog dialog", "web.dom.extract_list extractList", "web.dom.upload upload"]);
console.log("Web automation gateway command parameter tests passed.");
