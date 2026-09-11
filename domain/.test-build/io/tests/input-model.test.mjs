// src/io/tests/input-model.test.ts
import assert from "node:assert/strict";

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
    attributes: { type: "object", label: "Attributes" }
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
var webAutomationActionDefinitions = [
  {
    actionType: "web.browser.navigate",
    label: "Navigate",
    description: "Navigate a browser tab to a URL.",
    parameterSchema: { type: "object", required: ["url"], properties: { url: { type: "string", label: "URL" } } }
  },
  { actionType: "web.dom.click", label: "Click", description: "Click a DOM element.", parameterSchema: selectorSchema },
  {
    actionType: "web.dom.type",
    label: "Type Text",
    description: "Enter text into an editable DOM element.",
    parameterSchema: { type: "object", required: ["selector"], properties: { ...elementProperties, text: { type: "string" }, value: { type: "string" } } }
  },
  { actionType: "web.dom.clear", label: "Clear Field", description: "Clear an editable DOM element.", parameterSchema: selectorSchema },
  {
    actionType: "web.dom.select",
    label: "Select Option",
    description: "Set a select element value.",
    parameterSchema: { type: "object", required: ["selector"], properties: { ...elementProperties, value: { type: "string" } } }
  },
  {
    actionType: "web.dom.scroll",
    label: "Scroll",
    description: "Scroll the page or targeted context.",
    parameterSchema: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, smooth: { type: "boolean" } } }
  },
  {
    actionType: "web.dom.keypress",
    label: "Key Press",
    description: "Dispatch a keyboard event.",
    parameterSchema: { type: "object", properties: { ...elementProperties, key: { type: "string" }, text: { type: "string" } } }
  },
  { actionType: "web.dom.wait_for_selector", label: "Wait For Selector", description: "Wait until an element exists.", parameterSchema: selectorSchema },
  {
    actionType: "web.dom.wait_for_text",
    label: "Wait For Text",
    description: "Wait until page text appears.",
    parameterSchema: { type: "object", required: ["text"], properties: { text: { type: "string" }, timeoutMs: { type: "integer" } } }
  },
  { actionType: "web.dom.extract", label: "Extract", description: "Extract text, value, or attributes from an element.", parameterSchema: selectorSchema },
  {
    actionType: "web.dom.capture_snapshot",
    label: "Capture Snapshot",
    description: "Capture a structured DOM snapshot.",
    parameterSchema: { type: "object", properties: {} }
  },
  // The seven actions added in Week 1 (decision D6). Every action type must
  // have a definition here: the manifest outputs, the output nodes, and the
  // registered domain outputs all derive from this table, and
  // `createWebAutomationDomainIo` throws for a listed output with no
  // definition. These are the minimum that keeps the registry total;
  // `w2-domain-vocabulary` owns their final parameter shapes, node parameters,
  // payload mapping, and inputs.
  {
    actionType: "web.dom.check",
    label: "Set Checked",
    description: "Set a checkbox or radio to a state.",
    parameterSchema: { type: "object", required: ["selector"], properties: { ...elementProperties, checked: { type: "boolean", label: "Checked" } } }
  },
  {
    actionType: "web.dom.assert",
    label: "Assert",
    description: "Assert a condition about the page and fail when it does not hold.",
    parameterSchema: {
      type: "object",
      required: ["kind"],
      properties: {
        ...elementProperties,
        kind: { type: "string", label: "Condition" },
        expected: { type: "string", label: "Expected" },
        timeoutMs: { type: "integer", label: "Timeout in ms" }
      }
    }
  },
  {
    actionType: "web.dom.extract_list",
    label: "Extract List",
    description: "Extract a field map from every item of a repeating structure, following pagination.",
    parameterSchema: {
      type: "object",
      required: ["item"],
      properties: {
        item: { type: "string", label: "Item selector" },
        fields: { type: "object", label: "Field map" },
        paginate: { type: "object", label: "Pagination" },
        maxItems: { type: "integer", label: "Maximum items" }
      }
    }
  },
  {
    actionType: "web.dom.upload",
    label: "Upload Files",
    description: "Set the files of a file input.",
    parameterSchema: { type: "object", required: ["selector"], properties: { ...elementProperties, files: { type: "array", label: "Files" } } }
  },
  {
    actionType: "web.dom.dialog",
    label: "Answer Dialog",
    description: "Arm the answer to the next native alert, confirm, or prompt.",
    parameterSchema: {
      type: "object",
      required: ["response"],
      properties: { response: { type: "string", label: "Response" }, promptText: { type: "string", label: "Prompt text" } }
    }
  },
  {
    actionType: "web.browser.tab",
    label: "Browser Tab",
    description: "Open, switch to, or close a browser tab.",
    parameterSchema: {
      type: "object",
      required: ["operation"],
      properties: {
        operation: { type: "string", label: "Operation" },
        url: { type: "string", label: "URL" },
        tabId: { type: "integer", label: "Tab id" },
        urlPattern: { type: "string", label: "URL contains" }
      }
    }
  },
  {
    actionType: "web.browser.download",
    label: "Await Download",
    description: "Wait for a browser download to complete.",
    parameterSchema: {
      type: "object",
      properties: { filename: { type: "string", label: "File name" }, timeoutMs: { type: "integer", label: "Timeout in ms" } }
    }
  }
];

// src/output-nodes/definitions.ts
var controlInput = { id: "in", label: "In", valueType: "signal", role: "control" };
var outputPorts = [
  { id: "success", label: "Success", valueType: "any", role: "success" },
  { id: "failed", label: "Failed", valueType: "any", role: "failure" }
];
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
  return {
    schemaVersion: "0.1",
    id: webAutomationOutputNodeId(definition.actionType),
    version: "1.0.0",
    label: definition.label,
    description: definition.description,
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
    outputs: outputPorts,
    parameters: parametersForOutput(definition.actionType).map((parameter) => ({
      ...parameter,
      ...requiredParameters.has(parameter.id) ? { required: true } : {},
      allowStateBinding: true
    })),
    icon: iconForOutput(definition.actionType),
    tags: ["web-automation", "output"],
    metadata: {
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      outputId: definition.actionType,
      parameterSchema: definition.parameterSchema
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
  if (outputId === "web.browser.navigate") return [{ id: "url", label: "URL", valueType: "string", required: true, ui: { control: "text", placeholder: "https://example.com" } }];
  if (outputId === "web.dom.type") return [...selectorParameters, { id: "text", label: "Text", valueType: "string", defaultValue: "", ui: { control: "textarea" } }];
  if (outputId === "web.dom.select") return [...selectorParameters, { id: "value", label: "Value", valueType: "string", defaultValue: "", ui: { control: "text" } }];
  if (outputId === "web.dom.keypress") return [...selectorParameters, { id: "key", label: "Key", valueType: "string", defaultValue: "", ui: { control: "text" } }];
  if (outputId === "web.dom.scroll") return [
    { id: "x", label: "X", valueType: "number", defaultValue: 0 },
    { id: "y", label: "Y", valueType: "number", defaultValue: 0 },
    { id: "smooth", label: "Smooth", valueType: "boolean", defaultValue: false }
  ];
  if (outputId === "web.dom.wait_for_text") return [
    { id: "text", label: "Text", valueType: "string", required: true, ui: { control: "text" } },
    { id: "timeoutMs", label: "Timeout", valueType: "number", defaultValue: 1e4 }
  ];
  if (outputId === "web.dom.capture_snapshot") return [];
  return selectorParameters;
}
function iconForOutput(outputId) {
  if (outputId === "web.browser.navigate") return "navigation";
  if (outputId === "web.dom.click") return "mouse-pointer-click";
  if (outputId === "web.dom.type") return "text-cursor-input";
  if (outputId === "web.dom.extract") return "scan-search";
  if (outputId === "web.dom.capture_snapshot") return "camera";
  return "square-dot";
}

// src/output-nodes/targets.ts
function elementFingerprint(value) {
  const element = objectValue(value);
  if (!element) return void 0;
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
    name: stringValue(element.name),
    href: stringValue(element.href),
    inputType: stringValue(element.inputType),
    attributes: objectValue(element.attributes)
  });
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

// src/output-nodes/payloads.ts
function webAutomationOutputPayload(outputId, payload) {
  const element = elementFingerprint(payload.element);
  const selector = stringValue(element?.selector);
  const visualTarget2 = objectValue(payload.visualTarget);
  const target = compact({ ...element ? { element } : {}, ...visualTarget2 ? { visualTarget: visualTarget2 } : {} });
  const hasTarget = Object.keys(target).length > 0;
  if (outputId === "web.browser.navigate") return compact({ url: stringValue(payload.url) });
  if (outputId === "web.dom.click" || outputId === "web.dom.clear") return compact({ selector, ...hasTarget ? target : {} });
  if (outputId === "web.dom.type") return compact({ selector, text: stringValue(payload.inputValue) ?? "", ...hasTarget ? target : {} });
  if (outputId === "web.dom.select") return compact({ selector, value: stringValue(payload.inputValue) ?? "", ...hasTarget ? target : {} });
  if (outputId === "web.dom.keypress") return compact({ selector, key: stringValue(payload.key) ?? "", ...hasTarget ? target : {} });
  if (outputId === "web.dom.scroll") {
    const scroll = objectValue(payload.scroll);
    return compact({ x: numberValue(scroll?.x), y: numberValue(scroll?.y) });
  }
  if (outputId === "web.dom.wait_for_selector") return compact({ selector, ...hasTarget ? target : {} });
  if (outputId === "web.dom.wait_for_text") return compact({ text: stringValue(payload.inputValue) ?? stringValue(payload.title) });
  if (outputId === "web.dom.extract") return compact({ selector, ...hasTarget ? target : {} });
  if (outputId === "web.dom.capture_snapshot") return {};
  return {};
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
  keyPressed: "web.user.key_pressed",
  pageScrolled: "web.user.page_scrolled"
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
  [WEB_AUTOMATION_INPUT_IDS.keyPressed, "Key pressed", "web.dom.keypress"],
  [WEB_AUTOMATION_INPUT_IDS.pageScrolled, "Page scrolled", "web.dom.scroll"]
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
      return WEB_AUTOMATION_INPUT_IDS.keyPressed;
    // The recorder emits `dom.scroll` for wheel and window scrolling alike;
    // `dom.wheel` is never emitted, so its event type maps to no input.
    case WEB_AUTOMATION_EVENTS.scrollChanged:
      return WEB_AUTOMATION_INPUT_IDS.pageScrolled;
    // Checkbox and radio changes still map to text entry; Phase 1.2 adds web.dom.check.
    case WEB_AUTOMATION_EVENTS.elementInputChanged:
    case WEB_AUTOMATION_EVENTS.elementChanged:
      if (objectValue2(payload.element)?.tagName === "select") return WEB_AUTOMATION_INPUT_IDS.optionSelected;
      return payload.inputValue === "" ? WEB_AUTOMATION_INPUT_IDS.fieldCleared : WEB_AUTOMATION_INPUT_IDS.textEntered;
    default:
      return void 0;
  }
}
function hasExecutableParameters(outputId, parameters) {
  const schema = webAutomationActionDefinitions.find((definition) => definition.actionType === outputId)?.parameterSchema;
  const required = Array.isArray(schema?.required) ? schema.required.filter((key) => typeof key === "string") : [];
  if (!required.every((key) => isNonEmptyString(parameters[key]))) return false;
  if (outputId === "web.dom.keypress") return isNonEmptyString(parameters.key);
  if (outputId === "web.dom.scroll") return typeof parameters.x === "number" || typeof parameters.y === "number";
  return true;
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}
function objectValue2(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}

// src/io/tests/input-model.test.ts
var button = { selector: "#save", tagName: "button", text: "Save", xpath: "/html/body/form/button", id: "save", role: "button" };
var field = { selector: "input[name=q]", tagName: "input", inputType: "text", name: "q", xpath: "/html/body/form/input" };
var planSelect = { selector: "select#plan", tagName: "select", id: "plan" };
var termsCheckbox = { selector: "input#terms", tagName: "input", inputType: "checkbox", id: "terms" };
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
    // Pinned as it is today: Phase 1.2 adds web.dom.check and moves this row.
    row: "9 dom.change, checkbox",
    event: recorded("dom.change", { element: termsCheckbox, inputValue: "on" }),
    eventType: WEB_AUTOMATION_EVENTS.elementChanged,
    inputId: WEB_AUTOMATION_INPUT_IDS.textEntered,
    outputId: "web.dom.type"
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
var recordableOutputs = actionInputDefinitions.map(([, , outputId]) => outputId);
var dispatchOnlyOutputs = [
  "web.dom.wait_for_selector",
  "web.dom.wait_for_text",
  "web.dom.extract",
  "web.dom.capture_snapshot",
  // Added in Week 1 (decision D6). None is produced from a recorded user
  // action yet; `w2-domain-vocabulary` gives `web.dom.check` its recording
  // input, at which point it moves to the recordable list.
  "web.dom.check",
  "web.dom.assert",
  "web.dom.extract_list",
  "web.dom.upload",
  "web.dom.dialog",
  "web.browser.tab",
  "web.browser.download"
];
assert.equal(new Set(recordableOutputs).size, recordableOutputs.length, "each action input maps to its own output");
assert.deepEqual([...recordableOutputs, ...dispatchOnlyOutputs].sort(), [...WEB_AUTOMATION_ACTION_TYPES].sort(), "every output is recordable or dispatch-only");
for (const outputId of dispatchOnlyOutputs) {
  assert.equal(recordableOutputs.includes(outputId), false, `${outputId} is dispatch-only`);
}
assert.equal(stateInputDefinitions.every((input) => input.role !== "action"), true);
var stateInputIds = stateInputDefinitions.map((input) => input.id);
for (const { event, eventType } of rows) {
  const inputId = webAutomationRecordedAction(eventType, event, event.metadata)?.inputId;
  assert.equal(inputId !== void 0 && stateInputIds.includes(inputId), false);
}
console.log("Web automation input model tests passed.");
