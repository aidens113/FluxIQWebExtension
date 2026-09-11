// src/shared/constants.ts
var DEFAULT_GATEWAY_URL = "ws://127.0.0.1:4777/client";
var DEFAULT_CORE_API_URL = "http://127.0.0.1:3000";
var LEGACY_GATEWAY_CORE_API_URL = "http://127.0.0.1:4777";
var HEARTBEAT_INTERVAL_MS = 2e4;
var RECONNECT_BASE_DELAY_MS = 1e3;
var RECONNECT_MAX_DELAY_MS = 3e4;
var MAX_EVENT_QUEUE_SIZE = 1e3;
var STORAGE_KEYS = {
  settings: "fluxiq.settings",
  session: "fluxiq.session",
  clientId: "fluxiq.clientId",
  queuedEvents: "fluxiq.queuedEvents"
};
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
  statusChanged: "fluxiq.statusChanged"
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
function browserDescriptor() {
  return {
    clientKind: "browser_extension",
    clientName: "FluxIQ Browser Extension",
    extensionVersion: chrome.runtime.getManifest().version,
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

// ../../domain/src/constants.ts
var WEB_AUTOMATION_DOMAIN_ID = "web-automation";
var WEB_AUTOMATION_SCHEMA_VERSION = "0.1";
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

// ../../domain/src/actions/types.ts
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
  "web.dom.capture_snapshot"
];
var LEGACY_BROWSER_ACTION_TO_WEB_AUTOMATION = {
  "browser.navigate": "web.browser.navigate",
  "dom.click": "web.dom.click",
  "dom.type": "web.dom.type",
  "dom.clear": "web.dom.clear",
  "dom.select": "web.dom.select",
  "dom.scroll": "web.dom.scroll",
  "dom.keypress": "web.dom.keypress",
  "dom.wait_for_selector": "web.dom.wait_for_selector",
  "dom.wait_for_text": "web.dom.wait_for_text",
  "dom.extract": "web.dom.extract",
  "dom.capture_snapshot": "web.dom.capture_snapshot"
};
var WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER = Object.fromEntries(
  Object.entries(LEGACY_BROWSER_ACTION_TO_WEB_AUTOMATION).map(([legacy, canonical]) => [canonical, legacy])
);

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
  }
];

// ../../domain/src/io/input-model.ts
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
function webAutomationInputIdForRecordedEvent(payload) {
  if (payload.kind === "browser.navigation") return payload.metadata?.transition === "typed" ? WEB_AUTOMATION_INPUT_IDS.navigationRequested : void 0;
  if (payload.kind === "dom.click") return WEB_AUTOMATION_INPUT_IDS.elementClicked;
  if (payload.kind === "dom.keydown") return WEB_AUTOMATION_INPUT_IDS.keyPressed;
  if (payload.kind === "dom.wheel") return WEB_AUTOMATION_INPUT_IDS.pageScrolled;
  if (payload.kind === "dom.input" || payload.kind === "dom.change") {
    if (payload.element?.tagName === "select") return WEB_AUTOMATION_INPUT_IDS.optionSelected;
    return payload.inputValue === "" ? WEB_AUTOMATION_INPUT_IDS.fieldCleared : WEB_AUTOMATION_INPUT_IDS.textEntered;
  }
  return void 0;
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

// ../../domain/src/runtime/capabilities.ts
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

// ../../domain/src/actions/capabilities.ts
var webAutomationClientCapabilities = webAutomationGatewayCapabilities;

// ../../domain/src/output-nodes/definitions.ts
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
  const safeOutput = isSafeOutput(definition.actionType);
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
function isSafeOutput(outputId) {
  return outputId === "web.dom.extract" || outputId === "web.dom.capture_snapshot" || outputId.startsWith("web.dom.wait");
}
function iconForOutput(outputId) {
  if (outputId === "web.browser.navigate") return "navigation";
  if (outputId === "web.dom.click") return "mouse-pointer-click";
  if (outputId === "web.dom.type") return "text-cursor-input";
  if (outputId === "web.dom.extract") return "scan-search";
  if (outputId === "web.dom.capture_snapshot") return "camera";
  return "square-dot";
}

// ../../domain/src/recording/state.ts
var WEB_AUTOMATION_STATE_NAMESPACE = "web";
function createWebAutomationInitialState(timestamp = Date.now()) {
  return {
    timestamp,
    namespaces: {
      [WEB_AUTOMATION_STATE_NAMESPACE]: {
        schemaId: WEB_AUTOMATION_DOMAIN_ID,
        schemaVersion: WEB_AUTOMATION_SCHEMA_VERSION,
        values: {},
        metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID }
      }
    }
  };
}

// ../../domain/src/recording/web-state.ts
var MAX_STATE_ELEMENTS = 1500;
var MAX_VISUAL_FRAME_ELEMENTS = 1e3;
var WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID = "web-automation.viewport";
var WEB_AUTOMATION_SCREEN_FRAME_ID = "screen";
var WEB_AUTOMATION_DOCUMENT_FRAME_ID = "document";
function createWebAutomationStateFromSnapshot(snapshot, input = {}) {
  const timestamp = input.timestamp ?? Date.now();
  let state = createWebAutomationInitialState(timestamp);
  state = putStateValue(state, "page.url", "string", snapshot.url, timestamp, input.sourceId, { elementKind: "url" });
  state = putStateValue(state, "page.title", "string", snapshot.title, timestamp, input.sourceId, { elementKind: "text" });
  state = putStateValue(state, "viewport.bounds", "rectangle", { x: 0, y: 0, width: snapshot.viewport.width, height: snapshot.viewport.height }, timestamp, input.sourceId, { elementKind: "bounds", volatility: "normal" });
  state = putStateValue(state, "scroll.position", "point", { x: snapshot.viewport.scrollX, y: snapshot.viewport.scrollY }, timestamp, input.sourceId, { elementKind: "position", volatility: "rapid" });
  if (snapshot.selectedText) state = putStateValue(state, "page.selectedText", "string", snapshot.selectedText, timestamp, input.sourceId, { elementKind: "text" });
  if (snapshot.focusedElement) {
    const target = webAutomationActionTargetFromElement(snapshot.focusedElement);
    state = putStateValue(state, "focus.target", "json", target, timestamp, input.sourceId, { elementKind: "json", volatility: "rapid" });
  }
  const elements = filterStateElements(snapshot.interactiveElements);
  state = putStateValue(state, "elements.count", "integer", elements.length, timestamp, input.sourceId, { elementKind: "count" });
  for (const element of elements) state = addElementStateValues(state, element, timestamp, input.sourceId);
  return withScreenVisualFrame(state, snapshot, elements, input);
}
function createWebAutomationStateFromTabs(active, tabs, input = {}) {
  const timestamp = input.timestamp ?? Date.now();
  let state = createWebAutomationInitialState(timestamp);
  if (active?.url) state = putStateValue(state, "page.url", "string", active.url, timestamp, input.sourceId, { elementKind: "url" });
  if (active?.title) state = putStateValue(state, "page.title", "string", active.title, timestamp, input.sourceId, { elementKind: "text" });
  if (active?.tabId !== void 0) state = putStateValue(state, "browser.activeTabId", "integer", active.tabId, timestamp, input.sourceId, { elementKind: "internal_id" });
  state = putStateValue(state, "browser.tabCount", "integer", tabs.length, timestamp, input.sourceId, { elementKind: "count" });
  state = putStateValue(state, "recording.active", "boolean", input.recording === true, timestamp, input.sourceId, { elementKind: "status" });
  if (input.permissions?.length) state = putStateValue(state, "browser.permissions", "json", input.permissions, timestamp, input.sourceId, { elementKind: "collection", comparable: false });
  return state;
}
function filterStateElements(elements, limit = MAX_STATE_ELEMENTS) {
  const seen = /* @__PURE__ */ new Set();
  const filtered = [];
  const prioritized = [...elements].sort(
    (left, right) => stateElementBucket(left) - stateElementBucket(right) || stateElementScore(right) - stateElementScore(left)
  );
  for (const element of prioritized) {
    if (!shouldCaptureElementState(element)) continue;
    const id = elementStateId(element);
    if (seen.has(id)) continue;
    seen.add(id);
    filtered.push(element);
    if (filtered.length >= limit) break;
  }
  return filtered;
}
function shouldCaptureElementState(element) {
  if (!hasElementBounds(element)) return false;
  return Boolean(
    isLikelyInteractableElement(element) && hasMeaningfulElementIdentity(element) || meaningfulText(element.text) || meaningfulText(element.visibleText) || meaningfulText(element.name) || meaningfulText(element.value) || meaningfulText(element.href)
  );
}
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
function addElementStateValues(state, element, timestamp, sourceId) {
  const basePath = `elements.${elementStateId(element)}`;
  const anchor = boundsAnchor(element.documentBounds ?? element.bounds);
  const elementLabel = element.name ?? element.visibleText ?? element.text ?? element.value ?? element.href ?? element.selector;
  const elementPresentation = anchor ? { group: "Elements", anchor, visualKind: "bounds" } : { group: "Elements" };
  return putStateValue(state, basePath, "json", elementStatePayload(element), timestamp, sourceId, {
    elementKind: "element",
    stableAcrossSessions: Boolean(stableElementId(element)),
    comparable: false,
    sensitive: element.value !== void 0,
    presentation: {
      ...elementPresentation,
      label: elementLabel,
      visualKind: anchor ? "bounds" : "text",
      metadata: compactJsonObject({
        boundsKind: "document",
        renderKind: "direct-rendered",
        isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(stateBounds(element.bounds))
      })
    }
  });
}
function withScreenVisualFrame(state, snapshot, elements, input = {}) {
  const width = positiveFinite(snapshot.viewport.width) ?? 1;
  const height = positiveFinite(snapshot.viewport.height) ?? 1;
  const screenWidth = positiveFinite(input.screenImageSize?.width) ?? width;
  const screenHeight = positiveFinite(input.screenImageSize?.height) ?? height;
  const screenScaleX = screenWidth / width;
  const screenScaleY = screenHeight / height;
  const frameViewportOffset = stateBounds(snapshot.frame?.viewportOffset);
  const rawDocumentWidth = positiveFinite(snapshot.viewport.documentWidth) ?? width;
  const documentMapWidth = width;
  const documentHeight = positiveFinite(snapshot.viewport.documentHeight) ?? height;
  const layers = [];
  if (input.screenContentRef) {
    layers.push({
      id: "screenshot",
      kind: "image",
      contentRef: input.screenContentRef,
      bounds: { x: 0, y: 0, width: screenWidth, height: screenHeight },
      metadata: compactJsonObject({
        projectId: input.projectId,
        url: snapshot.url,
        frameKind: "viewport-screenshot",
        boundsKind: "screenshot",
        viewportWidth: width,
        viewportHeight: height,
        imageWidth: screenWidth,
        imageHeight: screenHeight
      })
    });
  }
  for (const [index, element] of elements.slice(0, MAX_VISUAL_FRAME_ELEMENTS).entries()) {
    const bounds = scaledScreenBounds(screenFrameBounds(element.bounds, frameViewportOffset), screenScaleX, screenScaleY);
    if (!bounds) continue;
    const statePath = `${WEB_AUTOMATION_STATE_NAMESPACE}.elements.${elementStateId(element)}`;
    layers.push({
      id: `element.${safeLayerId(elementStateId(element), index + 1)}`,
      kind: "region",
      label: element.name ?? element.visibleText ?? element.text ?? element.value ?? element.href ?? element.tagName,
      bounds,
      statePath,
      anchor: { type: "bounds", bounds },
      metadata: compactJsonObject({
        selector: element.selector,
        tagName: element.tagName,
        boundsKind: "screenshot",
        renderKind: "screenshot-bbox",
        isVisibleOnViewport: true
      })
    });
  }
  const screenFrame = {
    id: WEB_AUTOMATION_SCREEN_FRAME_ID,
    rendererId: WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID,
    label: "Viewport Screenshot",
    coordinateSpace: { width: screenWidth, height: screenHeight, unit: "px", origin: "top-left" },
    layers,
    presentation: { label: snapshot.title || "Browser viewport", visualKind: "bounds", icon: "globe" },
    metadata: compactJsonObject({
      url: snapshot.url,
      title: snapshot.title,
      scrollX: snapshot.viewport.scrollX,
      scrollY: snapshot.viewport.scrollY,
      devicePixelRatio: snapshot.viewport.devicePixelRatio,
      frameKind: "viewport-screenshot",
      screenCoordinateSpace: "viewport",
      documentWidth: snapshot.viewport.documentWidth,
      documentHeight: snapshot.viewport.documentHeight,
      viewportWidth: width,
      viewportHeight: height,
      imageWidth: screenWidth,
      imageHeight: screenHeight,
      imageScaleX: screenScaleX,
      imageScaleY: screenScaleY,
      frameViewportOffset,
      isTopFrame: snapshot.frame?.isTop
    })
  };
  const documentFrame = {
    id: WEB_AUTOMATION_DOCUMENT_FRAME_ID,
    rendererId: WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID,
    label: "Document Map",
    coordinateSpace: { width: documentMapWidth, height: documentHeight, unit: "px", origin: "top-left" },
    layers: [
      {
        id: "viewport",
        kind: "region",
        label: "Viewport",
        bounds: { x: snapshot.viewport.scrollX, y: snapshot.viewport.scrollY, width, height },
        metadata: compactJsonObject({
          boundsKind: "document",
          renderKind: "viewport-marker"
        })
      },
      ...elements.slice(0, MAX_VISUAL_FRAME_ELEMENTS).flatMap((element, index) => {
        const bounds = stateBounds(element.documentBounds ?? element.bounds);
        if (!bounds) return [];
        const projectedViewportBounds = element.bounds ? stateBounds({
          x: bounds.x - snapshot.viewport.scrollX,
          y: bounds.y - snapshot.viewport.scrollY,
          width: bounds.width,
          height: bounds.height
        }) : void 0;
        const statePath = `${WEB_AUTOMATION_STATE_NAMESPACE}.elements.${elementStateId(element)}`;
        return [{
          id: `document.element.${safeLayerId(elementStateId(element), index + 1)}`,
          kind: "region",
          label: element.name ?? element.visibleText ?? element.text ?? element.value ?? element.href ?? element.tagName,
          bounds,
          statePath,
          anchor: { type: "bounds", bounds },
          metadata: compactJsonObject({
            selector: element.selector,
            tagName: element.tagName,
            boundsKind: "document",
            renderKind: "direct-rendered",
            isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(stateBounds(element.bounds)),
            projectedViewportBounds
          })
        }];
      })
    ],
    presentation: { label: "Document map", visualKind: "bounds", icon: "map" },
    metadata: compactJsonObject({
      url: snapshot.url,
      title: snapshot.title,
      scrollX: snapshot.viewport.scrollX,
      scrollY: snapshot.viewport.scrollY,
      viewportWidth: width,
      viewportHeight: height,
      frameKind: "document-map",
      screenCoordinateSpace: "document-map",
      documentWidth: rawDocumentWidth,
      documentMapWidth,
      documentHeight
    })
  };
  return {
    ...state,
    id: state.id ?? `web.snapshot.${state.timestamp}`,
    presentation: {
      ...state.presentation ?? {},
      defaultFrameId: WEB_AUTOMATION_SCREEN_FRAME_ID,
      visualFrames: [screenFrame, documentFrame]
    }
  };
}
function putStateValue(snapshot, path, type, value, observedAt, sourceId, input = {}) {
  const namespace = snapshot.namespaces[WEB_AUTOMATION_STATE_NAMESPACE] ?? {
    schemaId: WEB_AUTOMATION_DOMAIN_ID,
    schemaVersion: WEB_AUTOMATION_SCHEMA_VERSION,
    values: {},
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID }
  };
  const stateValue = compactJsonObject({
    type,
    value,
    observedAt,
    sourceId,
    confidence: input.confidence ?? 0.95,
    volatility: input.volatility ?? "normal",
    comparable: input.comparable ?? true,
    sensitive: input.sensitive,
    presentation: input.presentation,
    metadata: compactJsonObject({
      elementKind: input.elementKind,
      stableAcrossSessions: input.stableAcrossSessions
    })
  });
  return {
    ...snapshot,
    timestamp: observedAt,
    namespaces: {
      ...snapshot.namespaces,
      [WEB_AUTOMATION_STATE_NAMESPACE]: {
        ...namespace,
        values: {
          ...namespace.values,
          [path]: stateValue
        }
      }
    }
  };
}
function elementStateId(element) {
  const stable = stableElementPathId(element);
  if (stable) return sanitizeStateId(stable);
  const name = stableAttribute(element, "name");
  if (name) return sanitizeStateId(`${name}.${element.selector}`);
  return sanitizeStateId(element.selector);
}
function elementStatePayload(element) {
  return compactJsonObject({
    selector: element.selector,
    tagName: element.tagName,
    xpath: element.xpath,
    id: element.id,
    classNames: element.classNames,
    visibleText: element.visibleText,
    text: element.text,
    value: element.value,
    role: element.role,
    name: element.name,
    href: element.href,
    inputType: element.inputType,
    bounds: stateBounds(element.bounds),
    documentBounds: stateBounds(element.documentBounds),
    isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(stateBounds(element.bounds)),
    enabled: isEnabled(element),
    stableId: stableElementId(element),
    hasClickHandler: element.hasClickHandler,
    attributes: element.attributes
  });
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
function hasElementBounds(element) {
  return stateBounds(element.documentBounds ?? element.bounds) !== void 0;
}
function isEnabled(element) {
  return element.attributes?.disabled === void 0 && element.attributes?.["aria-disabled"] !== "true";
}
function stateElementBucket(element) {
  if (isPrimaryControlElement(element) && hasMeaningfulElementIdentity(element)) return 0;
  if (isLikelyInteractableElement(element) && hasMeaningfulElementIdentity(element)) return 1;
  if (isSemanticTextElement(element) && hasTextualElementIdentity(element)) return 2;
  if (hasTextualElementIdentity(element)) return 3;
  if (meaningfulText(element.href)) return 4;
  return 5;
}
function stateElementScore(element) {
  let score = 0;
  if (isLikelyInteractableElement(element)) score += 200;
  if (isLikelyActionableElement(element)) score += 100;
  if (hasStableElementIdentity(element)) score += 60;
  if (meaningfulText(element.name)) score += 45;
  if (meaningfulText(element.value)) score += 35;
  if (meaningfulText(element.text) || meaningfulText(element.visibleText)) score += 25;
  const bounds = element.documentBounds ?? element.bounds;
  if (bounds) score += Math.min(20, Math.sqrt(bounds.width * bounds.height) / 8);
  return score;
}
function hasMeaningfulElementIdentity(element) {
  return hasStableElementIdentity(element) || hasTextualElementIdentity(element) || meaningfulText(element.href);
}
function hasTextualElementIdentity(element) {
  return meaningfulText(element.text) || meaningfulText(element.visibleText) || meaningfulText(element.name) || meaningfulText(element.value);
}
function hasStableElementIdentity(element) {
  return Boolean(
    stableAttribute(element, "data-testid") || stableAttribute(element, "data-test") || stableAttribute(element, "data-cy") || stableAttribute(element, "aria-label") || stableAttribute(element, "name") || stableAttribute(element, "id")
  );
}
function isLikelyInteractableElement(element) {
  return isLikelyActionableElement(element) || element.attributes?.tabindex !== void 0 || element.attributes?.["aria-expanded"] !== void 0 || element.attributes?.["aria-controls"] !== void 0 || element.attributes?.["aria-pressed"] !== void 0 || element.attributes?.["aria-selected"] !== void 0;
}
function isPrimaryControlElement(element) {
  const tagName = element.tagName.toLowerCase();
  const role = element.role?.toLowerCase();
  return tagName === "button" || tagName === "a" || tagName === "summary" || role === "button" || role === "link" || role === "menuitem" || role === "tab";
}
function isSemanticTextElement(element) {
  const tagName = element.tagName.toLowerCase();
  return tagName === "p" || tagName === "li" || tagName === "td" || tagName === "th" || tagName === "dt" || tagName === "dd" || tagName === "figcaption" || tagName === "blockquote" || /^h[1-6]$/.test(tagName);
}
function isLikelyActionableElement(element) {
  const tagName = element.tagName.toLowerCase();
  const role = element.role?.toLowerCase();
  const inputType = element.inputType?.toLowerCase();
  return tagName === "button" || tagName === "a" || tagName === "select" || tagName === "textarea" || tagName === "summary" || tagName === "label" || tagName === "input" && inputType !== "hidden" || role === "button" || role === "link" || role === "menuitem" || role === "checkbox" || role === "radio" || role === "tab" || role === "switch" || element.hasClickHandler === true || element.attributes?.onclick !== void 0;
}
function boundsAnchor(bounds) {
  const normalized = stateBounds(bounds);
  return normalized ? { type: "bounds", bounds: normalized } : void 0;
}
function screenFrameBounds(bounds, frameViewportOffset) {
  const normalized = stateBounds(bounds);
  if (!normalized) return void 0;
  if (!frameViewportOffset) return normalized;
  return stateBounds({
    x: frameViewportOffset.x + normalized.x,
    y: frameViewportOffset.y + normalized.y,
    width: normalized.width,
    height: normalized.height
  });
}
function scaledScreenBounds(bounds, scaleX, scaleY) {
  if (!bounds) return void 0;
  return stateBounds({
    x: bounds.x * scaleX,
    y: bounds.y * scaleY,
    width: bounds.width * scaleX,
    height: bounds.height * scaleY
  });
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

// ../../domain/src/client/gateway-mapping.ts
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
function webAutomationActionFromGatewayCommand(command) {
  const parameters = command.parameters ?? {};
  const target = command.target ?? {};
  const actionType = normalizeWebAutomationActionType(command.actionType);
  return compactJsonObject2({
    commandId: command.commandId,
    actionType,
    selector: stringValue2(target.selector) ?? stringValue2(parameters.selector),
    text: stringValue2(parameters.text),
    value: stringValue2(parameters.value),
    key: stringValue2(parameters.key),
    url: stringValue2(parameters.url),
    timeoutMs: numberValue2(command.timeoutMs ?? parameters.timeoutMs),
    coordinates: pointValue(target.coordinates ?? parameters.coordinates),
    visualTarget: jsonObject(target.visualTarget ?? parameters.visualTarget),
    options: parameters
  });
}
function webAutomationActionResultPayload(result) {
  return compactJsonObject2({
    commandId: result.commandId,
    actionType: result.actionType,
    status: result.status,
    message: result.message,
    url: result.url,
    title: result.title,
    element: result.element,
    visualTarget: result.visualTarget,
    snapshot: result.snapshot,
    extracted: result.extracted,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt
  });
}
function normalizeWebAutomationActionType(actionType) {
  if (actionType.startsWith("web.")) return actionType;
  const legacy = {
    "browser.navigate": "web.browser.navigate",
    "dom.click": "web.dom.click",
    "dom.type": "web.dom.type",
    "dom.clear": "web.dom.clear",
    "dom.select": "web.dom.select",
    "dom.scroll": "web.dom.scroll",
    "dom.keypress": "web.dom.keypress",
    "dom.wait_for_selector": "web.dom.wait_for_selector",
    "dom.wait_for_text": "web.dom.wait_for_text",
    "dom.extract": "web.dom.extract",
    "dom.capture_snapshot": "web.dom.capture_snapshot"
  };
  return legacy[actionType] ?? "web.dom.extract";
}
function stringValue2(value) {
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
function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function compactJsonObject2(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}

// src/background/tabs.ts
var REQUIRED_CONTENT_SCRIPT_VERSION = 2;
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ? describeTab(tab) : void 0;
}
async function allTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs.map(describeTab);
}
async function allTabFrames(tabId) {
  return new Promise((resolve) => {
    chrome.webNavigation.getAllFrames({ tabId }, (frames) => {
      const error = chrome.runtime.lastError;
      if (error || !frames) resolve([]);
      else resolve(frames);
    });
  });
}
function describeTab(tab) {
  const descriptor = {
    tabId: tab.id ?? -1
  };
  if (tab.windowId !== void 0) descriptor.windowId = tab.windowId;
  if (tab.url) descriptor.url = tab.url;
  if (tab.title) descriptor.title = tab.title;
  if (tab.favIconUrl) descriptor.favIconUrl = tab.favIconUrl;
  if (tab.active !== void 0) descriptor.active = tab.active;
  if (tab.status) descriptor.status = tab.status;
  return descriptor;
}
async function sendToTab(tabId, message, frameId) {
  return new Promise((resolve, reject) => {
    const callback = (response) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(response);
    };
    if (frameId !== void 0) chrome.tabs.sendMessage(tabId, message, { frameId }, callback);
    else chrome.tabs.sendMessage(tabId, message, callback);
  });
}
async function ensureContentScript(tabId) {
  try {
    const response2 = await sendToTab(tabId, { type: "fluxiq.ping" }, 0);
    if (response2.ok === true && response2.version === REQUIRED_CONTENT_SCRIPT_VERSION) return;
  } catch {
  }
  await chrome.scripting.executeScript({
    // A single inaccessible child (including an about:blank frame) must not
    // prevent recovery of the top-frame script used by default actions.
    // Manifest-declared content scripts still cover eligible descendants.
    target: { tabId, frameIds: [0] },
    files: ["content/index.js"]
  });
  const response = await sendToTab(tabId, { type: "fluxiq.ping" }, 0);
  if (response.ok !== true || response.version !== REQUIRED_CONTENT_SCRIPT_VERSION) {
    throw new Error("FluxIQ content script did not become ready in the top frame.");
  }
}

// src/background/action-evidence.ts
var PORT_NAME = "fluxiq.test.action-evidence";
var ACK_TIMEOUT_MS = 15e3;
var evidencePort;
var nextBoundaryId = 0;
function acceptActionEvidencePort(port) {
  if (port.name !== PORT_NAME) return false;
  evidencePort = port;
  port.onDisconnect.addListener(() => {
    if (evidencePort === port) evidencePort = void 0;
  });
  return true;
}
async function captureActionBoundary(phase, value) {
  const port = evidencePort;
  if (!port) return;
  const activePort = port;
  const boundaryId = `${value.commandId}:${phase}:${++nextBoundaryId}`;
  const message = {
    boundaryId,
    phase,
    commandId: value.commandId,
    actionType: value.actionType,
    ...phase === "after" && "status" in value ? { status: value.status } : {}
  };
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error(`Timed out capturing ${phase} evidence for ${value.actionType}.`)), ACK_TIMEOUT_MS);
    const onMessage = (response) => {
      const ack = response;
      if (ack?.boundaryId !== boundaryId) return;
      finish(ack.ok === true ? void 0 : new Error(typeof ack.error === "string" ? ack.error : "Action evidence capture failed."));
    };
    const onDisconnect = () => finish(new Error("Action evidence observer disconnected."));
    function finish(error) {
      clearTimeout(timeout);
      activePort.onMessage.removeListener(onMessage);
      activePort.onDisconnect.removeListener(onDisconnect);
      if (error) reject(error);
      else resolve();
    }
    activePort.onMessage.addListener(onMessage);
    activePort.onDisconnect.addListener(onDisconnect);
    try {
      activePort.postMessage(message);
    } catch (error) {
      finish(error instanceof Error ? error : new Error("Action evidence observer is unavailable."));
    }
  });
}

// src/background/storage.ts
async function readSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return normalizeSettings({ ...defaultSettings(), ...stored[STORAGE_KEYS.settings] ?? {} });
}
async function writeSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: normalizeSettings(settings) });
}
function normalizeSettings(settings) {
  if (settings.coreApiUrl.trim().replace(/\/+$/, "") !== LEGACY_GATEWAY_CORE_API_URL) return settings;
  return { ...settings, coreApiUrl: DEFAULT_CORE_API_URL };
}
async function readSession() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.session);
  return stored[STORAGE_KEYS.session] ?? null;
}
async function writeSession(session) {
  await chrome.storage.local.set({ [STORAGE_KEYS.session]: session });
}
async function clearSession() {
  await chrome.storage.local.remove(STORAGE_KEYS.session);
}
async function readOrCreateClientId() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.clientId);
  const existing = stored[STORAGE_KEYS.clientId];
  if (existing) return existing;
  const clientId = `extension-${crypto.randomUUID()}`;
  await chrome.storage.local.set({ [STORAGE_KEYS.clientId]: clientId });
  return clientId;
}
async function readQueuedEvents() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.queuedEvents);
  return stored[STORAGE_KEYS.queuedEvents] ?? [];
}
async function queueEvent(message) {
  const queued = await readQueuedEvents();
  queued.push(message);
  const trimmed = queued.slice(-MAX_EVENT_QUEUE_SIZE);
  await chrome.storage.local.set({ [STORAGE_KEYS.queuedEvents]: trimmed });
  return trimmed.length;
}
async function clearQueuedEvents() {
  await chrome.storage.local.set({ [STORAGE_KEYS.queuedEvents]: [] });
}

// src/runtime/automation-tab.ts
var DEFAULT_AUTOMATION_URL = "about:blank";
var automationTabId;
async function resolveAutomationTab(input = {}) {
  if (input.requestedTabId !== void 0) return input.requestedTabId;
  const existing = input.forceNew === true ? void 0 : await existingAutomationTab();
  if (existing !== void 0) {
    if (input.initialUrl && input.initialUrl !== DEFAULT_AUTOMATION_URL) await updateTabUrl(existing, input.initialUrl);
    return existing;
  }
  const tab = await chrome.tabs.create({
    url: input.initialUrl ?? DEFAULT_AUTOMATION_URL,
    active: input.active ?? true
  });
  if (tab.id === void 0) throw new Error("Unable to create FluxIQ automation tab.");
  automationTabId = tab.id;
  if (input.initialUrl && input.initialUrl !== DEFAULT_AUTOMATION_URL) await waitForTabReady(tab.id);
  return tab.id;
}
async function existingAutomationTab() {
  if (automationTabId === void 0) return void 0;
  try {
    const tab = await chrome.tabs.get(automationTabId);
    return tab.id;
  } catch {
    automationTabId = void 0;
    return void 0;
  }
}
async function updateTabUrl(tabId, url) {
  await chrome.tabs.update(tabId, { url, active: true });
  await waitForTabReady(tabId);
}
function waitForTabReady(tabId) {
  return new Promise((resolve) => {
    let lastUrl;
    let stableSince = 0;
    const interval = setInterval(checkSettled, 250);
    const timeout = setTimeout(done, 2e4);
    function done() {
      clearTimeout(timeout);
      clearInterval(interval);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    function listener(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId) return;
      if (changeInfo.url) {
        lastUrl = void 0;
        stableSince = 0;
      }
      if (changeInfo.status === "complete") void checkSettled();
    }
    chrome.tabs.onUpdated.addListener(listener);
    void checkSettled();
    async function checkSettled() {
      try {
        const tab = await chrome.tabs.get(tabId);
        const url = tab.url;
        const now = Date.now();
        if (url !== lastUrl) {
          lastUrl = url;
          stableSince = now;
        }
        if (tab.status !== "complete") return;
        if (isTransientNavigationUrl(url)) return;
        if (now - stableSince >= 1e3) done();
      } catch {
        done();
      }
    }
  });
}
function isTransientNavigationUrl(url) {
  return Boolean(url && /:\/\/accounts\.google\.com\/RotateCookiesPage\b/.test(url));
}

// src/runtime/action-runner.ts
async function runBrowserActionCommand(request) {
  const action = request.action;
  const isNavigation = action.actionType === "web.browser.navigate" && Boolean(action.url);
  const tabRequest = { active: true };
  if (isNavigation && action.url) {
    tabRequest.forceNew = true;
    tabRequest.initialUrl = action.url;
  } else if (action.tabId !== void 0) {
    tabRequest.requestedTabId = action.tabId;
  } else if (request.activeTabId !== void 0) {
    tabRequest.requestedTabId = request.activeTabId;
  }
  const tabId = await resolveAutomationTab(tabRequest);
  const unsupportedReason = action.tabId === void 0 || isNavigation ? unsupportedPageReasonForAction(action) : request.unsupportedPageReason;
  if (unsupportedReason && isMutatingAction(action.actionType)) return withTarget(actionFailure(action, unsupportedReason), tabId, action.frameId);
  if (isNavigation && action.url) {
    const startedAt = Date.now();
    await request.attachTabForRecording(tabId);
    return withTarget({
      commandId: action.commandId,
      actionType: action.actionType,
      status: "succeeded",
      message: "Navigation completed.",
      url: action.url,
      startedAt,
      finishedAt: Date.now()
    }, tabId, action.frameId);
  }
  await waitForTabReady(tabId);
  await request.attachTabForRecording(tabId);
  const frameId = action.frameId ?? 0;
  return withTarget(await sendToTab(tabId, {
    type: "executeAction",
    action,
    topFrameOnly: action.frameId === void 0
  }, frameId), tabId, frameId);
}
function browserActionFailure(action, message) {
  return actionFailure(action, message);
}
function unsupportedPageReasonForAction(action) {
  const url = action.actionType === "web.browser.navigate" ? action.url : void 0;
  if (!url) return void 0;
  if (/^(chrome|edge|brave|opera|vivaldi|about|moz-extension|chrome-extension):\/\//.test(url)) return "Browser and extension pages cannot be automated.";
  if (/^https:\/\/chrome\.google\.com\/webstore/.test(url)) return "Browser web store pages cannot be automated.";
  return void 0;
}
function isMutatingAction(actionType) {
  return actionType !== "web.dom.extract" && actionType !== "web.dom.capture_snapshot" && actionType !== "web.dom.wait_for_selector" && actionType !== "web.dom.wait_for_text";
}
function actionFailure(action, message) {
  const now = Date.now();
  return {
    commandId: action.commandId,
    actionType: action.actionType,
    status: "failed",
    message,
    startedAt: now,
    finishedAt: now
  };
}
function withTarget(result, tabId, frameId) {
  return {
    result,
    ...tabId !== void 0 ? { tabId } : {},
    ...frameId !== void 0 ? { frameId } : {}
  };
}

// src/runtime/snapshot-runner.ts
async function runSnapshotCapture(request) {
  await request.captureActiveSnapshot(request.label ?? "Snapshot captured");
}

// src/runtime/command-router.ts
var ExtensionRuntimeCommandRouter = class {
  constructor(options) {
    this.options = options;
  }
  async captureSnapshot() {
    await runSnapshotCapture({ captureActiveSnapshot: (label) => this.options.captureActiveSnapshot(label) });
  }
  async executeAction(action) {
    const request = {
      action,
      attachTabForRecording: (targetTabId) => this.options.attachTabForRecording(targetTabId)
    };
    const activeTabId = this.options.activeTabId();
    const unsupportedPageReason = this.options.unsupportedPageReason();
    if (activeTabId !== void 0) request.activeTabId = activeTabId;
    if (unsupportedPageReason !== void 0) request.unsupportedPageReason = unsupportedPageReason;
    try {
      const { result, tabId, frameId } = await runBrowserActionCommand(request);
      await this.options.sendActionResult(result, tabId, frameId);
    } catch (error) {
      await this.options.sendActionResult(browserActionFailure(action, error instanceof Error ? error.message : "Runtime action failed."));
    }
  }
};

// src/runtime/result-mapping.ts
function browserActionFromGatewayCommand(command) {
  return webAutomationActionFromGatewayCommand(command);
}
function gatewayActionResultFromBrowserResult(result) {
  const visualTarget = result.visualTarget ?? (result.element ? webAutomationActionVisualTargetFromElement(result.element) : void 0);
  return compactObject({
    commandId: result.commandId,
    status: result.status,
    startedAt: result.startedAt,
    completedAt: result.finishedAt,
    message: result.message,
    target: result.element ? webAutomationActionTargetFromElement(result.element) : void 0,
    payload: compactObject({
      ...webAutomationActionResultPayload(result),
      visualTarget
    }),
    error: result.status === "failed" ? result.message : void 0
  });
}
function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}

// src/background/connection/value-readers.ts
function compactObject2(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}
function stringValue3(value) {
  return typeof value === "string" ? value : void 0;
}
function objectValue2(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}
function numberValue3(value) {
  return typeof value === "number" ? value : void 0;
}
function rectValue(value) {
  if (!value || typeof value !== "object") return void 0;
  const rect = value;
  return typeof rect.x === "number" && typeof rect.y === "number" && typeof rect.width === "number" && typeof rect.height === "number" ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : void 0;
}
function timestampValue(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return void 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? void 0 : parsed;
}
function parseJsonBody(text) {
  if (!text) return void 0;
  try {
    return JSON.parse(text);
  } catch {
    return void 0;
  }
}

// src/background/connection/activity-log.ts
var RECENT_ACTIVITY_LIMIT = 20;
var RECORDING_LOG_LIMIT = 500;
var ActivityLog = class {
  recent = [];
  log = [];
  lastAt;
  lastActivityAt() {
    return this.lastAt;
  }
  recentEntries() {
    return [...this.recent];
  }
  record(kind, label, detail, tone = "neutral") {
    const timestamp = Date.now();
    this.lastAt = timestamp;
    const entry = compactObject2({
      id: `${kind}.${timestamp}.${Math.random().toString(36).slice(2)}`,
      timestamp,
      kind,
      label,
      detail,
      tone
    });
    this.recent.unshift(entry);
    this.recent.splice(RECENT_ACTIVITY_LIMIT);
    this.log.unshift(entry);
    this.log.splice(RECORDING_LOG_LIMIT);
  }
  clearRecent() {
    this.recent.length = 0;
  }
  reset() {
    this.recent.length = 0;
    this.log.length = 0;
    this.lastAt = void 0;
  }
  page(page, pageSize) {
    const normalizedPageSize = Math.min(100, Math.max(5, Math.floor(pageSize) || 25));
    const normalizedPage = Math.max(1, Math.floor(page) || 1);
    const start = (normalizedPage - 1) * normalizedPageSize;
    return {
      items: this.log.slice(start, start + normalizedPageSize),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total: this.log.length
    };
  }
};

// src/background/connection/browser-state.ts
function unsupportedPageForUrl(url) {
  if (!url) return void 0;
  if (/^(chrome|edge|brave|opera|vivaldi|about|moz-extension|chrome-extension):\/\//.test(url)) {
    return { url, reason: "Browser and extension pages cannot be recorded." };
  }
  if (/^https:\/\/chrome\.google\.com\/webstore/.test(url)) {
    return { url, reason: "Browser web store pages cannot be recorded." };
  }
  return void 0;
}
function browserStateFromTabs(active, tabs, recordingState) {
  return createWebAutomationStateUpdate({
    ...active?.tabId === void 0 ? {} : { activeContextId: String(active.tabId) },
    recording: recordingState === "recording",
    contexts: tabs.map((tab) => compactObject2({
      contextId: String(tab.tabId),
      url: tab.url,
      title: tab.title,
      faviconUrl: tab.favIconUrl,
      active: tab.active,
      metadata: compactObject2({
        kind: "browser.tab",
        windowId: tab.windowId,
        status: tab.status
      })
    })),
    state: browserStateSnapshotFromTabs(active, tabs, recordingState, Date.now()),
    metadata: { inputId: WEB_AUTOMATION_INPUT_IDS.browserState }
  });
}
function browserStateSnapshotFromTabs(active, tabs, recordingState, timestamp, sourceId) {
  const options = {
    timestamp,
    recording: recordingState === "recording",
    permissions: ["activeTab", "scripting", "storage", "tabs"]
  };
  if (sourceId !== void 0) options.sourceId = sourceId;
  return createWebAutomationStateFromTabs(active, tabs, options);
}
function describeActiveTabLike(tab) {
  const result = {
    tabId: tab.id ?? -1
  };
  if (tab.windowId !== void 0) result.windowId = tab.windowId;
  if (tab.url !== void 0) result.url = tab.url;
  if (tab.title !== void 0) result.title = tab.title;
  if (tab.active !== void 0) result.active = tab.active;
  if (tab.status !== void 0) result.status = tab.status;
  return result;
}
function actionTypesFromCapabilities(capabilities) {
  return [...new Set(capabilities.flatMap((capability) => capability.actionTypes ?? []))];
}

// src/background/connection/content-attachment.ts
var ContentAttachment = class {
  constructor(deps) {
    this.deps = deps;
  }
  // A tab joining a recording late still has a URL the recording never saw.
  // Claiming it here stops that URL arriving as a navigation the user made.
  async attachTabForRecording(tabId) {
    if (this.deps.isRecording() && !this.deps.hasRecordedTab(tabId)) {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url && !unsupportedPageForUrl(tab.url)) this.deps.noteRecordedTab(tabId, tab.url, Date.now());
    }
    await this.deps.ensureContentScript(tabId);
    await this.setRecordingState(tabId, this.deps.isRecording());
  }
  async setRecordingState(tabId, recording, frameId) {
    await this.deps.sendToTab(tabId, { type: "recording", recording, settings: this.deps.settings() }, frameId);
  }
  async broadcast(message, injectMissing) {
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(tabs.map(async (tab) => {
      if (tab.id === void 0 || unsupportedPageForUrl(tab.url)) return;
      if (injectMissing) await this.deps.ensureContentScript(tab.id);
      await this.deps.sendToTab(tab.id, message);
    }));
  }
};

// src/background/connection/core-api.ts
async function fetchCoreRecordings(credentials, page, pageSize) {
  const normalizedPageSize = Math.min(50, Math.max(5, Math.floor(pageSize) || 10));
  const normalizedPage = Math.max(1, Math.floor(page) || 1);
  const sourceUrl = recordingsApiUrl(credentials.coreApiUrl, normalizedPage, normalizedPageSize);
  const response = await fetch(sourceUrl, {
    headers: compactObject2({
      accept: "application/json",
      ...credentials.token ? { authorization: `Bearer ${credentials.token}` } : {}
    })
  });
  if (!response.ok) throw new Error(`FluxIQ recordings API returned ${response.status}.`);
  return normalizeRecordingsResponse(await response.json(), normalizedPage, normalizedPageSize, sourceUrl);
}
async function fetchProjectIdFromCoreSnapshot(credentials, identity, reason) {
  const url = new URL("/api/client-gateway/snapshot", credentials.coreApiUrl || DEFAULT_CORE_API_URL);
  const response = await fetch(url.toString(), {
    headers: compactObject2({
      accept: "application/json",
      authorization: `Bearer ${credentials.token}`
    })
  });
  const bodyText = await response.text().catch(() => "");
  const payload = parseJsonBody(bodyText);
  console.info("FluxIQ project context lookup", {
    url: url.toString(),
    status: response.status,
    reason,
    body: payload ?? bodyText
  });
  if (!response.ok) return void 0;
  const root = objectValue2(payload);
  if (root?.ok !== true) return void 0;
  const body = objectValue2(root.payload);
  const sessions = arrayValue(body?.sessions);
  const matchingSession = sessions.map(objectValue2).find((session) => session && stringValue3(session.sessionId) === identity.sessionId) ?? sessions.map(objectValue2).find((session) => session && stringValue3(session.clientId) === identity.clientId);
  const sessionProjectId = stringValue3(matchingSession?.projectId);
  const webRuntime = objectValue2(body?.webRuntime);
  const automationStudio = objectValue2(webRuntime?.automationStudio);
  const activeProjectId = stringValue3(automationStudio?.activeProjectId);
  return sessionProjectId ?? activeProjectId;
}
async function uploadStateAsset(credentials, projectId, sha256, bytes, mediaType) {
  const url = new URL(`/api/programs/automation-studio/state-assets/${encodeURIComponent(projectId)}/${sha256}`, credentials.coreApiUrl || DEFAULT_CORE_API_URL);
  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: compactObject2({
      "content-type": mediaType,
      "x-content-sha256": sha256,
      ...credentials.token ? { authorization: `Bearer ${credentials.token}` } : {}
    }),
    body: bytes
  });
  const bodyText = await response.text().catch(() => "");
  const payload = parseJsonBody(bodyText);
  console.info("FluxIQ screenshot upload", {
    url: url.toString(),
    status: response.status,
    body: payload ?? bodyText
  });
  const responseObject = objectValue2(payload);
  const responsePayload = objectValue2(responseObject?.payload);
  const contentRef = stringValue3(responsePayload?.contentRef);
  if (!response.ok || responseObject?.ok !== true || !contentRef) {
    throw new Error(`FluxIQ state asset upload failed (${response.status}).`);
  }
  return contentRef;
}
function recordingsApiUrl(coreApiUrl, page, pageSize) {
  const url = new URL("/api/recordings", coreApiUrl || DEFAULT_CORE_API_URL);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));
  return url.toString();
}
function normalizeRecordingsResponse(value, page, pageSize, sourceUrl) {
  const object = value && typeof value === "object" ? value : {};
  const rawItems = Array.isArray(object.items) ? object.items : Array.isArray(object.recordings) ? object.recordings : [];
  return {
    items: rawItems.map(normalizeRecordingSummary).filter((item) => Boolean(item)),
    page: numberValue3(object.page) ?? page,
    pageSize: numberValue3(object.pageSize) ?? pageSize,
    total: numberValue3(object.total),
    sourceUrl
  };
}
function normalizeRecordingSummary(value) {
  if (!value || typeof value !== "object") return void 0;
  const object = value;
  const id = stringValue3(object.id) ?? stringValue3(object.recordingId);
  if (!id) return void 0;
  return compactObject2({
    id,
    title: stringValue3(object.title) ?? stringValue3(object.name) ?? id,
    status: stringValue3(object.status),
    projectId: stringValue3(object.projectId),
    taskId: stringValue3(object.taskId),
    eventCount: numberValue3(object.eventCount),
    startedAt: timestampValue(object.startedAt),
    endedAt: timestampValue(object.endedAt),
    updatedAt: timestampValue(object.updatedAt)
  });
}

// src/background/connection/frame-geometry.ts
function translateFrameElements(frameSnapshot, topSnapshot, frameId) {
  const offset = rectValue(frameSnapshot.frame?.viewportOffset);
  if (!offset) return frameSnapshot.interactiveElements;
  return frameSnapshot.interactiveElements.map((element) => {
    const viewportBounds = translateFrameRectToTopViewport(element.bounds, element.documentBounds, frameSnapshot, offset);
    const documentBounds = viewportBounds ? {
      x: viewportBounds.x + topSnapshot.viewport.scrollX,
      y: viewportBounds.y + topSnapshot.viewport.scrollY,
      width: viewportBounds.width,
      height: viewportBounds.height
    } : translateFrameDocumentRectToTopDocument(element.documentBounds, frameSnapshot, topSnapshot, offset);
    return compactObject2({
      ...element,
      selector: `frame[${frameId}] >> ${element.selector}`,
      bounds: viewportBounds,
      documentBounds,
      isVisibleOnViewport: viewportBounds !== void 0,
      attributes: compactObject2({
        ...element.attributes ?? {},
        "data-fluxiq-frame-id": String(frameId),
        "data-fluxiq-frame-url": frameSnapshot.url
      })
    });
  });
}
function translateFrameRectToTopViewport(bounds, documentBounds, frameSnapshot, offset) {
  const rect = rectValue(bounds) ?? translateFrameDocumentRectToFrameViewport(documentBounds, frameSnapshot);
  if (!rect) return void 0;
  return {
    x: round2(offset.x + rect.x),
    y: round2(offset.y + rect.y),
    width: round2(rect.width),
    height: round2(rect.height)
  };
}
function translateFrameDocumentRectToFrameViewport(documentBounds, frameSnapshot) {
  const rect = rectValue(documentBounds);
  if (!rect) return void 0;
  return {
    x: round2(rect.x - frameSnapshot.viewport.scrollX),
    y: round2(rect.y - frameSnapshot.viewport.scrollY),
    width: round2(rect.width),
    height: round2(rect.height)
  };
}
function translateFrameDocumentRectToTopDocument(documentBounds, frameSnapshot, topSnapshot, offset) {
  const frameViewportRect = translateFrameDocumentRectToFrameViewport(documentBounds, frameSnapshot);
  if (!frameViewportRect) return void 0;
  return {
    x: round2(topSnapshot.viewport.scrollX + offset.x + frameViewportRect.x),
    y: round2(topSnapshot.viewport.scrollY + offset.y + frameViewportRect.y),
    width: round2(frameViewportRect.width),
    height: round2(frameViewportRect.height)
  };
}
function round2(value) {
  return Math.round(value * 100) / 100;
}

// src/background/connection/dom-snapshot.ts
var FRAME_SNAPSHOT_TIMEOUT_MS = 150;
function isDomSnapshotPayload(value) {
  if (!value || typeof value !== "object") return false;
  const snapshot = value;
  return typeof snapshot.url === "string" && typeof snapshot.title === "string" && Boolean(snapshot.viewport) && typeof snapshot.viewport?.width === "number" && typeof snapshot.viewport.height === "number" && typeof snapshot.viewport.scrollX === "number" && typeof snapshot.viewport.scrollY === "number" && Array.isArray(snapshot.interactiveElements);
}
function hasSnapshotFrameViewportOffset(snapshot) {
  const frame = objectValue2(snapshot.frame);
  const viewportOffset = objectValue2(frame?.viewportOffset);
  return typeof viewportOffset?.x === "number" && typeof viewportOffset.y === "number" && typeof viewportOffset.width === "number" && typeof viewportOffset.height === "number";
}
async function captureSingleFrameSnapshot(transport, tabId, frameId) {
  const snapshot = await withTimeout(transport.sendToTab(tabId, { type: "captureSnapshot" }, frameId), FRAME_SNAPSHOT_TIMEOUT_MS, void 0);
  return isDomSnapshotPayload(snapshot) ? snapshot : void 0;
}
async function captureMergedTabSnapshot(transport, tabId, seedSnapshot, seedFrameId) {
  const topFallback = await captureSingleFrameSnapshot(transport, tabId, 0);
  const fallback = topFallback ?? seedSnapshot;
  const frames = await withTimeout(transport.allTabFrames(tabId), FRAME_SNAPSHOT_TIMEOUT_MS, []);
  const frameSnapshots = [];
  if (seedSnapshot && seedFrameId !== void 0) frameSnapshots.push({ frameId: seedFrameId, snapshot: seedSnapshot });
  await withTimeout(Promise.allSettled(frames.map(async (frame) => {
    if (seedFrameId !== void 0 && frame.frameId === seedFrameId && seedSnapshot) return;
    const snapshot = await captureSingleFrameSnapshot(transport, tabId, frame.frameId);
    if (snapshot) frameSnapshots.push({ frameId: frame.frameId, snapshot });
  })), FRAME_SNAPSHOT_TIMEOUT_MS, []);
  if (!frameSnapshots.length) return fallback;
  const topSnapshot = frameSnapshots.find((entry) => entry.frameId === 0 || entry.snapshot.frame?.isTop)?.snapshot ?? topFallback;
  if (!topSnapshot) return void 0;
  const mergedElements = [];
  for (const entry of frameSnapshots) {
    const elements = entry.snapshot === topSnapshot || entry.snapshot.frame?.isTop ? entry.snapshot.interactiveElements : translateFrameElements(entry.snapshot, topSnapshot, entry.frameId);
    mergedElements.push(...elements);
  }
  return {
    ...topSnapshot,
    interactiveElements: mergedElements
  };
}
function withTimeout(promise, timeoutMs, fallback) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), timeoutMs);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch(() => {
      clearTimeout(timer);
      resolve(fallback);
    });
  });
}

// src/background/connection/event-sequence.ts
var EventSequence = class {
  counter = 0;
  // Event IDs include this sequence. Date.now() alone collides when related
  // startup events are emitted in the same millisecond.
  next() {
    this.counter = (this.counter + 1) % 1e3;
    return Date.now() * 1e3 + this.counter;
  }
};

// src/background/connection/gateway-payloads.ts
function recordedInputId(payload) {
  return webAutomationInputIdForRecordedEvent({
    kind: payload.kind,
    url: payload.url,
    title: payload.title,
    sequence: payload.sequence,
    ...payload.element ? { element: elementTarget(payload.element) } : {},
    ...payload.visualTarget ? { visualTarget: payload.visualTarget } : {},
    ...payload.inputValue !== void 0 ? { inputValue: payload.inputValue } : {},
    ...payload.key !== void 0 ? { key: payload.key } : {},
    ...payload.scroll ? { scroll: payload.scroll } : {},
    ...payload.metadata ? { metadata: payload.metadata } : {}
  });
}
function recordingEvidencePayload(payload) {
  const visualTarget = visualTargetFromPayload(payload);
  return compactObject2({
    kind: payload.kind,
    url: payload.url,
    title: payload.title,
    sequence: payload.sequence,
    timestamp: payload.eventTimestampMs,
    element: payload.element,
    visualTarget,
    snapshot: payload.snapshot,
    inputValue: payload.inputValue,
    key: payload.key,
    scroll: payload.scroll,
    mutation: payload.mutation,
    actionResult: payload.actionResult,
    metadata: payload.metadata
  });
}
function gatewayRecordingEventFromPayload(payload, tabId, frameId, recordingId) {
  const inputId = recordedInputId(payload);
  const visualTarget = visualTargetFromPayload(payload);
  return createWebAutomationRecordingEvent({
    kind: payload.kind,
    sequence: payload.sequence,
    url: payload.url,
    title: payload.title,
    eventTimestampMs: payload.eventTimestampMs,
    element: payload.element ? elementTarget(payload.element) : void 0,
    visualTarget,
    snapshot: payload.snapshot,
    inputValue: payload.inputValue,
    key: payload.key,
    scroll: payload.scroll,
    mutation: payload.mutation,
    actionResult: payload.actionResult ? webAutomationActionResultPayload(payload.actionResult) : void 0,
    metadata: inputId === void 0 ? payload.metadata : { ...payload.metadata ?? {}, inputId, ...visualTarget ? { visualTarget } : {} }
  }, {
    ...recordingId !== void 0 ? { recordingId } : {},
    ...tabId !== void 0 ? { tabId } : {},
    ...frameId !== void 0 ? { frameId } : {}
  });
}
function elementTarget(element) {
  return compactObject2({
    selector: element.selector,
    tagName: element.tagName,
    xpath: element.xpath,
    id: element.id,
    classNames: element.classNames,
    visibleText: element.visibleText,
    text: element.text,
    value: element.value,
    role: element.role,
    name: element.name,
    href: element.href,
    inputType: element.inputType,
    bounds: element.bounds,
    documentBounds: element.documentBounds,
    isVisibleOnViewport: element.isVisibleOnViewport,
    hasClickHandler: element.hasClickHandler,
    attributes: element.attributes
  });
}
function visualTargetFromPayload(payload) {
  return payload.visualTarget ?? (payload.element ? webAutomationActionVisualTargetFromElement(payload.element) : void 0);
}

// ../../../!FluxIQ/packages/contracts/src/client-gateway.ts
var CLIENT_GATEWAY_PROTOCOL_VERSION = "0.1";

// ../../../!FluxIQ/packages/client-gateway-websocket/dist/messages.js
function createClientGatewayMessage(type, payload, options = {}) {
  return {
    id: options.idFactory?.() ?? `client-message.${Math.random().toString(36).slice(2)}`,
    type,
    protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION,
    timestamp: options.now?.() ?? Date.now(),
    ...options.sessionId !== void 0 ? { sessionId: options.sessionId } : {},
    ...options.clientId !== void 0 ? { clientId: options.clientId } : {},
    ...options.correlationId !== void 0 ? { correlationId: options.correlationId } : {},
    payload
  };
}
function parseServerMessage(data) {
  const text = typeof data === "string" ? data : data instanceof ArrayBuffer ? new TextDecoder().decode(data) : "";
  if (!text)
    return null;
  const parsed = JSON.parse(text);
  if (typeof parsed.type !== "string" || !parsed.type.startsWith("server."))
    return null;
  return parsed;
}

// ../../../!FluxIQ/packages/client-gateway-websocket/dist/transport.js
var FluxIQClientGatewayWebSocketClient = class {
  options;
  handlers = /* @__PURE__ */ new Map();
  socket = null;
  sessionId;
  token;
  constructor(options) {
    this.options = options;
  }
  get connected() {
    return Boolean(this.socket && this.socket.readyState === 1);
  }
  get currentSessionId() {
    return this.sessionId;
  }
  async connect() {
    if (this.socket && this.socket.readyState <= 1)
      return;
    const WebSocketImpl = this.options.WebSocketImpl ?? globalThis.WebSocket;
    if (!WebSocketImpl)
      throw new Error("A WebSocket implementation is required.");
    const socket = new WebSocketImpl(this.options.url ?? "ws://127.0.0.1:4777/client");
    this.socket = socket;
    await waitForOpen(socket);
    this.attachSocketHandlers(socket);
    this.emit({ type: "open" });
    const storedToken = await this.options.tokenStorage?.read();
    this.token = this.options.client.token ?? storedToken;
    await this.send("client.hello", {
      ...this.options.client,
      ...this.token ? { token: this.token } : {}
    });
  }
  async close(code, reason) {
    this.socket?.close(code, reason);
    this.socket = null;
  }
  on(type, handler) {
    const set = this.handlers.get(type) ?? /* @__PURE__ */ new Set();
    set.add(handler);
    this.handlers.set(type, set);
    return () => set.delete(handler);
  }
  async send(type, payload, options = {}) {
    const message = {
      id: this.options.idFactory?.() ?? `client-message.${Math.random().toString(36).slice(2)}`,
      type,
      protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION,
      timestamp: this.options.now?.() ?? Date.now(),
      ...this.sessionId !== void 0 ? { sessionId: this.sessionId } : {},
      ...this.options.client.clientId !== void 0 ? { clientId: this.options.client.clientId } : {},
      ...options.correlationId !== void 0 ? { correlationId: options.correlationId } : {},
      payload
    };
    const socket = this.socket;
    if (!socket || socket.readyState !== 1)
      throw new Error("FluxIQ client gateway WebSocket is not connected.");
    socket.send(JSON.stringify(message));
    return message;
  }
  async sendStateUpdate(state) {
    return await this.send("client.state_update", state);
  }
  async sendRecordingEvent(event) {
    return await this.send("client.recording_event", event);
  }
  async sendSnapshot(snapshot) {
    return await this.send("client.snapshot", snapshot);
  }
  async sendActionResult(result) {
    return await this.send("client.action_result", result);
  }
  async sendError(message, input = {}) {
    return await this.send("client.error", {
      message,
      ...input.code !== void 0 ? { code: input.code } : {},
      ...input.metadata !== void 0 ? { metadata: input.metadata } : {}
    });
  }
  attachSocketHandlers(socket) {
    addListener(socket, "message", (event) => {
      const data = typeof event === "object" && event && "data" in event ? event.data : event;
      const message = parseServerMessage(data);
      if (message)
        void this.handleServerMessage(message);
    });
    addListener(socket, "close", (event) => {
      this.socket = null;
      this.emit({ type: "close", event });
    });
    addListener(socket, "error", (event) => this.emit({ type: "error", event }));
  }
  async handleServerMessage(message) {
    if (message.sessionId)
      this.sessionId = message.sessionId;
    this.emit({ type: "message", message });
    if (message.type === "server.session_ready") {
      this.sessionId = message.payload.sessionId;
      this.token = message.payload.token;
      await this.options.tokenStorage?.write(message.payload.token);
      this.emit({ type: "session_ready", message });
      return;
    }
    if (message.type === "server.pairing_required")
      this.emit({ type: "pairing_required", message });
    else if (message.type === "server.start_recording")
      this.emit({ type: "start_recording", message });
    else if (message.type === "server.stop_recording")
      this.emit({ type: "stop_recording", message });
    else if (message.type === "server.capture_snapshot")
      this.emit({ type: "capture_snapshot", message });
    else if (message.type === "server.execute_action")
      this.emit({ type: "execute_action", message });
  }
  emit(event) {
    for (const handler of this.handlers.get(event.type) ?? [])
      void handler(event);
  }
};
function waitForOpen(socket) {
  return new Promise((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = (event) => {
      cleanup();
      reject(event instanceof Error ? event : new Error("FluxIQ client gateway WebSocket failed to open."));
    };
    const cleanup = () => {
      removeListener(socket, "open", onOpen);
      removeListener(socket, "error", onError);
    };
    addListener(socket, "open", onOpen);
    addListener(socket, "error", onError);
  });
}
function addListener(socket, type, listener) {
  if (socket.addEventListener)
    socket.addEventListener(type, listener);
  else
    socket[`on${type}`] = listener;
}
function removeListener(socket, type, listener) {
  if (socket.removeEventListener)
    socket.removeEventListener(type, listener);
  else if (socket[`on${type}`] === listener)
    socket[`on${type}`] = null;
}

// src/shared/protocol.ts
var browserExtensionCapabilities = webAutomationClientCapabilities;

// src/background/connection/gateway-session.ts
var GatewaySession = class {
  constructor(deps) {
    this.deps = deps;
  }
  client = null;
  heartbeatTimer;
  reconnectTimer;
  reconnectAttempt = 0;
  connectionState = "disconnected";
  lastMessageAt;
  pairingReferenceCode;
  queueSize = 0;
  shouldStayConnected = false;
  state() {
    return this.connectionState;
  }
  statusFields() {
    return {
      connectionState: this.connectionState,
      queueSize: this.queueSize,
      lastMessageAt: this.lastMessageAt,
      pairingReferenceCode: this.pairingReferenceCode
    };
  }
  async connect() {
    this.shouldStayConnected = true;
    this.clearReconnect();
    this.setState("connecting");
    await this.deps.beforeConnect();
    await this.client?.close();
    const client = new FluxIQClientGatewayWebSocketClient({
      url: this.deps.settings().gatewayUrl,
      client: this.clientHello(),
      WebSocketImpl: WebSocket,
      tokenStorage: {
        read: () => this.deps.session().token,
        write: async (token) => {
          const session = this.deps.session();
          await this.deps.persistSession(compactObject2({
            ...session,
            token,
            serverUrl: this.deps.settings().gatewayUrl,
            connectedAt: Date.now()
          }));
        },
        clear: async () => {
          const session = this.deps.session();
          await this.deps.persistSession(compactObject2({
            clientId: session.clientId,
            sessionId: session.sessionId,
            projectId: session.projectId,
            serverUrl: this.deps.settings().gatewayUrl,
            connectedAt: session.connectedAt
          }));
        }
      }
    });
    this.client = client;
    this.attachClientHandlers(client);
    try {
      await client.connect();
    } catch {
      this.fail("WebSocket connection failed.");
      if (this.shouldStayConnected && this.deps.settings().autoReconnect) this.scheduleReconnect();
    }
  }
  // Stops the session reconnecting on its own. Separate from closing the socket
  // so a caller can tear down in its own order.
  stopReconnecting() {
    this.shouldStayConnected = false;
    this.clearReconnect();
  }
  closeClient() {
    this.stopHeartbeat();
    void this.client?.close();
    this.client = null;
  }
  markDisconnected() {
    this.setState("disconnected");
  }
  markSessionReady() {
    this.pairingReferenceCode = void 0;
    this.setState("connected");
  }
  markFailed() {
    this.setState("error");
  }
  noteMessageReceived() {
    this.lastMessageAt = Date.now();
  }
  // Sends over the open socket, or persists the message to the offline queue so
  // it survives a service-worker restart and is flushed on the next session.
  send = async (type, payload) => {
    if (this.client?.connected) {
      await this.client.send(type, payload);
      return;
    }
    const session = this.deps.session();
    const message = createClientGatewayMessage(type, payload, {
      clientId: session.clientId,
      ...session.sessionId !== void 0 ? { sessionId: session.sessionId } : {}
    });
    this.queueSize = await this.deps.queue.queueEvent(message);
    this.deps.emitStatus();
  };
  async flushQueue() {
    if (!this.client?.connected) return;
    const queued = await this.deps.queue.readQueuedEvents();
    for (const message of queued) {
      await this.client.send(message.type, message.payload);
    }
    await this.deps.queue.clearQueuedEvents();
    this.queueSize = 0;
    this.deps.emitStatus();
  }
  setState(state) {
    this.connectionState = state;
    this.deps.emitStatus();
  }
  onOpen() {
    this.reconnectAttempt = 0;
    this.deps.clearError();
    this.setState(this.deps.session().token ? "connecting" : "pairing");
    this.startHeartbeat();
  }
  onClose() {
    this.stopHeartbeat();
    this.client = null;
    if (this.shouldStayConnected && this.deps.settings().autoReconnect) {
      this.scheduleReconnect();
    } else {
      this.setState("disconnected");
    }
  }
  fail(message) {
    this.deps.reportError(message);
    this.setState("error");
  }
  clientHello() {
    const session = this.deps.session();
    const settings = this.deps.settings();
    return {
      clientId: session.clientId,
      clientType: "extension",
      name: "FluxIQ Browser Extension",
      version: browserDescriptor().extensionVersion,
      ...session.token !== void 0 ? { token: session.token } : {},
      capabilities: browserExtensionCapabilities,
      metadata: {
        domainId: WEB_AUTOMATION_DOMAIN_ID,
        browser: browserDescriptor(),
        settings: {
          captureMutations: settings.captureMutations,
          captureInputValues: settings.captureInputValues,
          captureSnapshots: settings.captureSnapshots
        }
      }
    };
  }
  attachClientHandlers(client) {
    const handlers = this.deps.handlers;
    client.on("open", () => this.onOpen());
    client.on("close", () => this.onClose());
    client.on("error", () => this.fail("WebSocket connection failed."));
    client.on("message", ({ message }) => handlers.onServerMessage(message));
    client.on("pairing_required", ({ message }) => {
      this.pairingReferenceCode = message.payload.referenceCode;
      this.setState("pairing");
      handlers.onPairingRequired(this.pairingReferenceCode, message.payload.reason);
    });
    client.on("session_ready", ({ message }) => handlers.onSessionReady(message));
    client.on("start_recording", ({ message }) => handlers.onCommand({ ...message.payload, command: "start_recording" }, message.id));
    client.on("stop_recording", ({ message }) => handlers.onCommand({ ...message.payload, command: "stop_recording" }, message.id));
    client.on("capture_snapshot", ({ message }) => handlers.onCommand({ ...message.payload, command: "capture_snapshot" }, message.id));
    client.on("execute_action", ({ message }) => handlers.onCommand({ command: "execute_action", action: browserActionFromGatewayCommand(message.payload) }, message.id));
  }
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.connectionState === "connected") this.deps.handlers.onHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }
  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = void 0;
  }
  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.setState("reconnecting");
    const delay = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => void this.connect(), delay);
  }
  clearReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = void 0;
  }
};

// src/background/connection/navigation-recorder.ts
var NAVIGATION_DEBOUNCE_MS = 250;
var INITIAL_NAVIGATION_GRACE_MS = 1e4;
var EXPLANATORY_ACTION_WINDOW_MS = 5e3;
var NavigationRecorder = class {
  pending = /* @__PURE__ */ new Map();
  lastRecorded = /* @__PURE__ */ new Map();
  initialUrls = /* @__PURE__ */ new Map();
  explanatoryActions = /* @__PURE__ */ new Map();
  noteExplanatoryAction(tabId, timestamp) {
    this.explanatoryActions.set(tabId, timestamp);
  }
  // Collapses the burst of URL, title, and status updates a single load emits
  // into one deferred call.
  schedule(tabId, url, record) {
    const existing = this.pending.get(tabId);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      this.pending.delete(tabId);
      record();
    }, NAVIGATION_DEBOUNCE_MS);
    this.pending.set(tabId, { url, timer });
  }
  // Decides whether a debounced navigation is recordable, and claims it when it
  // is so a repeat of the same URL is not recorded twice.
  shouldRecord(tabId, url, timestamp, explicitlyTyped, recordingStartedAt) {
    if (recordingStartedAt !== void 0 && timestamp <= recordingStartedAt) return false;
    const initialUrl = this.initialUrls.get(tabId);
    if (initialUrl === url && recordingStartedAt !== void 0 && Date.now() - recordingStartedAt < INITIAL_NAVIGATION_GRACE_MS) {
      this.initialUrls.delete(tabId);
      return false;
    }
    const explainedAt = this.explanatoryActions.get(tabId);
    if (!explicitlyTyped && explainedAt !== void 0 && timestamp - explainedAt >= 0 && timestamp - explainedAt < EXPLANATORY_ACTION_WINDOW_MS) return false;
    const previous = this.lastRecorded.get(tabId);
    if (previous?.url === url) return false;
    this.lastRecorded.set(tabId, { url, timestamp });
    return true;
  }
  hasRecordedTab(tabId) {
    return this.lastRecorded.has(tabId);
  }
  noteRecordedTab(tabId, url, timestamp) {
    this.lastRecorded.set(tabId, { url, timestamp });
  }
  // Every tab a recording starts with already sits on a URL. Remembering both
  // stops that URL being recorded as a navigation the user made.
  seedRecordingTab(tabId, url, timestamp) {
    this.lastRecorded.set(tabId, { url, timestamp });
    this.initialUrls.set(tabId, url);
  }
  clearRecordingTabs() {
    this.lastRecorded.clear();
    this.initialUrls.clear();
  }
};

// src/background/connection/pointer-click-filter.ts
var POINTER_CLICK_SUPPRESS_DELAY_MS = 750;
var PointerClickFilter = class {
  suppressed = /* @__PURE__ */ new Map();
  suppressNext(signature) {
    if (this.suppressed.has(signature)) return;
    const timer = setTimeout(() => {
      this.suppressed.delete(signature);
    }, POINTER_CLICK_SUPPRESS_DELAY_MS);
    this.suppressed.set(signature, timer);
  }
  isSuppressed(signature) {
    return this.suppressed.has(signature);
  }
  clear() {
    for (const timer of this.suppressed.values()) clearTimeout(timer);
    this.suppressed.clear();
  }
};

// src/background/connection/project-context.ts
var ProjectContext = class {
  constructor(deps) {
    this.deps = deps;
  }
  // null is meaningful: Core accepted the recording and told us it has no
  // project, which is different from not yet knowing.
  activeRecordingProjectId;
  activeRecordingProject() {
    return this.activeRecordingProjectId;
  }
  setActiveRecordingProject(projectId) {
    this.activeRecordingProjectId = projectId;
  }
  current() {
    const value = this.activeRecordingProjectId ?? this.deps.session().projectId;
    return typeof value === "string" && value.trim() ? value : void 0;
  }
  async resolve(reason) {
    const current = this.current();
    if (current) return current;
    const hydrated = await this.hydrateFromCoreSnapshot(reason);
    return hydrated ?? this.current();
  }
  async hydrateFromCoreSnapshot(reason) {
    const session = this.deps.session();
    const token = session.token;
    if (!token) return void 0;
    try {
      const projectId = await fetchProjectIdFromCoreSnapshot(
        { coreApiUrl: this.deps.settings().coreApiUrl, token },
        { sessionId: session.sessionId, clientId: session.clientId },
        reason
      );
      if (!projectId) return void 0;
      this.activeRecordingProjectId ??= projectId;
      await this.deps.adoptProjectId(projectId);
      this.deps.onActivity("recording", "Project context linked", projectId, "success");
      return projectId;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Project context lookup failed.";
      this.deps.onActivity("recording", "Project context unavailable", message, "warning");
      return void 0;
    }
  }
};

// src/background/connection/recorded-event.ts
function isExecutableRecordedAction(payload) {
  return recordedInputId(payload) !== void 0;
}
function shouldRequireStateForEvidence(payload) {
  return isExecutableRecordedAction(payload) || payload.kind === "action.result" || payload.kind === "browser.navigation" || payload.kind === "dom.click" || payload.kind === "dom.input" || payload.kind === "dom.change" || payload.kind === "dom.submit" || payload.kind === "dom.keydown";
}
function isNavigationExplanation(payload) {
  return payload.kind === "dom.click" || payload.kind === "dom.submit";
}
function stateScreenshotEventKey(payload) {
  return `${payload.kind}:${payload.sequence}:${payload.eventTimestampMs}`;
}
function stateSnapshotIdFromPayload(payload) {
  const kind = payload.kind.replace(/[^a-z0-9_.-]+/gi, "-");
  return `state.${kind}.${payload.sequence}.${payload.eventTimestampMs}`;
}
function clickEventSignature(payload, tabId, frameId) {
  const element = payload.element;
  if (!element) return void 0;
  const bounds = rectValue(element.bounds);
  return [
    tabId ?? "tab",
    frameId ?? "frame",
    element.selector,
    bounds ? Math.round(bounds.x) : "",
    bounds ? Math.round(bounds.y) : "",
    bounds ? Math.round(bounds.width) : "",
    bounds ? Math.round(bounds.height) : ""
  ].join("|");
}
function activityLabel(payload) {
  if (payload.kind === "dom.click") return "Click";
  if (payload.kind === "dom.input") return "Input changed";
  if (payload.kind === "dom.change") return "Field changed";
  if (payload.kind === "dom.submit") return "Form submitted";
  if (payload.kind === "dom.keydown") return `Key ${payload.key ?? ""}`.trim();
  if (payload.kind === "dom.wheel") return "Mouse wheel";
  if (payload.kind === "dom.scroll") return "Page scrolled";
  if (payload.kind === "dom.mutation") return "DOM changed";
  if (payload.kind === "browser.navigation") return "Navigation";
  if (payload.kind === "action.result") return "Action result";
  return payload.kind;
}
function activityDetail(payload) {
  if (payload.element?.name) return payload.element.name;
  if (payload.element?.text) return payload.element.text;
  if (payload.element?.selector) return payload.element.selector;
  if (payload.scroll) return `${payload.scroll.x}, ${payload.scroll.y}`;
  if (payload.mutation) return `${payload.mutation.added} added, ${payload.mutation.removed} removed`;
  if (payload.url) return payload.url;
  return void 0;
}

// src/background/connection/recording-manifest.ts
function eventSourceId(clientId) {
  return `client.${clientId}.events`;
}
function observationSourceId(clientId) {
  return `client.${clientId}.observations`;
}
function stateSourceId(clientId) {
  return `client.${clientId}.state`;
}
function tabSourceId(tabId, frameId) {
  return `tab:${tabId}${frameId === void 0 ? "" : `:frame:${frameId}`}`;
}
function recordingEnvironment(clientId, activeTabUrl) {
  return compactObject2({
    id: `client.${clientId}.browser`,
    label: "FluxIQ Browser Extension",
    kind: "browser_extension",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    capabilities: browserExtensionCapabilities.map((capability) => capability.id),
    metadata: compactObject2({
      browser: browserDescriptor(),
      activeTabUrl
    })
  });
}
function recordingSources(clientId) {
  return [
    { id: eventSourceId(clientId), label: "Browser events", kind: "event", schemaId: WEB_AUTOMATION_DOMAIN_ID, metadata: { clientId } },
    { id: observationSourceId(clientId), label: "Browser observations", kind: "observation", schemaId: WEB_AUTOMATION_DOMAIN_ID, metadata: { clientId } },
    { id: stateSourceId(clientId), label: "Browser state", kind: "state", schemaId: WEB_AUTOMATION_DOMAIN_ID, metadata: { clientId } }
  ];
}
function recordingActionChannels(clientId) {
  return [{
    id: `client.${clientId}.actions`,
    label: "Browser action channel",
    actionTypes: actionTypesFromCapabilities(browserExtensionCapabilities),
    capabilities: browserExtensionCapabilities.map((capability) => capability.id),
    metadata: { clientId }
  }];
}

// src/background/connection/recording-evidence.ts
var SCREENSHOT_SKIP_LOG_INTERVAL_MS = 2e3;
var RecordingEvidenceReporter = class {
  constructor(deps) {
    this.deps = deps;
  }
  lastScreenshotSkipAt;
  // Each await is a chance for the recording to have stopped underneath us, so
  // the guard is repeated rather than checked once at the top.
  async sendRecordingEvidence(payload, tabId, frameId) {
    if (this.deps.recordingState() !== "recording") return;
    const projectId = await this.deps.resolveProjectId("recording_evidence");
    if (this.deps.recordingState() !== "recording") return;
    const snapshot = await this.captureDomSnapshotForEvidence(payload, tabId, frameId);
    if (this.deps.recordingState() !== "recording") return;
    const hasDomSnapshot = isDomSnapshotPayload(snapshot);
    const state = hasDomSnapshot ? await this.createStateFromDomSnapshot(snapshot, {
      timestamp: payload.eventTimestampMs,
      eventKey: stateScreenshotEventKey(payload),
      ...projectId ? { projectId } : {},
      ...tabId === void 0 ? {} : {
        sourceId: tabSourceId(tabId),
        tabId
      }
    }) : compactObject2({
      latestEvidence: recordingEvidencePayload(payload)
    });
    if (this.deps.recordingState() !== "recording") return;
    const stateTimestampMs = numberValue3(objectValue2(state)?.timestamp) ?? payload.eventTimestampMs;
    if (hasDomSnapshot) {
      const snapshotId = stateSnapshotIdFromPayload(payload);
      await this.deps.send("client.snapshot", compactObject2({
        snapshotId,
        timestamp: stateTimestampMs,
        kind: "state",
        state,
        metadata: compactObject2({
          reason: "recording-evidence",
          clientKind: payload.kind,
          eventTimestampMs: payload.eventTimestampMs,
          stateTimestampMs,
          sequence: payload.sequence,
          ...tabId === void 0 ? {} : { tabId },
          ...frameId === void 0 ? {} : { frameId },
          ...payload.metadata ?? {}
        })
      }));
      return;
    }
    await this.deps.send("client.state_update", createWebAutomationStateUpdate({
      ...tabId === void 0 ? {} : { activeContextId: String(tabId) },
      state,
      metadata: compactObject2({
        reason: "recording-evidence",
        inputId: WEB_AUTOMATION_INPUT_IDS.recordingEvidence,
        clientKind: payload.kind,
        eventTimestampMs: payload.eventTimestampMs,
        stateTimestampMs,
        ...tabId === void 0 ? {} : { tabId },
        ...frameId === void 0 ? {} : { frameId },
        ...payload.metadata ?? {}
      })
    }));
  }
  // The state a recording opens with. Falls back to browser tab state when the
  // page cannot be snapshotted.
  async buildInitialRecordingState(timestamp) {
    const tabId = this.deps.activeTabId();
    if (tabId !== void 0 && !this.deps.unsupportedPage()) {
      try {
        await this.deps.attachTabForRecording(tabId);
        const snapshot = await this.deps.transport.sendToTab(tabId, { type: "captureSnapshot" });
        if (isDomSnapshotPayload(snapshot)) {
          const projectId = await this.deps.resolveProjectId("initial_state");
          return await this.createStateFromDomSnapshot(snapshot, {
            timestamp,
            ...projectId ? { projectId } : {},
            tabId,
            sourceId: tabSourceId(tabId)
          });
        }
      } catch {
      }
    }
    return browserStateSnapshotFromTabs(
      await this.deps.activeTab(),
      await this.deps.allTabs(),
      this.deps.recordingState(),
      timestamp,
      eventSourceId(this.deps.clientId())
    );
  }
  async captureActiveSnapshot(label) {
    const tabId = this.deps.activeTabId();
    if (tabId === void 0) return;
    const unsupported = this.deps.unsupportedPage();
    if (unsupported) {
      this.deps.onActivity("snapshot", "Snapshot skipped", unsupported.reason, "warning");
      return;
    }
    try {
      await this.deps.attachTabForRecording(tabId);
      const snapshot = await this.deps.transport.sendToTab(tabId, { type: "captureSnapshot" });
      await this.deps.send("client.snapshot", await this.gatewaySnapshotFromDomSnapshot(snapshot, tabId));
      this.deps.onActivity("snapshot", label, this.deps.activeTabUrl());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Content script is unavailable.";
      this.deps.setUnsupportedPage({ url: this.deps.activeTabUrl(), reason: message });
      this.deps.onActivity("snapshot", "Snapshot failed", message, "warning");
      this.deps.emitStatus();
    }
  }
  // The content script's own snapshot can be missing or frame-local. Re-reading
  // the tab recovers a merged one; failing that, the event goes out without.
  async captureDomSnapshotForEvidence(payload, tabId, frameId) {
    if (tabId === void 0 || this.deps.unsupportedPage() || !shouldRequireStateForEvidence(payload)) return void 0;
    try {
      await this.deps.ensureContentScript(tabId);
      const snapshot = await captureMergedTabSnapshot(this.deps.transport, tabId, isDomSnapshotPayload(payload.snapshot) ? payload.snapshot : void 0, frameId);
      if (isDomSnapshotPayload(snapshot)) {
        console.info("FluxIQ evidence snapshot recovered", {
          kind: payload.kind,
          sequence: payload.sequence,
          tabId,
          frameId
        });
        return snapshot;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fallback DOM snapshot failed.";
      console.warn("FluxIQ evidence snapshot unavailable", {
        kind: payload.kind,
        sequence: payload.sequence,
        tabId,
        frameId,
        message
      });
    }
    return void 0;
  }
  async createStateFromDomSnapshot(snapshot, input) {
    let screenContentRef;
    let stateSnapshot = snapshot;
    let stateTimestamp = input.timestamp;
    let visualSample;
    let missingScreenReason;
    const hasFrameViewportOffset = hasSnapshotFrameViewportOffset(snapshot);
    const canAttachFullTabScreenshot = input.frameId === void 0 || input.frameId === 0 || hasFrameViewportOffset;
    if (input.projectId && input.tabId !== void 0 && canAttachFullTabScreenshot) {
      visualSample = await this.deps.stateAssets.captureFreshVisualSample(input.tabId, input.projectId, input.timestamp, input.eventKey);
      screenContentRef = visualSample?.screenContentRef;
      if (visualSample?.snapshot) stateSnapshot = visualSample.snapshot;
      if (!screenContentRef) missingScreenReason = "screenshot capture or upload failed";
    } else {
      missingScreenReason = input.frameId !== void 0 && input.frameId !== 0 ? "frame-local state missing iframe viewport offset" : input.projectId ? "no tab id" : "no project id";
      this.noteScreenshotSkipped(input.frameId !== void 0 && input.frameId !== 0 ? "Frame-local state cannot be safely paired with a full-tab screenshot until iframe viewport offset is available." : input.projectId ? "No active tab id available for screenshot capture." : "No project id available for screenshot upload.");
    }
    const options = { timestamp: stateTimestamp };
    if (input.sourceId !== void 0) options.sourceId = input.sourceId;
    if (input.projectId !== void 0) options.projectId = input.projectId;
    if (screenContentRef !== void 0) options.screenContentRef = screenContentRef;
    if (visualSample?.screenImageSize !== void 0) options.screenImageSize = visualSample.screenImageSize;
    const state = createWebAutomationStateFromSnapshot(stateSnapshot, options);
    if (missingScreenReason) {
      console.warn("FluxIQ state snapshot missing screenshot", {
        reason: missingScreenReason,
        timestamp: input.timestamp,
        stateTimestamp,
        sourceId: input.sourceId,
        projectId: input.projectId,
        tabId: input.tabId,
        frameId: input.frameId
      });
      this.deps.onActivity("snapshot", "State screenshot missing", missingScreenReason, "warning");
      const metadata = objectValue2(state.metadata);
      return {
        ...state,
        metadata: compactObject2({
          ...metadata ?? {},
          missingScreenReason
        })
      };
    }
    return state;
  }
  async gatewaySnapshotFromDomSnapshot(snapshot, tabId) {
    const timestamp = Date.now();
    const projectId = await this.deps.resolveProjectId("snapshot");
    const state = isDomSnapshotPayload(snapshot) ? await this.createStateFromDomSnapshot(snapshot, {
      timestamp,
      ...projectId ? { projectId } : {},
      ...tabId === void 0 ? {} : { tabId },
      ...tabId === void 0 ? {} : { sourceId: tabSourceId(tabId) }
    }) : void 0;
    return compactObject2({
      snapshotId: `dom.${timestamp}`,
      timestamp,
      kind: state ? "state" : "structured",
      ...state !== void 0 ? { state } : {},
      payload: snapshot
    });
  }
  noteScreenshotSkipped(message) {
    const now = Date.now();
    if (this.lastScreenshotSkipAt !== void 0 && now - this.lastScreenshotSkipAt < SCREENSHOT_SKIP_LOG_INTERVAL_MS) return;
    this.lastScreenshotSkipAt = now;
    console.warn("FluxIQ screenshot skipped", {
      message,
      ...this.deps.screenshotDiagnostics()
    });
    this.deps.onActivity("snapshot", "Screenshot skipped", message, "warning");
  }
};

// src/background/connection/runtime-status.ts
var RuntimeStatusTracker = class {
  status = { state: "idle" };
  current() {
    return this.status;
  }
  start(status) {
    this.status = {
      state: "running",
      startedAt: Date.now(),
      ...status
    };
    return this.status;
  }
  startAction(action) {
    return this.start({
      commandId: action.commandId,
      actionType: action.actionType,
      label: runtimeActionLabel(action.actionType),
      target: runtimeActionTarget(action),
      startedAt: Date.now()
    });
  }
  finish(result) {
    const failed = result.status !== "succeeded";
    const label = runtimeActionLabel(result.actionType);
    this.status = {
      state: failed ? "failed" : "succeeded",
      commandId: result.commandId,
      actionType: result.actionType,
      label,
      target: runtimeResultTarget(result) ?? this.status.target,
      ...result.tabId !== void 0 ? { tabId: result.tabId } : {},
      ...result.frameId !== void 0 ? { frameId: result.frameId } : {},
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      ...result.message ? { message: result.message } : {},
      ...failed && result.message ? { error: result.message } : {},
      ...result.url ? { url: result.url } : {}
    };
    return this.status;
  }
};
function runtimeActionLabel(actionType) {
  if (actionType === "web.browser.navigate") return "Navigate";
  if (actionType === "web.dom.click") return "Click";
  if (actionType === "web.dom.type") return "Type";
  if (actionType === "web.dom.clear") return "Clear";
  if (actionType === "web.dom.select") return "Select";
  if (actionType === "web.dom.keypress") return "Key press";
  if (actionType === "web.dom.scroll") return "Scroll";
  if (actionType === "web.dom.wait_for_selector") return "Wait for selector";
  if (actionType === "web.dom.wait_for_text") return "Wait for text";
  if (actionType === "web.dom.extract") return "Extract";
  if (actionType === "web.dom.capture_snapshot") return "Capture snapshot";
  return actionType;
}
function runtimeResultTarget(result) {
  if (result.actionType === "web.browser.navigate") return result.url ?? result.title;
  return result.element?.name ?? result.element?.selector ?? result.element?.text;
}
function runtimeConfirmationForActionResult(result) {
  if (result.actionType === "web.browser.navigate") return { kind: "browser.navigation", inputId: WEB_AUTOMATION_INPUT_IDS.navigationRequested };
  if (result.actionType === "web.dom.click") return { kind: "dom.click", inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked };
  if (result.actionType === "web.dom.type") return { kind: "dom.input", inputId: WEB_AUTOMATION_INPUT_IDS.textEntered };
  if (result.actionType === "web.dom.clear") return { kind: "dom.input", inputId: WEB_AUTOMATION_INPUT_IDS.fieldCleared, inputValue: "" };
  if (result.actionType === "web.dom.select") return { kind: "dom.change", inputId: WEB_AUTOMATION_INPUT_IDS.optionSelected };
  if (result.actionType === "web.dom.keypress") return { kind: "dom.keydown", inputId: WEB_AUTOMATION_INPUT_IDS.keyPressed };
  if (result.actionType === "web.dom.scroll") return { kind: "dom.scroll", inputId: WEB_AUTOMATION_INPUT_IDS.pageScrolled };
  return void 0;
}
function runtimeActionTarget(action) {
  return action.url ?? action.selector ?? action.text ?? action.value ?? action.key ?? action.visualTarget?.selector;
}

// src/background/connection/state-assets.ts
var StateAssetStore = class {
  constructor(deps) {
    this.deps = deps;
  }
  // Captures the viewport as it is now rather than reusing an earlier capture:
  // the delta between the event and the capture is logged so a stale pairing is
  // visible rather than silent.
  async captureFreshVisualSample(tabId, projectId, timestamp, eventKey) {
    try {
      const capture = await captureVisibleViewportPngBytes(tabId);
      const sha256 = await sha256Hex(capture.bytes);
      const screenContentRef = await uploadStateAsset(this.deps.credentials(), projectId, sha256, capture.bytes, "image/png");
      const capturedAt = Date.now();
      console.info("FluxIQ fresh state screenshot stored", {
        tabId,
        projectId,
        sha256,
        coordinateSpace: capture.coordinateSpace,
        imageSize: capture.imageSize,
        eventKey,
        eventTimestampMs: timestamp,
        capturedAt,
        deltaMs: capturedAt - timestamp
      });
      this.deps.onActivity("snapshot", "Fresh viewport screenshot stored", `${sha256.slice(0, 12)} @ ${Math.max(0, capturedAt - timestamp)}ms after event`, "success");
      return { screenContentRef, screenImageSize: capture.imageSize, capturedAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fresh screenshot capture failed.";
      console.warn("FluxIQ fresh state screenshot failed", {
        tabId,
        projectId,
        eventTimestampMs: timestamp,
        message
      });
      return void 0;
    }
  }
};
async function captureVisibleViewportPngBytes(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (tab.windowId === void 0) throw new Error("Tab window is unavailable for screenshot capture.");
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  const bytes = await bytesFromDataUrl(dataUrl);
  return { bytes, imageSize: pngImageSize(bytes), coordinateSpace: "viewport" };
}
async function bytesFromDataUrl(dataUrl) {
  const response = await fetch(dataUrl);
  return await response.arrayBuffer();
}
function pngImageSize(bytes) {
  const view = new DataView(bytes);
  const hasPngSignature = view.byteLength >= 24 && view.getUint32(0) === 2303741511 && view.getUint32(4) === 218765834 && view.getUint32(12) === 1229472850;
  if (!hasPngSignature) throw new Error("Captured screenshot is not a PNG image.");
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width <= 0 || height <= 0) throw new Error("Captured screenshot has invalid PNG dimensions.");
  return { width, height };
}
async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// src/background/connection.ts
var RECORDING_START_ACCEPT_TIMEOUT_MS = 750;
var FluxIQConnection = class {
  constructor(settings, session) {
    this.settings = settings;
    this.session = session;
    this.gateway = new GatewaySession({
      settings: () => this.settings,
      session: () => this.session,
      persistSession: (session2) => this.persistSession(session2),
      emitStatus: () => this.emitStatus(),
      reportError: (message) => {
        this.lastError = message;
      },
      clearError: () => {
        this.lastError = void 0;
      },
      beforeConnect: () => this.refreshActiveTab(),
      queue: { queueEvent, readQueuedEvents, clearQueuedEvents },
      handlers: {
        onServerMessage: (message) => void this.onMessage(message),
        onPairingRequired: (referenceCode, reason) => {
          this.lastError = reason || "Approve this client in FluxIQ.";
          this.addActivity("pairing", "Waiting for approval", referenceCode ? `Reference ${referenceCode}` : void 0, "warning");
          this.emitStatus();
        },
        onSessionReady: (message) => void this.onSessionReady(message),
        onCommand: (payload, messageId) => void this.handleServerCommandPayload(payload, messageId),
        onHeartbeat: () => void this.sendBrowserState()
      }
    });
    this.projects = new ProjectContext({
      settings: () => this.settings,
      session: () => this.session,
      adoptProjectId: (projectId) => this.persistSession(compactObject2({ ...this.session, projectId })),
      onActivity: (kind, label, detail, tone) => this.addActivity(kind, label, detail, tone)
    });
    this.attachment = new ContentAttachment({
      sendToTab,
      ensureContentScript,
      settings: () => this.settings,
      isRecording: () => this.recordingState === "recording",
      hasRecordedTab: (tabId) => this.navigation.hasRecordedTab(tabId),
      noteRecordedTab: (tabId, url, timestamp) => this.navigation.noteRecordedTab(tabId, url, timestamp)
    });
    this.evidence = new RecordingEvidenceReporter({
      send: this.gateway.send,
      recordingState: () => this.recordingState,
      resolveProjectId: (reason) => this.projects.resolve(reason),
      onActivity: (kind, label, detail, tone) => this.addActivity(kind, label, detail, tone),
      emitStatus: () => this.emitStatus(),
      clientId: () => this.session.clientId,
      activeTabId: () => this.activeTabId,
      activeTabUrl: () => this.activeTabUrl,
      unsupportedPage: () => this.unsupportedPage,
      setUnsupportedPage: (state) => {
        this.unsupportedPage = state;
      },
      transport: this.transport,
      ensureContentScript,
      attachTabForRecording: (tabId) => this.attachment.attachTabForRecording(tabId),
      activeTab,
      allTabs,
      stateAssets: new StateAssetStore({
        credentials: () => this.coreApiCredentials(),
        onActivity: (kind, label, detail, tone) => this.addActivity(kind, label, detail, tone)
      }),
      screenshotDiagnostics: () => ({
        sessionId: this.session.sessionId,
        clientId: this.session.clientId,
        projectId: this.session.projectId,
        activeRecordingProjectId: this.projects.activeRecordingProject(),
        activeTabId: this.activeTabId,
        coreApiUrl: this.settings.coreApiUrl
      })
    });
  }
  recordingState = "idle";
  lastError;
  activeTabId;
  activeTabUrl;
  eventCount = 0;
  recordingStartedAt;
  activeRecordingId;
  pendingRecordingStart;
  recordingBlock;
  unsupportedPage;
  listeners = /* @__PURE__ */ new Set();
  activityLog = new ActivityLog();
  sequence = new EventSequence();
  runtimeStatus = new RuntimeStatusTracker();
  navigation = new NavigationRecorder();
  clicks = new PointerClickFilter();
  transport = { sendToTab, allTabFrames };
  gateway;
  projects;
  attachment;
  evidence;
  status() {
    const gateway = this.gateway.statusFields();
    const status = {
      connectionState: gateway.connectionState,
      recordingState: this.recordingState,
      gatewayUrl: this.settings.gatewayUrl,
      settings: this.settings,
      clientId: this.session.clientId,
      queueSize: gateway.queueSize,
      eventCount: this.eventCount,
      recentActivities: this.activityLog.recentEntries(),
      runtime: { ...this.runtimeStatus.current() }
    };
    const lastActivityAt = this.activityLog.lastActivityAt();
    if (this.session.sessionId) status.sessionId = this.session.sessionId;
    if (this.session.projectId !== void 0) status.projectId = this.session.projectId;
    if (this.activeTabId !== void 0) status.activeTabId = this.activeTabId;
    if (this.activeTabUrl) status.activeTabUrl = this.activeTabUrl;
    if (gateway.pairingReferenceCode) status.pairingReferenceCode = gateway.pairingReferenceCode;
    if (this.recordingStartedAt !== void 0) status.recordingStartedAt = this.recordingStartedAt;
    if (lastActivityAt !== void 0) status.lastActivityAt = lastActivityAt;
    if (this.unsupportedPage) status.unsupportedPage = this.unsupportedPage;
    if (this.recordingBlock) status.recordingBlock = this.recordingBlock;
    if (this.lastError) status.lastError = this.lastError;
    if (gateway.lastMessageAt !== void 0) status.lastMessageAt = gateway.lastMessageAt;
    return status;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.status());
    return () => this.listeners.delete(listener);
  }
  updateSettings(settings) {
    this.settings = settings;
  }
  recordingLogPage(page, pageSize) {
    return this.activityLog.page(page, pageSize);
  }
  async listCoreRecordings(page, pageSize) {
    return await fetchCoreRecordings(this.coreApiCredentials(), page, pageSize);
  }
  async connect() {
    await this.gateway.connect();
  }
  disconnect() {
    this.gateway.stopReconnecting();
    this.clearPendingRecordingStart();
    this.gateway.closeClient();
    if (this.recordingState === "recording") this.addActivity("connection", "Disconnected during recording", "Events will queue until reconnect.", "warning");
    this.gateway.markDisconnected();
  }
  async startRecording() {
    if (this.pendingRecordingStart) {
      this.addActivity("recording", "Recording is starting", "Waiting for FluxIQ project acceptance.", "warning");
      return;
    }
    if (this.gateway.state() !== "connected") {
      this.lastError = "Connect to FluxIQ before recording.";
      this.emitStatus();
      return;
    }
    await this.refreshActiveTab();
    if (this.unsupportedPage) {
      this.lastError = this.unsupportedPage.reason;
      this.addActivity("page", "Page cannot be recorded", this.unsupportedPage.reason, "warning");
      this.emitStatus();
      return;
    }
    this.resetRecordingLog();
    this.recordingBlock = void 0;
    const recordingId = `client.${this.session.clientId}.${Date.now()}`;
    const startedAt = Date.now();
    const projectId = await this.projects.resolve("recording_start");
    const initialState = await this.evidence.buildInitialRecordingState(startedAt);
    await this.gateway.send("client.start_recording", {
      recordingId,
      ...projectId ? { projectId } : {},
      startedAt,
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      initialState,
      environment: recordingEnvironment(this.session.clientId, this.activeTabUrl),
      sources: recordingSources(this.session.clientId),
      actionChannels: recordingActionChannels(this.session.clientId),
      metadata: {
        domainId: WEB_AUTOMATION_DOMAIN_ID,
        requestedBy: "extension-record-button",
        projectId: projectId ?? null,
        activeTabUrl: this.activeTabUrl ?? null
      }
    });
    this.addActivity("recording", "Starting recording", projectId ? "Waiting for FluxIQ project acceptance." : "Waiting for FluxIQ project context.", "warning");
    this.pendingRecordingStart = {
      recordingId,
      timer: setTimeout(() => void this.handleRecordingStartTimeout(recordingId), RECORDING_START_ACCEPT_TIMEOUT_MS)
    };
    this.emitStatus();
  }
  async stopRecording(notifyServer = true) {
    if (this.recordingState !== "recording") return;
    const recordingId = this.activeRecordingId;
    const projectId = this.projects.activeRecordingProject();
    const endedAt = Date.now();
    const stopPayload = recordingId ? compactObject2({
      recordingId,
      ...projectId !== void 0 ? { projectId } : {},
      endedAt
    }) : void 0;
    this.recordingState = "idle";
    this.clicks.clear();
    this.activeRecordingId = void 0;
    this.projects.setActiveRecordingProject(void 0);
    this.addActivity("recording", "Recording stopped", `${this.eventCount} user actions captured`, "neutral");
    this.emitStatus();
    void this.attachment.broadcast({ type: "recording", recording: false, settings: this.settings }, false);
    if (notifyServer && stopPayload) {
      await this.gateway.send("client.stop_recording", stopPayload);
    }
  }
  dismissRecordingBlock() {
    this.recordingBlock = void 0;
    if (this.lastError === "Open a FluxIQ project before recording.") this.lastError = void 0;
    this.emitStatus();
  }
  async handleRecordingEvent(payload, tabId, frameId) {
    if (this.recordingState !== "recording") return;
    if (payload.kind === "dom.click") {
      const sourceEvent = stringValue3(objectValue2(payload.metadata)?.sourceEvent);
      const signature = clickEventSignature(payload, tabId, frameId);
      if (sourceEvent === "pointerdown" && signature) {
        if (this.clicks.isSuppressed(signature)) return;
        this.clicks.suppressNext(signature);
        await this.processRecordingEvent(payload, tabId, frameId);
        return;
      }
      if (sourceEvent === "click" && signature && this.clicks.isSuppressed(signature)) {
        return;
      }
    }
    await this.processRecordingEvent(payload, tabId, frameId);
  }
  async handleContentReady(payload, tabId, frameId) {
    let readyPayload = payload;
    if (this.recordingState === "recording" && tabId !== void 0 && !this.unsupportedPage) {
      await this.attachment.setRecordingState(tabId, true, frameId).catch(() => void 0);
      if (!payload.snapshot) {
        const snapshot = await sendToTab(tabId, { type: "captureSnapshot" }, frameId).then((value) => isDomSnapshotPayload(value) ? value : void 0).catch(() => void 0);
        if (snapshot) readyPayload = { ...payload, snapshot };
      }
    }
    await this.handleRecordingEvent(readyPayload, tabId, frameId);
  }
  async handleTabUpdated(tab) {
    const becameActive = Boolean(tab.active && tab.id !== void 0 && this.activeTabId !== tab.id);
    if (tab.active && tab.id !== void 0) {
      this.activeTabId = tab.id;
      this.activeTabUrl = tab.url;
      this.unsupportedPage = unsupportedPageForUrl(tab.url);
      this.emitStatus();
    }
    if (!tab.id) return;
    if (tab.active && this.recordingState === "recording" && !this.unsupportedPage) {
      await this.attachment.attachTabForRecording(tab.id).catch(() => void 0);
      if (becameActive) this.addActivity("tab", "Recording active tab", tab.url ?? `Tab ${tab.id}`);
    }
    if (this.gateway.state() === "connected") {
      await this.gateway.send("client.state_update", createWebAutomationStateUpdate({
        activeContextId: String(tab.id),
        contexts: [compactObject2({ contextId: String(tab.id), url: tab.url, title: tab.title, status: tab.status })],
        recording: this.recordingState === "recording",
        state: createWebAutomationStateFromTabs(describeActiveTabLike(tab), [describeActiveTabLike(tab)], {
          timestamp: Date.now(),
          sourceId: eventSourceId(this.session.clientId),
          recording: this.recordingState === "recording",
          permissions: ["activeTab", "scripting", "storage", "tabs"]
        }),
        metadata: { reason: "tab-updated", inputId: WEB_AUTOMATION_INPUT_IDS.browserState }
      }));
      await this.sendBrowserState();
    }
  }
  async selectAutomationTab(tabId) {
    const tab = await chrome.tabs.update(tabId, { active: true });
    if (tab.id !== tabId || unsupportedPageForUrl(tab.url)) {
      throw new Error("The requested automation tab is unavailable or unsupported.");
    }
    await this.handleTabUpdated({ ...tab, active: true });
  }
  handleNavigationCommitted(details) {
    if (details.transitionType === "link" || details.transitionType === "form_submit" || details.transitionType === "reload") return;
    this.scheduleNavigation(details.tabId, details.url, details.timeStamp, details.transitionType === "typed");
  }
  handleHistoryStateUpdated(details) {
    this.scheduleNavigation(details.tabId, details.url, details.timeStamp, false);
  }
  scheduleNavigation(tabId, url, timestamp, explicitlyTyped) {
    if (this.recordingState !== "recording" || unsupportedPageForUrl(url)) return;
    this.navigation.schedule(tabId, url, () => void this.recordNavigation(tabId, url, timestamp, explicitlyTyped));
  }
  async recordNavigation(tabId, url, timestamp, explicitlyTyped) {
    if (this.recordingState !== "recording") return;
    if (!this.navigation.shouldRecord(tabId, url, timestamp, explicitlyTyped, this.recordingStartedAt)) return;
    await this.handleRecordingEvent({
      kind: "browser.navigation",
      sequence: this.sequence.next(),
      url,
      title: "",
      eventTimestampMs: timestamp,
      metadata: explicitlyTyped ? { transition: "typed" } : void 0
    }, tabId);
  }
  async processRecordingEvent(payload, tabId, frameId) {
    if (this.recordingState !== "recording") return;
    if (tabId !== void 0 && isNavigationExplanation(payload)) {
      this.navigation.noteExplanatoryAction(tabId, payload.eventTimestampMs);
    }
    if (isExecutableRecordedAction(payload)) {
      this.eventCount += 1;
      this.addActivity(payload.kind, activityLabel(payload), activityDetail(payload));
      await this.gateway.send("client.recording_event", gatewayRecordingEventFromPayload(payload, tabId, frameId, this.activeRecordingId));
      await this.evidence.sendRecordingEvidence(payload, tabId, frameId);
      return;
    }
    if (payload.kind !== "content.ready") {
      this.addActivity(payload.kind, `Evidence: ${activityLabel(payload)}`, activityDetail(payload));
    }
    await this.evidence.sendRecordingEvidence(payload, tabId, frameId);
  }
  async onMessage(message) {
    this.gateway.noteMessageReceived();
    if (message.type === "server.ping") {
      this.gateway.noteMessageReceived();
      this.emitStatus();
      return;
    }
    if (message.type === "server.error") {
      this.lastError = message.payload.message;
      if (message.payload.code === "recording.project_required") {
        this.handleRecordingProjectRequired(message.payload.message);
        return;
      }
      this.gateway.markFailed();
      return;
    }
    if (message.type === "server.set_active_tab") {
      await this.handleServerCommandPayload({ ...message.payload, command: "set_active_tab" }, message.id);
      return;
    }
    if (message.type === "server.disconnect") {
      this.disconnect();
    }
  }
  async onSessionReady(message) {
    await this.persistSession(compactObject2({
      ...this.session,
      sessionId: message.payload.sessionId,
      token: message.payload.token,
      ...message.payload.projectId !== void 0 ? { projectId: message.payload.projectId } : {},
      serverUrl: this.settings.gatewayUrl,
      connectedAt: Date.now()
    }));
    this.gateway.markSessionReady();
    this.addActivity("connection", "Connected to FluxIQ", "Client session ready", "success");
    await this.sendBrowserState();
    await this.gateway.flushQueue();
  }
  async handleServerCommandPayload(payload, messageId) {
    if (payload.command === "ping") {
      this.gateway.noteMessageReceived();
      this.emitStatus();
      return;
    }
    if (payload.command === "disconnect") {
      this.disconnect();
      return;
    }
    if (payload.command === "start_recording") {
      await this.beginAcceptedRecording(payload.recordingId, payload.projectId);
      return;
    }
    if (payload.command === "stop_recording") {
      await this.stopRecording(false);
      return;
    }
    if (payload.command === "set_active_tab") {
      const tabId = Number(payload.tabId);
      this.activeTabId = tabId;
      await chrome.tabs.update(tabId, { active: true });
      this.emitStatus();
      return;
    }
    if (payload.command === "capture_snapshot") {
      this.startRuntimeStatus({
        commandId: messageId,
        actionType: "web.dom.capture_snapshot",
        label: "Capture snapshot",
        target: this.activeTabUrl
      });
      await this.runtimeCommandRouter().captureSnapshot();
      this.finishRuntimeStatus({
        commandId: messageId,
        actionType: "web.dom.capture_snapshot",
        status: "succeeded",
        message: "Snapshot command dispatched.",
        startedAt: this.runtimeStatus.current().startedAt ?? Date.now(),
        finishedAt: Date.now()
      });
      return;
    }
    if (payload.command === "execute_action") {
      this.applyRuntimeStart(this.runtimeStatus.startAction(payload.action));
      await captureActionBoundary("before", payload.action);
      await this.refreshActiveTab();
      await this.runtimeCommandRouter().executeAction(payload.action);
    }
  }
  runtimeCommandRouter() {
    return new ExtensionRuntimeCommandRouter({
      activeTabId: () => this.activeTabId,
      unsupportedPageReason: () => this.unsupportedPage?.reason,
      attachTabForRecording: (tabId) => this.attachment.attachTabForRecording(tabId),
      captureActiveSnapshot: (label) => this.evidence.captureActiveSnapshot(label),
      sendActionResult: (result, tabId, frameId) => this.sendActionResult(result, tabId, frameId)
    });
  }
  async beginAcceptedRecording(recordingId, projectId) {
    this.clearPendingRecordingStart();
    if (projectId !== void 0) {
      await this.persistSession(compactObject2({ ...this.session, projectId }));
    }
    if (this.recordingState === "recording") {
      if (projectId !== void 0 && this.projects.activeRecordingProject() !== projectId) {
        this.projects.setActiveRecordingProject(projectId);
        await this.evidence.captureActiveSnapshot("Project-linked snapshot captured");
      }
      return;
    }
    this.resetRecordingLog();
    this.navigation.clearRecordingTabs();
    this.recordingBlock = void 0;
    this.activeRecordingId = recordingId;
    this.projects.setActiveRecordingProject(projectId !== void 0 ? projectId : this.session.projectId);
    this.eventCount = 0;
    this.activityLog.clearRecent();
    const recordingTabs = await allTabs();
    this.recordingStartedAt = Date.now();
    this.recordingState = "recording";
    for (const tab of recordingTabs) {
      if (tab.tabId < 0 || !tab.url || unsupportedPageForUrl(tab.url)) continue;
      this.navigation.seedRecordingTab(tab.tabId, tab.url, this.recordingStartedAt);
    }
    this.addActivity("recording", "Recording started", this.activeTabUrl ?? "Active tab", "success");
    this.emitStatus();
    if (this.activeTabId !== void 0) await this.attachment.attachTabForRecording(this.activeTabId);
    await this.sendBrowserState();
    await this.handleRecordingEvent({
      kind: "browser.tab",
      sequence: this.sequence.next(),
      url: this.activeTabUrl ?? "",
      title: "",
      eventTimestampMs: Date.now(),
      metadata: { recordingState: "started", recordingId }
    });
    await this.evidence.captureActiveSnapshot("Initial snapshot captured");
  }
  handleRecordingProjectRequired(message) {
    this.clearPendingRecordingStart();
    if (this.recordingState === "recording") {
      this.recordingState = "idle";
      this.clicks.clear();
      void this.attachment.broadcast({ type: "recording", recording: false, settings: this.settings }, false);
    }
    this.recordingStartedAt = void 0;
    this.activeRecordingId = void 0;
    this.projects.setActiveRecordingProject(void 0);
    this.recordingBlock = {
      code: "recording.project_required",
      title: "Project Required",
      message: message || "Open a FluxIQ project in the web panel before starting a recording."
    };
    this.lastError = "Open a FluxIQ project before recording.";
    this.addActivity("recording", "Recording locked", "Open a FluxIQ project in the web panel.", "warning");
    this.emitStatus();
  }
  clearPendingRecordingStart() {
    if (!this.pendingRecordingStart) return;
    clearTimeout(this.pendingRecordingStart.timer);
    this.pendingRecordingStart = void 0;
  }
  // FluxIQ did not accept the start in time. Recording begins locally so no user
  // action is lost; the project link attaches later if one arrives.
  async handleRecordingStartTimeout(recordingId) {
    if (!this.pendingRecordingStart || this.pendingRecordingStart.recordingId !== recordingId) return;
    const projectId = await this.projects.resolve("recording_start_timeout");
    await this.beginAcceptedRecording(recordingId, projectId ?? null);
    if (!projectId) {
      this.addActivity("recording", "Project context pending", "Structured state will record; screenshots attach after FluxIQ links a project.", "warning");
      this.emitStatus();
    }
  }
  async sendBrowserState() {
    await this.gateway.send("client.state_update", browserStateFromTabs(await activeTab(), await allTabs(), this.recordingState));
  }
  async sendActionResult(result, tabId, frameId) {
    this.finishRuntimeStatus({
      ...result,
      ...tabId !== void 0 ? { tabId } : {},
      ...frameId !== void 0 ? { frameId } : {}
    });
    await captureActionBoundary("after", result);
    const visualTarget = result.visualTarget ?? (result.element ? webAutomationActionVisualTargetFromElement(result.element) : void 0);
    await this.gateway.send("client.action_result", gatewayActionResultFromBrowserResult(result));
    await this.sendRuntimeActionConfirmation(result, tabId, frameId);
    await this.handleRecordingEvent(compactObject2({
      kind: "action.result",
      sequence: this.sequence.next(),
      url: result.url ?? this.activeTabUrl ?? "",
      title: result.title ?? "",
      eventTimestampMs: result.finishedAt,
      element: result.element,
      visualTarget,
      snapshot: result.snapshot,
      actionResult: result
    }), tabId, frameId);
  }
  // A succeeded runtime action is also something the recording must contain:
  // it is replayed as the recorded event a user would have produced.
  async sendRuntimeActionConfirmation(result, tabId, frameId) {
    if (result.status !== "succeeded") return;
    const confirmation = runtimeConfirmationForActionResult(result);
    if (!confirmation) return;
    const event = createWebAutomationRecordingEvent({
      kind: confirmation.kind,
      sequence: this.sequence.next(),
      url: result.url ?? this.activeTabUrl ?? "",
      title: result.title ?? "",
      eventTimestampMs: result.finishedAt,
      element: result.element,
      visualTarget: result.visualTarget,
      snapshot: result.snapshot,
      inputValue: confirmation.inputValue,
      key: confirmation.key,
      scroll: confirmation.scroll,
      actionResult: webAutomationActionResultPayload(result),
      metadata: {
        domainId: WEB_AUTOMATION_DOMAIN_ID,
        inputId: confirmation.inputId,
        runtimeConfirmation: true
      }
    }, {
      ...tabId !== void 0 ? { tabId } : {},
      ...frameId !== void 0 ? { frameId } : {}
    });
    await this.gateway.send("client.recording_event", event);
  }
  async refreshActiveTab() {
    const tab = await activeTab();
    this.activeTabId = tab?.tabId;
    this.activeTabUrl = tab?.url;
    this.unsupportedPage = unsupportedPageForUrl(tab?.url);
    this.emitStatus();
  }
  async persistSession(session) {
    this.session = session;
    await writeSession(this.session);
  }
  coreApiCredentials() {
    return { coreApiUrl: this.settings.coreApiUrl, token: this.session.token };
  }
  emitStatus() {
    const status = this.status();
    for (const listener of this.listeners) listener(status);
    void chrome.runtime.sendMessage({ type: "fluxiq.statusChanged", status }).catch(() => void 0);
  }
  addActivity(kind, label, detail, tone = "neutral") {
    this.activityLog.record(kind, label, detail, tone);
    this.emitStatus();
  }
  resetRecordingLog() {
    this.eventCount = 0;
    this.activityLog.reset();
    this.clicks.clear();
  }
  startRuntimeStatus(status) {
    this.applyRuntimeStart(this.runtimeStatus.start(status));
  }
  applyRuntimeStart(next) {
    this.lastError = void 0;
    this.addActivity("runtime", `Runtime started: ${next.label ?? next.actionType ?? "Command"}`, next.target, "warning");
    this.emitStatus();
  }
  finishRuntimeStatus(result) {
    const failed = result.status !== "succeeded";
    const label = runtimeActionLabel(result.actionType);
    this.runtimeStatus.finish(result);
    if (result.tabId !== void 0) this.activeTabId = result.tabId;
    if (result.url) this.activeTabUrl = result.url;
    if (failed) this.lastError = result.message ?? `${label} failed.`;
    this.addActivity(
      "runtime",
      failed ? `Runtime failed: ${label}` : `Runtime succeeded: ${label}`,
      result.message ?? runtimeResultTarget(result),
      failed ? "danger" : "success"
    );
    this.emitStatus();
  }
};

// src/background/index.ts
var connection;
async function getConnection() {
  if (connection) return connection;
  const settings = await readSettings();
  const clientId = await readOrCreateClientId();
  const storedSession = await readSession();
  const session = storedSession ?? { clientId };
  if (session.clientId !== clientId) session.clientId = clientId;
  await writeSession(session);
  connection = new FluxIQConnection(settings, session);
  const queued = await readQueuedEvents();
  connection.subscribe(() => void 0);
  if (queued.length) {
  }
  return connection;
}
chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    const settings = await readSettings();
    await writeSettings({ ...defaultSettings(), ...settings });
    await readOrCreateClientId();
    await enableSidePanelFirst();
  })();
});
chrome.runtime.onStartup.addListener(() => {
  void enableSidePanelFirst();
  void getConnection();
});
void enableSidePanelFirst();
chrome.runtime.onConnect.addListener((port) => {
  acceptActionEvidencePort(port);
});
chrome.tabs.onActivated.addListener(({ tabId }) => {
  void chrome.tabs.get(tabId, (tab) => {
    void getConnection().then((manager) => manager.handleTabUpdated(tab));
  });
});
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.title || changeInfo.status) {
    void getConnection().then((manager) => manager.handleTabUpdated(tab));
  }
});
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  void getConnection().then((manager) => manager.handleNavigationCommitted(details));
});
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;
  void getConnection().then((manager) => manager.handleHistoryStateUpdated(details));
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void handleRuntimeMessage(message, sender).then(sendResponse).catch((error) => {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unknown extension error." });
  });
  return true;
});
async function handleRuntimeMessage(message, sender) {
  const manager = await getConnection();
  const typed = message;
  if (typed.type === RUNTIME_MESSAGES.getStatus) {
    return { ok: true, status: await statusWithQueue(manager) };
  }
  if (typed.type === RUNTIME_MESSAGES.connect) {
    const settings = { ...await readSettings(), ...typed.settings ?? {} };
    await writeSettings(settings);
    manager.updateSettings(await readSettings());
    await manager.connect();
    return { ok: true, status: manager.status() };
  }
  if (typed.type === RUNTIME_MESSAGES.disconnect) {
    manager.disconnect();
    return { ok: true, status: manager.status() };
  }
  if (typed.type === RUNTIME_MESSAGES.resetSession) {
    manager.disconnect();
    await clearSession();
    connection = void 0;
    const next = await getConnection();
    return { ok: true, status: await statusWithQueue(next) };
  }
  if (typed.type === RUNTIME_MESSAGES.dismissRecordingLock) {
    manager.dismissRecordingBlock();
    return { ok: true, status: manager.status() };
  }
  if (typed.type === RUNTIME_MESSAGES.getRecordingLog) {
    return {
      ok: true,
      log: manager.recordingLogPage(Number(typed.page), Number(typed.pageSize))
    };
  }
  if (typed.type === RUNTIME_MESSAGES.listRecordings) {
    return {
      ok: true,
      recordings: await manager.listCoreRecordings(Number(typed.page), Number(typed.pageSize))
    };
  }
  if (typed.type === RUNTIME_MESSAGES.startRecording) {
    await manager.startRecording();
    return { ok: true, status: manager.status() };
  }
  if (typed.type === RUNTIME_MESSAGES.stopRecording) {
    await manager.stopRecording();
    return { ok: true, status: manager.status() };
  }
  if (typed.type === RUNTIME_MESSAGES.contentReady) {
    const tabId = sender.tab?.id;
    await manager.handleContentReady(typed.payload, tabId, sender.frameId);
    return { ok: true };
  }
  if (typed.type === "fluxiq.test.setActiveTab") {
    const tabId = typed.tabId;
    if (typeof tabId !== "number" || !Number.isSafeInteger(tabId) || tabId < 0) {
      throw new Error("A valid automation tab ID is required.");
    }
    await manager.selectAutomationTab(tabId);
    return { ok: true, status: manager.status() };
  }
  if (typed.type === RUNTIME_MESSAGES.contentEvent) {
    const tabId = sender.tab?.id;
    await manager.handleRecordingEvent(typed.payload, tabId, sender.frameId);
    return { ok: true };
  }
  if (typed.type === "fluxiq.describeTab" && sender.tab) {
    return { ok: true, tab: describeTab(sender.tab) };
  }
  return { ok: false, error: "Unknown FluxIQ extension message." };
}
async function statusWithQueue(manager) {
  const status = manager.status();
  status.queueSize = (await readQueuedEvents()).length;
  return status;
}
async function enableSidePanelFirst() {
  const sidePanel = chrome.sidePanel;
  if (!sidePanel?.setPanelBehavior) return;
  await sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}
//# sourceMappingURL=index.js.map
