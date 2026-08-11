// src/shared/constants.ts
var DEFAULT_GATEWAY_URL = "ws://127.0.0.1:4777/client";
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
    coreApiUrl: "http://127.0.0.1:4777",
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
var elementProperties = { selector: { type: "string", label: "CSS selector" }, element: elementFingerprintSchema };
var selectorSchema = {
  type: "object",
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

// ../../domain/src/actions/capabilities.ts
var webAutomationClientCapabilities = [
  { id: "web.context.state", label: "Web context state", kind: "state" },
  { id: "web.structured.snapshot", label: "Structured web snapshots", kind: "snapshot" },
  { id: "web.recording.events", label: "Web recording events", kind: "recording" },
  {
    id: "web.actions",
    label: "Web actions",
    kind: "action",
    actionTypes: WEB_AUTOMATION_ACTION_TYPES
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
  if (payload.kind === "browser.navigation") return WEB_AUTOMATION_INPUT_IDS.navigationRequested;
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
var MAX_STATE_ELEMENTS = 40;
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
  return state;
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
  for (const element of elements) {
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
  return Boolean(
    meaningfulText(element.text) || meaningfulText(element.name) || meaningfulText(element.value) || meaningfulText(element.href) || stableAttribute(element, "data-testid") || stableAttribute(element, "aria-label") || stableAttribute(element, "name") || stableAttribute(element, "id")
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
      attributes: element.attributes
    })
  });
}
function addElementStateValues(state, element, timestamp, sourceId) {
  const basePath = `elements.${elementStateId(element)}`;
  let next = putStateValue(state, `${basePath}.selector`, "string", element.selector, timestamp, sourceId, { elementKind: "selector", stableAcrossSessions: true });
  next = putStateValue(next, `${basePath}.tagName`, "string", element.tagName, timestamp, sourceId, { elementKind: "static_id", stableAcrossSessions: true });
  next = putStateValue(next, `${basePath}.visible`, "boolean", isVisible(element), timestamp, sourceId, { elementKind: "visibility", volatility: "normal" });
  next = putStateValue(next, `${basePath}.enabled`, "boolean", isEnabled(element), timestamp, sourceId, { elementKind: "enabled", volatility: "normal" });
  if (element.text) next = putStateValue(next, `${basePath}.text`, "string", element.text, timestamp, sourceId, { elementKind: "text" });
  if (element.name) next = putStateValue(next, `${basePath}.label`, "string", element.name, timestamp, sourceId, { elementKind: "label" });
  if (element.value) next = putStateValue(next, `${basePath}.value`, "string", element.value, timestamp, sourceId, { elementKind: "text", sensitive: true });
  if (element.href) next = putStateValue(next, `${basePath}.href`, "string", element.href, timestamp, sourceId, { elementKind: "url" });
  if (element.bounds) next = putStateValue(next, `${basePath}.bounds`, "rectangle", element.bounds, timestamp, sourceId, { elementKind: "bounds", comparable: false });
  const stableId = stableAttribute(element, "data-testid") ?? stableAttribute(element, "id") ?? stableAttribute(element, "name");
  if (stableId) next = putStateValue(next, `${basePath}.stableId`, "string", stableId, timestamp, sourceId, { elementKind: "static_id", stableAcrossSessions: true });
  return next;
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
  const stable = stableAttribute(element, "data-testid") ?? stableAttribute(element, "id") ?? stableAttribute(element, "name") ?? element.selector;
  return stable.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 80) || "element";
}
function meaningfulText(value) {
  return typeof value === "string" && value.trim().length >= 2;
}
function stableAttribute(element, name) {
  const value = element.attributes?.[name];
  return meaningfulText(value) ? value : void 0;
}
function isVisible(element) {
  return !element.bounds || element.bounds.width > 0 && element.bounds.height > 0;
}
function isEnabled(element) {
  return element.attributes?.disabled === void 0 && element.attributes?.["aria-disabled"] !== "true";
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
    selector: stringValue(target.selector) ?? stringValue(parameters.selector),
    text: stringValue(parameters.text),
    value: stringValue(parameters.value),
    key: stringValue(parameters.key),
    url: stringValue(parameters.url),
    timeoutMs: numberValue(command.timeoutMs ?? parameters.timeoutMs),
    coordinates: pointValue(target.coordinates ?? parameters.coordinates),
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
function stringValue(value) {
  return typeof value === "string" ? value : void 0;
}
function numberValue(value) {
  return typeof value === "number" ? value : void 0;
}
function pointValue(value) {
  if (!value || typeof value !== "object") return void 0;
  const point = value;
  return typeof point.x === "number" && typeof point.y === "number" ? { x: point.x, y: point.y } : void 0;
}
function compactJsonObject2(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}

// src/shared/protocol.ts
var browserExtensionCapabilities = webAutomationClientCapabilities;

// src/background/tabs.ts
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ? describeTab(tab) : void 0;
}
async function allTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs.map(describeTab);
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
    await sendToTab(tabId, { type: "fluxiq.ping" });
    return;
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/index.js"]
    });
  }
  await sendToTab(tabId, { type: "fluxiq.ping" });
}

// src/background/storage.ts
async function readSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return { ...defaultSettings(), ...stored[STORAGE_KEYS.settings] ?? {} };
}
async function writeSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
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

// src/background/connection.ts
var FluxIQConnection = class {
  constructor(settings, session) {
    this.settings = settings;
    this.session = session;
  }
  client = null;
  heartbeatTimer;
  reconnectTimer;
  reconnectAttempt = 0;
  connectionState = "disconnected";
  recordingState = "idle";
  lastError;
  lastMessageAt;
  activeTabId;
  activeTabUrl;
  pairingReferenceCode;
  queueSize = 0;
  shouldStayConnected = false;
  eventCount = 0;
  recordingStartedAt;
  activeRecordingId;
  pendingRecordingStart;
  recordingBlock;
  lastActivityAt;
  unsupportedPage;
  recentExplanatoryActions = /* @__PURE__ */ new Map();
  pendingNavigations = /* @__PURE__ */ new Map();
  lastRecordedNavigation = /* @__PURE__ */ new Map();
  backgroundEventSequence = 0;
  recentActivities = [];
  recordingLog = [];
  listeners = /* @__PURE__ */ new Set();
  status() {
    const status = {
      connectionState: this.connectionState,
      recordingState: this.recordingState,
      gatewayUrl: this.settings.gatewayUrl,
      settings: this.settings,
      clientId: this.session.clientId,
      queueSize: this.queueSize,
      eventCount: this.eventCount,
      recentActivities: [...this.recentActivities]
    };
    if (this.session.sessionId) status.sessionId = this.session.sessionId;
    if (this.activeTabId !== void 0) status.activeTabId = this.activeTabId;
    if (this.activeTabUrl) status.activeTabUrl = this.activeTabUrl;
    if (this.pairingReferenceCode) status.pairingReferenceCode = this.pairingReferenceCode;
    if (this.recordingStartedAt !== void 0) status.recordingStartedAt = this.recordingStartedAt;
    if (this.lastActivityAt !== void 0) status.lastActivityAt = this.lastActivityAt;
    if (this.unsupportedPage) status.unsupportedPage = this.unsupportedPage;
    if (this.recordingBlock) status.recordingBlock = this.recordingBlock;
    if (this.lastError) status.lastError = this.lastError;
    if (this.lastMessageAt !== void 0) status.lastMessageAt = this.lastMessageAt;
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
    const normalizedPageSize = Math.min(100, Math.max(5, Math.floor(pageSize) || 25));
    const normalizedPage = Math.max(1, Math.floor(page) || 1);
    const start = (normalizedPage - 1) * normalizedPageSize;
    return {
      items: this.recordingLog.slice(start, start + normalizedPageSize),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total: this.recordingLog.length
    };
  }
  async listCoreRecordings(page, pageSize) {
    const normalizedPageSize = Math.min(50, Math.max(5, Math.floor(pageSize) || 10));
    const normalizedPage = Math.max(1, Math.floor(page) || 1);
    const sourceUrl = recordingsApiUrl(this.settings.coreApiUrl, normalizedPage, normalizedPageSize);
    const response = await fetch(sourceUrl, {
      headers: compactObject({
        accept: "application/json",
        ...this.session.token ? { authorization: `Bearer ${this.session.token}` } : {}
      })
    });
    if (!response.ok) throw new Error(`FluxIQ recordings API returned ${response.status}.`);
    return normalizeRecordingsResponse(await response.json(), normalizedPage, normalizedPageSize, sourceUrl);
  }
  async connect() {
    this.shouldStayConnected = true;
    this.clearReconnect();
    this.setState("connecting");
    await this.refreshActiveTab();
    await this.client?.close();
    const client = new FluxIQClientGatewayWebSocketClient({
      url: this.settings.gatewayUrl,
      client: this.clientHello(),
      WebSocketImpl: WebSocket,
      tokenStorage: {
        read: () => this.session.token,
        write: async (token) => {
          this.session = compactObject({
            ...this.session,
            token,
            serverUrl: this.settings.gatewayUrl,
            connectedAt: Date.now()
          });
          await writeSession(this.session);
        },
        clear: async () => {
          this.session = compactObject({
            clientId: this.session.clientId,
            sessionId: this.session.sessionId,
            serverUrl: this.settings.gatewayUrl,
            connectedAt: this.session.connectedAt
          });
          await writeSession(this.session);
        }
      }
    });
    this.client = client;
    this.attachClientHandlers(client);
    try {
      await client.connect();
    } catch {
      this.onError("WebSocket connection failed.");
      if (this.shouldStayConnected && this.settings.autoReconnect) this.scheduleReconnect();
    }
  }
  disconnect() {
    this.shouldStayConnected = false;
    this.clearReconnect();
    this.clearPendingRecordingStart();
    this.stopHeartbeat();
    void this.client?.close();
    this.client = null;
    if (this.recordingState === "recording") this.addActivity("connection", "Disconnected during recording", "Events will queue until reconnect.", "warning");
    this.setState("disconnected");
  }
  async startRecording() {
    if (this.pendingRecordingStart) {
      this.addActivity("recording", "Recording is starting", "Waiting for FluxIQ project acceptance.", "warning");
      return;
    }
    if (this.connectionState !== "connected") {
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
    const initialState = await this.buildInitialRecordingState(startedAt);
    await this.sendClientMessage("client.start_recording", {
      recordingId,
      startedAt,
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      initialState,
      environment: this.recordingEnvironment(),
      sources: this.recordingSources(),
      actionChannels: this.recordingActionChannels(),
      metadata: {
        domainId: WEB_AUTOMATION_DOMAIN_ID,
        requestedBy: "extension-record-button",
        activeTabUrl: this.activeTabUrl ?? null
      }
    });
    this.addActivity("recording", "Starting recording", "Waiting for FluxIQ project acceptance.", "warning");
    this.pendingRecordingStart = {
      recordingId,
      timer: setTimeout(() => void this.beginAcceptedRecording(recordingId), 750)
    };
    this.emitStatus();
  }
  async stopRecording(notifyServer = true) {
    if (this.recordingState !== "recording") return;
    await this.captureActiveSnapshot("Final snapshot captured");
    this.recordingState = "idle";
    this.addActivity("recording", "Recording stopped", `${this.eventCount} user actions captured`, "neutral");
    this.emitStatus();
    await this.broadcastToContent({ type: "recording", recording: false, settings: this.settings }, false);
    await this.sendRecordingEvidence({
      kind: "browser.tab",
      sequence: this.nextBackgroundEventSequence(),
      url: this.activeTabUrl ?? "",
      title: "",
      eventTimestampMs: Date.now(),
      metadata: { recordingState: "stopped" }
    });
    if (notifyServer && this.activeRecordingId) {
      await this.sendClientMessage("client.stop_recording", {
        recordingId: this.activeRecordingId,
        endedAt: Date.now()
      });
    }
    this.activeRecordingId = void 0;
  }
  dismissRecordingBlock() {
    this.recordingBlock = void 0;
    if (this.lastError === "Open a FluxIQ project before recording.") this.lastError = void 0;
    this.emitStatus();
  }
  async handleRecordingEvent(payload, tabId, frameId) {
    if (this.recordingState !== "recording") return;
    if (tabId !== void 0 && isNavigationExplanation(payload)) {
      this.recentExplanatoryActions.set(tabId, payload.eventTimestampMs);
    }
    if (isExecutableRecordedAction(payload)) {
      this.eventCount += 1;
      this.addActivity(payload.kind, activityLabel(payload), activityDetail(payload));
      await this.sendClientMessage("client.recording_event", gatewayRecordingEventFromPayload(payload, tabId, frameId, this.activeRecordingId));
      return;
    }
    if (payload.kind !== "content.ready") {
      this.addActivity(payload.kind, `Evidence: ${activityLabel(payload)}`, activityDetail(payload));
    }
    await this.sendRecordingEvidence(payload, tabId, frameId);
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
    if (becameActive && this.recordingState === "recording" && !this.unsupportedPage) {
      await this.attachTabForRecording(tab.id);
      this.addActivity("tab", "Recording active tab", tab.url ?? `Tab ${tab.id}`);
    }
    if (this.connectionState === "connected") {
      await this.sendClientMessage("client.state_update", createWebAutomationStateUpdate({
        activeContextId: String(tab.id),
        contexts: [compactObject({ contextId: String(tab.id), url: tab.url, title: tab.title, status: tab.status })],
        recording: this.recordingState === "recording",
        state: createWebAutomationStateFromTabs(describeActiveTabLike(tab), [describeActiveTabLike(tab)], {
          timestamp: Date.now(),
          sourceId: this.eventSourceId(),
          recording: this.recordingState === "recording",
          permissions: ["activeTab", "scripting", "storage", "tabs"]
        }),
        metadata: { reason: "tab-updated", inputId: WEB_AUTOMATION_INPUT_IDS.browserState }
      }));
      await this.sendBrowserState();
    }
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
    const existing = this.pendingNavigations.get(tabId);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      this.pendingNavigations.delete(tabId);
      void this.recordNavigation(tabId, url, timestamp, explicitlyTyped);
    }, 250);
    this.pendingNavigations.set(tabId, { url, timer });
  }
  async recordNavigation(tabId, url, timestamp, explicitlyTyped) {
    if (this.recordingState !== "recording") return;
    const explainedAt = this.recentExplanatoryActions.get(tabId);
    if (!explicitlyTyped && explainedAt !== void 0 && timestamp - explainedAt >= 0 && timestamp - explainedAt < 5e3) return;
    const previous = this.lastRecordedNavigation.get(tabId);
    if (previous?.url === url && timestamp - previous.timestamp < 1e3) return;
    this.lastRecordedNavigation.set(tabId, { url, timestamp });
    await this.handleRecordingEvent({
      kind: "browser.navigation",
      sequence: this.nextBackgroundEventSequence(),
      url,
      title: "",
      eventTimestampMs: timestamp,
      metadata: explicitlyTyped ? { transition: "typed" } : void 0
    }, tabId);
  }
  async onOpen() {
    this.reconnectAttempt = 0;
    this.lastError = void 0;
    this.setState(this.session.token ? "connecting" : "pairing");
    this.startHeartbeat();
  }
  nextBackgroundEventSequence() {
    this.backgroundEventSequence = (this.backgroundEventSequence + 1) % 1e3;
    return Date.now() * 1e3 + this.backgroundEventSequence;
  }
  onClose() {
    this.stopHeartbeat();
    this.client = null;
    if (this.shouldStayConnected && this.settings.autoReconnect) {
      this.scheduleReconnect();
    } else {
      this.setState("disconnected");
    }
  }
  onError(message) {
    this.lastError = message;
    this.setState("error");
  }
  clientHello() {
    return {
      clientId: this.session.clientId,
      clientType: "extension",
      name: "FluxIQ Browser Extension",
      version: browserDescriptor().extensionVersion,
      ...this.session.token !== void 0 ? { token: this.session.token } : {},
      capabilities: browserExtensionCapabilities,
      metadata: {
        domainId: WEB_AUTOMATION_DOMAIN_ID,
        browser: browserDescriptor(),
        settings: {
          captureMutations: this.settings.captureMutations,
          captureInputValues: this.settings.captureInputValues,
          captureSnapshots: this.settings.captureSnapshots
        }
      }
    };
  }
  attachClientHandlers(client) {
    client.on("open", () => void this.onOpen());
    client.on("close", () => this.onClose());
    client.on("error", () => this.onError("WebSocket connection failed."));
    client.on("message", ({ message }) => void this.onMessage(message));
    client.on("pairing_required", ({ message }) => {
      this.pairingReferenceCode = message.payload.referenceCode;
      this.setState("pairing");
      this.lastError = message.payload.reason || "Approve this client in FluxIQ.";
      this.addActivity("pairing", "Waiting for approval", this.pairingReferenceCode ? `Reference ${this.pairingReferenceCode}` : void 0, "warning");
      this.emitStatus();
    });
    client.on("session_ready", ({ message }) => void this.onSessionReady(message));
    client.on("start_recording", ({ message }) => void this.handleServerCommandPayload({ ...message.payload, command: "start_recording" }, message.id));
    client.on("stop_recording", ({ message }) => void this.handleServerCommandPayload({ ...message.payload, command: "stop_recording" }, message.id));
    client.on("capture_snapshot", ({ message }) => void this.handleServerCommandPayload({ ...message.payload, command: "capture_snapshot" }, message.id));
    client.on("execute_action", ({ message }) => void this.handleServerCommandPayload({ command: "execute_action", action: browserActionFromGatewayCommand(message.payload) }, message.id));
  }
  async onMessage(message) {
    this.lastMessageAt = Date.now();
    if (message.type === "server.ping") {
      this.lastMessageAt = Date.now();
      this.emitStatus();
      return;
    }
    if (message.type === "server.error") {
      this.lastError = message.payload.message;
      if (message.payload.code === "recording.project_required") {
        this.handleRecordingProjectRequired(message.payload.message);
        return;
      }
      this.setState("error");
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
    this.session = compactObject({
      ...this.session,
      sessionId: message.payload.sessionId,
      token: message.payload.token,
      serverUrl: this.settings.gatewayUrl,
      connectedAt: Date.now()
    });
    this.pairingReferenceCode = void 0;
    await writeSession(this.session);
    this.setState("connected");
    this.addActivity("connection", "Connected to FluxIQ", "Client session ready", "success");
    await this.sendBrowserState();
    await this.flushQueue();
  }
  async handleServerCommandPayload(payload, messageId) {
    if (payload.command === "ping") {
      this.lastMessageAt = Date.now();
      this.emitStatus();
      return;
    }
    if (payload.command === "disconnect") {
      this.disconnect();
      return;
    }
    if (payload.command === "start_recording") {
      await this.beginAcceptedRecording(payload.recordingId);
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
      await this.captureActiveSnapshot("Snapshot captured");
      return;
    }
    if (payload.command === "execute_action") {
      const action = payload.action;
      const tabId = action.tabId ?? this.activeTabId;
      if (tabId === void 0) {
        await this.sendActionResult({
          commandId: action.commandId,
          actionType: action.actionType,
          status: "failed",
          message: "No active tab is available.",
          startedAt: Date.now(),
          finishedAt: Date.now()
        });
        return;
      }
      if (action.actionType === "web.browser.navigate" && action.url) {
        const startedAt = Date.now();
        await chrome.tabs.update(tabId, { url: action.url });
        await this.sendActionResult({
          commandId: action.commandId,
          actionType: action.actionType,
          status: "succeeded",
          message: "Navigation requested.",
          url: action.url,
          startedAt,
          finishedAt: Date.now()
        });
        return;
      }
      await this.attachTabForRecording(tabId);
      const result = await sendToTab(tabId, { type: "executeAction", action }, action.frameId);
      await this.sendActionResult(result, tabId, action.frameId);
    }
  }
  async beginAcceptedRecording(recordingId) {
    this.clearPendingRecordingStart();
    if (this.recordingState === "recording") return;
    this.resetRecordingLog();
    this.recordingBlock = void 0;
    this.activeRecordingId = recordingId;
    this.eventCount = 0;
    this.recentActivities.length = 0;
    this.recordingStartedAt = Date.now();
    this.recordingState = "recording";
    this.addActivity("recording", "Recording started", this.activeTabUrl ?? "Active tab", "success");
    this.emitStatus();
    if (this.activeTabId !== void 0) await this.attachTabForRecording(this.activeTabId);
    await this.sendBrowserState();
    await this.handleRecordingEvent({
      kind: "browser.tab",
      sequence: this.nextBackgroundEventSequence(),
      url: this.activeTabUrl ?? "",
      title: "",
      eventTimestampMs: Date.now(),
      metadata: { recordingState: "started", recordingId }
    });
    if (this.activeTabUrl) {
      await this.handleRecordingEvent({
        kind: "browser.navigation",
        sequence: this.nextBackgroundEventSequence(),
        url: this.activeTabUrl,
        title: "",
        eventTimestampMs: Date.now(),
        metadata: { reason: "recording_start" }
      }, this.activeTabId);
    }
    await this.captureActiveSnapshot("Initial snapshot captured");
  }
  handleRecordingProjectRequired(message) {
    this.clearPendingRecordingStart();
    if (this.recordingState === "recording") {
      this.recordingState = "idle";
      void this.broadcastToContent({ type: "recording", recording: false, settings: this.settings }, false);
    }
    this.recordingStartedAt = void 0;
    this.activeRecordingId = void 0;
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
  async sendBrowserState() {
    await this.sendClientMessage("client.state_update", browserStateFromTabs(await activeTab(), await allTabs(), this.recordingState));
  }
  async sendRecordingEvidence(payload, tabId, frameId) {
    const state = isDomSnapshotPayload(payload.snapshot) ? createWebAutomationStateFromSnapshot(payload.snapshot, {
      timestamp: payload.eventTimestampMs,
      ...tabId === void 0 ? {} : { sourceId: this.tabSourceId(tabId, frameId) }
    }) : compactObject({
      latestEvidence: recordingEvidencePayload(payload)
    });
    await this.sendClientMessage("client.state_update", createWebAutomationStateUpdate({
      ...tabId === void 0 ? {} : { activeContextId: String(tabId) },
      state,
      metadata: compactObject({
        reason: "recording-evidence",
        inputId: WEB_AUTOMATION_INPUT_IDS.recordingEvidence,
        clientKind: payload.kind,
        eventTimestampMs: payload.eventTimestampMs,
        ...tabId === void 0 ? {} : { tabId },
        ...frameId === void 0 ? {} : { frameId },
        ...payload.metadata ?? {}
      })
    }));
  }
  async sendActionResult(result, tabId, frameId) {
    await this.sendClientMessage("client.action_result", gatewayActionResultFromBrowserResult(result));
    await this.handleRecordingEvent(compactObject({
      kind: "action.result",
      sequence: this.nextBackgroundEventSequence(),
      url: result.url ?? this.activeTabUrl ?? "",
      title: result.title ?? "",
      eventTimestampMs: result.finishedAt,
      element: result.element,
      snapshot: result.snapshot,
      actionResult: result
    }), tabId, frameId);
  }
  async sendClientMessage(type, payload, _tabId, _frameId) {
    if (this.client?.connected) {
      await this.client.send(type, payload);
      return;
    }
    const message = createClientGatewayMessage(type, payload, {
      clientId: this.session.clientId,
      ...this.session.sessionId !== void 0 ? { sessionId: this.session.sessionId } : {}
    });
    this.queueSize = await queueEvent(message);
    this.emitStatus();
  }
  async flushQueue() {
    if (!this.client?.connected) return;
    const queued = await readQueuedEvents();
    for (const message of queued) {
      await this.client.send(message.type, message.payload);
    }
    await clearQueuedEvents();
    this.queueSize = 0;
    this.emitStatus();
  }
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.connectionState === "connected") void this.sendBrowserState();
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
  async refreshActiveTab() {
    const tab = await activeTab();
    this.activeTabId = tab?.tabId;
    this.activeTabUrl = tab?.url;
    this.unsupportedPage = unsupportedPageForUrl(tab?.url);
    this.emitStatus();
  }
  async broadcastToContent(message, injectMissing) {
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(tabs.map(async (tab) => {
      if (tab.id === void 0 || unsupportedPageForUrl(tab.url)) return;
      if (injectMissing) await ensureContentScript(tab.id);
      await sendToTab(tab.id, message);
    }));
  }
  setState(state) {
    this.connectionState = state;
    this.emitStatus();
  }
  emitStatus() {
    const status = this.status();
    for (const listener of this.listeners) listener(status);
    void chrome.runtime.sendMessage({ type: "fluxiq.statusChanged", status }).catch(() => void 0);
  }
  async captureActiveSnapshot(label) {
    const tabId = this.activeTabId;
    if (tabId === void 0) return;
    if (this.unsupportedPage) {
      this.addActivity("snapshot", "Snapshot skipped", this.unsupportedPage.reason, "warning");
      return;
    }
    try {
      await this.attachTabForRecording(tabId);
      const snapshot = await sendToTab(tabId, { type: "captureSnapshot" });
      await this.sendClientMessage("client.snapshot", gatewaySnapshotFromDomSnapshot(snapshot));
      this.addActivity("snapshot", label, this.activeTabUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Content script is unavailable.";
      this.unsupportedPage = { url: this.activeTabUrl, reason: message };
      this.addActivity("snapshot", "Snapshot failed", message, "warning");
      this.emitStatus();
    }
  }
  addActivity(kind, label, detail, tone = "neutral") {
    const timestamp = Date.now();
    this.lastActivityAt = timestamp;
    const entry = compactObject({
      id: `${kind}.${timestamp}.${Math.random().toString(36).slice(2)}`,
      timestamp,
      kind,
      label,
      detail,
      tone
    });
    this.recentActivities.unshift(entry);
    this.recentActivities.splice(20);
    this.recordingLog.unshift(entry);
    this.recordingLog.splice(500);
    this.emitStatus();
  }
  resetRecordingLog() {
    this.eventCount = 0;
    this.recentActivities.length = 0;
    this.recordingLog.length = 0;
    this.lastActivityAt = void 0;
  }
  async attachTabForRecording(tabId) {
    await ensureContentScript(tabId);
    await sendToTab(tabId, { type: "recording", recording: this.recordingState === "recording", settings: this.settings });
  }
  async buildInitialRecordingState(timestamp) {
    const tabId = this.activeTabId;
    if (tabId !== void 0 && !this.unsupportedPage) {
      try {
        await this.attachTabForRecording(tabId);
        const snapshot = await sendToTab(tabId, { type: "captureSnapshot" });
        if (isDomSnapshotPayload(snapshot)) {
          return createWebAutomationStateFromSnapshot(snapshot, {
            timestamp,
            sourceId: this.tabSourceId(tabId)
          });
        }
      } catch {
      }
    }
    return browserStateSnapshotFromTabs(await activeTab(), await allTabs(), this.recordingState, timestamp, this.eventSourceId());
  }
  recordingEnvironment() {
    return compactObject({
      id: `client.${this.session.clientId}.browser`,
      label: "FluxIQ Browser Extension",
      kind: "browser_extension",
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      capabilities: browserExtensionCapabilities.map((capability) => capability.id),
      metadata: compactObject({
        browser: browserDescriptor(),
        activeTabUrl: this.activeTabUrl
      })
    });
  }
  recordingSources() {
    return [
      { id: this.eventSourceId(), label: "Browser events", kind: "event", schemaId: WEB_AUTOMATION_DOMAIN_ID, metadata: { clientId: this.session.clientId } },
      { id: this.observationSourceId(), label: "Browser observations", kind: "observation", schemaId: WEB_AUTOMATION_DOMAIN_ID, metadata: { clientId: this.session.clientId } },
      { id: this.stateSourceId(), label: "Browser state", kind: "state", schemaId: WEB_AUTOMATION_DOMAIN_ID, metadata: { clientId: this.session.clientId } }
    ];
  }
  recordingActionChannels() {
    return [{
      id: `client.${this.session.clientId}.actions`,
      label: "Browser action channel",
      actionTypes: actionTypesFromCapabilities(browserExtensionCapabilities),
      capabilities: browserExtensionCapabilities.map((capability) => capability.id),
      metadata: { clientId: this.session.clientId }
    }];
  }
  eventSourceId() {
    return `client.${this.session.clientId}.events`;
  }
  observationSourceId() {
    return `client.${this.session.clientId}.observations`;
  }
  stateSourceId() {
    return `client.${this.session.clientId}.state`;
  }
  tabSourceId(tabId, frameId) {
    return `tab:${tabId}${frameId === void 0 ? "" : `:frame:${frameId}`}`;
  }
};
function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}
function isExecutableRecordedAction(payload) {
  return recordedInputId(payload) !== void 0;
}
function isNavigationExplanation(payload) {
  return payload.kind === "dom.click" || payload.kind === "dom.submit";
}
function recordedInputId(payload) {
  return webAutomationInputIdForRecordedEvent({
    kind: payload.kind,
    url: payload.url,
    title: payload.title,
    sequence: payload.sequence,
    ...payload.element ? { element: elementTarget(payload.element) } : {},
    ...payload.inputValue !== void 0 ? { inputValue: payload.inputValue } : {},
    ...payload.key !== void 0 ? { key: payload.key } : {},
    ...payload.scroll ? { scroll: payload.scroll } : {},
    ...payload.metadata ? { metadata: payload.metadata } : {}
  });
}
function recordingEvidencePayload(payload) {
  return compactObject({
    kind: payload.kind,
    url: payload.url,
    title: payload.title,
    sequence: payload.sequence,
    timestamp: payload.eventTimestampMs,
    element: payload.element,
    snapshot: payload.snapshot,
    inputValue: payload.inputValue,
    key: payload.key,
    scroll: payload.scroll,
    mutation: payload.mutation,
    actionResult: payload.actionResult,
    metadata: payload.metadata
  });
}
function browserStateFromTabs(active, tabs, recordingState) {
  return createWebAutomationStateUpdate({
    ...active?.tabId === void 0 ? {} : { activeContextId: String(active.tabId) },
    recording: recordingState === "recording",
    contexts: tabs.map((tab) => compactObject({
      contextId: String(tab.tabId),
      url: tab.url,
      title: tab.title,
      faviconUrl: tab.favIconUrl,
      active: tab.active,
      metadata: compactObject({
        kind: "browser.tab",
        windowId: tab.windowId,
        status: tab.status
      })
    })),
    state: browserStateSnapshotFromTabs(active, tabs, recordingState, Date.now()),
    metadata: { inputId: WEB_AUTOMATION_INPUT_IDS.browserState }
  });
}
function gatewayRecordingEventFromPayload(payload, tabId, frameId, recordingId) {
  const inputId = recordedInputId(payload);
  return createWebAutomationRecordingEvent({
    kind: payload.kind,
    sequence: payload.sequence,
    url: payload.url,
    title: payload.title,
    eventTimestampMs: payload.eventTimestampMs,
    element: payload.element ? elementTarget(payload.element) : void 0,
    snapshot: payload.snapshot,
    inputValue: payload.inputValue,
    key: payload.key,
    scroll: payload.scroll,
    mutation: payload.mutation,
    actionResult: payload.actionResult ? webAutomationActionResultPayload(payload.actionResult) : void 0,
    metadata: inputId === void 0 ? payload.metadata : { ...payload.metadata ?? {}, inputId }
  }, {
    ...recordingId !== void 0 ? { recordingId } : {},
    ...tabId !== void 0 ? { tabId } : {},
    ...frameId !== void 0 ? { frameId } : {}
  });
}
function gatewaySnapshotFromDomSnapshot(snapshot) {
  const timestamp = Date.now();
  const state = isDomSnapshotPayload(snapshot) ? createWebAutomationStateFromSnapshot(snapshot, { timestamp }) : void 0;
  return compactObject({
    snapshotId: `dom.${timestamp}`,
    timestamp,
    kind: state ? "state" : "structured",
    ...state !== void 0 ? { state } : {},
    payload: snapshot
  });
}
function browserActionFromGatewayCommand(command) {
  return webAutomationActionFromGatewayCommand(command);
}
function gatewayActionResultFromBrowserResult(result) {
  return compactObject({
    commandId: result.commandId,
    status: result.status,
    startedAt: result.startedAt,
    completedAt: result.finishedAt,
    message: result.message,
    target: result.element ? webAutomationActionTargetFromElement(result.element) : void 0,
    payload: compactObject({
      url: result.url,
      title: result.title,
      snapshot: result.snapshot,
      extracted: result.extracted
    }),
    error: result.status === "failed" ? result.message : void 0
  });
}
function elementTarget(element) {
  return compactObject({
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
    attributes: element.attributes
  });
}
function stringValue2(value) {
  return typeof value === "string" ? value : void 0;
}
function numberValue2(value) {
  return typeof value === "number" ? value : void 0;
}
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
function isDomSnapshotPayload(value) {
  if (!value || typeof value !== "object") return false;
  const snapshot = value;
  return typeof snapshot.url === "string" && typeof snapshot.title === "string" && Boolean(snapshot.viewport) && typeof snapshot.viewport?.width === "number" && typeof snapshot.viewport.height === "number" && typeof snapshot.viewport.scrollX === "number" && typeof snapshot.viewport.scrollY === "number" && Array.isArray(snapshot.interactiveElements);
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
function recordingsApiUrl(coreApiUrl, page, pageSize) {
  const url = new URL("/api/recordings", coreApiUrl || "http://127.0.0.1:4777");
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));
  return url.toString();
}
function normalizeRecordingsResponse(value, page, pageSize, sourceUrl) {
  const object = value && typeof value === "object" ? value : {};
  const rawItems = Array.isArray(object.items) ? object.items : Array.isArray(object.recordings) ? object.recordings : [];
  return {
    items: rawItems.map(normalizeRecordingSummary).filter((item) => Boolean(item)),
    page: numberValue2(object.page) ?? page,
    pageSize: numberValue2(object.pageSize) ?? pageSize,
    total: numberValue2(object.total),
    sourceUrl
  };
}
function normalizeRecordingSummary(value) {
  if (!value || typeof value !== "object") return void 0;
  const object = value;
  const id = stringValue2(object.id) ?? stringValue2(object.recordingId);
  if (!id) return void 0;
  return compactObject({
    id,
    title: stringValue2(object.title) ?? stringValue2(object.name) ?? id,
    status: stringValue2(object.status),
    projectId: stringValue2(object.projectId),
    taskId: stringValue2(object.taskId),
    eventCount: numberValue2(object.eventCount),
    startedAt: timestampValue(object.startedAt),
    endedAt: timestampValue(object.endedAt),
    updatedAt: timestampValue(object.updatedAt)
  });
}
function timestampValue(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return void 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? void 0 : parsed;
}

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
    await manager.handleRecordingEvent(typed.payload, tabId, sender.frameId);
    return { ok: true };
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
