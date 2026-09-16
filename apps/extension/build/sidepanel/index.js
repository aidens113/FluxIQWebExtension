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
  const { datasetId, label, recordCount, pagesRead, truncated, durationMs } = response;
  if (typeof datasetId !== "string" || typeof label !== "string") return void 0;
  if (typeof recordCount !== "number" || typeof pagesRead !== "number" || typeof durationMs !== "number") return void 0;
  return { datasetId, label, recordCount, pagesRead, truncated: truncated === true, durationMs };
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

// ../../domain/src/actions/extraction/request.ts
var WEB_AUTOMATION_EXTRACT_PAGINATION_MODES = ["next", "loadMore", "scroll", "numbered"];
var WEB_AUTOMATION_EXTRACT_FIELD_KINDS = ["text", "attribute", "link", "value", "column"];
var WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS = ["include", "exclude", "encrypt"];
var WEB_AUTOMATION_EXTRACT_READ_MODES = ["text", "attribute", "value", "html"];
var WEB_AUTOMATION_EXTRACT_MAX_PAGES = 50;
var WEB_AUTOMATION_EXTRACT_MAX_ITEMS = 1e3;

// ../../domain/src/actions/extraction/read-request.ts
var REFUSED = Symbol("refused");

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

// ../../domain/src/output-nodes/definitions.ts
var controlInput = { id: "in", label: "In", valueType: "signal", role: "control" };
var outputPorts = [
  { id: "success", label: "Success", valueType: "any", role: "success" },
  { id: "failed", label: "Failed", valueType: "any", role: "failure" }
];
var recordsPathByOutput = {
  "web.dom.extract_list": "extracted"
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
  if (outputId === "web.dom.extract_list") return [
    structured("extractList", "List"),
    { id: "timeoutMs", label: "Timeout", valueType: "number", defaultValue: 1e4 }
  ];
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
  pageScrolled: "web.user.page_scrolled",
  filesChosen: "web.user.files_chosen",
  tabSwitched: "web.user.tab_switched",
  tabClosed: "web.user.tab_closed",
  // Two inputs, because an input maps to exactly one output and the two forms
  // of a recorded extraction run different verbs: a list saves a dataset, a
  // single value answers with one value and saves none.
  dataExtractionDefined: "web.user.data_extraction_defined",
  valueExtractionDefined: "web.user.value_extraction_defined"
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
  [WEB_AUTOMATION_INPUT_IDS.dataExtractionDefined, "Data extraction defined", "web.dom.extract_list"],
  [WEB_AUTOMATION_INPUT_IDS.valueExtractionDefined, "Value extraction defined", "web.dom.extract"]
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
