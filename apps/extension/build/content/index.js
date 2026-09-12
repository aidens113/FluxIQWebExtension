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
      const byTestId = query(`[data-testid="${cssString(testId)}"]`);
      if (byTestId) return byTestId;
    }
    if (fingerprint.name) {
      const byName = query(`${tag}[aria-label="${cssString(fingerprint.name)}"], ${tag}[name="${cssString(fingerprint.name)}"]`);
      if (byName) return byName;
    }
    if (fingerprint.classNames?.length) {
      const byClass = query(`${tag}${fingerprint.classNames.map((className) => `.${CSS.escape(className)}`).join("")}`);
      if (byClass) return byClass;
    }
    if (fingerprint.visibleText) {
      const normalized = normalizeText(fingerprint.visibleText);
      return [...document.querySelectorAll(tag)].find((element) => normalizeText(element.textContent ?? "") === normalized) ?? null;
    }
    return null;
  }
  function xpathFor(element) {
    const parts = [];
    let current = element;
    while (current) {
      if (current.id) {
        parts.unshift(`*[@id=${xpathString(current.id)}]`);
        break;
      }
      const siblings = current.parentElement ? [...current.parentElement.children].filter((sibling) => sibling.tagName === current.tagName) : [];
      parts.unshift(`${current.tagName.toLowerCase()}[${Math.max(1, siblings.indexOf(current) + 1)}]`);
      current = current.parentElement;
    }
    return `/${parts.join("/")}`;
  }
  function query(selector) {
    if (!selector) return null;
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }
  function normalizeText(value) {
    return value.replace(/\s+/g, " ").trim();
  }
  function cssString(value) {
    return CSS.escape(value).replace(/"/g, '\\"');
  }
  function xpathString(value) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  // ../../domain/src/constants.ts
  var WEB_AUTOMATION_DOMAIN_ID = "web-automation";

  // ../../domain/src/actions/types.ts
  var WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH = 1024;
  var WEB_AUTOMATION_EXTRACT_MAX_PAGES = 50;
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
  var extractListSchema = {
    type: "object",
    label: "List extraction",
    required: ["item", "fields"],
    properties: {
      item: { type: "string", label: "Item selector" },
      fields: { type: "object", label: "Field map" },
      paginate: {
        type: "object",
        label: "Pagination",
        required: ["next", "maxPages"],
        properties: {
          next: { type: "string", label: "Next control" },
          maxPages: { type: "integer", label: "Maximum pages", minimum: 1, maximum: WEB_AUTOMATION_EXTRACT_MAX_PAGES }
        }
      },
      maxItems: { type: "integer", label: "Maximum items", minimum: 1 }
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
      urlPattern: { type: "string", label: "URL contains" }
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
      parameterSchema: { type: "object", required: ["selector"], properties: { ...elementProperties, text: { type: "string" }, value: { type: "string" } } }
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
    { actionType: "web.dom.extract", label: "Extract", description: "Extract text, value, or attributes from an element.", parameterSchema: selectorSchema },
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

  // ../../domain/src/output-nodes/definitions.ts
  var controlInput = { id: "in", label: "In", valueType: "signal", role: "control" };
  var outputPorts = [
    { id: "success", label: "Success", valueType: "any", role: "success" },
    { id: "failed", label: "Failed", valueType: "any", role: "failure" }
  ];
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
      parameters: [...parametersForOutput(definition.actionType), expectedStateParameter].map((parameter) => ({
        ...parameter,
        ...requiredParameters.has(parameter.id) ? { required: true } : {},
        allowStateBinding: true
      })),
      icon: iconForOutput(definition.actionType),
      tags: ["web-automation", "output"],
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
        ...requiredParameters.has("selector") ? { elementTarget: true } : {}
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
    if (outputId === "web.dom.wait_for_selector") return [...selectorParameters, structured("wait", "Condition")];
    if (outputId === "web.dom.wait_for_text") return [
      { id: "text", label: "Text", valueType: "string", required: true, ui: { control: "text" } },
      { id: "timeoutMs", label: "Timeout", valueType: "number", defaultValue: 1e4 },
      structured("wait", "Condition")
    ];
    if (outputId === "web.dom.capture_snapshot") return [];
    if (outputId === "web.dom.check") return [...selectorParameters, { id: "checked", label: "Checked", valueType: "boolean", defaultValue: true }];
    if (outputId === "web.dom.assert") return [...selectorParameters, structured("assert", "Assertion")];
    if (outputId === "web.dom.extract_list") return [structured("extractList", "List")];
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
    pageScrolled: "web.user.page_scrolled"
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
    [WEB_AUTOMATION_INPUT_IDS.pageScrolled, "Page scrolled", "web.dom.scroll"]
  ];
  var OUTPUT_FOR_ACTION_INPUT = new Map(
    actionInputDefinitions.map(([inputId, , outputId]) => [inputId, outputId])
  );

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

  // ../../domain/src/runtime/errors.ts
  var WebAutomationRuntimeError = class extends Error {
    code;
    constructor(code, message) {
      super(message);
      this.name = "WebAutomationRuntimeError";
      this.code = code;
    }
  };

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
    /** The document was replaced between resolving the target and running the action. */
    PAGE_CHANGED: "web.page.changed",
    /** A wait, or an action, ran out of time. */
    TIMEOUT: "web.action.timeout",
    /** The host wants a sign-in before the action can continue. */
    AUTH_REQUIRED: "web.auth.required",
    /** A person must act first: a captcha, or a native dialog waiting for an answer. */
    USER_INTERVENTION_REQUIRED: "web.intervention.required",
    /** The client does not implement the requested action type at all. */
    UNSUPPORTED_TYPE: "web.action.unsupported_type",
    /** The verb is registered but not built yet, so a Flow that reaches one fails honestly. */
    NOT_IMPLEMENTED: "web.action.not_implemented",
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
    const collapsed = value.replace(/\s+/gu, " ").trim();
    if (collapsed.length === 0) return void 0;
    if (collapsed.length <= WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH) return collapsed;
    return `${collapsed.slice(0, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH - 1)}\u2026`;
  }

  // ../../domain/src/runtime/failure/classify.ts
  function classifyWebAutomationFailure(error, outcome) {
    if (outcome.failure !== void 0) return outcome.failure;
    const classified = classifyOutcome(error, outcome);
    return classified === void 0 ? void 0 : webAutomationFailureRecord(classified.code, classified.comparison);
  }
  function classifyOutcome(error, outcome) {
    const compared = comparedText(outcome.validation);
    const reportedCode = runtimeErrorCode(error);
    if (reportedCode !== void 0) {
      if (isWebAutomationFailureCode(reportedCode)) return { code: reportedCode, comparison: withActual(compared, errorMessage(error)) };
      return { code: WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, comparison: { ...compared, actual: `unrecognized web automation failure code: ${reportedCode}` } };
    }
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
  function runtimeErrorCode(error) {
    if (error instanceof WebAutomationRuntimeError) return error.code;
    if (typeof error !== "object" || error === null) return void 0;
    const candidate = error;
    if (candidate.name !== "WebAutomationRuntimeError") return void 0;
    return typeof candidate.code === "string" ? candidate.code : void 0;
  }
  function errorMessage(error) {
    if (error instanceof Error) return error.message.length > 0 ? error.message : void 0;
    if (typeof error === "string") return error.length > 0 ? error : void 0;
    if (typeof error !== "object" || error === null) return void 0;
    const message = error.message;
    return typeof message === "string" && message.length > 0 ? message : void 0;
  }

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

  // ../../domain/src/recording/web-state/evidence/project.ts
  var COLLECTION = { elementKind: "collection", comparable: false };
  var LIVE_COLLECTION = { ...COLLECTION, volatility: "rapid" };
  var SETTLED_COLLECTION = { ...COLLECTION, volatility: "slow" };

  // ../../domain/src/client/gateway-mapping.ts
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

  // src/content/identity/bounded-text.ts
  function boundedText2(value, maxLength) {
    const text2 = (value ?? "").replace(/\s+/gu, " ").trim();
    return text2 ? text2.slice(0, maxLength) : void 0;
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
      for (const label of document.querySelectorAll(`label[for="${cssString2(element.id)}"]`)) labels.push(label);
    }
    const ancestor = element.closest("label");
    if (ancestor && !labels.includes(ancestor)) labels.push(ancestor);
    return labels.slice(0, MAX_ASSOCIATED_LABELS);
  }
  function labelElementText(label, control) {
    const parts = [];
    collectLabelText(label, control, parts, 0);
    return parts.join(" ").replace(/\s+/gu, " ").trim();
  }
  function collectLabelText(node, control, parts, depth) {
    if (parts.length > 40 || depth > 8) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const text2 = node.textContent;
      if (text2?.trim()) parts.push(text2);
      return;
    }
    if (!(node instanceof Element)) return;
    if (node === control || node.matches(NESTED_CONTROL_SELECTOR)) return;
    for (const child of node.childNodes) collectLabelText(child, control, parts, depth + 1);
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
      const text2 = nearbyLabelText(sibling);
      if (text2) return text2;
      sibling = sibling.previousElementSibling;
    }
    return void 0;
  }
  function nearbyLabelText(candidate) {
    if (!NEARBY_LABEL_TAGS.has(candidate.tagName.toLowerCase())) return void 0;
    if (candidate.querySelector(NESTED_CONTROL_SELECTOR)) return void 0;
    return boundedText2(candidate.textContent, MAX_NEARBY_LABEL_LENGTH);
  }
  function isLabelableControl(element) {
    if (element instanceof HTMLInputElement) return element.type.toLowerCase() !== "hidden";
    if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) return true;
    return element instanceof HTMLElement && element.isContentEditable;
  }
  function cssString2(value) {
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
    const parts = ids.flatMap((id) => {
      const target = document.getElementById(id);
      const text2 = target === element ? void 0 : boundedText2(target?.textContent, MAX_NAME_LENGTH);
      return text2 ? [text2] : [];
    });
    return boundedText2(parts.join(" "), MAX_NAME_LENGTH);
  }
  function buttonValueName(element) {
    if (!(element instanceof HTMLInputElement)) return void 0;
    if (!BUTTON_INPUT_TYPES.has(element.type.toLowerCase())) return void 0;
    if (isSensitiveFormControl(element)) return void 0;
    return boundedText2(element.value, MAX_NAME_LENGTH);
  }
  function nameFromContent(element) {
    return supportsNameFromContent(element) ? boundedText2(element.textContent, MAX_NAME_LENGTH) : void 0;
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

  // src/content/identity/candidates.ts
  var MAX_SCANNED = 600;
  var MAX_CANDIDATES = 60;
  var MAX_SIGNAL_LENGTH = 200;
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
    const candidates = [];
    let scanned = 0;
    for (const element of root.querySelectorAll(CANDIDATE_SELECTOR)) {
      scanned += 1;
      if (scanned > MAX_SCANNED) break;
      if (!inFamily(element, tagName, role)) continue;
      candidates.push({ element, fingerprint: candidateFingerprint(element, candidates.length) });
      if (candidates.length >= MAX_CANDIDATES) break;
    }
    return candidates;
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
    const text2 = boundedText2(element.textContent, 40);
    return `${tagName}${identifier}${text2 ? ` "${text2}"` : ""}`;
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
    const declared = element.getAttribute("role")?.trim().toLowerCase();
    return declared === role || implicitRole(element) === role;
  }

  // src/content/identity/context.ts
  var MAX_CONTEXT_TEXT = 200;
  var HEADING_SELECTOR = "h1,h2,h3,h4,h5,h6,[role='heading']";
  var LIST_ITEM_SELECTOR = "li,[role='listitem'],[role='option'],[role='treeitem']";
  var MAX_LANDMARK_DEPTH = 30;
  var MAX_HEADING_LEVELS = 10;
  var MAX_HEADING_SIBLINGS = 12;
  var MAX_HEADING_SUBTREE_QUERIES = 24;
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
  function elementContext(element) {
    const context = compactObject({
      ...formContext(element),
      fieldsetLegend: fieldsetLegend(element),
      landmark: nearestLandmark(element),
      heading: nearestHeading(element),
      listPosition: listPosition(element),
      tablePosition: tablePosition(element)
    });
    return Object.keys(context).length ? context : void 0;
  }
  function formContext(element) {
    const owned = element.form;
    const form = owned ?? element.closest("form");
    if (!form) return {};
    return {
      formId: boundedText2(form.getAttribute("id"), MAX_CONTEXT_TEXT),
      formName: boundedText2(form.getAttribute("name"), MAX_CONTEXT_TEXT),
      formAction: boundedText2(form.getAttribute("action"), MAX_CONTEXT_TEXT)
    };
  }
  function fieldsetLegend(element) {
    const legend = element.closest("fieldset")?.querySelector(":scope > legend");
    return boundedText2(legend?.textContent, MAX_CONTEXT_TEXT);
  }
  function nearestLandmark(element) {
    let current = element;
    let depth = 0;
    while (current && depth < MAX_LANDMARK_DEPTH) {
      depth += 1;
      const role = landmarkRole(current);
      if (role) return role;
      current = current.parentElement;
    }
    return void 0;
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
        if (sibling.matches(HEADING_SELECTOR)) return boundedText2(sibling.textContent, MAX_CONTEXT_TEXT);
        if (sibling.firstElementChild && queries < MAX_HEADING_SUBTREE_QUERIES) {
          queries += 1;
          const headings = sibling.querySelectorAll(HEADING_SELECTOR);
          const last = headings[headings.length - 1];
          if (last) return boundedText2(last.textContent, MAX_CONTEXT_TEXT);
        }
        sibling = sibling.previousElementSibling;
      }
      current = current.parentElement;
    }
    return void 0;
  }
  function listPosition(element) {
    const item = element.closest(LIST_ITEM_SELECTOR);
    const parent = item?.parentElement;
    if (!item || !parent) return void 0;
    const siblings = [...parent.children].filter((child) => child.matches(LIST_ITEM_SELECTOR));
    const index = siblings.indexOf(item);
    return index < 0 ? void 0 : { index: index + 1, total: siblings.length };
  }
  function tablePosition(element) {
    const cell = element.closest("td,th");
    if (!(cell instanceof HTMLTableCellElement)) return void 0;
    const row = cell.closest("tr");
    if (!(row instanceof HTMLTableRowElement) || row.rowIndex < 0 || cell.cellIndex < 0) return void 0;
    return compactObject({
      row: row.rowIndex + 1,
      column: cell.cellIndex + 1,
      columnHeader: columnHeader(row, cell)
    });
  }
  function columnHeader(row, cell) {
    const table = row.closest("table");
    if (!(table instanceof HTMLTableElement)) return void 0;
    const headerRow = table.tHead?.rows[0] ?? table.rows[0];
    return boundedText2(headerRow?.cells[cell.cellIndex]?.textContent, MAX_CONTEXT_TEXT);
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
    contribute(signalPath, similarity >= 0.35 ? similarity : -0.55, similarity >= 0.92 ? "text matched exactly" : "text compared by normalized overlap", { expected: normalizeText2(expected), actual: normalizeText2(actual) });
  }
  function compareExactSignal(signalPath, expected, actual, contribute) {
    if (!hasText(expected)) return;
    if (!hasText(actual)) {
      contribute(signalPath, -0.55, "candidate is missing stable identifier");
      return;
    }
    contribute(signalPath, normalizeCase(expected) === normalizeCase(actual) ? 1 : -0.8, "stable identifier comparison", { expected, actual });
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
    const normalizedLeft = normalizeText2(left);
    const normalizedRight = normalizeText2(right);
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
    return normalizeText2(value ?? "");
  }
  function normalizeText2(value) {
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
    return { outcome: "resolved", chosen, runnerUp, ranked };
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
    const text2 = isInteractableUiElement(element) || isSemanticTextElement2(element) ? visibleText(element) : directVisibleText(element);
    if (text2) {
      descriptor.text = text2;
      descriptor.visibleText = text2;
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
    const context = elementContext(element);
    if (context) descriptor.context = context;
    if (element instanceof HTMLSelectElement && !isSensitiveFormControl(element)) {
      descriptor.options = [...element.options].slice(0, 20).map((option) => ({
        value: option.value.slice(0, 200),
        label: (option.label || option.textContent || "").replace(/\s+/gu, " ").trim().slice(0, 200)
      }));
      if (descriptor.options.some((option) => option.value === element.value)) {
        descriptor.selectedValue = element.value.slice(0, 200);
      }
    }
    const attributes = {};
    for (const attribute of ["id", "class", "name", "type", "autocomplete", "data-sensitive", "placeholder", "title", "alt", "href", "tabindex", "aria-label", "aria-labelledby", "aria-describedby", "for", "aria-disabled", "aria-expanded", "aria-controls", "aria-pressed", "aria-selected", "data-testid", "data-test", "data-cy", "disabled", "onclick"]) {
      const value2 = element.getAttribute(attribute);
      if (value2 !== null) attributes[attribute] = value2.slice(0, 500);
    }
    if (Object.keys(attributes).length) descriptor.attributes = attributes;
    return descriptor;
  }
  function selectorFor(element) {
    if (element.id) return `#${CSS.escape(element.id)}`;
    const testId = element.getAttribute("data-testid");
    if (testId) return `[data-testid="${cssString3(testId)}"]`;
    const name = element.getAttribute("name");
    if (name) return `${element.tagName.toLowerCase()}[name="${cssString3(name)}"]`;
    const parts = [];
    let current = element;
    while (current && current !== document.documentElement && parts.length < 5) {
      const parent = current.parentElement;
      const tag = current.tagName.toLowerCase();
      const siblings = parent ? [...parent.children].filter((child) => child.tagName === current?.tagName) : [];
      const index = siblings.indexOf(current) + 1;
      parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
      current = parent;
    }
    return parts.join(" > ");
  }
  function visibleText(element) {
    const text2 = element.textContent?.replace(/\s+/g, " ").trim();
    return text2 ? text2.slice(0, 500) : void 0;
  }
  function directVisibleText(element) {
    const text2 = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent ?? "").join(" ").replace(/\s+/g, " ").trim();
    return text2 ? text2.slice(0, 500) : void 0;
  }
  function readElementValue(element) {
    if (!element) return void 0;
    if (isSensitiveFormControl(element)) return void 0;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      return element.value.slice(0, 2e3);
    }
    if (element instanceof HTMLElement && element.isContentEditable) return element.innerText.slice(0, 2e3);
    return void 0;
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
  function cssString3(value) {
    return CSS.escape(value).replace(/"/g, '\\"');
  }

  // src/content/evidence/dialogs.ts
  var DIALOG_SELECTOR = "dialog[open],[role='dialog'],[role='alertdialog'],[aria-modal='true']";
  var MAX_DIALOGS = 5;
  function dialogEvidence() {
    const open = openDialogs();
    const armPending = document.documentElement?.hasAttribute(DIALOG_ARM_ATTRIBUTE) === true;
    const lastNative = lastNativeDialog();
    if (!open.length && !armPending && !lastNative) return void 0;
    return {
      open,
      modal: open.some((dialog) => dialog.modal),
      ...armPending ? { armPending: true } : {},
      ...lastNative ? { lastNative } : {}
    };
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
    return {
      selector: selectorFor(element),
      role: role || "dialog",
      // A native <dialog> opened with showModal() reports `::backdrop`; the
      // property the page can be asked for is `open`, so modality is taken from
      // the author's own declaration plus the inert page behind it.
      modal: element.getAttribute("aria-modal") === "true" || native && isNativeModal(element),
      native,
      ...label ? { label } : {},
      ...bounds ? { bounds } : {}
    };
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
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
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
    return {
      selector: selectorFor(form),
      ...name ? { name } : {},
      ...label ? { label } : {},
      ...action ? { action } : {},
      ...method ? { method } : {},
      controlCount: owned.length,
      controls: owned.slice(0, MAX_CONTROLS_PER_FORM).map(describeControl),
      ...submit ? { submit: selectorFor(submit) } : {}
    };
  }
  function isReportableControl(element) {
    return !(element instanceof HTMLInputElement && element.type.toLowerCase() === "hidden");
  }
  function describeControl(element) {
    const label = accessibleNameFor(element);
    const name = boundedText2(element.getAttribute("name"), MAX_TEXT);
    const valuePresent = hasEnteredValue(element);
    const autocomplete = autocompleteTokens(element);
    return {
      selector: selectorFor(element),
      controlType: controlType(element),
      ...name ? { name } : {},
      ...label ? { label } : {},
      ...isRequired(element) ? { required: true } : {},
      ...isDisabled(element) ? { disabled: true } : {},
      ...valuePresent === void 0 ? {} : { hasValue: valuePresent },
      ...autocomplete ? { autocomplete } : {},
      ...isSensitiveFormControl(element) ? { sensitive: true } : {}
    };
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
  var MAX_LABEL_LENGTH2 = 120;
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
    return {
      documentState,
      busy: pendingNavigation || busyRegions.length > 0 || indicators.length > 0,
      busyRegions,
      indicators,
      pendingNavigation
    };
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
    const label = accessibleNameFor(element) ?? boundedText2(element.textContent, MAX_LABEL_LENGTH2);
    return { selector: selectorFor(element), kind, ...label ? { label } : {} };
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
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect2 = element.getBoundingClientRect();
    return rect2.width >= 1 && rect2.height >= 1;
  }

  // src/content/evidence/navigation.ts
  var MAX_URL_LENGTH = 2e3;
  function navigationEvidence() {
    const entry = navigationTiming();
    const url = new URL(location.href);
    const referrer = boundedText2(document.referrer, MAX_URL_LENGTH);
    return {
      url: location.href.slice(0, MAX_URL_LENGTH),
      origin: url.origin,
      path: url.pathname,
      ...referrer ? { referrer } : {},
      ...entry?.type ? { type: entry.type } : {},
      ...entry && entry.redirectCount > 0 ? { redirects: entry.redirectCount } : {},
      historyLength: history.length,
      visibility: document.visibilityState
    };
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
    return { tested, blockedCount, blockers: rankBlockers(blockers) };
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
    return {
      selector: selectorFor(element),
      ...role ? { role } : {},
      ...label ? { label } : {},
      ...bounds ? { bounds } : {},
      blocks: covered.length,
      blocked: covered.slice(0, MAX_BLOCKED_PER_BLOCKER).map((target) => selectorFor(target))
    };
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
      regions.push({
        role,
        selector: selectorFor(element),
        ...label ? { label } : {},
        ...bounds ? { bounds } : {}
      });
      if (regions.length >= MAX_REGIONS) break;
    }
    return regions.length ? regions : void 0;
  }

  // src/content/evidence/repeating.ts
  var ITEM_SELECTOR = "li,tr,article,[data-testid],[role='listitem'],[role='row'],[role='option'],[role='article'],[role='treeitem']";
  var MAX_SCANNED_ITEMS = 2e3;
  var MIN_ITEMS_PER_RUN = 3;
  var MAX_STRUCTURES = 6;
  var MAX_SIGNATURE_CLASSES = 3;
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
      const signature = itemSignature(element);
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
  function itemSignature(element) {
    const role = element.getAttribute("role")?.trim().toLowerCase() ?? "";
    const classes = [...element.classList].sort().slice(0, MAX_SIGNATURE_CLASSES).join(".");
    return `${element.tagName.toLowerCase()}|${role}|${identifierShape(testIdFor(element))}|${classes}`;
  }
  function identifierShape(value) {
    return value === void 0 ? "" : value.replace(/\d+/gu, "#");
  }
  function describeRun(run) {
    const first = run.items[0];
    const testId = first ? testIdFor(first) : void 0;
    const text2 = first ? boundedText2(first.textContent, MAX_REPRESENTATIVE_TEXT) : void 0;
    const fields = first ? itemFields(first) : [];
    return {
      containerSelector: selectorFor(run.container),
      signature: run.signature,
      itemCount: run.items.length,
      representative: {
        selector: first ? selectorFor(first) : run.signature,
        ...testId ? { testId } : {},
        ...text2 ? { text: text2 } : {}
      },
      ...fields.length ? { fields } : {}
    };
  }
  function itemFields(item) {
    const fields = /* @__PURE__ */ new Set();
    for (const element of item.querySelectorAll("[data-testid],[data-test],[data-cy]")) {
      const id = testIdFor(element);
      if (id) fields.add(identifierShape(id));
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
    return {
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
      ...dialogs ? { dialogs } : {},
      ...overlays ? { overlays } : {},
      ...regions ? { regions } : {},
      ...repeating ? { repeating } : {},
      ...forms ? { forms } : {}
    };
  }

  // src/content/dom-snapshot.ts
  var MAX_SNAPSHOT_CANDIDATES = 2e3;
  var MAX_SNAPSHOT_SCAN_ELEMENTS = 5e4;
  function captureSnapshot() {
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
    const text2 = selection?.toString();
    if (!selection || !text2) return void 0;
    return selectionTouchesSensitiveControl(selection) ? void 0 : text2.slice(0, MAX_SELECTED_TEXT);
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
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
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

  // src/content/snapshots.ts
  function shouldAttachStateSnapshot(kind) {
    return kind === "dom.click" || kind === "dom.input" || kind === "dom.change" || kind === "dom.submit" || kind === "dom.keydown";
  }

  // src/content/recorder.ts
  var recording = false;
  var sequence = 0;
  var mutationTimer;
  var inputTimer;
  var pendingInput;
  var pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };
  var observer = new MutationObserver((mutations) => {
    if (!captureSettings.mutations || !recording) return;
    for (const mutation of mutations) {
      pendingMutation.added += mutation.addedNodes.length;
      pendingMutation.removed += mutation.removedNodes.length;
      if (mutation.type === "attributes") pendingMutation.attributes += 1;
      if (mutation.type === "characterData") pendingMutation.text += 1;
    }
    if (mutationTimer) clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      emit("dom.mutation", { mutation: pendingMutation });
      pendingMutation = { added: 0, removed: 0, attributes: 0, text: 0 };
    }, 500);
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
    if (details.actionResult) payload.actionResult = details.actionResult;
    if (details.metadata) payload.metadata = details.metadata;
    return payload;
  }

  // src/content/action-runtime/capture-snapshot-for-response.ts
  async function captureSnapshotForResponse() {
    if (!isTopFrame()) await requestFrameGeometry();
    return captureSnapshot();
  }

  // src/content/actions/capture-snapshot.ts
  function captureSnapshotAction(action, deps, startedAt) {
    return deps.success(action, startedAt, "Snapshot captured.", { status: "none", reason: "evidence-only" }, {
      snapshot: deps.captureSnapshot()
    });
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
    const text2 = action.text ?? action.value ?? "";
    const url = action.wait?.url ?? action.url;
    const outcome = await deps.waitForCondition({
      condition,
      text: text2,
      url,
      timeoutMs: action.timeoutMs,
      stableForMs: action.wait?.stableForMs
    });
    const phrases = phrasesFor2(condition, text2, url);
    if (!outcome.ok) {
      return deps.timedOut(action, startedAt, phrases.timedOut, { status: "failed", expected: phrases.expected, actual: outcome.actual }, {
        snapshot: deps.captureSnapshot()
      });
    }
    return deps.success(action, startedAt, phrases.satisfied, { status: "passed", expected: phrases.expected, actual: outcome.actual }, {
      snapshot: deps.captureSnapshot()
    });
  }
  function phrasesFor2(condition, text2, url) {
    if (condition === "visible") {
      return { expected: `visible page text containing ${text2}`, satisfied: "The text is visible.", timedOut: `Timed out waiting for visible text: ${text2}` };
    }
    if (condition === "absent") {
      return { expected: `no page text containing ${text2}`, satisfied: "The text is gone.", timedOut: `Timed out waiting for the text to go: ${text2}` };
    }
    if (condition === "url") {
      const address = url ?? "(no url)";
      return { expected: `the page URL to be ${address}`, satisfied: "The URL matched.", timedOut: `Timed out waiting for the URL: ${address}` };
    }
    if (condition === "stable") {
      return { expected: "the page to stop changing", satisfied: "The page is stable.", timedOut: "Timed out waiting for the page to stop changing." };
    }
    return { expected: `page text containing ${text2}`, satisfied: "Text found.", timedOut: `Timed out waiting for text: ${text2}` };
  }

  // src/content/actions/extract.ts
  function extractAction(action, deps, startedAt) {
    const element = deps.resolveTarget(action);
    const extracted = deps.extractElement(element, action.options);
    return deps.success(action, startedAt, "Value extracted.", { status: "none", reason: "evidence-only" }, {
      element: deps.describeElement(element),
      snapshot: deps.captureSnapshot(),
      extracted
    });
  }

  // src/content/actions/click.ts
  function clickAction(action, deps, startedAt) {
    const element = deps.resolveTarget(action);
    const evidence = () => ({
      element: deps.describeElement(element),
      snapshot: deps.captureSnapshot()
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
    const element = deps.resolveTarget(action);
    const text2 = action.text ?? action.value ?? "";
    const withheld = isSensitiveFormControl(element);
    const evidence = () => ({ element: deps.describeElement(element), snapshot: deps.captureSnapshot() });
    const report = deps.checkActionability(element);
    if (!report.actionable) {
      return deps.rejected(action, startedAt, report.code, "a target that can be typed into", report.detail, evidence());
    }
    if (!holdsText(element)) {
      return deps.success(action, startedAt, "The target holds no typed text.", {
        status: "failed",
        expected: `a text field or editable element holding ${describeFieldValue(text2, withheld)}`,
        actual: `the target is a <${element.tagName.toLowerCase()}>, which holds no typed text`
      }, evidence());
    }
    deps.keyboard.typeText(element, text2);
    const actual = enteredText(element);
    const held = actual === text2;
    return deps.success(action, startedAt, held ? "Text entered." : "The field did not keep the text.", {
      status: held ? "passed" : "failed",
      expected: `the field holds ${describeFieldValue(text2, withheld)}`,
      actual: heldText(actual, text2, withheld)
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
    const element = deps.resolveTarget(action);
    const withheld = isSensitiveFormControl(element);
    const evidence = () => ({ element: deps.describeElement(element), snapshot: deps.captureSnapshot() });
    const report = deps.checkActionability(element);
    if (!report.actionable) {
      return deps.rejected(action, startedAt, report.code, "a target that can be cleared", report.detail, evidence());
    }
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      return deps.success(action, startedAt, "The target has no value to clear.", {
        status: "failed",
        expected: "a field whose value can be emptied",
        actual: `the target is a <${element.tagName.toLowerCase()}>, which has no value`
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
      actual: empty ? "the field is empty" : `the field holds ${describeFieldValue(actual, withheld)}`
    }, evidence());
  }

  // src/content/actions/select.ts
  var OPTIONS_LISTED_ON_FAILURE = 20;
  function selectAction(action, deps, startedAt) {
    const element = deps.resolveTarget(action);
    const withheld = isSensitiveFormControl(element);
    const evidence = () => ({ element: deps.describeElement(element), snapshot: deps.captureSnapshot() });
    const request = requestedOption(action);
    const report = deps.checkActionability(element);
    if (!report.actionable) {
      return deps.rejected(action, startedAt, report.code, "a target that can be selected in", report.detail, evidence());
    }
    if (!request) {
      return deps.success(action, startedAt, "No option was named.", {
        status: "failed",
        expected: "an option named by value, label, or index",
        actual: "the command named none"
      }, evidence());
    }
    if (!(element instanceof HTMLSelectElement)) {
      return deps.success(action, startedAt, "The target is not a select element.", {
        status: "failed",
        expected: `a select element to choose ${describeRequest(request, withheld)} in`,
        actual: `the target is a <${element.tagName.toLowerCase()}>`
      }, evidence());
    }
    const option = findOption(element, request);
    if (!option) {
      return deps.success(action, startedAt, `No option matched ${describeRequest(request, withheld)}.`, {
        status: "failed",
        expected: `an option matching ${describeRequest(request, withheld)} is selected`,
        actual: `no option matched; the select still holds ${describeFieldValue(element.value, withheld)} and offers ${listOptions(element, withheld)}`
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
      actual: selectedValueText(selected, option.value, withheld)
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
    const element = deps.resolveTarget(action);
    deps.scrollElementIntoView(element);
    const rect2 = element.getBoundingClientRect();
    const inView = rect2.bottom > 0 && rect2.top < window.innerHeight && rect2.right > 0 && rect2.left < window.innerWidth;
    return deps.success(action, startedAt, "Scrolled the target into view.", {
      status: inView ? "passed" : "failed",
      expected: "the target within the viewport",
      actual: `the target is at ${Math.round(rect2.left)},${Math.round(rect2.top)} in a ${window.innerWidth}x${window.innerHeight} viewport`
    }, { element: deps.describeElement(element), snapshot: deps.captureSnapshot() });
  }
  async function scrollUntilStable(action, request, deps, startedAt) {
    const cap = Math.max(1, Math.floor(finiteNumber(request.maxScrolls, 1)));
    const step = request.y === void 0 ? void 0 : finiteNumber(request.y, 0);
    const startHeight = documentHeight();
    let height = startHeight;
    let scrolls = 0;
    let settled = false;
    while (scrolls < cap) {
      const from = currentPosition();
      const bottom = scrollLimits().y;
      window.scrollTo({ left: from.x, top: step === void 0 ? bottom : Math.min(from.y + step, bottom), behavior: "instant" });
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
      const position = currentPosition();
      if (Math.abs(position.x - target.x) <= POSITION_TOLERANCE_PX && Math.abs(position.y - target.y) <= POSITION_TOLERANCE_PX) return;
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
    const target = named ? deps.resolveTarget(action) : document.activeElement ?? document.body;
    const key = action.key ?? action.text ?? "";
    const evidence = () => ({ element: deps.describeElement(target), snapshot: deps.captureSnapshot() });
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
    const element = deps.resolveTarget(action);
    const requested = action.checked ?? true;
    deps.scrollElementIntoView(element);
    const outcome = deps.setCheckedState(element, requested);
    const evidence = { element: deps.describeElement(element), snapshot: deps.captureSnapshot() };
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
      const target = assertionTarget(action, deps);
      const outcome = await deps.evaluateAssertion(request, target);
      const evidence = {
        ...target.element ? { element: deps.describeElement(target.element) } : {},
        snapshot: deps.captureSnapshot()
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
    if (action.selector) return { selector: action.selector };
    try {
      return { element: deps.resolveTarget(action) };
    } catch {
      return {};
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
      const outcome = await deps.extractList(request);
      return deps.success(action, startedAt, "List extracted.", validationFor(outcome, Object.keys(request.fields)), {
        extracted: outcome.records,
        snapshot: deps.captureSnapshot()
      });
    } catch (error) {
      return deps.failure(action, error, startedAt);
    }
  }
  function validationFor(outcome, fieldNames) {
    const expected = `every record carries ${fieldNames.join(", ")}`;
    const read = `${count2(outcome.records.length, "record")} from ${count2(outcome.pagesRead, "page")}${outcome.truncated ? ", truncated" : ""}`;
    return outcome.missingFields.length === 0 ? { status: "passed", expected, actual: `${read}; every declared field present` } : { status: "failed", expected, actual: `${read}; missing from some records: ${outcome.missingFields.join(", ")}` };
  }
  function count2(value, noun) {
    return `${value} ${noun}${value === 1 ? "" : "s"}`;
  }

  // src/content/actions/upload.ts
  function uploadAction(action, deps, startedAt) {
    const files = action.upload?.files ?? [];
    const element = deps.resolveTarget(action);
    const evidence = { element: deps.describeElement(element), snapshot: deps.captureSnapshot() };
    const expected = fileNameList(files.map((file) => file.name));
    const outcome = deps.setInputFiles(element, files);
    if (!outcome.ok) {
      return deps.rejected(action, startedAt, "upload_rejected", expected, outcome.reason, evidence);
    }
    const actual = fileNameList(outcome.fileNames);
    return deps.success(action, startedAt, "Files uploaded.", {
      status: actual === expected ? "passed" : "failed",
      expected,
      actual
    }, evidence);
  }
  function fileNameList(names) {
    return names.length === 0 ? "(no files)" : names.join(", ");
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
      ...previous2 ? { extracted: observedAsJson(previous2) } : {}
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
  function observedAsJson(observed) {
    return {
      kind: observed.kind,
      message: observed.message,
      response: observed.response,
      at: observed.at,
      ...observed.promptText === void 0 ? {} : { promptText: observed.promptText }
    };
  }

  // src/content/actions/execute.ts
  async function executeContentAction(action, deps) {
    const startedAt = Date.now();
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
      throw new Error(`Unsupported action type: ${action.actionType}`);
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
    return resolveTargetWithDiagnostics(action).element;
  }
  function resolveTargetWithDiagnostics(action) {
    const target = recordedTarget(action);
    const misses = [];
    for (const attempt of exactAttempts(action, target)) {
      if (!attempt.matches.length) {
        misses.push(attempt.description);
        continue;
      }
      const pool = gatedPool(attempt.matches, target);
      const only = pool.length === 1 ? pool[0] : void 0;
      if (only) return { element: only, resolution: { strategy: attempt.strategy, candidateCount: attempt.matches.length } };
      const decided2 = target ? scoreTargetCandidates(target, describePool(pool)) : void 0;
      if (decided2?.outcome === "resolved") return scoredTarget(decided2, pool.length);
      throw ambiguous(attempt, pool, decided2);
    }
    if (!misses.length) {
      const active = document.activeElement;
      if (active) return { element: active, resolution: { strategy: "active-element", candidateCount: 1 } };
      throw notFound("No selector, coordinates, or active element was available.", [], 0);
    }
    const nearby = target ? collectTargetCandidates(candidateFamily(target)) : [];
    const decided = target ? scoreTargetCandidates(target, nearby) : void 0;
    if (decided?.outcome === "resolved") return scoredTarget(decided, nearby.length);
    if (decided?.outcome === "ambiguous") throw scoredAmbiguous(decided, misses);
    throw notFound(`No target resolved from ${misses.join(", ")}.`, misses, nearby.length);
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
    const style = view.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
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
  function notFound(message, misses, nearbyCount) {
    const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, {
      expected: misses.length ? `an element matching ${misses.join(", ")}` : "a selector, coordinates, or a focused element",
      actual: `nothing matched; ${nearbyCount} control(s) of the same family are on the page`
    });
    return new TargetResolutionError(message, failure, { strategy: strategyOf(misses), candidateCount: nearbyCount });
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
    const element = action.options?.element;
    if (!element || typeof element !== "object" || Array.isArray(element)) return void 0;
    return element;
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
    const mode = options?.mode;
    if (mode === "html") return element.innerHTML;
    if (mode === "attribute" && typeof options?.attribute === "string") return element.getAttribute(options.attribute) ?? "";
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return element.value;
    return element.textContent?.replace(/\s+/g, " ").trim() ?? "";
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
    const style = view.getComputedStyle(element);
    if (style.display === "none") return "the element's display is none";
    if (style.visibility !== "visible") return `the element's visibility is ${style.visibility}`;
    if (style.opacity === "0") return "the element's opacity is 0";
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
    const text2 = document.createTextNode(data);
    range.insertNode(text2);
    range.setStartAfter(text2);
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
    const text2 = button.textContent?.replace(/\s+/gu, " ").trim();
    return text2 ? `the "${text2}" button` : "the form's default button";
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
    const step = backwards ? -1 : 1;
    const next = index === -1 ? order[backwards ? order.length - 1 : 0] : order[(index + step + order.length) % order.length];
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
    const refused = unsupportedDefault(target, key);
    if (refused) return refused;
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
  function typeText(element, text2) {
    if (!isTextField(element) && !isEditableHost(element)) return;
    if (element instanceof HTMLElement) element.focus();
    deleteAllContent(element);
    for (const character of text2) {
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

  // src/content/action-runtime/list-extraction.ts
  var EXTRACT_MAX_PAGES = 50;
  var LIST_CHANGE_TIMEOUT_MS = 1e4;
  var LIST_CHANGE_POLL_MS = 25;
  var COLUMN_PREFIX = "column:";
  var ATTRIBUTE_NAME = /^[A-Za-z_][-A-Za-z0-9_:.]*$/u;
  function parseExtractField(spec) {
    if (spec.startsWith(COLUMN_PREFIX)) {
      const header = normalizeText4(spec.slice(COLUMN_PREFIX.length));
      if (!header) throw new Error(`The extract_list field ${JSON.stringify(spec)} names no column header.`);
      return { kind: "column", header };
    }
    const at = spec.lastIndexOf("@");
    const candidate = at < 0 ? "" : spec.slice(at + 1);
    const attribute = ATTRIBUTE_NAME.test(candidate) ? candidate : void 0;
    const selector = (attribute === void 0 ? spec : spec.slice(0, at)).trim();
    return {
      kind: "element",
      ...selector ? { selector } : {},
      ...attribute === void 0 ? {} : { attribute }
    };
  }
  async function extractList(request) {
    const item = request.item.trim();
    if (!item) throw new Error("An extract_list request needs an item selector.");
    const fields = Object.entries(request.fields).map(([name, spec]) => [name, parseExtractField(spec)]);
    if (fields.length === 0) throw new Error("An extract_list request names no fields.");
    const maxPages = request.paginate ? Math.min(Math.max(1, Math.trunc(request.paginate.maxPages)), EXTRACT_MAX_PAGES) : 1;
    const maxItems = request.maxItems === void 0 ? void 0 : Math.max(0, Math.trunc(request.maxItems));
    const records = [];
    const missing = /* @__PURE__ */ new Set();
    let pagesRead = 0;
    let truncated = false;
    for (; ; ) {
      const items = Array.from(document.querySelectorAll(item));
      pagesRead += 1;
      for (const element of items) {
        if (maxItems !== void 0 && records.length >= maxItems) {
          truncated = true;
          break;
        }
        records.push(readRecord(element, fields, missing));
      }
      if (truncated) break;
      const paginate = request.paginate;
      const next = paginate ? document.querySelector(paginate.next) : null;
      if (!paginate || !next) break;
      if (pagesRead >= maxPages) {
        truncated = true;
        break;
      }
      if (!(next instanceof HTMLElement)) throw new Error(`The pagination control ${JSON.stringify(paginate.next)} is not a clickable element.`);
      next.click();
      if (!await waitForListChange(item, items)) {
        throw new Error(`The list did not change within ${LIST_CHANGE_TIMEOUT_MS}ms of following ${JSON.stringify(paginate.next)} to page ${pagesRead + 1}.`);
      }
    }
    return { records, pagesRead, truncated, missingFields: [...missing].sort() };
  }
  function readRecord(item, fields, missing) {
    const record2 = {};
    for (const [name, field] of fields) {
      const value = readField(item, field);
      if (value === void 0) missing.add(name);
      else record2[name] = value;
    }
    return record2;
  }
  function readField(item, field) {
    if (field.kind === "column") return readColumn(item, field.header);
    const element = field.selector ? item.querySelector(field.selector) : item;
    if (!element) return void 0;
    if (field.attribute !== void 0) return element.getAttribute(field.attribute) ?? void 0;
    return normalizeText4(element.textContent ?? "");
  }
  function readColumn(item, header) {
    const row = item;
    const table = row.tagName === "TR" ? row.closest("table") : null;
    if (!table) throw new Error("A column field needs extract_list items that are table rows.");
    const headerRow = table.tHead?.rows[0] ?? Array.from(table.rows).find((candidate) => Array.from(candidate.cells).some((cell2) => cell2.tagName === "TH"));
    const index = headerRow ? Array.from(headerRow.cells).findIndex((cell2) => normalizeText4(cell2.textContent ?? "") === header) : -1;
    if (index < 0) return void 0;
    const cell = row.cells[index];
    return cell ? normalizeText4(cell.textContent ?? "") : void 0;
  }
  async function waitForListChange(itemSelector, previous2) {
    const deadline = Date.now() + LIST_CHANGE_TIMEOUT_MS;
    while (!listChanged(itemSelector, previous2)) {
      if (Date.now() >= deadline) return false;
      await delay2(LIST_CHANGE_POLL_MS);
    }
    return true;
  }
  function listChanged(itemSelector, previous2) {
    const current = document.querySelectorAll(itemSelector);
    const first = previous2[0];
    if (!first) return current.length > 0;
    return !first.isConnected || current.length !== previous2.length || current[0] !== first;
  }
  function delay2(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
  function normalizeText4(text2) {
    return text2.replace(/\s+/gu, " ").trim();
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
    for (const file of files) {
      const content = decodeBase64(file.contentBase64);
      if (!content) return { ok: false, reason: `the content of ${file.name} is not valid base64` };
      if (content.byteLength > UPLOAD_MAX_FILE_BYTES) {
        return { ok: false, reason: `${file.name} is ${content.byteLength} bytes, over the ${UPLOAD_MAX_FILE_BYTES}-byte file limit` };
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
    const text2 = readText(scope);
    return {
      held: text2.includes(wanted),
      expected: `${label} contains "${wanted}"`,
      actual: text2 ? `${label} reads "${text2}"` : `${label} has no text`,
      verdict: "judged"
    };
  }
  function readText(element) {
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
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && Number.parseFloat(style.opacity) !== 0;
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
  function waitUntil(evaluate, timeoutMs = DEFAULT_WAIT_TIMEOUT_MS) {
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
    const hit = await waitUntil(evaluatorFor(request), request.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS);
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
    const collapsed = value.replace(/\s+/gu, " ").trim();
    if (!collapsed) return "(none)";
    return collapsed.length <= VALIDATION_TEXT_MAX_LENGTH ? collapsed : `${collapsed.slice(0, VALIDATION_TEXT_MAX_LENGTH - 1)}\u2026`;
  }
  function boundValidation(validation) {
    if (validation.status === "none") return validation;
    return {
      status: validation.status,
      expected: truncateValidationText(validation.expected),
      actual: truncateValidationText(validation.actual)
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
    const failure = property(error, "failure");
    const code = property(failure, "code");
    return isWebAutomationFailureCode(code) ? failure : void 0;
  }
  function reportedResolution(error) {
    const resolution = property(error, "resolution");
    if (typeof property(resolution, "strategy") !== "string") return void 0;
    return typeof property(resolution, "candidateCount") === "number" ? resolution : void 0;
  }
  function property(value, name) {
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
    if (!action.selector || !selectorMatchesNothing(action.selector) || !signInGatePresent()) return void 0;
    return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED, {
      expected: failure.expected ?? `an element matching ${action.selector}`,
      actual: `${failure.actual ?? "nothing matched the target"}; the document is a sign-in gate, so the session has probably expired`
    });
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
      return false;
    });
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
    return isSensitiveFormControl(target) ? void 0 : key;
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
