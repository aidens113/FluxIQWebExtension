var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/constants.ts
var WEB_AUTOMATION_DOMAIN_ID;
var init_constants = __esm({
  "src/constants.ts"() {
    "use strict";
    WEB_AUTOMATION_DOMAIN_ID = "web-automation";
  }
});

// src/actions/safety.ts
var WEB_AUTOMATION_ACTION_SAFETY;
var init_safety = __esm({
  "src/actions/safety.ts"() {
    "use strict";
    WEB_AUTOMATION_ACTION_SAFETY = {
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
  }
});

// src/actions/extraction/field-key.ts
function isWebAutomationExtractFieldKey(key) {
  return typeof key === "string" && FIELD_KEY_PATTERN.test(key) && !RESERVED_FIELD_KEYS.has(key);
}
var FIELD_KEY_PATTERN, RESERVED_FIELD_KEYS;
var init_field_key = __esm({
  "src/actions/extraction/field-key.ts"() {
    "use strict";
    FIELD_KEY_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
    RESERVED_FIELD_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
  }
});

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
var init_targets = __esm({
  "src/output-nodes/targets/targets.ts"() {
    "use strict";
  }
});

// src/output-nodes/targets/index.ts
var init_targets2 = __esm({
  "src/output-nodes/targets/index.ts"() {
    "use strict";
    init_targets();
  }
});

// src/actions/extraction/request.ts
function webAutomationExtractListTimeoutMs(request) {
  const paginate = request.paginate;
  const pages = paginate === void 0 ? 1 : paginate.mode === "scroll" ? paginate.maxScrolls : paginate.maxPages;
  return WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS * pages;
}
var WEB_AUTOMATION_EXTRACT_PAGINATION_MODES, WEB_AUTOMATION_EXTRACT_FIELD_KINDS, WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS, WEB_AUTOMATION_EXTRACT_READ_MODES, WEB_AUTOMATION_EXTRACT_MAX_PAGES, WEB_AUTOMATION_EXTRACT_MAX_ITEMS, WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS;
var init_request = __esm({
  "src/actions/extraction/request.ts"() {
    "use strict";
    WEB_AUTOMATION_EXTRACT_PAGINATION_MODES = ["next", "loadMore", "scroll", "numbered"];
    WEB_AUTOMATION_EXTRACT_FIELD_KINDS = ["text", "attribute", "link", "value", "column"];
    WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS = ["include", "exclude", "encrypt"];
    WEB_AUTOMATION_EXTRACT_READ_MODES = ["text", "attribute", "value", "html"];
    WEB_AUTOMATION_EXTRACT_MAX_PAGES = 50;
    WEB_AUTOMATION_EXTRACT_MAX_ITEMS = 1e3;
    WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS = 1e4;
  }
});

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
function fingerprintValue(value) {
  const fingerprint = elementFingerprint(value);
  return fingerprint !== void 0 && Object.keys(fingerprint).length > 0 ? fingerprint : void 0;
}
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
var FRAME_KEYS, PAGINATION_KEYS, REFUSED;
var init_read_request = __esm({
  "src/actions/extraction/read-request.ts"() {
    "use strict";
    init_targets2();
    init_field_key();
    init_request();
    FRAME_KEYS = ["frame", "frameId", "frameSelector", "frameUrlPath"];
    PAGINATION_KEYS = {
      next: ["next", "maxPages"],
      loadMore: ["control", "maxPages"],
      scroll: ["maxScrolls"],
      numbered: ["pages", "maxPages"]
    };
    REFUSED = Symbol("refused");
  }
});

// src/actions/extraction/recorded-definition.ts
var init_recorded_definition = __esm({
  "src/actions/extraction/recorded-definition.ts"() {
    "use strict";
    init_field_key();
    init_read_request();
  }
});

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
var init_schema = __esm({
  "src/actions/extraction/schema.ts"() {
    "use strict";
    init_request();
  }
});

// src/actions/extraction/summary.ts
var init_summary = __esm({
  "src/actions/extraction/summary.ts"() {
    "use strict";
    init_field_key();
  }
});

// src/actions/extraction/index.ts
var init_extraction = __esm({
  "src/actions/extraction/index.ts"() {
    "use strict";
    init_field_key();
    init_read_request();
    init_recorded_definition();
    init_request();
    init_schema();
    init_summary();
  }
});

// src/actions/schemas.ts
var elementFingerprintSchema, visualTargetSchema, elementProperties, selectorSchema, waitSchema, keyModifiersSchema, optionSelectorSchema, scrollRequestSchema, waitForSelectorSchema, assertSchema, extractListSchema, extractReadSchema, uploadSchema, dialogSchema, tabSchema, downloadSchema, webAutomationActionDefinitions;
var init_schemas = __esm({
  "src/actions/schemas.ts"() {
    "use strict";
    init_extraction();
    elementFingerprintSchema = {
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
    visualTargetSchema = {
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
    elementProperties = { selector: { type: "string", label: "CSS selector" }, element: elementFingerprintSchema, visualTarget: visualTargetSchema };
    selectorSchema = {
      type: "object",
      required: ["selector"],
      properties: {
        ...elementProperties,
        timeoutMs: { type: "integer", label: "Timeout in ms" }
      }
    };
    waitSchema = {
      type: "object",
      label: "Wait condition",
      properties: {
        condition: { type: "string", label: "Condition", enum: ["present", "visible", "enabled", "absent", "url", "stable"] },
        url: { type: "string", label: "URL" },
        stableForMs: { type: "integer", label: "Stable for, in ms" }
      }
    };
    keyModifiersSchema = {
      type: "object",
      label: "Modifier keys",
      properties: {
        alt: { type: "boolean", label: "Alt" },
        ctrl: { type: "boolean", label: "Control" },
        meta: { type: "boolean", label: "Meta" },
        shift: { type: "boolean", label: "Shift" }
      }
    };
    optionSelectorSchema = {
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
    scrollRequestSchema = {
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
    waitForSelectorSchema = {
      type: "object",
      required: ["selector"],
      properties: {
        ...elementProperties,
        timeoutMs: { type: "integer", label: "Timeout in ms" },
        wait: waitSchema
      }
    };
    assertSchema = {
      type: "object",
      label: "Assertion",
      required: ["kind"],
      properties: {
        kind: { type: "string", label: "Condition", enum: ["exists", "absent", "text", "url", "visible", "enabled"] },
        expected: { type: "string", label: "Expected" },
        timeoutMs: { type: "integer", label: "Timeout in ms" }
      }
    };
    extractListSchema = webAutomationExtractListSchema(elementFingerprintSchema);
    extractReadSchema = {
      type: "object",
      label: "Read",
      required: ["mode"],
      properties: {
        mode: { type: "string", label: "Reads", enum: [...WEB_AUTOMATION_EXTRACT_READ_MODES] },
        attribute: { type: "string", label: "Attribute" }
      }
    };
    uploadSchema = {
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
    dialogSchema = {
      type: "object",
      label: "Dialog",
      required: ["response"],
      properties: {
        response: { type: "string", label: "Response", enum: ["accept", "dismiss"] },
        promptText: { type: "string", label: "Prompt text" }
      }
    };
    tabSchema = {
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
    downloadSchema = {
      type: "object",
      label: "Download",
      properties: {
        filename: { type: "string", label: "File name" },
        timeoutMs: { type: "integer", label: "Timeout in ms" }
      }
    };
    webAutomationActionDefinitions = [
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
  }
});

// src/output-nodes/extract-list/catalog-text.ts
var WEB_AUTOMATION_EXTRACT_LIST_TAGS, WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION, WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR, WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE;
var init_catalog_text = __esm({
  "src/output-nodes/extract-list/catalog-text.ts"() {
    "use strict";
    init_extraction();
    WEB_AUTOMATION_EXTRACT_LIST_TAGS = [
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
    WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION = [
      "Scrape every item of a repeating list or table into a dataset, across pages.",
      "The rows are saved without a recordOutput."
    ].join(" ");
    WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR = [
      "{ item, fields, paginate?, minItems?, maxItems? }. item: CSS selector of each record.",
      'fields: { key: "css" (text) | "css@attr" | "column:Header" (table cell)',
      `| { kind: ${WEB_AUTOMATION_EXTRACT_FIELD_KINDS.join("|")}, selector?, attribute?, header?, required?: false } };`,
      "keys use A-Za-z0-9_-; field selectors are read inside each item.",
      'paginate: { mode: "next", next: css, maxPages } | { mode: "loadMore", control: css, maxPages }',
      `| { mode: "scroll", maxScrolls } | { mode: "numbered", pages: css, maxPages }, at most ${WEB_AUTOMATION_EXTRACT_MAX_PAGES}.`,
      `minItems: default 1; 0 allows an empty list. maxItems: at most ${WEB_AUTOMATION_EXTRACT_MAX_ITEMS}.`
    ].join(" ");
    WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE = {
      item: "li.product",
      fields: { name: ".name", price: ".price", url: "a@href" },
      paginate: { mode: "next", next: "a.next", maxPages: 5 }
    };
  }
});

// src/extraction/dataset-id.ts
function webAutomationDatasetId(label, nonce) {
  if (!NONCE_PATTERN.test(nonce)) {
    throw new RangeError("A dataset id nonce must be 1 to 64 characters of A-Z, a-z, 0-9, '.', '_' or '-'.");
  }
  const words = label.toLowerCase().normalize("NFKD").replace(COMBINING_MARKS, "").split(OUTSIDE_NAME_CHARACTERS).filter((word) => word.length > 0);
  const name = words.join("-").slice(0, MAX_ID_LENGTH - SEPARATOR.length - nonce.length) || FALLBACK_NAME;
  return `${name}${SEPARATOR}${nonce}`;
}
var MAX_ID_LENGTH, NONCE_PATTERN, SEPARATOR, FALLBACK_NAME, OUTSIDE_NAME_CHARACTERS, COMBINING_MARKS;
var init_dataset_id = __esm({
  "src/extraction/dataset-id.ts"() {
    "use strict";
    MAX_ID_LENGTH = 200;
    NONCE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/u;
    SEPARATOR = ":";
    FALLBACK_NAME = "dataset";
    OUTSIDE_NAME_CHARACTERS = /[^a-z0-9._-]+/u;
    COMBINING_MARKS = new RegExp("\\p{M}+", "gu");
  }
});

// src/extraction/label-key.ts
var COMBINING_MARKS2;
var init_label_key = __esm({
  "src/extraction/label-key.ts"() {
    "use strict";
    init_extraction();
    COMBINING_MARKS2 = new RegExp("\\p{M}+", "gu");
  }
});

// src/extraction/proposal.ts
var init_proposal = __esm({
  "src/extraction/proposal.ts"() {
    "use strict";
  }
});

// src/extraction/signature.ts
var init_signature = __esm({
  "src/extraction/signature.ts"() {
    "use strict";
  }
});

// src/extraction/structure-detection.ts
var init_structure_detection = __esm({
  "src/extraction/structure-detection.ts"() {
    "use strict";
    init_extraction();
  }
});

// src/extraction/index.ts
var init_extraction2 = __esm({
  "src/extraction/index.ts"() {
    "use strict";
    init_dataset_id();
    init_label_key();
    init_proposal();
    init_signature();
    init_structure_detection();
  }
});

// src/output-nodes/extract-list/record-output.ts
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
var DEFAULT_MAX_RECORDS, MAX_RECORDS_CEILING, LABEL_MAX_LENGTH;
var init_record_output = __esm({
  "src/output-nodes/extract-list/record-output.ts"() {
    "use strict";
    DEFAULT_MAX_RECORDS = 1e3;
    MAX_RECORDS_CEILING = 1e4;
    LABEL_MAX_LENGTH = 200;
  }
});

// src/output-nodes/extract-list/records-path.ts
var WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH;
var init_records_path = __esm({
  "src/output-nodes/extract-list/records-path.ts"() {
    "use strict";
    WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH = "result.extracted";
  }
});

// src/output-nodes/extract-list/derived-record-output.ts
function webAutomationDerivedRecordOutput(request) {
  const label = derivedLabel(request);
  return {
    ...webAutomationRecordOutput({ datasetId: webAutomationDatasetId(label, shapeDigest(request)), label, request, fieldLabels: {} }),
    recordsPath: WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH
  };
}
function derivedLabel(request) {
  const kept = Object.entries(request.fields).filter(([, field]) => typeof field === "string" || field.handling !== "exclude").map(([key]) => key);
  return `${LABEL_PREFIX}${kept.join(", ")}`.slice(0, LABEL_MAX_LENGTH2);
}
function shapeDigest(request) {
  const shape = JSON.stringify([request.item, Object.entries(request.fields).map(([key, field]) => [key, fieldShape(field)])]);
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
var LABEL_MAX_LENGTH2, LABEL_PREFIX, DIGEST_SEEDS, FNV_PRIME;
var init_derived_record_output = __esm({
  "src/output-nodes/extract-list/derived-record-output.ts"() {
    "use strict";
    init_extraction2();
    init_record_output();
    init_records_path();
    LABEL_MAX_LENGTH2 = 200;
    LABEL_PREFIX = "Extracted list: ";
    DIGEST_SEEDS = [2166136261, 84696351];
    FNV_PRIME = 16777619;
  }
});

// src/output-nodes/extract-list/dispatch.ts
import { parseAutomationStudioRecordOutput } from "fluxiq/automation-studio/nodes";
function webAutomationExtractListDispatch(nodeParameters) {
  const { recordOutput: authored, ...rest } = nodeParameters;
  const request = webAutomationExtractListRequestValue(rest.extractList);
  const parameters = request !== void 0 && leftDefault(rest.timeoutMs) ? { ...rest, timeoutMs: webAutomationExtractListTimeoutMs(request) } : rest;
  const declared2 = authored === void 0 || authored === null ? request === void 0 ? void 0 : webAutomationDerivedRecordOutput(request) : withRecordsPath(authored);
  if (declared2 === void 0) return { ok: true, payload: { parameters } };
  const parsed = parseAutomationStudioRecordOutput(declared2);
  if (!parsed.ok) return { ok: false, result: recordOutputRefusal(parsed.issues) };
  return { ok: true, payload: { parameters, recordOutput: parsed.output } };
}
function leftDefault(timeoutMs) {
  return timeoutMs === void 0 || timeoutMs === WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS;
}
function withRecordsPath(authored) {
  if (typeof authored !== "object" || authored === null || Array.isArray(authored) || Object.hasOwn(authored, "recordsPath")) return authored;
  return { ...authored, recordsPath: WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH };
}
function recordOutputRefusal(issues) {
  const encryptUnavailable = issues.includes(ENCRYPT_UNAVAILABLE_ISSUE);
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
    outputs: { error: { code, issues: [...issues] } },
    message: encryptUnavailable ? "Save extracted records asks to encrypt a field, which is not available yet, so the list was not read." : "Save extracted records is not a valid record output, so the list was not read.",
    failure
  };
}
var ENCRYPT_UNAVAILABLE_ISSUE;
var init_dispatch = __esm({
  "src/output-nodes/extract-list/dispatch.ts"() {
    "use strict";
    init_extraction();
    init_derived_record_output();
    init_records_path();
    ENCRYPT_UNAVAILABLE_ISSUE = "record_schema.encrypt_unavailable";
  }
});

// src/output-nodes/extract-list/issues.ts
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
var PROBE_REQUEST, declared;
var init_issues = __esm({
  "src/output-nodes/extract-list/issues.ts"() {
    "use strict";
    init_extraction();
    PROBE_REQUEST = { item: "*", fields: { probe: "*" } };
  }
});

// src/output-nodes/extract-list/parameter-contract.ts
function webAutomationExtractListParameterContract(input) {
  return input.parameterId === "extractList" ? webAutomationExtractListIssues(input.value) : [];
}
var init_parameter_contract = __esm({
  "src/output-nodes/extract-list/parameter-contract.ts"() {
    "use strict";
    init_issues();
  }
});

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
var init_parameters = __esm({
  "src/output-nodes/extract-list/parameters.ts"() {
    "use strict";
    init_extraction();
    init_catalog_text();
  }
});

// src/output-nodes/extract-list/index.ts
var init_extract_list = __esm({
  "src/output-nodes/extract-list/index.ts"() {
    "use strict";
    init_catalog_text();
    init_derived_record_output();
    init_dispatch();
    init_issues();
    init_parameter_contract();
    init_parameters();
    init_record_output();
    init_records_path();
  }
});

// src/output-nodes/definitions.ts
function webAutomationOutputNodeId(outputId) {
  return `web.output.${outputId.replace(/^web\./, "").replace(/\./g, "-")}`;
}
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
var controlInput, outputPorts, recordsPort, recordsPathByOutput, catalogTextByOutput, VERIFIES_STATE_METADATA_KEY, stateVerifyingOutputs, expectedStateParameter, webAutomationOutputNodeDefinitions;
var init_definitions = __esm({
  "src/output-nodes/definitions.ts"() {
    "use strict";
    init_constants();
    init_safety();
    init_schemas();
    init_extract_list();
    controlInput = { id: "in", label: "In", valueType: "signal", role: "control" };
    outputPorts = [
      { id: "success", label: "Success", valueType: "any", role: "success" },
      { id: "failed", label: "Failed", valueType: "any", role: "failure" }
    ];
    recordsPort = { id: "records", label: "Records", valueType: "array", role: "data" };
    recordsPathByOutput = {
      "web.dom.extract_list": WEB_AUTOMATION_EXTRACT_LIST_RECORDS_PATH
    };
    catalogTextByOutput = {
      "web.dom.extract_list": { description: WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION, tags: WEB_AUTOMATION_EXTRACT_LIST_TAGS }
    };
    VERIFIES_STATE_METADATA_KEY = "verifiesState";
    stateVerifyingOutputs = /* @__PURE__ */ new Set([
      "web.dom.assert",
      "web.dom.wait_for_text",
      "web.dom.wait_for_selector"
    ]);
    expectedStateParameter = {
      id: "expectedState",
      label: "Expected State",
      description: "Post-conditions checked after this action, as web.dom.assert conditions: { conditions: [{ kind, selector, expected }], mode, timeoutMs }.",
      valueType: "object",
      ui: { control: "value" }
    };
    webAutomationOutputNodeDefinitions = webAutomationActionDefinitions.map(
      (definition) => createWebAutomationOutputNodeDefinition(definition)
    );
  }
});

// src/output-nodes/parameter-contracts.ts
var webAutomationOutputNodeParameterContracts;
var init_parameter_contracts = __esm({
  "src/output-nodes/parameter-contracts.ts"() {
    "use strict";
    init_definitions();
    init_extract_list();
    webAutomationOutputNodeParameterContracts = {
      [webAutomationOutputNodeId("web.dom.extract_list")]: webAutomationExtractListParameterContract
    };
  }
});

// src/actions/types.ts
var WEB_AUTOMATION_ACTION_TYPES;
var init_types = __esm({
  "src/actions/types.ts"() {
    "use strict";
    init_extraction();
    init_extraction();
    WEB_AUTOMATION_ACTION_TYPES = [
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
  }
});

// src/output-nodes/native-runtime.ts
var native_runtime_exports = {};
__export(native_runtime_exports, {
  WEB_AUTOMATION_IMPORTER_PACKAGE_ID: () => WEB_AUTOMATION_IMPORTER_PACKAGE_ID,
  WEB_AUTOMATION_IMPORTER_PACKAGE_VERSION: () => WEB_AUTOMATION_IMPORTER_PACKAGE_VERSION,
  WEB_AUTOMATION_RUNTIME_CAPABILITIES: () => WEB_AUTOMATION_RUNTIME_CAPABILITIES,
  WEB_AUTOMATION_RUNTIME_PERMISSIONS: () => WEB_AUTOMATION_RUNTIME_PERMISSIONS,
  createWebAutomationOutputNodeImplementationBundle: () => createWebAutomationOutputNodeImplementationBundle,
  createWebAutomationOutputNodeManifest: () => createWebAutomationOutputNodeManifest
});
function createWebAutomationOutputNodeManifest(extension = {}) {
  return {
    schemaVersion: "0.1",
    sdkVersion: "0.1",
    packageId: WEB_AUTOMATION_IMPORTER_PACKAGE_ID,
    packageVersion: WEB_AUTOMATION_IMPORTER_PACKAGE_VERSION,
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    nodes: webAutomationOutputNodeDefinitions,
    ...extension
  };
}
function createWebAutomationOutputNodeImplementationBundle(extension = {}) {
  return {
    packageId: WEB_AUTOMATION_IMPORTER_PACKAGE_ID,
    packageVersion: WEB_AUTOMATION_IMPORTER_PACKAGE_VERSION,
    implementations: Object.fromEntries(
      WEB_AUTOMATION_ACTION_TYPES.map((outputId) => [outputId, createOutputNodeImplementation(outputId)])
    ),
    // Core checks these when a Flow is planned, so a malformed extraction a
    // model wrote is refused before anything runs rather than at dispatch.
    parameterContracts: { ...webAutomationOutputNodeParameterContracts },
    ...extension
  };
}
function createOutputNodeImplementation(outputId) {
  return (context) => {
    const parameters = compactJsonObject(context.parameters);
    if (outputId !== "web.dom.extract_list") return dispatching({ outputId, parameters });
    const extraction = webAutomationExtractListDispatch(parameters);
    return extraction.ok ? dispatching({ outputId, ...extraction.payload }) : extraction.result;
  };
}
function dispatching(payload) {
  return {
    status: "success",
    route: "success",
    outputs: { success: true },
    effects: [{ type: "policy.output.dispatch", payload }]
  };
}
function compactJsonObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== void 0)
  );
}
var WEB_AUTOMATION_IMPORTER_PACKAGE_ID, WEB_AUTOMATION_IMPORTER_PACKAGE_VERSION, WEB_AUTOMATION_RUNTIME_CAPABILITIES, WEB_AUTOMATION_RUNTIME_PERMISSIONS;
var init_native_runtime = __esm({
  "src/output-nodes/native-runtime.ts"() {
    "use strict";
    init_constants();
    init_types();
    init_definitions();
    init_extract_list();
    init_parameter_contracts();
    WEB_AUTOMATION_IMPORTER_PACKAGE_ID = "@fluxiq-web-extension/domain";
    WEB_AUTOMATION_IMPORTER_PACKAGE_VERSION = "0.1.0";
    WEB_AUTOMATION_RUNTIME_CAPABILITIES = ["web.actions"];
    WEB_AUTOMATION_RUNTIME_PERMISSIONS = ["web-automation.action"];
  }
});

// src/output-nodes/tests/parameter-contracts.test.ts
init_definitions();
init_extract_list();
init_parameter_contracts();
import assert from "node:assert/strict";
import test from "node:test";
var extractListNodeId = webAutomationOutputNodeId("web.dom.extract_list");
test("only the list extraction node has a contract, and it names a registered node", () => {
  assert.deepEqual(Object.keys(webAutomationOutputNodeParameterContracts), [extractListNodeId]);
  const node = webAutomationOutputNodeDefinitions.find((definition) => definition.id === extractListNodeId);
  assert.equal(node?.source.kind, "importer");
  assert.equal(webAutomationOutputNodeParameterContracts[extractListNodeId], webAutomationExtractListParameterContract);
});
test("the contract checks extractList and nothing else", () => {
  const ask = (parameterId, value) => webAutomationExtractListParameterContract({ definitionId: extractListNodeId, parameterId, value });
  assert.deepEqual(ask("extractList", { item: "li", fields: { name: ".name" } }), []);
  assert.deepEqual([...ask("extractList", { nonsense: true })].sort(), [
    "web.extract_list.invalid_fields",
    "web.extract_list.invalid_item",
    "web.extract_list.unknown_key"
  ]);
  assert.deepEqual(ask("extractList", { item: { $state: { path: "run.item" } }, fields: { name: ".name" } }), ["web.extract_list.invalid_item"]);
  assert.deepEqual(ask("timeoutMs", "not a number"), []);
  assert.deepEqual(ask("recordOutput", { nonsense: true }), [], "Core parses a record output itself");
});
test("every code the contract can return has the form Core accepts", () => {
  const malformed = [
    null,
    "x",
    {},
    { item: "", fields: { "bad key": 1, a: { kind: "text", nope: 1 } }, itemElement: 1, paginate: { mode: "x", extra: 1 }, maxItems: 0, minItems: -1, frame: 1 },
    { item: "li", fields: { a: { kind: "text", handling: "exclude" } }, minItems: 2e3 },
    { item: "li", fields: {} }
  ];
  const seen = /* @__PURE__ */ new Set();
  for (const value of malformed) {
    const codes = webAutomationExtractListParameterContract({ definitionId: extractListNodeId, parameterId: "extractList", value });
    assert.notDeepEqual(codes, [], JSON.stringify(value));
    for (const code of codes) seen.add(code);
  }
  for (const code of seen) {
    assert.match(code, /^[a-z0-9_]+(\.[a-z0-9_]+)+$/u);
    assert.equal(code.length <= 120, true);
    assert.equal(code.startsWith("bootstrap."), false);
    assert.equal(code.startsWith("web.extract_list."), true);
  }
});
test("the implementation bundle hands Core the extraction contract, so a bad plan is refused before it runs", async () => {
  const { createWebAutomationOutputNodeImplementationBundle: createWebAutomationOutputNodeImplementationBundle2 } = await Promise.resolve().then(() => (init_native_runtime(), native_runtime_exports));
  const bundle = createWebAutomationOutputNodeImplementationBundle2();
  const id = webAutomationOutputNodeId("web.dom.extract_list");
  assert.equal(bundle.parameterContracts?.[id], webAutomationExtractListParameterContract);
  assert.deepEqual(Object.keys(bundle.parameterContracts ?? {}), [id]);
  assert.equal(createWebAutomationOutputNodeImplementationBundle2({}).parameterContracts?.[id], webAutomationExtractListParameterContract);
});
