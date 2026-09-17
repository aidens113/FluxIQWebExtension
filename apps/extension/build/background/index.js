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

// src/background/tabs.ts
var REQUIRED_CONTENT_SCRIPT_VERSION = 2;
var TOP_FRAME_ID = 0;
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
async function ensureContentScript(tabId, frameId = TOP_FRAME_ID) {
  try {
    const response2 = await sendToTab(tabId, { type: "fluxiq.ping" }, frameId);
    if (response2.ok === true && response2.version === REQUIRED_CONTENT_SCRIPT_VERSION) return;
  } catch {
  }
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    files: ["content/index.js"]
  });
  const response = await sendToTab(tabId, { type: "fluxiq.ping" }, frameId);
  if (response.ok !== true || response.version !== REQUIRED_CONTENT_SCRIPT_VERSION) {
    throw new Error(`FluxIQ content script did not become ready in ${frameDescription(frameId)}.`);
  }
}
async function unreachableFrameReason(tabId, frameId) {
  try {
    await ensureContentScript(tabId, frameId);
    return void 0;
  } catch (error) {
    const detail = error instanceof Error ? error.message.trim() : "";
    return detail || `${frameDescription(frameId)} did not answer.`;
  }
}
function frameDescription(frameId) {
  return frameId === TOP_FRAME_ID ? "the top frame" : `frame ${frameId}`;
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
  dataExtractionDefined: "web.data.extraction_defined",
  snapshotCaptured: "web.snapshot.captured",
  actionExecuted: "web.action.executed",
  clientError: "web.client.error"
};

// ../../domain/src/actions/extraction/field-key.ts
var FIELD_KEY_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
var RESERVED_FIELD_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
function isWebAutomationExtractFieldKey(key) {
  return typeof key === "string" && FIELD_KEY_PATTERN.test(key) && !RESERVED_FIELD_KEYS.has(key);
}

// ../../domain/src/output-nodes/targets/targets.ts
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

// ../../domain/src/actions/extraction/request.ts
var WEB_AUTOMATION_EXTRACT_PAGINATION_MODES = ["next", "loadMore", "scroll", "numbered"];
var WEB_AUTOMATION_EXTRACT_FIELD_KINDS = ["text", "attribute", "link", "value", "column"];
var WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS = ["include", "exclude", "encrypt"];
var WEB_AUTOMATION_EXTRACT_READ_MODES = ["text", "attribute", "value", "html"];
var WEB_AUTOMATION_EXTRACT_MAX_PAGES = 50;
var WEB_AUTOMATION_EXTRACT_MAX_ITEMS = 1e3;
var WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS = 1e4;
function webAutomationExtractListTimeoutMs(request) {
  const paginate = request.paginate;
  const pages = paginate === void 0 ? 1 : paginate.mode === "scroll" ? paginate.maxScrolls : paginate.maxPages;
  return WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS * pages;
}

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

// ../../domain/src/actions/extraction/recorded-definition.ts
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

// ../../domain/src/actions/extraction/summary.ts
function webAutomationExtractionSummaryValue(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
  const summary = value;
  const recordCount = countValue(summary.recordCount);
  const pagesRead = countValue(summary.pagesRead);
  const fieldNames = fieldKeyList(summary.fieldNames);
  const missingFields = fieldKeyList(summary.missingFields);
  if (recordCount === void 0 || pagesRead === void 0 || typeof summary.truncated !== "boolean" || fieldNames === void 0 || missingFields === void 0) return void 0;
  if (!missingFields.every((key) => fieldNames.includes(key))) return void 0;
  return { recordCount, pagesRead, truncated: summary.truncated, missingFields, fieldNames };
}
function countValue(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
}
function fieldKeyList(value) {
  return Array.isArray(value) && value.every(isWebAutomationExtractFieldKey) ? [...value] : void 0;
}

// ../../domain/src/actions/types.ts
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
var MAX_ID_LENGTH = 200;
var NONCE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/u;
var SEPARATOR = ":";
var FALLBACK_NAME = "dataset";
var OUTSIDE_NAME_CHARACTERS = /[^a-z0-9._-]+/u;
var COMBINING_MARKS = new RegExp("\\p{M}+", "gu");
function webAutomationDatasetId(label, nonce) {
  if (!NONCE_PATTERN.test(nonce)) {
    throw new RangeError("A dataset id nonce must be 1 to 64 characters of A-Z, a-z, 0-9, '.', '_' or '-'.");
  }
  const words = label.toLowerCase().normalize("NFKD").replace(COMBINING_MARKS, "").split(OUTSIDE_NAME_CHARACTERS).filter((word) => word.length > 0);
  const name = words.join("-").slice(0, MAX_ID_LENGTH - SEPARATOR.length - nonce.length) || FALLBACK_NAME;
  return `${name}${SEPARATOR}${nonce}`;
}

// ../../domain/src/extraction/label-key.ts
var COMBINING_MARKS2 = new RegExp("\\p{M}+", "gu");

// ../../domain/src/extraction/structure-detection.ts
var WEB_AUTOMATION_STRUCTURE_DETECTION_REFUSALS = ["target_not_found", "ambiguous_target", "no_repeating_run", "sensitive_region"];
function webAutomationStructureDetectionRequestValue(value) {
  const request = record(value);
  if (!request || Object.keys(request).some((key) => key !== "selector")) return void 0;
  if (request.selector === void 0) return {};
  return typeof request.selector === "string" && request.selector.trim() !== "" ? { selector: request.selector } : void 0;
}
function webAutomationStructureDetectionValue(value) {
  const detection = record(value);
  if (!detection) return void 0;
  if (detection.ok === false) {
    const refused = WEB_AUTOMATION_STRUCTURE_DETECTION_REFUSALS.find((code) => code === detection.refused);
    return refused === void 0 ? void 0 : { ok: false, refused };
  }
  if (detection.ok !== true) return void 0;
  if (detection.infiniteScroll !== void 0 && detection.infiniteScroll !== true) return void 0;
  const proposal = proposalValue(detection.proposal);
  if (!proposal) return void 0;
  return detection.infiniteScroll === true ? { ok: true, proposal, infiniteScroll: true } : { ok: true, proposal };
}
function proposalValue(value) {
  const proposal = record(value);
  if (!proposal || typeof proposal.container !== "string" || proposal.container === "") return void 0;
  if (!Array.isArray(proposal.fields) || proposal.fields.length === 0) return void 0;
  const itemCount = count(proposal.itemCount);
  const confidence = unitInterval(proposal.confidence);
  const fields = proposal.fields.map(fieldValue2);
  if (itemCount === void 0 || confidence === void 0) return void 0;
  const named = fields.filter((field) => field !== void 0);
  if (named.length !== fields.length || new Set(named.map((field) => field.key)).size !== named.length) return void 0;
  const request = webAutomationExtractListRequestValue({
    item: proposal.item,
    fields: Object.fromEntries(named.map((field) => [field.key, field.spec])),
    paginate: proposal.pagination
  });
  if (!request) return void 0;
  const copied = [];
  for (const field of named) {
    const spec = request.fields[field.key];
    if (spec === void 0 || typeof spec === "string") return void 0;
    copied.push({ key: field.key, label: field.label, spec, coverage: field.coverage });
  }
  const pagination = request.paginate;
  return pagination === void 0 ? { container: proposal.container, item: request.item, itemCount, fields: copied, confidence } : { container: proposal.container, item: request.item, itemCount, fields: copied, pagination, confidence };
}
function fieldValue2(value) {
  const field = record(value);
  const spec = record(field?.spec);
  if (!field || !spec || spec.element !== void 0) return void 0;
  if (typeof field.key !== "string" || typeof field.label !== "string") return void 0;
  const coverage = unitInterval(field.coverage);
  return coverage === void 0 ? void 0 : { key: field.key, label: field.label, spec, coverage };
}
function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function count(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
}
function unitInterval(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : void 0;
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
  const count3 = state.items.length;
  if (state.index < count3) {
    const index = state.index;
    iteration.set({ items: state.items, index: index + 1 });
    return { status: "success", route: "body", outputs: { item: state.items[index] ?? null, index, count: count3 } };
  }
  iteration.set();
  return { status: "success", route: "done", outputs: { count: count3 } };
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
    const record2 = {};
    for (const [key, item] of Object.entries(value)) {
      const kept = keptJsonValue(item);
      if (kept !== item)
        changed = true;
      record2[key] = kept;
    }
    return changed ? record2 : value;
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
    inputs: [controlInput2],
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

// ../../domain/src/sensitivity/signature.ts
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

// ../../domain/src/sensitivity/descriptor.ts
function sensitiveFieldSignatureOfDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) return {};
  const record2 = descriptor;
  const attributes = record2.attributes && typeof record2.attributes === "object" && !Array.isArray(record2.attributes) ? record2.attributes : {};
  return {
    inputType: stringField(record2.inputType),
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

// ../../domain/src/sensitivity/redaction.ts
var WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT = "(withheld: the action ran on a control that holds a secret)";
function isProducerRedactedComparison(validation) {
  if (!validation || typeof validation !== "object" || Array.isArray(validation)) return false;
  return validation.redacted === true;
}

// ../../domain/src/output-nodes/recorded-element-key.ts
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

// ../../domain/src/output-nodes/secret-binding.ts
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
function webAutomationUnresolvedSecretParameters(parameters) {
  return Object.entries(parameters).flatMap(([parameter, value]) => {
    const path = webAutomationSecretBindingPath(value);
    return path === void 0 ? [] : [{ parameter, path }];
  });
}

// ../../domain/src/output-nodes/upload-binding.ts
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

// ../../domain/src/output-nodes/url-path.ts
function webAutomationUrlPath(value) {
  return typeof value === "string" && /^\/(?![/\\])[^?#]*$/u.test(value) ? value : void 0;
}

// ../../domain/src/output-nodes/payloads.ts
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
      const element = objectValue3(payload.element);
      if (stringValue3(element?.inputType)?.toLowerCase() === "file") return payload.inputValue === "" || element?.hasValue === false ? void 0 : WEB_AUTOMATION_INPUT_IDS.filesChosen;
      if (stringValue3(element?.tagName)?.toLowerCase() === "select") return WEB_AUTOMATION_INPUT_IDS.optionSelected;
      if (isCheckableElement(element)) return WEB_AUTOMATION_INPUT_IDS.checkboxToggled;
      return payload.inputValue === "" ? WEB_AUTOMATION_INPUT_IDS.fieldCleared : WEB_AUTOMATION_INPUT_IDS.textEntered;
    }
    default:
      return void 0;
  }
}
function isCheckableElement(element) {
  const inputType = stringValue3(element?.inputType)?.toLowerCase();
  if (inputType === "checkbox" || inputType === "radio") return true;
  const role = stringValue3(element?.role)?.toLowerCase();
  return role === "checkbox" || role === "radio" || role === "switch";
}
var SELECT_VALUE_CHANGE_KEYS = /* @__PURE__ */ new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]);
function isSelectValueChangeKeyPress(payload) {
  const element = objectValue3(payload.element);
  if (stringValue3(element?.tagName)?.toLowerCase() !== "select") return false;
  const key = stringValue3(payload.key);
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
    const tab = objectValue3(value);
    return tab?.operation === "close" || tab?.operation === "switch" && isNonEmptyString(tab.urlPath);
  }
  return isNonEmptyString(value) || webAutomationSecretBindingPath(value) !== void 0;
}
function recordedTabInputId(payload) {
  const operation = objectValue3(payload.tab)?.operation;
  if (operation === "switch") return WEB_AUTOMATION_INPUT_IDS.tabSwitched;
  if (operation === "close") return WEB_AUTOMATION_INPUT_IDS.tabClosed;
  return void 0;
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}
function objectValue3(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function stringValue3(value) {
  return typeof value === "string" ? value : void 0;
}

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

// ../../domain/src/actions/capabilities.ts
var webAutomationClientCapabilities = webAutomationGatewayCapabilities;

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

// ../../domain/src/page-evidence/wire.ts
function pageEvidenceWire(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
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

// ../../domain/src/recording/web-state/compact-json-object.ts
function compactJsonObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}

// ../../domain/src/recording/web-state/element/identity.ts
var MAX_STATE_ID_LENGTH = 120;
function meaningfulText(value) {
  return typeof value === "string" && value.trim().length >= 2;
}
function stableAttribute(element, name) {
  const value = element.attributes?.[name];
  return meaningfulText(value) ? value : void 0;
}
function stableElementId(element) {
  return stableAttribute(element, "data-testid") ?? stableAttribute(element, "data-test") ?? stableAttribute(element, "data-cy") ?? stableAttribute(element, "id") ?? stableAttribute(element, "name");
}
function elementStateId(element) {
  const stable = stableElementPathId(element);
  if (stable) return sanitizeStateId(stable);
  const name = stableAttribute(element, "name");
  if (name) return sanitizeStateId(`${name}.${element.selector}`);
  return sanitizeStateId(element.selector);
}
function elementStateIdAssigner(reservedIds = []) {
  const taken = new Set(reservedIds);
  const occurrences = /* @__PURE__ */ new Map();
  return (element) => {
    const base = elementStateId(element);
    let occurrence = (occurrences.get(base) ?? 0) + 1;
    let candidate = occurrence === 1 ? base : `${base}.${occurrence}`;
    while (taken.has(candidate)) {
      occurrence += 1;
      candidate = `${base}.${occurrence}`;
    }
    occurrences.set(base, occurrence);
    taken.add(candidate);
    return candidate;
  };
}
function stableElementPathId(element) {
  return stableAttribute(element, "data-testid") ?? stableAttribute(element, "data-test") ?? stableAttribute(element, "data-cy") ?? stableAttribute(element, "id");
}
function sanitizeStateId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, MAX_STATE_ID_LENGTH) || "element";
}

// ../../domain/src/recording/web-state/element/kind.ts
function isLikelyActionableElement(element) {
  const tagName = element.tagName.toLowerCase();
  const role = element.role?.toLowerCase();
  const inputType = element.inputType?.toLowerCase();
  return tagName === "button" || tagName === "a" || tagName === "select" || tagName === "textarea" || tagName === "summary" || tagName === "label" || tagName === "input" && inputType !== "hidden" || role === "button" || role === "link" || role === "menuitem" || role === "checkbox" || role === "radio" || role === "tab" || role === "switch" || element.hasClickHandler === true || element.attributes?.onclick !== void 0;
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
function isEnabled(element) {
  return element.attributes?.disabled === void 0 && element.attributes?.["aria-disabled"] !== "true";
}

// ../../domain/src/recording/web-state/geometry.ts
function stateBounds(bounds) {
  if (!bounds) return void 0;
  const x = finite(bounds.x);
  const y = finite(bounds.y);
  const width = positiveFinite(bounds.width);
  const height = positiveFinite(bounds.height);
  return x !== void 0 && y !== void 0 && width !== void 0 && height !== void 0 ? { x, y, width, height } : void 0;
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
function positiveFinite(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
function finite(value) {
  return Number.isFinite(value) ? value : void 0;
}

// ../../domain/src/recording/web-state/element/selection.ts
var MAX_STATE_ELEMENTS = 1500;
var WEB_AUTOMATION_ELEMENT_SUMMARY_STATE_IDS = ["count", "captured", "truncated", "captureTruncated", "stateTruncated"];
function shouldCaptureElementState(element) {
  if (!hasElementBounds(element)) return false;
  return Boolean(
    isLikelyInteractableElement(element) && hasMeaningfulElementIdentity(element) || meaningfulText(element.text) || meaningfulText(element.visibleText) || meaningfulText(element.name) || meaningfulText(element.value) || meaningfulText(element.href)
  );
}
function filterStateElements(elements, limit = MAX_STATE_ELEMENTS) {
  const eligible = elements.map((element, documentIndex) => ({ element, documentIndex })).filter((entry) => shouldCaptureElementState(entry.element));
  const ranked = [...eligible].sort(
    (left, right) => stateElementBucket(left.element) - stateElementBucket(right.element) || stateElementScore(right.element) - stateElementScore(left.element)
  );
  const kept = ranked.slice(0, Math.max(0, limit)).map((entry, rank) => ({ ...entry, rank }));
  kept.sort((left, right) => left.documentIndex - right.documentIndex);
  const assignStateId = elementStateIdAssigner(WEB_AUTOMATION_ELEMENT_SUMMARY_STATE_IDS);
  const named = kept.map((entry) => ({ element: entry.element, stateId: assignStateId(entry.element), rank: entry.rank }));
  named.sort((left, right) => left.rank - right.rank);
  return {
    elements: named.map(({ element, stateId }) => ({ element, stateId })),
    total: elements.length,
    eligible: eligible.length,
    captured: named.length,
    truncated: eligible.length > named.length
  };
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
function hasElementBounds(element) {
  return stateBounds(element.documentBounds ?? element.bounds) !== void 0;
}

// ../../domain/src/recording/web-state/visual-frame.ts
var MAX_VISUAL_FRAME_ELEMENTS = 1e3;
var WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID = "web-automation.viewport";
var WEB_AUTOMATION_SCREEN_FRAME_ID = "screen";
var WEB_AUTOMATION_DOCUMENT_FRAME_ID = "document";
function withScreenVisualFrame(state, snapshot, elements, input = {}) {
  const rendered = elements.slice(0, MAX_VISUAL_FRAME_ELEMENTS);
  return {
    ...state,
    id: state.id ?? `web.snapshot.${state.timestamp}`,
    presentation: {
      ...state.presentation ?? {},
      defaultFrameId: WEB_AUTOMATION_SCREEN_FRAME_ID,
      visualFrames: [screenVisualFrame(snapshot, rendered, input), documentVisualFrame(snapshot, rendered)]
    }
  };
}
function safeLayerId(value, fallbackIndex) {
  return value.replace(/[^a-z0-9.]+/gi, ".").replace(/^\.+|\.+$/g, "").slice(0, 80) || String(fallbackIndex);
}
function screenVisualFrame(snapshot, elements, input) {
  const width = positiveFinite(snapshot.viewport.width) ?? 1;
  const height = positiveFinite(snapshot.viewport.height) ?? 1;
  const screenWidth = positiveFinite(input.screenImageSize?.width) ?? width;
  const screenHeight = positiveFinite(input.screenImageSize?.height) ?? height;
  const screenScaleX = screenWidth / width;
  const screenScaleY = screenHeight / height;
  const frameViewportOffset = stateBounds(snapshot.frame?.viewportOffset);
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
  for (const [index, { element, stateId }] of elements.entries()) {
    const bounds = scaledScreenBounds(screenFrameBounds(element.bounds, frameViewportOffset), screenScaleX, screenScaleY);
    if (!bounds) continue;
    layers.push({
      id: `element.${safeLayerId(stateId, index + 1)}`,
      kind: "region",
      label: elementLayerLabel(element),
      bounds,
      statePath: `${WEB_AUTOMATION_STATE_NAMESPACE}.elements.${stateId}`,
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
  return {
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
}
function documentVisualFrame(snapshot, elements) {
  const width = positiveFinite(snapshot.viewport.width) ?? 1;
  const height = positiveFinite(snapshot.viewport.height) ?? 1;
  const rawDocumentWidth = positiveFinite(snapshot.viewport.documentWidth) ?? width;
  const documentMapWidth = width;
  const documentHeight = positiveFinite(snapshot.viewport.documentHeight) ?? height;
  return {
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
      ...elements.flatMap(({ element, stateId }, index) => {
        const bounds = stateBounds(element.documentBounds ?? element.bounds);
        if (!bounds) return [];
        const projectedViewportBounds = element.bounds ? stateBounds({
          x: bounds.x - snapshot.viewport.scrollX,
          y: bounds.y - snapshot.viewport.scrollY,
          width: bounds.width,
          height: bounds.height
        }) : void 0;
        return [{
          id: `document.element.${safeLayerId(stateId, index + 1)}`,
          kind: "region",
          label: elementLayerLabel(element),
          bounds,
          statePath: `${WEB_AUTOMATION_STATE_NAMESPACE}.elements.${stateId}`,
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
}
function elementLayerLabel(element) {
  return element.name ?? element.visibleText ?? element.text ?? element.value ?? element.href ?? element.tagName;
}

// ../../domain/src/recording/web-state/action-target.ts
function webAutomationActionTargetFromElement(element) {
  const secret = isSensitiveElementDescriptor(element);
  const visibleText = secret ? void 0 : element.visibleText;
  const text2 = secret ? void 0 : element.text;
  const value = secret ? void 0 : element.value;
  return compactJsonObject({
    type: element.role ?? element.inputType ?? element.tagName,
    id: stableAttribute(element, "data-testid") ?? stableAttribute(element, "id") ?? stableAttribute(element, "name"),
    label: element.name ?? visibleText ?? text2 ?? value,
    selector: element.selector,
    bounds: element.bounds,
    // Neither is this producer's to fill: a relative position belongs to a
    // click that carried one, and both `visualTarget` and `elementTarget` are
    // written by the callers that have them
    // (`client/gateway-mapping.ts`, and Core's own dispatch preparation).
    relativePosition: void 0,
    visualTarget: void 0,
    elementTarget: void 0,
    metadata: compactJsonObject({
      tagName: element.tagName,
      xpath: element.xpath,
      id: element.id,
      classNames: element.classNames,
      visibleText,
      role: element.role,
      href: element.href,
      inputType: element.inputType,
      documentBounds: stateBounds(element.documentBounds),
      isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(stateBounds(element.bounds)),
      hasClickHandler: element.hasClickHandler,
      attributes: element.attributes,
      testId: element.testId,
      accessibleName: secret ? void 0 : element.accessibleName,
      label: element.label,
      implicitRole: element.implicitRole,
      context: element.context
    })
  });
}
function webAutomationActionVisualTargetFromElement(element, input = {}) {
  const stateId = input.stateId ?? elementStateId(element);
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

// ../../domain/src/recording/web-state/evidence/read.ts
var MAX_TEXT = 200;
function list(value) {
  return Array.isArray(value) ? value : [];
}
function text(value) {
  if (typeof value !== "string") return void 0;
  const collapsed = value.replace(/\s+/gu, " ").trim();
  return collapsed ? collapsed.slice(0, MAX_TEXT) : void 0;
}
function count2(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : void 0;
}
function flag(value) {
  return typeof value === "boolean" ? value : void 0;
}
function rect(value) {
  const bounds = pageEvidenceWire(value);
  if (!bounds) return void 0;
  const x = finite2(bounds.x);
  const y = finite2(bounds.y);
  const width = finite2(bounds.width);
  const height = finite2(bounds.height);
  return x === void 0 || y === void 0 || width === void 0 || height === void 0 ? void 0 : { x, y, width, height };
}
function isPresent(value) {
  return value !== void 0;
}
function finite2(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}

// ../../domain/src/recording/web-state/evidence/input.ts
function pageEvidenceOfSnapshot(snapshot) {
  return pageEvidenceWire(snapshot.evidence);
}
function pageEvidenceTruncatedElements(evidence) {
  return pageEvidenceWire(evidence?.elements)?.truncated === true;
}

// ../../domain/src/recording/web-state/state-values.ts
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
function addElementStateValues(state, { element, stateId }, timestamp, sourceId) {
  const basePath = `elements.${stateId}`;
  const anchor = boundsAnchor(element.documentBounds ?? element.bounds);
  const secret = isSensitiveElementDescriptor(element);
  const elementLabel = element.name ?? element.visibleText ?? element.text ?? (secret ? void 0 : element.value) ?? element.href ?? element.selector;
  const elementPresentation = anchor ? { group: "Elements", anchor, visualKind: "bounds" } : { group: "Elements" };
  return putStateValue(state, basePath, "json", elementStatePayload(element), timestamp, sourceId, {
    elementKind: "element",
    stableAcrossSessions: Boolean(stableElementId(element)),
    comparable: false,
    sensitive: element.value !== void 0 || secret,
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
function elementStatePayload(element) {
  return compactJsonObject({
    selector: element.selector,
    tagName: element.tagName,
    xpath: element.xpath,
    id: element.id,
    classNames: element.classNames,
    visibleText: element.visibleText,
    text: element.text,
    value: isSensitiveElementDescriptor(element) ? void 0 : element.value,
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

// ../../domain/src/recording/web-state/evidence/project.ts
var EVIDENCE_PATH_PREFIX = "evidence.";
var MAX_DIALOGS = 5;
var MAX_OVERLAY_BLOCKERS = 5;
var MAX_BLOCKED_SELECTORS = 5;
var MAX_LOADING_INDICATORS = 8;
var MAX_BUSY_REGIONS = 8;
var MAX_REGIONS = 20;
var MAX_REPEATING = 8;
var MAX_REPEATING_FIELDS = 8;
var MAX_FORMS = 8;
var MAX_FORM_CONTROLS = 20;
function addPageEvidenceStateValues(state, evidence, timestamp, sourceId) {
  let next = state;
  const put = (path, type, value, input = {}) => {
    next = putStateValue(next, `${EVIDENCE_PATH_PREFIX}${path}`, type, value, timestamp, sourceId, input);
  };
  addElementTotals(put, pageEvidenceWire(evidence.elements));
  addLoading(put, pageEvidenceWire(evidence.loading));
  addNavigation(put, pageEvidenceWire(evidence.navigation));
  addDialogs(put, pageEvidenceWire(evidence.dialogs));
  addOverlays(put, pageEvidenceWire(evidence.overlays));
  addRegions(put, list(evidence.regions));
  addRepeating(put, list(evidence.repeating));
  addForms(put, list(evidence.forms));
  return next;
}
var COUNT = { elementKind: "count" };
var LIVE_COUNT = { elementKind: "count", volatility: "rapid" };
var STATUS = { elementKind: "status" };
var LIVE_STATUS = { elementKind: "status", volatility: "rapid" };
var COLLECTION = { elementKind: "collection", comparable: false };
var LIVE_COLLECTION = { ...COLLECTION, volatility: "rapid" };
var SETTLED_COLLECTION = { ...COLLECTION, volatility: "slow" };
function addElementTotals(put, totals) {
  if (!totals) return;
  putCount(put, "elements.scanned", totals.scanned, COUNT);
  putCount(put, "elements.candidates", totals.candidates, COUNT);
  putCount(put, "elements.matched", totals.matched, COUNT);
  putCount(put, "elements.returned", totals.returned, COUNT);
  putCount(put, "elements.changed", totals.changed, LIVE_COUNT);
  putCount(put, "elements.recentlyInteracted", totals.recentlyInteracted, LIVE_COUNT);
  putFlag(put, "elements.truncated", totals.truncated, STATUS);
}
function addLoading(put, loading) {
  if (!loading) return;
  putText(put, "loading.documentState", loading.documentState, LIVE_STATUS);
  putFlag(put, "loading.busy", loading.busy, LIVE_STATUS);
  putFlag(put, "loading.pendingNavigation", loading.pendingNavigation, LIVE_STATUS);
  putCollection(put, "loading.busyRegions", list(loading.busyRegions), MAX_BUSY_REGIONS, selectorItem, LIVE_COLLECTION);
  putCollection(put, "loading.indicators", list(loading.indicators), MAX_LOADING_INDICATORS, (item) => {
    const indicator = pageEvidenceWire(item);
    return compactJsonObject({
      selector: text(indicator?.selector),
      kind: text(indicator?.kind),
      label: text(indicator?.label)
    });
  }, LIVE_COLLECTION);
}
function addNavigation(put, navigation) {
  if (!navigation) return;
  putText(put, "navigation.origin", navigation.origin, { elementKind: "url", volatility: "slow" });
  putText(put, "navigation.path", navigation.path, { elementKind: "route", volatility: "slow" });
  putText(put, "navigation.referrer", navigation.referrer, { elementKind: "url", volatility: "slow" });
  putText(put, "navigation.type", navigation.type, { elementKind: "status", volatility: "slow" });
  putCount(put, "navigation.redirects", navigation.redirects, COUNT);
  putCount(put, "navigation.historyLength", navigation.historyLength, COUNT);
  putText(put, "navigation.visibility", navigation.visibility, { elementKind: "visibility", volatility: "rapid" });
}
function addDialogs(put, dialogs) {
  if (!dialogs) return;
  const open = list(dialogs.open);
  put("dialogs.openCount", "integer", open.length, LIVE_COUNT);
  putFlag(put, "dialogs.modal", dialogs.modal, LIVE_STATUS);
  putFlag(put, "dialogs.armPending", dialogs.armPending, LIVE_STATUS);
  putCollection(put, "dialogs.open", open, MAX_DIALOGS, (item) => {
    const dialog = pageEvidenceWire(item);
    return compactJsonObject({
      selector: text(dialog?.selector),
      role: text(dialog?.role),
      modal: flag(dialog?.modal),
      native: flag(dialog?.native),
      label: text(dialog?.label),
      bounds: rect(dialog?.bounds)
    });
  }, LIVE_COLLECTION);
  const native = pageEvidenceWire(dialogs.lastNative);
  if (native) {
    put("dialogs.lastNative", "json", compactJsonObject({
      kind: text(native.kind),
      message: text(native.message),
      response: text(native.response),
      at: count2(native.at)
    }), { elementKind: "json", comparable: false, volatility: "rapid" });
  }
}
function addOverlays(put, overlays) {
  if (!overlays) return;
  putCount(put, "overlays.tested", overlays.tested, LIVE_COUNT);
  putCount(put, "overlays.blockedCount", overlays.blockedCount, LIVE_COUNT);
  putCollection(put, "overlays.blockers", list(overlays.blockers), MAX_OVERLAY_BLOCKERS, (item) => {
    const blocker = pageEvidenceWire(item);
    const blocked = list(blocker?.blocked);
    return compactJsonObject({
      selector: text(blocker?.selector),
      role: text(blocker?.role),
      label: text(blocker?.label),
      bounds: rect(blocker?.bounds),
      blocks: count2(blocker?.blocks),
      blockedCount: blocked.length,
      blocked: blocked.slice(0, MAX_BLOCKED_SELECTORS).map(text).filter(isPresent)
    });
  }, LIVE_COLLECTION);
}
function addRegions(put, regions) {
  putCollection(put, "regions", regions, MAX_REGIONS, (item) => {
    const region = pageEvidenceWire(item);
    return compactJsonObject({
      role: text(region?.role),
      label: text(region?.label),
      selector: text(region?.selector),
      bounds: rect(region?.bounds)
    });
  }, SETTLED_COLLECTION);
}
function addRepeating(put, repeating) {
  putCollection(put, "repeating", repeating, MAX_REPEATING, (item) => {
    const structure = pageEvidenceWire(item);
    const representative = pageEvidenceWire(structure?.representative);
    return compactJsonObject({
      containerSelector: text(structure?.containerSelector),
      signature: text(structure?.signature),
      itemCount: count2(structure?.itemCount),
      representative: representative ? compactJsonObject({
        selector: text(representative.selector),
        testId: text(representative.testId),
        text: text(representative.text)
      }) : void 0,
      fields: list(structure?.fields).slice(0, MAX_REPEATING_FIELDS).map(text).filter(isPresent)
    });
  }, COLLECTION);
}
function addForms(put, forms) {
  putCollection(put, "forms", forms, MAX_FORMS, (item) => {
    const form = pageEvidenceWire(item);
    const controls = list(form?.controls);
    return compactJsonObject({
      selector: text(form?.selector),
      name: text(form?.name),
      label: text(form?.label),
      action: text(form?.action),
      method: text(form?.method),
      // The producer's own pre-cap total, kept beside the controls that
      // survived: the same count-plus-kept-list convention as everywhere else.
      controlCount: count2(form?.controlCount) ?? controls.length,
      controls: controls.slice(0, MAX_FORM_CONTROLS).map(formControl),
      submit: text(form?.submit)
    });
  }, SETTLED_COLLECTION);
}
function formControl(item) {
  const control = pageEvidenceWire(item);
  const controlType = text(control?.controlType);
  const autocomplete = typeof control?.autocomplete === "string" ? control.autocomplete : void 0;
  const sensitive = control?.sensitive === true || isSensitiveFieldSignature({ inputType: controlType, controlType, autocomplete });
  return compactJsonObject({
    selector: text(control?.selector),
    controlType,
    name: text(control?.name),
    label: text(control?.label),
    required: flag(control?.required),
    disabled: flag(control?.disabled),
    hasValue: sensitive ? void 0 : flag(control?.hasValue),
    sensitive: sensitive ? true : void 0
  });
}
function selectorItem(item) {
  return compactJsonObject({ selector: text(item) });
}
function putCollection(put, path, items, cap, describe, input) {
  if (!items.length) return;
  put(path, "json", {
    count: items.length,
    truncated: items.length > cap,
    items: items.slice(0, cap).map(describe)
  }, input);
}
function putCount(put, path, value, input) {
  const total = count2(value);
  if (total !== void 0) put(path, "integer", total, input);
}
function putFlag(put, path, value, input) {
  const state = flag(value);
  if (state !== void 0) put(path, "boolean", state, input);
}
function putText(put, path, value, input) {
  const bounded = text(value);
  if (bounded !== void 0) put(path, "string", bounded, input);
}

// ../../domain/src/recording/web-state/snapshot.ts
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
  const evidence = pageEvidenceOfSnapshot(snapshot);
  if (evidence) state = addPageEvidenceStateValues(state, evidence, timestamp, input.sourceId);
  const selection = filterStateElements(snapshot.interactiveElements);
  state = putStateValue(state, "elements.count", "integer", selection.total, timestamp, input.sourceId, { elementKind: "count" });
  state = putStateValue(state, "elements.captured", "integer", selection.captured, timestamp, input.sourceId, { elementKind: "count" });
  const captureTruncated = pageEvidenceTruncatedElements(evidence);
  state = putStateValue(state, "elements.captureTruncated", "boolean", captureTruncated, timestamp, input.sourceId, { elementKind: "status" });
  state = putStateValue(state, "elements.stateTruncated", "boolean", selection.truncated, timestamp, input.sourceId, { elementKind: "status" });
  state = putStateValue(state, "elements.truncated", "boolean", selection.truncated || captureTruncated, timestamp, input.sourceId, { elementKind: "status" });
  for (const entry of selection.elements) state = addElementStateValues(state, entry, timestamp, input.sourceId);
  return withScreenVisualFrame(state, snapshot, selection.elements, input);
}

// ../../domain/src/recording/web-state/tab-state.ts
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

// ../../domain/src/client/gateway-action-parameters.ts
function webAutomationReadActionParameters(parameters) {
  const lifted = {
    // Which tab and frame the action runs in, as opposed to the tab a
    // `web.browser.tab` operation acts on, which travels inside `tab`.
    tabId: nonNegativeInteger3(parameters.browserTabId ?? parameters.tabId),
    frameId: nonNegativeInteger3(parameters.browserFrameId ?? parameters.frameId),
    // The child frame's document path, which finds the frame again after Chrome
    // renumbers it. Only the recorded node's name is read.
    frameUrlPath: webAutomationUrlPath(parameters.browserFrameUrlPath),
    newTab: booleanValue4(parameters.newTab),
    option: optionSelectorValue(parameters.option),
    scroll: scrollRequestValue(parameters.scroll),
    wait: waitRequestValue(parameters.wait),
    modifiers: keyModifiersValue(parameters.modifiers),
    checked: booleanValue4(parameters.checked),
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
  const request = jsonObject3(value);
  if (!request) return void 0;
  if (request.by === "value") {
    const optionValue = stringValue4(request.value);
    return optionValue === void 0 ? void 0 : { by: "value", value: optionValue };
  }
  if (request.by === "label") {
    const label = stringValue4(request.label);
    return label === void 0 ? void 0 : { by: "label", label };
  }
  const index = nonNegativeInteger3(request.index);
  return request.by === "index" && index !== void 0 ? { by: "index", index } : void 0;
}
function scrollRequestValue(value) {
  const request = jsonObject3(value);
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
  const request = jsonObject3(value);
  const condition = memberOf2(request?.condition, WAIT_CONDITIONS);
  if (!request || condition === void 0) return void 0;
  const url = nonEmptyString2(request.url);
  const stableForMs = positiveInteger2(request.stableForMs);
  return { condition, ...url !== void 0 ? { url } : {}, ...stableForMs !== void 0 ? { stableForMs } : {} };
}
function keyModifiersValue(value) {
  const request = jsonObject3(value);
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
  const request = jsonObject3(value);
  const kind = memberOf2(request?.kind, ASSERT_KINDS);
  if (!request || kind === void 0) return void 0;
  const expected = stringValue4(request.expected);
  const timeoutMs = positiveInteger2(request.timeoutMs);
  return { kind, ...expected !== void 0 ? { expected } : {}, ...timeoutMs !== void 0 ? { timeoutMs } : {} };
}
function uploadRequestValue(value) {
  const request = jsonObject3(value);
  const supplied = Array.isArray(request?.files) ? request.files : void 0;
  if (supplied === void 0 || supplied.length === 0) return void 0;
  const files = [];
  let totalBytes = 0;
  for (const entry of supplied) {
    const file = jsonObject3(entry);
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
  const request = jsonObject3(value);
  const response = memberOf2(request?.response, ["accept", "dismiss"]);
  if (!request || response === void 0) return void 0;
  const promptText = response === "accept" ? stringValue4(request.promptText) : void 0;
  return { response, ...promptText !== void 0 ? { promptText } : {} };
}
function tabRequestValue(value) {
  const request = jsonObject3(value);
  const operation = memberOf2(request?.operation, ["open", "switch", "close"]);
  if (!request || operation === void 0) return void 0;
  const tabId = nonNegativeInteger3(request.tabId);
  if (operation === "open") {
    const url = nonEmptyString2(request.url);
    const active = booleanValue4(request.active);
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
  const request = jsonObject3(value);
  if (!request) return void 0;
  const filename = nonEmptyString2(request.filename);
  const timeoutMs = positiveInteger2(request.timeoutMs);
  return { ...filename !== void 0 ? { filename } : {}, ...timeoutMs !== void 0 ? { timeoutMs } : {} };
}
var WAIT_CONDITIONS = ["present", "visible", "enabled", "absent", "url", "stable"];
var ASSERT_KINDS = ["exists", "absent", "text", "url", "visible", "enabled"];
function booleanValue4(value) {
  return typeof value === "boolean" ? value : void 0;
}
function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function nonNegativeInteger3(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
}
function positiveInteger2(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : void 0;
}
function stringValue4(value) {
  return typeof value === "string" ? value : void 0;
}
function nonEmptyString2(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function memberOf2(value, members) {
  return typeof value === "string" && members.includes(value) ? value : void 0;
}
function jsonObject3(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}

// ../../domain/src/client/gateway-mapping.ts
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
      // The frame the interaction happened in, under the name the parameter
      // lift reads (`gateway-action-parameters.ts` maps `browserFrameId` onto
      // `action.frameId`). `sourceId` above names the same frame, but only as
      // text nothing downstream parses, and `webAutomationOutputPayload` reads
      // this payload rather than the envelope: without the field here, a click
      // recorded inside an iframe replays against the top document. Frame 0 is
      // the top frame and survives `compactJsonObject`, which drops only
      // `undefined`.
      browserFrameId: input.frameId,
      element: payload.element,
      visualTarget,
      inputValue: payload.inputValue,
      key: payload.key,
      scroll: payload.scroll,
      mutation: payload.mutation,
      snapshot: payload.snapshot,
      actionResult: payload.actionResult,
      // Only the two declared fields are copied, so nothing else a caller put on
      // the tab change -- a tab id, a full URL -- reaches the stored recording.
      tab: payload.tab === void 0 ? void 0 : { operation: payload.tab.operation, ...payload.tab.urlPath !== void 0 ? { urlPath: payload.tab.urlPath } : {} },
      // Rebuilt field by field rather than passed through, so no sample value
      // and no unknown key the picker put beside the definition is stored (D3).
      extraction: webAutomationRecordedExtraction(payload.extraction),
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
    selector: stringValue5(target.selector) ?? stringValue5(parameters.selector),
    text: stringValue5(parameters.text),
    value: stringValue5(parameters.value),
    key: stringValue5(parameters.key),
    url: stringValue5(parameters.url),
    timeoutMs: numberValue3(command.timeoutMs ?? parameters.timeoutMs),
    coordinates: pointValue(target.coordinates ?? parameters.coordinates),
    visualTarget: jsonObject4(target.visualTarget ?? parameters.visualTarget),
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
  const adaptedTarget = jsonObject4(parameters.target);
  return adaptedTarget?.selectedCandidate !== void 0 ? [target.element, target.fingerprint, parameters.element] : [parameters.element, target.element, target.fingerprint];
}
function webAutomationActionResultPayload(result) {
  return compactJsonObject2({
    commandId: result.commandId,
    actionType: result.actionType,
    status: result.status,
    validation: webAutomationSecretSafeValidation(result.validation, result.element),
    message: result.message,
    url: result.url,
    title: result.title,
    element: result.element,
    visualTarget: result.visualTarget,
    snapshot: result.snapshot,
    extracted: secretSafeExtracted(result.extracted, result.element),
    extraction: webAutomationExtractionSummaryValue(result.extraction),
    dialog: observedDialogValue(result.dialog),
    structure: webAutomationStructureDetectionValue(result.structure),
    resolution: result.resolution,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt
  });
}
function secretSafeExtracted(extracted, element) {
  return isSensitiveElementDescriptor(element) ? void 0 : extracted;
}
function webAutomationSecretSafeValidation(validation, element) {
  if (validation === void 0 || validation.status === "none") return validation;
  if (isProducerRedactedComparison(validation)) return validation;
  if (!isSensitiveElementDescriptor(element)) return validation;
  return { status: validation.status, expected: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT, actual: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT };
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
function observedDialogValue(value) {
  const dialog = jsonObject4(value);
  if (!dialog) return void 0;
  const kind = DIALOG_KINDS.find((candidate) => candidate === dialog.kind);
  const response = dialog.response === "accept" || dialog.response === "dismiss" ? dialog.response : void 0;
  if (kind === void 0 || response === void 0 || typeof dialog.message !== "string") return void 0;
  if (typeof dialog.at !== "number" || !Number.isFinite(dialog.at)) return void 0;
  if (dialog.promptText !== void 0 && typeof dialog.promptText !== "string") return void 0;
  return { kind, message: dialog.message, response, at: dialog.at, ...typeof dialog.promptText === "string" ? { promptText: dialog.promptText } : {} };
}
var DIALOG_KINDS = ["alert", "confirm", "prompt", "beforeunload"];
function requiredParameters(actionType) {
  const schema = webAutomationActionDefinitions.find((definition) => definition.actionType === actionType)?.parameterSchema;
  return Array.isArray(schema?.required) ? schema.required.filter((key) => typeof key === "string") : [];
}
var CANONICAL_ACTION_TYPES = new Set(WEB_AUTOMATION_ACTION_TYPES);
var LEGACY_ACTION_TYPE_ALIASES = new Map(
  Object.entries(WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER).map(([canonical, legacy]) => [legacy, canonical])
);
function stringValue5(value) {
  return typeof value === "string" ? value : void 0;
}
function numberValue3(value) {
  return typeof value === "number" ? value : void 0;
}
function pointValue(value) {
  if (!value || typeof value !== "object") return void 0;
  const point = value;
  return typeof point.x === "number" && typeof point.y === "number" ? { x: point.x, y: point.y } : void 0;
}
function jsonObject4(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function compactJsonObject2(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}

// src/runtime/action-results.ts
function workerActionResult(action, startedAt, outcome) {
  const result = {
    commandId: action.commandId,
    actionType: action.actionType,
    status: outcome.status,
    validation: boundWorkerValidation(outcome.validation),
    message: outcome.message,
    startedAt,
    finishedAt: Date.now()
  };
  if (outcome.url !== void 0) result.url = outcome.url;
  if (outcome.failure !== void 0) result.failure = outcome.failure;
  if (action.visualTarget !== void 0) result.visualTarget = action.visualTarget;
  return result;
}
function boundWorkerValidation(validation) {
  if (validation.status === "none") return validation;
  return {
    status: validation.status,
    expected: boundedText2(validation.expected),
    actual: boundedText2(validation.actual)
  };
}
function navigationUnexpectedFailure(expected, actual) {
  return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.NAVIGATION_UNEXPECTED, { expected, actual });
}
function workerTimeoutFailure(code, expected, actual) {
  return webAutomationFailureRecord(code, { expected, actual });
}
function workerBlockedFailure(code, compared) {
  return webAutomationFailureRecord(code, compared ?? {});
}
function workerTargetNotFoundFailure(code, expected, actual) {
  return webAutomationFailureRecord(code, { expected, actual });
}
function workerActionFailedFailure(code, expected, actual) {
  return webAutomationFailureRecord(code, { expected, actual });
}
function boundedText2(value) {
  const collapsed = value.replace(/\s+/gu, " ").trim();
  if (!collapsed) return "(none)";
  return collapsed.length <= WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH ? collapsed : `${collapsed.slice(0, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH - 1)}\u2026`;
}

// src/runtime/automation-tab.ts
var DEFAULT_AUTOMATION_URL = "about:blank";
var AUTOMATION_TAB_HISTORY = 8;
var automationTabs = [];
async function resolveAutomationTab(input = {}) {
  if (input.requestedTabId !== void 0) {
    if (input.initialUrl && input.initialUrl !== DEFAULT_AUTOMATION_URL) await updateTabUrl(input.requestedTabId, input.initialUrl);
    return input.requestedTabId;
  }
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
  setAutomationTab(tab.id);
  if (input.initialUrl && input.initialUrl !== DEFAULT_AUTOMATION_URL) await waitForTabReady(tab.id);
  return tab.id;
}
function setAutomationTab(tabId) {
  automationTabs = [...automationTabs.filter((id) => id !== tabId), tabId].slice(-AUTOMATION_TAB_HISTORY);
}
function forgetAutomationTab(tabId) {
  automationTabs = tabId === void 0 ? [] : automationTabs.filter((id) => id !== tabId);
}
function currentAutomationTabId() {
  return automationTabs.at(-1);
}
async function latestOpenAutomationTab() {
  for (let tabId = currentAutomationTabId(); tabId !== void 0; tabId = currentAutomationTabId()) {
    if (await tabIsOpen(tabId)) return tabId;
    forgetAutomationTab(tabId);
  }
  return void 0;
}
async function readTabUrl(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab.url;
  } catch {
    return void 0;
  }
}
async function tabIsOpen(tabId) {
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch {
    return false;
  }
}
async function existingAutomationTab() {
  const automationTabId = currentAutomationTabId();
  if (automationTabId === void 0) return void 0;
  try {
    const tab = await chrome.tabs.get(automationTabId);
    return tab.id;
  } catch {
    forgetAutomationTab(automationTabId);
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

// src/runtime/command-options.ts
function optionsOf(action) {
  return action.options ?? {};
}
function integerAt(options, key) {
  const value = options[key];
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
}
function stringAt(options, key) {
  const value = options[key];
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function booleanAt(options, key) {
  const value = options[key];
  return typeof value === "boolean" ? value : void 0;
}
function frameIdForAction(action) {
  return action.frameId ?? integerAt(optionsOf(action), "browserFrameId");
}
function frameUrlPathForAction(action) {
  return webAutomationUrlPath(action.frameUrlPath ?? optionsOf(action)["browserFrameUrlPath"]);
}
function tabIdForAction(action) {
  return action.tabId ?? integerAt(optionsOf(action), "browserTabId");
}
function opensNewTab(action) {
  return action.newTab ?? booleanAt(optionsOf(action), "newTab") ?? false;
}
function tabRequestForAction(action) {
  if (action.tab !== void 0) return action.tab;
  const options = optionsOf(action);
  const operation = stringAt(options, "operation");
  const url = action.url ?? stringAt(options, "url");
  const tabId = action.tabId ?? integerAt(options, "tabId");
  const urlPattern = stringAt(options, "urlPattern");
  const active = booleanAt(options, "active");
  if (operation === "open") {
    return { operation: "open", ...url !== void 0 ? { url } : {}, ...active !== void 0 ? { active } : {} };
  }
  if (operation === "switch") {
    return { operation: "switch", ...tabId !== void 0 ? { tabId } : {}, ...urlPattern !== void 0 ? { urlPattern } : {} };
  }
  if (operation === "close") {
    return { operation: "close", ...tabId !== void 0 ? { tabId } : {} };
  }
  return void 0;
}
function downloadRequestForAction(action) {
  const options = optionsOf(action);
  const filename = action.download?.filename ?? stringAt(options, "filename");
  const timeoutMs = action.download?.timeoutMs ?? action.timeoutMs ?? integerAt(options, "timeoutMs");
  return {
    ...filename !== void 0 ? { filename } : {},
    ...timeoutMs !== void 0 ? { timeoutMs } : {}
  };
}

// src/runtime/browser-download.ts
var DEFAULT_DOWNLOAD_TIMEOUT_MS = 3e4;
var MIN_DOWNLOAD_TIMEOUT_MS = 1e3;
var MAX_DOWNLOAD_TIMEOUT_MS = 12e4;
var DOWNLOAD_LOOKBACK_MS = 15e3;
var DOWNLOAD_POLL_MS = 500;
async function runBrowserDownloadAction(action) {
  const startedAt = Date.now();
  const request = downloadRequestForAction(action);
  const expected = request.filename !== void 0 ? `a completed download named ${request.filename}` : "a completed download";
  const downloads = chrome.downloads;
  if (!downloads) {
    const actual = "the downloads permission is not granted";
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: "This build cannot observe downloads: the downloads permission is not granted.",
      validation: { status: "failed", expected, actual },
      // `ACTION_REJECTED`, and the missing permission is named in `actual`: the
      // set has one code for a refusal, not one per reason.
      failure: workerBlockedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, { expected, actual })
    });
  }
  const timeoutMs = clampTimeout(request.timeoutMs);
  const found = await waitForCompletedDownload(downloads, request.filename, startedAt - DOWNLOAD_LOOKBACK_MS, timeoutMs);
  if (found === void 0) {
    const actual = `no matching download completed within ${timeoutMs} ms`;
    return workerActionResult(action, startedAt, {
      status: "timed_out",
      message: `No download completed within ${timeoutMs} ms.`,
      validation: { status: "failed", expected, actual },
      failure: workerTimeoutFailure(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, expected, actual)
    });
  }
  const name = baseName(found.filename);
  return workerActionResult(action, startedAt, {
    status: "succeeded",
    message: `Download completed: ${name}.`,
    validation: { status: "passed", expected, actual: name }
  });
}
function downloadFilenameMatches(filename, requested) {
  if (requested === void 0) return true;
  const wanted = baseName(requested).toLowerCase();
  if (wanted === "") return true;
  const actual = baseName(filename).toLowerCase();
  return actual === wanted || withoutUniquifier(actual) === wanted;
}
function selectCompletedDownload(items, requested, since) {
  const matches = items.filter((item) => item.state === "complete" && item.exists !== false && downloadFilenameMatches(item.filename, requested) && endedAtOrAfter(item.endTime, since));
  return [...matches].sort((left, right) => endTimeMs(right.endTime) - endTimeMs(left.endTime))[0];
}
async function waitForCompletedDownload(downloads, requested, since, timeoutMs) {
  const immediate = selectCompletedDownload(await searchDownloads(downloads), requested, since);
  if (immediate !== void 0) return immediate;
  return new Promise((resolve) => {
    let settled = false;
    const listener = (delta) => {
      if (delta.state?.current === "complete") void check();
    };
    const poll = setInterval(() => void check(), DOWNLOAD_POLL_MS);
    const timer = setTimeout(() => finish(void 0), timeoutMs);
    downloads.onChanged.addListener(listener);
    function finish(found) {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timer);
      downloads.onChanged.removeListener(listener);
      resolve(found);
    }
    async function check() {
      if (settled) return;
      const found = selectCompletedDownload(await searchDownloads(downloads), requested, since);
      if (found !== void 0) finish(found);
    }
  });
}
async function searchDownloads(downloads) {
  try {
    const items = await downloads.search({});
    return items.map((item) => ({
      filename: item.filename,
      state: item.state,
      ...item.endTime !== void 0 ? { endTime: item.endTime } : {},
      ...item.exists !== void 0 ? { exists: item.exists } : {}
    }));
  } catch {
    return [];
  }
}
function clampTimeout(timeoutMs) {
  const requested = timeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;
  return Math.min(Math.max(requested, MIN_DOWNLOAD_TIMEOUT_MS), MAX_DOWNLOAD_TIMEOUT_MS);
}
function baseName(value) {
  return value.split(/[\\/]/u).at(-1) ?? value;
}
function withoutUniquifier(name) {
  return name.replace(/ \(\d+\)(?=\.[^.]*$|$)/u, "");
}
function endedAtOrAfter(endTime, since) {
  if (endTime === void 0) return true;
  const ended = Date.parse(endTime);
  return Number.isNaN(ended) || ended >= since;
}
function endTimeMs(endTime) {
  const ended = endTime === void 0 ? Number.NaN : Date.parse(endTime);
  return Number.isNaN(ended) ? 0 : ended;
}

// src/runtime/navigation-outcome.ts
var UNKNOWN_URL = "(unknown)";
function compareNavigatedUrl(requested, landed) {
  const actual = landed?.trim() ? landed.trim() : UNKNOWN_URL;
  if (actual === UNKNOWN_URL) return { matched: false, expected: requested, actual };
  return { matched: sameDestination(requested, actual), expected: requested, actual };
}
function sameDestination(requested, landed) {
  if (requested === landed) return true;
  const wanted = parseUrl(requested);
  const reached = parseUrl(landed);
  if (!wanted || !reached) return false;
  if (!(isWebScheme(wanted.protocol) && isWebScheme(reached.protocol)) && wanted.protocol !== reached.protocol) return false;
  if (hostOf(wanted) !== hostOf(reached)) return false;
  if (pathOf(wanted) !== pathOf(reached)) return false;
  return wanted.search === "" || wanted.search === reached.search;
}
function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return void 0;
  }
}
function isWebScheme(protocol) {
  return protocol === "http:" || protocol === "https:";
}
function hostOf(url) {
  return url.host.toLowerCase().replace(/^www\./u, "");
}
function pathOf(url) {
  return url.pathname.replace(/\/+$/u, "");
}

// src/runtime/unsupported-page.ts
var PRIVILEGED_SCHEME = /^(?:chrome|edge|brave|opera|vivaldi|about|devtools|view-source|data|javascript|moz-extension|chrome-extension|edge-extension):/iu;
var EXTENSION_STORE = /^https:\/\/(?:chrome\.google\.com\/webstore|chromewebstore\.google\.com|microsoftedge\.microsoft\.com\/addons|addons\.mozilla\.org)/iu;
var UNSUPPORTED_BROWSER_PAGE_REASON = "Browser and extension pages cannot be automated.";
var UNSUPPORTED_STORE_PAGE_REASON = "Browser web store pages cannot be automated.";
function unsupportedAutomationPageReason(url) {
  const trimmed = url?.trim();
  if (!trimmed) return void 0;
  if (PRIVILEGED_SCHEME.test(trimmed)) return UNSUPPORTED_BROWSER_PAGE_REASON;
  if (EXTENSION_STORE.test(trimmed)) return UNSUPPORTED_STORE_PAGE_REASON;
  return void 0;
}

// src/runtime/browser-tab.ts
var DEFAULT_SWITCH_WAIT_MS = 1e4;
var SWITCH_POLL_MS = 100;
async function runBrowserTabAction(action) {
  const startedAt = Date.now();
  const request = tabRequestForAction(action);
  if (request === void 0) {
    const expected = "operation open, switch, or close";
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: "A tab action needs an operation of open, switch, or close.",
      validation: { status: "failed", expected, actual: "no operation" },
      failure: workerBlockedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, { expected, actual: "no operation" })
    });
  }
  try {
    if (request.operation === "open") return await openTab(action, startedAt, request);
    if (request.operation === "switch") return await switchTab(action, startedAt, request);
    return await closeTab(action, startedAt, request);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The browser refused the tab operation.";
    const expected = `tab ${request.operation} to succeed`;
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: detail,
      validation: { status: "failed", expected, actual: detail },
      failure: workerActionFailedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, expected, detail)
    });
  }
}
function selectTabForSwitch(tabs, request) {
  if (request.tabId !== void 0) return tabs.find((tab) => tab.id === request.tabId);
  if (request.urlPath !== void 0) return newestTabAtPath(tabs, request.urlPath);
  const pattern = request.urlPattern?.toLowerCase();
  if (pattern === void 0 || pattern === "") return void 0;
  return tabs.find((tab) => (tab.url ?? "").toLowerCase().includes(pattern));
}
function newestTabAtPath(tabs, urlPath) {
  let newest;
  for (const tab of tabs) {
    if (tab.id === void 0 || urlPath === "" || pagePath(tab.url) !== urlPath) continue;
    if (newest === void 0 || tab.id > (newest.id ?? Number.NEGATIVE_INFINITY)) newest = tab;
  }
  return newest;
}
function pagePath(url) {
  if (!url || unsupportedAutomationPageReason(url) !== void 0) return void 0;
  try {
    return new URL(url).pathname;
  } catch {
    return void 0;
  }
}
function tabBeforeSwitch(front, target) {
  if (front?.id !== void 0 && front.id !== target.id && pagePath(front.url) !== void 0) return front.id;
  return target.openerTabId !== void 0 && target.openerTabId !== target.id ? target.openerTabId : void 0;
}
async function findTabForSwitch(request, timeoutMs) {
  const deadline = Date.now() + (request.urlPath === void 0 ? 0 : timeoutMs ?? DEFAULT_SWITCH_WAIT_MS);
  for (; ; ) {
    const match = selectTabForSwitch(await chrome.tabs.query({}), request);
    if (match !== void 0 || Date.now() >= deadline) return match;
    await new Promise((resolve) => setTimeout(resolve, SWITCH_POLL_MS));
  }
}
async function openTab(action, startedAt, request) {
  const created = await chrome.tabs.create({
    ...request.url !== void 0 ? { url: request.url } : {},
    active: request.active ?? true
  });
  const tabId = created.id;
  if (tabId === void 0) {
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: "The browser opened a tab without an id.",
      validation: { status: "failed", expected: "a new tab", actual: "a tab with no id" },
      failure: workerActionFailedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, "a new tab", "a tab with no id")
    });
  }
  setAutomationTab(tabId);
  if (request.url !== void 0) await waitForTabReady(tabId);
  const landed = await readTabUrl(tabId);
  if (request.url === void 0) {
    return workerActionResult(action, startedAt, {
      status: "succeeded",
      message: `Opened tab ${tabId}.`,
      validation: { status: "passed", expected: "a new tab", actual: `tab ${tabId} at ${landed ?? "about:blank"}` },
      ...landed !== void 0 ? { url: landed } : {}
    });
  }
  const comparison = compareNavigatedUrl(request.url, landed);
  const validation = comparison.matched ? { status: "passed", expected: comparison.expected, actual: comparison.actual } : { status: "failed", expected: comparison.expected, actual: comparison.actual };
  return workerActionResult(action, startedAt, {
    status: comparison.matched ? "succeeded" : "failed",
    message: comparison.matched ? `Opened tab ${tabId} at ${comparison.actual}.` : `Tab ${tabId} opened at ${comparison.actual}, not ${comparison.expected}.`,
    validation,
    ...comparison.matched ? {} : { failure: navigationUnexpectedFailure(comparison.expected, comparison.actual) },
    ...landed !== void 0 ? { url: landed } : {}
  });
}
async function switchTab(action, startedAt, request) {
  const expected = request.tabId !== void 0 ? `tab ${request.tabId} active` : request.urlPath !== void 0 ? `a tab at path "${request.urlPath}" active` : `a tab whose URL contains "${request.urlPattern ?? ""}" active`;
  const match = await findTabForSwitch(request, action.timeoutMs);
  const tabId = match?.id;
  if (match === void 0 || tabId === void 0) {
    const actual = "no open tab matched";
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: "No open tab matched the switch request.",
      validation: { status: "failed", expected, actual },
      failure: workerTargetNotFoundFailure(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, expected, actual)
    });
  }
  const [front] = await chrome.tabs.query({ active: true, currentWindow: true });
  const before = tabBeforeSwitch(front, match);
  await chrome.tabs.update(tabId, { active: true });
  if (before !== void 0) setAutomationTab(before);
  setAutomationTab(tabId);
  if (match.status !== "complete") await waitForTabReady(tabId);
  const landed = await readTabUrl(tabId);
  return workerActionResult(action, startedAt, {
    status: "succeeded",
    message: `Switched to tab ${tabId}.`,
    validation: { status: "passed", expected, actual: `tab ${tabId} at ${landed ?? "(unknown)"}` },
    ...landed !== void 0 ? { url: landed } : {}
  });
}
async function closeTab(action, startedAt, request) {
  const tabId = request.tabId ?? currentAutomationTabId();
  if (tabId === void 0) {
    const expected2 = "a tab to close";
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: "No tab was named and FluxIQ is not driving one.",
      validation: { status: "failed", expected: expected2, actual: "no tab named and none open" },
      failure: workerBlockedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, { expected: expected2, actual: "no tab named and none open" })
    });
  }
  const closingAutomationTab = tabId === currentAutomationTabId();
  await chrome.tabs.remove(tabId);
  forgetAutomationTab(tabId);
  const expected = `tab ${tabId} closed`;
  if (await tabIsOpen(tabId)) {
    const actual = `tab ${tabId} is still open`;
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: `Tab ${tabId} is still open.`,
      validation: { status: "failed", expected, actual },
      failure: workerActionFailedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, expected, actual)
    });
  }
  const returnedTo = closingAutomationTab ? await latestOpenAutomationTab() : void 0;
  if (returnedTo !== void 0) await chrome.tabs.update(returnedTo, { active: true });
  const landed = returnedTo === void 0 ? void 0 : await readTabUrl(returnedTo);
  return workerActionResult(action, startedAt, {
    status: "succeeded",
    message: returnedTo === void 0 ? `Closed tab ${tabId}.` : `Closed tab ${tabId} and returned to tab ${returnedTo}.`,
    validation: { status: "passed", expected, actual: returnedTo === void 0 ? expected : `${expected}; tab ${returnedTo} active` },
    ...landed !== void 0 ? { url: landed } : {}
  });
}

// src/runtime/click-landing.ts
var TOP_FRAME_ID2 = 0;
var NAVIGATION_START_GRACE_MS = 300;
var NAVIGATION_END_TIMEOUT_MS = 1e4;
var FIRST_ERROR_STATUS = 400;
var EXPECTED = "the page the click leads to loads";
async function sendClickCheckingLanding(action, tabId, send) {
  if (action.actionType !== "web.dom.click") return await send();
  const watch = watchTopFrameNavigation(tabId);
  try {
    let reply;
    try {
      reply = await send();
    } catch (error) {
      const refused2 = await refusedLanding(tabId, watch);
      if (refused2 === void 0) throw error;
      return workerActionResult(action, watch.startedAt, refusedLandingOutcome(refused2));
    }
    if (reply.status !== "succeeded") return reply;
    const refused = await refusedLanding(tabId, watch);
    return refused === void 0 ? reply : failedClick(reply, refused);
  } finally {
    watch.stop();
  }
}
function watchTopFrameNavigation(tabId) {
  const startedAt = Date.now();
  let started = false;
  let inFlight = 0;
  let commit;
  let wake;
  let timer;
  const isOurTopFrame = (details) => details.tabId === tabId && details.frameId === TOP_FRAME_ID2;
  const onBeforeNavigate = (details) => {
    if (!isOurTopFrame(details)) return;
    started = true;
    inFlight += 1;
    wake?.();
  };
  const onCommitted = (details) => {
    if (!isOurTopFrame(details) || commit !== void 0) return;
    started = true;
    commit = { url: details.url, documentId: details.documentId };
    wake?.();
  };
  const onErrorOccurred = (details) => {
    if (!isOurTopFrame(details)) return;
    inFlight = Math.max(0, inFlight - 1);
    wake?.();
  };
  chrome.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
  chrome.webNavigation.onCommitted.addListener(onCommitted);
  chrome.webNavigation.onErrorOccurred.addListener(onErrorOccurred);
  function until(holds, timeoutMs) {
    if (holds()) return Promise.resolve();
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        timer = void 0;
        wake = void 0;
        resolve();
      };
      timer = setTimeout(finish, timeoutMs);
      wake = () => {
        if (holds()) finish();
      };
    });
  }
  return {
    startedAt,
    async landing() {
      await until(() => started, NAVIGATION_START_GRACE_MS);
      if (!started) return void 0;
      await until(() => commit !== void 0 || inFlight === 0, NAVIGATION_END_TIMEOUT_MS);
      return commit;
    },
    stop() {
      clearTimeout(timer);
      chrome.webNavigation.onBeforeNavigate.removeListener(onBeforeNavigate);
      chrome.webNavigation.onCommitted.removeListener(onCommitted);
      chrome.webNavigation.onErrorOccurred.removeListener(onErrorOccurred);
    }
  };
}
async function refusedLanding(tabId, watch) {
  const commit = await watch.landing();
  if (commit === void 0) return void 0;
  const status = await servedStatus(tabId, commit);
  if (status === void 0 || status < FIRST_ERROR_STATUS) return void 0;
  return { status, path: landedPath(commit.url) };
}
async function servedStatus(tabId, commit) {
  const target = commit.documentId !== void 0 ? { tabId, documentIds: [commit.documentId] } : { tabId, frameIds: [TOP_FRAME_ID2] };
  try {
    const [injection] = await chrome.scripting.executeScript({ target, func: readServedStatus });
    const status = injection?.result;
    return typeof status === "number" && Number.isInteger(status) && status > 0 ? status : void 0;
  } catch {
    return void 0;
  }
}
function readServedStatus() {
  const [entry] = performance.getEntriesByType("navigation");
  return entry?.responseStatus;
}
function landedPath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return "(unknown)";
  }
}
function refusedLandingOutcome(landing) {
  const actual = `the server answered HTTP ${landing.status} for ${landing.path}`;
  return {
    status: "failed",
    message: `The click landed on ${landing.path}, which the server answered with HTTP ${landing.status}.`,
    validation: { status: "failed", expected: EXPECTED, actual },
    failure: navigationUnexpectedFailure(EXPECTED, actual)
  };
}
function failedClick(reply, landing) {
  const outcome = refusedLandingOutcome(landing);
  return {
    ...reply,
    status: outcome.status,
    message: outcome.message,
    validation: boundWorkerValidation(outcome.validation),
    failure: outcome.failure,
    finishedAt: Date.now()
  };
}

// src/runtime/frame-address.ts
var TOP_FRAME_ID3 = 0;
function chooseFrame(frames, recordedFrameId, urlPath) {
  if (urlPath === void 0 || frames.length === 0) return { frameId: recordedFrameId };
  const children = frames.filter((frame) => frame.frameId !== TOP_FRAME_ID3);
  const matches = children.filter((frame) => pathOf2(frame.url) === urlPath);
  if (matches.length === 1) return { frameId: matches[0]?.frameId };
  if (matches.length === 0) return { refused: notFound(urlPath, children) };
  if (recordedFrameId !== void 0 && matches.some((frame) => frame.frameId === recordedFrameId)) {
    return { frameId: recordedFrameId };
  }
  return { refused: ambiguous(urlPath, matches.length, recordedFrameId) };
}
function pathOf2(url) {
  if (url === void 0) return void 0;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.pathname : void 0;
  } catch {
    return void 0;
  }
}
function describeChildren(children) {
  if (children.length === 0) return "the tab has no child frame";
  const described = children.map((frame) => `frame ${frame.frameId} at ${pathOf2(frame.url) ?? "no http(s) path"}`);
  return `the tab has ${described.join(", ")}`;
}
function notFound(urlPath, children) {
  const expected = `a child frame at ${urlPath}`;
  const actual = describeChildren(children);
  return {
    status: "failed",
    message: `The action is addressed to the frame at ${urlPath}, which this tab does not have.`,
    validation: { status: "failed", expected, actual },
    failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, { expected, actual })
  };
}
function ambiguous(urlPath, count3, recordedFrameId) {
  const expected = `one child frame at ${urlPath}`;
  const tieBreak = recordedFrameId === void 0 ? "" : `, and none is frame ${recordedFrameId}`;
  const actual = `${count3} child frames are at ${urlPath}${tieBreak}`;
  return {
    status: "failed",
    message: `The action is addressed to the frame at ${urlPath}, and ${count3} frames in this tab are at that path.`,
    validation: { status: "failed", expected, actual },
    failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS, { expected, actual })
  };
}

// src/runtime/action-runner.ts
var TOP_FRAME_ID4 = 0;
async function runBrowserActionCommand(request) {
  const action = request.action;
  if (action.actionType === "web.browser.tab") {
    const result = await runBrowserTabAction(action);
    const selected = currentAutomationTabId();
    if (result.status === "succeeded" && selected !== void 0) await request.attachTabForRecording(selected);
    return withTarget(result, selected, void 0);
  }
  if (action.actionType === "web.browser.download") {
    return withTarget(await runBrowserDownloadAction(action), currentAutomationTabId(), void 0);
  }
  const startedAt = Date.now();
  const isNavigation = action.actionType === "web.browser.navigate" && Boolean(action.url);
  const tabId = await resolveAutomationTab(tabRequestFor(action, request, isNavigation));
  const frameId = frameIdForAction(action);
  const unsupportedReason = await unsupportedPageReasonFor(action, request, tabId, isNavigation);
  if (unsupportedReason !== void 0 && isMutatingAction(action.actionType)) {
    return withTarget(unsupportedPageFailure(action, startedAt, unsupportedReason), tabId, frameId);
  }
  if (isNavigation && action.url) {
    setAutomationTab(tabId);
    await request.attachTabForRecording(tabId);
    return withTarget(navigationResult(action, startedAt, action.url, await readTabUrl(tabId)), tabId, frameId);
  }
  await waitForTabReady(tabId);
  await request.attachTabForRecording(tabId);
  return await runActionInFrame(action, startedAt, tabId, frameId);
}
function browserActionFailure(action, message) {
  const expected = "the action to run";
  return workerActionResult(action, Date.now(), {
    status: "failed",
    message,
    validation: { status: "failed", expected, actual: message },
    failure: workerActionFailedFailure("web.action.failed", expected, message)
  });
}
function tabRequestFor(action, request, isNavigation) {
  const tabRequest = { active: true };
  const namedTabId = tabIdForAction(action);
  if (isNavigation && action.url) {
    tabRequest.initialUrl = action.url;
    if (opensNewTab(action)) tabRequest.forceNew = true;
    else if (namedTabId !== void 0) tabRequest.requestedTabId = namedTabId;
    return tabRequest;
  }
  if (namedTabId !== void 0) tabRequest.requestedTabId = namedTabId;
  else if (request.activeTabId !== void 0) tabRequest.requestedTabId = request.activeTabId;
  return tabRequest;
}
async function unsupportedPageReasonFor(action, request, tabId, isNavigation) {
  if (isNavigation) return unsupportedAutomationPageReason(action.url);
  return unsupportedAutomationPageReason(await readTabUrl(tabId)) ?? request.unsupportedPageReason;
}
function navigationResult(action, startedAt, requested, landed) {
  const comparison = compareNavigatedUrl(requested, landed);
  if (comparison.matched) {
    return workerActionResult(action, startedAt, {
      status: "succeeded",
      message: "Navigation completed.",
      validation: { status: "passed", expected: comparison.expected, actual: comparison.actual },
      ...landed !== void 0 ? { url: landed } : {}
    });
  }
  return workerActionResult(action, startedAt, {
    status: "failed",
    message: `Navigation landed on ${comparison.actual}, not ${comparison.expected}.`,
    validation: { status: "failed", expected: comparison.expected, actual: comparison.actual },
    failure: navigationUnexpectedFailure(comparison.expected, comparison.actual),
    ...landed !== void 0 ? { url: landed } : {}
  });
}
function unsupportedPageFailure(action, startedAt, reason) {
  const expected = "a page the extension can automate";
  return workerActionResult(action, startedAt, {
    status: "failed",
    message: reason,
    validation: { status: "failed", expected, actual: reason },
    failure: workerBlockedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, { expected, actual: reason })
  });
}
async function runActionInFrame(action, startedAt, tabId, recordedFrameId) {
  const urlPath = frameUrlPathForAction(action);
  const choice = urlPath === void 0 ? { frameId: recordedFrameId } : chooseFrame(await allTabFrames(tabId), recordedFrameId, urlPath);
  if ("refused" in choice) {
    return withTarget(workerActionResult(action, startedAt, choice.refused), tabId, recordedFrameId);
  }
  const frameId = choice.frameId;
  const targetFrameId = frameId ?? TOP_FRAME_ID4;
  if (targetFrameId !== TOP_FRAME_ID4) {
    const absent = await absentFrameReason(tabId, targetFrameId);
    if (absent !== void 0) {
      return withTarget(missingFrameFailure(action, startedAt, targetFrameId, absent), tabId, targetFrameId);
    }
    const unreachable = await unreachableFrameReason(tabId, targetFrameId);
    if (unreachable !== void 0) {
      return withTarget(unreachableFrameFailure(action, startedAt, targetFrameId, unreachable), tabId, targetFrameId);
    }
  }
  const message = { type: "executeAction", action, frameId: targetFrameId, topFrameOnly: frameId === void 0 };
  const send = () => sendAction(action, tabId, message, targetFrameId);
  return withTarget(await sendClickCheckingLanding(action, tabId, send), tabId, targetFrameId);
}
var NAVIGATING_PAGE_ERRORS = [/Receiving end does not exist/i, /message (port|channel) closed before a response was received/i];
async function sendAction(action, tabId, message, frameId) {
  try {
    return await sendToTab(tabId, message, frameId);
  } catch (error) {
    if (action.actionType !== "web.dom.assert" || !metNavigatingPage(error)) throw error;
    await waitForTabReady(tabId);
    return await sendToTab(tabId, message, frameId);
  }
}
function metNavigatingPage(error) {
  return error instanceof Error && NAVIGATING_PAGE_ERRORS.some((pattern) => pattern.test(error.message));
}
async function absentFrameReason(tabId, frameId) {
  const frames = await allTabFrames(tabId);
  if (frames.length === 0) return void 0;
  if (frames.some((frame) => frame.frameId === frameId)) return void 0;
  return `the tab has ${frames.map((frame) => `frame ${frame.frameId}`).join(", ")}`;
}
function missingFrameFailure(action, startedAt, frameId, actual) {
  const expected = `frame ${frameId} in the tab`;
  return workerActionResult(action, startedAt, {
    status: "failed",
    message: `The action is addressed to frame ${frameId}, which this tab does not have.`,
    validation: { status: "failed", expected, actual },
    failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, { expected, actual })
  });
}
function unreachableFrameFailure(action, startedAt, frameId, actual) {
  const expected = `frame ${frameId} to be running the FluxIQ content script`;
  return workerActionResult(action, startedAt, {
    status: "failed",
    message: `The action is addressed to frame ${frameId}, which is not running the FluxIQ content script.`,
    validation: { status: "failed", expected, actual },
    failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, { expected, actual })
  });
}
function isMutatingAction(actionType) {
  return actionType !== "web.dom.extract" && actionType !== "web.dom.extract_list" && actionType !== "web.dom.assert" && actionType !== "web.dom.capture_snapshot" && actionType !== "web.dom.wait_for_selector" && actionType !== "web.dom.wait_for_text";
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
  const mapped = webAutomationActionFromGatewayCommand(command);
  return isWebAutomationActionRejection(mapped) ? mapped : mapped;
}
function isWebAutomationActionRejection(value) {
  return "status" in value && value.status === "rejected" && "failure" in value;
}
function gatewayActionResultFromRejection(rejection) {
  return {
    commandId: rejection.commandId,
    status: "failed",
    completedAt: Date.now(),
    message: rejection.message,
    error: rejection.message,
    failure: rejection.failure,
    metadata: { requestedActionType: rejection.actionType }
  };
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
    // Every status that is not a success carries its message as the error.
    // `timed_out` and `cancelled` used to reach the gateway with none, while
    // the panel showed the same result as failed with one (found by
    // w1-extension-unit-tests); the status itself is passed through untouched.
    error: result.status === "succeeded" ? void 0 : result.message,
    // Core's structured failure record, built by the content script or by a
    // worker-side action. Without this the record was assembled and then
    // dropped at the boundary, so the gateway saw only a message string.
    failure: result.failure
  });
}
function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}

// src/background/connection/value-readers.ts
function compactObject2(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}
function stringValue6(value) {
  return typeof value === "string" ? value : void 0;
}
function objectValue4(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function arrayValue2(value) {
  return Array.isArray(value) ? value : [];
}
function numberValue4(value) {
  return typeof value === "number" ? value : void 0;
}
function rectValue(value) {
  if (!value || typeof value !== "object") return void 0;
  const rect2 = value;
  return typeof rect2.x === "number" && typeof rect2.y === "number" && typeof rect2.width === "number" && typeof rect2.height === "number" ? { x: rect2.x, y: rect2.y, width: rect2.width, height: rect2.height } : void 0;
}
function timestampValue(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return void 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? void 0 : parsed;
}
function parseJsonBody(text2) {
  if (!text2) return void 0;
  try {
    return JSON.parse(text2);
  } catch {
    return void 0;
  }
}

// src/background/connection/browser-state.ts
var RECORDING_REASONS = {
  [UNSUPPORTED_BROWSER_PAGE_REASON]: "Browser and extension pages cannot be recorded.",
  [UNSUPPORTED_STORE_PAGE_REASON]: "Browser web store pages cannot be recorded."
};
function unsupportedPageForUrl(url) {
  const reason = unsupportedAutomationPageReason(url);
  if (reason === void 0 || url === void 0) return void 0;
  return { url, reason: RECORDING_REASONS[reason] ?? reason };
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
  const text2 = typeof data === "string" ? data : data instanceof ArrayBuffer ? new TextDecoder().decode(data) : "";
  if (!text2)
    return null;
  const parsed = JSON.parse(text2);
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

// src/background/connection/active-page.ts
var ActivePage = class {
  constructor(deps) {
    this.deps = deps;
  }
  currentTabId;
  currentUrl;
  currentUnsupported;
  tabId() {
    return this.currentTabId;
  }
  url() {
    return this.currentUrl;
  }
  unsupported() {
    return this.currentUnsupported;
  }
  setUnsupported(state) {
    this.currentUnsupported = state;
  }
  setTabId(tabId) {
    this.currentTabId = tabId;
  }
  // A finished runtime action reports the tab and URL it ended on, which is
  // more current than the last tab event the browser sent.
  noteActionResult(tabId, url) {
    if (tabId !== void 0) this.currentTabId = tabId;
    if (url) this.currentUrl = url;
  }
  async refresh() {
    const tab = await this.deps.activeTab();
    this.currentTabId = tab?.tabId;
    this.currentUrl = tab?.url;
    this.currentUnsupported = unsupportedPageForUrl(tab?.url);
    this.deps.emitStatus();
  }
  async sendBrowserState() {
    await this.deps.send("client.state_update", browserStateFromTabs(await this.deps.activeTab(), await this.deps.allTabs(), this.deps.recordingState()));
  }
  async handleTabUpdate(tab) {
    const lastActive = this.knownActiveTab();
    const becameActive = Boolean(tab.active && tab.id !== void 0 && this.currentTabId !== tab.id);
    if (tab.active && tab.id !== void 0) {
      this.currentTabId = tab.id;
      this.currentUrl = tab.url;
      this.currentUnsupported = unsupportedPageForUrl(tab.url);
      this.deps.emitStatus();
    }
    if (!tab.id) return;
    await this.deps.noteTabChange(tab, lastActive).catch(() => void 0);
    if (tab.active && this.deps.recordingState() === "recording" && !this.currentUnsupported) {
      await this.deps.attachTabForRecording(tab.id).catch(() => void 0);
      if (becameActive) this.deps.onActivity("tab", "Recording active tab", tab.url ?? `Tab ${tab.id}`);
    }
    if (this.deps.gatewayState() === "connected") {
      await this.deps.send("client.state_update", createWebAutomationStateUpdate({
        activeContextId: String(tab.id),
        contexts: [compactObject2({ contextId: String(tab.id), url: tab.url, title: tab.title, status: tab.status })],
        recording: this.deps.recordingState() === "recording",
        state: createWebAutomationStateFromTabs(describeActiveTabLike(tab), [describeActiveTabLike(tab)], {
          timestamp: Date.now(),
          sourceId: eventSourceId(this.deps.clientId()),
          recording: this.deps.recordingState() === "recording",
          permissions: ["activeTab", "scripting", "storage", "tabs"]
        }),
        metadata: { reason: "tab-updated", inputId: WEB_AUTOMATION_INPUT_IDS.browserState }
      }));
      await this.sendBrowserState();
    }
  }
  handleTabRemoved(tabId) {
    return this.deps.noteTabRemoved(tabId, this.knownActiveTab()).catch(() => void 0);
  }
  async select(tabId) {
    const tab = await chrome.tabs.update(tabId, { active: true });
    if (tab.id !== tabId || unsupportedPageForUrl(tab.url)) {
      throw new Error("The requested automation tab is unavailable or unsupported.");
    }
    await this.deps.updateTab({ ...tab, active: true });
  }
  // The page in front, when it is one a recording can be in.
  knownActiveTab() {
    return this.currentTabId === void 0 || this.currentUnsupported ? void 0 : { tabId: this.currentTabId, url: this.currentUrl };
  }
};

// src/background/connection/recording-start/handshake.ts
var RECORDING_START_ACCEPT_TIMEOUT_MS = 750;
var RECORDING_START_RETRY_DELAYS_MS = [400, 1200, 2400];
var RecordingStartHandshake = class {
  constructor(deps) {
    this.deps = deps;
  }
  pending;
  isPending() {
    return this.pending !== void 0;
  }
  pendingRecordingId() {
    return this.pending?.recordingId;
  }
  // Sends the first attempt and opens its acceptance window.
  async begin(input) {
    this.cancel();
    this.pending = { ...input, attempt: 0, acceptTimer: void 0, retryTimer: void 0, inFlightSend: void 0, localStartDue: false };
    await this.sendPending(this.pending);
  }
  // FluxIQ accepted, or recording started some other way. Nothing is in flight.
  noteAccepted() {
    this.cancel();
  }
  cancel() {
    if (!this.pending) return;
    if (this.pending.acceptTimer !== void 0) clearTimeout(this.pending.acceptTimer);
    if (this.pending.retryTimer !== void 0) clearTimeout(this.pending.retryTimer);
    this.pending = void 0;
  }
  // Stop needs stronger ordering than ordinary cancellation: a retry send is
  // detached from the UI promise and may still be resolving project context.
  // Cancel ownership synchronously, then let Stop place its close only after
  // that already-started send has settled. Its failure belongs to the start,
  // not to teardown.
  async cancelAndDrain() {
    const inFlightSend = this.pending?.inFlightSend;
    this.cancel();
    if (inFlightSend) await inFlightSend.catch(() => void 0);
  }
  noteRefusal(refusal) {
    const pending = this.pending;
    if (!pending) {
      this.deps.surfaceRefusal(refusal, 0);
      return;
    }
    if (pending.acceptTimer !== void 0) {
      clearTimeout(pending.acceptTimer);
      pending.acceptTimer = void 0;
    }
    pending.localStartDue = false;
    const attempts = pending.attempt + 1;
    const delays = this.deps.retryDelaysMs ?? RECORDING_START_RETRY_DELAYS_MS;
    const delayMs = refusal.kind === "transient" ? delays[pending.attempt] : void 0;
    if (delayMs === void 0) {
      this.cancel();
      this.deps.surfaceRefusal(refusal, attempts);
      return;
    }
    this.deps.noteRetry(refusal, attempts, delays.length, delayMs);
    pending.retryTimer = setTimeout(() => this.resend(pending.recordingId), delayMs);
  }
  resend(recordingId) {
    const pending = this.pending;
    if (!pending || pending.recordingId !== recordingId) return;
    pending.retryTimer = void 0;
    pending.attempt += 1;
    void this.sendPending(pending);
  }
  // The acceptance window is armed before the send rather than after it: it
  // measures how long the user has been waiting. An elapsed window still waits
  // for the send to settle before recording begins locally. The send may first
  // look the project up over HTTP, and an event recorded while the start is
  // unsent reaches FluxIQ ahead of it, where no ordering on FluxIQ's side can
  // put it back. The price is that a send which never settles never falls back:
  // the start stays pending, and a second press says so, until it is cancelled.
  async sendPending(pending) {
    pending.localStartDue = false;
    pending.acceptTimer = setTimeout(
      () => this.acceptWindowElapsed(pending),
      this.deps.acceptTimeoutMs ?? RECORDING_START_ACCEPT_TIMEOUT_MS
    );
    const send = this.deps.send({
      recordingId: pending.recordingId,
      startedAt: pending.startedAt,
      initialState: pending.initialState,
      attempt: pending.attempt
    });
    pending.inFlightSend = send;
    try {
      await send;
    } finally {
      if (pending.inFlightSend === send) {
        pending.inFlightSend = void 0;
        if (pending.localStartDue) this.startLocally(pending);
      }
    }
  }
  acceptWindowElapsed(pending) {
    if (this.pending !== pending) return;
    pending.acceptTimer = void 0;
    if (pending.inFlightSend !== void 0) {
      pending.localStartDue = true;
      return;
    }
    this.startLocally(pending);
  }
  startLocally(pending) {
    if (this.pending !== pending) return;
    this.cancel();
    void this.deps.beginLocally(pending.recordingId);
  }
};

// src/background/connection/recording-start/refusal.ts
var PROJECT_REQUIRED = "recording.project_required";
var PROJECT_MISMATCH = "recording.project_context_mismatch";
var PROJECT_NOT_SELECTED_ERROR = "Open a FluxIQ project before recording.";
var CONTEXT_STALE_ERROR = "FluxIQ's project context went stale before recording could start.";
var PROJECT_MISMATCH_ERROR = "FluxIQ has a different project open than the one this recording asked for.";
var REFUSAL_ERRORS = /* @__PURE__ */ new Set([PROJECT_NOT_SELECTED_ERROR, CONTEXT_STALE_ERROR, PROJECT_MISMATCH_ERROR]);
function classifyRecordingStartRefusal(payload) {
  const code = payload.code;
  if (code !== PROJECT_REQUIRED && code !== PROJECT_MISMATCH) return void 0;
  const metadata = objectValue4(payload.metadata);
  const activeProjectId = stringValue6(metadata?.activeProjectId)?.trim();
  if (code === PROJECT_MISMATCH) {
    return {
      code,
      kind: "persistent",
      reason: "project_mismatch",
      title: "Project Mismatch",
      message: payload.message || "FluxIQ has a different project open than the one this recording asked for. Switch project in the web panel, then start the recording again.",
      lastError: PROJECT_MISMATCH_ERROR,
      detail: "Switch project in the web panel, then start the recording again."
    };
  }
  if (activeProjectId) {
    return {
      code,
      kind: "transient",
      reason: "context_stale",
      title: "FluxIQ Is Catching Up",
      message: "FluxIQ has a project open but its Automation Studio context is stale, so it refused the recording start. Bring the FluxIQ Automation Studio tab to the front, then start the recording again.",
      lastError: CONTEXT_STALE_ERROR,
      detail: "Bring the FluxIQ Automation Studio tab to the front, then start the recording again."
    };
  }
  return {
    code,
    kind: "persistent",
    reason: "project_not_selected",
    title: "Project Required",
    message: payload.message || "Open a FluxIQ project in the web panel before starting a recording.",
    lastError: PROJECT_NOT_SELECTED_ERROR,
    detail: "Open a FluxIQ project in the web panel."
  };
}
function recordingStartRefusalBlock(refusal, attempts) {
  return {
    code: refusal.code,
    title: refusal.title,
    message: attempts > 1 ? `${refusal.message} (Retried ${attempts - 1} time${attempts === 2 ? "" : "s"}.)` : refusal.message
  };
}
function isRecordingStartRefusalError(value) {
  return value !== void 0 && REFUSAL_ERRORS.has(value);
}

// src/background/connection/active-recording.ts
var RECORDING_START_PROJECT_LOOKUP_BOUND_MS = 1500;
var ActiveRecording = class {
  constructor(deps) {
    this.deps = deps;
    this.handshake = new RecordingStartHandshake({
      send: (attempt) => this.sendStart(attempt),
      beginLocally: (recordingId) => this.beginWithoutAcceptance(recordingId),
      surfaceRefusal: (refusal, attempts) => this.applyRefusal(refusal, attempts),
      noteRetry: (refusal, attempt, of, delayMs) => {
        this.deps.onActivity(
          "recording",
          "Recording start delayed",
          `${refusal.detail} Retrying in ${delayMs} ms (${attempt} of ${of}).`,
          "warning"
        );
        this.deps.emitStatus();
      }
    });
  }
  recordingState = "idle";
  recordingStartedAt;
  activeRecordingId;
  recordingBlock;
  events = 0;
  // A start already decided that has not yet reached `recording`.
  starting;
  // Installed synchronously for every Stop that owns lifecycle work, including
  // work which has not reached `recording` yet. Starts arriving afterwards
  // wait behind this owner; callers crossing it share its exact result.
  stopRequest;
  // Covers the pre-handshake work too, so simultaneous UI presses released
  // behind a Stop cannot both pass the handshake's pending check.
  uiStart;
  // The initial marker is the one event an accepted start must publish even
  // when Stop already owns the lifecycle. This flag is true only for the
  // synchronous admission of that marker, never across its asynchronous send.
  admittingInitialMarker = false;
  // The recording this client last stopped: FluxIQ's acknowledgement of it can
  // still be on the wire.
  stoppedRecordingId;
  // The recording whose start last gave up on its project lookup at the bound.
  lookupBoundReachedFor;
  handshake;
  state() {
    return this.recordingState;
  }
  acceptsEvents() {
    return this.recordingState === "recording" && (this.stopRequest === void 0 || this.admittingInitialMarker);
  }
  startedAt() {
    return this.recordingStartedAt;
  }
  recordingId() {
    return this.activeRecordingId;
  }
  eventCount() {
    return this.events;
  }
  block() {
    return this.recordingBlock;
  }
  noteEvent() {
    this.events += 1;
  }
  start() {
    if (this.uiStart) return this.uiStart.finished;
    const uiStart = { cancelled: false, finished: Promise.resolve() };
    const finished = this.startAfterStop(uiStart);
    uiStart.finished = finished;
    this.uiStart = uiStart;
    void finished.then(
      () => {
        if (this.uiStart === uiStart) this.uiStart = void 0;
      },
      () => {
        if (this.uiStart === uiStart) this.uiStart = void 0;
      }
    );
    return finished;
  }
  async startAfterStop(uiStart) {
    await this.settleCapturedStop();
    if (uiStart.cancelled) return;
    if (this.handshake.isPending()) {
      this.deps.onActivity("recording", "Recording is starting", "Waiting for FluxIQ project acceptance.", "warning");
      return;
    }
    if (this.deps.gatewayState() !== "connected") {
      this.deps.setLastError("Connect to FluxIQ before recording.");
      this.deps.emitStatus();
      return;
    }
    await this.deps.page.refresh();
    if (uiStart.cancelled) return;
    const unsupported = this.deps.page.unsupported();
    if (unsupported) {
      this.deps.setLastError(unsupported.reason);
      this.deps.onActivity("page", "Page cannot be recorded", unsupported.reason, "warning");
      this.deps.emitStatus();
      return;
    }
    this.resetLog();
    this.recordingBlock = void 0;
    const recordingId = `client.${this.deps.session().clientId}.${Date.now()}`;
    const startedAt = Date.now();
    const initialState = await this.deps.evidence.buildInitialRecordingState(startedAt);
    if (uiStart.cancelled) return;
    while (this.starting) await this.starting.finished;
    if (uiStart.cancelled) return;
    if (this.recordingState === "recording" || this.handshake.isPending()) {
      this.deps.onActivity("recording", "Recording is starting", "Another recording start won while this request was preparing.", "warning");
      return;
    }
    this.deps.onActivity("recording", "Starting recording", this.deps.projects.current() ? "Waiting for FluxIQ project acceptance." : "Waiting for FluxIQ project context.", "warning");
    await this.handshake.begin({ recordingId, startedAt, initialState });
    this.deps.emitStatus();
  }
  stop(notifyServer) {
    if (this.stopRequest) return this.stopRequest.finished;
    const uiStart = this.uiStart;
    const starting = this.starting;
    const pendingRecordingId = this.handshake.pendingRecordingId();
    const recordingId = this.activeRecordingId ?? starting?.recordingId ?? pendingRecordingId;
    if (this.recordingState !== "recording" && !uiStart && !starting && !pendingRecordingId) return Promise.resolve();
    const endedAt = this.recordingState === "recording" ? Date.now() : void 0;
    let resolveStop = () => void 0;
    let rejectStop = () => void 0;
    const finished = new Promise((resolve, reject) => {
      resolveStop = resolve;
      rejectStop = reject;
    });
    const stopRequest = { finished };
    this.stopRequest = stopRequest;
    if (uiStart) {
      uiStart.cancelled = true;
      if (this.uiStart === uiStart) this.uiStart = void 0;
    }
    const pendingSend = pendingRecordingId ? this.handshake.cancelAndDrain() : void 0;
    void this.finishStopRequest(notifyServer, recordingId, uiStart, starting, pendingSend, endedAt).then(() => {
      if (this.stopRequest === stopRequest) this.stopRequest = void 0;
      resolveStop();
    }, (error) => {
      if (this.stopRequest === stopRequest) this.stopRequest = void 0;
      rejectStop(error);
    });
    return finished;
  }
  async finishStopRequest(notifyServer, recordingId, uiStart, starting, pendingSend, endedAt) {
    if (uiStart) await uiStart.finished.catch(() => void 0);
    if (starting) await starting.finished;
    if (pendingSend) await pendingSend;
    if (!recordingId && this.recordingState !== "recording") return;
    await this.finishStop(
      notifyServer,
      this.activeRecordingId ?? recordingId,
      this.deps.projects.activeRecordingProject(),
      endedAt ?? Date.now()
    );
  }
  async finishStop(notifyServer, recordingId, projectId, endedAt) {
    const stopPayload = recordingId ? compactObject2({ recordingId, ...projectId !== void 0 ? { projectId } : {}, endedAt }) : void 0;
    let navigationFailure;
    try {
      await this.deps.navigation.flush();
    } catch (error) {
      navigationFailure = error;
    }
    this.deps.scriptedNavigation.cancelAll("recording_stopped");
    this.recordingState = "idle";
    this.stoppedRecordingId = recordingId;
    this.deps.clicks.clear();
    this.activeRecordingId = void 0;
    this.deps.projects.setActiveRecordingProject(void 0);
    this.deps.onActivity("recording", "Recording stopped", `${this.events} user actions captured`, "neutral");
    this.deps.emitStatus();
    void this.deps.attachment.broadcast({ type: "recording", recording: false, settings: this.deps.settings() }, false);
    if (notifyServer && stopPayload) {
      try {
        await this.deps.send("client.stop_recording", stopPayload);
      } catch (error) {
        if (navigationFailure === void 0) throw error;
      }
    }
    if (navigationFailure !== void 0) throw navigationFailure;
  }
  dismissBlock() {
    this.recordingBlock = void 0;
    if (isRecordingStartRefusalError(this.deps.lastError())) this.deps.setLastError(void 0);
    this.deps.emitStatus();
  }
  // FluxIQ's `server.start_recording`: its acknowledgement of this client's
  // start, or a start FluxIQ asked for itself, from the web panel.
  async beginAccepted(recordingId, projectId) {
    const stopRequest = this.stopRequest;
    if (stopRequest) await stopRequest.finished.catch(() => void 0);
    if (!this.expectsStart(recordingId)) {
      this.deps.onActivity("recording", "Recording start ignored", "FluxIQ named a recording this client is not starting or running, or has already stopped.", "warning");
      return;
    }
    this.handshake.noteAccepted();
    await this.beginOnce(recordingId, async () => projectId);
  }
  // FluxIQ refused a start. The handshake decides whether that is retried or
  // surfaced; a refusal with no start of ours in flight is surfaced at once.
  noteStartRefusal(refusal) {
    if (this.stopRequest) return;
    this.handshake.noteRefusal(refusal);
  }
  // Abandons a start still waiting on FluxIQ, with its timers.
  cancelStart() {
    this.handshake.cancel();
  }
  // A `server.start_recording` names the recording FluxIQ opened. One naming the
  // recording this client stopped crossed that Stop on the wire, and restarting
  // would record into a recording FluxIQ has closed. While a start is pending or
  // under way, or a recording is running, one naming any other recording
  // answers none of them. With none of those, it is FluxIQ's own start.
  expectsStart(recordingId) {
    if (recordingId === this.stoppedRecordingId) return false;
    const own = [
      this.handshake.pendingRecordingId(),
      this.starting?.recordingId,
      this.recordingState === "recording" ? this.activeRecordingId : void 0
    ].filter((id) => id !== void 0);
    return own.length === 0 || own.includes(recordingId);
  }
  // Capture once: a rejected Stop still completed teardown, and a later Stop
  // belongs to a later recording rather than extending this caller's wait.
  async settleCapturedStop() {
    const stopRequest = this.stopRequest;
    if (stopRequest) await stopRequest.finished.catch(() => void 0);
  }
  // Every way into a recording comes through here, so it starts once. A start
  // is marked the moment it is decided, before its first await. Another that
  // arrives meanwhile waits for it, then finds the recording running and only
  // links its project, so the two apply in the order they arrived: a local
  // start's missing project never overwrites the one FluxIQ named while it ran.
  async beginOnce(recordingId, project) {
    while (this.starting) await this.starting.finished;
    if (this.recordingState === "recording") {
      await this.linkProject(await project());
      return;
    }
    let finish = () => void 0;
    const starting = { recordingId, finished: new Promise((resolve) => {
      finish = resolve;
    }) };
    this.starting = starting;
    try {
      await this.startRecording(recordingId, await project());
    } finally {
      if (this.starting === starting) this.starting = void 0;
      finish();
    }
  }
  async linkProject(projectId) {
    if (projectId === void 0) return;
    await this.deps.persistSession(compactObject2({ ...this.deps.session(), projectId }));
    if (this.recordingState !== "recording" || this.deps.projects.activeRecordingProject() === projectId) return;
    this.deps.projects.setActiveRecordingProject(projectId);
    await this.deps.evidence.captureActiveSnapshot("Project-linked snapshot captured");
  }
  async startRecording(recordingId, projectId) {
    if (projectId !== void 0) {
      await this.deps.persistSession(compactObject2({ ...this.deps.session(), projectId }));
    }
    this.deps.scriptedNavigation.cancelAll("recording_stopped");
    this.resetLog();
    this.deps.navigation.clearRecordingTabs();
    this.recordingBlock = void 0;
    this.activeRecordingId = recordingId;
    this.deps.projects.setActiveRecordingProject(projectId !== void 0 ? projectId : this.deps.session().projectId);
    this.events = 0;
    this.deps.activityLog.clearRecent();
    const recordingTabs = await this.deps.allTabs();
    this.recordingStartedAt = Date.now();
    this.recordingState = "recording";
    for (const tab of recordingTabs) {
      if (tab.tabId < 0 || !tab.url || unsupportedPageForUrl(tab.url)) continue;
      this.deps.navigation.seedRecordingTab(tab.tabId, tab.url, this.recordingStartedAt);
    }
    this.deps.onActivity("recording", "Recording started", this.deps.page.url() ?? "Active tab", "success");
    this.deps.emitStatus();
    const activeTabId = this.deps.page.tabId();
    if (activeTabId !== void 0) await this.deps.attachment.attachTabForRecording(activeTabId);
    await this.deps.page.sendBrowserState();
    let initialMarker;
    try {
      this.admittingInitialMarker = true;
      initialMarker = this.deps.recordEvent({
        kind: "browser.tab",
        sequence: this.deps.sequence.next(),
        url: this.deps.page.url() ?? "",
        title: "",
        eventTimestampMs: Date.now(),
        metadata: { recordingState: "started", recordingId }
      });
    } finally {
      this.admittingInitialMarker = false;
    }
    await initialMarker;
    await this.deps.evidence.captureActiveSnapshot("Initial snapshot captured");
  }
  // Each attempt resolves the project again rather than reusing the first
  // answer: a retry exists because FluxIQ's context moved, and the extension's
  // own view of it may have moved with it.
  async sendStart(attempt) {
    const projectId = await this.lookUpProject(attempt.recordingId, attempt.attempt === 0 ? "recording_start" : "recording_start_retry");
    await this.deps.send("client.start_recording", {
      recordingId: attempt.recordingId,
      ...projectId ? { projectId } : {},
      startedAt: attempt.startedAt,
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      initialState: attempt.initialState,
      environment: recordingEnvironment(this.deps.session().clientId, this.deps.page.url()),
      sources: recordingSources(this.deps.session().clientId),
      actionChannels: recordingActionChannels(this.deps.session().clientId),
      metadata: {
        domainId: WEB_AUTOMATION_DOMAIN_ID,
        requestedBy: "extension-record-button",
        projectId: projectId ?? null,
        activeTabUrl: this.deps.page.url() ?? null,
        startAttempt: attempt.attempt
      }
    });
  }
  // A start's project, waited on for at most the bound. At the bound the start
  // goes on as it does when no project is known: the send carries none, for
  // FluxIQ to accept or refuse, and a local start records unlinked until an
  // acknowledgement names a project. The lookup is left to finish on its own.
  async lookUpProject(recordingId, reason) {
    let boundReached = false;
    let bound;
    const giveUp = new Promise((resolve) => {
      bound = setTimeout(() => {
        boundReached = true;
        resolve(void 0);
      }, RECORDING_START_PROJECT_LOOKUP_BOUND_MS);
    });
    try {
      const projectId = await Promise.race([this.deps.projects.resolve(reason), giveUp]);
      this.lookupBoundReachedFor = boundReached ? recordingId : void 0;
      if (boundReached) {
        this.deps.onActivity("recording", "Project lookup timed out", `No project from FluxIQ within ${RECORDING_START_PROJECT_LOOKUP_BOUND_MS} ms; starting without one.`, "warning");
      }
      return projectId;
    } finally {
      clearTimeout(bound);
    }
  }
  // A refusal the handshake has stopped fighting -- persistent from the first
  // answer, or transient and out of retries. Either way the recorder must not
  // be left silently idle: the block says what happened, `lastError` says it
  // on the status line, and the activity log keeps the trail.
  applyRefusal(refusal, attempts) {
    this.handshake.cancel();
    if (this.recordingState === "recording") {
      this.deps.scriptedNavigation.cancelAll("recording_stopped");
      this.recordingState = "idle";
      this.deps.clicks.clear();
      void this.deps.attachment.broadcast({ type: "recording", recording: false, settings: this.deps.settings() }, false);
    }
    this.recordingStartedAt = void 0;
    this.activeRecordingId = void 0;
    this.deps.projects.setActiveRecordingProject(void 0);
    this.recordingBlock = recordingStartRefusalBlock(refusal, attempts);
    this.deps.setLastError(refusal.lastError);
    this.deps.onActivity("recording", "Recording locked", refusal.detail, "warning");
    this.deps.emitStatus();
  }
  // FluxIQ did not answer the start in time. Recording begins locally so no
  // user action is lost; the project link attaches later if one arrives. A
  // refusal is not silence and never reaches here -- it goes to
  // `applyRefusal`, through a bounded retry when waiting can help. When this
  // start's send already gave up on the lookup at the bound, the local start
  // does not wait on it a second time: it goes on with what is known.
  async beginWithoutAcceptance(recordingId) {
    let projectId;
    await this.beginOnce(recordingId, async () => {
      projectId = this.lookupBoundReachedFor === recordingId ? this.deps.projects.current() : await this.lookUpProject(recordingId, "recording_start_timeout");
      return projectId ?? null;
    });
    if (!projectId) {
      this.deps.onActivity("recording", "Project context pending", "Structured state will record; screenshots attach after FluxIQ links a project.", "warning");
      this.deps.emitStatus();
    }
  }
  resetLog() {
    this.events = 0;
    this.deps.activityLog.reset();
    this.deps.clicks.clear();
  }
};

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
  const root = objectValue4(payload);
  if (root?.ok !== true) return void 0;
  const body = objectValue4(root.payload);
  const sessions = arrayValue2(body?.sessions);
  const matchingSession = sessions.map(objectValue4).find((session) => session && stringValue6(session.sessionId) === identity.sessionId) ?? sessions.map(objectValue4).find((session) => session && stringValue6(session.clientId) === identity.clientId);
  const sessionProjectId = stringValue6(matchingSession?.projectId);
  const webRuntime = objectValue4(body?.webRuntime);
  const automationStudio = objectValue4(webRuntime?.automationStudio);
  const activeProjectId = stringValue6(automationStudio?.activeProjectId);
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
  const responseObject = objectValue4(payload);
  const responsePayload = objectValue4(responseObject?.payload);
  const contentRef = stringValue6(responsePayload?.contentRef);
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
    page: numberValue4(object.page) ?? page,
    pageSize: numberValue4(object.pageSize) ?? pageSize,
    total: numberValue4(object.total),
    sourceUrl
  };
}
function normalizeRecordingSummary(value) {
  if (!value || typeof value !== "object") return void 0;
  const object = value;
  const id = stringValue6(object.id) ?? stringValue6(object.recordingId);
  if (!id) return void 0;
  return compactObject2({
    id,
    title: stringValue6(object.title) ?? stringValue6(object.name) ?? id,
    status: stringValue6(object.status),
    projectId: stringValue6(object.projectId),
    taskId: stringValue6(object.taskId),
    eventCount: numberValue4(object.eventCount),
    startedAt: timestampValue(object.startedAt),
    endedAt: timestampValue(object.endedAt),
    updatedAt: timestampValue(object.updatedAt)
  });
}

// src/shared/present.ts
function present(fields) {
  const source = fields;
  const written = {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value !== void 0) written[key] = value;
  }
  return written;
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
  const rect2 = rectValue(bounds) ?? translateFrameDocumentRectToFrameViewport(documentBounds, frameSnapshot);
  if (!rect2) return void 0;
  return {
    x: round2(offset.x + rect2.x),
    y: round2(offset.y + rect2.y),
    width: round2(rect2.width),
    height: round2(rect2.height)
  };
}
function translateFrameDocumentRectToFrameViewport(documentBounds, frameSnapshot) {
  const rect2 = rectValue(documentBounds);
  if (!rect2) return void 0;
  return {
    x: round2(rect2.x - frameSnapshot.viewport.scrollX),
    y: round2(rect2.y - frameSnapshot.viewport.scrollY),
    width: round2(rect2.width),
    height: round2(rect2.height)
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
var MAX_MERGED_DIALOGS = 10;
var MAX_MERGED_BLOCKERS = 10;
var MAX_MERGED_BUSY_REGIONS = 16;
var MAX_MERGED_LOADING_INDICATORS = 16;
var MAX_MERGED_REGIONS = 40;
var MAX_MERGED_REPEATING = 12;
var MAX_MERGED_FORMS = 16;
var MAX_MERGED_ELEMENTS = 4e3;
var FRAME_SNAPSHOT_TIMEOUT_MS = 150;
function isDomSnapshotPayload(value) {
  if (!value || typeof value !== "object") return false;
  const snapshot = value;
  return typeof snapshot.url === "string" && typeof snapshot.title === "string" && Boolean(snapshot.viewport) && typeof snapshot.viewport?.width === "number" && typeof snapshot.viewport.height === "number" && typeof snapshot.viewport.scrollX === "number" && typeof snapshot.viewport.scrollY === "number" && Array.isArray(snapshot.interactiveElements);
}
function hasSnapshotFrameViewportOffset(snapshot) {
  const frame = objectValue4(snapshot.frame);
  const viewportOffset = objectValue4(frame?.viewportOffset);
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
  const listedTop = frameSnapshots.find((entry) => entry.frameId === 0 || entry.snapshot.frame?.isTop);
  const topSnapshot = listedTop?.snapshot ?? topFallback;
  if (!topSnapshot) return void 0;
  if (!listedTop) frameSnapshots.splice(seedSnapshot && seedFrameId !== void 0 ? 1 : 0, 0, { frameId: 0, snapshot: topSnapshot });
  const collectedElements = [];
  let topEvidence;
  const frameEvidence = [];
  for (const entry of frameSnapshots) {
    const isTopEntry = entry.snapshot === topSnapshot || entry.snapshot.frame?.isTop === true;
    const elements = isTopEntry ? entry.snapshot.interactiveElements : translateFrameElements(entry.snapshot, topSnapshot, entry.frameId);
    collectedElements.push(...elements);
    const evidence2 = pageEvidenceOf(entry.snapshot);
    if (!evidence2) continue;
    if (isTopEntry) topEvidence ??= evidence2;
    else frameEvidence.push(frameEvidenceInTopFrameTerms(evidence2, entry.snapshot, topSnapshot, entry.frameId));
  }
  const mergedElements = collectedElements.slice(0, MAX_MERGED_ELEMENTS);
  const merged = {
    ...topSnapshot,
    interactiveElements: mergedElements
  };
  const evidence = mergePageEvidence(
    topEvidence ? [topEvidence, ...frameEvidence] : frameEvidence,
    topEvidence ?? pageEvidenceOf(topSnapshot),
    collectedElements.length - mergedElements.length
  );
  if (evidence) merged.evidence = evidence;
  return merged;
}
function pageEvidenceOf(snapshot) {
  const evidence = snapshot.evidence;
  return objectValue4(evidence) ? evidence : void 0;
}
function frameEvidenceInTopFrameTerms(evidence, frameSnapshot, topSnapshot, frameId) {
  const qualify = (selector) => `frame[${frameId}] >> ${selector}`;
  const place = (bounds) => frameBoundsOnTopDocument(bounds, frameSnapshot, topSnapshot, frameId);
  const { dialogs, overlays } = evidence;
  return present({
    elements: evidence.elements,
    loading: present({
      documentState: evidence.loading.documentState,
      busy: evidence.loading.busy,
      busyRegions: evidence.loading.busyRegions.map(qualify),
      indicators: evidence.loading.indicators.map((indicator) => present({ selector: qualify(indicator.selector), kind: indicator.kind, label: indicator.label })),
      pendingNavigation: evidence.loading.pendingNavigation
    }),
    navigation: evidence.navigation,
    dialogs: dialogs && present({
      open: dialogs.open.map((dialog) => present({
        selector: qualify(dialog.selector),
        role: dialog.role,
        modal: dialog.modal,
        native: dialog.native,
        label: dialog.label,
        bounds: place(dialog.bounds)
      })),
      modal: dialogs.modal,
      armPending: dialogs.armPending,
      lastNative: dialogs.lastNative
    }),
    overlays: overlays && present({
      tested: overlays.tested,
      blockedCount: overlays.blockedCount,
      blockers: overlays.blockers.map((blocker) => present({
        selector: qualify(blocker.selector),
        role: blocker.role,
        label: blocker.label,
        bounds: place(blocker.bounds),
        blocks: blocker.blocks,
        blocked: blocker.blocked.map(qualify)
      }))
    }),
    // Key order follows `content/evidence/regions.ts`, not the contract's declaration order, so the restated JSON stays byte-identical.
    regions: evidence.regions?.map((region) => present({ role: region.role, selector: qualify(region.selector), label: region.label, bounds: place(region.bounds) })),
    repeating: evidence.repeating?.map((structure) => present({
      containerSelector: qualify(structure.containerSelector),
      signature: structure.signature,
      itemCount: structure.itemCount,
      representative: present({
        selector: qualify(structure.representative.selector),
        testId: structure.representative.testId,
        text: structure.representative.text
      }),
      fields: structure.fields
    })),
    forms: evidence.forms?.map((form) => present({
      selector: qualify(form.selector),
      name: form.name,
      label: form.label,
      action: form.action,
      method: form.method,
      controlCount: form.controlCount,
      controls: form.controls.map((control) => present({
        selector: qualify(control.selector),
        controlType: control.controlType,
        name: control.name,
        label: control.label,
        required: control.required,
        disabled: control.disabled,
        hasValue: control.hasValue,
        autocomplete: control.autocomplete,
        sensitive: control.sensitive
      })),
      submit: form.submit ? qualify(form.submit) : void 0
    }))
  });
}
function frameBoundsOnTopDocument(bounds, frameSnapshot, topSnapshot, frameId) {
  if (!bounds) return void 0;
  const [placed] = translateFrameElements(
    { ...frameSnapshot, interactiveElements: [{ tagName: "div", selector: "", documentBounds: bounds }] },
    topSnapshot,
    frameId
  );
  return placed?.documentBounds;
}
function mergePageEvidence(contributions, base, droppedElements = 0) {
  if (!contributions.length) return base;
  const anchor = base ?? contributions[0];
  if (!anchor) return void 0;
  const regions = cappedList(contributions.flatMap((evidence) => evidence.regions ?? []), MAX_MERGED_REGIONS);
  const repeating = cappedList(contributions.flatMap((evidence) => evidence.repeating ?? []), MAX_MERGED_REPEATING);
  const forms = cappedList(contributions.flatMap((evidence) => evidence.forms ?? []), MAX_MERGED_FORMS);
  const dialogs = mergeDialogEvidence(contributions);
  const overlays = mergeOverlayEvidence(contributions);
  return present({
    elements: present({
      scanned: sumOf(contributions, (evidence) => evidence.elements.scanned),
      candidates: sumOf(contributions, (evidence) => evidence.elements.candidates),
      matched: sumOf(contributions, (evidence) => evidence.elements.matched),
      returned: Math.max(0, sumOf(contributions, (evidence) => evidence.elements.returned) - droppedElements),
      truncated: droppedElements > 0 || contributions.some((evidence) => evidence.elements.truncated),
      changed: sumOf(contributions, (evidence) => evidence.elements.changed),
      recentlyInteracted: sumOf(contributions, (evidence) => evidence.elements.recentlyInteracted)
    }),
    loading: present({
      documentState: anchor.loading.documentState,
      busy: contributions.some((evidence) => evidence.loading.busy),
      busyRegions: contributions.flatMap((evidence) => evidence.loading.busyRegions).slice(0, MAX_MERGED_BUSY_REGIONS),
      indicators: contributions.flatMap((evidence) => evidence.loading.indicators).slice(0, MAX_MERGED_LOADING_INDICATORS),
      pendingNavigation: contributions.some((evidence) => evidence.loading.pendingNavigation)
    }),
    navigation: anchor.navigation,
    dialogs,
    overlays,
    regions,
    repeating,
    forms
  });
}
function mergeDialogEvidence(contributions) {
  const reported = contributions.flatMap((evidence) => evidence.dialogs ? [evidence.dialogs] : []);
  if (!reported.length) return void 0;
  const native = reported.flatMap((dialogs) => dialogs.lastNative ? [dialogs.lastNative] : []).sort((left, right) => right.at - left.at)[0];
  return present({
    open: reported.flatMap((dialogs) => dialogs.open).slice(0, MAX_MERGED_DIALOGS),
    modal: reported.some((dialogs) => dialogs.modal),
    armPending: reported.some((dialogs) => dialogs.armPending) ? true : void 0,
    lastNative: native
  });
}
function mergeOverlayEvidence(contributions) {
  const reported = contributions.flatMap((evidence) => evidence.overlays ? [evidence.overlays] : []);
  if (!reported.length) return void 0;
  return present({
    tested: reported.reduce((total, overlays) => total + overlays.tested, 0),
    blockedCount: reported.reduce((total, overlays) => total + overlays.blockedCount, 0),
    // Most-blocking first, as within one frame. Array sort is stable, so frames
    // that block equally keep the order they answered in.
    blockers: reported.flatMap((overlays) => overlays.blockers).sort((left, right) => right.blocks - left.blocks).slice(0, MAX_MERGED_BLOCKERS)
  });
}
function sumOf(contributions, read) {
  return contributions.reduce((total, evidence) => total + read(evidence), 0);
}
function cappedList(items, cap) {
  return items.length ? items.slice(0, cap) : void 0;
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
  const extraction = recordedExtraction(payload);
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
    ...payload.tab ? { tab: payload.tab } : {},
    // Without this the domain sees an extraction event with no definition, and
    // `webAutomationRecordedExtraction` refuses it -- so the one recorded event
    // that maps to `web.dom.extract_list` would stay passive evidence and no
    // Flow would ever hold an extraction.
    ...extraction !== void 0 ? { extraction } : {},
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
    tab: payload.tab,
    extraction: extractionEvidence(payload),
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
    tab: payload.tab,
    // Passed whole because `createWebAutomationRecordingEvent` rebuilds it field
    // by field through `webAutomationRecordedExtraction`, which is where the
    // "no sample value, no unknown key" rule (D3) is enforced once.
    extraction: recordedExtraction(payload),
    metadata: inputId === void 0 ? payload.metadata : { ...payload.metadata ?? {}, inputId, ...visualTarget ? { visualTarget } : {} }
  }, {
    ...recordingId !== void 0 ? { recordingId } : {},
    ...tabId !== void 0 ? { tabId } : {},
    ...frameId !== void 0 ? { frameId } : {}
  });
}
function elementTarget(element) {
  const secret = isSensitiveElementDescriptor(element);
  return present({
    selector: element.selector,
    tagName: element.tagName,
    xpath: element.xpath,
    id: element.id,
    classNames: element.classNames,
    visibleText: secret ? void 0 : element.visibleText,
    text: secret ? void 0 : element.text,
    value: secret ? void 0 : element.value,
    role: element.role,
    name: element.name,
    href: element.href,
    inputType: element.inputType,
    checked: secret ? void 0 : element.checked,
    bounds: element.bounds,
    documentBounds: element.documentBounds,
    isVisibleOnViewport: element.isVisibleOnViewport,
    hasClickHandler: element.hasClickHandler,
    attributes: element.attributes,
    testId: element.testId,
    accessibleName: secret ? void 0 : element.accessibleName,
    label: element.label,
    implicitRole: element.implicitRole,
    context: element.context
  });
}
function recordedExtraction(payload) {
  return objectValue4(payload.extraction);
}
function extractionEvidence(payload) {
  const extraction = recordedExtraction(payload);
  if (extraction === void 0) return void 0;
  const form = extraction.form === "list" || extraction.form === "value" ? extraction.form : void 0;
  if (form === void 0) return void 0;
  const fields = objectValue4(objectValue4(extraction.request)?.fields);
  return compactObject2({
    form,
    fieldCount: fields === void 0 ? void 0 : Object.keys(fields).length,
    itemCount: typeof extraction.itemCount === "number" ? extraction.itemCount : void 0
  });
}
function visualTargetFromPayload(payload) {
  return payload.visualTarget ?? (payload.element ? webAutomationActionVisualTargetFromElement(payload.element) : void 0);
}

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
    client.on("execute_action", ({ message }) => {
      const action = browserActionFromGatewayCommand(message.payload);
      if (isWebAutomationActionRejection(action)) {
        void this.send("client.action_result", gatewayActionResultFromRejection(action)).catch((error) => {
          this.deps.reportError(error instanceof Error ? error.message : "Could not report a rejected action.");
        });
        return;
      }
      handlers.onCommand({ command: "execute_action", action }, message.id);
    });
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
var DROP = { kind: "drop" };
var NAVIGATION = { kind: "navigation" };
function withinExplanatoryWindow(openedAt, timestamp) {
  return timestamp - openedAt >= 0 && timestamp - openedAt < EXPLANATORY_ACTION_WINDOW_MS;
}
var NavigationRecorder = class {
  pending = /* @__PURE__ */ new Map();
  running = /* @__PURE__ */ new Map();
  failures = [];
  generation = 0;
  lastRecorded = /* @__PURE__ */ new Map();
  initialUrls = /* @__PURE__ */ new Map();
  explanatoryActions = /* @__PURE__ */ new Map();
  // Opens the window in which a navigation is this action's consequence. A
  // submit extends it and keeps the click it follows, because a submit button
  // fires `click` and then `submit` and the click is the candidate; a click
  // that is itself outside the submit's window explained nothing.
  noteExplanatoryAction(tabId, timestamp, explainer) {
    const previous = this.explanatoryActions.get(tabId);
    const click = explainer.kind === "click" ? explainer.recorded : previous !== void 0 && withinExplanatoryWindow(previous.timestamp, timestamp) ? previous.click : void 0;
    this.explanatoryActions.set(tabId, { timestamp, click });
  }
  // Collapses the burst of URL, title, and status updates a single load emits
  // into one deferred call. A client redirect's second commit replaces the
  // first, so what is recorded is where the page settled.
  schedule(tabId, url, record2) {
    const existing = this.pending.get(tabId);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      const pending = this.pending.get(tabId);
      if (pending?.timer !== timer) return;
      this.pending.delete(tabId);
      this.run(pending.record, pending.generation);
    }, NAVIGATION_DEBOUNCE_MS);
    this.pending.set(tabId, { url, timer, record: record2, generation: this.generation });
  }
  // Stop drains the debounce queue immediately and waits for sends whose
  // callbacks have already begun. Keep draining until no work remains, since
  // settling one callback may synchronously expose another navigation.
  async flush() {
    const generation = this.generation;
    do {
      const pending = [...this.pending.values()].filter((item) => item.generation === generation);
      this.pending.clear();
      for (const item of pending) {
        clearTimeout(item.timer);
        this.run(item.record, generation);
      }
      const running = [...this.running].filter(([, itemGeneration]) => itemGeneration === generation).map(([promise]) => promise);
      if (running.length > 0) await Promise.all(running);
    } while ([...this.pending.values()].some((item) => item.generation === generation) || [...this.running.values()].some((itemGeneration) => itemGeneration === generation));
    const failure = this.failures.find((item) => item.generation === generation);
    for (let index = this.failures.length - 1; index >= 0; index -= 1) {
      if (this.failures[index]?.generation === generation) this.failures.splice(index, 1);
    }
    if (failure !== void 0) throw failure.error;
  }
  run(record2, generation) {
    let result;
    try {
      result = record2();
    } catch (error) {
      if (generation === this.generation) this.failures.push({ error, generation });
      return;
    }
    let running;
    running = Promise.resolve(result).then(() => void 0).catch((error) => {
      if (generation === this.generation) this.failures.push({ error, generation });
    }).finally(() => {
      this.running.delete(running);
    });
    this.running.set(running, generation);
  }
  // Decides what a debounced navigation becomes, and claims a navigation in its
  // own right so a repeat of the same URL is not recorded twice. A landing
  // claims nothing: it is evidence about a click, not the tab's own navigation.
  shouldRecord(tabId, url, timestamp, origin, recordingStartedAt) {
    if (recordingStartedAt !== void 0 && timestamp <= recordingStartedAt) return DROP;
    const initialUrl = this.initialUrls.get(tabId);
    if (initialUrl === url && recordingStartedAt !== void 0 && Date.now() - recordingStartedAt < INITIAL_NAVIGATION_GRACE_MS) {
      this.initialUrls.delete(tabId);
      return DROP;
    }
    const action = this.explanatoryActions.get(tabId);
    const explanation = action !== void 0 && withinExplanatoryWindow(action.timestamp, timestamp) ? action : void 0;
    if (origin === "page") {
      return explanation?.click === void 0 ? DROP : { kind: "explained", click: explanation.click };
    }
    if (origin !== "typed" && explanation !== void 0) return DROP;
    const previous = this.lastRecorded.get(tabId);
    if (previous?.url === url) return DROP;
    this.lastRecorded.set(tabId, { url, timestamp });
    return NAVIGATION;
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
  // A new recording starts from nothing. A click from the last one must not
  // explain, or be named by, a navigation in this one.
  clearRecordingTabs() {
    this.generation += 1;
    for (const item of this.pending.values()) clearTimeout(item.timer);
    this.pending.clear();
    this.failures.length = 0;
    this.lastRecorded.clear();
    this.initialUrls.clear();
    this.explanatoryActions.clear();
  }
};

// src/background/connection/scripted-navigation/intent.ts
var INTENT_LIFETIME_MS = 3e4;
var REDIRECT_DEBOUNCE_MS = 250;
var MAX_URL_LENGTH = 2048;
var MAX_PATHNAME_LENGTH = 1024;
function safeDestination(value, requireBare = true) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_URL_LENGTH) return void 0;
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) return void 0;
    if (!["127.0.0.1", "[::1]", "localhost"].includes(parsed.hostname)) return void 0;
    if (parsed.username || parsed.password || requireBare && (parsed.search || parsed.hash)) return void 0;
    if (parsed.pathname.length > MAX_PATHNAME_LENGTH) return void 0;
    return { url: parsed.href, origin: parsed.origin, pathname: parsed.pathname };
  } catch {
    return void 0;
  }
}
var ScriptedNavigationIntent = class {
  constructor(deps) {
    this.deps = deps;
    this.createId = deps.createId ?? (() => crypto.randomUUID());
    this.now = deps.now ?? Date.now;
    this.setTimer = deps.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.clearTimer = deps.clearTimer ?? ((timer) => clearTimeout(timer));
  }
  byId = /* @__PURE__ */ new Map();
  byTab = /* @__PURE__ */ new Map();
  createId;
  now;
  setTimer;
  clearTimer;
  arm(url) {
    const destination = safeDestination(url);
    if (!destination) return { ok: false, code: "invalid_request" };
    if (this.deps.recordingState() !== "recording") return { ok: false, code: "not_recording" };
    const tabId = this.deps.activeTabId();
    if (tabId === void 0 || !Number.isSafeInteger(tabId) || tabId < 0) return { ok: false, code: "no_automation_tab" };
    if (this.byTab.has(tabId)) return { ok: false, code: "busy" };
    const id = this.createId();
    let resolve = () => void 0;
    const completion = new Promise((done) => {
      resolve = done;
    });
    const intent = { id, tabId, ...destination, completion, resolve, deadlineAt: this.now() + INTENT_LIFETIME_MS, state: "armed", expiryTimer: void 0, debounceTimer: void 0, retentionTimer: void 0 };
    intent.expiryTimer = this.setTimer(() => this.finish(intent, { ok: false, code: "expired" }), INTENT_LIFETIME_MS);
    this.byId.set(id, intent);
    this.byTab.set(tabId, id);
    return { ok: true, intentId: id };
  }
  async await(intentId) {
    if (typeof intentId !== "string" || intentId.length === 0 || intentId.length > 128) {
      return { ok: false, code: "unknown_intent" };
    }
    const intent = this.byId.get(intentId);
    if (!intent) return { ok: false, code: "unknown_intent" };
    const result = await intent.completion;
    this.remove(intent);
    return result;
  }
  cancel(intentId) {
    if (typeof intentId !== "string") return false;
    const intent = this.byId.get(intentId);
    if (!intent || intent.state === "terminal") return false;
    this.finish(intent, { ok: false, code: "cancelled" });
    return true;
  }
  cancelTab(tabId) {
    const intent = this.intentForTab(tabId);
    if (intent) this.finish(intent, { ok: false, code: "tab_closed" });
  }
  cancelAll(code) {
    for (const intent of [...this.byId.values()]) {
      if (intent.state !== "terminal") this.finish(intent, { ok: false, code });
    }
  }
  claimCommit(details) {
    if (details.frameId !== 0) return false;
    const intent = this.intentForTab(details.tabId);
    if (!intent) return false;
    if (intent.state === "armed") {
      this.clearTimer(intent.debounceTimer);
      intent.debounceTimer = this.setTimer(() => {
        intent.debounceTimer = void 0;
        void this.settleCommit(intent.id, details.url, details.timeStamp);
      }, REDIRECT_DEBOUNCE_MS);
    }
    return true;
  }
  async settleCommit(intentId, committedUrl, timestamp) {
    const intent = this.byId.get(intentId);
    if (!intent || intent.state !== "armed") return;
    const committed = safeDestination(committedUrl, false);
    if (!committed || committed.origin !== intent.origin || committed.pathname !== intent.pathname) {
      this.finish(intent, { ok: false, code: "destination_mismatch" });
      return;
    }
    intent.state = "sending";
    try {
      await this.deps.recordNavigation(intent.tabId, intent.url, timestamp);
      this.finish(intent, { ok: true, intentId: intent.id });
    } catch {
      this.finish(intent, { ok: false, code: "send_failed" });
    }
  }
  intentForTab(tabId) {
    const id = this.byTab.get(tabId);
    return id === void 0 ? void 0 : this.byId.get(id);
  }
  finish(intent, result) {
    if (intent.state === "terminal") return;
    intent.state = "terminal";
    intent.result = result;
    if (this.byTab.get(intent.tabId) === intent.id) this.byTab.delete(intent.tabId);
    this.clearTimer(intent.expiryTimer);
    this.clearTimer(intent.debounceTimer);
    intent.expiryTimer = void 0;
    intent.debounceTimer = void 0;
    intent.resolve(result);
    const remaining = intent.deadlineAt - this.now();
    if (remaining > 0) intent.retentionTimer = this.setTimer(() => this.remove(intent), remaining);
    else this.remove(intent);
  }
  remove(intent) {
    if (this.byId.get(intent.id) !== intent) return;
    this.byId.delete(intent.id);
    if (this.byTab.get(intent.tabId) === intent.id) this.byTab.delete(intent.tabId);
    this.clearTimer(intent.expiryTimer);
    this.clearTimer(intent.debounceTimer);
    this.clearTimer(intent.retentionTimer);
    intent.expiryTimer = void 0;
    intent.debounceTimer = void 0;
    intent.retentionTimer = void 0;
  }
};

// src/background/connection/pointer-click-filter.ts
function frameKey(tabId, frameId) {
  return `${tabId ?? "tab"}|${frameId ?? "frame"}`;
}
var PointerClickFilter = class {
  presses = /* @__PURE__ */ new Map();
  notePress(tabId, frameId, signature, sequence) {
    this.presses.set(frameKey(tabId, frameId), { signature, sequence });
  }
  // Whether a click is the one its frame's press produced, and so is already
  // recorded as that press.
  isClickOfPress(tabId, frameId, signature, sequence) {
    const key = frameKey(tabId, frameId);
    const press = this.presses.get(key);
    this.presses.delete(key);
    return press !== void 0 && signature !== void 0 && press.signature === signature && sequence > press.sequence;
  }
  clear() {
    this.presses.clear();
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

// src/background/connection/recorded-event-intake.ts
var EXPLAINED_TRANSITION = "explained";
function isExplainedNavigation(payload) {
  return payload.kind === "browser.navigation" && payload.metadata?.transition === EXPLAINED_TRANSITION;
}
function recordedClick(payload, tabId, frameId, recordingId) {
  const eventId = gatewayRecordingEventFromPayload(payload, tabId, frameId, recordingId).eventId;
  return eventId === void 0 ? void 0 : { sequence: payload.sequence, eventId };
}
function landingLocation(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin === "null" ? void 0 : `${parsed.origin}${parsed.pathname}`;
  } catch {
    return void 0;
  }
}
var RecordedEventIntake = class {
  constructor(deps) {
    this.deps = deps;
  }
  async accept(payload, tabId, frameId, admittedNavigation = false) {
    if (!admittedNavigation && !this.deps.recording.acceptsEvents()) return;
    if (payload.kind === "dom.click") {
      const sourceEvent = stringValue6(objectValue4(payload.metadata)?.sourceEvent);
      const signature = clickEventSignature(payload, tabId, frameId);
      if (sourceEvent === "pointerdown") this.deps.clicks.notePress(tabId, frameId, signature, payload.sequence);
      if (sourceEvent === "click" && this.deps.clicks.isClickOfPress(tabId, frameId, signature, payload.sequence)) return;
    }
    await this.processEvent(payload, tabId, frameId);
  }
  async acceptContentReady(payload, tabId, frameId) {
    let readyPayload = payload;
    if (this.deps.recording.acceptsEvents() && tabId !== void 0 && !this.deps.page.unsupported()) {
      await this.deps.attachment.setRecordingState(tabId, true, frameId).catch(() => void 0);
      if (!payload.snapshot) {
        const snapshot = await this.deps.sendToTab(tabId, { type: "captureSnapshot" }, frameId).then((value) => isDomSnapshotPayload(value) ? value : void 0).catch(() => void 0);
        if (snapshot) readyPayload = { ...payload, snapshot };
      }
    }
    await this.deps.recordEvent(readyPayload, tabId, frameId);
  }
  noteNavigationCommitted(details) {
    if (details.frameId !== 0) return;
    if (this.deps.scriptedNavigation.claimCommit(details)) return;
    if (details.transitionType === "reload") return;
    const origin = details.transitionType === "link" || details.transitionType === "form_submit" ? "page" : details.transitionType === "typed" ? "typed" : "other";
    this.scheduleNavigation(details.tabId, details.url, details.timeStamp, origin);
  }
  async recordScriptedNavigation(tabId, url, timestamp) {
    this.deps.navigation.noteRecordedTab(tabId, url, timestamp);
    await this.deps.recordEvent({
      kind: "browser.navigation",
      sequence: this.deps.sequence.next(),
      url,
      title: "",
      eventTimestampMs: timestamp,
      metadata: { transition: "typed" }
    }, tabId);
  }
  noteHistoryStateUpdated(details) {
    this.scheduleNavigation(details.tabId, details.url, details.timeStamp, "other");
  }
  scheduleNavigation(tabId, url, timestamp, origin) {
    if (!this.deps.recording.acceptsEvents() || unsupportedPageForUrl(url)) return;
    this.deps.navigation.schedule(tabId, url, () => this.recordNavigation(tabId, url, timestamp, origin));
  }
  async recordNavigation(tabId, url, timestamp, origin) {
    const verdict = this.deps.navigation.shouldRecord(tabId, url, timestamp, origin, this.deps.recording.startedAt());
    if (verdict.kind === "drop") return;
    if (verdict.kind === "explained") {
      const location = landingLocation(url);
      if (location === void 0) return;
      await this.deps.recordEvent({
        kind: "browser.navigation",
        sequence: this.deps.sequence.next(),
        url: location,
        title: "",
        eventTimestampMs: timestamp,
        // `explainedBy` is the click's sequence, which restarts in every
        // document; `explainedByEventId` is the recording event id the click
        // was sent under, which names exactly one click in the recording.
        metadata: { transition: EXPLAINED_TRANSITION, explainedBy: verdict.click.sequence, explainedByEventId: verdict.click.eventId }
      }, tabId, void 0, true);
      return;
    }
    await this.deps.recordEvent({
      kind: "browser.navigation",
      sequence: this.deps.sequence.next(),
      url,
      title: "",
      eventTimestampMs: timestamp,
      metadata: origin === "typed" ? { transition: "typed" } : void 0
    }, tabId, void 0, true);
  }
  async processEvent(payload, tabId, frameId) {
    if (this.deps.recording.state() !== "recording") return;
    const executable = isExecutableRecordedAction(payload);
    if (tabId !== void 0 && isNavigationExplanation(payload)) {
      this.deps.navigation.noteExplanatoryAction(tabId, payload.eventTimestampMs, payload.kind === "dom.submit" ? { kind: "submit" } : { kind: "click", recorded: executable ? recordedClick(payload, tabId, frameId, this.deps.recording.recordingId()) : void 0 });
    }
    if (executable) {
      this.deps.recording.noteEvent();
      this.deps.onActivity(payload.kind, activityLabel(payload), activityDetail(payload));
      const captured = await this.deps.evidence.captureEventSnapshot(payload, tabId, frameId);
      const recorded = captured.snapshot === void 0 ? payload : { ...payload, snapshot: captured.snapshot };
      await this.deps.send("client.recording_event", gatewayRecordingEventFromPayload(recorded, tabId, frameId, this.deps.recording.recordingId()));
      await this.deps.evidence.sendRecordingEvidence(payload, tabId, frameId, captured);
      return;
    }
    if (payload.kind !== "content.ready") {
      this.deps.onActivity(payload.kind, `Evidence: ${activityLabel(payload)}`, activityDetail(payload));
    }
    if (isExplainedNavigation(payload)) {
      await this.deps.send("client.recording_event", gatewayRecordingEventFromPayload(payload, tabId, frameId, this.deps.recording.recordingId()));
    }
    await this.deps.evidence.sendRecordingEvidence(payload, tabId, frameId);
  }
};

// src/background/connection/recording-evidence.ts
var SCREENSHOT_SKIP_LOG_INTERVAL_MS = 2e3;
var RecordingEvidenceReporter = class {
  constructor(deps) {
    this.deps = deps;
  }
  lastScreenshotSkipAt;
  /**
   * The merged tab snapshot for a recorded event, for a caller that has to put
   * it on the event before sending it.
   *
   * `RecordedEventIntake` sends `client.recording_event` first and the evidence that
   * belongs with it a line later. Both want the same tab-wide snapshot -- the
   * event should describe the page, not the one frame the interaction happened
   * in, and the state projected beside it should describe the same instant --
   * so the merge runs here, once, and the result is handed to
   * `sendRecordingEvidence` rather than recomputed there. See
   * `CapturedEventSnapshot` for what a second merge would cost.
   */
  async captureEventSnapshot(payload, tabId, frameId) {
    if (this.deps.recordingState() !== "recording") return { snapshot: void 0 };
    return { snapshot: await this.captureDomSnapshotForEvidence(payload, tabId, frameId) };
  }
  // Each await is a chance for the recording to have stopped underneath us, so
  // the guard is repeated rather than checked once at the top.
  //
  // `captured` is the merged snapshot a caller already took for the recording
  // event. When it is given the tab is not read again -- including when it
  // holds no snapshot, because that is a capture that was tried and came back
  // empty, not one that has yet to happen.
  async sendRecordingEvidence(payload, tabId, frameId, captured) {
    if (this.deps.recordingState() !== "recording") return;
    const projectId = await this.deps.resolveProjectId("recording_evidence");
    if (this.deps.recordingState() !== "recording") return;
    const snapshot = captured ? captured.snapshot : await this.captureDomSnapshotForEvidence(payload, tabId, frameId);
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
    const stateTimestampMs = numberValue4(objectValue4(state)?.timestamp) ?? payload.eventTimestampMs;
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
      const metadata = objectValue4(state.metadata);
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

// src/background/connection/recordable-page-address.ts
function recordablePageAddress(url) {
  if (!url || unsupportedPageForUrl(url)) return void 0;
  try {
    const parsed = new URL(url);
    const path = parsed.origin === "null" ? void 0 : webAutomationUrlPath(parsed.pathname);
    return path === void 0 ? void 0 : { location: `${parsed.origin}${path}`, path };
  } catch {
    return void 0;
  }
}

// src/background/connection/runtime-status.ts
var RuntimeStatusTracker = class {
  status = { state: "idle" };
  // The `tab` request of the last action started, kept apart from the status
  // because `finish` replaces the status before the confirmation is built.
  startedTab;
  current() {
    return this.status;
  }
  // A result does not carry its command's tab operation, which decides the input
  // a tab confirmation names. Only the action this command started answers.
  tabRequestFor(commandId) {
    return this.startedTab?.commandId === commandId ? this.startedTab.tab : void 0;
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
    this.startedTab = { commandId: action.commandId, tab: action.tab };
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
  if (actionType === "web.dom.check") return "Set checked";
  if (actionType === "web.dom.assert") return "Assert";
  if (actionType === "web.dom.extract_list") return "Extract list";
  if (actionType === "web.dom.upload") return "Upload files";
  if (actionType === "web.dom.dialog") return "Answer dialog";
  if (actionType === "web.browser.tab") return "Browser tab";
  if (actionType === "web.browser.download") return "Await download";
  return actionType;
}
function runtimeResultTarget(result) {
  if (result.actionType === "web.browser.navigate") return result.url ?? result.title;
  return result.element?.name ?? result.element?.selector ?? result.element?.text;
}
function runtimeConfirmationForActionResult(result, tab) {
  if (result.status !== "succeeded") return void 0;
  if (result.actionType === "web.browser.navigate") return { kind: "browser.navigation", inputId: WEB_AUTOMATION_INPUT_IDS.navigationRequested };
  if (result.actionType === "web.dom.click") return { kind: "dom.click", inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked };
  if (result.actionType === "web.dom.type") return { kind: "dom.input", inputId: WEB_AUTOMATION_INPUT_IDS.textEntered, ...confirmedValue(result) };
  if (result.actionType === "web.dom.clear") return { kind: "dom.input", inputId: WEB_AUTOMATION_INPUT_IDS.fieldCleared, inputValue: "" };
  if (result.actionType === "web.dom.select") return { kind: "dom.change", inputId: WEB_AUTOMATION_INPUT_IDS.optionSelected, ...confirmedValue(result) };
  if (result.actionType === "web.dom.check") return { kind: "dom.change", inputId: WEB_AUTOMATION_INPUT_IDS.checkboxToggled };
  if (result.actionType === "web.dom.keypress") return { kind: "dom.keydown", inputId: WEB_AUTOMATION_INPUT_IDS.keyPressed };
  if (result.actionType === "web.dom.scroll") return { kind: "dom.scroll", inputId: WEB_AUTOMATION_INPUT_IDS.pageScrolled };
  if (result.actionType === "web.dom.upload") return { kind: "dom.change", inputId: WEB_AUTOMATION_INPUT_IDS.filesChosen };
  if (result.actionType === "web.browser.tab") return tabConfirmation(tab, result);
  return void 0;
}
function tabConfirmation(tab, result) {
  if (tab?.operation === "switch") {
    const urlPath = recordablePageAddress(result.url)?.path;
    return { kind: "browser.tab", inputId: WEB_AUTOMATION_INPUT_IDS.tabSwitched, tab: { operation: "switch", ...urlPath !== void 0 ? { urlPath } : {} } };
  }
  if (tab?.operation === "close") return { kind: "browser.tab", inputId: WEB_AUTOMATION_INPUT_IDS.tabClosed, tab: { operation: "close" } };
  return void 0;
}
function confirmedValue(result) {
  const element = result.element;
  if (!element || element.value === void 0 || isSensitiveElementDescriptor2(element)) return {};
  return { inputValue: element.value };
}
function isSensitiveElementDescriptor2(element) {
  return isSensitiveFieldSignature({
    inputType: element.inputType,
    autocomplete: element.attributes?.autocomplete,
    dataSensitive: element.attributes?.["data-sensitive"]
  });
}
function runtimeActionTarget(action) {
  return action.url ?? action.selector ?? action.text ?? action.value ?? action.key ?? action.visualTarget?.selector;
}

// src/background/connection/server-command-channel.ts
var ServerCommandChannel = class {
  constructor(deps) {
    this.deps = deps;
  }
  async handleMessage(message) {
    this.deps.gateway.noteMessageReceived();
    if (message.type === "server.ping") {
      this.deps.gateway.noteMessageReceived();
      this.deps.emitStatus();
      return;
    }
    if (message.type === "server.error") {
      this.deps.setLastError(message.payload.message);
      const refusal = classifyRecordingStartRefusal(message.payload);
      if (refusal) {
        this.deps.recording.noteStartRefusal(refusal);
        return;
      }
      this.deps.gateway.markFailed();
      return;
    }
    if (message.type === "server.set_active_tab") {
      await this.handleCommand({ ...message.payload, command: "set_active_tab" }, message.id);
      return;
    }
    if (message.type === "server.disconnect") {
      this.deps.disconnect();
    }
  }
  async handleSessionReady(message) {
    await this.deps.persistSession(compactObject2({
      ...this.deps.session(),
      sessionId: message.payload.sessionId,
      token: message.payload.token,
      ...message.payload.projectId !== void 0 ? { projectId: message.payload.projectId } : {},
      serverUrl: this.deps.settings().gatewayUrl,
      connectedAt: Date.now()
    }));
    this.deps.gateway.markSessionReady();
    this.deps.onActivity("connection", "Connected to FluxIQ", "Client session ready", "success");
    await this.deps.page.sendBrowserState();
    await this.deps.gateway.flushQueue();
  }
  async handleCommand(payload, messageId) {
    if (payload.command === "ping") {
      this.deps.gateway.noteMessageReceived();
      this.deps.emitStatus();
      return;
    }
    if (payload.command === "disconnect") {
      this.deps.disconnect();
      return;
    }
    if (payload.command === "start_recording") {
      await this.deps.recording.beginAccepted(payload.recordingId, payload.projectId);
      return;
    }
    if (payload.command === "stop_recording") {
      await this.deps.stopRecording(false);
      return;
    }
    if (payload.command === "set_active_tab") {
      const tabId = Number(payload.tabId);
      this.deps.page.setTabId(tabId);
      await chrome.tabs.update(tabId, { active: true });
      this.deps.emitStatus();
      return;
    }
    if (payload.command === "capture_snapshot") {
      this.startStatus({
        commandId: messageId,
        actionType: "web.dom.capture_snapshot",
        label: "Capture snapshot",
        target: this.deps.page.url()
      });
      await this.runtimeRouter().captureSnapshot();
      this.finishStatus({
        commandId: messageId,
        actionType: "web.dom.capture_snapshot",
        status: "succeeded",
        // Capturing evidence has no post-condition of its own to check.
        validation: { status: "none", reason: "evidence-only" },
        message: "Snapshot command dispatched.",
        startedAt: this.deps.runtimeStatus.current().startedAt ?? Date.now(),
        finishedAt: Date.now()
      });
      return;
    }
    if (payload.command === "execute_action") {
      this.applyStart(this.deps.runtimeStatus.startAction(payload.action));
      await this.deps.captureActionBoundary("before", payload.action);
      await this.deps.page.refresh();
      await this.runtimeRouter().executeAction(payload.action);
    }
  }
  runtimeRouter() {
    return new ExtensionRuntimeCommandRouter({
      activeTabId: () => this.deps.page.tabId(),
      unsupportedPageReason: () => this.deps.page.unsupported()?.reason,
      attachTabForRecording: (tabId) => this.deps.attachment.attachTabForRecording(tabId),
      captureActiveSnapshot: (label) => this.deps.evidence.captureActiveSnapshot(label),
      sendActionResult: (result, tabId, frameId) => this.sendActionResult(result, tabId, frameId)
    });
  }
  async sendActionResult(result, tabId, frameId) {
    this.finishStatus({
      ...result,
      ...tabId !== void 0 ? { tabId } : {},
      ...frameId !== void 0 ? { frameId } : {}
    });
    await this.deps.captureActionBoundary("after", result);
    const visualTarget = result.visualTarget ?? (result.element ? webAutomationActionVisualTargetFromElement(result.element) : void 0);
    await this.deps.send("client.action_result", gatewayActionResultFromBrowserResult(result));
    await this.sendRuntimeConfirmation(result, tabId, frameId);
    await this.deps.recordEvent(compactObject2({
      kind: "action.result",
      sequence: this.deps.sequence.next(),
      url: result.url ?? this.deps.page.url() ?? "",
      title: result.title ?? "",
      eventTimestampMs: result.finishedAt,
      element: result.element,
      visualTarget,
      snapshot: result.snapshot,
      actionResult: result
    }), tabId, frameId);
  }
  // A succeeded runtime action is also something the recording must contain:
  // it is replayed as the recorded event a user would have produced. An action
  // that did not succeed gets no confirmation, which
  // `runtimeConfirmationForActionResult` decides. A tab confirmation's input
  // depends on the command's operation, which the result does not carry, so the
  // tracker hands back the request the action started with.
  async sendRuntimeConfirmation(result, tabId, frameId) {
    const confirmation = runtimeConfirmationForActionResult(result, this.deps.runtimeStatus.tabRequestFor(result.commandId));
    if (!confirmation) return;
    const event = createWebAutomationRecordingEvent({
      kind: confirmation.kind,
      sequence: this.deps.sequence.next(),
      url: result.url ?? this.deps.page.url() ?? "",
      title: result.title ?? "",
      eventTimestampMs: result.finishedAt,
      element: result.element,
      visualTarget: result.visualTarget,
      snapshot: result.snapshot,
      inputValue: confirmation.inputValue,
      key: confirmation.key,
      scroll: confirmation.scroll,
      tab: confirmation.tab,
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
    await this.deps.send("client.recording_event", event);
  }
  startStatus(status) {
    this.applyStart(this.deps.runtimeStatus.start(status));
  }
  applyStart(next) {
    this.deps.setLastError(void 0);
    this.deps.onActivity("runtime", `Runtime started: ${next.label ?? next.actionType ?? "Command"}`, next.target, "warning");
    this.deps.emitStatus();
  }
  finishStatus(result) {
    const failed = result.status !== "succeeded";
    const label = runtimeActionLabel(result.actionType);
    this.deps.runtimeStatus.finish(result);
    this.deps.page.noteActionResult(result.tabId, result.url);
    if (failed) this.deps.setLastError(result.message ?? `${label} failed.`);
    this.deps.onActivity(
      "runtime",
      failed ? `Runtime failed: ${label}` : `Runtime succeeded: ${label}`,
      result.message ?? runtimeResultTarget(result),
      failed ? "danger" : "success"
    );
    this.deps.emitStatus();
  }
};

// src/background/connection/tab-recorder.ts
var SWITCH_COMMIT_WAIT_MS = 1e4;
function isBlankPage(url) {
  return !url || url === "about:blank";
}
var TabRecorder = class {
  constructor(deps) {
    this.deps = deps;
  }
  joined;
  currentTabId;
  pending;
  locations = /* @__PURE__ */ new Map();
  async noteTabUpdate(tab, lastActive) {
    if (tab.id === void 0 || !this.join(lastActive)) return;
    const tabId = tab.id;
    const address = recordablePageAddress(tab.url);
    if (address !== void 0) this.locations.set(tabId, address.location);
    if (!tab.active) return;
    if (address === void 0) {
      if (isBlankPage(tab.url) && tabId !== this.currentTabId && this.pending?.tabId !== tabId) {
        this.pending = { tabId, since: Date.now(), byRuntime: this.deps.runtimeBusy() };
      }
      return;
    }
    const awaited = this.pending?.tabId === tabId ? this.pending : void 0;
    this.pending = void 0;
    if (tabId === this.currentTabId) return;
    const previousTabId = this.currentTabId;
    this.currentTabId = tabId;
    if (previousTabId === void 0) return;
    if (this.deps.runtimeBusy() || awaited?.byRuntime === true) return;
    if (awaited !== void 0 && Date.now() - awaited.since > SWITCH_COMMIT_WAIT_MS) return;
    await this.record(tabId, { operation: "switch", urlPath: address.path }, address.location, tab.title ?? "");
  }
  async noteTabRemoved(tabId, lastActive) {
    if (!this.join(lastActive)) return;
    if (this.pending?.tabId === tabId) this.pending = void 0;
    const location = this.locations.get(tabId);
    this.locations.delete(tabId);
    if (tabId !== this.currentTabId || this.deps.runtimeBusy()) return;
    await this.record(void 0, { operation: "close" }, location ?? "", "");
  }
  // State belongs to one recording. The first tab event of a new one starts it
  // from the page the extension already had in front.
  join(lastActive) {
    if (this.deps.recordingState() !== "recording") return false;
    const recordingId = this.deps.recordingId();
    if (recordingId === this.joined) return true;
    this.joined = recordingId;
    this.pending = void 0;
    this.locations.clear();
    this.currentTabId = lastActive?.tabId;
    const address = recordablePageAddress(lastActive?.url);
    if (lastActive !== void 0 && address !== void 0) this.locations.set(lastActive.tabId, address.location);
    return true;
  }
  async record(tabId, tab, location, title) {
    await this.deps.recordEvent({
      kind: "browser.tab",
      sequence: this.deps.sequence.next(),
      url: location,
      title,
      eventTimestampMs: Date.now(),
      tab
    }, tabId);
  }
};

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
var FluxIQConnection = class {
  // Construction order is dependency order: a collaborator handed to another as
  // an instance is built first. Anything reached through a closure is read when
  // it is called, never during construction, so it may be built later.
  constructor(settings, session) {
    this.settings = settings;
    this.session = session;
    const onActivity = (kind, label, detail, tone) => this.addActivity(kind, label, detail, tone);
    const emitStatus = () => this.emitStatus();
    const setLastError = (message) => {
      this.lastError = message;
    };
    const recordEvent = (...args) => this.handleRecordingEvent(...args);
    this.scriptedNavigation = new ScriptedNavigationIntent({
      recordingState: () => this.recording.state(),
      activeTabId: () => this.page.tabId(),
      recordNavigation: (tabId, url, timestamp) => this.intake.recordScriptedNavigation(tabId, url, timestamp)
    });
    this.gateway = new GatewaySession({
      settings: () => this.settings,
      session: () => this.session,
      persistSession: (session2) => this.persistSession(session2),
      emitStatus,
      reportError: (message) => {
        this.lastError = message;
      },
      clearError: () => {
        this.lastError = void 0;
      },
      beforeConnect: () => this.page.refresh(),
      queue: { queueEvent, readQueuedEvents, clearQueuedEvents },
      handlers: {
        onServerMessage: (message) => void this.commands.handleMessage(message),
        onPairingRequired: (referenceCode, reason) => {
          this.lastError = reason || "Approve this client in FluxIQ.";
          this.addActivity("pairing", "Waiting for approval", referenceCode ? `Reference ${referenceCode}` : void 0, "warning");
          this.emitStatus();
        },
        onSessionReady: (message) => void this.commands.handleSessionReady(message),
        onCommand: (payload, messageId) => void this.commands.handleCommand(payload, messageId),
        onHeartbeat: () => void this.page.sendBrowserState()
      }
    });
    this.projects = new ProjectContext({
      settings: () => this.settings,
      session: () => this.session,
      adoptProjectId: (projectId) => this.persistSession(compactObject2({ ...this.session, projectId })),
      onActivity
    });
    this.attachment = new ContentAttachment({
      sendToTab,
      ensureContentScript,
      settings: () => this.settings,
      isRecording: () => this.recording.state() === "recording",
      hasRecordedTab: (tabId) => this.navigation.hasRecordedTab(tabId),
      noteRecordedTab: (tabId, url, timestamp) => this.navigation.noteRecordedTab(tabId, url, timestamp)
    });
    this.evidence = new RecordingEvidenceReporter({
      send: this.gateway.send,
      recordingState: () => this.recording.state(),
      resolveProjectId: (reason) => this.projects.resolve(reason),
      onActivity,
      emitStatus,
      clientId: () => this.session.clientId,
      activeTabId: () => this.page.tabId(),
      activeTabUrl: () => this.page.url(),
      unsupportedPage: () => this.page.unsupported(),
      setUnsupportedPage: (state) => this.page.setUnsupported(state),
      transport: this.transport,
      ensureContentScript,
      attachTabForRecording: (tabId) => this.attachment.attachTabForRecording(tabId),
      activeTab,
      allTabs,
      stateAssets: new StateAssetStore({
        credentials: () => this.coreApiCredentials(),
        onActivity
      }),
      screenshotDiagnostics: () => ({
        sessionId: this.session.sessionId,
        clientId: this.session.clientId,
        projectId: this.session.projectId,
        activeRecordingProjectId: this.projects.activeRecordingProject(),
        activeTabId: this.page.tabId(),
        coreApiUrl: this.settings.coreApiUrl
      })
    });
    this.tabs = new TabRecorder({
      recordingState: () => this.recording.state(),
      recordingId: () => this.recording.recordingId(),
      runtimeBusy: () => this.runtimeStatus.current().state === "running",
      sequence: this.sequence,
      recordEvent
    });
    this.page = new ActivePage({
      send: this.gateway.send,
      gatewayState: () => this.gateway.state(),
      clientId: () => this.session.clientId,
      recordingState: () => this.recording.state(),
      attachTabForRecording: (tabId) => this.attachment.attachTabForRecording(tabId),
      activeTab,
      allTabs,
      onActivity,
      emitStatus,
      updateTab: (tab) => this.handleTabUpdated(tab),
      noteTabChange: (tab, lastActive) => this.tabs.noteTabUpdate(tab, lastActive),
      noteTabRemoved: (tabId, lastActive) => this.tabs.noteTabRemoved(tabId, lastActive)
    });
    this.recording = new ActiveRecording({
      send: this.gateway.send,
      gatewayState: () => this.gateway.state(),
      session: () => this.session,
      settings: () => this.settings,
      persistSession: (session2) => this.persistSession(session2),
      page: this.page,
      projects: this.projects,
      evidence: this.evidence,
      attachment: this.attachment,
      navigation: this.navigation,
      scriptedNavigation: this.scriptedNavigation,
      clicks: this.clicks,
      sequence: this.sequence,
      activityLog: this.activityLog,
      allTabs,
      recordEvent,
      onActivity,
      emitStatus,
      lastError: () => this.lastError,
      setLastError
    });
    this.intake = new RecordedEventIntake({
      send: this.gateway.send,
      recording: this.recording,
      page: this.page,
      navigation: this.navigation,
      scriptedNavigation: this.scriptedNavigation,
      clicks: this.clicks,
      sequence: this.sequence,
      evidence: this.evidence,
      attachment: this.attachment,
      sendToTab,
      onActivity,
      recordEvent
    });
    this.commands = new ServerCommandChannel({
      send: this.gateway.send,
      gateway: this.gateway,
      recording: this.recording,
      page: this.page,
      runtimeStatus: this.runtimeStatus,
      attachment: this.attachment,
      evidence: this.evidence,
      sequence: this.sequence,
      session: () => this.session,
      settings: () => this.settings,
      persistSession: (session2) => this.persistSession(session2),
      captureActionBoundary,
      setLastError,
      onActivity,
      emitStatus,
      recordEvent,
      stopRecording: (notifyServer) => this.stopRecording(notifyServer),
      disconnect: () => this.disconnect()
    });
  }
  lastError;
  listeners = /* @__PURE__ */ new Set();
  activityLog = new ActivityLog();
  sequence = new EventSequence();
  runtimeStatus = new RuntimeStatusTracker();
  navigation = new NavigationRecorder();
  scriptedNavigation;
  clicks = new PointerClickFilter();
  transport = { sendToTab, allTabFrames };
  gateway;
  projects;
  attachment;
  evidence;
  tabs;
  page;
  recording;
  intake;
  commands;
  status() {
    const gateway = this.gateway.statusFields();
    const status = {
      connectionState: gateway.connectionState,
      recordingState: this.recording.state(),
      gatewayUrl: this.settings.gatewayUrl,
      settings: this.settings,
      clientId: this.session.clientId,
      queueSize: gateway.queueSize,
      eventCount: this.recording.eventCount(),
      recentActivities: this.activityLog.recentEntries(),
      runtime: { ...this.runtimeStatus.current() }
    };
    const lastActivityAt = this.activityLog.lastActivityAt();
    const activeTabId = this.page.tabId();
    const activeTabUrl = this.page.url();
    const recordingStartedAt = this.recording.startedAt();
    const unsupportedPage = this.page.unsupported();
    const recordingBlock = this.recording.block();
    if (this.session.sessionId) status.sessionId = this.session.sessionId;
    if (this.session.projectId !== void 0) status.projectId = this.session.projectId;
    if (activeTabId !== void 0) status.activeTabId = activeTabId;
    if (activeTabUrl) status.activeTabUrl = activeTabUrl;
    if (gateway.pairingReferenceCode) status.pairingReferenceCode = gateway.pairingReferenceCode;
    if (recordingStartedAt !== void 0) status.recordingStartedAt = recordingStartedAt;
    if (lastActivityAt !== void 0) status.lastActivityAt = lastActivityAt;
    if (unsupportedPage) status.unsupportedPage = unsupportedPage;
    if (recordingBlock) status.recordingBlock = recordingBlock;
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
    this.scriptedNavigation.cancelAll("cancelled");
    this.gateway.stopReconnecting();
    this.recording.cancelStart();
    this.gateway.closeClient();
    if (this.recording.state() === "recording") this.addActivity("connection", "Disconnected during recording", "Events will queue until reconnect.", "warning");
    this.gateway.markDisconnected();
  }
  startRecording() {
    return this.recording.start();
  }
  stopRecording(notifyServer = true) {
    return this.recording.stop(notifyServer);
  }
  dismissRecordingBlock() {
    this.recording.dismissBlock();
  }
  handleRecordingEvent(payload, tabId, frameId, admittedNavigation = false) {
    return this.intake.accept(payload, tabId, frameId, admittedNavigation);
  }
  handleContentReady(payload, tabId, frameId) {
    return this.intake.acceptContentReady(payload, tabId, frameId);
  }
  handleTabUpdated(tab) {
    return this.page.handleTabUpdate(tab);
  }
  handleTabRemoved(tabId) {
    this.scriptedNavigation.cancelTab(tabId);
    return this.page.handleTabRemoved(tabId);
  }
  armScriptedNavigation(url) {
    return this.scriptedNavigation.arm(url);
  }
  awaitScriptedNavigation(intentId) {
    return this.scriptedNavigation.await(intentId);
  }
  cancelScriptedNavigation(intentId) {
    return this.scriptedNavigation.cancel(intentId);
  }
  selectAutomationTab(tabId) {
    return this.page.select(tabId);
  }
  handleNavigationCommitted(details) {
    this.intake.noteNavigationCommitted(details);
  }
  handleHistoryStateUpdated(details) {
    this.intake.noteHistoryStateUpdated(details);
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
};

// src/background/control-page.ts
var CONTROL_PAGES = ["sidepanel/index.html", "popup/index.html"];
function isControlPage(sender) {
  if (sender.id !== chrome.runtime.id || typeof sender.url !== "string") return false;
  return CONTROL_PAGES.some((page) => sender.url === chrome.runtime.getURL(page));
}

// src/background/scripted-navigation-control.ts
async function handleScriptedNavigationControl(message, sender, manager) {
  const arm = message.type === RUNTIME_MESSAGES.testArmScriptedNavigation;
  const awaitIntent = message.type === RUNTIME_MESSAGES.testAwaitScriptedNavigation;
  const cancel = message.type === RUNTIME_MESSAGES.testCancelScriptedNavigation;
  if (!arm && !awaitIntent && !cancel) return { handled: false };
  if (!isControlPage(sender)) {
    return cancel ? { handled: true, response: { ok: true, cancelled: false } } : { handled: true, response: { ok: false, code: "forbidden" } };
  }
  if (arm) return { handled: true, response: manager.armScriptedNavigation(message.url) };
  if (awaitIntent) return { handled: true, response: await manager.awaitScriptedNavigation(message.intentId) };
  return { handled: true, response: { ok: true, cancelled: manager.cancelScriptedNavigation(message.intentId) } };
}

// src/shared/extraction-messages.ts
var EXTRACTION_CONTENT_MESSAGES = {
  /** Begin picking: show the overlay and capture the next click. */
  pickStart: "extraction.pick_start",
  /** Stop picking and remove the overlay, with nothing chosen. */
  pickCancel: "extraction.pick_cancel",
  /** Read at most `limit` (≤ 20) rows for the confirmation preview. */
  preview: "extraction.preview",
  /** Put `data.extract` in the recording for the confirmed definition. */
  record: "extraction.record"
};
var EXTRACTION_PICKED_MESSAGE = "fluxiq.extractionPicked";
var EXTRACTION_PICK_CANCELLED_MESSAGE = "fluxiq.extractionPickCancelled";
var EXTRACTION_RUNTIME_MESSAGES = {
  start: "fluxiq.extractionStart",
  confirm: "fluxiq.extractionConfirm",
  cancel: "fluxiq.extractionCancel",
  getSession: "fluxiq.getExtractionSession",
  testDefineExtraction: "fluxiq.test.defineExtraction"
};
var EXTRACTION_PREVIEW_MAX_ROWS = 20;

// src/background/extraction/session-store.ts
var ExtractionSessions = class {
  sessions = /* @__PURE__ */ new Map();
  latestId;
  /** Begins a pick on `tabId`, replacing any session that tab already had. */
  start(sessionId, tabId, form) {
    this.clearTab(tabId);
    const session = { sessionId, tabId, form, state: "picking", preview: [] };
    this.sessions.set(sessionId, session);
    this.latestId = sessionId;
    return session;
  }
  /** The session named, or the most recently started one when the caller names none. */
  get(sessionId) {
    const id = sessionId ?? this.latestId;
    return id === void 0 ? void 0 : this.sessions.get(id);
  }
  /**
   * Records what a frame picked, or `undefined` when the pick belongs to no
   * open session **of that tab**. A pick is the one message in this flow that
   * arrives from a content script, so the tab it came from is checked here
   * rather than trusted: another tab's script must not be able to fill a
   * session the user opened against the automation tab.
   */
  picked(sessionId, tabId, proposal) {
    const session = this.sessions.get(sessionId);
    if (!session || session.tabId !== tabId || session.state !== "picking") return void 0;
    session.proposal = proposal;
    session.state = "picked";
    session.refused = void 0;
    session.preview = [];
    session.previewKey = void 0;
    return session;
  }
  /**
   * There is nothing to confirm from what the user clicked. The session stays
   * open and stays `picking`, and the panel reads `refused` and says why.
   *
   * The overlay is *not* still up: the frame closes it on every pick, refused
   * or not, and forgets its own session when the press finishes. `control.ts`
   * therefore re-arms the pick after calling this, which is what makes "the
   * next click is still the pick" true rather than merely intended.
   */
  refuse(sessionId, tabId, refusal) {
    const session = this.sessions.get(sessionId);
    if (!session || session.tabId !== tabId || session.state !== "picking") return void 0;
    session.refused = refusal;
    return session;
  }
  /**
   * The user pressed Escape in the page. The frame has already taken its overlay
   * down and forgotten the pick, so the session goes with it and the panel finds
   * nothing to show.
   *
   * Only a session still `picking` is cancelled, and only from its own tab: a
   * press that had already taken a pick is not cancelled here, and the frame
   * does not send this for one either.
   */
  cancelled(sessionId, tabId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.tabId !== tabId || session.state !== "picking") return void 0;
    return this.clear(sessionId);
  }
  /** Holds at most `EXTRACTION_PREVIEW_MAX_ROWS` rows, under the columns `previewKey` names. */
  setPreview(sessionId, previewKey, rows) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.preview = rows.slice(0, EXTRACTION_PREVIEW_MAX_ROWS).map((row) => ({ ...row }));
    session.previewKey = previewKey;
  }
  /**
   * Drops the rows without putting any in their place: the page was asked to
   * read a different set of columns and would not.
   *
   * What is held was read under columns the caller has since said it no longer
   * wants -- the commonest reason being that the user just excluded one of them
   * -- so keeping it would be keeping values for a column that is out (D12). The
   * key goes too, so the next `getSession` asks again rather than treating a
   * failed read as the answer.
   */
  clearPreview(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.preview = [];
    session.previewKey = void 0;
  }
  /** The extraction is in the recording; the preview it was confirmed from is dropped. */
  markRecorded(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.state = "recorded";
    session.preview = [];
    session.previewKey = void 0;
  }
  clear(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) this.sessions.delete(sessionId);
    if (this.latestId === sessionId) this.latestId = void 0;
    return session;
  }
  /** Drops every session against `tabId`: the tab closed, or its top frame navigated away. */
  clearTab(tabId) {
    for (const [id, session] of this.sessions) {
      if (session.tabId === tabId) this.clear(id);
    }
  }
};

// src/background/extraction/definition.ts
function recordedListExtraction2(proposal, confirm, nonce) {
  const label = typeof confirm.label === "string" ? confirm.label.trim() : "";
  const columns = buildColumns(proposal, confirm.fields);
  if (label.length === 0 || columns === void 0) return void 0;
  const request = {
    item: proposal.item,
    fields: columns.fields,
    ...confirm.paginate !== void 0 ? { paginate: confirm.paginate } : {},
    ...confirm.maxItems !== void 0 ? { maxItems: confirm.maxItems } : {}
  };
  const definition = {
    form: "list",
    datasetId: webAutomationDatasetId(label, nonce),
    label,
    request,
    fieldLabels: columns.labels,
    itemCount: typeof confirm.itemCount === "number" ? confirm.itemCount : proposal.itemCount
  };
  return runnableExtractListRequest(definition) === void 0 ? void 0 : definition;
}
function extractionPreviewRequest(proposal, columns) {
  const fields = {};
  for (const field of proposal.fields) {
    const handling = columns?.find((column) => column.key === field.key)?.handling ?? field.spec.handling;
    if (handling !== void 0 && handling !== "include") continue;
    fields[field.key] = fieldSpec(field.spec.kind, field.spec, "include");
  }
  const names = Object.keys(fields);
  if (names.length === 0) return void 0;
  return {
    request: { item: proposal.item, fields, maxItems: EXTRACTION_PREVIEW_MAX_ROWS, minItems: 0 },
    columnsKey: names.join(",")
  };
}
function runnableExtractListRequest(definition) {
  const action = webAutomationRecordedAction(WEB_AUTOMATION_EVENTS.dataExtractionDefined, { extraction: definition });
  if (action === void 0 || action.inputId !== WEB_AUTOMATION_INPUT_IDS.dataExtractionDefined) return void 0;
  const request = action.parameters.extractList;
  return request === void 0 ? void 0 : request;
}
function buildColumns(proposal, columns) {
  const chosen = columns ?? proposedColumns(proposal);
  if (chosen.length === 0) return void 0;
  const fields = {};
  const labels = {};
  for (const column of chosen) {
    const label = typeof column.label === "string" ? column.label.trim() : "";
    if (typeof column.key !== "string" || column.key.length === 0 || label.length === 0) return void 0;
    if (column.key in fields) return void 0;
    fields[column.key] = fieldSpec(column.kind, column, column.handling);
    labels[column.key] = label;
  }
  return { fields, labels };
}
function proposedColumns(proposal) {
  return proposal.fields.map((field) => ({
    key: field.key,
    label: field.label,
    kind: field.spec.kind,
    ...field.spec.selector !== void 0 ? { selector: field.spec.selector } : {},
    ...field.spec.attribute !== void 0 ? { attribute: field.spec.attribute } : {},
    ...field.spec.header !== void 0 ? { header: field.spec.header } : {},
    ...field.spec.required !== void 0 ? { required: field.spec.required } : {},
    handling: field.spec.handling ?? "include"
  }));
}
function fieldSpec(kind, source, handling) {
  return {
    kind,
    ...source.selector !== void 0 ? { selector: source.selector } : {},
    ...kind === "attribute" && source.attribute !== void 0 ? { attribute: source.attribute } : {},
    ...kind === "column" && source.header !== void 0 ? { header: source.header } : {},
    ...source.required !== void 0 ? { required: source.required } : {},
    handling
  };
}

// src/background/extraction/confirm.ts
async function confirmExtraction(definition, tabId, options, deps) {
  const request = definition.form === "list" ? runnableExtractListRequest(definition) : void 0;
  if (request === void 0) return { ok: false, code: "invalid_definition", message: "The extraction definition is not one the domain can run." };
  if (options.recording) {
    const recorded = await recordDefinition(definition, tabId, options.sessionId, deps);
    if (!recorded.ok) return recorded;
  }
  const action = {
    commandId: `extraction:${options.sessionId}`,
    actionType: "web.dom.extract_list",
    extractList: request,
    // D14 puts the bound on the command, not the request, and the page waits up
    // to 10,000 ms for *each* page of a list -- so the budget is the domain's,
    // scaled by the pages this request may read. It is imported rather than
    // restated: a flat ceiling here truncated any read past six pages, and two
    // definitions of the same rule would drift apart again.
    timeoutMs: options.timeoutMs ?? webAutomationExtractListTimeoutMs(request),
    tabId,
    frameId: 0
  };
  const startedAt = Date.now();
  try {
    const { result } = await deps.runAction({ action, activeTabId: tabId, attachTabForRecording: (target) => deps.ensureContentScript(target) });
    if (result.status !== "succeeded") {
      return { ok: false, code: "run_failed", message: result.message ?? "The extraction did not run." };
    }
    return {
      ok: true,
      records: result.extracted ?? [],
      pagesRead: result.extraction?.pagesRead ?? 1,
      truncated: result.extraction?.truncated ?? false,
      durationMs: Math.max(0, result.finishedAt - result.startedAt) || Date.now() - startedAt
    };
  } catch (error) {
    return { ok: false, code: "run_failed", message: error instanceof Error ? error.message : "The extraction did not run." };
  }
}
async function recordDefinition(definition, tabId, sessionId, deps) {
  const record2 = { type: EXTRACTION_CONTENT_MESSAGES.record, sessionId, definition };
  try {
    const answer = await deps.sendToTab(tabId, record2, 0);
    if (answer?.ok === true) return { ok: true };
    return { ok: false, code: "page_refused", message: `The page did not record the extraction (${answer?.refused ?? "no answer"}).` };
  } catch (error) {
    return { ok: false, code: "page_refused", message: error instanceof Error ? error.message : "The page did not record the extraction." };
  }
}

// src/background/extraction/deps.ts
var extractionControlDeps = {
  sessions: new ExtractionSessions(),
  sendToTab,
  ensureContentScript,
  runAction: runBrowserActionCommand,
  newId: () => crypto.randomUUID()
};

// src/background/extraction/control.ts
var REFUSALS = {
  forbidden: "Only the FluxIQ panel can drive extraction.",
  no_tab: "FluxIQ has no page to extract from. Open the page you want to record first.",
  no_session: "There is no extraction waiting to be confirmed.",
  not_recording: "Start recording before confirming an extraction.",
  invalid_definition: "Those columns do not make an extraction FluxIQ can run.",
  page_refused: "The page did not answer the extraction request.",
  run_failed: "The extraction did not run.",
  top_frame_only: "An extraction can only be picked in the page's main frame.",
  // The one refusal that is about FluxIQ rather than the page or the sender.
  // Its code is the word the session carries, so the panel's sentence and this
  // one come from the same vocabulary (`ExtractionSessionRefusal`).
  value_form_unsupported: "FluxIQ cannot record a single value yet. Pick an item in a repeating list."
};
function refuse(code, error) {
  return { ok: false, code, error: error ?? REFUSALS[code] };
}
async function handleExtractionControl(message, sender, manager, deps = extractionControlDeps) {
  if (message.type === EXTRACTION_PICKED_MESSAGE) {
    return { handled: true, response: await acceptPick(message, sender, deps) };
  }
  if (message.type === EXTRACTION_PICK_CANCELLED_MESSAGE) {
    return { handled: true, response: acceptPickCancelled(message, sender, deps) };
  }
  const runtime = Object.values(EXTRACTION_RUNTIME_MESSAGES).find((name) => name === message.type);
  if (runtime === void 0) return { handled: false };
  if (!isControlPage(sender)) return { handled: true, response: refuse("forbidden") };
  if (runtime === EXTRACTION_RUNTIME_MESSAGES.start) return { handled: true, response: await startPick(message, manager, deps) };
  if (runtime === EXTRACTION_RUNTIME_MESSAGES.getSession) return { handled: true, response: await readSession2(message, deps) };
  if (runtime === EXTRACTION_RUNTIME_MESSAGES.cancel) return { handled: true, response: await cancelPick(message, deps) };
  if (runtime === EXTRACTION_RUNTIME_MESSAGES.confirm) return { handled: true, response: await confirmPick(message, manager, deps) };
  return { handled: true, response: await defineForTest(message, manager, deps) };
}
function clearExtractionTab(tabId, deps = extractionControlDeps) {
  deps.sessions.clearTab(tabId);
}
async function startPick(message, manager, deps) {
  const tabId = manager.status().activeTabId;
  if (tabId === void 0) return refuse("no_tab");
  if (message.form === "value") return refuse("value_form_unsupported");
  const form = "list";
  const sessionId = deps.newId();
  deps.sessions.start(sessionId, tabId, form);
  try {
    await deps.ensureContentScript(tabId, 0);
    const pickStart = { type: EXTRACTION_CONTENT_MESSAGES.pickStart, sessionId, form };
    const answer = await deps.sendToTab(tabId, pickStart, 0);
    if (answer?.ok !== true) {
      deps.sessions.clear(sessionId);
      return refuse("page_refused");
    }
  } catch (error) {
    deps.sessions.clear(sessionId);
    return refuse("page_refused", error instanceof Error ? error.message : void 0);
  }
  return { ok: true, sessionId, tabId };
}
async function acceptPick(message, sender, deps) {
  const tabId = sender.tab?.id;
  if (tabId === void 0 || sender.frameId !== 0) return refuse("top_frame_only");
  const picked = message;
  if (typeof picked.sessionId !== "string") return refuse("no_session");
  if (picked.proposal !== void 0) {
    const filled = deps.sessions.picked(picked.sessionId, tabId, picked.proposal);
    return filled === void 0 ? refuse("no_session") : { ok: true, sessionId: picked.sessionId };
  }
  const refusal = picked.refused ?? (picked.element !== void 0 ? "value_form_unsupported" : void 0);
  if (refusal === void 0) return refuse("no_session");
  const session = deps.sessions.refuse(picked.sessionId, tabId, refusal);
  if (session === void 0) return refuse("no_session");
  await rearmPick(session, deps);
  return refusal === "value_form_unsupported" ? refuse("value_form_unsupported") : { ok: true, sessionId: picked.sessionId };
}
function acceptPickCancelled(message, sender, deps) {
  const tabId = sender.tab?.id;
  if (tabId === void 0 || sender.frameId !== 0) return refuse("top_frame_only");
  const cancelled = message;
  if (typeof cancelled.sessionId !== "string") return refuse("no_session");
  return { ok: true, cancelled: deps.sessions.cancelled(cancelled.sessionId, tabId) !== void 0 };
}
async function rearmPick(session, deps) {
  try {
    const pickStart = { type: EXTRACTION_CONTENT_MESSAGES.pickStart, sessionId: session.sessionId, form: session.form };
    await deps.sendToTab(session.tabId, pickStart, 0);
  } catch {
  }
}
async function readSession2(message, deps) {
  const session = deps.sessions.get(sessionIdOf(message));
  if (session === void 0) return { ok: true };
  if (session.state === "picked" && session.proposal !== void 0) {
    await refreshPreview(session, session.proposal, columnsOf(message), deps);
  }
  const view = {
    sessionId: session.sessionId,
    tabId: session.tabId,
    state: session.state,
    form: session.form,
    ...session.proposal !== void 0 ? { proposal: session.proposal } : {},
    ...session.refused !== void 0 ? { refused: session.refused } : {},
    preview: session.preview
  };
  return { ok: true, session: view };
}
async function refreshPreview(session, proposal, columns, deps) {
  const preview = extractionPreviewRequest(proposal, columns);
  if (preview === void 0 || preview.columnsKey === session.previewKey) return;
  try {
    const read = {
      type: EXTRACTION_CONTENT_MESSAGES.preview,
      sessionId: session.sessionId,
      request: preview.request,
      limit: EXTRACTION_PREVIEW_MAX_ROWS
    };
    const answer = await deps.sendToTab(session.tabId, read, 0);
    if (answer?.ok === true) deps.sessions.setPreview(session.sessionId, preview.columnsKey, answer.rows ?? []);
    else deps.sessions.clearPreview(session.sessionId);
  } catch {
    deps.sessions.clearPreview(session.sessionId);
  }
}
async function cancelPick(message, deps) {
  const session = deps.sessions.get(sessionIdOf(message));
  if (session === void 0) return { ok: true, cancelled: false };
  deps.sessions.clear(session.sessionId);
  try {
    const cancel = { type: EXTRACTION_CONTENT_MESSAGES.pickCancel, sessionId: session.sessionId };
    await deps.sendToTab(session.tabId, cancel, 0);
  } catch {
  }
  return { ok: true, cancelled: true };
}
async function confirmPick(message, manager, deps) {
  if (manager.status().recordingState !== "recording") return refuse("not_recording");
  const session = deps.sessions.get(sessionIdOf(message));
  if (session === void 0 || session.state !== "picked" || session.proposal === void 0) return refuse("no_session");
  const confirm = confirmRequestOf(message);
  if (confirm === void 0) return refuse("invalid_definition");
  const definition = recordedListExtraction2(session.proposal, confirm, deps.newId().slice(0, 8));
  if (definition === void 0) return refuse("invalid_definition");
  const outcome = await confirmExtraction(definition, session.tabId, { sessionId: session.sessionId, recording: true }, deps);
  if (!outcome.ok) return refuse(outcome.code, outcome.message);
  deps.sessions.markRecorded(session.sessionId);
  const captured = {
    datasetId: definition.datasetId,
    label: definition.label,
    recordCount: Array.isArray(outcome.records) ? outcome.records.length : 0,
    pagesRead: outcome.pagesRead,
    truncated: outcome.truncated,
    durationMs: outcome.durationMs
  };
  return { ok: true, ...captured };
}
async function defineForTest(message, manager, deps) {
  const status = manager.status();
  if (status.activeTabId === void 0) return refuse("no_tab");
  const definition = message.definition;
  if (definition === null || typeof definition !== "object") return refuse("invalid_definition");
  const outcome = await confirmExtraction(
    definition,
    status.activeTabId,
    {
      sessionId: deps.newId(),
      recording: status.recordingState === "recording",
      ...typeof message.timeoutMs === "number" ? { timeoutMs: message.timeoutMs } : {}
    },
    deps
  );
  if (!outcome.ok) return refuse(outcome.code, outcome.message);
  return { ok: true, records: outcome.records, pagesRead: outcome.pagesRead, truncated: outcome.truncated, durationMs: outcome.durationMs };
}
function sessionIdOf(message) {
  return typeof message.sessionId === "string" ? message.sessionId : void 0;
}
function confirmRequestOf(message) {
  const nested = message.request;
  if (nested !== null && typeof nested === "object") return nested;
  return typeof message.label === "string" ? message : void 0;
}
function columnsOf(message) {
  return Array.isArray(message.fields) ? message.fields : void 0;
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
chrome.tabs.onRemoved.addListener((tabId) => {
  clearExtractionTab(tabId);
  void getConnection().then((manager) => manager.handleTabRemoved(tabId));
});
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  clearExtractionTab(details.tabId);
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
  const scriptedNavigation = await handleScriptedNavigationControl(typed, sender, manager);
  if (scriptedNavigation.handled) return scriptedNavigation.response;
  const extraction = await handleExtractionControl(typed, sender, manager);
  if (extraction.handled) return extraction.response;
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
