// src/io/tests/gateway-input-hub.test.ts
import assert from "node:assert/strict";

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

// src/runtime/capabilities.ts
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

// src/recording/state.ts
var WEB_AUTOMATION_STATE_NAMESPACE = "web";

// src/recording/web-state.ts
var WEB_AUTOMATION_SCREEN_FRAME_ID = "screen";
function webAutomationActionTargetFromElement(element) {
  return compactJsonObject({
    type: element.role ?? element.inputType ?? element.tagName,
    id: stableAttribute(element, "data-testid") ?? stableAttribute(element, "id") ?? stableAttribute(element, "name"),
    label: element.name ?? element.visibleText ?? element.text ?? element.value,
    selector: element.selector,
    bounds: element.bounds,
    metadata: compactJsonObject({
      tagName: element.tagName,
      xpath: element.xpath,
      id: element.id,
      classNames: element.classNames,
      visibleText: element.visibleText,
      role: element.role,
      href: element.href,
      inputType: element.inputType,
      documentBounds: stateBounds(element.documentBounds),
      isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(stateBounds(element.bounds)),
      hasClickHandler: element.hasClickHandler,
      attributes: element.attributes
    })
  });
}
function webAutomationActionVisualTargetFromElement(element, input = {}) {
  const stateId = elementStateId(element);
  const statePath = `${WEB_AUTOMATION_STATE_NAMESPACE}.elements.${stateId}`;
  const bounds = stateBounds(element.bounds);
  const documentBounds = stateBounds(element.documentBounds ?? element.bounds);
  const anchorBounds = documentBounds ?? bounds;
  const safeId = safeLayerId(stateId, input.layerIndex ?? 1);
  return compactJsonObject({
    namespace: WEB_AUTOMATION_STATE_NAMESPACE,
    statePath,
    selector: element.selector,
    frameId: WEB_AUTOMATION_SCREEN_FRAME_ID,
    layerId: `element.${safeId}`,
    documentLayerId: `document.element.${safeId}`,
    bounds,
    documentBounds,
    anchor: anchorBounds ? { type: "bounds", bounds: anchorBounds } : void 0,
    confidence: input.confidence ?? (stableElementId(element) ? 0.98 : 0.88),
    metadata: compactJsonObject({
      tagName: element.tagName,
      xpath: element.xpath,
      id: element.id,
      classNames: element.classNames,
      visibleText: element.visibleText,
      role: element.role,
      name: element.name,
      href: element.href,
      inputType: element.inputType,
      stableId: stableElementId(element),
      isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(bounds)
    })
  });
}
function elementStateId(element) {
  const stable = stableElementPathId(element);
  if (stable) return sanitizeStateId(stable);
  const name = stableAttribute(element, "name");
  if (name) return sanitizeStateId(`${name}.${element.selector}`);
  return sanitizeStateId(element.selector);
}
function stableElementId(element) {
  return stableAttribute(element, "data-testid") ?? stableAttribute(element, "data-test") ?? stableAttribute(element, "data-cy") ?? stableAttribute(element, "id") ?? stableAttribute(element, "name");
}
function stableElementPathId(element) {
  return stableAttribute(element, "data-testid") ?? stableAttribute(element, "data-test") ?? stableAttribute(element, "data-cy") ?? stableAttribute(element, "id");
}
function sanitizeStateId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 120) || "element";
}
function meaningfulText(value) {
  return typeof value === "string" && value.trim().length >= 2;
}
function stableAttribute(element, name) {
  const value = element.attributes?.[name];
  return meaningfulText(value) ? value : void 0;
}
function stateBounds(bounds) {
  if (!bounds) return void 0;
  const x = finite(bounds.x);
  const y = finite(bounds.y);
  const width = positiveFinite(bounds.width);
  const height = positiveFinite(bounds.height);
  return x !== void 0 && y !== void 0 && width !== void 0 && height !== void 0 ? { x, y, width, height } : void 0;
}
function finite(value) {
  return Number.isFinite(value) ? value : void 0;
}
function positiveFinite(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
function safeLayerId(value, fallbackIndex) {
  return value.replace(/[^a-z0-9.]+/gi, ".").replace(/^\.+|\.+$/g, "").slice(0, 80) || String(fallbackIndex);
}
function compactJsonObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}

// src/client/gateway-mapping.ts
function createWebAutomationRecordingEvent(payload, input = {}) {
  const eventType = webAutomationEventTypeForClientKind(payload.kind);
  const target = payload.element;
  const visualTarget = payload.visualTarget ?? (target !== void 0 ? webAutomationActionVisualTargetFromElement(target) : void 0);
  return {
    eventId: `web.${payload.sequence}.${payload.eventTimestampMs}`,
    ...input.recordingId !== void 0 ? { recordingId: input.recordingId } : {},
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    eventType,
    timestamp: payload.eventTimestampMs,
    ...input.tabId === void 0 ? {} : { sourceId: `tab:${input.tabId}${input.frameId === void 0 ? "" : `:frame:${input.frameId}`}` },
    ...target !== void 0 ? { target: webAutomationActionTargetFromElement(target) } : {},
    payload: compactJsonObject2({
      url: payload.url,
      title: payload.title,
      sequence: payload.sequence,
      element: payload.element,
      visualTarget,
      inputValue: payload.inputValue,
      key: payload.key,
      scroll: payload.scroll,
      mutation: payload.mutation,
      snapshot: payload.snapshot,
      actionResult: payload.actionResult,
      ...payload.metadata?.recordingState !== void 0 ? { recordingState: payload.metadata.recordingState } : {}
    }),
    metadata: compactJsonObject2({
      clientKind: payload.kind,
      ...visualTarget !== void 0 ? { visualTarget } : {},
      ...payload.metadata ?? {}
    })
  };
}
function createWebAutomationStateUpdate(input) {
  return {
    ...input.activeContextId !== void 0 ? { activeContextId: input.activeContextId } : {},
    ...input.contexts !== void 0 ? { contexts: input.contexts } : {},
    ...input.state !== void 0 ? { state: input.state } : {},
    ...input.recording !== void 0 ? { recording: input.recording } : {},
    metadata: compactJsonObject2({
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      ...input.metadata ?? {}
    })
  };
}
var UNSUPPORTED_ACTION_TYPE_FAILURE = Object.freeze({
  category: "blocked_by_capability_or_policy",
  code: "web.action.unsupported_type",
  retryable: false,
  stage: "dispatch"
});
var CANONICAL_ACTION_TYPES = new Set(WEB_AUTOMATION_ACTION_TYPES);
var LEGACY_ACTION_TYPE_ALIASES = new Map(
  Object.entries(WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER).map(([canonical, legacy]) => [legacy, canonical])
);
function compactJsonObject2(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}

// src/io/gateway-input-hub.ts
var GatewayInputHub = class {
  listeners = /* @__PURE__ */ new Map();
  constructor(fluxiq2) {
    fluxiq2.programs.clientGateway.onEvent((event) => this.accept(event));
  }
  subscribe(inputId, handler) {
    const handlers = this.listeners.get(inputId) ?? /* @__PURE__ */ new Set();
    handlers.add(handler);
    this.listeners.set(inputId, handlers);
    return () => {
      handlers.delete(handler);
      if (!handlers.size) this.listeners.delete(inputId);
    };
  }
  accept(event) {
    if (event.type !== "client.recording_event" && event.type !== "client.state_update") return;
    const messagePayload = jsonObject(event.message.payload);
    if (!messagePayload) return;
    const metadata = jsonObject(messagePayload.metadata);
    const domainId = stringValue2(messagePayload.domainId) ?? stringValue2(metadata?.domainId);
    if (domainId !== WEB_AUTOMATION_DOMAIN_ID) return;
    const inputId = stringValue2(metadata?.inputId);
    if (!inputId) return;
    const payload = event.type === "client.recording_event" ? jsonObject(messagePayload.payload) ?? {} : jsonObject(messagePayload.state) ?? messagePayload;
    const envelope = {
      id: event.message.id,
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      ioId: inputId,
      sequence: typeof payload.sequence === "number" ? payload.sequence : 0,
      timestampMs: event.message.timestamp ?? Date.now(),
      payload,
      metadata: { sessionId: event.session.sessionId, clientId: event.session.clientId, ...metadata }
    };
    for (const handler of this.listeners.get(inputId) ?? []) handler(envelope);
  }
};
function stringValue2(value) {
  return typeof value === "string" ? value : void 0;
}
function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}

// src/io/tests/gateway-input-hub.test.ts
var emit = () => {
  throw new Error("GatewayInputHub did not subscribe to client gateway events.");
};
var fluxiq = {
  programs: {
    clientGateway: {
      onEvent(listener) {
        emit = listener;
        return () => void 0;
      }
    }
  }
};
var hub = new GatewayInputHub(fluxiq);
var session = { sessionId: "session.1", clientId: "client.1" };
var messageSequence = 0;
function gatewayMessage(type, payload) {
  messageSequence += 1;
  return { type, session, message: { id: `message.${messageSequence}`, type, timestamp: 1e3 + messageSequence, payload } };
}
var clicked = [];
var unsubscribeClicked = hub.subscribe(WEB_AUTOMATION_INPUT_IDS.elementClicked, (event) => clicked.push(event));
var browserState = [];
hub.subscribe(WEB_AUTOMATION_INPUT_IDS.browserState, (event) => browserState.push(event));
var userClick = createWebAutomationRecordingEvent({
  kind: "dom.click",
  sequence: 7,
  url: "https://example.test/form",
  title: "Form",
  eventTimestampMs: 10,
  element: { selector: "#save", tagName: "button", text: "Save" },
  metadata: { inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked }
});
assert.equal(userClick.domainId, WEB_AUTOMATION_DOMAIN_ID);
assert.equal(userClick.metadata?.domainId, void 0, "the recorded event names its domain only at the top level");
emit(gatewayMessage("client.recording_event", userClick));
assert.equal(clicked.length, 1, "a user-recorded action reaches its input subscribers");
assert.equal(clicked[0]?.ioId, WEB_AUTOMATION_INPUT_IDS.elementClicked);
assert.equal(clicked[0]?.domainId, WEB_AUTOMATION_DOMAIN_ID);
assert.equal(clicked[0]?.sequence, 7);
assert.equal(clicked[0]?.payload.element?.selector, "#save");
assert.equal(clicked[0]?.metadata?.sessionId, "session.1");
assert.equal(clicked[0]?.metadata?.clientId, "client.1");
assert.equal(clicked[0]?.metadata?.inputId, WEB_AUTOMATION_INPUT_IDS.elementClicked);
emit(gatewayMessage("client.recording_event", {
  eventType: "web.element.clicked",
  payload: { sequence: 8, element: { selector: "#save" } },
  metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked }
}));
assert.equal(clicked.length, 2, "a runtime confirmation reaches its input subscribers");
assert.equal(clicked[1]?.sequence, 8);
emit(gatewayMessage("client.recording_event", {
  domainId: "another-domain",
  eventType: "web.element.clicked",
  payload: { sequence: 9 },
  metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked }
}));
emit(gatewayMessage("client.recording_event", { eventType: "web.element.clicked", payload: { sequence: 10 }, metadata: { inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked } }));
emit(gatewayMessage("client.recording_event", { domainId: WEB_AUTOMATION_DOMAIN_ID, eventType: "web.dom.mutated", payload: { sequence: 11 }, metadata: {} }));
emit(gatewayMessage("client.recording_event", void 0));
emit(gatewayMessage("client.snapshot", { domainId: WEB_AUTOMATION_DOMAIN_ID, metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked } }));
assert.equal(clicked.length, 2, "another domain, no domain, no input id, no payload, and other message types are not delivered");
emit(gatewayMessage("client.state_update", createWebAutomationStateUpdate({
  state: { sequence: 12, url: "https://example.test/form" },
  metadata: { inputId: WEB_AUTOMATION_INPUT_IDS.browserState }
})));
assert.equal(browserState.length, 1);
assert.equal(browserState[0]?.payload.url, "https://example.test/form");
assert.equal(browserState[0]?.sequence, 12);
assert.equal(clicked.length, 2, "an envelope reaches only the subscribers of its own input");
unsubscribeClicked();
emit(gatewayMessage("client.recording_event", userClick));
assert.equal(clicked.length, 2, "an unsubscribed handler receives nothing");
console.log("Gateway input hub tests passed.");
