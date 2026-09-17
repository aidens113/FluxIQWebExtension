"use strict";
(() => {
  // src/content/messages.ts
  var CONTENT_EVENT = "fluxiq.contentEvent";
  var CONTENT_READY = "fluxiq.contentReady";
  var FRAME_GEOMETRY_REQUEST = "fluxiq.frameGeometryRequest";
  var FRAME_GEOMETRY_RESPONSE = "fluxiq.frameGeometryResponse";

  // src/content/frame-geometry.ts
  var frameViewportOffset = isTopFrame() ? { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight } : void 0;
  var frameGeometryRequestId = 0;
  function isTopFrame() {
    return window.top === window;
  }
  function currentFrameViewportOffset() {
    if (isTopFrame()) return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    return frameViewportOffset;
  }
  function installFrameGeometryBridge() {
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === FRAME_GEOMETRY_REQUEST) {
        const requestId = typeof data.requestId === "number" ? data.requestId : void 0;
        const geometry = childFrameViewportOffset(event.source);
        if (!geometry || !event.source || typeof event.source.postMessage !== "function") return;
        event.source.postMessage({
          type: FRAME_GEOMETRY_RESPONSE,
          requestId,
          geometry
        }, "*");
        return;
      }
      if (data.type === FRAME_GEOMETRY_RESPONSE) {
        const geometry = rectFromUnknown(data.geometry);
        if (geometry) frameViewportOffset = geometry;
      }
    });
    window.addEventListener("resize", () => {
      if (isTopFrame()) frameViewportOffset = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
      else void requestFrameGeometry();
    }, true);
    window.addEventListener("scroll", () => {
      if (!isTopFrame()) void requestFrameGeometry();
    }, true);
  }
  function requestFrameGeometry() {
    if (isTopFrame()) {
      frameViewportOffset = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
      return Promise.resolve(frameViewportOffset);
    }
    const requestId = ++frameGeometryRequestId;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(frameViewportOffset), 75);
      const listener = (event) => {
        const data = event.data;
        if (!data || data.type !== FRAME_GEOMETRY_RESPONSE || data.requestId !== requestId) return;
        const geometry = rectFromUnknown(data.geometry);
        if (geometry) frameViewportOffset = geometry;
        clearTimeout(timeout);
        window.removeEventListener("message", listener);
        resolve(frameViewportOffset);
      };
      window.addEventListener("message", listener);
      window.parent.postMessage({ type: FRAME_GEOMETRY_REQUEST, requestId }, "*");
    });
  }
  function childFrameViewportOffset(source) {
    if (!source) return void 0;
    const frameElement = [...document.querySelectorAll("iframe,frame")].find(
      (element) => (element instanceof HTMLIFrameElement || element instanceof HTMLFrameElement) && element.contentWindow === source
    );
    if (!frameElement) return void 0;
    const rect2 = frameElement.getBoundingClientRect();
    const parentOffset = currentFrameViewportOffset() ?? { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    return {
      x: Math.round((parentOffset.x + rect2.left) * 100) / 100,
      y: Math.round((parentOffset.y + rect2.top) * 100) / 100,
      width: Math.round(rect2.width * 100) / 100,
      height: Math.round(rect2.height * 100) / 100
    };
  }
  function rectFromUnknown(value) {
    if (!value || typeof value !== "object") return void 0;
    const rect2 = value;
    return typeof rect2.x === "number" && typeof rect2.y === "number" && typeof rect2.width === "number" && typeof rect2.height === "number" ? { x: rect2.x, y: rect2.y, width: rect2.width, height: rect2.height } : void 0;
  }

  // src/content/instance.ts
  var ACTIVE_CONTENT_INSTANCE_KEY = "__fluxiqWebAutomationActiveContentInstance";
  var CONTENT_SCRIPT_VERSION = 2;
  var CONTENT_INSTANCE_ID = `${Date.now()}.${Math.random().toString(36).slice(2)}`;
  var contentWindow = window;
  contentWindow[ACTIVE_CONTENT_INSTANCE_KEY] = CONTENT_INSTANCE_ID;
  function isActiveContentInstance() {
    return contentWindow[ACTIVE_CONTENT_INSTANCE_KEY] === CONTENT_INSTANCE_ID;
  }

  // src/content/capture-settings.ts
  var captureSettings = {
    mutations: true,
    inputValues: true,
    snapshots: true
  };

  // src/content/compact-object.ts
  function compactObject(value) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
  }

  // src/content/evidence/changes.ts
  var STATE_ATTRIBUTES = ["disabled", "aria-disabled", "aria-expanded", "aria-pressed", "aria-selected", "aria-current", "aria-busy", "aria-invalid"];
  var MAX_FINGERPRINT_TEXT = 120;
  var FINGERPRINT_SEPARATOR = String.fromCharCode(31);
  var previous;
  function markElementActivity(entries, recent2) {
    const current = /* @__PURE__ */ new Map();
    const ambiguous2 = /* @__PURE__ */ new Set();
    for (const { descriptor } of entries) {
      const key = elementKey(descriptor);
      if (current.has(key)) ambiguous2.add(key);
      else current.set(key, elementFingerprint(descriptor));
    }
    let changed = 0;
    let interacted = 0;
    for (const { element, descriptor } of entries) {
      const key = elementKey(descriptor);
      if (previous !== void 0 && !ambiguous2.has(key) && previous.get(key) !== current.get(key)) {
        descriptor.changed = true;
        changed += 1;
      }
      if (recent2.has(element)) {
        descriptor.recentlyInteracted = true;
        interacted += 1;
      }
    }
    previous = current;
    return { changed, recentlyInteracted: interacted };
  }
  function elementKey(descriptor) {
    return descriptor.xpath ?? descriptor.selector;
  }
  function elementFingerprint(descriptor) {
    return [
      (descriptor.text ?? "").slice(0, MAX_FINGERPRINT_TEXT),
      descriptor.hasValue === void 0 ? "" : String(descriptor.hasValue),
      descriptor.selectedValue ?? "",
      (descriptor.classNames ?? []).join(" "),
      stateAttributes(descriptor),
      positionOf(descriptor)
    ].join(FINGERPRINT_SEPARATOR);
  }
  function stateAttributes(descriptor) {
    const attributes = descriptor.attributes;
    if (!attributes) return "";
    return STATE_ATTRIBUTES.map((name) => {
      const value = attributes[name];
      return value === void 0 ? "" : `${name}=${value}`;
    }).join(",");
  }
  function positionOf(descriptor) {
    const bounds = descriptor.documentBounds;
    if (!bounds) return "";
    return `${Math.round(bounds.x)},${Math.round(bounds.y)},${Math.round(bounds.width)},${Math.round(bounds.height)}`;
  }

  // src/shared/dialog-channel.ts
  var DIALOG_ARM_ATTRIBUTE = "data-fluxiq-dialog-arm";
  var DIALOG_OBSERVED_ATTRIBUTE = "data-fluxiq-dialog-observed";
  var DIALOG_ARM_EVENT = "fluxiq:dialog-arm";
  var DIALOG_TEXT_MAX_LENGTH = 1024;
  function encodeDialogArm(arm) {
    return JSON.stringify({
      response: arm.response,
      ...arm.promptText === void 0 ? {} : { promptText: boundText(arm.promptText) }
    });
  }
  function decodeDialogObserved(raw) {
    const value = parseObject(raw);
    if (!value) return void 0;
    const response = dialogResponse(value["response"]);
    const kind = dialogKind(value["kind"]);
    const message = value["message"];
    const at = value["at"];
    if (!response || !kind || typeof message !== "string" || typeof at !== "number") return void 0;
    const promptText = value["promptText"];
    return typeof promptText === "string" ? { kind, message, response, promptText, at } : { kind, message, response, at };
  }
  function boundText(value) {
    return value.length <= DIALOG_TEXT_MAX_LENGTH ? value : value.slice(0, DIALOG_TEXT_MAX_LENGTH);
  }
  function parseObject(raw) {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : void 0;
    } catch {
      return void 0;
    }
  }
  function dialogResponse(value) {
    return value === "accept" || value === "dismiss" ? value : void 0;
  }
  function dialogKind(value) {
    return value === "alert" || value === "confirm" || value === "prompt" || value === "beforeunload" ? value : void 0;
  }

  // src/content/selector/element-anchors.ts
  var TEST_ID_ATTRIBUTES = ["data-testid", "data-test", "data-cy"];
  function elementAnchors(element) {
    const anchors = [];
    const id = element.getAttribute("id");
    if (id) {
      const byId = `#${CSS.escape(id)}`;
      anchors.push({ selector: byId, qualifier: byId });
    }
    for (const attribute of TEST_ID_ATTRIBUTES) {
      const testId = element.getAttribute(attribute);
      if (!testId) continue;
      const byTestId = `[${attribute}="${CSS.escape(testId)}"]`;
      anchors.push({ selector: byTestId, qualifier: byTestId });
    }
    const name = element.getAttribute("name");
    if (name) {
      const byName = `[name="${CSS.escape(name)}"]`;
      anchors.push({ selector: `${CSS.escape(element.localName)}${byName}`, qualifier: byName });
    }
    return anchors;
  }

  // src/content/selector/selector-memo.ts
  var active;
  function withSelectorMemo(capture) {
    if (active) return capture();
    active = { selectors: /* @__PURE__ */ new Map(), soleMatches: /* @__PURE__ */ new Map() };
    try {
      return capture();
    } finally {
      active = void 0;
    }
  }
  function activeSelectorMemo() {
    return active;
  }

  // src/content/selector/unique-selector.ts
  var DOCUMENT_NODE = 9;
  var DOCUMENT_FRAGMENT_NODE = 11;
  var HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  var SINGLETON_TAGS = /* @__PURE__ */ new Set(["body", "main"]);
  var MAX_DETACHED_STEPS = 5;
  function selectorFor(element) {
    const memo = activeSelectorMemo();
    const known = memo?.selectors.get(element);
    if (known !== void 0) return known;
    const selector = buildSelector(element, memo);
    memo?.selectors.set(element, selector);
    return selector;
  }
  function buildSelector(element, memo) {
    const anchors = elementAnchors(element);
    const root = searchRoot(element);
    if (!root) return anchors[0]?.selector ?? detachedPath(element);
    if (root.nodeType === DOCUMENT_NODE && element === root.documentElement) return ":root";
    for (const anchor of anchors) {
      if (soleMatch(root, anchor.selector, memo) === element) return anchor.selector;
    }
    if (SINGLETON_TAGS.has(element.localName) && element.namespaceURI === HTML_NAMESPACE) {
      const tag = typeSelector(element);
      if (soleMatch(root, tag, memo) === element) return tag;
    }
    const first = anchors[0];
    const parent = element.parentElement;
    if (!parent) return step(element, first);
    if (first) {
      const holder = soleHolder(element, first.selector);
      if (holder) return `${selectorFor(holder)} ${first.selector}`;
    }
    return `${selectorFor(parent)} > ${step(element, first)}`;
  }
  function searchRoot(element) {
    if (!element.isConnected) return void 0;
    const root = element.getRootNode();
    if (root.nodeType === DOCUMENT_NODE) return root;
    if (root.nodeType === DOCUMENT_FRAGMENT_NODE && "host" in root) return root;
    return void 0;
  }
  function soleMatch(root, selector, memo) {
    let known = memo?.soleMatches.get(root);
    const cached = known?.get(selector);
    if (cached !== void 0) return cached;
    let sole = null;
    try {
      const matches = root.querySelectorAll(selector);
      sole = matches.length === 1 ? matches[0] ?? null : null;
    } catch {
      sole = null;
    }
    if (memo) {
      if (!known) {
        known = /* @__PURE__ */ new Map();
        memo.soleMatches.set(root, known);
      }
      known.set(selector, sole);
    }
    return sole;
  }
  function soleHolder(element, selector) {
    let holder;
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (matchCountWithin(ancestor, selector) !== 1) break;
      holder = ancestor;
    }
    return holder;
  }
  function matchCountWithin(ancestor, selector) {
    try {
      return ancestor.querySelectorAll(selector).length;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }
  function step(element, anchor) {
    return `${typeSelector(element)}${anchor?.qualifier ?? ""}${position(element)}`;
  }
  function typeSelector(element) {
    return CSS.escape(element.localName);
  }
  function position(element) {
    let index = 1;
    for (let sibling = element.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      if (sameType(sibling, element)) index += 1;
    }
    let shared = index > 1;
    for (let sibling = element.nextElementSibling; sibling && !shared; sibling = sibling.nextElementSibling) {
      if (sameType(sibling, element)) shared = true;
    }
    return shared ? `:nth-of-type(${index})` : "";
  }
  function sameType(left, right) {
    return left.localName === right.localName && left.namespaceURI === right.namespaceURI;
  }
  function detachedPath(element) {
    const steps = [];
    for (let current = element; current && steps.length < MAX_DETACHED_STEPS; current = current.parentElement) {
      steps.unshift(`${typeSelector(current)}${position(current)}`);
    }
    return steps.join(" > ");
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
  function elementFingerprint2(value) {
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
    const position2 = objectValue(value);
    const index = numberValue(position2?.index);
    const total = numberValue(position2?.total);
    return index === void 0 || total === void 0 ? void 0 : { index, total };
  }
  function tablePosition(value) {
    const position2 = objectValue(value);
    const row = numberValue(position2?.row);
    const column = numberValue(position2?.column);
    if (row === void 0 || column === void 0) return void 0;
    const columnHeader2 = stringValue(position2?.columnHeader);
    return columnHeader2 === void 0 ? { row, column } : { row, column, columnHeader: columnHeader2 };
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
    const fingerprint = elementFingerprint2(value);
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

  // ../../domain/src/extraction/signature.ts
  var MAX_SIGNATURE_CLASSES = 3;
  function webAutomationItemSignature(parts2) {
    const role = parts2.role?.trim().toLowerCase() ?? "";
    const classes = [...parts2.classes].sort().slice(0, MAX_SIGNATURE_CLASSES).join(".");
    return `${parts2.tagName.toLowerCase()}|${role}|${webAutomationIdentifierShape(parts2.testId)}|${classes}`;
  }
  function webAutomationIdentifierShape(value) {
    return value === void 0 ? "" : value.replace(/\d+/gu, "#");
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
    const parts2 = stringValue2(path).split(".").map((part) => part.trim()).filter(Boolean);
    let current = source;
    for (const part of parts2) {
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
    const parts2 = String(path ?? "").split(".").map((part) => part.trim()).filter(Boolean);
    if (!parts2.length)
      return source;
    const next = { ...source };
    let cursor = next;
    for (const part of parts2.slice(0, -1)) {
      const existing = cursor[part];
      const child2 = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {};
      cursor[part] = child2;
      cursor = child2;
    }
    cursor[parts2[parts2.length - 1]] = keptJsonValue(value);
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
  function isWebAutomationFailureCode(value) {
    return typeof value === "string" && Object.hasOwn(WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS, value);
  }
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
    const collapsed2 = value.replace(/\s+/gu, " ").trim();
    if (collapsed2.length === 0) return void 0;
    if (collapsed2.length <= WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH) return collapsed2;
    return `${collapsed2.slice(0, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH - 1)}\u2026`;
  }

  // ../../domain/src/runtime/failure/carrier.ts
  function carriedWebAutomationFailure(error, fallback = {}) {
    const carried = property(error, "failure");
    const code = property(carried, "code");
    if (typeof code !== "string") return void 0;
    const comparison = {
      expected: text(property(carried, "expected")) ?? fallback.expected,
      actual: text(property(carried, "actual")) ?? fallback.actual,
      evidenceDigest: text(property(carried, "evidenceDigest")) ?? fallback.evidenceDigest
    };
    if (isWebAutomationFailureCode(code)) return webAutomationFailureRecord(code, comparison);
    const unnamed = `unrecognized web automation failure code: ${code}`;
    return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, {
      ...comparison,
      actual: comparison.actual === void 0 ? unnamed : `${comparison.actual}; ${unnamed}`
    });
  }
  function property(value, name) {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value[name] : void 0;
  }
  function text(value) {
    return typeof value === "string" && value.length > 0 ? value : void 0;
  }

  // ../../domain/src/runtime/failure/classify.ts
  function classifyWebAutomationFailure(error, outcome) {
    if (outcome.failure !== void 0) return outcome.failure;
    const carried = carriedWebAutomationFailure(error, withActual(comparedText(outcome.validation), errorMessage(error)));
    if (carried !== void 0) return carried;
    const classified = classifyOutcome(error, outcome);
    return classified === void 0 ? void 0 : webAutomationFailureRecord(classified.code, classified.comparison);
  }
  function classifyOutcome(error, outcome) {
    const compared = comparedText(outcome.validation);
    if (outcome.status === "timed_out") return { code: WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, comparison: withActual(compared, errorMessage(error)) };
    if (outcome.validation?.status === "failed") {
      const code = outcome.actionType === "web.dom.assert" ? WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH : WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED;
      return { code, comparison: compared };
    }
    if (error !== void 0 && error !== null) {
      return { code: WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, comparison: withActual(compared, errorMessage(error) ?? "the action threw a value that carried no message") };
    }
    if (outcome.status === "failed" || outcome.status === "unknown") {
      const message = outcome.message;
      if (message === void 0 || message.trim().length === 0) return { code: WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, comparison: compared };
      return { code: WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, comparison: withActual(compared, message) };
    }
    return void 0;
  }
  function comparedText(validation) {
    if (validation === void 0 || validation.status === "none") return {};
    return { expected: validation.expected, actual: validation.actual };
  }
  function withActual(compared, actual) {
    return compared.actual !== void 0 ? compared : { ...compared, actual };
  }
  function errorMessage(error) {
    if (error instanceof Error) return error.message.length > 0 ? error.message : void 0;
    if (typeof error === "string") return error.length > 0 ? error : void 0;
    if (typeof error !== "object" || error === null) return void 0;
    const message = error.message;
    return typeof message === "string" && message.length > 0 ? message : void 0;
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

  // src/content/element-traits.ts
  function isActionableElement(element) {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute("role")?.toLowerCase();
    return tagName === "a" || tagName === "button" || tagName === "input" || tagName === "textarea" || tagName === "select" || tagName === "summary" || tagName === "label" || role === "button" || role === "link" || role === "menuitem" || role === "checkbox" || role === "radio" || role === "tab" || role === "switch" || hasClickHandler(element) || element instanceof HTMLElement && element.isContentEditable;
  }
  function isInteractableUiElement(element) {
    return isActionableElement(element) || element instanceof HTMLElement && getComputedStyle(element).cursor === "pointer" || element.hasAttribute("tabindex") || element.hasAttribute("aria-expanded") || element.hasAttribute("aria-controls") || element.hasAttribute("aria-pressed") || element.hasAttribute("aria-selected");
  }
  function isPrimaryControlElement2(element) {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute("role")?.toLowerCase();
    return tagName === "button" || tagName === "a" || tagName === "summary" || role === "button" || role === "link" || role === "menuitem" || role === "tab";
  }
  function hasClickHandler(element) {
    const htmlElement = element;
    return element.hasAttribute("onclick") || typeof htmlElement.onclick === "function";
  }
  function isSemanticTextElement2(element) {
    const tagName = element.tagName.toLowerCase();
    return tagName === "p" || tagName === "li" || tagName === "td" || tagName === "th" || tagName === "dt" || tagName === "dd" || tagName === "figcaption" || tagName === "blockquote" || /^h[1-6]$/.test(tagName);
  }
  function hasVisualMedia(element) {
    return element.matches("svg,img,picture,canvas,video") || Boolean(element.querySelector("svg,img,picture,canvas,video"));
  }
  function isTextEntryElement(element) {
    if (element instanceof HTMLTextAreaElement) return true;
    if (element instanceof HTMLElement && element.isContentEditable) return true;
    if (!(element instanceof HTMLInputElement)) return false;
    const type = element.type.toLowerCase();
    return type === "" || type === "text" || type === "search" || type === "email" || type === "password" || type === "tel" || type === "url" || type === "number";
  }
  function shouldRecordChangeEvent(element) {
    if (element instanceof HTMLSelectElement) return true;
    if (!(element instanceof HTMLInputElement)) return true;
    const type = element.type.toLowerCase();
    return type === "checkbox" || type === "radio" || type === "file" || type === "date" || type === "datetime-local" || type === "month" || type === "time" || type === "week" || type === "color" || type === "range";
  }
  function isSensitiveFormControl(element) {
    return isSensitiveFieldSignature({
      inputType: element instanceof HTMLInputElement ? element.type : void 0,
      autocomplete: element.getAttribute("autocomplete") ?? void 0,
      dataSensitive: element.getAttribute("data-sensitive") ?? void 0
    });
  }
  var VALUELESS_INPUT_TYPES = /* @__PURE__ */ new Set(["hidden", "button", "submit", "reset", "image", "checkbox", "radio"]);
  function hasEnteredValue(element) {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return element.value.length > 0;
    if (element instanceof HTMLInputElement) {
      return VALUELESS_INPUT_TYPES.has(element.type.toLowerCase()) ? void 0 : element.value.length > 0;
    }
    if (element instanceof HTMLElement && element.isContentEditable) return (element.textContent ?? "").trim().length > 0;
    return void 0;
  }
  function meaningfulText2(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  // src/content/sensitive-text.ts
  function textOutsideSensitiveControls(element, extent = "all") {
    const text3 = extent === "own" ? ownText(element) : element.textContent ?? "";
    if (!/\S/u.test(text3)) return text3;
    if (isWithinSensitiveControl(element)) return "";
    if (extent === "own" || !hasTextBearingSensitiveDescendant(element)) return text3;
    return textSkippingSensitiveSubtrees(element);
  }
  function ownText(element) {
    return [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent ?? "").join(" ");
  }
  function isWithinSensitiveControl(element) {
    for (let current = element; current; current = current.parentElement) {
      if (isSensitiveFormControl(current)) return true;
    }
    return false;
  }
  function hasTextBearingSensitiveDescendant(root) {
    for (const descendant of root.querySelectorAll("*")) {
      if (descendant.firstChild && isSensitiveFormControl(descendant)) return true;
    }
    return false;
  }
  function textSkippingSensitiveSubtrees(root) {
    let text3 = "";
    const pending = [...root.childNodes].reverse();
    for (let node = pending.pop(); node; node = pending.pop()) {
      if (node.nodeType === Node.TEXT_NODE) {
        text3 += node.nodeValue ?? "";
      } else if (node.nodeType === Node.ELEMENT_NODE && !isSensitiveFormControl(node)) {
        const children = node.childNodes;
        for (let index = children.length - 1; index >= 0; index -= 1) {
          const child2 = children[index];
          if (child2) pending.push(child2);
        }
      }
    }
    return text3;
  }

  // src/content/identity/bounded-text.ts
  function boundedText2(value, maxLength) {
    const text3 = (value ?? "").replace(/\s+/gu, " ").trim();
    return text3 ? text3.slice(0, maxLength) : void 0;
  }

  // src/content/identity/label.ts
  var MAX_LABEL_LENGTH = 200;
  var MAX_NEARBY_LABEL_LENGTH = 80;
  var MAX_ASSOCIATED_LABELS = 4;
  var MAX_NEARBY_SIBLINGS = 4;
  var NEARBY_LABEL_TAGS = /* @__PURE__ */ new Set(["label", "span", "div", "p", "dt", "strong", "b", "legend", "th"]);
  var NESTED_CONTROL_SELECTOR = "input,select,textarea,button";
  function associatedLabel(element) {
    const texts = associatedLabelElements(element).map((label) => labelElementText(label, element));
    return boundedText2(texts.filter(Boolean).join(" "), MAX_LABEL_LENGTH);
  }
  function labelText(element) {
    return associatedLabel(element) ?? nearbyLabel(element);
  }
  function associatedLabelElements(element) {
    const native = element.labels;
    if (native) return [...native].slice(0, MAX_ASSOCIATED_LABELS);
    const labels = [];
    if (element.id) {
      for (const label of document.querySelectorAll(`label[for="${cssString(element.id)}"]`)) labels.push(label);
    }
    const ancestor = element.closest("label");
    if (ancestor && !labels.includes(ancestor)) labels.push(ancestor);
    return labels.slice(0, MAX_ASSOCIATED_LABELS);
  }
  function labelElementText(label, control) {
    if (isWithinSensitiveControl(label)) return "";
    const parts2 = [];
    collectLabelText(label, control, parts2, 0);
    return parts2.join(" ").replace(/\s+/gu, " ").trim();
  }
  function collectLabelText(node, control, parts2, depth) {
    if (parts2.length > 40 || depth > 8) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const text3 = node.textContent;
      if (text3?.trim()) parts2.push(text3);
      return;
    }
    if (!(node instanceof Element)) return;
    if (node === control || node.matches(NESTED_CONTROL_SELECTOR) || isSensitiveFormControl(node)) return;
    for (const child2 of node.childNodes) collectLabelText(child2, control, parts2, depth + 1);
  }
  function nearbyLabel(element) {
    if (!isLabelableControl(element)) return void 0;
    const fromSiblings = labelBeforeSiblings(element);
    if (fromSiblings) return fromSiblings;
    const wrapper = element.parentElement;
    return wrapper?.childElementCount === 1 ? labelBeforeSiblings(wrapper) : void 0;
  }
  function labelBeforeSiblings(element) {
    let sibling = element.previousElementSibling;
    let scanned = 0;
    while (sibling && scanned < MAX_NEARBY_SIBLINGS) {
      scanned += 1;
      const text3 = nearbyLabelText(sibling);
      if (text3) return text3;
      sibling = sibling.previousElementSibling;
    }
    return void 0;
  }
  function nearbyLabelText(candidate) {
    if (!NEARBY_LABEL_TAGS.has(candidate.tagName.toLowerCase())) return void 0;
    if (candidate.querySelector(NESTED_CONTROL_SELECTOR)) return void 0;
    return boundedText2(textOutsideSensitiveControls(candidate), MAX_NEARBY_LABEL_LENGTH);
  }
  function isLabelableControl(element) {
    if (element instanceof HTMLInputElement) return element.type.toLowerCase() !== "hidden";
    if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) return true;
    return element instanceof HTMLElement && element.isContentEditable;
  }
  function cssString(value) {
    return CSS.escape(value).replace(/"/gu, '\\"');
  }

  // src/content/identity/accessible-name.ts
  var MAX_NAME_LENGTH = 200;
  var MAX_LABELLEDBY_IDS = 8;
  var BUTTON_INPUT_TYPES = /* @__PURE__ */ new Set(["submit", "button", "reset"]);
  var NAME_FROM_CONTENT_TAGS = /* @__PURE__ */ new Set([
    "a",
    "button",
    "summary",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "th",
    "td",
    "li",
    "label",
    "legend",
    "option",
    "caption",
    "figcaption",
    "dt",
    "dd"
  ]);
  var NAME_FROM_CONTENT_ROLES = /* @__PURE__ */ new Set([
    "button",
    "link",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "tab",
    "heading",
    "treeitem",
    "gridcell",
    "cell",
    "columnheader",
    "rowheader",
    "row",
    "switch",
    "checkbox",
    "radio",
    "tooltip",
    "listitem"
  ]);
  function accessibleNameFor(element) {
    return labelledByName(element) ?? boundedText2(element.getAttribute("aria-label"), MAX_NAME_LENGTH) ?? associatedLabel(element) ?? boundedText2(element.getAttribute("title") ?? element.getAttribute("alt"), MAX_NAME_LENGTH) ?? boundedText2(element.getAttribute("placeholder"), MAX_NAME_LENGTH) ?? buttonValueName(element) ?? nameFromContent(element);
  }
  function authoredNameAttribute(element) {
    return element.getAttribute("aria-label") ?? element.getAttribute("title") ?? element.getAttribute("alt") ?? void 0;
  }
  function labelledByName(element) {
    const ids = (element.getAttribute("aria-labelledby") ?? "").split(/\s+/u).filter(Boolean).slice(0, MAX_LABELLEDBY_IDS);
    if (!ids.length) return void 0;
    const parts2 = ids.flatMap((id) => {
      const target = document.getElementById(id);
      const text3 = target && target !== element ? boundedText2(textOutsideSensitiveControls(target), MAX_NAME_LENGTH) : void 0;
      return text3 ? [text3] : [];
    });
    return boundedText2(parts2.join(" "), MAX_NAME_LENGTH);
  }
  function buttonValueName(element) {
    if (!(element instanceof HTMLInputElement)) return void 0;
    if (!BUTTON_INPUT_TYPES.has(element.type.toLowerCase())) return void 0;
    if (isSensitiveFormControl(element)) return void 0;
    return boundedText2(element.value, MAX_NAME_LENGTH);
  }
  function nameFromContent(element) {
    return supportsNameFromContent(element) ? boundedText2(textOutsideSensitiveControls(element), MAX_NAME_LENGTH) : void 0;
  }
  function supportsNameFromContent(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) return false;
    if (element instanceof HTMLElement && element.isContentEditable) return false;
    const role = element.getAttribute("role")?.trim().toLowerCase();
    if (role) return NAME_FROM_CONTENT_ROLES.has(role);
    return NAME_FROM_CONTENT_TAGS.has(element.tagName.toLowerCase());
  }

  // src/content/identity/implicit-role.ts
  var INPUT_TYPE_ROLES = {
    "": "textbox",
    text: "textbox",
    search: "searchbox",
    email: "textbox",
    tel: "textbox",
    url: "textbox",
    number: "spinbutton",
    checkbox: "checkbox",
    radio: "radio",
    range: "slider",
    button: "button",
    submit: "button",
    reset: "button",
    image: "button"
  };
  var TAG_ROLES = {
    button: "button",
    textarea: "textbox",
    table: "table",
    thead: "rowgroup",
    tbody: "rowgroup",
    tfoot: "rowgroup",
    tr: "row",
    td: "cell",
    caption: "caption",
    ul: "list",
    ol: "list",
    menu: "list",
    li: "listitem",
    datalist: "listbox",
    optgroup: "group",
    option: "option",
    fieldset: "group",
    details: "group",
    summary: "button",
    dialog: "dialog",
    output: "status",
    progress: "progressbar",
    meter: "meter",
    hr: "separator",
    p: "paragraph",
    article: "article",
    figure: "figure",
    blockquote: "blockquote",
    main: "main",
    nav: "navigation",
    header: "banner",
    footer: "contentinfo",
    aside: "complementary",
    search: "search"
  };
  function implicitRole(element) {
    const tag = element.tagName.toLowerCase();
    if (tag === "input") return inputRole(element);
    if (tag === "select") return selectRole(element);
    if (tag === "a" || tag === "area") return element.hasAttribute("href") ? "link" : void 0;
    if (tag === "img") return element.getAttribute("alt") === "" ? "presentation" : "img";
    if (tag === "th") return headerCellRole(element);
    if (/^h[1-6]$/u.test(tag)) return "heading";
    if (tag === "section") return hasAuthoredName(element) ? "region" : void 0;
    if (tag === "form") return hasAuthoredName(element) ? "form" : void 0;
    return TAG_ROLES[tag];
  }
  function inputRole(element) {
    const type = element instanceof HTMLInputElement ? element.type.toLowerCase() : "";
    const role = INPUT_TYPE_ROLES[type];
    if ((role === "textbox" || role === "searchbox") && element.hasAttribute("list")) return "combobox";
    return role;
  }
  function selectRole(element) {
    if (!(element instanceof HTMLSelectElement)) return "combobox";
    return element.multiple || element.size > 1 ? "listbox" : "combobox";
  }
  function headerCellRole(element) {
    return element.getAttribute("scope")?.trim().toLowerCase() === "row" ? "rowheader" : "columnheader";
  }
  function hasAuthoredName(element) {
    return element.hasAttribute("aria-label") || element.hasAttribute("aria-labelledby") || element.hasAttribute("title");
  }

  // src/content/identity/reportable-text.ts
  var LABELLED_TAGS = /* @__PURE__ */ new Set(["button", "a", "summary", "label", "option", "legend", "caption"]);
  var LABELLED_ROLES = /* @__PURE__ */ new Set([
    "button",
    "link",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "tab",
    "option",
    "checkbox",
    "radio",
    "switch",
    "treeitem"
  ]);
  var PHRASING_TAGS = /* @__PURE__ */ new Set([
    "span",
    "b",
    "i",
    "em",
    "strong",
    "small",
    "u",
    "s",
    "code",
    "kbd",
    "samp",
    "sub",
    "sup",
    "mark",
    "abbr",
    "time",
    "bdi",
    "bdo",
    "br",
    "wbr",
    "q",
    "cite",
    "var",
    "data",
    "ruby",
    "rt",
    "rp",
    "img",
    "picture",
    "source",
    "svg"
  ]);
  var MAX_DESCENDANTS = 120;
  function reportableText(element, maxLength) {
    if (!isNamedFromContent(element)) return void 0;
    if (!holdsOnlyPhrasing(element)) return void 0;
    if (isSensitiveFormControl(element)) return void 0;
    return boundedText2(element.textContent, maxLength);
  }
  function isNamedFromContent(element) {
    const role = element.getAttribute("role")?.trim().toLowerCase();
    if (role) return LABELLED_ROLES.has(role);
    return LABELLED_TAGS.has(element.tagName.toLowerCase());
  }
  function holdsOnlyPhrasing(element) {
    let scanned = 0;
    for (const descendant of element.querySelectorAll("*")) {
      scanned += 1;
      if (scanned > MAX_DESCENDANTS) return false;
      if (descendant.closest("svg")) continue;
      if (!PHRASING_TAGS.has(descendant.tagName.toLowerCase())) return false;
      if (isSensitiveFormControl(descendant)) return false;
    }
    return true;
  }

  // src/content/identity/candidates.ts
  var MAX_SCANNED = 5e3;
  var MAX_CANDIDATES = 60;
  var MAX_SIGNAL_LENGTH = 200;
  var MAX_LABEL_LENGTH2 = 40;
  var CANDIDATE_SELECTOR = [
    "a[href]",
    "button",
    "input",
    "select",
    "textarea",
    "summary",
    "label",
    "[role]",
    "[tabindex]",
    "[onclick]",
    "[contenteditable]"
  ].join(",");
  function collectTargetCandidates(family, root = document) {
    const tagName = family.tagName?.toLowerCase();
    const role = family.role?.toLowerCase();
    const interactive = root.querySelectorAll(CANDIDATE_SELECTOR);
    const candidates = [];
    let examined = 0;
    for (const element of interactive) {
      if (examined >= MAX_SCANNED) return { candidates, examined, truncated: true };
      examined += 1;
      if (!inFamily(element, tagName, role)) continue;
      candidates.push({ element, fingerprint: candidateFingerprint(element, candidates.length) });
      if (candidates.length >= MAX_CANDIDATES) return { candidates, examined, truncated: examined < interactive.length };
    }
    return { candidates, examined, truncated: false };
  }
  function candidateFingerprint(element, index) {
    const tagName = element.tagName.toLowerCase();
    const testId = candidateTestId(element);
    const id = element.id || void 0;
    const role = element.getAttribute("role")?.trim().toLowerCase() || implicitRole(element);
    const classNames = [...element.classList];
    const selector = candidateSelector(element, tagName, id, testId);
    const visibleText2 = boundedText2(element.textContent, MAX_SIGNAL_LENGTH);
    const accessibleName = accessibleNameFor(element);
    const label = labelText(element);
    const rect2 = element.getBoundingClientRect();
    return {
      candidateId: testId ?? id ?? `${tagName}:${index}`,
      tagName,
      ...role ? { role } : {},
      ...id ? { id } : {},
      ...testId ? { testId } : {},
      ...classNames.length ? { classNames } : {},
      ...selector ? { selector } : {},
      ...visibleText2 ? { visibleText: visibleText2 } : {},
      ...accessibleName ? { accessibleName } : {},
      ...label ? { label } : {},
      bounds: { x: rect2.x, y: rect2.y, width: rect2.width, height: rect2.height },
      isVisibleOnViewport: rect2.width > 0 && rect2.height > 0 && rect2.bottom > 0 && rect2.top < window.innerHeight
    };
  }
  function candidateLabel(element) {
    const tagName = element.tagName.toLowerCase();
    const testId = candidateTestId(element);
    const identifier = testId ? `[data-testid="${testId}"]` : element.id ? `#${element.id}` : "";
    const text3 = reportableText(element, MAX_LABEL_LENGTH2);
    return `${tagName}${identifier}${text3 ? ` "${text3}"` : ""}`;
  }
  function candidateTestId(element) {
    return element.getAttribute("data-testid") ?? element.getAttribute("data-test") ?? element.getAttribute("data-cy") ?? void 0;
  }
  function candidateSelector(element, tagName, id, testId) {
    if (id) return `#${id}`;
    if (testId) return `[data-testid="${testId}"]`;
    const name = element.getAttribute("name");
    return name ? `${tagName}[name="${name}"]` : void 0;
  }
  function inFamily(element, tagName, role) {
    if (!tagName && !role) return true;
    if (tagName && element.tagName.toLowerCase() === tagName) return true;
    if (!role) return false;
    const declared2 = element.getAttribute("role")?.trim().toLowerCase();
    return declared2 === role || implicitRole(element) === role;
  }

  // src/content/identity/corroboration.ts
  var EXACT_SIMILARITY = 0.92;
  var DISTINGUISHING_SIGNALS = ["visibleText", "accessibleName", "label", "id", "testId"];
  function corroboratesExactly(score) {
    return score.positiveContributions.some(
      (contribution) => DISTINGUISHING_SIGNALS.includes(contribution.signalPath) && contribution.weight > 0 && contribution.score / contribution.weight >= EXACT_SIMILARITY
    );
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

  // src/content/identity/context.ts
  var MAX_CONTEXT_TEXT = 200;
  var HEADING_SELECTOR = "h1,h2,h3,h4,h5,h6,[role='heading']";
  var LIST_ITEM_SELECTOR = "li,[role='listitem'],[role='option'],[role='treeitem']";
  var MAX_LANDMARK_DEPTH = 30;
  var MAX_HEADING_LEVELS = 10;
  var MAX_HEADING_SIBLINGS = 12;
  var MAX_HEADING_SUBTREE_QUERIES = 24;
  var MAX_LABELLEDBY_IDS2 = 8;
  var FORM_CONTROL_TAGS = /* @__PURE__ */ new Set(["input", "select", "textarea"]);
  var LANDMARK_ROLES = /* @__PURE__ */ new Set(["banner", "complementary", "contentinfo", "form", "main", "navigation", "region", "search"]);
  var LANDMARK_TAG_ROLES = {
    main: "main",
    nav: "navigation",
    header: "banner",
    footer: "contentinfo",
    aside: "complementary",
    search: "search",
    section: "region",
    form: "form"
  };
  function elementContext2(element) {
    const form = owningForm(element);
    const landmark = nearestLandmark(element);
    const context = present({
      formId: formAttribute(form, "id"),
      formName: formAttribute(form, "name"),
      formAction: formAttribute(form, "action"),
      fieldsetLegend: fieldsetLegend(element),
      landmark: landmark?.role,
      landmarkName: landmark ? landmarkName(landmark.element) : void 0,
      heading: nearestHeading(element),
      listPosition: listPosition2(element),
      tablePosition: tablePosition2(element)
    });
    return Object.keys(context).length ? context : void 0;
  }
  function owningForm(element) {
    const owned = element.form;
    return owned ?? element.closest("form");
  }
  function formAttribute(form, name) {
    return form ? boundedText2(form.getAttribute(name), MAX_CONTEXT_TEXT) : void 0;
  }
  function fieldsetLegend(element) {
    const legend = element.closest("fieldset")?.querySelector(":scope > legend");
    return legend ? contextText(legend) : void 0;
  }
  function contextText(element) {
    return boundedText2(textOutsideSensitiveControls(element), MAX_CONTEXT_TEXT);
  }
  function nearestLandmark(element) {
    let current = element;
    let depth = 0;
    while (current && depth < MAX_LANDMARK_DEPTH) {
      depth += 1;
      const role = landmarkRole(current);
      if (role) return { element: current, role };
      current = current.parentElement;
    }
    return void 0;
  }
  function landmarkName(landmark) {
    return labelledByText(landmark) ?? boundedText2(landmark.getAttribute("aria-label"), MAX_CONTEXT_TEXT) ?? boundedText2(landmark.getAttribute("title"), MAX_CONTEXT_TEXT);
  }
  function labelledByText(landmark) {
    const ids = (landmark.getAttribute("aria-labelledby") ?? "").split(/\s+/u).filter(Boolean).slice(0, MAX_LABELLEDBY_IDS2);
    const parts2 = ids.flatMap((id) => {
      const target = landmark.ownerDocument?.getElementById(id);
      if (!target || target === landmark || holdsInput(target)) return [];
      const text3 = contextText(target);
      return text3 ? [text3] : [];
    });
    return boundedText2(parts2.join(" "), MAX_CONTEXT_TEXT);
  }
  function holdsInput(element) {
    return FORM_CONTROL_TAGS.has(element.tagName.toLowerCase()) || element.isContentEditable === true;
  }
  function landmarkRole(element) {
    const explicit = element.getAttribute("role")?.trim().toLowerCase();
    if (explicit) return LANDMARK_ROLES.has(explicit) ? explicit : void 0;
    const tag = element.tagName.toLowerCase();
    const implicit = LANDMARK_TAG_ROLES[tag];
    if (!implicit) return void 0;
    if ((tag === "section" || tag === "form") && !hasAuthoredName2(element)) return void 0;
    return implicit;
  }
  function nearestHeading(element) {
    let current = element;
    let levels = 0;
    let queries = 0;
    while (current && levels < MAX_HEADING_LEVELS) {
      levels += 1;
      let sibling = current.previousElementSibling;
      let scanned = 0;
      while (sibling && scanned < MAX_HEADING_SIBLINGS) {
        scanned += 1;
        if (sibling.matches(HEADING_SELECTOR)) return contextText(sibling);
        if (sibling.firstElementChild && queries < MAX_HEADING_SUBTREE_QUERIES) {
          queries += 1;
          const headings = sibling.querySelectorAll(HEADING_SELECTOR);
          const last = headings[headings.length - 1];
          if (last) return contextText(last);
        }
        sibling = sibling.previousElementSibling;
      }
      current = current.parentElement;
    }
    return void 0;
  }
  function listPosition2(element) {
    const item = element.closest(LIST_ITEM_SELECTOR);
    const parent = item?.parentElement;
    if (!item || !parent) return void 0;
    const siblings = [...parent.children].filter((child2) => child2.matches(LIST_ITEM_SELECTOR));
    const index = siblings.indexOf(item);
    return index < 0 ? void 0 : { index: index + 1, total: siblings.length };
  }
  function tablePosition2(element) {
    const cell = element.closest("td,th");
    if (!(cell instanceof HTMLTableCellElement)) return void 0;
    const row = cell.closest("tr");
    if (!(row instanceof HTMLTableRowElement) || row.rowIndex < 0 || cell.cellIndex < 0) return void 0;
    return present({
      row: row.rowIndex + 1,
      column: cell.cellIndex + 1,
      columnHeader: columnHeader(row, cell)
    });
  }
  function columnHeader(row, cell) {
    const table = row.closest("table");
    if (!(table instanceof HTMLTableElement)) return void 0;
    const headerRow = table.tHead?.rows[0] ?? table.rows[0];
    const header = headerRow?.cells[cell.cellIndex];
    return header ? contextText(header) : void 0;
  }
  function hasAuthoredName2(element) {
    return element.hasAttribute("aria-label") || element.hasAttribute("aria-labelledby") || element.hasAttribute("title");
  }

  // ../../../!FluxIQ/packages/fluxiq/src/programs/automation-studio/fingerprinting/element-fingerprint.ts
  var DEFAULT_ELEMENT_FINGERPRINT_WEIGHTS = {
    visibleText: 24,
    accessibleName: 24,
    label: 20,
    id: 26,
    testId: 28,
    automationId: 28,
    entityId: 24,
    statePath: 22,
    role: 10,
    tagName: 7,
    entityKind: 8,
    selector: 14,
    queryPath: 13,
    xpath: 11,
    url: 10,
    classNames: 5,
    bounds: 8,
    attributes: 6,
    visibility: 4
  };
  function createAutomationStudioElementMatcher(options = {}) {
    const weights = { ...DEFAULT_ELEMENT_FINGERPRINT_WEIGHTS, ...options.weights ?? {} };
    return {
      weights,
      scoreCandidate: (fingerprint, candidate, scoringOptions) => scoreElementFingerprintCandidate(fingerprint, candidate, { weights, ...scoringOptions }),
      scoreCandidates: (fingerprint, candidates, scoringOptions) => scoreElementFingerprintCandidates(fingerprint, candidates, { weights, ...scoringOptions }),
      bestCandidate: (fingerprint, candidates, scoringOptions) => bestElementFingerprintCandidate(fingerprint, candidates, { weights, ...scoringOptions }),
      candidatesFromStateSnapshot
    };
  }
  function scoreElementFingerprintCandidates(fingerprint, candidates, options = {}) {
    const minimum = options.minimumNormalizedScore ?? 0;
    return candidates.map((candidate) => scoreElementFingerprintCandidate(fingerprint, candidate, options)).filter((score) => score.normalizedScore >= minimum).sort((left, right) => right.totalScore - left.totalScore || right.normalizedScore - left.normalizedScore || left.candidateId.localeCompare(right.candidateId));
  }
  function bestElementFingerprintCandidate(fingerprint, candidates, options = {}) {
    return scoreElementFingerprintCandidates(fingerprint, candidates, options)[0] ?? null;
  }
  function scoreElementFingerprintCandidate(fingerprint, candidate, options = {}) {
    const weights = { ...DEFAULT_ELEMENT_FINGERPRINT_WEIGHTS, ...options.weights ?? {} };
    const positiveContributions = [];
    const negativeContributions = [];
    const matchedSignals = [];
    const failedSignals = [];
    let possibleScore = 0;
    const contribute = (signalPath, similarity, reason, metadata) => {
      const weight = weights[signalPath];
      possibleScore += weight;
      const score = round(weight * similarity);
      const contribution = { signalPath, score, weight, reason, ...metadata ? { metadata } : {} };
      if (score >= 0) {
        positiveContributions.push(contribution);
        if (similarity >= 0.78) matchedSignals.push(signalPath);
      } else {
        negativeContributions.push(contribution);
        failedSignals.push(signalPath);
      }
    };
    compareTextSignal("visibleText", fingerprint.visibleText, candidate.visibleText, weights.visibleText, contribute);
    compareTextSignal("accessibleName", fingerprint.accessibleName, candidate.accessibleName, weights.accessibleName, contribute);
    compareTextSignal("label", fingerprint.label, candidate.label, weights.label, contribute);
    compareExactSignal("id", fingerprint.id, candidate.id, contribute);
    compareExactSignal("testId", fingerprint.testId, candidate.testId, contribute);
    compareExactSignal("automationId", fingerprint.automationId, candidate.automationId, contribute);
    compareExactSignal("entityId", fingerprint.entityId, candidate.entityId, contribute);
    compareExactSignal("statePath", statePathKey(fingerprint.statePath), statePathKey(candidate.statePath), contribute);
    compareLooseSignal("role", fingerprint.role, candidate.role, contribute);
    compareLooseSignal("tagName", fingerprint.tagName, candidate.tagName, contribute);
    compareLooseSignal("entityKind", fingerprint.entityKind, candidate.entityKind, contribute);
    comparePathSignal("selector", fingerprint.selector, candidate.selector, contribute);
    comparePathSignal("queryPath", fingerprint.queryPath, candidate.queryPath, contribute);
    comparePathSignal("xpath", fingerprint.xpath, candidate.xpath, contribute);
    compareUrlSignal(fingerprint.url, candidate.url, contribute);
    compareClassNames(fingerprint.classNames, candidate.classNames, contribute);
    compareAttributes(fingerprint.attributes, candidate.attributes, contribute);
    compareBounds(fingerprint.bounds, candidate.bounds, contribute);
    if (candidate.isVisibleOnViewport === true) contribute("visibility", 1, "candidate is visible on the viewport");
    const totalScore = round([...positiveContributions, ...negativeContributions].reduce((sum, item) => sum + item.score, 0));
    const normalizedScore = possibleScore > 0 ? clamp(round(totalScore / possibleScore), -1, 1) : 0;
    const strongMatches = matchedSignals.filter((signal) => ["visibleText", "accessibleName", "label", "id", "testId", "automationId", "entityId", "statePath"].includes(signal)).length;
    const confidence = clamp(round(Math.max(0, normalizedScore) * (0.82 + Math.min(strongMatches, 3) * 0.06)), 0, 1);
    return { candidateId: candidate.candidateId, totalScore, normalizedScore, confidence, matchedSignals, failedSignals, positiveContributions, negativeContributions, candidate, ...options.metadata ? { metadata: options.metadata } : {} };
  }
  function candidatesFromStateSnapshot(snapshot, options = {}) {
    const candidates = /* @__PURE__ */ new Map();
    for (const frame of snapshot.presentation?.visualFrames ?? []) {
      for (const layer of frame.layers) {
        if (!options.includeHidden && "isVisibleOnViewport" in layer && layer.isVisibleOnViewport === false) continue;
        const candidate = candidateFromVisualLayer(layer, frame.id, snapshot.id);
        if (candidate) candidates.set(candidate.candidateId, candidate);
      }
    }
    for (const [namespace, stateNamespace] of Object.entries(snapshot.namespaces)) {
      for (const [path, value] of Object.entries(stateNamespace.values)) {
        const candidate = candidateFromStateValue(namespace, path, value, snapshot.id);
        if (candidate && !candidates.has(candidate.candidateId)) candidates.set(candidate.candidateId, candidate);
      }
    }
    return [...candidates.values()];
  }
  function candidateFromVisualLayer(layer, visualFrameId, stateSnapshotId) {
    if (layer.kind === "image") return null;
    const metadata = layer.metadata ?? {};
    const anchor = "anchor" in layer ? layer.anchor : void 0;
    const entityId = readString(metadata.entityId) ?? (anchor?.type === "entity" ? anchor.entityId : void 0) ?? (anchor?.type === "element" ? anchor.elementId : void 0);
    const candidateId = entityId ?? readString(metadata.id) ?? readString(metadata.testId) ?? readString(metadata.automationId) ?? ("statePath" in layer ? layer.statePath : void 0) ?? `${visualFrameId}:${layer.id}`;
    return compactCandidate({
      candidateId,
      visualFrameId,
      visualLayerId: layer.id,
      visibleText: layer.kind === "text" ? layer.content : readString(metadata.visibleText),
      accessibleName: readString(metadata.accessibleName) ?? readString(metadata.ariaLabel),
      label: "label" in layer ? layer.label : readString(metadata.label),
      id: readString(metadata.id),
      testId: readString(metadata.testId) ?? readString(metadata.dataTestId),
      automationId: readString(metadata.automationId),
      entityId,
      entityKind: readString(metadata.entityKind) ?? (anchor?.type === "entity" ? anchor.entityKind : void 0),
      tagName: readString(metadata.tagName),
      role: readString(metadata.role),
      selector: readString(metadata.selector),
      xpath: readString(metadata.xpath),
      queryPath: readString(metadata.queryPath),
      statePath: "statePath" in layer ? layer.statePath : void 0,
      url: readString(metadata.url),
      classNames: readStringArray(metadata.classNames),
      bounds: "bounds" in layer ? layer.bounds : void 0,
      attributes: readAttributes(metadata.attributes),
      isVisibleOnViewport: "isVisibleOnViewport" in layer ? layer.isVisibleOnViewport : void 0,
      metadata: { ...metadata, ...stateSnapshotId ? { stateSnapshotId } : {} }
    });
  }
  function candidateFromStateValue(namespace, path, value, stateSnapshotId) {
    if (value.sensitive) return null;
    const metadata = value.metadata ?? {};
    const presentation = value.presentation;
    const statePath = { namespace, path };
    const label = presentation?.label ?? readString(metadata.label);
    const entityId = readString(metadata.entityId) ?? (presentation?.anchor?.type === "entity" ? presentation.anchor.entityId : void 0) ?? (presentation?.anchor?.type === "element" ? presentation.anchor.elementId : void 0);
    const visibleText2 = typeof value.value === "string" || typeof value.value === "number" || typeof value.value === "boolean" ? String(value.value) : readString(metadata.visibleText);
    if (!entityId && !label && !visibleText2 && !readString(metadata.selector) && !readString(metadata.xpath)) return null;
    return compactCandidate({
      candidateId: entityId ?? `${namespace}.${path}`,
      visibleText: visibleText2,
      accessibleName: readString(metadata.accessibleName) ?? readString(metadata.ariaLabel),
      label,
      id: readString(metadata.id),
      testId: readString(metadata.testId) ?? readString(metadata.dataTestId),
      automationId: readString(metadata.automationId),
      entityId,
      entityKind: readString(metadata.entityKind),
      tagName: readString(metadata.tagName),
      role: value.semanticRole ?? readString(metadata.role),
      selector: readString(metadata.selector),
      xpath: readString(metadata.xpath),
      queryPath: readString(metadata.queryPath),
      statePath,
      url: readString(metadata.url),
      classNames: readStringArray(metadata.classNames),
      attributes: readAttributes(metadata.attributes),
      metadata: { ...metadata, ...stateSnapshotId ? { stateSnapshotId } : {} }
    });
  }
  function compareTextSignal(signalPath, expected, actual, _weight, contribute) {
    if (!hasText(expected)) return;
    if (!hasText(actual)) {
      contribute(signalPath, -0.45, "candidate is missing text");
      return;
    }
    const similarity = textSimilarity(expected, actual);
    contribute(signalPath, similarity >= 0.35 ? similarity : -0.55, similarity >= 0.92 ? "text matched exactly" : "text compared by normalized overlap", { expected: normalizeText(expected), actual: normalizeText(actual) });
  }
  var MISSING_STABLE_IDENTIFIER_SIMILARITY = -0.1;
  var CONTRADICTED_STABLE_IDENTIFIER_SIMILARITY = -0.8;
  function compareExactSignal(signalPath, expected, actual, contribute) {
    if (!hasText(expected)) return;
    if (!hasText(actual)) {
      contribute(signalPath, MISSING_STABLE_IDENTIFIER_SIMILARITY, "candidate is missing stable identifier");
      return;
    }
    contribute(signalPath, normalizeCase(expected) === normalizeCase(actual) ? 1 : CONTRADICTED_STABLE_IDENTIFIER_SIMILARITY, "stable identifier comparison", { expected, actual });
  }
  function compareLooseSignal(signalPath, expected, actual, contribute) {
    if (!hasText(expected)) return;
    if (!hasText(actual)) {
      contribute(signalPath, -0.25, "candidate is missing semantic signal");
      return;
    }
    contribute(signalPath, normalizeCase(expected) === normalizeCase(actual) ? 1 : -0.35, "semantic signal comparison", { expected, actual });
  }
  function comparePathSignal(signalPath, expected, actual, contribute) {
    if (!hasText(expected)) return;
    if (!hasText(actual)) {
      contribute(signalPath, -0.25, "candidate is missing structural path");
      return;
    }
    const similarity = pathSimilarity(expected, actual);
    contribute(signalPath, similarity >= 0.5 ? similarity : -0.3, "structural path comparison", { expected, actual });
  }
  function compareUrlSignal(expected, actual, contribute) {
    if (!hasText(expected)) return;
    if (!hasText(actual)) {
      contribute("url", -0.15, "candidate is missing URL context");
      return;
    }
    contribute("url", urlSimilarity(expected, actual), "URL context comparison", { expected, actual });
  }
  function compareClassNames(expected, actual, contribute) {
    if (!expected?.length) return;
    if (!actual?.length) {
      contribute("classNames", -0.1, "candidate is missing class names");
      return;
    }
    const overlap = jaccard(expected.map(normalizeCase), actual.map(normalizeCase));
    contribute("classNames", overlap >= 0.2 ? overlap : -0.1, "class name overlap", { expected: expected.join(" "), actual: actual.join(" ") });
  }
  function compareAttributes(expected, actual, contribute) {
    const entries = Object.entries(expected ?? {}).filter(([, value]) => hasText(value));
    if (!entries.length) return;
    if (!actual) {
      contribute("attributes", -0.2, "candidate is missing attributes");
      return;
    }
    const matches = entries.filter(([key, value]) => normalizeCase(actual[key]) === normalizeCase(value)).length;
    contribute("attributes", matches / entries.length, "attribute comparison", { matched: matches, expected: entries.length });
  }
  function compareBounds(expected, actual, contribute) {
    if (!expected) return;
    if (!actual) {
      contribute("bounds", -0.15, "candidate is missing bounds");
      return;
    }
    const expectedCenter = center(expected);
    const actualCenter = center(actual);
    const diagonal = Math.max(Math.hypot(expected.width, expected.height), 1);
    const distance = Math.hypot(expectedCenter.x - actualCenter.x, expectedCenter.y - actualCenter.y);
    const sizeRatio = Math.min(area(expected), area(actual)) / Math.max(area(expected), area(actual), 1);
    const similarity = clamp((1 - Math.min(distance / diagonal, 1)) * 0.7 + sizeRatio * 0.3, 0, 1);
    contribute("bounds", similarity, "bounds proximity comparison", { distance: round(distance), sizeRatio: round(sizeRatio) });
  }
  function textSimilarity(left, right) {
    const normalizedLeft = normalizeText(left);
    const normalizedRight = normalizeText(right);
    if (normalizedLeft === normalizedRight) return 1;
    if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return 0.82;
    return jaccard(normalizedLeft.split(" "), normalizedRight.split(" "));
  }
  function pathSimilarity(left, right) {
    const normalizedLeft = left.trim();
    const normalizedRight = right.trim();
    if (normalizedLeft === normalizedRight) return 1;
    const leftParts = normalizedLeft.split(/[\s>/.[\]()=:]+/).filter(Boolean).map(normalizeCase);
    const rightParts = normalizedRight.split(/[\s>/.[\]()=:]+/).filter(Boolean).map(normalizeCase);
    return jaccard(leftParts, rightParts);
  }
  function urlSimilarity(left, right) {
    try {
      const leftUrl = new URL(left);
      const rightUrl = new URL(right);
      if (leftUrl.origin !== rightUrl.origin) return -0.2;
      return leftUrl.pathname === rightUrl.pathname ? 1 : 0.55;
    } catch {
      return normalizeCase(left) === normalizeCase(right) ? 1 : -0.1;
    }
  }
  function jaccard(left, right) {
    const leftSet = new Set(left.filter(Boolean));
    const rightSet = new Set(right.filter(Boolean));
    if (!leftSet.size || !rightSet.size) return 0;
    const intersection = [...leftSet].filter((value) => rightSet.has(value)).length;
    return intersection / (/* @__PURE__ */ new Set([...leftSet, ...rightSet])).size;
  }
  function center(bounds) {
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  }
  function area(bounds) {
    return Math.max(bounds.width, 0) * Math.max(bounds.height, 0);
  }
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function round(value) {
    return Math.round(value * 1e3) / 1e3;
  }
  function hasText(value) {
    return typeof value === "string" && value.trim().length > 0;
  }
  function normalizeCase(value) {
    return normalizeText(value ?? "");
  }
  function normalizeText(value) {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
  }
  function statePathKey(value) {
    return typeof value === "string" ? value : value ? `${value.namespace}.${value.path}` : void 0;
  }
  function readString(value) {
    return typeof value === "string" && value.trim() ? value : void 0;
  }
  function readStringArray(value) {
    if (Array.isArray(value)) return value.flatMap((item) => typeof item === "string" && item.trim() ? [item] : []);
    if (typeof value === "string" && value.trim()) return value.split(/\s+/).filter(Boolean);
    return void 0;
  }
  function readAttributes(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
    const entries = Object.entries(value).flatMap(([key, item]) => typeof item === "string" ? [[key, item]] : []);
    return entries.length ? Object.fromEntries(entries) : void 0;
  }
  function compactCandidate(value) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== void 0));
  }

  // src/content/identity/score.ts
  var TARGET_SCORE_FLOOR = 0.35;
  var TARGET_SCORE_MARGIN = 0.2;
  var matcher = createAutomationStudioElementMatcher();
  function scoreTargetCandidates(target, candidates) {
    if (!candidates.length) return { outcome: "unmatched", ranked: [] };
    const elements = new Map(candidates.map((candidate) => [candidate.fingerprint, candidate.element]));
    const fingerprint = comparableFingerprint(target);
    if (!hasIdentitySignal(fingerprint)) return { outcome: "unmatched", ranked: [] };
    const ranked = matcher.scoreCandidates(fingerprint, candidates.map((candidate) => candidate.fingerprint), { minimumNormalizedScore: -1 }).flatMap((score) => {
      const element = elements.get(score.candidate);
      return element ? [{ element, score }] : [];
    });
    const chosen = ranked[0];
    if (!chosen || chosen.score.normalizedScore < TARGET_SCORE_FLOOR) return { outcome: "unmatched", ranked };
    const runnerUp = ranked[1];
    if (runnerUp && chosen.score.normalizedScore - runnerUp.score.normalizedScore < TARGET_SCORE_MARGIN) {
      return { outcome: "ambiguous", ranked };
    }
    if (!corroboratesExactly(chosen.score)) return { outcome: "unmatched", ranked };
    return { outcome: "resolved", chosen, runnerUp, ranked };
  }
  function scoreTargetCandidate(target, candidate) {
    const fingerprint = comparableFingerprint(target);
    if (!hasIdentitySignal(fingerprint)) return void 0;
    return matcher.scoreCandidate(fingerprint, candidate.fingerprint);
  }
  function comparableFingerprint(target) {
    const testId = target.testId ?? target.attributes?.["data-testid"];
    const role = target.role?.trim() || target.implicitRole?.trim();
    return {
      ...target.visibleText ? { visibleText: target.visibleText } : {},
      ...target.accessibleName ? { accessibleName: target.accessibleName } : {},
      ...target.label ? { label: target.label } : {},
      ...target.id ? { id: target.id } : {},
      ...testId ? { testId } : {},
      ...target.tagName ? { tagName: target.tagName.toLowerCase() } : {},
      ...role ? { role } : {},
      ...target.selector ? { selector: target.selector } : {},
      ...target.classNames?.length ? { classNames: target.classNames } : {}
    };
  }
  var IDENTITY_SIGNALS = ["visibleText", "accessibleName", "label", "id", "testId", "selector", "classNames"];
  function hasIdentitySignal(fingerprint) {
    return IDENTITY_SIGNALS.some((signal) => {
      const value = fingerprint[signal];
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    });
  }

  // src/content/identity/veto.ts
  var TARGET_VETO_FLOOR = 0;
  function vetoCandidate(target, candidate) {
    if (!recordedDistinguisher(target)) return {};
    const score = scoreTargetCandidate(target, candidate);
    if (!score) return {};
    const measurement = { score: score.normalizedScore, confidence: score.confidence };
    if (measurement.score < TARGET_VETO_FLOOR) return { measurement, refusedBecause: "contradicted" };
    return corroboratesExactly(score) ? { measurement } : { measurement, refusedBecause: "uncorroborated" };
  }
  function vetoExactMatch(target, element) {
    if (!recordedDistinguisher(target)) return {};
    const verdict = vetoCandidate(target, { element, fingerprint: candidateFingerprint(element, 0) });
    if (!verdict.refusedBecause) return verdict;
    const because = verdict.refusedBecause === "uncorroborated" ? " with nothing the recording named agreeing exactly" : "";
    return { ...verdict, summary: `refused ${candidateLabel(element)} scoring ${verdict.measurement.score.toFixed(2)}${because}` };
  }
  function recordedDistinguisher(target) {
    return Boolean(
      target.visibleText?.trim() || target.accessibleName?.trim() || target.label?.trim() || target.id?.trim() || target.testId?.trim() || target.attributes?.["data-testid"]?.trim()
    );
  }

  // src/content/visual-bounds.ts
  function visualViewportBounds(element) {
    return visibleViewportBounds(element) ?? (isInteractableUiElement(element) ? renderedTextViewportBounds(element) : directTextViewportBounds(element));
  }
  function visualDocumentBounds(element) {
    return documentBounds(element) ?? (isInteractableUiElement(element) ? renderedTextBounds(element) : directTextBounds(element));
  }
  function visibleViewportBounds(element) {
    const rect2 = element.getBoundingClientRect();
    const fallbackBounds = !hasUsableRect(rect2) ? directTextViewportBounds(element) : void 0;
    if (fallbackBounds) return fallbackBounds;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const left = Math.max(0, rect2.left);
    const top = Math.max(0, rect2.top);
    const right = Math.min(viewportWidth, rect2.right);
    const bottom = Math.min(viewportHeight, rect2.bottom);
    const width = right - left;
    const height = bottom - top;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) return void 0;
    return {
      x: Math.round(left * 100) / 100,
      y: Math.round(top * 100) / 100,
      width: Math.round(width * 100) / 100,
      height: Math.round(height * 100) / 100
    };
  }
  function documentBounds(element) {
    const rect2 = element.getBoundingClientRect();
    if (!hasUsableRect(rect2)) return void 0;
    const width = rect2.width;
    const height = rect2.height;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) return void 0;
    return {
      x: Math.round((rect2.left + window.scrollX) * 100) / 100,
      y: Math.round((rect2.top + window.scrollY) * 100) / 100,
      width: Math.round(width * 100) / 100,
      height: Math.round(height * 100) / 100
    };
  }
  function directTextBounds(element) {
    return textRangeBounds(element, "document", "direct");
  }
  function renderedTextBounds(element) {
    return textRangeBounds(element, "document", "descendant");
  }
  function directTextViewportBounds(element) {
    return textRangeBounds(element, "viewport", "direct");
  }
  function renderedTextViewportBounds(element) {
    return textRangeBounds(element, "viewport", "descendant");
  }
  function textRangeBounds(element, coordinateSpace, scope) {
    const textNodes = scope === "direct" ? directTextNodes(element) : descendantTextNodes(element);
    if (!textNodes.length) return void 0;
    const rects = [];
    for (const node of textNodes) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect2 of range.getClientRects()) {
        if (hasUsableRect(rect2)) rects.push(rect2);
      }
      range.detach();
    }
    return mergedBounds(rects, coordinateSpace);
  }
  function directTextNodes(element) {
    return [...element.childNodes].filter(
      (node) => node.nodeType === Node.TEXT_NODE && meaningfulText2(node.textContent)
    );
  }
  function descendantTextNodes(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => meaningfulText2(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const nodes = [];
    let current = walker.nextNode();
    while (current) {
      nodes.push(current);
      current = walker.nextNode();
    }
    return nodes;
  }
  function mergedBounds(rects, coordinateSpace) {
    if (!rects.length) return void 0;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let left = Number.POSITIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (const rect2 of rects) {
      const rectLeft = coordinateSpace === "viewport" ? Math.max(0, rect2.left) : rect2.left + window.scrollX;
      const rectTop = coordinateSpace === "viewport" ? Math.max(0, rect2.top) : rect2.top + window.scrollY;
      const rectRight = coordinateSpace === "viewport" ? Math.min(viewportWidth, rect2.right) : rect2.right + window.scrollX;
      const rectBottom = coordinateSpace === "viewport" ? Math.min(viewportHeight, rect2.bottom) : rect2.bottom + window.scrollY;
      if (rectRight - rectLeft < 2 || rectBottom - rectTop < 2) continue;
      left = Math.min(left, rectLeft);
      top = Math.min(top, rectTop);
      right = Math.max(right, rectRight);
      bottom = Math.max(bottom, rectBottom);
    }
    const width = right - left;
    const height = bottom - top;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 2 || height < 2) return void 0;
    return {
      x: Math.round(left * 100) / 100,
      y: Math.round(top * 100) / 100,
      width: Math.round(width * 100) / 100,
      height: Math.round(height * 100) / 100
    };
  }
  function hasUsableRect(rect2) {
    return Number.isFinite(rect2.width) && Number.isFinite(rect2.height) && rect2.width >= 2 && rect2.height >= 2;
  }

  // src/content/evidence/dialogs.ts
  var DIALOG_SELECTOR = "dialog[open],[role='dialog'],[role='alertdialog'],[aria-modal='true']";
  var MAX_DIALOGS = 5;
  function dialogEvidence() {
    const open = openDialogs();
    const armPending = document.documentElement?.hasAttribute(DIALOG_ARM_ATTRIBUTE) === true;
    const lastNative = lastNativeDialog();
    if (!open.length && !armPending && !lastNative) return void 0;
    return present({
      open,
      modal: open.some((dialog) => dialog.modal),
      armPending: armPending ? true : void 0,
      lastNative
    });
  }
  function openDialogs() {
    const found = [];
    for (const element of document.querySelectorAll(DIALOG_SELECTOR)) {
      if (isShown(element)) found.push(describeDialog(element));
    }
    return found.reverse().slice(0, MAX_DIALOGS);
  }
  function describeDialog(element) {
    const native = element instanceof HTMLDialogElement;
    const role = element.getAttribute("role")?.trim().toLowerCase();
    const label = accessibleNameFor(element);
    const bounds = visualViewportBounds(element);
    return present({
      selector: selectorFor(element),
      role: role || "dialog",
      // A native <dialog> opened with showModal() reports `::backdrop`; the
      // property the page can be asked for is `open`, so modality is taken from
      // the author's own declaration plus the inert page behind it.
      modal: element.getAttribute("aria-modal") === "true" || native && isNativeModal(element),
      native,
      label: label || void 0,
      bounds
    });
  }
  function isNativeModal(element) {
    try {
      return element.matches(":modal");
    } catch {
      return false;
    }
  }
  function isShown(element) {
    if (element.closest("[hidden],[aria-hidden='true']")) return false;
    if (element instanceof HTMLDialogElement && !element.open) return false;
    const style2 = getComputedStyle(element);
    return style2.display !== "none" && style2.visibility !== "hidden" && Number(style2.opacity) !== 0;
  }
  function lastNativeDialog() {
    const raw = document.documentElement?.getAttribute(DIALOG_OBSERVED_ATTRIBUTE);
    const observed = raw === null || raw === void 0 ? void 0 : decodeDialogObserved(raw);
    return observed && { kind: observed.kind, message: observed.message, response: observed.response, at: observed.at };
  }

  // src/content/evidence/forms.ts
  var MAX_FORMS = 8;
  var MAX_CONTROLS_PER_FORM = 30;
  var MAX_TEXT = 200;
  var MAX_AUTOCOMPLETE_TOKENS = 16;
  var MAX_AUTOCOMPLETE_TOKEN_LENGTH = 64;
  var SUBMIT_SELECTOR = "button[type='submit'],button:not([type]),input[type='submit'],input[type='image']";
  function formEvidence() {
    const forms = [];
    for (const form of document.forms) {
      forms.push(describeForm(form));
      if (forms.length >= MAX_FORMS) break;
    }
    return forms.length ? forms : void 0;
  }
  function describeForm(form) {
    const owned = [...form.elements].filter(isReportableControl);
    const label = accessibleNameFor(form);
    const name = boundedText2(form.getAttribute("name"), MAX_TEXT);
    const action = boundedText2(form.getAttribute("action"), MAX_TEXT);
    const method = boundedText2(form.getAttribute("method"), MAX_TEXT)?.toLowerCase();
    const submit = owned.find((control) => control.matches(SUBMIT_SELECTOR));
    return present({
      selector: selectorFor(form),
      name: name || void 0,
      label: label || void 0,
      action: action || void 0,
      method: method || void 0,
      controlCount: owned.length,
      controls: owned.slice(0, MAX_CONTROLS_PER_FORM).map(describeControl),
      submit: submit ? selectorFor(submit) : void 0
    });
  }
  function isReportableControl(element) {
    return !(element instanceof HTMLInputElement && element.type.toLowerCase() === "hidden");
  }
  function describeControl(element) {
    const label = accessibleNameFor(element);
    const name = boundedText2(element.getAttribute("name"), MAX_TEXT);
    const valuePresent = hasEnteredValue(element);
    const autocomplete = autocompleteTokens(element);
    return present({
      selector: selectorFor(element),
      controlType: controlType(element),
      name: name || void 0,
      label: label || void 0,
      required: isRequired(element) ? true : void 0,
      disabled: isDisabled(element) ? true : void 0,
      hasValue: valuePresent,
      autocomplete: autocomplete || void 0,
      sensitive: isSensitiveFormControl(element) ? true : void 0
    });
  }
  function autocompleteTokens(element) {
    const tokens = (element.getAttribute("autocomplete") ?? "").split(/\s+/u).filter(Boolean).slice(0, MAX_AUTOCOMPLETE_TOKENS).map((token) => token.slice(0, MAX_AUTOCOMPLETE_TOKEN_LENGTH));
    return tokens.length ? tokens.join(" ") : void 0;
  }
  function controlType(element) {
    if (element instanceof HTMLInputElement) return element.type.toLowerCase();
    if (element instanceof HTMLButtonElement) return element.type.toLowerCase();
    return element.tagName.toLowerCase();
  }
  function isRequired(element) {
    return element.hasAttribute("required") || element.getAttribute("aria-required") === "true";
  }
  function isDisabled(element) {
    return element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true";
  }

  // src/content/event-elements.ts
  var MAX_OBSERVED_EVENT_ELEMENTS = 500;
  var observedEventElements = /* @__PURE__ */ new WeakSet();
  var queue = [];
  var observedEventElementQueue = queue;
  function rememberEventPathElements(event) {
    const target = eventTargetElement(event);
    const activationTarget = target ? pointerActivationTarget(target) ?? target : void 0;
    rememberObservedEventElement(activationTarget);
    for (const entry of event.composedPath()) {
      if (!(entry instanceof Element)) continue;
      if (entry === document.documentElement || entry === document.body) continue;
      if (!hasClickHandler(entry)) continue;
      rememberObservedEventElement(entry);
    }
  }
  function isEventBackedElement(element) {
    return observedEventElements.has(element) || hasClickHandler(element);
  }
  function eventTargetElement(event) {
    for (const entry of event.composedPath()) {
      if (entry instanceof Element) return entry;
    }
    return event.target instanceof Element ? event.target : void 0;
  }
  function pointerActivationTarget(element) {
    let current = element;
    for (let depth = 0; current && current !== document.documentElement && depth < 12; depth += 1) {
      if (isActionableElement(current)) return current;
      current = current.parentElement;
    }
    current = element;
    for (let depth = 0; current && current !== document.documentElement && depth < 12; depth += 1) {
      if (current instanceof HTMLElement && getComputedStyle(current).cursor === "pointer") return current;
      current = current.parentElement;
    }
    return void 0;
  }
  function actionEventTarget(element) {
    return pointerActivationTarget(element) ?? element;
  }
  function rememberObservedEventElement(element) {
    if (!element || observedEventElements.has(element)) return;
    observedEventElements.add(element);
    queue.push(element);
    while (queue.length > MAX_OBSERVED_EVENT_ELEMENTS) queue.shift();
  }

  // src/content/evidence/interactions.ts
  var MAX_TRACKED_INTERACTIONS = 25;
  var TRACKED_EVENTS = ["pointerdown", "click", "input", "change", "submit", "keydown"];
  var recent = [];
  function recentlyInteractedElements() {
    return new Set(recent);
  }
  function rememberInteractedElement(element) {
    if (!element) return;
    const existing = recent.indexOf(element);
    if (existing >= 0) recent.splice(existing, 1);
    recent.push(element);
    while (recent.length > MAX_TRACKED_INTERACTIONS) recent.shift();
  }
  function trackInteractions() {
    const remember = (event) => {
      const target = eventTargetElement(event);
      if (!target) return;
      rememberInteractedElement(target);
      rememberInteractedElement(actionEventTarget(target));
    };
    for (const type of TRACKED_EVENTS) document.addEventListener(type, remember, { capture: true, passive: true });
  }
  if (typeof document !== "undefined") trackInteractions();

  // src/content/evidence/loading.ts
  var MAX_INDICATORS = 8;
  var MAX_BUSY_REGIONS = 8;
  var MAX_LABEL_LENGTH3 = 120;
  var BUSY_SELECTOR = "[aria-busy='true']";
  var PROGRESS_SELECTOR = "progress,[role='progressbar']";
  var SPINNER_SELECTOR = "[class*='spinner'],[class*='loader'],[class*='loading'],[class*='skeleton'],[id*='spinner'],[id*='loading'],[data-testid*='spinner'],[data-testid*='loading']";
  var STATUS_SELECTOR = "[role='status'],[role='alert'],[aria-live='polite'],[aria-live='assertive']";
  var LOADING_WORDS = /\b(loading|saving|submitting|processing|uploading|refreshing|updating|working|please wait)\b/iu;
  function loadingEvidence() {
    const documentState = document.readyState;
    const busyRegions = selectors(BUSY_SELECTOR, MAX_BUSY_REGIONS);
    const indicators = loadingIndicators();
    const pendingNavigation = documentState !== "complete";
    return present({
      documentState,
      busy: pendingNavigation || busyRegions.length > 0 || indicators.length > 0,
      busyRegions,
      indicators,
      pendingNavigation
    });
  }
  function loadingIndicators() {
    const found = /* @__PURE__ */ new Map();
    for (const element of document.querySelectorAll(PROGRESS_SELECTOR)) {
      if (isPainted(element)) found.set(element, indicator(element, "progressbar"));
    }
    for (const element of document.querySelectorAll(STATUS_SELECTOR)) {
      if (found.has(element) || !isPainted(element)) continue;
      if (!LOADING_WORDS.test(element.textContent ?? "")) continue;
      found.set(element, indicator(element, "status"));
    }
    for (const element of document.querySelectorAll(SPINNER_SELECTOR)) {
      if (!found.has(element) && isPainted(element)) found.set(element, indicator(element, "spinner"));
    }
    return [...found.values()].slice(0, MAX_INDICATORS);
  }
  function indicator(element, kind) {
    const label = accessibleNameFor(element) ?? boundedText2(element.textContent, MAX_LABEL_LENGTH3);
    return present({ selector: selectorFor(element), kind, label: label || void 0 });
  }
  function selectors(selector, max) {
    const found = [];
    for (const element of document.querySelectorAll(selector)) {
      if (!isPainted(element)) continue;
      found.push(selectorFor(element));
      if (found.length >= max) break;
    }
    return found;
  }
  function isPainted(element) {
    if (element.closest("[hidden],[aria-hidden='true']")) return false;
    const style2 = getComputedStyle(element);
    if (style2.display === "none" || style2.visibility === "hidden" || Number(style2.opacity) === 0) return false;
    const rect2 = element.getBoundingClientRect();
    return rect2.width >= 1 && rect2.height >= 1;
  }

  // src/content/evidence/navigation.ts
  var MAX_URL_LENGTH = 2e3;
  function navigationEvidence() {
    const entry = navigationTiming();
    const url = new URL(location.href);
    const referrer = boundedText2(document.referrer, MAX_URL_LENGTH);
    return present({
      url: location.href.slice(0, MAX_URL_LENGTH),
      origin: url.origin,
      path: url.pathname,
      referrer: referrer || void 0,
      type: entry?.type || void 0,
      redirects: entry && entry.redirectCount > 0 ? entry.redirectCount : void 0,
      historyLength: history.length,
      visibility: document.visibilityState
    });
  }
  function navigationTiming() {
    try {
      const [entry] = performance.getEntriesByType("navigation");
      return entry instanceof PerformanceNavigationTiming ? entry : void 0;
    } catch {
      return void 0;
    }
  }

  // src/content/evidence/overlays.ts
  var MAX_HIT_TESTED = 40;
  var MAX_BLOCKERS = 5;
  var MAX_BLOCKED_PER_BLOCKER = 5;
  var MAX_BLOCKER_ANCESTOR_WALK = 12;
  function overlayEvidence(candidates) {
    const blockers = /* @__PURE__ */ new Map();
    let tested = 0;
    let blockedCount = 0;
    for (const candidate of candidates) {
      if (tested >= MAX_HIT_TESTED) break;
      if (!isInteractableUiElement(candidate)) continue;
      const point = hitPointFor(candidate);
      if (!point) continue;
      tested += 1;
      const blocker = blockerAt(candidate, point);
      if (!blocker) continue;
      blockedCount += 1;
      const covered = blockers.get(blocker);
      if (covered) covered.push(candidate);
      else blockers.set(blocker, [candidate]);
    }
    if (!blockedCount) return void 0;
    return present({ tested, blockedCount, blockers: rankBlockers(blockers) });
  }
  function hitPointFor(element) {
    const rect2 = element.getBoundingClientRect();
    if (rect2.width < 2 || rect2.height < 2) return void 0;
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (rect2.bottom <= 0 || rect2.right <= 0 || rect2.top >= height || rect2.left >= width) return void 0;
    const x = Math.min(Math.max(rect2.left + rect2.width / 2, 0), width - 1);
    const y = Math.min(Math.max(rect2.top + rect2.height / 2, 0), height - 1);
    return { x, y };
  }
  function blockerAt(candidate, point) {
    const hit = document.elementFromPoint(point.x, point.y);
    if (!hit || hit === candidate) return void 0;
    if (candidate.contains(hit) || hit.contains(candidate)) return void 0;
    return overlayRoot(hit, candidate);
  }
  function overlayRoot(hit, candidate) {
    let root = hit;
    for (let depth = 0; depth < MAX_BLOCKER_ANCESTOR_WALK; depth += 1) {
      const parent = root.parentElement;
      if (!parent || parent === document.documentElement || parent === document.body) break;
      if (parent.contains(candidate)) break;
      root = parent;
    }
    return root;
  }
  function rankBlockers(blockers) {
    return [...blockers.entries()].sort(([, left], [, right]) => right.length - left.length).slice(0, MAX_BLOCKERS).map(([element, covered]) => describeBlocker(element, covered));
  }
  function describeBlocker(element, covered) {
    const role = element.getAttribute("role")?.trim().toLowerCase();
    const label = accessibleNameFor(element);
    const bounds = visualViewportBounds(element);
    return present({
      selector: selectorFor(element),
      role: role || void 0,
      label: label || void 0,
      bounds,
      blocks: covered.length,
      blocked: covered.slice(0, MAX_BLOCKED_PER_BLOCKER).map((target) => selectorFor(target))
    });
  }

  // src/content/evidence/regions.ts
  var MAX_REGIONS = 20;
  var REGION_SELECTOR = "main,nav,header,footer,aside,section,form,search,[role='main'],[role='navigation'],[role='banner'],[role='contentinfo'],[role='complementary'],[role='search'],[role='region'],[role='form']";
  function regionEvidence() {
    const regions = [];
    for (const element of document.querySelectorAll(REGION_SELECTOR)) {
      const role = landmarkRole(element);
      if (!role) continue;
      const label = accessibleNameFor(element);
      const bounds = visualDocumentBounds(element);
      regions.push(present({
        role,
        selector: selectorFor(element),
        label: label || void 0,
        bounds
      }));
      if (regions.length >= MAX_REGIONS) break;
    }
    return regions.length ? regions : void 0;
  }

  // src/content/element-finder.ts
  function findClosestFingerprint(fingerprint) {
    const bySelector = query(fingerprint.selector);
    if (bySelector) return bySelector;
    if (fingerprint.xpath) {
      const result = document.evaluate(fingerprint.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      if (result instanceof Element) return result;
    }
    if (fingerprint.id) {
      const byId = document.getElementById(fingerprint.id);
      if (byId) return byId;
    }
    const tag = fingerprint.tagName || "*";
    const testId = fingerprint.attributes?.["data-testid"];
    if (testId) {
      const byTestId = query(`[data-testid="${cssString2(testId)}"]`);
      if (byTestId) return byTestId;
    }
    if (fingerprint.name) {
      const byName = query(`${tag}[aria-label="${cssString2(fingerprint.name)}"], ${tag}[name="${cssString2(fingerprint.name)}"]`);
      if (byName) return byName;
    }
    if (fingerprint.classNames?.length) {
      const byClass = query(`${tag}${fingerprint.classNames.map((className) => `.${CSS.escape(className)}`).join("")}`);
      if (byClass) return byClass;
    }
    if (fingerprint.visibleText) {
      const normalized = normalizeText2(fingerprint.visibleText);
      return [...document.querySelectorAll(tag)].find((element) => normalizeText2(element.textContent ?? "") === normalized) ?? null;
    }
    return null;
  }
  function xpathFor(element) {
    const parts2 = [];
    let current = element;
    while (current) {
      if (current.id) {
        parts2.unshift(`*[@id=${xpathString(current.id)}]`);
        break;
      }
      const siblings = current.parentElement ? [...current.parentElement.children].filter((sibling) => sibling.tagName === current.tagName) : [];
      parts2.unshift(`${current.tagName.toLowerCase()}[${Math.max(1, siblings.indexOf(current) + 1)}]`);
      current = current.parentElement;
    }
    return `/${parts2.join("/")}`;
  }
  function query(selector) {
    if (!selector) return null;
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }
  function normalizeText2(value) {
    return value.replace(/\s+/g, " ").trim();
  }
  function cssString2(value) {
    return CSS.escape(value).replace(/"/g, '\\"');
  }
  function xpathString(value) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  // src/content/describe-element.ts
  function describeElement(element) {
    const bounds = visualViewportBounds(element);
    const docBounds = visualDocumentBounds(element);
    const descriptor = {
      tagName: element.tagName.toLowerCase(),
      selector: selectorFor(element),
      isVisibleOnViewport: Boolean(bounds)
    };
    if (bounds) descriptor.bounds = bounds;
    if (docBounds) descriptor.documentBounds = docBounds;
    if (hasClickHandler(element)) descriptor.hasClickHandler = true;
    const text3 = isInteractableUiElement(element) || isSemanticTextElement2(element) ? visibleText(element) : directVisibleText(element);
    if (text3) {
      descriptor.text = text3;
      descriptor.visibleText = text3;
    }
    if (element.id) descriptor.id = element.id;
    const classNames = [...element.classList];
    if (classNames.length) descriptor.classNames = classNames;
    descriptor.xpath = xpathFor(element);
    const value = readElementValue(element);
    if (value !== void 0 && captureSettings.inputValues) descriptor.value = value;
    const role = element.getAttribute("role");
    if (role) descriptor.role = role;
    const name = authoredNameAttribute(element);
    if (name) descriptor.name = name;
    const href = linkHref(element);
    if (href) descriptor.href = href;
    if (element instanceof HTMLInputElement && element.type) descriptor.inputType = element.type;
    const checked = checkedState(element);
    if (checked !== void 0) descriptor.checked = checked;
    const valuePresent = hasEnteredValue(element);
    if (valuePresent !== void 0) descriptor.hasValue = valuePresent;
    const testId = testIdFor(element);
    if (testId) descriptor.testId = testId;
    const computedName = accessibleNameFor(element);
    if (computedName) descriptor.accessibleName = computedName;
    const label = labelText(element);
    if (label) descriptor.label = label;
    const markupRole = implicitRole(element);
    if (markupRole) descriptor.implicitRole = markupRole;
    const context = elementContext2(element);
    if (context) descriptor.context = context;
    const select = selectState(element);
    if (select) {
      descriptor.options = select.options;
      if (select.selectedValue !== void 0) descriptor.selectedValue = select.selectedValue;
    }
    const attributes = {};
    for (const attribute of ["id", "class", "name", "type", "autocomplete", "data-sensitive", "placeholder", "title", "alt", "href", "tabindex", "aria-label", "aria-labelledby", "aria-describedby", "for", "aria-disabled", "aria-expanded", "aria-controls", "aria-pressed", "aria-selected", "data-testid", "data-test", "data-cy", "disabled", "onclick"]) {
      const value2 = element.getAttribute(attribute);
      if (value2 !== null) attributes[attribute] = value2.slice(0, 500);
    }
    if (Object.keys(attributes).length) descriptor.attributes = attributes;
    return descriptor;
  }
  function visibleText(element) {
    const text3 = textOutsideSensitiveControls(element).replace(/\s+/g, " ").trim();
    return text3 ? text3.slice(0, 500) : void 0;
  }
  function directVisibleText(element) {
    const text3 = textOutsideSensitiveControls(element, "own").replace(/\s+/g, " ").trim();
    return text3 ? text3.slice(0, 500) : void 0;
  }
  function readElementValue(element) {
    if (!element) return void 0;
    if (isWithinSensitiveControl(element)) return void 0;
    if (element instanceof HTMLInputElement && element.type.toLowerCase() === "file") return void 0;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      return element.value.slice(0, 2e3);
    }
    if (element instanceof HTMLElement && element.isContentEditable) return element.innerText.slice(0, 2e3);
    return void 0;
  }
  function checkedState(element) {
    if (!(element instanceof HTMLInputElement)) return void 0;
    const type = element.type.toLowerCase();
    if (type !== "checkbox" && type !== "radio") return void 0;
    return isWithinSensitiveControl(element) ? void 0 : element.checked;
  }
  function selectState(element) {
    if (!(element instanceof HTMLSelectElement) || isWithinSensitiveControl(element)) return void 0;
    const options = [...element.options].slice(0, 20).map((option) => ({
      value: option.value.slice(0, 200),
      label: (option.label || option.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 200)
    }));
    const state = { options };
    if (options.some((option) => option.value === element.value)) state.selectedValue = element.value.slice(0, 200);
    return state;
  }
  function testIdFor(element) {
    return element.getAttribute("data-testid") ?? element.getAttribute("data-test") ?? element.getAttribute("data-cy") ?? void 0;
  }
  function linkHref(element) {
    if (element instanceof HTMLAnchorElement && element.href) return element.href;
    return element.getAttribute("href") ?? element.getAttribute("xlink:href") ?? void 0;
  }
  function stableElementId2(element) {
    return testIdFor(element) ?? element.getAttribute("id") ?? element.getAttribute("name") ?? void 0;
  }

  // src/content/evidence/repeating.ts
  var ITEM_SELECTOR = "li,tr,article,[data-testid],[role='listitem'],[role='row'],[role='option'],[role='article'],[role='treeitem']";
  var MAX_SCANNED_ITEMS = 2e3;
  var MIN_ITEMS_PER_RUN = 3;
  var MAX_STRUCTURES = 6;
  var MAX_FIELDS = 8;
  var MAX_REPRESENTATIVE_TEXT = 160;
  function repeatingEvidence() {
    const runs = clusterSiblings();
    if (!runs.length) return void 0;
    return runs.sort((left, right) => right.items.length - left.items.length).slice(0, MAX_STRUCTURES).map(describeRun);
  }
  function clusterSiblings() {
    const byContainer = /* @__PURE__ */ new Map();
    let scanned = 0;
    for (const element of document.querySelectorAll(ITEM_SELECTOR)) {
      scanned += 1;
      if (scanned > MAX_SCANNED_ITEMS) break;
      const container = element.parentElement;
      if (!container) continue;
      const groups = byContainer.get(container) ?? /* @__PURE__ */ new Map();
      byContainer.set(container, groups);
      const signature = templateSignature(element);
      const group = groups.get(signature);
      if (group) group.push(element);
      else groups.set(signature, [element]);
    }
    const runs = [];
    for (const [container, groups] of byContainer) {
      for (const [signature, items] of groups) {
        if (items.length >= MIN_ITEMS_PER_RUN) runs.push({ container, signature, items });
      }
    }
    return runs;
  }
  function templateSignature(element) {
    return webAutomationItemSignature({
      tagName: element.tagName,
      role: element.getAttribute("role"),
      testId: testIdFor(element),
      classes: element.classList
    });
  }
  function describeRun(run) {
    const first = run.items[0];
    const testId = first ? testIdFor(first) : void 0;
    const text3 = first ? boundedText2(first.textContent, MAX_REPRESENTATIVE_TEXT) : void 0;
    const fields = first ? itemFields(first) : [];
    return present({
      containerSelector: selectorFor(run.container),
      signature: run.signature,
      itemCount: run.items.length,
      // The representative is an inline shape on the contract rather than a named
      // type, so it is named by indexed access rather than restated here: a fifth
      // spelling of an evidence shape is the thing this whole seam exists to stop.
      representative: present({
        selector: first ? selectorFor(first) : run.signature,
        testId: testId || void 0,
        text: text3 || void 0
      }),
      fields: fields.length ? fields : void 0
    });
  }
  function itemFields(item) {
    const fields = /* @__PURE__ */ new Set();
    for (const element of item.querySelectorAll("[data-testid],[data-test],[data-cy]")) {
      const id = testIdFor(element);
      if (id) fields.add(webAutomationIdentifierShape(id));
      if (fields.size >= MAX_FIELDS) break;
    }
    return [...fields];
  }

  // src/content/evidence/page.ts
  function pageEvidence(entries, counts) {
    const activity = markElementActivity(entries, recentlyInteractedElements());
    const dialogs = dialogEvidence();
    const overlays = overlayEvidence(entries.map((entry) => entry.element));
    const regions = regionEvidence();
    const repeating = repeatingEvidence();
    const forms = formEvidence();
    return present({
      elements: {
        scanned: counts.scanned,
        candidates: counts.candidates,
        matched: counts.matched,
        returned: entries.length,
        truncated: counts.matched > entries.length,
        changed: activity.changed,
        recentlyInteracted: activity.recentlyInteracted
      },
      loading: loadingEvidence(),
      navigation: navigationEvidence(),
      dialogs,
      overlays,
      regions,
      repeating,
      forms
    });
  }

  // src/content/dom-snapshot.ts
  var MAX_SNAPSHOT_CANDIDATES = 2e3;
  var MAX_SNAPSHOT_SCAN_ELEMENTS = 5e4;
  function captureSnapshot() {
    return withSelectorMemo(captureSnapshotNow);
  }
  function captureSnapshotNow() {
    const { entries, counts } = snapshotElements();
    const evidence = pageEvidence(entries, counts);
    const snapshot = {
      url: location.href,
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth),
        documentHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight),
        devicePixelRatio: window.devicePixelRatio
      },
      frame: compactObject({
        isTop: isTopFrame(),
        viewportOffset: currentFrameViewportOffset()
      }),
      interactiveElements: entries.map((entry) => entry.descriptor),
      evidence
    };
    const focused = document.activeElement instanceof Element ? describeElement(document.activeElement) : void 0;
    if (focused) snapshot.focusedElement = focused;
    const selectedText = capturedSelectionText();
    if (selectedText) snapshot.selectedText = selectedText;
    return snapshot;
  }
  var MAX_SELECTED_TEXT = 2e3;
  var MAX_SELECTION_SCAN = 2e3;
  var SENSITIVE_CANDIDATE_SELECTOR = "input, textarea, select, [autocomplete], [data-sensitive]";
  function capturedSelectionText() {
    const selection = window.getSelection();
    const text3 = selection?.toString();
    if (!selection || !text3) return void 0;
    return selectionTouchesSensitiveControl(selection) ? void 0 : text3.slice(0, MAX_SELECTED_TEXT);
  }
  function selectionTouchesSensitiveControl(selection) {
    if (withinSensitiveControl(document.activeElement)) return true;
    if (withinSensitiveControl(selection.anchorNode) || withinSensitiveControl(selection.focusNode)) return true;
    const candidates = document.querySelectorAll(SENSITIVE_CANDIDATE_SELECTOR);
    if (candidates.length > MAX_SELECTION_SCAN) return true;
    const ranges = [];
    for (let index = 0; index < selection.rangeCount; index += 1) ranges.push(selection.getRangeAt(index));
    for (const candidate of candidates) {
      if (!isSensitiveFormControl(candidate)) continue;
      if (ranges.some((range) => range.intersectsNode(candidate))) return true;
    }
    return false;
  }
  function withinSensitiveControl(node) {
    let element = node instanceof Element ? node : node?.parentElement ?? null;
    while (element) {
      if (isSensitiveFormControl(element)) return true;
      element = element.parentElement;
    }
    return false;
  }
  function snapshotElements() {
    const seen = /* @__PURE__ */ new Set();
    const { candidates, scanned } = snapshotCandidateElements();
    const included = [];
    for (const element of candidates) {
      if (seen.has(element) || !shouldIncludeSnapshotElement(element)) continue;
      seen.add(element);
      included.push(element);
    }
    const entries = included.sort(
      (left, right) => snapshotElementBucket(left) - snapshotElementBucket(right) || elementPriority(right) - elementPriority(left) || documentOrder(left, right)
    ).slice(0, MAX_SNAPSHOT_CANDIDATES).map((element) => ({ element, descriptor: describeElement(element) }));
    return { entries, counts: { scanned, candidates: candidates.length, matched: included.length } };
  }
  function snapshotCandidateElements() {
    const seen = /* @__PURE__ */ new Set();
    const candidates = [];
    const add = (element) => {
      if (!element || seen.has(element)) return;
      seen.add(element);
      candidates.push(element);
    };
    for (const element of observedEventElementQueue) {
      if (element.isConnected) add(element);
    }
    for (const element of document.querySelectorAll("a[href],button,input:not([type=hidden]),textarea,select,summary,label,[role=button],[role=link],[role=menuitem],[role=checkbox],[role=radio],[role=tab],[role=switch],[contenteditable=true]")) add(element);
    for (const element of document.querySelectorAll("p,h1,h2,h3,h4,h5,h6,li,td,th,blockquote,dt,dd,figcaption")) add(element);
    for (const element of document.querySelectorAll("img,svg,picture,canvas,video")) add(element);
    let scanned = 0;
    for (const element of document.querySelectorAll("*")) {
      scanned += 1;
      if (scanned > MAX_SNAPSHOT_SCAN_ELEMENTS) break;
      if (!hasElementPresentation(element)) continue;
      add(element);
    }
    return { candidates, scanned };
  }
  function shouldIncludeSnapshotElement(element) {
    if (element === document.documentElement || element === document.body) return false;
    if (element.closest("script, style, noscript, template")) return false;
    if (element.closest("[hidden], [aria-hidden='true']")) return false;
    const bounds = visualDocumentBounds(element);
    if (!bounds) return false;
    const style2 = getComputedStyle(element);
    if (style2.visibility === "hidden" || style2.display === "none" || Number(style2.opacity) === 0) return false;
    return isEventBackedElement(element) ? hasEventElementPresentation(element) : isInteractableUiElement(element) ? hasMeaningfulInteractableIdentity(element) : hasElementPresentation(element);
  }
  function snapshotElementBucket(element) {
    if (isEventBackedElement(element)) return 0;
    if (isPrimaryControlElement2(element)) return 1;
    if (isInteractableUiElement(element)) return 2;
    if (isSemanticTextElement2(element)) return 3;
    if (meaningfulText2(directVisibleText(element))) return 4;
    if (hasVisualMedia(element)) return 5;
    if (meaningfulText2(visibleText(element))) return 6;
    return 7;
  }
  function hasMeaningfulInteractableIdentity(element) {
    return Boolean(
      stableElementId2(element) || meaningfulText2(authoredNameAttribute(element)) || meaningfulText2(visibleText(element)) || meaningfulText2(directVisibleText(element)) || meaningfulText2(readElementValue(element)) || meaningfulText2(element.getAttribute("title")) || meaningfulText2(element.getAttribute("alt")) || meaningfulText2(element.getAttribute("placeholder")) || meaningfulText2(linkHref(element))
    );
  }
  function hasEventElementPresentation(element) {
    return hasMeaningfulInteractableIdentity(element) || hasElementPresentation(element);
  }
  function hasElementPresentation(element) {
    return meaningfulText2(visibleText(element)) || meaningfulText2(authoredNameAttribute(element)) || meaningfulText2(readElementValue(element)) || hasVisualMedia(element);
  }
  function elementPriority(element) {
    let score = 0;
    if (isInteractableUiElement(element)) score += 200;
    if (isActionableElement(element)) score += 100;
    if (stableElementId2(element)) score += 60;
    if (meaningfulText2(authoredNameAttribute(element))) score += 45;
    if (meaningfulText2(visibleText(element))) score += 35;
    if (meaningfulText2(readElementValue(element))) score += 35;
    if (meaningfulText2(directVisibleText(element))) score += 25;
    if (meaningfulText2(linkHref(element))) score += 40;
    const bounds = visualDocumentBounds(element);
    if (bounds) score += Math.min(20, Math.sqrt(bounds.width * bounds.height) / 8);
    return score;
  }
  function documentOrder(left, right) {
    if (left === right) return 0;
    return left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  }

  // src/content/picker-host.ts
  var PICKER_HOST_ATTRIBUTE = "data-fluxiq-picker";
  function isPickerHostNode(node) {
    for (let current = node; current; current = current.parentNode) {
      const element = current;
      if (typeof element.hasAttribute === "function" && element.hasAttribute(PICKER_HOST_ATTRIBUTE)) return true;
    }
    return false;
  }

  // src/content/snapshots.ts
  function shouldAttachStateSnapshot(kind) {
    return kind === "data.extract" || kind === "dom.click" || kind === "dom.input" || kind === "dom.change" || kind === "dom.submit" || kind === "dom.keydown";
  }

  // src/content/recorder.ts
  var EXECUTABLE_KINDS = /* @__PURE__ */ new Set(["dom.click", "dom.input", "dom.change", "dom.submit", "dom.keydown", "data.extract"]);
  var recording = false;
  var sequence = 0;
  var mutationTimer;
  var inputTimer;
  var pendingInput;
  var pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };
  var observer = new MutationObserver((mutations) => {
    if (!captureSettings.mutations || !recording) return;
    tallyMutations(mutations);
    if (mutationTimer) clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => flushPendingMutation(), 500);
  });
  function isRecording() {
    return recording;
  }
  function sendReady() {
    if (!isActiveContentInstance()) return;
    const payload = basePayload("content.ready", {
      metadata: { readyState: document.readyState }
    });
    void chrome.runtime.sendMessage({ type: CONTENT_READY, payload });
  }
  function emit(kind, details) {
    if (!isActiveContentInstance()) return;
    if (!recording && kind !== "content.ready") return;
    if (EXECUTABLE_KINDS.has(kind)) flushPendingMutation();
    const payload = basePayload(kind, details);
    void chrome.runtime.sendMessage({ type: CONTENT_EVENT, payload });
  }
  function setRecordingState(nextRecording) {
    if (!nextRecording) flushPendingInput();
    recording = nextRecording;
    if (recording && captureSettings.mutations) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
    } else {
      observer.disconnect();
      if (mutationTimer) clearTimeout(mutationTimer);
      mutationTimer = void 0;
      pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };
    }
  }
  function scheduleInputEvent(element) {
    pendingInput = { element, inputValue: captureSettings.inputValues ? readElementValue(element) : void 0 };
    if (inputTimer) clearTimeout(inputTimer);
    inputTimer = setTimeout(() => flushPendingInput(), 350);
  }
  function flushPendingInput() {
    if (inputTimer) clearTimeout(inputTimer);
    inputTimer = void 0;
    const pending = pendingInput;
    pendingInput = void 0;
    if (!pending) return;
    emit("dom.input", compactObject({
      element: describeElement(pending.element),
      inputValue: pending.inputValue
    }));
  }
  function emitInputEvent(element) {
    emit("dom.input", compactObject({
      element: element ? describeElement(element) : void 0,
      inputValue: captureSettings.inputValues ? readElementValue(element) : void 0
    }));
  }
  function flushPendingMutation() {
    if (captureSettings.mutations && recording) tallyMutations(observer.takeRecords());
    if (mutationTimer) clearTimeout(mutationTimer);
    mutationTimer = void 0;
    const mutation = pendingMutation;
    pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };
    if (mutation.added + mutation.removed + mutation.attributes + mutation.text === 0) return;
    emit("dom.mutation", { mutation });
  }
  function tallyMutations(mutations) {
    for (const mutation of mutations) {
      if (isPickerHostNode(mutation.target)) continue;
      pendingMutation.added += countOutsidePicker(mutation.addedNodes);
      pendingMutation.removed += countOutsidePicker(mutation.removedNodes);
      if (mutation.type === "attributes") pendingMutation.attributes += 1;
      if (mutation.type === "characterData") pendingMutation.text += 1;
    }
  }
  function countOutsidePicker(nodes) {
    let count3 = 0;
    for (const node of nodes) {
      if (!isPickerHostNode(node)) count3 += 1;
    }
    return count3;
  }
  function basePayload(kind, details) {
    const payload = {
      kind,
      sequence: ++sequence,
      url: location.href,
      title: document.title,
      eventTimestampMs: Date.now()
    };
    if (details.element) payload.element = details.element;
    if (captureSettings.snapshots) {
      const snapshot = details.snapshot ?? (shouldAttachStateSnapshot(kind) ? captureSnapshot() : void 0);
      if (snapshot) payload.snapshot = snapshot;
    }
    if (details.inputValue !== void 0) payload.inputValue = details.inputValue;
    if (details.key !== void 0) payload.key = details.key;
    if (details.scroll) payload.scroll = details.scroll;
    if (details.mutation) payload.mutation = details.mutation;
    if (details.extraction) payload.extraction = details.extraction;
    if (details.actionResult) payload.actionResult = details.actionResult;
    if (details.metadata) payload.metadata = details.metadata;
    return payload;
  }

  // src/content/action-runtime/capture-snapshot-for-response.ts
  async function captureSnapshotForResponse() {
    if (!isTopFrame()) await requestFrameGeometry();
    return captureSnapshot();
  }

  // src/content/actions/page-identity.ts
  function observePageIdentity() {
    if (typeof location === "undefined" || typeof document === "undefined") return void 0;
    const href = location.href;
    if (typeof href !== "string") return void 0;
    return { href, root: document.documentElement };
  }
  function reportPageChange(result, before) {
    if (result.status === "succeeded") return result;
    const failure = result.failure;
    if (!failure || EXPLAINED_WITHOUT_THE_PAGE.has(failure.code)) return result;
    const change = pageChangeSince(before);
    if (!change) return result;
    result.failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED, {
      expected: failure.expected ?? "the action to run against the document it started on",
      actual: `${change}; the action reported ${failure.code}${failure.actual ? `: ${failure.actual}` : ""}`
    });
    return result;
  }
  var EXPLAINED_WITHOUT_THE_PAGE = /* @__PURE__ */ new Set([
    WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED,
    WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED,
    WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE,
    WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED,
    WEB_AUTOMATION_FAILURE_CODES.NAVIGATION_UNEXPECTED,
    WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED
  ]);
  function pageChangeSince(before) {
    if (!before) return void 0;
    const now = observePageIdentity();
    if (!now) return void 0;
    if (now.root !== before.root) return "the document was replaced while the action ran";
    if (now.href !== before.href) return "the page navigated to a different URL while the action ran";
    return void 0;
  }

  // src/content/actions/capture-snapshot.ts
  function captureSnapshotAction(action, deps, startedAt) {
    const snapshot = deps.captureSnapshot();
    const structure = action.detectStructure === void 0 ? void 0 : deps.detectStructure(action.detectStructure);
    return deps.success(action, startedAt, "Snapshot captured.", { status: "none", reason: "evidence-only" }, { snapshot, structure });
  }

  // src/content/actions/wait-for-selector.ts
  async function waitForSelectorAction(action, deps, startedAt) {
    const condition = action.wait?.condition ?? "present";
    const url = action.wait?.url ?? action.url;
    const outcome = await deps.waitForCondition({
      condition,
      selector: action.selector,
      url,
      timeoutMs: action.timeoutMs,
      stableForMs: action.wait?.stableForMs
    });
    const phrases = phrasesFor(condition, action.selector, url);
    if (!outcome.ok) {
      return deps.timedOut(action, startedAt, phrases.timedOut, { status: "failed", expected: phrases.expected, actual: outcome.actual }, {
        snapshot: deps.captureSnapshot()
      });
    }
    return deps.success(action, startedAt, phrases.satisfied, { status: "passed", expected: phrases.expected, actual: outcome.actual }, {
      ...outcome.element ? { element: deps.describeElement(outcome.element) } : {},
      snapshot: deps.captureSnapshot()
    });
  }
  function phrasesFor(condition, selector, url) {
    const target = selector ?? "(no selector)";
    if (condition === "visible") {
      return { expected: `a visible element matching ${target}`, satisfied: "The element is visible.", timedOut: `Timed out waiting for a visible element: ${target}` };
    }
    if (condition === "enabled") {
      return { expected: `an enabled element matching ${target}`, satisfied: "The element is enabled.", timedOut: `Timed out waiting for an enabled element: ${target}` };
    }
    if (condition === "absent") {
      return { expected: `no element matching ${target}`, satisfied: "The element is gone.", timedOut: `Timed out waiting for the element to go: ${target}` };
    }
    if (condition === "url") {
      const address = url ?? "(no url)";
      return { expected: `the page URL to be ${address}`, satisfied: "The URL matched.", timedOut: `Timed out waiting for the URL: ${address}` };
    }
    if (condition === "stable") {
      return { expected: "the page to stop changing", satisfied: "The page is stable.", timedOut: "Timed out waiting for the page to stop changing." };
    }
    return { expected: `an element matching ${target}`, satisfied: "Selector found.", timedOut: `Timed out waiting for selector: ${target}` };
  }

  // src/content/actions/wait-for-text.ts
  async function waitForTextAction(action, deps, startedAt) {
    const condition = action.wait?.condition ?? "present";
    const text3 = action.text ?? action.value ?? "";
    const url = action.wait?.url ?? action.url;
    const outcome = await deps.waitForCondition({
      condition,
      text: text3,
      url,
      timeoutMs: action.timeoutMs,
      stableForMs: action.wait?.stableForMs
    });
    const phrases = phrasesFor2(condition, text3, url);
    if (!outcome.ok) {
      return deps.timedOut(action, startedAt, phrases.timedOut, { status: "failed", expected: phrases.expected, actual: outcome.actual }, {
        snapshot: deps.captureSnapshot()
      });
    }
    return deps.success(action, startedAt, phrases.satisfied, { status: "passed", expected: phrases.expected, actual: outcome.actual }, {
      snapshot: deps.captureSnapshot()
    });
  }
  function phrasesFor2(condition, text3, url) {
    if (condition === "visible") {
      return { expected: `visible page text containing ${text3}`, satisfied: "The text is visible.", timedOut: `Timed out waiting for visible text: ${text3}` };
    }
    if (condition === "absent") {
      return { expected: `no page text containing ${text3}`, satisfied: "The text is gone.", timedOut: `Timed out waiting for the text to go: ${text3}` };
    }
    if (condition === "url") {
      const address = url ?? "(no url)";
      return { expected: `the page URL to be ${address}`, satisfied: "The URL matched.", timedOut: `Timed out waiting for the URL: ${address}` };
    }
    if (condition === "stable") {
      return { expected: "the page to stop changing", satisfied: "The page is stable.", timedOut: "Timed out waiting for the page to stop changing." };
    }
    return { expected: `page text containing ${text3}`, satisfied: "Text found.", timedOut: `Timed out waiting for text: ${text3}` };
  }

  // src/content/actions/extract.ts
  function extractAction(action, deps, startedAt) {
    const { element, resolution } = deps.resolveTarget(action);
    const read = deps.extractElement(element, readRequest(action));
    if (!read.ok) {
      return deps.rejected(
        action,
        startedAt,
        read.refusal,
        "a readable element that is not a sensitive control",
        "the target is a sensitive control, so its value is never read",
        { element: deps.describeElement(element), resolution }
      );
    }
    return deps.success(action, startedAt, "Value extracted.", { status: "none", reason: "evidence-only" }, {
      element: deps.describeElement(element),
      snapshot: deps.captureSnapshot(),
      extracted: read.value,
      resolution
    });
  }
  function readRequest(action) {
    const extract = action.extract;
    if (extract === void 0) return action.options;
    return extract.attribute === void 0 ? { mode: extract.mode } : { mode: extract.mode, attribute: extract.attribute };
  }

  // src/content/actions/click.ts
  function clickAction(action, deps, startedAt) {
    const { element, resolution } = deps.resolveTarget(action);
    const evidence = () => ({
      element: deps.describeElement(element),
      snapshot: deps.captureSnapshot(),
      resolution
    });
    const report = deps.checkActionability(element);
    if (!report.actionable) {
      return deps.rejected(action, startedAt, report.code, "a target that can be clicked", report.detail, evidence());
    }
    const link = navigatingLink(element);
    const document2 = element.ownerDocument;
    const before = document2.location.href;
    const accepted = dispatchClickGesture(element, report.point);
    const after = document2.location.href;
    const validation = link ? navigationValidation(link.href, before, after, accepted) : hitTestValidation(report.detail, accepted);
    return deps.success(action, startedAt, "Element clicked.", validation, evidence());
  }
  function navigatingLink(element) {
    const anchor = element.closest("a[href]");
    if (!anchor || typeof anchor.href !== "string" || !anchor.href) return void 0;
    if (anchor.protocol === "javascript:") return void 0;
    return { href: anchor.href };
  }
  function navigationValidation(href, before, after, accepted) {
    const expected = `navigation to ${href} begins`;
    if (after !== before) return { status: "passed", expected, actual: `the page navigated to ${after}` };
    if (accepted) return { status: "passed", expected, actual: `navigation to ${href} was initiated` };
    return { status: "failed", expected, actual: "the click was prevented and the location did not change" };
  }
  function hitTestValidation(detail, accepted) {
    return {
      status: "passed",
      expected: "the click lands on the target or something inside it",
      actual: accepted ? detail : `${detail}; the page prevented the click's default action`
    };
  }
  function dispatchClickGesture(element, point) {
    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: element.ownerDocument.defaultView,
      clientX: point.x,
      clientY: point.y,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true
    };
    const hover = { ...base, buttons: 0 };
    const entering = { ...hover, bubbles: false, cancelable: false };
    const press = { ...base, buttons: 1, detail: 1 };
    const release = { ...base, buttons: 0, detail: 1 };
    dispatchPointer(element, "pointerover", hover);
    dispatchPointer(element, "pointerenter", entering);
    element.dispatchEvent(new MouseEvent("mouseover", hover));
    element.dispatchEvent(new MouseEvent("mouseenter", entering));
    dispatchPointer(element, "pointermove", hover);
    element.dispatchEvent(new MouseEvent("mousemove", hover));
    dispatchPointer(element, "pointerdown", press);
    if (element.dispatchEvent(new MouseEvent("mousedown", press))) focusForPress(element);
    dispatchPointer(element, "pointerup", release);
    element.dispatchEvent(new MouseEvent("mouseup", release));
    return element.dispatchEvent(new MouseEvent("click", release));
  }
  function dispatchPointer(element, type, init) {
    if (typeof PointerEvent !== "function") return;
    element.dispatchEvent(new PointerEvent(type, init));
  }
  function focusForPress(element) {
    const target = element.closest("a[href],button,input,select,textarea,summary,[tabindex],[contenteditable]");
    const focusable = target;
    if (focusable && typeof focusable.focus === "function") focusable.focus({ preventScroll: true });
  }

  // src/content/actions/value-redaction.ts
  function describeFieldValue(value, withheld) {
    if (!withheld) return `"${value}"`;
    if (value.length === 0) return "an empty value";
    return `a withheld value of ${value.length} character${value.length === 1 ? "" : "s"}`;
  }

  // src/content/actions/type.ts
  function typeAction(action, deps, startedAt) {
    const { element, resolution } = deps.resolveTarget(action);
    const text3 = action.text ?? action.value ?? "";
    const withheld = isSensitiveFormControl(element);
    const evidence = () => ({ element: deps.describeElement(element), snapshot: deps.captureSnapshot(), resolution });
    const report = deps.checkActionability(element);
    if (!report.actionable) {
      return deps.rejected(action, startedAt, report.code, "a target that can be typed into", report.detail, evidence());
    }
    if (!holdsText(element)) {
      return deps.success(action, startedAt, "The target holds no typed text.", {
        status: "failed",
        expected: `a text field or editable element holding ${describeFieldValue(text3, withheld)}`,
        actual: `the target is a <${element.tagName.toLowerCase()}>, which holds no typed text`,
        redacted: withheld
      }, evidence());
    }
    deps.keyboard.typeText(element, text3);
    const actual = enteredText(element);
    const held = actual === text3;
    return deps.success(action, startedAt, held ? "Text entered." : "The field did not keep the text.", {
      status: held ? "passed" : "failed",
      expected: `the field holds ${describeFieldValue(text3, withheld)}`,
      actual: heldText(actual, text3, withheld),
      redacted: withheld
    }, evidence());
  }
  function heldText(actual, sent, withheld) {
    if (!withheld) return `the field holds "${actual}"`;
    if (actual === sent) return `the field holds the text that was sent, ${describeFieldValue(actual, true)}`;
    return `the field holds ${describeFieldValue(actual, true)}, which is not the text that was sent`;
  }
  function holdsText(element) {
    if (element instanceof HTMLTextAreaElement) return true;
    if (element instanceof HTMLInputElement) return !["checkbox", "radio", "file"].includes(element.type);
    return element instanceof HTMLElement && element.isContentEditable;
  }
  function enteredText(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return element.value;
    return element.textContent ?? "";
  }

  // src/content/actions/clear.ts
  function clearAction(action, deps, startedAt) {
    const { element, resolution } = deps.resolveTarget(action);
    const withheld = isSensitiveFormControl(element);
    const evidence = () => ({ element: deps.describeElement(element), snapshot: deps.captureSnapshot(), resolution });
    const report = deps.checkActionability(element);
    if (!report.actionable) {
      return deps.rejected(action, startedAt, report.code, "a target that can be cleared", report.detail, evidence());
    }
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      return deps.success(action, startedAt, "The target has no value to clear.", {
        status: "failed",
        expected: "a field whose value can be emptied",
        actual: `the target is a <${element.tagName.toLowerCase()}>, which has no value`,
        redacted: withheld
      }, evidence());
    }
    element.focus();
    deps.setElementValue(element, "");
    deps.dispatchInputEvents(element);
    const actual = element.value;
    const empty = actual === "";
    return deps.success(action, startedAt, empty ? "Field cleared." : "The field did not stay empty.", {
      status: empty ? "passed" : "failed",
      expected: "the field is empty",
      actual: empty ? "the field is empty" : `the field holds ${describeFieldValue(actual, withheld)}`,
      redacted: withheld
    }, evidence());
  }

  // src/content/actions/select.ts
  var OPTIONS_LISTED_ON_FAILURE = 20;
  function selectAction(action, deps, startedAt) {
    const { element, resolution } = deps.resolveTarget(action);
    const withheld = isSensitiveFormControl(element);
    const evidence = () => ({ element: deps.describeElement(element), snapshot: deps.captureSnapshot(), resolution });
    const request = requestedOption(action);
    const report = deps.checkActionability(element);
    if (!report.actionable) {
      return deps.rejected(action, startedAt, report.code, "a target that can be selected in", report.detail, evidence());
    }
    if (!request) {
      return deps.success(action, startedAt, "No option was named.", {
        status: "failed",
        expected: "an option named by value, label, or index",
        actual: "the command named none",
        redacted: withheld
      }, evidence());
    }
    if (!(element instanceof HTMLSelectElement)) {
      return deps.success(action, startedAt, "The target is not a select element.", {
        status: "failed",
        expected: `a select element to choose ${describeRequest(request, withheld)} in`,
        actual: `the target is a <${element.tagName.toLowerCase()}>`,
        redacted: withheld
      }, evidence());
    }
    const option = findOption(element, request);
    if (!option) {
      return deps.success(action, startedAt, `No option matched ${describeRequest(request, withheld)}.`, {
        status: "failed",
        expected: `an option matching ${describeRequest(request, withheld)} is selected`,
        actual: `no option matched; the select still holds ${describeFieldValue(element.value, withheld)} and offers ${listOptions(element, withheld)}`,
        redacted: withheld
      }, evidence());
    }
    if (option.matches(":disabled")) {
      return deps.rejected(
        action,
        startedAt,
        "disabled",
        `a selectable option matching ${describeRequest(request, withheld)}`,
        `${describeOption(option, withheld)} is disabled`,
        evidence()
      );
    }
    element.focus();
    element.selectedIndex = option.index;
    deps.dispatchInputEvents(element);
    const selected = element.value;
    const held = selected === option.value;
    return deps.success(action, startedAt, held ? "Option selected." : "The select did not keep the chosen option.", {
      status: held ? "passed" : "failed",
      expected: `selected value ${describeFieldValue(option.value, withheld)} (${describeRequest(request, withheld)})`,
      actual: selectedValueText(selected, option.value, withheld),
      redacted: withheld
    }, evidence());
  }
  function selectedValueText(selected, chosen, withheld) {
    if (withheld && selected !== chosen) {
      return `selected ${describeFieldValue(selected, true)}, which is not the option that was chosen`;
    }
    return `selected value ${describeFieldValue(selected, withheld)}`;
  }
  function describeOption(option, withheld) {
    if (withheld) return `the matched option at index ${option.index}`;
    return `the option "${option.value}" (${normalizeLabel(optionLabel(option))})`;
  }
  function requestedOption(action) {
    if (action.option) return action.option;
    if (action.value !== void 0) return { by: "value", value: action.value };
    return void 0;
  }
  function findOption(element, request) {
    const options = [...element.options];
    if (request.by === "value") return options.find((option) => option.value === request.value);
    if (request.by === "label") {
      const wanted = normalizeLabel(request.label);
      return options.find((option) => normalizeLabel(optionLabel(option)) === wanted);
    }
    return Number.isInteger(request.index) ? options[request.index] : void 0;
  }
  function describeRequest(request, withheld) {
    if (request.by === "value") return `value ${describeFieldValue(request.value, withheld)}`;
    if (request.by === "label") return `label ${describeFieldValue(request.label, withheld)}`;
    return `index ${request.index}`;
  }
  function listOptions(element, withheld) {
    const options = [...element.options];
    if (!options.length) return "no options";
    if (withheld) return `${options.length} withheld option${options.length === 1 ? "" : "s"}`;
    const listed = options.slice(0, OPTIONS_LISTED_ON_FAILURE).map((option) => `"${option.value}" (${normalizeLabel(optionLabel(option))})`).join(", ");
    return options.length > OPTIONS_LISTED_ON_FAILURE ? `${listed}, and ${options.length - OPTIONS_LISTED_ON_FAILURE} more` : listed;
  }
  function optionLabel(option) {
    return option.label || option.textContent || "";
  }
  function normalizeLabel(label) {
    return label.replace(/\s+/gu, " ").trim();
  }

  // src/content/actions/scroll.ts
  var GROWTH_WINDOW_MS = 900;
  var GROWTH_POLL_MS = 50;
  var SMOOTH_SETTLE_MS = 1e3;
  var POSITION_TOLERANCE_PX = 2;
  async function scrollAction(action, deps, startedAt) {
    try {
      const request = action.scroll;
      if (request?.mode === "toElement") return scrollToElement(action, deps, startedAt);
      if (request?.mode === "untilStable") return await scrollUntilStable(action, request, deps, startedAt);
      return await scrollToPosition(action, requestedPosition(action, request), deps, startedAt);
    } catch (error) {
      return deps.failure(action, error, startedAt);
    }
  }
  function requestedPosition(action, request) {
    const from = currentPosition();
    if (request) return clampToDocument({ x: from.x + finiteNumber(request.x, 0), y: from.y + finiteNumber(request.y, 0) });
    return clampToDocument({
      x: finiteNumber(action.options?.x ?? action.coordinates?.x, from.x),
      y: finiteNumber(action.options?.y ?? action.coordinates?.y, from.y)
    });
  }
  async function scrollToPosition(action, target, deps, startedAt) {
    const from = currentPosition();
    const smooth = action.options?.smooth === true;
    window.scrollTo({ left: target.x, top: target.y, behavior: smooth ? "smooth" : "instant" });
    if (smooth) await settleAt(target);
    return deps.success(action, startedAt, "Page scrolled.", positionValidation(target, currentPosition(), from), {
      snapshot: deps.captureSnapshot()
    });
  }
  function scrollToElement(action, deps, startedAt) {
    const { element, resolution } = deps.resolveTarget(action);
    deps.scrollElementIntoView(element);
    const rect2 = element.getBoundingClientRect();
    const inView = rect2.bottom > 0 && rect2.top < window.innerHeight && rect2.right > 0 && rect2.left < window.innerWidth;
    return deps.success(action, startedAt, "Scrolled the target into view.", {
      status: inView ? "passed" : "failed",
      expected: "the target within the viewport",
      actual: `the target is at ${Math.round(rect2.left)},${Math.round(rect2.top)} in a ${window.innerWidth}x${window.innerHeight} viewport`
    }, { element: deps.describeElement(element), snapshot: deps.captureSnapshot(), resolution });
  }
  async function scrollUntilStable(action, request, deps, startedAt) {
    const cap = Math.max(1, Math.floor(finiteNumber(request.maxScrolls, 1)));
    const step2 = request.y === void 0 ? void 0 : finiteNumber(request.y, 0);
    const startHeight = documentHeight();
    let height = startHeight;
    let scrolls = 0;
    let settled = false;
    while (scrolls < cap) {
      const from = currentPosition();
      const bottom = scrollLimits().y;
      window.scrollTo({ left: from.x, top: step2 === void 0 ? bottom : Math.min(from.y + step2, bottom), behavior: "instant" });
      scrolls += 1;
      const grown = await waitForGrowth(height);
      if (grown !== void 0) {
        height = grown;
        continue;
      }
      if (atBottom() || currentPosition().y === from.y) {
        settled = true;
        break;
      }
    }
    return deps.success(
      action,
      startedAt,
      settled ? "Scrolled until the document stopped growing." : `Stopped at the ${cap}-scroll cap while the document was still growing.`,
      {
        status: settled ? "passed" : "failed",
        expected: `the document to stop growing within ${cap} ${scrollWord(cap)}`,
        actual: settled ? `the document stopped growing after ${scrolls} ${scrollWord(scrolls)}, at ${height} pixels` : `the document was still growing after ${scrolls} ${scrollWord(scrolls)}, from ${startHeight} to ${height} pixels`
      },
      { snapshot: deps.captureSnapshot() }
    );
  }
  function positionValidation(target, actual, from) {
    const reached = Math.abs(actual.x - target.x) <= POSITION_TOLERANCE_PX && Math.abs(actual.y - target.y) <= POSITION_TOLERANCE_PX;
    return {
      status: reached ? "passed" : "failed",
      expected: `scroll position ${target.x},${target.y}`,
      actual: `scroll position ${actual.x},${actual.y}, moved from ${from.x},${from.y}`
    };
  }
  async function waitForGrowth(previousHeight) {
    const deadline = Date.now() + GROWTH_WINDOW_MS;
    do {
      await delay(GROWTH_POLL_MS);
      const height = documentHeight();
      if (height > previousHeight) return height;
    } while (Date.now() < deadline);
    return void 0;
  }
  async function settleAt(target) {
    const deadline = Date.now() + SMOOTH_SETTLE_MS;
    do {
      const position2 = currentPosition();
      if (Math.abs(position2.x - target.x) <= POSITION_TOLERANCE_PX && Math.abs(position2.y - target.y) <= POSITION_TOLERANCE_PX) return;
      await delay(GROWTH_POLL_MS);
    } while (Date.now() < deadline);
  }
  function currentPosition() {
    return { x: Math.round(window.scrollX), y: Math.round(window.scrollY) };
  }
  function documentHeight() {
    return Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
  }
  function scrollLimits() {
    const width = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return { x: Math.max(0, Math.round(width - window.innerWidth)), y: Math.max(0, Math.round(documentHeight() - window.innerHeight)) };
  }
  function atBottom() {
    return currentPosition().y >= scrollLimits().y - POSITION_TOLERANCE_PX;
  }
  function clampToDocument(point) {
    const limits = scrollLimits();
    return { x: clamp2(Math.round(point.x), limits.x), y: clamp2(Math.round(point.y), limits.y) };
  }
  function clamp2(value, limit) {
    return Math.min(Math.max(value, 0), limit);
  }
  function finiteNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function scrollWord(count3) {
    return count3 === 1 ? "scroll" : "scrolls";
  }
  function delay(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  // src/content/actions/keypress.ts
  function keypressAction(action, deps, startedAt) {
    const named = Boolean(action.selector);
    const resolved = named ? deps.resolveTarget(action) : void 0;
    const target = resolved?.element ?? document.activeElement ?? document.body;
    const key = action.key ?? action.text ?? "";
    const evidence = () => ({
      element: deps.describeElement(target),
      snapshot: deps.captureSnapshot(),
      ...resolved ? { resolution: resolved.resolution } : {}
    });
    if (named) {
      const report = deps.checkActionability(target);
      if (!report.actionable) {
        return deps.rejected(action, startedAt, report.code, "a target that can receive the key press", report.detail, evidence());
      }
    }
    const outcome = deps.keyboard.pressKey(target, key, action.modifiers);
    if (outcome.defaultAction === "unsupported") {
      return deps.rejected(action, startedAt, "unsupported_key", outcome.expected, outcome.detail, evidence());
    }
    return deps.success(action, startedAt, outcome.held ? "Key pressed." : "The key press had no observable effect.", {
      status: outcome.held ? "passed" : "failed",
      expected: outcome.expected,
      actual: outcome.detail
    }, evidence());
  }

  // src/content/actions/check.ts
  function checkAction(action, deps, startedAt) {
    const { element, resolution } = deps.resolveTarget(action);
    const requested = action.checked ?? true;
    deps.scrollElementIntoView(element);
    const outcome = deps.setCheckedState(element, requested);
    const evidence = { element: deps.describeElement(element), snapshot: deps.captureSnapshot(), resolution };
    const expected = `the control is ${stateWord(requested)}`;
    if (!outcome.ok) {
      const code = outcome.code === "disabled" ? "disabled" : "not_checkable";
      return deps.rejected(action, startedAt, code, expected, outcome.reason, evidence);
    }
    const actual = `the ${outcome.kind} is ${stateWord(outcome.checked)}`;
    const validation = outcome.checked === requested ? { status: "passed", expected, actual } : { status: "failed", expected, actual };
    return deps.success(action, startedAt, outcome.changed ? "Check state set." : "Check state already set.", validation, evidence);
  }
  function stateWord(checked) {
    return checked ? "checked" : "unchecked";
  }

  // src/content/actions/assert.ts
  async function assertAction(action, deps, startedAt) {
    try {
      const request = action.assert;
      if (!request) throw new Error("web.dom.assert requires assert parameters naming the kind of claim.");
      const { target, resolution } = assertionTarget(action, deps);
      const outcome = await deps.evaluateAssertion(request, target);
      const evidence = {
        ...target.element ? { element: deps.describeElement(target.element) } : {},
        snapshot: deps.captureSnapshot(),
        ...resolution ? { resolution } : {}
      };
      const validation = outcome.held ? { status: "passed", expected: outcome.expected, actual: outcome.actual } : { status: "failed", expected: outcome.expected, actual: outcome.actual };
      if (assertionTimedOut(outcome)) {
        return deps.timedOut(action, startedAt, `Assertion did not hold within ${outcome.timeoutMs} ms: ${request.kind}.`, validation, evidence);
      }
      const message = outcome.held ? `Assertion held: ${request.kind}.` : `Assertion did not hold: ${request.kind}.`;
      return deps.success(action, startedAt, message, validation, evidence);
    } catch (error) {
      return deps.failure(action, error, startedAt);
    }
  }
  function assertionTarget(action, deps) {
    if (action.selector) return { target: { selector: action.selector } };
    try {
      const resolved = deps.resolveTarget(action);
      return { target: { element: resolved.element }, resolution: resolved.resolution };
    } catch {
      return { target: {} };
    }
  }
  function assertionTimedOut(outcome) {
    return !outcome.held && outcome.waitExpired && !outcome.judged;
  }

  // src/content/actions/extract-list.ts
  async function extractListAction(action, deps, startedAt) {
    const request = action.extractList;
    if (!request) return deps.failure(action, new Error("web.dom.extract_list needs extractList parameters."), startedAt);
    try {
      const outcome = await deps.extractList(request, { timeoutMs: action.timeoutMs });
      const minItems = minimumItems(request.minItems);
      const fieldNames = includedFieldNames(request);
      const expected = `at least ${count2(minItems, "record")}, each carrying ${fieldNames.join(", ")}`;
      const evidence = { extracted: outcome.records, extraction: summaryOf(outcome, fieldNames), snapshot: deps.captureSnapshot() };
      if (outcome.timedOut) {
        return deps.timedOut(action, startedAt, `Timed out extracting the list after ${count2(outcome.pagesRead, "page")}.`, {
          status: "failed",
          expected,
          actual: `${readSummary(outcome)}; the time ran out before the list ended`
        }, evidence);
      }
      return deps.success(action, startedAt, "List extracted.", validationFor(outcome, minItems, expected), evidence);
    } catch (error) {
      return deps.failure(action, error, startedAt);
    }
  }
  function minimumItems(requested) {
    return typeof requested === "number" && Number.isFinite(requested) ? Math.max(0, Math.trunc(requested)) : 1;
  }
  function includedFieldNames(request) {
    return Object.entries(request.fields).filter(([, field]) => typeof field === "string" || field?.handling !== "exclude").map(([name]) => name);
  }
  function summaryOf(outcome, fieldNames) {
    return {
      recordCount: outcome.records.length,
      pagesRead: outcome.pagesRead,
      truncated: outcome.truncated,
      missingFields: [...outcome.missingFields],
      fieldNames: [...fieldNames]
    };
  }
  function validationFor(outcome, minItems, expected) {
    const shortfalls = [
      ...outcome.records.length < minItems ? [`fewer than the ${minItems} required`] : [],
      ...outcome.missingFields.length > 0 ? [`missing from some records: ${outcome.missingFields.join(", ")}`] : []
    ];
    return shortfalls.length === 0 ? { status: "passed", expected, actual: `${readSummary(outcome)}; every declared field present` } : { status: "failed", expected, actual: `${readSummary(outcome)}; ${shortfalls.join("; ")}` };
  }
  function readSummary(outcome) {
    return `${count2(outcome.records.length, "record")} from ${count2(outcome.pagesRead, "page")}${outcome.truncated ? ", truncated" : ""}`;
  }
  function count2(value, noun) {
    return `${value} ${noun}${value === 1 ? "" : "s"}`;
  }

  // src/content/actions/upload.ts
  function uploadAction(action, deps, startedAt) {
    const files = action.upload?.files ?? [];
    const requested = files.map((file) => file.name);
    const { element, resolution } = deps.resolveTarget(action);
    const evidence = { element: deps.describeElement(element), snapshot: deps.captureSnapshot(), resolution };
    const expected = describeFiles(requested.length, true);
    const outcome = deps.setInputFiles(element, files);
    if (!outcome.ok) {
      return deps.rejected(action, startedAt, "upload_rejected", expected, outcome.reason, evidence);
    }
    const matched = sameNames(outcome.fileNames, requested);
    return deps.success(action, startedAt, "Files uploaded.", {
      status: matched ? "passed" : "failed",
      expected,
      actual: describeFiles(outcome.fileNames.length, matched)
    }, evidence);
  }
  function describeFiles(count3, named) {
    if (count3 === 0) return "no files";
    const files = count3 === 1 ? "1 file" : `${count3} files`;
    return named ? `${files}, named as requested` : `${files}, not named as requested`;
  }
  function sameNames(held, requested) {
    return held.length === requested.length && held.every((name, index) => name === requested[index]);
  }

  // src/content/actions/dialog.ts
  function dialogAction(action, deps, startedAt) {
    const request = action.dialog;
    if (!request) {
      return deps.rejected(action, startedAt, "dialog_no_response", "a dialog response to arm", "the command carried no dialog request");
    }
    const expected = request.response === "accept" ? `the next dialog is accepted${request.promptText === void 0 ? "" : " with the supplied text"}` : "the next dialog is dismissed";
    const armed = deps.dialogControl.arm(request);
    const previous2 = deps.dialogControl.observed();
    const evidence = {
      snapshot: deps.captureSnapshot(),
      ...previous2 ? { dialog: observedDialogEvidence(previous2) } : {}
    };
    if (!armed) {
      return deps.rejected(action, startedAt, "dialog_override_missing", expected, "the page-world dialog override is not installed on this page", evidence);
    }
    return deps.success(action, startedAt, "Dialog response armed.", {
      status: "passed",
      expected,
      actual: "the response was armed and acknowledged by the page"
    }, evidence);
  }
  function observedDialogEvidence(observed) {
    return {
      kind: observed.kind,
      message: observed.message,
      response: observed.response,
      at: observed.at,
      ...observed.promptText === void 0 ? {} : { promptText: describeFieldValue(observed.promptText, true) }
    };
  }

  // src/content/actions/execute.ts
  var UnsupportedActionTypeError = class extends Error {
    failure;
    constructor(actionType) {
      super(`Unsupported action type: ${actionType}`);
      this.name = "UnsupportedActionTypeError";
      this.failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE, {
        expected: "an action type this content script implements",
        actual: `${actionType} has no verb in this build`
      });
    }
  };
  async function executeContentAction(action, deps) {
    const startedAt = Date.now();
    const startedOn = observePageIdentity();
    return reportPageChange(await routeContentAction(action, deps, startedAt), startedOn);
  }
  async function routeContentAction(action, deps, startedAt) {
    try {
      if (action.actionType === "web.dom.capture_snapshot") {
        return await captureSnapshotAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.wait_for_selector") {
        return await waitForSelectorAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.wait_for_text") {
        return await waitForTextAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.extract") {
        return await extractAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.click") {
        return await clickAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.type") {
        return await typeAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.clear") {
        return await clearAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.select") {
        return await selectAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.scroll") {
        return await scrollAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.keypress") {
        return await keypressAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.check") {
        return await checkAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.assert") {
        return await assertAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.extract_list") {
        return await extractListAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.upload") {
        return await uploadAction(action, deps, startedAt);
      }
      if (action.actionType === "web.dom.dialog") {
        return await dialogAction(action, deps, startedAt);
      }
      throw new UnsupportedActionTypeError(action.actionType);
    } catch (error) {
      return deps.failure(action, error, startedAt);
    }
  }

  // src/content/action-runtime/resolve-target.ts
  var MAX_TEXT_SCAN = 2e3;
  var MAX_NAMED_CANDIDATES = 5;
  var TargetResolutionError = class extends Error {
    failure;
    resolution;
    constructor(message, failure, resolution) {
      super(message);
      this.name = "TargetResolutionError";
      this.failure = failure;
      this.resolution = resolution;
    }
  };
  function resolveTarget(action) {
    const target = recordedTarget(action);
    const misses = [];
    let family;
    const scoredFamily = (known) => family ??= scoreFamily(known);
    for (const attempt of exactAttempts(action, target)) {
      if (!attempt.matches.length) {
        misses.push(attempt.description);
        continue;
      }
      const pool = gatedPool(attempt.matches, target);
      const only = pool.length === 1 ? pool[0] : void 0;
      if (only) {
        const verdict = target ? vetoExactMatch(target, only) : void 0;
        if (verdict?.refusedBecause) {
          misses.push(`${attempt.description} (${verdict.summary})`);
          continue;
        }
        if (target && POSITIONAL_STRATEGIES.has(attempt.strategy)) {
          const { decided: decided3 } = scoredFamily(target);
          if (decided3?.outcome === "ambiguous") throw scoredAmbiguous(decided3, [...misses, attempt.description]);
        }
        return { element: only, resolution: exactResolution(attempt, verdict?.measurement) };
      }
      const decided2 = target ? scoreTargetCandidates(target, describePool(pool)) : void 0;
      if (decided2?.outcome === "resolved") return scoredTarget(decided2, pool.length);
      throw ambiguous(attempt, pool, decided2);
    }
    if (!misses.length) {
      const active2 = document.activeElement;
      if (active2) return { element: active2, resolution: { strategy: "active-element", candidateCount: 1 } };
      throw notFound("No selector, coordinates, or active element was available.", [], NO_POOL);
    }
    const { nearby, decided } = target ? scoredFamily(target) : NO_FAMILY;
    if (decided?.outcome === "resolved") return scoredTarget(decided, nearby.candidates.length);
    if (decided?.outcome === "ambiguous") throw scoredAmbiguous(decided, misses);
    throw notFound(`No target resolved from ${misses.join(", ")}.`, misses, nearby, decided);
  }
  var NO_POOL = { candidates: [], examined: 0, truncated: false };
  var POSITIONAL_STRATEGIES = /* @__PURE__ */ new Set(["coordinates", "visual-target"]);
  var NO_FAMILY = { nearby: NO_POOL, decided: void 0 };
  function scoreFamily(target) {
    const nearby = collectTargetCandidates(candidateFamily(target));
    return { nearby, decided: scoreTargetCandidates(target, nearby.candidates) };
  }
  function exactResolution(attempt, measurement) {
    return {
      strategy: attempt.strategy,
      candidateCount: attempt.matches.length,
      ...measurement ? { bestScore: measurement.score, confidence: measurement.confidence } : {}
    };
  }
  function scoredTarget(decided, candidateCount) {
    return {
      element: decided.chosen.element,
      resolution: {
        strategy: "scored-candidate",
        candidateCount,
        bestScore: decided.chosen.score.normalizedScore,
        ...decided.runnerUp ? { runnerUpScore: decided.runnerUp.score.normalizedScore } : {},
        confidence: decided.chosen.score.confidence
      }
    };
  }
  function describePool(pool) {
    return pool.map((element, index) => ({ element, fingerprint: candidateFingerprint(element, index) }));
  }
  function candidateFamily(target) {
    const role = target.role?.trim() || target.implicitRole?.trim();
    return { ...target.tagName ? { tagName: target.tagName } : {}, ...role ? { role } : {} };
  }
  function* exactAttempts(action, target) {
    if (action.selector) {
      yield { strategy: "selector", description: `selector ${action.selector}`, matches: querySelectorAll(action.selector) };
    }
    if (action.coordinates) {
      yield {
        strategy: "coordinates",
        description: `coordinates ${action.coordinates.x},${action.coordinates.y}`,
        matches: elementsAtPoint(action.coordinates)
      };
    }
    const visualPoint = pointFromVisualTarget(action.visualTarget);
    if (visualPoint) {
      yield {
        strategy: "visual-target",
        description: `visual target ${Math.round(visualPoint.x)},${Math.round(visualPoint.y)}`,
        matches: elementsAtPoint(visualPoint)
      };
    }
    if (target) {
      yield { strategy: "fingerprint", description: "element fingerprint", matches: fingerprintMatches(target) };
    }
  }
  function fingerprintMatches(target) {
    const { visibleText: visibleText2, ...stable } = target;
    const exact = findClosestFingerprint(stable);
    if (exact) return [exact];
    if (!visibleText2) return [];
    const wanted = normalizeText3(visibleText2);
    const matches = [];
    let scanned = 0;
    for (const element of document.querySelectorAll(target.tagName || "*")) {
      scanned += 1;
      if (scanned > MAX_TEXT_SCAN) break;
      if (normalizeText3(element.textContent ?? "") === wanted) matches.push(element);
    }
    return matches;
  }
  function gatedPool(matches, target) {
    const preferred = matches.filter((element) => passesGate(element, target));
    return preferred.length ? preferred : matches;
  }
  function passesGate(element, target) {
    if (target?.tagName && element.tagName.toLowerCase() !== target.tagName.toLowerCase()) return false;
    return isVisibleForResolution(element) && isEnabledForResolution(element);
  }
  function isVisibleForResolution(element) {
    if (!element.isConnected) return false;
    const view = element.ownerDocument.defaultView;
    if (!view) return false;
    const style2 = view.getComputedStyle(element);
    if (style2.display === "none" || style2.visibility === "hidden" || style2.visibility === "collapse") return false;
    const rect2 = element.getBoundingClientRect();
    return rect2.width > 0 && rect2.height > 0;
  }
  function isEnabledForResolution(element) {
    if (element.matches(":disabled")) return false;
    return !element.closest('[aria-disabled="true"]');
  }
  function ambiguous(attempt, pool, decided) {
    const scores = scoreByElement(decided);
    const named = pool.slice(0, MAX_NAMED_CANDIDATES).map((element) => namedCandidate(element, scores)).join(", ");
    const more = pool.length > MAX_NAMED_CANDIDATES ? `, and ${pool.length - MAX_NAMED_CANDIDATES} more` : "";
    const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS, {
      expected: `one element matching ${attempt.description}`,
      actual: `${pool.length} elements matched: ${named}${more}`
    });
    const message = `Target ambiguous: ${attempt.description} matched ${pool.length} elements: ${named}${more}.`;
    return new TargetResolutionError(message, failure, { strategy: attempt.strategy, candidateCount: pool.length });
  }
  function scoredAmbiguous(decided, misses) {
    const top = decided.ranked.slice(0, MAX_NAMED_CANDIDATES);
    const named = top.map((entry) => `${candidateLabel(entry.element)} (${entry.score.normalizedScore.toFixed(2)})`).join(", ");
    const more = decided.ranked.length > MAX_NAMED_CANDIDATES ? `, and ${decided.ranked.length - MAX_NAMED_CANDIDATES} more` : "";
    const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS, {
      expected: misses.length ? `one element matching ${misses.join(", ")}` : "one recorded control",
      actual: `no exact match; ${decided.ranked.length} scored candidate(s) tied: ${named}${more}`
    });
    const message = `Target ambiguous: no exact match, and the top scored candidates tied: ${named}${more}.`;
    const best = decided.ranked[0];
    return new TargetResolutionError(message, failure, {
      strategy: "scored-candidate",
      candidateCount: decided.ranked.length,
      ...best ? { bestScore: best.score.normalizedScore, confidence: best.score.confidence } : {},
      ...decided.ranked[1] ? { runnerUpScore: decided.ranked[1].score.normalizedScore } : {}
    });
  }
  function notFound(message, misses, pool, decided) {
    const best = decided?.ranked[0];
    const runnerUp = decided?.ranked[1];
    const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, {
      expected: misses.length ? `an element matching ${misses.join(", ")}` : "a selector, coordinates, or a focused element",
      actual: `nothing matched; ${familySeen(pool)}${best ? `; best scored ${best.score.normalizedScore.toFixed(2)}` : ""}`
    });
    return new TargetResolutionError(message, failure, {
      strategy: strategyOf(misses),
      candidateCount: pool.candidates.length,
      ...best ? { bestScore: best.score.normalizedScore, confidence: best.score.confidence } : {},
      ...runnerUp ? { runnerUpScore: runnerUp.score.normalizedScore } : {}
    });
  }
  function familySeen(pool) {
    const found = `${pool.candidates.length} control(s) of the same family`;
    if (!pool.truncated) return `${found} are on the page`;
    return `${found} in the first ${pool.examined} interactive element(s); the scan was cut short there, so the page may hold more`;
  }
  function scoreByElement(decided) {
    return new Map((decided?.ranked ?? []).map((entry) => [entry.element, entry.score.normalizedScore]));
  }
  function namedCandidate(element, scores) {
    const score = scores.get(element);
    return score === void 0 ? candidateLabel(element) : `${candidateLabel(element)} (${score.toFixed(2)})`;
  }
  function strategyOf(misses) {
    const last = misses.at(-1);
    if (!last) return "active-element";
    if (last.startsWith("selector")) return "selector";
    if (last.startsWith("coordinates")) return "coordinates";
    if (last.startsWith("visual target")) return "visual-target";
    return "fingerprint";
  }
  function recordedTarget(action) {
    return describedElement(action.element) ?? describedElement(action.options?.element);
  }
  function describedElement(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
    return Object.keys(value).length ? value : void 0;
  }
  function querySelectorAll(selector) {
    try {
      return [...document.querySelectorAll(selector)];
    } catch {
      return [];
    }
  }
  function elementsAtPoint(point) {
    const element = document.elementFromPoint(point.x, point.y);
    return element ? [element] : [];
  }
  function pointFromVisualTarget(visualTarget) {
    if (visualTarget?.documentBounds) {
      const center2 = centerPoint(visualTarget.documentBounds);
      return { x: center2.x - window.scrollX, y: center2.y - window.scrollY };
    }
    const bounds = visualTarget?.bounds ?? visualTarget?.anchor?.bounds;
    return bounds ? centerPoint(bounds) : void 0;
  }
  function centerPoint(rect2) {
    return { x: rect2.x + rect2.width / 2, y: rect2.y + rect2.height / 2 };
  }
  function normalizeText3(value) {
    return value.replace(/\s+/gu, " ").trim();
  }

  // src/content/action-runtime/extract.ts
  function extractElement(element, options) {
    if (isWithinSensitiveControl(element)) return { ok: false, refusal: "sensitive_value" };
    const mode = options?.mode;
    if (mode === "html") return { ok: true, value: htmlWithoutSensitiveContent(element) };
    if (mode === "attribute" && typeof options?.attribute === "string") return { ok: true, value: element.getAttribute(options.attribute) ?? "" };
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      return { ok: true, value: element.value };
    }
    return { ok: true, value: readableText(element) };
  }
  function readableText(element) {
    return textOutsideSensitiveControls(element).replace(/\s+/gu, " ").trim();
  }
  function hasSensitiveDescendant(root) {
    for (const descendant of root.querySelectorAll("*")) {
      if (isSensitiveFormControl(descendant)) return true;
    }
    return false;
  }
  function htmlWithoutSensitiveContent(element) {
    if (!hasSensitiveDescendant(element)) return element.innerHTML;
    const copy = document.implementation.createHTMLDocument("").importNode(element, true);
    for (const descendant of copy.querySelectorAll("*")) {
      if (!isSensitiveFormControl(descendant)) continue;
      descendant.removeAttribute("value");
      descendant.replaceChildren();
    }
    return copy.innerHTML;
  }

  // src/content/action-runtime/scroll-element-into-view.ts
  function scrollElementIntoView(element) {
    element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
  }

  // src/content/action-runtime/set-element-value.ts
  function setElementValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    descriptor?.set?.call(element, value);
  }

  // src/content/action-runtime/input-events.ts
  function dispatchInputEvents(element) {
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // src/content/action-runtime/actionability.ts
  function checkActionability(element) {
    if (!element.isConnected) return reject("hidden", "the element is not in the document");
    const view = element.ownerDocument.defaultView;
    if (!view) return reject("hidden", "the element's document is not displayed");
    const hidden = hiddenReason(element, view);
    if (hidden) return reject("hidden", hidden);
    const disabled = disabledReason(element);
    if (disabled) return reject("disabled", disabled);
    scrollElementIntoView(element);
    const point = hitPoint(element, view);
    if (!point) return reject("hidden", "no part of the element is inside the viewport, even after scrolling");
    const hit = topmostAt(element.ownerDocument, point);
    if (!hit) return reject("covered", `nothing is painted at ${describePoint(point)}`, point);
    if (hit === element) return { actionable: true, point, detail: `the point ${describePoint(point)} landed on the target` };
    if (isWithin(element, hit)) {
      return { actionable: true, point, detail: `the point ${describePoint(point)} landed on ${elementLabel(hit)}, inside the target` };
    }
    return reject("covered", `the point ${describePoint(point)} landed on ${elementLabel(hit)}, which covers the target`, point);
  }
  function reject(code, detail, point) {
    return { actionable: false, code, detail, ...point ? { point } : {} };
  }
  function hiddenReason(element, view) {
    if (element.closest("[inert]")) return "the element is inert";
    const style2 = view.getComputedStyle(element);
    if (style2.display === "none") return "the element's display is none";
    if (style2.visibility !== "visible") return `the element's visibility is ${style2.visibility}`;
    if (style2.opacity === "0") return "the element's opacity is 0";
    const rect2 = element.getBoundingClientRect();
    if (rect2.width <= 0 || rect2.height <= 0) return "the element has a zero-size box";
    const checkable = element;
    if (typeof checkable.checkVisibility === "function") {
      const visible = checkable.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true });
      if (!visible) return "the element is not rendered";
    }
    return void 0;
  }
  function disabledReason(element) {
    if (element.matches(":disabled")) return "the element is disabled";
    const ariaDisabled = element.closest('[aria-disabled="true"]');
    if (ariaDisabled === element) return "the element is aria-disabled";
    if (ariaDisabled) return `${elementLabel(ariaDisabled)}, an ancestor of the element, is aria-disabled`;
    if (element.hasAttribute("disabled")) return "the element has a disabled attribute";
    return void 0;
  }
  function hitPoint(element, view) {
    const rect2 = element.getBoundingClientRect();
    const left = Math.max(rect2.left, 0);
    const top = Math.max(rect2.top, 0);
    const right = Math.min(rect2.right, view.innerWidth);
    const bottom = Math.min(rect2.bottom, view.innerHeight);
    if (right <= left || bottom <= top) return void 0;
    return { x: (left + right) / 2, y: (top + bottom) / 2 };
  }
  function topmostAt(document2, point) {
    let hit = document2.elementFromPoint(point.x, point.y) ?? void 0;
    for (let depth = 0; depth < 16; depth += 1) {
      const root = hit?.shadowRoot;
      if (!root) break;
      const deeper = root.elementFromPoint(point.x, point.y);
      if (!deeper || deeper === hit) break;
      hit = deeper;
    }
    return hit;
  }
  function isWithin(ancestor, node) {
    let current = node;
    while (current) {
      if (current === ancestor) return true;
      current = current instanceof ShadowRoot ? current.host : current.parentNode;
    }
    return false;
  }
  function elementLabel(element) {
    const tag = element.tagName.toLowerCase();
    const testId = element.getAttribute("data-testid");
    if (testId) return `${tag}[data-testid="${testId}"]`;
    if (element.id) return `${tag}#${element.id}`;
    const className = typeof element.className === "string" ? element.className.trim().split(/\s+/u)[0] : void 0;
    return className ? `${tag}.${className}` : tag;
  }
  function describePoint(point) {
    return `${Math.round(point.x)},${Math.round(point.y)}`;
  }

  // src/content/action-runtime/keyboard/key-event.ts
  var NAMED_KEYS = {
    Enter: { code: "Enter", keyCode: 13 },
    Tab: { code: "Tab", keyCode: 9 },
    Escape: { code: "Escape", keyCode: 27 },
    Backspace: { code: "Backspace", keyCode: 8 },
    Delete: { code: "Delete", keyCode: 46 },
    ArrowUp: { code: "ArrowUp", keyCode: 38 },
    ArrowDown: { code: "ArrowDown", keyCode: 40 },
    ArrowLeft: { code: "ArrowLeft", keyCode: 37 },
    ArrowRight: { code: "ArrowRight", keyCode: 39 },
    Home: { code: "Home", keyCode: 36 },
    End: { code: "End", keyCode: 35 },
    PageUp: { code: "PageUp", keyCode: 33 },
    PageDown: { code: "PageDown", keyCode: 34 },
    " ": { code: "Space", keyCode: 32 }
  };
  function dispatchKeyEvent(target, type, key, modifiers) {
    const { code, keyCode } = keyIdentifiers(key);
    return target.dispatchEvent(new KeyboardEvent(type, {
      key,
      code,
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
      composed: true,
      altKey: modifiers?.alt ?? false,
      ctrlKey: modifiers?.ctrl ?? false,
      metaKey: modifiers?.meta ?? false,
      shiftKey: modifiers?.shift ?? false
    }));
  }
  function keyIdentifiers(key) {
    const named = NAMED_KEYS[key];
    if (named) return named;
    if (key.length !== 1) return { code: "", keyCode: 0 };
    const upper = key.toUpperCase();
    if (upper >= "A" && upper <= "Z") return { code: `Key${upper}`, keyCode: upper.charCodeAt(0) };
    if (key >= "0" && key <= "9") return { code: `Digit${key}`, keyCode: key.charCodeAt(0) };
    return { code: "", keyCode: upper.charCodeAt(0) };
  }

  // src/content/action-runtime/keyboard/editable-target.ts
  var NON_TEXT_INPUT_TYPES = /* @__PURE__ */ new Set([
    "checkbox",
    "radio",
    "file",
    "submit",
    "reset",
    "button",
    "image",
    "range",
    "color",
    "hidden"
  ]);
  function isTextField(element) {
    if (element instanceof HTMLTextAreaElement) return true;
    return element instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(element.type);
  }
  function isEditableHost(element) {
    return element instanceof HTMLElement && element.isContentEditable;
  }

  // src/content/action-runtime/keyboard/text-edits.ts
  function insertText(element, data) {
    if (!acceptsEdits(element)) return false;
    if (!beforeInput(element, "insertText", data)) return false;
    if (isTextField(element)) insertIntoField(element, data);
    else insertIntoHost(element, data);
    afterInput(element, "insertText", data);
    return true;
  }
  function deleteAllContent(element) {
    if (!acceptsEdits(element)) return false;
    if (isTextField(element)) {
      if (!element.value) return true;
      if (!beforeInput(element, "deleteContentBackward")) return false;
      setElementValue(element, "");
    } else {
      if (!element.textContent) return true;
      if (!beforeInput(element, "deleteContentBackward")) return false;
      element.replaceChildren();
    }
    afterInput(element, "deleteContentBackward");
    return true;
  }
  function acceptsEdits(element) {
    return !isTextField(element) || !element.readOnly && !element.disabled;
  }
  function beforeInput(element, inputType, data) {
    return element.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType,
      ...data === void 0 ? {} : { data }
    }));
  }
  function afterInput(element, inputType, data) {
    element.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: false,
      composed: true,
      inputType,
      ...data === void 0 ? {} : { data }
    }));
  }
  function insertIntoField(element, data) {
    const selection = fieldSelection(element);
    const value = element.value;
    const start = selection?.start ?? value.length;
    const end = selection?.end ?? value.length;
    setElementValue(element, value.slice(0, start) + data + value.slice(end));
    const caret = start + data.length;
    try {
      element.setSelectionRange(caret, caret);
    } catch {
    }
  }
  function fieldSelection(element) {
    try {
      const start = element.selectionStart;
      const end = element.selectionEnd;
      return start === null || end === null ? void 0 : { start, end };
    } catch {
      return void 0;
    }
  }
  function insertIntoHost(element, data) {
    const selection = document.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : void 0;
    if (!selection || !range || !element.contains(range.commonAncestorContainer)) {
      element.append(data);
      return;
    }
    range.deleteContents();
    const text3 = document.createTextNode(data);
    range.insertNode(text3);
    range.setStartAfter(text3);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // src/content/action-runtime/keyboard/implicit-submission.ts
  function submitOwningForm(element) {
    if (!(element instanceof HTMLInputElement) || !isTextField(element)) {
      return { kind: "not-a-form-field", detail: `Enter has no default action on <${element.tagName.toLowerCase()}>` };
    }
    const form = element.form;
    if (!form) return { kind: "not-a-form-field", detail: "the field belongs to no form, so Enter submits nothing" };
    const label = formLabel(form);
    const submitter = defaultSubmitButton(form);
    if (!submitter && implicitSubmissionBlockers(form) !== 1) {
      return { kind: "no-default-button", form: label, detail: `${label} has no submit button and more than one field, so Enter does not submit it` };
    }
    return requestSubmit(form, label, submitter);
  }
  function requestSubmit(form, label, submitter) {
    let submitted = false;
    const observe = () => {
      submitted = true;
    };
    form.addEventListener("submit", observe, { capture: true, once: true });
    try {
      if (submitter) form.requestSubmit(submitter);
      else form.requestSubmit();
    } catch (error) {
      return { kind: "blocked", form: label, detail: `${label} refused to submit: ${error instanceof Error ? error.message : "the browser rejected the request"}` };
    } finally {
      form.removeEventListener("submit", observe, { capture: true });
    }
    if (!submitted) {
      return { kind: "blocked", form: label, detail: `${label} did not fire a submit event; its own constraint validation refused the submission` };
    }
    return {
      kind: "submitted",
      form: label,
      detail: `${label} fired a submit event${submitter ? ` with ${buttonLabel(submitter)} as the submitter` : " with no submitter"}`
    };
  }
  function defaultSubmitButton(form) {
    for (const candidate of form.elements) {
      if (candidate instanceof HTMLButtonElement && candidate.type === "submit" && !candidate.disabled) return candidate;
      if (candidate instanceof HTMLInputElement && candidate.type === "submit" && !candidate.disabled) return candidate;
    }
    return void 0;
  }
  function implicitSubmissionBlockers(form) {
    let count3 = 0;
    for (const candidate of form.elements) {
      if (candidate instanceof HTMLInputElement && isTextField(candidate)) count3 += 1;
    }
    return count3;
  }
  function formLabel(form) {
    const testId = form.dataset.testid;
    if (testId) return `the form [data-testid="${testId}"]`;
    if (form.id) return `the form #${form.id}`;
    if (form.name) return `the form named "${form.name}"`;
    return "the form";
  }
  function buttonLabel(button) {
    const testId = button.dataset.testid;
    if (testId) return `[data-testid="${testId}"]`;
    if (button.id) return `#${button.id}`;
    const text3 = button.textContent?.replace(/\s+/gu, " ").trim();
    return text3 ? `the "${text3}" button` : "the form's default button";
  }

  // src/content/action-runtime/keyboard/tab-order.ts
  var TABBABLE_SELECTOR = [
    "a[href]",
    "area[href]",
    "button",
    "input",
    "select",
    "textarea",
    "summary",
    "iframe",
    "[contenteditable]:not([contenteditable='false'])",
    "[tabindex]"
  ].join(", ");
  function moveFocusByTab(from, backwards) {
    const order = tabOrder();
    if (order.length === 0) return void 0;
    const index = order.indexOf(from);
    const step2 = backwards ? -1 : 1;
    const next = index === -1 ? order[backwards ? order.length - 1 : 0] : order[(index + step2 + order.length) % order.length];
    if (!next) return void 0;
    next.focus();
    return document.activeElement === next ? next : void 0;
  }
  function tabOrder() {
    const candidates = [...document.querySelectorAll(TABBABLE_SELECTOR)].filter(isTabbable);
    const prioritized = candidates.filter((element) => element.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex);
    return [...prioritized, ...candidates.filter((element) => element.tabIndex === 0)];
  }
  function isTabbable(element) {
    if (element.tabIndex < 0 || isDisabled2(element)) return false;
    if (element.hidden || element.closest("[inert]")) return false;
    if (element.getClientRects().length === 0) return false;
    if (getComputedStyle(element).visibility === "hidden") return false;
    return !isSkippedRadio(element);
  }
  function isDisabled2(element) {
    const disableable = element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement;
    return disableable && element.disabled;
  }
  function isSkippedRadio(element) {
    if (!(element instanceof HTMLInputElement) || element.type !== "radio" || !element.name) return false;
    const group = [...(element.form ?? document).querySelectorAll('input[type="radio"]')].filter((radio) => radio.name === element.name);
    const checked = group.find((radio) => radio.checked);
    return checked ? checked !== element : group[0] !== element;
  }

  // src/content/action-runtime/keyboard/press-key.ts
  var ARROW_KEYS = /* @__PURE__ */ new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
  function pressKey(target, key, modifiers) {
    if (!key) {
      return { dispatched: false, defaultAction: "none", expected: "a key to press", detail: "the command named no key", held: false };
    }
    if (target instanceof HTMLElement) target.focus();
    const allowed = dispatchKeyEvent(target, "keydown", key, modifiers);
    const outcome = allowed ? defaultActionFor(target, key, modifiers) : pageHandled(key);
    dispatchKeyEvent(document.activeElement ?? target, "keyup", key, modifiers);
    return outcome;
  }
  function pageHandled(key) {
    return {
      dispatched: true,
      defaultAction: "none",
      expected: `the page receives the ${key} key`,
      detail: `the page handled ${key} and cancelled its default action`,
      held: true
    };
  }
  function defaultActionFor(target, key, modifiers) {
    if (key === "Enter") return enterPressed(target);
    if (key === "Tab") return tabPressed(target, modifiers?.shift === true);
    const refused2 = unsupportedDefault(target, key);
    if (refused2) return refused2;
    if (isPrintable(key, modifiers) && (isTextField(target) || isEditableHost(target))) return characterTyped(target, key);
    return {
      dispatched: true,
      defaultAction: "none",
      expected: `the page receives the ${key} key`,
      detail: `${key} was delivered; it has no default action on this target`,
      held: true
    };
  }
  function enterPressed(target) {
    if (target instanceof HTMLTextAreaElement || isEditableHost(target)) {
      const inserted = insertText(target, "\n");
      return {
        dispatched: true,
        defaultAction: "none",
        expected: "Enter inserts a line break",
        detail: inserted ? "a line break was inserted" : "the page cancelled the line break",
        held: inserted
      };
    }
    const submission = submitOwningForm(target);
    if (submission.kind === "submitted") {
      return { dispatched: true, defaultAction: "submitted", expected: `Enter submits ${submission.form ?? "the form"}`, detail: submission.detail, held: true };
    }
    if (submission.kind === "blocked") {
      return { dispatched: true, defaultAction: "none", expected: `Enter submits ${submission.form ?? "the form"}`, detail: submission.detail, held: false };
    }
    return { dispatched: true, defaultAction: "none", expected: "the page receives the Enter key", detail: submission.detail, held: true };
  }
  function tabPressed(target, backwards) {
    const direction = backwards ? "the previous" : "the next";
    const landed = moveFocusByTab(target, backwards);
    return {
      dispatched: true,
      defaultAction: landed ? "focus-moved" : "none",
      expected: `focus moves to ${direction} tabbable element`,
      detail: landed ? `focus moved to ${describe(landed)}` : "focus did not move: nothing else on the page is tabbable",
      held: landed !== void 0
    };
  }
  function characterTyped(target, key) {
    const inserted = insertText(target, key);
    return {
      dispatched: true,
      defaultAction: "none",
      expected: `the character "${key}" is inserted`,
      detail: inserted ? `"${key}" was inserted` : "the page cancelled the insertion",
      held: inserted
    };
  }
  function unsupportedDefault(target, key) {
    if (ARROW_KEYS.has(key) && isRadio(target)) {
      return unsupported(key, "moving a radio group's selection needs a trusted key event", "web.dom.check");
    }
    if (ARROW_KEYS.has(key) && target instanceof HTMLSelectElement) {
      return unsupported(key, "changing a select's option needs a trusted key event", "web.dom.select");
    }
    if (key === " " && (isRadio(target) || isCheckbox(target))) {
      return unsupported(key, "toggling a checkbox or radio needs a trusted key event", "web.dom.check");
    }
    if (key === " " && isButton(target)) {
      return unsupported(key, "activating a button needs a trusted key event", "web.dom.click");
    }
    return void 0;
  }
  function unsupported(key, why, verb) {
    return {
      dispatched: true,
      defaultAction: "unsupported",
      expected: `${key} performs its default action on this target`,
      detail: `${why}; the key was delivered but nothing changed -- use ${verb} instead`,
      held: false
    };
  }
  function isPrintable(key, modifiers) {
    if ([...key].length !== 1) return false;
    return !(modifiers?.ctrl ?? false) && !(modifiers?.meta ?? false) && !(modifiers?.alt ?? false);
  }
  function isRadio(target) {
    return target instanceof HTMLInputElement && target.type === "radio";
  }
  function isCheckbox(target) {
    return target instanceof HTMLInputElement && target.type === "checkbox";
  }
  function isButton(target) {
    if (target instanceof HTMLButtonElement) return true;
    return target instanceof HTMLInputElement && ["submit", "reset", "button", "image"].includes(target.type);
  }
  function describe(element) {
    const testId = element.dataset.testid;
    if (testId) return `[data-testid="${testId}"]`;
    if (element.id) return `#${element.id}`;
    return `<${element.tagName.toLowerCase()}>`;
  }

  // src/content/action-runtime/keyboard/type-text.ts
  function typeText(element, text3) {
    if (!isTextField(element) && !isEditableHost(element)) return;
    if (element instanceof HTMLElement) element.focus();
    deleteAllContent(element);
    for (const character of text3) {
      if (dispatchKeyEvent(element, "keydown", character)) insertText(element, character);
      dispatchKeyEvent(element, "keyup", character);
    }
    if (isTextField(element)) element.dispatchEvent(new Event("change", { bubbles: true }));
    else element.normalize();
  }

  // src/content/action-runtime/keyboard/capability.ts
  var keyboard = { typeText, pressKey };

  // src/content/action-runtime/checkable-state.ts
  function setCheckedState(element, checked) {
    const input = checkableInput(element);
    if (!input) {
      return { ok: false, reason: `${describeTarget(element)} is not a checkbox or a radio`, code: "not-checkable" };
    }
    if (isDisabled3(input)) {
      return { ok: false, reason: `the ${kindOf(input)} is disabled`, code: "disabled" };
    }
    if (kindOf(input) === "radio" && !checked) {
      return { ok: false, reason: "a radio cannot be unchecked; check another radio in its group instead", code: "not-checkable" };
    }
    const kind = kindOf(input);
    if (input.checked === checked) return { ok: true, kind, checked: input.checked, changed: false };
    input.focus();
    input.checked = checked;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, kind, checked: input.checked, changed: true };
  }
  function checkableInput(element) {
    if (element.tagName !== "INPUT") return void 0;
    const input = element;
    return input.type === "checkbox" || input.type === "radio" ? input : void 0;
  }
  function kindOf(input) {
    return input.type === "radio" ? "radio" : "checkbox";
  }
  function isDisabled3(input) {
    return input.matches(":disabled") || input.getAttribute("aria-disabled") === "true";
  }
  function describeTarget(element) {
    const type = element.tagName === "INPUT" ? `[type=${element.type}]` : "";
    return `<${element.tagName.toLowerCase()}${type}>`;
  }

  // src/content/extraction/field-reader.ts
  function readField(item, name, reader) {
    const value = reader.kind === "column" ? readColumn(item, name, reader.header) : readElement(item, name, reader);
    if (value !== void 0) return value;
    return reader.required ? void 0 : null;
  }
  function readElement(item, name, reader) {
    const element = reader.selector ? item.querySelector(reader.selector) : item;
    if (!element) return void 0;
    if (isWithinSensitiveControl(element)) throw sensitiveFieldRefusal(name);
    switch (reader.kind) {
      case "text":
        return readText(element);
      case "attribute":
        return element.getAttribute(reader.attribute) ?? void 0;
      case "link":
        return linkTarget(element);
      case "value":
        return controlValue(element);
    }
  }
  function readColumn(item, name, header) {
    const row = item;
    const table = row.tagName === "TR" ? row.closest("table") : null;
    if (!table) throw new Error("A column field needs extract_list items that are table rows.");
    const headerRow = table.tHead?.rows[0] ?? Array.from(table.rows).find((candidate) => Array.from(candidate.cells).some((cell2) => cell2.tagName === "TH"));
    const index = headerRow ? Array.from(headerRow.cells).findIndex((cell2) => normalizeText4(cell2.textContent ?? "") === header) : -1;
    if (index < 0) return void 0;
    const cell = row.cells[index];
    if (!cell) return void 0;
    if (isWithinSensitiveControl(cell)) throw sensitiveFieldRefusal(name);
    return readText(cell);
  }
  function readText(element) {
    return normalizeText4(textOutsideSensitiveControls(element));
  }
  function linkTarget(element) {
    const href = element.getAttribute("href");
    if (href === null) return void 0;
    try {
      const url = new URL(href, element.baseURI);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : void 0;
    } catch {
      return void 0;
    }
  }
  function controlValue(element) {
    return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement ? element.value : void 0;
  }
  function sensitiveFieldRefusal(name) {
    const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, {
      expected: `field ${name} reads no sensitive control`,
      actual: `sensitive_value: field ${name} resolved to a sensitive control, so its value is never read`
    });
    return Object.assign(
      new Error(`The extract_list field ${JSON.stringify(name)} resolved to a sensitive control, so its value is never read.`),
      { failure }
    );
  }
  function normalizeText4(text3) {
    return text3.replace(/\s+/gu, " ").trim();
  }

  // src/content/extraction/field-spec.ts
  var COLUMN_PREFIX = "column:";
  var ATTRIBUTE_NAME = /^[A-Za-z_][-A-Za-z0-9_:.]*$/u;
  function normalizeExtractField(name, field) {
    if (typeof field === "string") return parseStringField(field);
    if (typeof field !== "object" || field === null) {
      throw new Error(`The extract_list field ${JSON.stringify(name)} is neither a selector nor a field spec.`);
    }
    return normalizeSpec(name, field);
  }
  function parseStringField(spec) {
    if (spec.startsWith(COLUMN_PREFIX)) {
      const header = normalizeText5(spec.slice(COLUMN_PREFIX.length));
      if (!header) throw new Error(`The extract_list field ${JSON.stringify(spec)} names no column header.`);
      return { kind: "column", header, required: true };
    }
    const at = spec.lastIndexOf("@");
    const candidate = at < 0 ? "" : spec.slice(at + 1);
    const attribute = ATTRIBUTE_NAME.test(candidate) ? candidate : void 0;
    const selector = (attribute === void 0 ? spec : spec.slice(0, at)).trim();
    const where = selector ? { selector } : {};
    return attribute === void 0 ? { kind: "text", ...where, required: true } : { kind: "attribute", ...where, attribute, required: true };
  }
  function normalizeSpec(name, spec) {
    const handling = spec.handling ?? "include";
    if (handling === "exclude") return void 0;
    if (handling === "encrypt") throw encryptNotImplemented(name);
    if (handling !== "include") throw new Error(`The extract_list field ${JSON.stringify(name)} asks for a handling the page does not know.`);
    const required = spec.required !== false;
    const selector = typeof spec.selector === "string" ? spec.selector.trim() : "";
    const where = selector ? { selector } : {};
    const kind = spec.kind;
    switch (kind) {
      case "text":
      case "link":
      case "value":
        return { kind, ...where, required };
      case "attribute": {
        const attribute = typeof spec.attribute === "string" ? spec.attribute.trim() : "";
        if (!attribute) throw new Error(`The extract_list field ${JSON.stringify(name)} reads an attribute but names none.`);
        return { kind, ...where, attribute, required };
      }
      case "column": {
        const header = normalizeText5(typeof spec.header === "string" ? spec.header : "");
        if (!header) throw new Error(`The extract_list field ${JSON.stringify(name)} reads a column but names no header.`);
        return { kind, header, required };
      }
      default:
        throw new Error(`The extract_list field ${JSON.stringify(name)} asks for a kind of read the page does not know.`);
    }
  }
  function encryptNotImplemented(name) {
    const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED, {
      expected: "the Encrypt column to be implemented",
      actual: `field ${name} asks for handling "encrypt", which the page does not read until the Encrypt column is built`
    });
    return Object.assign(new Error(`web.dom.extract_list does not encrypt a column yet: field ${name} asks for it.`), { failure });
  }
  function normalizeText5(text3) {
    return text3.replace(/\s+/gu, " ").trim();
  }

  // src/content/extraction/pagination.ts
  var LIST_CHANGE_TIMEOUT_MS = 1e4;
  var LIST_CHANGE_POLL_MS = 25;
  var SCROLL_GROWTH_WINDOW_MS = 900;
  var SCROLL_POLL_MS = 50;
  var BOTTOM_TOLERANCE_PX = 2;
  function paginationBound(paginate) {
    const requested = paginate.mode === "scroll" ? paginate.maxScrolls : paginate.maxPages;
    const whole = typeof requested === "number" && !Number.isNaN(requested) ? Math.trunc(requested) : 1;
    return Math.min(Math.max(1, whole), WEB_AUTOMATION_EXTRACT_MAX_PAGES);
  }
  function deadlineFor(timeoutMs) {
    return typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0 ? Date.now() + timeoutMs : void 0;
  }
  async function advancePage(paginate, progress) {
    switch (paginate.mode) {
      case void 0:
      case "next":
        return await followNext(paginate, progress);
      case "loadMore":
        return await pressLoadMore(paginate, progress);
      case "scroll":
        return await scrollForMore(paginate, progress);
      case "numbered":
        return await visitNumberedPage(paginate, progress);
      default: {
        const mode = paginate.mode;
        const named = typeof mode === "string" ? `pagination mode ${JSON.stringify(mode)}` : "a pagination mode that is not a string";
        throw new Error(`web.dom.extract_list does not know ${named}.`);
      }
    }
  }
  async function followNext(paginate, progress) {
    const next = document.querySelector(paginate.next);
    if (!next) return "ended";
    if (progress.pagesRead >= paginationBound(paginate)) return "truncated";
    const control = clickable(next, paginate.next);
    if (pastDeadline(progress.deadline)) return "timed_out";
    control.click();
    return await afterListChange(progress, `following ${JSON.stringify(paginate.next)} to page ${progress.pagesRead + 1}`);
  }
  async function pressLoadMore(paginate, progress) {
    const found = document.querySelector(paginate.control);
    if (!found || isDisabled4(found)) return "ended";
    if (progress.pagesRead >= paginationBound(paginate)) return "truncated";
    const control = clickable(found, paginate.control);
    if (pastDeadline(progress.deadline)) return "timed_out";
    control.click();
    const outcome = await waitUntil(() => progress.hasUnreadItem() || !control.isConnected, LIST_CHANGE_TIMEOUT_MS, LIST_CHANGE_POLL_MS, progress.deadline);
    if (outcome === "unchanged") {
      throw new Error(`No new item appeared within ${LIST_CHANGE_TIMEOUT_MS}ms of pressing ${JSON.stringify(paginate.control)} for page ${progress.pagesRead + 1}.`);
    }
    return outcome === "changed" ? "advanced" : "timed_out";
  }
  async function scrollForMore(paginate, progress) {
    const bound = paginationBound(paginate);
    const scroller = scrollerOf(progress.shown[0]);
    for (; ; ) {
      if (progress.scrolls >= bound) return "truncated";
      if (pastDeadline(progress.deadline)) return "timed_out";
      scrollToBottom(scroller);
      progress.scrolls += 1;
      const outcome = await waitUntil(() => progress.hasUnreadItem(), SCROLL_GROWTH_WINDOW_MS, SCROLL_POLL_MS, progress.deadline);
      if (outcome === "changed") return "advanced";
      if (outcome === "timed_out") return "timed_out";
      if (atBottom2(scroller)) return "ended";
    }
  }
  async function visitNumberedPage(paginate, progress) {
    const following = followingPageControl(Array.from(document.querySelectorAll(paginate.pages)), progress.pagesRead);
    if (!following) return "ended";
    if (progress.pagesRead >= paginationBound(paginate)) return "truncated";
    const control = clickable(following, paginate.pages);
    if (pastDeadline(progress.deadline)) return "timed_out";
    control.click();
    return await afterListChange(progress, `choosing page ${progress.pagesRead + 1} from ${JSON.stringify(paginate.pages)}`);
  }
  function followingPageControl(controls, pagesRead) {
    const current = controls.find(isCurrentPage);
    if (!current) return controls[pagesRead];
    const number = pageNumber(current);
    if (number === void 0) return controls[controls.indexOf(current) + 1];
    return controls.find((control) => pageNumber(control) === number + 1);
  }
  function isCurrentPage(control) {
    const current = control.getAttribute("aria-current");
    return current !== null && current !== "false";
  }
  function pageNumber(control) {
    const text3 = (control.textContent ?? "").trim();
    return /^\d+$/u.test(text3) ? Number(text3) : void 0;
  }
  function isDisabled4(control) {
    return control.matches(":disabled") || control.getAttribute("aria-disabled") === "true";
  }
  function clickable(element, selector) {
    if (!(element instanceof HTMLElement)) throw new Error(`The pagination control ${JSON.stringify(selector)} is not a clickable element.`);
    return element;
  }
  function pastDeadline(deadline) {
    return deadline !== void 0 && Date.now() >= deadline;
  }
  async function afterListChange(progress, action) {
    const { item, shown, deadline } = progress;
    const outcome = await waitUntil(() => listChanged(item, shown), LIST_CHANGE_TIMEOUT_MS, LIST_CHANGE_POLL_MS, deadline);
    if (outcome === "unchanged") throw new Error(`The list did not change within ${LIST_CHANGE_TIMEOUT_MS}ms of ${action}.`);
    return outcome === "changed" ? "advanced" : "timed_out";
  }
  function listChanged(itemSelector, previous2) {
    const current = document.querySelectorAll(itemSelector);
    const first = previous2[0];
    if (!first) return current.length > 0;
    return !first.isConnected || current.length !== previous2.length || current[0] !== first;
  }
  async function waitUntil(condition, windowMs, pollMs, actionDeadline) {
    const windowEnd = Date.now() + windowMs;
    const commandEndsFirst = actionDeadline !== void 0 && actionDeadline <= windowEnd;
    const end = commandEndsFirst ? actionDeadline : windowEnd;
    while (!condition()) {
      const now = Date.now();
      if (now >= end) return commandEndsFirst ? "timed_out" : "unchanged";
      await delay2(Math.min(pollMs, end - now));
    }
    return "changed";
  }
  function scrollerOf(element) {
    for (let current = element?.parentElement ?? null; current; current = current.parentElement) {
      if (current === document.body || current === document.documentElement) return null;
      const overflow = getComputedStyle(current).overflowY;
      if ((overflow === "auto" || overflow === "scroll" || overflow === "overlay") && current.scrollHeight > current.clientHeight) return current;
    }
    return null;
  }
  function scrollToBottom(scroller) {
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    else window.scrollTo({ left: window.scrollX, top: documentHeight2(), behavior: "instant" });
  }
  function atBottom2(scroller) {
    if (scroller) return scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - BOTTOM_TOLERANCE_PX;
    return window.scrollY + window.innerHeight >= documentHeight2() - BOTTOM_TOLERANCE_PX;
  }
  function documentHeight2() {
    return Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
  }
  function delay2(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  // src/content/extraction/list-reader.ts
  async function extractList(request, options = {}) {
    const item = request.item.trim();
    if (!item) throw new Error("An extract_list request needs an item selector.");
    const fields = fieldReaders(request.fields);
    const paginate = request.paginate;
    const maxItems = itemBound(request.maxItems);
    const contentAware = paginate?.mode === "scroll";
    const records = [];
    const missing = /* @__PURE__ */ new Set();
    const read = /* @__PURE__ */ new Map();
    const keyOf = (itemRead) => contentAware ? contentKey(itemRead.record, fields) : "";
    const hasUnreadItem = () => Array.from(document.querySelectorAll(item)).some((element) => {
      const seen = read.get(element);
      return seen === void 0 || contentAware && seen !== keyOf(readRecord(element, fields));
    });
    const progress = { item, shown: [], pagesRead: 0, scrolls: 0, deadline: deadlineFor(options.timeoutMs), hasUnreadItem };
    let truncated = false;
    let timedOut = false;
    for (; ; ) {
      const shown = Array.from(document.querySelectorAll(item));
      progress.shown = shown;
      progress.pagesRead += 1;
      for (const element of shown) {
        const seen = read.get(element);
        if (seen !== void 0 && !contentAware) continue;
        if (seen === void 0 && records.length >= maxItems) {
          truncated = true;
          break;
        }
        const itemRead = readRecord(element, fields);
        const key = keyOf(itemRead);
        if (seen === key) continue;
        if (records.length >= maxItems) {
          truncated = true;
          break;
        }
        read.set(element, key);
        records.push(itemRead.record);
        for (const name of itemRead.missing) missing.add(name);
      }
      if (truncated || !paginate) break;
      const advance = await advancePage(paginate, progress);
      if (advance === "advanced") continue;
      truncated = advance === "truncated";
      timedOut = advance === "timed_out";
      break;
    }
    return { records, pagesRead: progress.pagesRead, truncated, timedOut, missingFields: [...missing].sort() };
  }
  function fieldReaders(fields) {
    const declared2 = Object.entries(fields);
    if (declared2.length === 0) throw new Error("An extract_list request names no fields.");
    const readers = declared2.flatMap(([name, field]) => {
      const reader = normalizeExtractField(name, field);
      return reader === void 0 ? [] : [[name, reader]];
    });
    if (readers.length === 0) throw new Error("An extract_list request reads no fields: every field it names is excluded.");
    return readers;
  }
  function itemBound(requested) {
    const whole = typeof requested === "number" && !Number.isNaN(requested) ? Math.trunc(requested) : WEB_AUTOMATION_EXTRACT_MAX_ITEMS;
    return Math.min(Math.max(0, whole), WEB_AUTOMATION_EXTRACT_MAX_ITEMS);
  }
  function readRecord(element, fields) {
    const record = {};
    const missing = [];
    for (const [name, reader] of fields) {
      const value = readField(element, name, reader);
      if (value === void 0) missing.push(name);
      else record[name] = value;
    }
    return { record, missing };
  }
  function contentKey(record, fields) {
    return JSON.stringify(fields.map(([name]) => Object.prototype.hasOwnProperty.call(record, name) ? [record[name]] : []));
  }

  // src/content/extraction/item-selector.ts
  var PLAIN_CLASS = /^[A-Za-z_-][\w-]*$/u;
  var MAX_CANDIDATE_CLASSES = 3;
  var MIN_SHAPE_PREFIX = 2;
  function itemSelectorCandidates(parts2) {
    const tag = parts2.tagName.toLowerCase();
    const candidates = [];
    const sharedId = sharedTestId(parts2.testIds);
    if (sharedId) candidates.push({ selector: attributeSelector(sharedId.attribute, sharedId.value), confidence: 1 });
    const shape = sharedTestIdPrefix(parts2.testIds);
    if (shape) candidates.push({ selector: attributeSelector(shape.attribute, shape.value, "^"), confidence: 0.9 });
    candidates.push({ selector: `${parts2.container} > ${tag}${classSuffix(parts2.classes)}`, confidence: 0.75 });
    const role = parts2.role?.trim();
    if (role) candidates.push({ selector: `${parts2.container} > [role="${quoted(role)}"]`, confidence: 0.6 });
    return candidates;
  }
  function generalizedItemSelector(run, container) {
    const first = run[0];
    if (!first || run.length === 0) return void 0;
    const parts2 = {
      container,
      tagName: first.tagName,
      role: first.getAttribute("role") ?? void 0,
      testIds: run.map(testIdOf),
      classes: first.classList
    };
    return itemSelectorCandidates(parts2).find((candidate) => selects(candidate.selector, run));
  }
  function selects(selector, run) {
    let matched;
    try {
      matched = Array.from(document.querySelectorAll(selector));
    } catch {
      return false;
    }
    return matched.length === run.length && matched.every((element, index) => element === run[index]);
  }
  function testIdOf(element) {
    for (const attribute of ["data-testid", "data-test", "data-cy"]) {
      const value = element.getAttribute(attribute);
      if (value !== null && value !== "") return { attribute, value };
    }
    return void 0;
  }
  function sharedTestId(testIds) {
    const first = testIds[0];
    if (!first || testIds.length === 0) return void 0;
    return testIds.every((id) => id?.attribute === first.attribute && id.value === first.value) ? first : void 0;
  }
  function sharedTestIdPrefix(testIds) {
    const first = testIds[0];
    if (!first || testIds.length < 2) return void 0;
    if (!testIds.every((id) => id?.attribute === first.attribute)) return void 0;
    let length = first.value.search(/\d/u);
    if (length < MIN_SHAPE_PREFIX) return void 0;
    for (const id of testIds) {
      const value = id?.value ?? "";
      while (length >= MIN_SHAPE_PREFIX && !value.startsWith(first.value.slice(0, length))) length -= 1;
    }
    return length >= MIN_SHAPE_PREFIX ? { attribute: first.attribute, value: first.value.slice(0, length) } : void 0;
  }
  function classSuffix(classes) {
    const named = [...classes].filter((name) => PLAIN_CLASS.test(name)).sort().slice(0, MAX_CANDIDATE_CLASSES);
    return named.map((name) => `.${name}`).join("");
  }
  function attributeSelector(attribute, value, operator = "") {
    return `[${attribute}${operator}="${quoted(value)}"]`;
  }
  function quoted(value) {
    return value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
  }

  // src/content/extraction/detect-pagination.ts
  var CONTROL_SELECTOR = 'a,button,[role="button"],[role="link"]';
  var MAX_ANCESTOR_LEVELS = 6;
  var NEXT_LABEL = /^next\b|\bnext\s+page\b/u;
  var LOAD_MORE_LABEL = /\b(?:load|show|view)\s+more\b/u;
  function paginationKindForLabel(label, rel) {
    if (rel !== void 0 && rel.trim().toLowerCase().split(/\s+/u).includes("next")) return "next";
    const text3 = label.replace(/\s+/gu, " ").trim().toLowerCase();
    if (!text3) return void 0;
    if (NEXT_LABEL.test(text3)) return "next";
    if (LOAD_MORE_LABEL.test(text3)) return "loadMore";
    return void 0;
  }
  function detectPagination(run, container) {
    let level = container;
    for (let depth = 0; level && depth < MAX_ANCESTOR_LEVELS; depth += 1, level = level.parentElement) {
      const controls = Array.from(level.querySelectorAll(CONTROL_SELECTOR)).filter((control) => !run.some((item) => item === control || item.contains(control)));
      if (controls.length === 0) continue;
      const numbered = numberedControls(controls);
      const maxPages = numbered.length > 0 ? numbered.length : WEB_AUTOMATION_EXTRACT_MAX_PAGES;
      const next = controls.find((control) => kindOf2(control) === "next");
      if (next) return { next: selectorFor(next), maxPages };
      const loadMore = controls.find((control) => kindOf2(control) === "loadMore");
      if (loadMore) return { mode: "loadMore", control: selectorFor(loadMore), maxPages };
      const pages = numbered.length > 1 ? generalizedItemSelector(numbered, selectorFor(level)) : void 0;
      if (pages) return { mode: "numbered", pages: pages.selector, maxPages: numbered.length };
    }
    return void 0;
  }
  function kindOf2(control) {
    const label = control.getAttribute("aria-label") ?? textOutsideSensitiveControls(control);
    return paginationKindForLabel(label, control.getAttribute("rel") ?? void 0);
  }
  function numberedControls(controls) {
    const byTemplate = /* @__PURE__ */ new Map();
    for (const control of controls) {
      if (!isNumberLabelled(control)) continue;
      const signature = webAutomationItemSignature({
        tagName: control.tagName,
        role: control.getAttribute("role"),
        testId: testIdFor(control),
        classes: control.classList
      });
      byTemplate.set(signature, [...byTemplate.get(signature) ?? [], control]);
    }
    return [...byTemplate.values()].sort((left, right) => right.length - left.length)[0] ?? [];
  }
  function isNumberLabelled(control) {
    return /^\d+$/u.test(textOutsideSensitiveControls(control).trim());
  }

  // src/content/extraction/infer-fields.ts
  var VALUE_TAGS = /* @__PURE__ */ new Set(["input", "textarea", "select"]);
  var MAX_PROPOSED_FIELDS = 12;
  function inferFields(item, run) {
    const taken = /* @__PURE__ */ new Set();
    return fieldSources(item).slice(0, MAX_PROPOSED_FIELDS).map((source) => {
      const coverage = coverageOf(source, run);
      const key = webAutomationExtractionFieldKey(source.label, taken);
      taken.add(key);
      return { key, label: source.label, spec: proposedFieldSpec(source, coverage), coverage };
    });
  }
  function proposedFieldSpec(source, coverage) {
    return {
      kind: source.kind,
      ...source.selector === void 0 ? {} : { selector: source.selector },
      ...source.attribute === void 0 ? {} : { attribute: source.attribute },
      ...source.header === void 0 ? {} : { header: source.header },
      required: coverage >= 1,
      ...source.sensitive ? { handling: "exclude" } : {}
    };
  }
  function fieldSources(item) {
    const columns = columnSources(item);
    return columns.length > 0 ? columns : elementSources(item);
  }
  function columnSources(item) {
    if (item.tagName !== "TR") return [];
    const table = item.closest("table");
    const headerRow = table?.tHead?.rows[0] ?? Array.from(table?.rows ?? []).find((row) => Array.from(row.cells).some((cell) => cell.tagName === "TH"));
    if (!headerRow) return [];
    return Array.from(headerRow.cells).flatMap((cell, columnIndex) => {
      const header = collapsed(textOutsideSensitiveControls(cell));
      if (!header) return [];
      const bodyCell = item.cells[columnIndex];
      return [{
        kind: "column",
        label: header,
        header,
        columnIndex,
        sensitive: isWithinSensitiveControl(cell) || bodyCell !== void 0 && isWithinSensitiveControl(bodyCell)
      }];
    });
  }
  function elementSources(item) {
    const sources = [];
    const leafOrdinals = /* @__PURE__ */ new Map();
    for (const element of item.querySelectorAll("*")) {
      if (sources.length >= MAX_PROPOSED_FIELDS) break;
      const tag = element.tagName.toLowerCase();
      const testId = testIdFor(element);
      const selector = selectorWithinItem(item, element, tag);
      if (selector === void 0) continue;
      const sensitive = isWithinSensitiveControl(element);
      const named = testId ?? `${tag} ${nextOrdinal(leafOrdinals, tag)}`;
      if (tag === "img") {
        sources.push({ kind: "attribute", label: `${named} src`, selector, attribute: "src", sensitive });
        sources.push({ kind: "attribute", label: `${named} alt`, selector, attribute: "alt", sensitive });
      } else if (tag === "a" && element.getAttribute("href") !== null) {
        sources.push({ kind: "link", label: named, selector, sensitive });
      } else if (VALUE_TAGS.has(tag)) {
        sources.push({ kind: "value", label: named, selector, sensitive });
      } else if (testId || isTextLeaf(element)) {
        sources.push({ kind: "text", label: named, selector, sensitive });
      }
    }
    return sources;
  }
  function selectorWithinItem(item, element, tag) {
    for (const candidate of [testIdSelector(element), positionSelector(element, tag)]) {
      if (candidate && item.querySelectorAll(candidate).length === 1 && item.querySelector(candidate) === element) return candidate;
    }
    return void 0;
  }
  function testIdSelector(element) {
    for (const attribute of ["data-testid", "data-test", "data-cy"]) {
      const value = element.getAttribute(attribute);
      if (value) return `[${attribute}="${value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"]`;
    }
    return void 0;
  }
  function positionSelector(element, tag) {
    const siblings = Array.from(element.parentElement?.children ?? []).filter((child2) => child2.tagName === element.tagName);
    const index = siblings.indexOf(element) + 1;
    if (index === 0) return void 0;
    return siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag;
  }
  function isTextLeaf(element) {
    return element.children.length === 0 && collapsed(textOutsideSensitiveControls(element)) !== "";
  }
  function coverageOf(source, run) {
    if (run.length === 0) return 0;
    const found = run.filter((item) => resolvesIn(source, item)).length;
    return Math.round(found / run.length * 100) / 100;
  }
  function resolvesIn(source, item) {
    if (source.kind === "column") {
      const cells = item.cells;
      return source.columnIndex !== void 0 && cells !== void 0 && cells[source.columnIndex] !== void 0;
    }
    const element = source.selector ? item.querySelector(source.selector) : item;
    if (!element) return false;
    if (source.kind === "attribute") return source.attribute !== void 0 && element.hasAttribute(source.attribute);
    if (source.kind === "link") return element.getAttribute("href") !== null;
    return true;
  }
  function nextOrdinal(ordinals, tag) {
    const next = (ordinals.get(tag) ?? 0) + 1;
    ordinals.set(tag, next);
    return next;
  }
  function collapsed(text3) {
    return text3.replace(/\s+/gu, " ").trim();
  }

  // src/content/extraction/infer-list.ts
  var MIN_ITEMS_PER_RUN2 = 3;
  var FIELD_CELL_TAGS = /* @__PURE__ */ new Set(["TD", "TH"]);
  function isRecordItemTag(tagName) {
    return !FIELD_CELL_TAGS.has(tagName.toUpperCase());
  }
  function inferListFromElement(picked) {
    for (let level = picked; level && level !== document.documentElement; level = level.parentElement) {
      const proposal = proposalForLevel(level);
      if (proposal) return proposal;
    }
    return void 0;
  }
  function proposalForLevel(level) {
    if (!isRecordItemTag(level.tagName)) return void 0;
    const container = level.parentElement;
    if (!container || container === document.documentElement) return void 0;
    const run = sameTemplateSiblings(level, container);
    if (run.length < MIN_ITEMS_PER_RUN2) return void 0;
    const containerSelector = selectorFor(container);
    const item = generalizedItemSelector(run, containerSelector);
    if (!item) return void 0;
    const first = run[0];
    if (!first) return void 0;
    const fields = inferFields(first, run);
    if (fields.length === 0) return void 0;
    const pagination = detectPagination(run, container);
    return {
      container: containerSelector,
      item: item.selector,
      itemCount: run.length,
      fields,
      ...pagination === void 0 ? {} : { pagination },
      confidence: Math.round(item.confidence * meanCoverage(fields) * 100) / 100
    };
  }
  function sameTemplateSiblings(element, container) {
    const signature = itemTemplateSignature(element);
    return Array.from(container.children).filter((child2) => isRecordItemTag(child2.tagName) && itemTemplateSignature(child2) === signature);
  }
  function itemTemplateSignature(element) {
    return webAutomationItemSignature({
      tagName: element.tagName,
      role: element.getAttribute("role"),
      testId: testIdFor(element),
      classes: element.classList
    });
  }
  function meanCoverage(fields) {
    return fields.reduce((total, field) => total + field.coverage, 0) / fields.length;
  }

  // src/content/extraction/feed-signal.ts
  var MAX_FEED_ANCESTOR_LEVELS = 6;
  function isDeclaredFeed(items, container) {
    if (items.some((item) => item.getAttribute("aria-setsize")?.trim() === "-1")) return true;
    let level = container;
    for (let depth = 0; level && depth < MAX_FEED_ANCESTOR_LEVELS; depth += 1, level = level.parentElement) {
      if ((level.getAttribute("role") ?? "").toLowerCase().split(/\s+/u).includes("feed")) return true;
    }
    return false;
  }

  // src/content/extraction/largest-runs.ts
  var MIN_ITEMS_PER_RUN3 = 3;
  var MAX_SCANNED_ELEMENTS = 1e4;
  var MAX_OFFERED_RUNS = 12;
  var NON_DATA_CONTAINER_TAGS = /* @__PURE__ */ new Set(["HEAD", "SCRIPT", "STYLE", "TEMPLATE", "SELECT", "DATALIST", "OPTGROUP", "NOSCRIPT"]);
  var NON_DATA_REGIONS = [
    "nav",
    "footer",
    "svg",
    "select",
    "datalist",
    '[role~="navigation"]',
    '[role~="contentinfo"]',
    '[role~="menu"]',
    '[role~="menubar"]',
    '[role~="listbox"]',
    '[role~="tablist"]',
    '[role~="tree"]'
  ].join(",");
  function largestRunsFirst() {
    const runs = [];
    const seen = /* @__PURE__ */ new Set();
    let scanned = 0;
    for (const element of document.body?.querySelectorAll("*") ?? []) {
      scanned += 1;
      if (scanned > MAX_SCANNED_ELEMENTS) break;
      const container = element.parentElement;
      if (!container || seen.has(container)) continue;
      seen.add(container);
      if (container.childElementCount < MIN_ITEMS_PER_RUN3 || !holdsData(container)) continue;
      for (const items of templateGroups(container)) {
        const first = items[0];
        if (first && items.length >= MIN_ITEMS_PER_RUN3 && first.getClientRects().length > 0) runs.push({ first, size: items.length });
      }
    }
    return runs.sort((left, right) => right.size - left.size).slice(0, MAX_OFFERED_RUNS).map((run) => run.first);
  }
  function holdsData(container) {
    return !NON_DATA_CONTAINER_TAGS.has(container.tagName.toUpperCase()) && container.closest(NON_DATA_REGIONS) === null;
  }
  function templateGroups(container) {
    const groups = /* @__PURE__ */ new Map();
    for (const child2 of container.children) {
      if (!isRecordItemTag(child2.tagName)) continue;
      const signature = itemTemplateSignature(child2);
      const group = groups.get(signature);
      if (group) group.push(child2);
      else groups.set(signature, [child2]);
    }
    return [...groups.values()];
  }

  // src/content/extraction/detect-structure.ts
  function detectStructure(request) {
    return request.selector === void 0 ? detectLargest() : detectAround(request.selector);
  }
  function detectAround(selector) {
    const elements = queryAll(selector);
    const first = elements[0];
    if (!first) return refused("target_not_found");
    if (elements.some(isWithinSensitiveControl)) return refused("sensitive_region");
    const proposal = inferListFromElement(first);
    if (!proposal) return refused("no_repeating_run");
    if (elements.length > 1 && !allInsideItems(elements, queryAll(proposal.item))) return refused("ambiguous_target");
    return detected(proposal);
  }
  function allInsideItems(elements, items) {
    const itemSet = new Set(items);
    return elements.every((element) => {
      for (let current = element; current; current = current.parentElement) {
        if (itemSet.has(current)) return true;
      }
      return false;
    });
  }
  function detectLargest() {
    let best;
    let sensitiveSeen = false;
    const tried = /* @__PURE__ */ new Set();
    for (const first of largestRunsFirst()) {
      if (isWithinSensitiveControl(first)) {
        sensitiveSeen = true;
        continue;
      }
      const proposal = inferListFromElement(first);
      if (!proposal || tried.has(proposal.item)) continue;
      tried.add(proposal.item);
      const answer = detected(proposal);
      if (!answer.ok) {
        sensitiveSeen = true;
        continue;
      }
      if (isFormNotData(answer.proposal)) continue;
      if (best === void 0 || outranks(answer.proposal, best.proposal)) best = answer;
    }
    return best ?? refused(sensitiveSeen ? "sensitive_region" : "no_repeating_run");
  }
  function isFormNotData(proposal) {
    return proposal.fields.every((field) => field.spec.handling === "exclude" || field.spec.kind === "value");
  }
  function outranks(candidate, incumbent) {
    if (candidate.itemCount !== incumbent.itemCount) return candidate.itemCount > incumbent.itemCount;
    const fields = readableFieldCount(candidate) - readableFieldCount(incumbent);
    if (fields !== 0) return fields > 0;
    return candidate.confidence > incumbent.confidence;
  }
  function detected(proposal) {
    const items = queryAll(proposal.item);
    if (readableFieldCount(proposal) === 0 || items.some(isWithinSensitiveControl)) return refused("sensitive_region");
    if (proposal.pagination !== void 0 || !isDeclaredFeed(items, queryOne(proposal.container))) return { ok: true, proposal };
    return { ok: true, proposal, infiniteScroll: true };
  }
  function readableFieldCount(proposal) {
    return proposal.fields.filter((field) => field.spec.handling !== "exclude").length;
  }
  function refused(reason) {
    return { ok: false, refused: reason };
  }
  function queryOne(selector) {
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }
  function queryAll(selector) {
    try {
      return Array.from(document.querySelectorAll(selector));
    } catch {
      return [];
    }
  }

  // src/content/action-runtime/file-input.ts
  var UPLOAD_MAX_FILE_BYTES = 1048576;
  var UPLOAD_MAX_TOTAL_BYTES = 4194304;
  function setInputFiles(element, files) {
    if (!(element instanceof HTMLInputElement) || element.type !== "file") {
      return { ok: false, reason: `the target is a ${element.tagName.toLowerCase()}, not a file input` };
    }
    if (files.length === 0) return { ok: false, reason: "the command carried no files" };
    if (files.length > 1 && !element.multiple) {
      return { ok: false, reason: `the file input accepts one file, but ${files.length} were supplied` };
    }
    const transfer = new DataTransfer();
    let totalBytes = 0;
    for (const [index, file] of files.entries()) {
      const content = decodeBase64(file.contentBase64);
      if (!content) return { ok: false, reason: `the content of file ${index + 1} is not valid base64` };
      if (content.byteLength > UPLOAD_MAX_FILE_BYTES) {
        return { ok: false, reason: `file ${index + 1} is ${content.byteLength} bytes, over the ${UPLOAD_MAX_FILE_BYTES}-byte file limit` };
      }
      totalBytes += content.byteLength;
      if (totalBytes > UPLOAD_MAX_TOTAL_BYTES) {
        return { ok: false, reason: `the upload is over the ${UPLOAD_MAX_TOTAL_BYTES}-byte total limit` };
      }
      transfer.items.add(new File([content], file.name, { type: file.mimeType }));
    }
    try {
      element.files = transfer.files;
    } catch {
      return { ok: false, reason: "the file input rejected the files" };
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    const assigned = element.files;
    return { ok: true, fileNames: assigned ? [...assigned].map((file) => file.name) : [] };
  }
  function decodeBase64(contentBase64) {
    let binary;
    try {
      binary = atob(contentBase64);
    } catch {
      return void 0;
    }
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return buffer;
  }

  // src/content/action-runtime/dialog-control.ts
  var dialogControl = {
    arm(request) {
      const root = document.documentElement;
      if (!root) return false;
      try {
        root.setAttribute(DIALOG_ARM_ATTRIBUTE, encodeDialogArm({
          response: request.response,
          ...request.promptText === void 0 ? {} : { promptText: request.promptText }
        }));
      } catch {
        return false;
      }
      document.dispatchEvent(new CustomEvent(DIALOG_ARM_EVENT));
      if (!root.hasAttribute(DIALOG_ARM_ATTRIBUTE)) return true;
      root.removeAttribute(DIALOG_ARM_ATTRIBUTE);
      return false;
    },
    observed() {
      const raw = document.documentElement?.getAttribute(DIALOG_OBSERVED_ATTRIBUTE);
      return raw === null || raw === void 0 ? void 0 : decodeDialogObserved(raw);
    }
  };

  // src/content/action-runtime/assertion-evaluation.ts
  var DEFAULT_ASSERT_TIMEOUT_MS = 5e3;
  var POLL_INTERVAL_MS = 50;
  async function evaluateAssertion(request, target) {
    const timeoutMs = Math.max(0, request.timeoutMs ?? DEFAULT_ASSERT_TIMEOUT_MS);
    const startedAt = Date.now();
    const deadline = startedAt + timeoutMs;
    let attempt = evaluateOnce(request, target);
    let attempts = 1;
    while (!attempt.held && attempt.verdict !== "malformed" && Date.now() < deadline) {
      await delay3(Math.min(POLL_INTERVAL_MS, deadline - Date.now()));
      attempt = evaluateOnce(request, target);
      attempts += 1;
    }
    return {
      held: attempt.held,
      expected: attempt.expected,
      actual: attempt.actual,
      judged: attempt.verdict === "judged",
      // A window only expires if there was one and it ran out. A claim given no
      // time, and a claim nothing could satisfy, waited for nothing -- reporting
      // either as a timeout would blame the page for the request.
      waitExpired: !attempt.held && attempt.verdict !== "malformed" && timeoutMs > 0 && Date.now() >= deadline,
      timeoutMs,
      elapsedMs: Date.now() - startedAt,
      attempts
    };
  }
  function evaluateOnce(request, target) {
    if (request.kind === "url") return urlOutcome(request.expected);
    const where = target.selector ? `"${target.selector}"` : "the resolved element";
    const found = currentElement(target);
    if (request.kind === "exists") {
      if (!target.selector && !target.element) {
        return { held: false, expected: "an element to test for existence", actual: "the action named no selector and no element", verdict: "malformed" };
      }
      return found ? { held: true, expected: `an element matching ${where} exists`, actual: "it exists", verdict: "judged" } : { held: false, expected: `an element matching ${where} exists`, actual: `nothing matched ${where}`, verdict: "pending" };
    }
    if (request.kind === "absent") {
      return found ? { held: false, expected: `no element matches ${where}`, actual: `${where} is still present`, verdict: "judged" } : { held: true, expected: `no element matches ${where}`, actual: `nothing matched ${where}`, verdict: "judged" };
    }
    if (request.kind === "text") return textOutcome(request.expected ?? "", target, found, where);
    if (!found) {
      const claim = request.kind === "visible" ? "visible" : "enabled";
      return { held: false, expected: `${where} is ${claim}`, actual: `nothing matched ${where}`, verdict: "pending" };
    }
    if (request.kind === "visible") {
      const visible = isVisible(found);
      return { held: visible, expected: `${where} is visible`, actual: visible ? "it is visible" : "it is present but not visible", verdict: "judged" };
    }
    const enabled = isEnabled2(found);
    return { held: enabled, expected: `${where} is enabled`, actual: enabled ? "it is enabled" : "it is present but disabled", verdict: "judged" };
  }
  function currentElement(target) {
    if (target.selector) return document.querySelector(target.selector) ?? void 0;
    if (target.element) return target.element.isConnected ? target.element : void 0;
    return void 0;
  }
  function textOutcome(wanted, target, found, where) {
    const scope = target.selector || target.element ? found : document.body;
    const label = target.selector || target.element ? where : "the page";
    if (!scope) return { held: false, expected: `${label} contains "${wanted}"`, actual: `nothing matched ${where}`, verdict: "pending" };
    const text3 = readText2(scope);
    return {
      held: text3.includes(wanted),
      expected: `${label} contains "${wanted}"`,
      actual: text3 ? `${label} reads "${text3}"` : `${label} has no text`,
      verdict: "judged"
    };
  }
  function readText2(element) {
    const tagName = element.tagName;
    const value = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" ? element.value : element.innerText ?? element.textContent ?? "";
    return value.replace(/\s+/gu, " ").trim();
  }
  function urlOutcome(expected) {
    const href = location.href;
    const wanted = expected ?? "";
    const held = wanted !== "" && (href === wanted || href.includes(wanted));
    return {
      held,
      expected: wanted ? `the page URL is ${wanted}` : "the assertion to name the expected URL",
      actual: `the page URL is ${href}`,
      // The document's address is always readable, so a URL claim is always
      // judged -- unless the claim named no URL, which no page can satisfy.
      verdict: wanted ? "judged" : "malformed"
    };
  }
  function isVisible(element) {
    const rect2 = element.getBoundingClientRect();
    if (rect2.width <= 0 || rect2.height <= 0) return false;
    const style2 = getComputedStyle(element);
    return style2.visibility !== "hidden" && style2.display !== "none" && Number.parseFloat(style2.opacity) !== 0;
  }
  function isEnabled2(element) {
    return !element.matches(":disabled") && element.getAttribute("aria-disabled") !== "true";
  }
  function delay3(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }

  // src/content/action-runtime/waits.ts
  var POLL_INTERVAL_MS2 = 50;
  var DEFAULT_WAIT_TIMEOUT_MS = 1e4;
  function waitUntil2(evaluate, timeoutMs = DEFAULT_WAIT_TIMEOUT_MS) {
    const startedAt = Date.now();
    const progress = { startedAt, lastChangeAt: startedAt };
    const immediate = evaluate(progress);
    if (immediate !== void 0) return Promise.resolve(immediate);
    return new Promise((resolve, reject2) => {
      let settled = false;
      const stop = () => {
        settled = true;
        clearTimeout(timer);
        clearInterval(poll);
        observer2.disconnect();
      };
      const check = () => {
        if (settled) return;
        let value;
        try {
          value = evaluate(progress);
        } catch (error) {
          stop();
          reject2(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        if (value === void 0) return;
        stop();
        resolve(value);
      };
      const timer = setTimeout(() => {
        stop();
        resolve(void 0);
      }, timeoutMs);
      const poll = setInterval(check, POLL_INTERVAL_MS2);
      const observer2 = new MutationObserver(() => {
        progress.lastChangeAt = Date.now();
        check();
      });
      observer2.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
    });
  }
  function pageText() {
    return document.body?.innerText ?? "";
  }

  // src/content/action-runtime/wait-conditions.ts
  var DEFAULT_STABLE_FOR_MS = 500;
  async function waitForCondition(request) {
    const startedAt = Date.now();
    const hit = await waitUntil2(evaluatorFor(request), request.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS);
    const waitedMs = Date.now() - startedAt;
    if (!hit) return { ok: false, condition: request.condition, actual: unmetActual(request), waitedMs };
    return {
      ok: true,
      condition: request.condition,
      ...hit.element ? { element: hit.element } : {},
      actual: hit.actual,
      waitedMs
    };
  }
  function evaluatorFor(request) {
    const { condition } = request;
    if (condition === "present") return () => presentHit(request);
    if (condition === "visible") return () => visibleHit(request);
    if (condition === "enabled") return () => enabledHit(request);
    if (condition === "absent") return () => absentHit(request);
    if (condition === "url") return () => urlHit(request);
    if (condition === "stable") return (progress) => stableHit(request, progress);
    return noEvaluator(condition);
  }
  function noEvaluator(condition) {
    throw new Error(`The wait condition "${String(condition)}" has no evaluator.`);
  }
  function presentHit(request) {
    if (request.selector) {
      const element = document.querySelector(request.selector);
      return element ? { element, actual: "the element was found" } : void 0;
    }
    return pageText().includes(requireText(request)) ? { actual: "the text was found" } : void 0;
  }
  function visibleHit(request) {
    if (request.selector) {
      const element = document.querySelector(request.selector);
      return element && isVisible2(element) ? { element, actual: "the element was visible" } : void 0;
    }
    return pageText().includes(requireText(request)) ? { actual: "the text was visible" } : void 0;
  }
  function enabledHit(request) {
    const element = document.querySelector(requireSelector(request));
    return element && isEnabled3(element) ? { element, actual: "the element was enabled" } : void 0;
  }
  function absentHit(request) {
    if (request.selector) {
      return document.querySelector(request.selector) ? void 0 : { actual: "no element matched the selector" };
    }
    return pageText().includes(requireText(request)) ? void 0 : { actual: "the text was absent" };
  }
  function urlHit(request) {
    const requested = request.url;
    if (!requested) throw new Error('The "url" wait condition needs the URL to wait for.');
    return urlMatches(location.href, requested) ? { actual: location.href } : void 0;
  }
  function stableHit(request, progress) {
    const stableForMs = request.stableForMs ?? DEFAULT_STABLE_FOR_MS;
    if (Date.now() - progress.lastChangeAt < stableForMs) return void 0;
    return { actual: `the page stopped changing for ${stableForMs} ms` };
  }
  function unmetActual(request) {
    const { condition } = request;
    if (condition === "present") return request.selector ? "no element matched before the timeout" : "the text did not appear before the timeout";
    if (condition === "visible") return request.selector ? "the element was not visible before the timeout" : "the text was not visible before the timeout";
    if (condition === "enabled") return "the element was not enabled before the timeout";
    if (condition === "absent") return request.selector ? "the element was still present after the timeout" : "the text was still present after the timeout";
    if (condition === "url") return `the page was still on ${location.href}`;
    return "the page was still changing after the timeout";
  }
  function isVisible2(element) {
    const rect2 = element.getBoundingClientRect();
    if (rect2.width <= 0 || rect2.height <= 0) return false;
    const visibility = getComputedStyle(element).visibility;
    return visibility !== "hidden" && visibility !== "collapse";
  }
  function isEnabled3(element) {
    if (element.getAttribute("aria-disabled") === "true") return false;
    return !element.matches(":disabled");
  }
  function urlMatches(current, requested) {
    if (current === requested || current.includes(requested)) return true;
    try {
      return new URL(requested, document.baseURI).href === current;
    } catch {
      return false;
    }
  }
  function requireSelector(request) {
    if (!request.selector) throw new Error(`The "${request.condition}" wait condition needs a selector.`);
    return request.selector;
  }
  function requireText(request) {
    if (!request.text) throw new Error(`The "${request.condition}" wait condition needs a selector or text to wait for.`);
    return request.text;
  }

  // src/content/action-runtime/validation-outcome.ts
  var VALIDATION_TEXT_MAX_LENGTH = 1024;
  function truncateValidationText(value) {
    const collapsed2 = value.replace(/\s+/gu, " ").trim();
    if (!collapsed2) return "(none)";
    return collapsed2.length <= VALIDATION_TEXT_MAX_LENGTH ? collapsed2 : `${collapsed2.slice(0, VALIDATION_TEXT_MAX_LENGTH - 1)}\u2026`;
  }
  function boundValidation(validation) {
    if (validation.status === "none") return validation;
    return {
      status: validation.status,
      expected: truncateValidationText(validation.expected),
      actual: truncateValidationText(validation.actual),
      ...validation.redacted === void 0 ? {} : { redacted: validation.redacted }
    };
  }
  function statusForValidation(validation) {
    return validation.status === "failed" ? "failed" : "succeeded";
  }

  // src/content/action-runtime/results.ts
  function actionFailure(action, error, startedAt = Date.now()) {
    const message = error instanceof Error ? error.message : "Action failed.";
    const reported = reportedFailure(error);
    const classified = reported ?? classifyWebAutomationFailure(error, { status: "failed", actionType: action.actionType, message });
    const resolution = reportedResolution(error);
    return buildResult(action, startedAt, {
      status: "failed",
      validation: { status: "none", reason: "not-yet-validated" },
      message,
      failure: classified ?? webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, { actual: message })
    }, resolution ? { resolution } : {});
  }
  function reportedFailure(error) {
    const failure = property2(error, "failure");
    const code = property2(failure, "code");
    return isWebAutomationFailureCode(code) ? failure : void 0;
  }
  function reportedResolution(error) {
    const resolution = property2(error, "resolution");
    if (typeof property2(resolution, "strategy") !== "string") return void 0;
    return typeof property2(resolution, "candidateCount") === "number" ? resolution : void 0;
  }
  function property2(value, name) {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value[name] : void 0;
  }
  function success(action, startedAt, message, validation, evidence = {}) {
    const bounded = boundValidation(validation);
    return buildResult(action, startedAt, {
      status: statusForValidation(bounded),
      validation: bounded,
      message,
      failure: bounded.status === "failed" ? webAutomationFailureRecord(unobservedOutputCode(action), { expected: bounded.expected, actual: bounded.actual }) : void 0
    }, evidence);
  }
  function actionRejected(action, startedAt, reason, expected, actual, evidence = {}) {
    const validation = boundValidation({ status: "failed", expected, actual });
    const observed = validation.status === "failed" ? validation.actual : actual;
    const modal = blockedByModal(reason);
    if (modal) {
      return buildResult(action, startedAt, {
        status: "failed",
        validation,
        message: `Action blocked: ${observed}; ${modal}`,
        failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED, {
          expected,
          actual: `${reason}: ${observed}; ${modal}`
        })
      }, evidence);
    }
    return buildResult(action, startedAt, {
      status: "failed",
      validation,
      message: `Action rejected: ${observed}`,
      failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, { expected, actual: `${reason}: ${observed}` })
    }, evidence);
  }
  function actionTimedOut(action, startedAt, message, validation, evidence = {}) {
    const bounded = boundValidation(validation);
    return buildResult(action, startedAt, {
      status: "timed_out",
      validation: bounded,
      message,
      failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, bounded.status === "none" ? { actual: message } : { expected: bounded.expected, actual: bounded.actual })
    }, evidence);
  }
  function actionNotImplemented(action, startedAt, what) {
    return buildResult(action, startedAt, {
      status: "failed",
      validation: { status: "none", reason: "not-yet-validated" },
      message: `${what} is not implemented yet.`,
      failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED, {
        expected: `${what} to be implemented`,
        actual: "the verb is registered but has no implementation"
      })
    }, {});
  }
  function unobservedOutputCode(action) {
    return action.actionType === "web.dom.assert" ? WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH : WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED;
  }
  function authGateFailure(action, failure) {
    const sought = soughtSelector(action);
    const missing = sought ? selectorMatchesNothing(sought) : false;
    if (!missing && !namedUrlClaim(action) || !signInGatePresent()) return void 0;
    const actual = missing ? failure.actual ?? "nothing matched the target" : "the page is not at the URL the Flow claimed";
    return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED, {
      expected: failure.expected ?? (missing ? `an element matching ${sought}` : "the page URL the Flow claimed"),
      actual: `${actual}; the document is a sign-in gate, so the session has probably expired`
    });
  }
  function soughtSelector(action) {
    return action.actionType === "web.dom.extract_list" ? action.extractList?.item : action.selector;
  }
  function namedUrlClaim(action) {
    return action.actionType === "web.dom.assert" && action.assert?.kind === "url" && Boolean(action.assert.expected);
  }
  var MODAL_BLOCKED_REFUSALS = /* @__PURE__ */ new Set(["covered", "hidden"]);
  function blockedByModal(reason) {
    if (!MODAL_BLOCKED_REFUSALS.has(reason) || !renderedModalPresent()) return void 0;
    return "a modal dialog is open over the page, so a person has to answer it before the run can continue";
  }
  function renderedModalPresent() {
    return rendered('[aria-modal="true"]') || rendered("dialog:modal");
  }
  function rendered(selector) {
    try {
      for (const element of document.querySelectorAll(selector)) {
        if (element.getClientRects().length > 0) return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  function selectorMatchesNothing(selector) {
    try {
      return document.querySelector(selector) === null;
    } catch {
      return false;
    }
  }
  function signInGatePresent() {
    const control = document.querySelector('form input[type="password"], form input[autocomplete="current-password"]');
    return control instanceof HTMLElement && control.getClientRects().length > 0;
  }
  function buildResult(action, startedAt, core, evidence) {
    const result = {
      commandId: action.commandId,
      actionType: action.actionType,
      status: core.status,
      validation: core.validation,
      url: location.href,
      title: document.title,
      startedAt,
      finishedAt: Date.now()
    };
    if (core.message !== void 0) result.message = core.message;
    if (core.failure !== void 0) result.failure = authGateFailure(action, core.failure) ?? core.failure;
    if (evidence.element) result.element = evidence.element;
    if (action.visualTarget) result.visualTarget = action.visualTarget;
    const snapshot = evidence.snapshot ?? (captureSettings.snapshots || core.status !== "succeeded" ? captureSnapshot() : void 0);
    if (snapshot) result.snapshot = snapshot;
    if (evidence.extracted !== void 0) result.extracted = evidence.extracted;
    if (evidence.extraction) result.extraction = evidence.extraction;
    if (evidence.dialog) result.dialog = evidence.dialog;
    if (evidence.structure) result.structure = evidence.structure;
    if (evidence.resolution) result.resolution = evidence.resolution;
    return result;
  }

  // src/content/action-runtime/execute-action.ts
  async function executeAction(action) {
    return executeContentAction(action, {
      captureSnapshot,
      resolveTarget,
      describeElement,
      extractElement,
      scrollElementIntoView,
      setElementValue,
      dispatchInputEvents,
      checkActionability,
      keyboard,
      setCheckedState,
      detectStructure,
      extractList,
      setInputFiles,
      dialogControl,
      evaluateAssertion,
      waitForCondition,
      success,
      failure: actionFailure,
      rejected: actionRejected,
      timedOut: actionTimedOut,
      notImplemented: actionNotImplemented
    });
  }

  // src/shared/extraction-messages.ts
  var EXTRACTION_PROPOSE_MESSAGE = "extraction.propose";
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
  var EXTRACTION_PREVIEW_MAX_ROWS = 20;

  // src/content/picker/preview.ts
  var PICKER_PREVIEW_MAX_ROWS = EXTRACTION_PREVIEW_MAX_ROWS;
  async function readPreviewRows(request, limit) {
    const outcome = await extractList({
      item: request.item,
      fields: request.fields,
      maxItems: previewBound(limit, request.maxItems),
      minItems: 0
    });
    return outcome.records;
  }
  function previewBound(limit, requested) {
    const bounds = [PICKER_PREVIEW_MAX_ROWS, limit, requested].filter((bound) => typeof bound === "number" && Number.isFinite(bound) && bound > 0);
    return Math.min(...bounds);
  }

  // src/content/picker/recorded-event.ts
  function recordExtraction(definition) {
    const extraction = recordableExtraction(definition);
    if (!extraction) return "invalid_definition";
    if (!isRecording()) return "not_recording";
    emit("data.extract", { extraction });
    return "recorded";
  }
  function recordableExtraction(value) {
    if (!value || typeof value !== "object") return void 0;
    const definition = value;
    if (typeof definition.label !== "string" || definition.label.trim() === "") return void 0;
    if (definition.form === "value") {
      return typeof definition.read?.mode === "string" ? value : void 0;
    }
    if (definition.form !== "list") return void 0;
    const readable2 = typeof definition.request?.item === "string" && typeof definition.request.fields === "object" && definition.request.fields !== null;
    return readable2 ? value : void 0;
  }

  // src/content/picker/overlay.ts
  var OVERLAY_Z_INDEX = "2147483647";
  var HIGHLIGHT_COLOR = "#2f6df6";
  var parts;
  function openPickerOverlay() {
    if (parts) return;
    const host = document.createElement("div");
    host.setAttribute(PICKER_HOST_ATTRIBUTE, "");
    style(host, {
      position: "fixed",
      inset: "0",
      // The page keeps every pointer event; see the header.
      pointerEvents: "none",
      zIndex: OVERLAY_Z_INDEX
    });
    const root = host.attachShadow({ mode: "open" });
    const box = document.createElement("div");
    style(box, {
      position: "fixed",
      display: "none",
      boxSizing: "border-box",
      border: `2px solid ${HIGHLIGHT_COLOR}`,
      borderRadius: "2px",
      background: "rgba(47, 109, 246, 0.12)",
      pointerEvents: "none"
    });
    const label = document.createElement("div");
    style(label, {
      position: "fixed",
      display: "none",
      padding: "2px 6px",
      borderRadius: "3px",
      background: HIGHLIGHT_COLOR,
      color: "#ffffff",
      font: "600 11px/1.4 system-ui, sans-serif",
      whiteSpace: "nowrap",
      pointerEvents: "none"
    });
    root.append(box, label);
    (document.body ?? document.documentElement).append(host);
    parts = { host, box, label };
  }
  function pointPickerOverlay(target, caption2) {
    if (!parts) return;
    if (!target) {
      parts.box.style.display = "none";
      parts.label.style.display = "none";
      return;
    }
    const rect2 = target.getBoundingClientRect();
    style(parts.box, {
      display: "block",
      left: `${rect2.left}px`,
      top: `${rect2.top}px`,
      width: `${rect2.width}px`,
      height: `${rect2.height}px`
    });
    parts.label.textContent = caption2;
    style(parts.label, {
      display: "block",
      left: `${rect2.left}px`,
      // Above the box where there is room, and inside its top edge where there is not.
      top: rect2.top >= 20 ? `${rect2.top - 18}px` : `${rect2.top + 2}px`
    });
  }
  function closePickerOverlay() {
    parts?.host.remove();
    parts = void 0;
  }
  function style(element, properties) {
    for (const [property3, value] of Object.entries(properties)) {
      element.style.setProperty(kebab(property3), value);
    }
  }
  function kebab(property3) {
    return property3.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
  }

  // src/content/picker/session.ts
  var SWALLOWED_EVENTS = ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "auxclick", "contextmenu"];
  var DRAIN_TIMEOUT_MS = 1e4;
  var session;
  var hovered;
  var drainTimer;
  function startPick(sessionId, form) {
    stopPick();
    session = { sessionId, form, phase: "picking" };
    openPickerOverlay();
    for (const type of SWALLOWED_EVENTS) window.addEventListener(type, swallowEvent, true);
    window.addEventListener("pointermove", trackPointer, true);
    window.addEventListener("keydown", cancelOnEscape, true);
  }
  function stopPick() {
    if (drainTimer) clearTimeout(drainTimer);
    drainTimer = void 0;
    if (session) {
      for (const type of SWALLOWED_EVENTS) window.removeEventListener(type, swallowEvent, true);
      window.removeEventListener("pointermove", trackPointer, true);
      window.removeEventListener("keydown", cancelOnEscape, true);
    }
    session = void 0;
    hovered = void 0;
    closePickerOverlay();
  }
  function swallowEvent(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const current = session;
    if (!current) return;
    if (current.phase === "picking" && event.type === "pointerdown") {
      takePick(current, event);
      return;
    }
    if (current.phase === "draining" && (event.type === "click" || event.type === "auxclick")) {
      stopPick();
      return;
    }
    if (current.phase === "draining") restartDrainTimer();
  }
  function takePick(current, event) {
    current.phase = "draining";
    const target = pickTarget(event);
    closePickerOverlay();
    hovered = void 0;
    restartDrainTimer();
    void chrome.runtime.sendMessage(pickedMessage(current, target)).catch(() => void 0);
  }
  function restartDrainTimer() {
    if (drainTimer) clearTimeout(drainTimer);
    drainTimer = setTimeout(() => stopPick(), DRAIN_TIMEOUT_MS);
  }
  function pickedMessage(current, target) {
    if (!target) return { type: EXTRACTION_PICKED_MESSAGE, sessionId: current.sessionId, refused: "target_not_found" };
    if (current.form === "value") {
      return { type: EXTRACTION_PICKED_MESSAGE, sessionId: current.sessionId, element: pickedElement(target) };
    }
    const proposal = inferListFromElement(target);
    return proposal ? { type: EXTRACTION_PICKED_MESSAGE, sessionId: current.sessionId, proposal } : { type: EXTRACTION_PICKED_MESSAGE, sessionId: current.sessionId, refused: "no_repeating_run" };
  }
  function pickedElement(target) {
    const selector = selectorFor(target);
    const tagName = target.tagName.toLowerCase();
    const testId = testIdFor(target);
    return testId === void 0 ? { selector, tagName } : { selector, tagName, testId };
  }
  function pickTarget(event) {
    const target = event.target;
    if (target instanceof Element && !isPickerHostNode(target)) return target;
    const under = document.elementFromPoint(event.clientX, event.clientY);
    return under && !isPickerHostNode(under) ? under : null;
  }
  function trackPointer(event) {
    if (session?.phase !== "picking") return;
    const target = pickTarget(event);
    if (target === (hovered ?? null)) return;
    hovered = target ?? void 0;
    pointPickerOverlay(target, caption(session.form, target));
  }
  function caption(form, target) {
    if (!target) return "";
    if (form === "value") return "1 value";
    const proposal = inferListFromElement(target);
    if (!proposal) return "no list here";
    return proposal.itemCount === 1 ? "1 item" : `${proposal.itemCount} items`;
  }
  function cancelOnEscape(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const current = session;
    stopPick();
    if (current?.phase !== "picking") return;
    const cancelled = { type: EXTRACTION_PICK_CANCELLED_MESSAGE, sessionId: current.sessionId };
    void chrome.runtime.sendMessage(cancelled).catch(() => void 0);
  }

  // src/content/picker/messages.ts
  function extractionContentMessage(message) {
    if (!message || typeof message !== "object") return void 0;
    const typed = message;
    if (typeof typed.type !== "string" || typeof typed.sessionId !== "string") return void 0;
    const name = Object.values(EXTRACTION_CONTENT_MESSAGES).find((candidate) => candidate === typed.type);
    if (name === void 0) return void 0;
    if (name === EXTRACTION_CONTENT_MESSAGES.pickStart) {
      return { type: name, sessionId: typed.sessionId, form: typed.form === "value" ? "value" : "list" };
    }
    if (name === EXTRACTION_CONTENT_MESSAGES.pickCancel) return { type: name, sessionId: typed.sessionId };
    if (name === EXTRACTION_CONTENT_MESSAGES.record) {
      return { type: name, sessionId: typed.sessionId, definition: typed.definition };
    }
    return previewMessage(name, typed.sessionId, typed.request, typed.limit);
  }
  function handleExtractionMessage(message, sendResponse) {
    if (message.type === EXTRACTION_CONTENT_MESSAGES.pickStart) {
      startPick(message.sessionId, message.form ?? "list");
      sendResponse({ ok: true });
      return "answered";
    }
    if (message.type === EXTRACTION_CONTENT_MESSAGES.pickCancel) {
      stopPick();
      sendResponse({ ok: true });
      return "answered";
    }
    if (message.type === EXTRACTION_CONTENT_MESSAGES.record) {
      stopPick();
      const outcome = recordExtraction(message.definition);
      sendResponse(outcome === "recorded" ? { ok: true } : { ok: false, refused: outcome });
      return "answered";
    }
    void readPreviewRows(message.request, message.limit ?? PICKER_PREVIEW_MAX_ROWS).then((rows) => sendResponse({ ok: true, rows })).catch(() => sendResponse({ ok: false, refused: "unreadable_request" }));
    return "open";
  }
  function previewMessage(name, sessionId, request, limit) {
    if (name !== EXTRACTION_CONTENT_MESSAGES.preview) return void 0;
    if (!request || typeof request !== "object") return void 0;
    const typed = request;
    if (typeof typed.item !== "string" || !typed.fields || typeof typed.fields !== "object") return void 0;
    const read = request;
    return typeof limit === "number" ? { type: name, sessionId, request: read, limit } : { type: name, sessionId, request: read };
  }

  // src/content/message-handler.ts
  var TOP_FRAME_ID = 0;
  function isAddressedToThisFrame(message) {
    if (message.topFrameOnly === true) return isTopFrame();
    if (typeof message.frameId !== "number") return true;
    return message.frameId === TOP_FRAME_ID ? isTopFrame() : !isTopFrame();
  }
  function installMessageHandler() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const typed = message;
      if (typed.type === "fluxiq.ping") {
        sendResponse({ ok: true, active: isActiveContentInstance(), version: CONTENT_SCRIPT_VERSION });
        return false;
      }
      if (!isActiveContentInstance()) return false;
      if (typed.type === "recording") {
        captureSettings.mutations = typed.settings?.captureMutations ?? captureSettings.mutations;
        captureSettings.inputValues = typed.settings?.captureInputValues ?? captureSettings.inputValues;
        captureSettings.snapshots = typed.settings?.captureSnapshots ?? captureSettings.snapshots;
        setRecordingState(Boolean(typed.recording));
        sendResponse({ ok: true });
        return true;
      }
      if (typed.type === "captureSnapshot") {
        void captureSnapshotForResponse().then(sendResponse);
        return true;
      }
      if (typed.type === "executeAction" && typed.action) {
        if (!isAddressedToThisFrame(typed)) return false;
        void executeAction(typed.action).then(sendResponse).catch((error) => sendResponse(actionFailure(typed.action, error)));
        return true;
      }
      const extraction = extractionContentMessage(typed);
      if (extraction) {
        if (!isTopFrame()) return false;
        return handleExtractionMessage(extraction, sendResponse) === "open";
      }
      if (typed.type === EXTRACTION_PROPOSE_MESSAGE) {
        if (!isAddressedToThisFrame(typed)) return false;
        sendResponse(proposeExtraction(typed.selector));
        return false;
      }
      return false;
    });
  }
  function proposeExtraction(selector) {
    const picked = pickedElement2(selector);
    if (!picked) return { ok: false, refused: "target_not_found" };
    const proposal = inferListFromElement(picked);
    return proposal ? { ok: true, proposal } : { ok: false, refused: "no_repeating_run" };
  }
  function pickedElement2(selector) {
    if (typeof selector !== "string" || selector.trim() === "") return null;
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }

  // src/content/dom-events.ts
  var scrollTimer;
  function installRecordingEventListeners() {
    document.addEventListener("pointerdown", (event) => {
      if (!isRecording()) return;
      if (!event.isTrusted) return;
      if (event.button !== 0 || event.isPrimary === false) return;
      rememberEventPathElements(event);
      flushPendingInput();
      const eventElement = eventTargetElement(event);
      const target = eventElement ? pointerActivationTarget(eventElement) : null;
      if (!target) return;
      emit("dom.click", compactObject({
        element: describeElement(target),
        metadata: compactObject({
          ...pointerMetadata(event),
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          sourceEvent: "pointerdown",
          captureTiming: "before-action"
        })
      }));
    }, true);
    document.addEventListener("click", (event) => {
      if (!isRecording()) return;
      if (!event.isTrusted) return;
      rememberEventPathElements(event);
      const eventElement = eventTargetElement(event);
      const target = eventElement ? actionEventTarget(eventElement) : null;
      emit("dom.click", compactObject({
        element: target ? describeElement(target) : void 0,
        metadata: compactObject({
          ...pointerMetadata(event),
          sourceEvent: "click"
        })
      }));
    }, true);
    document.addEventListener("input", (event) => {
      if (!isRecording()) return;
      if (!event.isTrusted) return;
      rememberEventPathElements(event);
      const target = event.target instanceof Element ? event.target : null;
      if (target && isTextEntryElement(target)) {
        scheduleInputEvent(target);
        return;
      }
      flushPendingInput();
      if (target && shouldRecordChangeEvent(target)) return;
      emitInputEvent(target);
    }, true);
    document.addEventListener("change", (event) => {
      if (!isRecording()) return;
      if (!event.isTrusted) return;
      rememberEventPathElements(event);
      const target = event.target instanceof Element ? event.target : null;
      if (target && isTextEntryElement(target)) {
        flushPendingInput();
        return;
      }
      if (target && !shouldRecordChangeEvent(target)) return;
      emit("dom.change", compactObject({
        element: target ? describeElement(target) : void 0,
        inputValue: captureSettings.inputValues ? readElementValue(target) : void 0
      }));
    }, true);
    document.addEventListener("submit", (event) => {
      if (!isRecording()) return;
      rememberEventPathElements(event);
      const target = event.target instanceof Element ? event.target : null;
      emit("dom.submit", compactObject({ element: target ? describeElement(target) : void 0 }));
    }, true);
    document.addEventListener("keydown", (event) => {
      if (!isRecording()) return;
      if (!event.isTrusted) return;
      rememberEventPathElements(event);
      const keyTarget = event.target instanceof Element ? event.target : null;
      if (!continuesTyping(event, keyTarget)) flushPendingInput();
      emit("dom.keydown", compactObject({
        key: recordableKey(event.key, keyTarget),
        element: keyTarget ? describeElement(keyTarget) : void 0,
        metadata: {
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey
        }
      }));
    }, true);
    document.addEventListener("wheel", (event) => {
      if (!isRecording()) return;
      if (!event.isTrusted) return;
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        emit("dom.scroll", {
          scroll: { x: window.scrollX, y: window.scrollY },
          metadata: {
            sourceEvent: "wheel",
            deltaX: event.deltaX,
            deltaY: event.deltaY,
            deltaZ: event.deltaZ,
            deltaMode: event.deltaMode,
            altKey: event.altKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey
          }
        });
      }, 400);
    }, true);
    window.addEventListener("scroll", () => {
      if (!isRecording()) return;
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        emit("dom.scroll", { scroll: { x: window.scrollX, y: window.scrollY } });
      }, 400);
    }, true);
  }
  function recordableKey(key, target) {
    if (!target || [...key].length !== 1) return key;
    return isWithinSensitiveControl(target) ? void 0 : key;
  }
  var TYPING_KEYS = /* @__PURE__ */ new Set([
    "Backspace",
    "Delete",
    "Shift",
    "Control",
    "Alt",
    "AltGraph",
    "Meta",
    "CapsLock",
    "Dead",
    "Process",
    "Unidentified"
  ]);
  function continuesTyping(event, target) {
    if (!target || !isTextEntryElement(target)) return false;
    return event.isComposing || [...event.key].length === 1 || TYPING_KEYS.has(event.key);
  }
  function pointerMetadata(event) {
    return {
      clientX: event.clientX,
      clientY: event.clientY,
      button: event.button,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey
    };
  }

  // src/content/index.ts
  sendReady();
  installFrameGeometryBridge();
  installMessageHandler();
  installRecordingEventListeners();
})();
//# sourceMappingURL=index.js.map
