// domain/src/runtime/tests/host-runtime.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// domain/src/constants.ts
var WEB_AUTOMATION_DOMAIN_ID = "web-automation";

// domain/src/actions/safety.ts
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

// domain/src/actions/extraction/request.ts
var WEB_AUTOMATION_EXTRACT_PAGINATION_MODES = ["next", "loadMore", "scroll", "numbered"];
var WEB_AUTOMATION_EXTRACT_FIELD_KINDS = ["text", "attribute", "link", "value", "column"];
var WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS = ["include", "exclude", "encrypt"];
var WEB_AUTOMATION_EXTRACT_READ_MODES = ["text", "attribute", "value", "html"];
var WEB_AUTOMATION_EXTRACT_MAX_PAGES = 50;
var WEB_AUTOMATION_EXTRACT_MAX_ITEMS = 1e3;

// domain/src/actions/extraction/read-request.ts
var REFUSED = Symbol("refused");

// domain/src/actions/extraction/schema.ts
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

// domain/src/actions/schemas.ts
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

// domain/src/output-nodes/definitions.ts
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

// domain/src/actions/types.ts
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

// domain/src/sensitivity/signature.ts
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

// domain/src/sensitivity/descriptor.ts
function sensitiveFieldSignatureOfDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) return {};
  const record = descriptor;
  const attributes = record.attributes && typeof record.attributes === "object" && !Array.isArray(record.attributes) ? record.attributes : {};
  return {
    inputType: stringField(record.inputType),
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

// domain/src/io/input-model.ts
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

// domain/src/runtime/capabilities.ts
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

// domain/src/extraction/dataset-id.ts
var COMBINING_MARKS = new RegExp("\\p{M}+", "gu");

// domain/src/extraction/label-key.ts
var COMBINING_MARKS2 = new RegExp("\\p{M}+", "gu");

// domain/src/runtime/failure/codes.ts
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
  const collapsed = value.replace(/\s+/gu, " ").trim();
  if (collapsed.length === 0) return void 0;
  if (collapsed.length <= WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH) return collapsed;
  return `${collapsed.slice(0, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH - 1)}\u2026`;
}

// domain/src/page-evidence/wire.ts
function pageEvidenceWire(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}

// domain/src/recording/web-state/evidence/project.ts
var COLLECTION = { elementKind: "collection", comparable: false };
var LIVE_COLLECTION = { ...COLLECTION, volatility: "rapid" };
var SETTLED_COLLECTION = { ...COLLECTION, volatility: "slow" };

// domain/src/client/gateway-mapping.ts
var UNSUPPORTED_ACTION_TYPE_FAILURE = Object.freeze(webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE));
var CANONICAL_ACTION_TYPES = new Set(WEB_AUTOMATION_ACTION_TYPES);
var LEGACY_ACTION_TYPE_ALIASES = new Map(
  Object.entries(WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER).map(([canonical, legacy]) => [legacy, canonical])
);

// domain/src/runtime/expectation/conditions.ts
var ASSERT_KINDS = Object.freeze({
  exists: true,
  absent: true,
  text: true,
  url: true,
  visible: true,
  enabled: true
});
var IMMEDIATE_TIMEOUT_MS = 1;
var MAX_DESCRIPTION_LENGTH = 160;
function webAutomationExpectationCondition(value, fallbackTimeoutMs) {
  const entry = jsonObject(value);
  if (!entry) return void 0;
  const nested = jsonObject(entry.assert);
  const claim = nested && isAssertKind(nested.kind) ? nested : entry;
  const kind = claim.kind;
  if (!isAssertKind(kind)) return void 0;
  const expected = typeof claim.expected === "string" ? claim.expected : void 0;
  const selector = nonEmptyString(entry.selector) ?? nonEmptyString(claim.selector);
  const timeoutMs = Math.max(
    IMMEDIATE_TIMEOUT_MS,
    positiveInteger(claim.timeoutMs) ?? positiveInteger(entry.timeoutMs) ?? nonNegativeInteger(fallbackTimeoutMs) ?? 0
  );
  const frameId = nonNegativeInteger(entry.frameId ?? entry.browserFrameId);
  const tabId = nonNegativeInteger(entry.tabId ?? entry.browserTabId);
  return {
    assert: { kind, ...expected === void 0 ? {} : { expected }, timeoutMs },
    ...selector === void 0 ? {} : { selector },
    ...frameId === void 0 ? {} : { frameId },
    ...tabId === void 0 ? {} : { tabId }
  };
}
function webAutomationExpectationActionPayload(condition) {
  return {
    ...condition.selector === void 0 ? {} : { selector: condition.selector },
    ...condition.frameId === void 0 ? {} : { browserFrameId: condition.frameId },
    ...condition.tabId === void 0 ? {} : { browserTabId: condition.tabId },
    assert: {
      kind: condition.assert.kind,
      ...condition.assert.expected === void 0 ? {} : { expected: condition.assert.expected },
      timeoutMs: condition.assert.timeoutMs
    }
  };
}
function describeWebAutomationExpectationCondition(condition) {
  const where = condition.selector ? `"${condition.selector}"` : "the resolved element";
  const kind = condition.assert.kind;
  const expected = condition.assert.expected ?? "";
  if (kind === "url") return bounded(`the page URL contains "${expected}"`);
  if (kind === "text") return bounded(`${condition.selector ? where : "the page"} contains "${expected}"`);
  if (kind === "exists") return bounded(`an element matches ${where}`);
  if (kind === "absent") return bounded(`no element matches ${where}`);
  return bounded(`${where} is ${kind}`);
}
function isAssertKind(value) {
  return typeof value === "string" && Object.hasOwn(ASSERT_KINDS, value);
}
function jsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function positiveInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : void 0;
}
function nonNegativeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
}
function bounded(value) {
  const collapsed = value.replace(/\s+/gu, " ").trim();
  return collapsed.length <= MAX_DESCRIPTION_LENGTH ? collapsed : `${collapsed.slice(0, MAX_DESCRIPTION_LENGTH - 1)}\u2026`;
}

// domain/src/runtime/expectation/evaluate.ts
var ASSERT_OUTPUT_ID = "web.dom.assert";
var EXPECTATION_SOURCE = "web-automation-expectation";
function createWebAutomationExpectationEvaluator(dispatch) {
  return async (conditions, mode, timeoutMs, context) => {
    try {
      return await evaluateConditions(dispatch, conditions, mode, timeoutMs, context);
    } catch (error) {
      return { passed: true, checkedConditionCount: 0, message: `The expected state could not be evaluated: ${errorText(error)}` };
    }
  };
}
async function evaluateConditions(dispatch, conditions, mode, timeoutMs, context) {
  const outcomes = [];
  for (let index = 0; index < conditions.length; index += 1) {
    if (context.signal?.aborted) break;
    const condition = webAutomationExpectationCondition(conditions[index], timeoutMs);
    outcomes.push(condition ? await evaluateCondition(dispatch, condition, index, context) : { description: "a condition this domain cannot read", evaluated: false, held: false, timedOut: false });
  }
  return verdict(outcomes, mode);
}
async function evaluateCondition(dispatch, condition, index, context) {
  const description = describeWebAutomationExpectationCondition(condition);
  let result;
  try {
    result = await dispatch({
      outputId: ASSERT_OUTPUT_ID,
      payload: webAutomationExpectationActionPayload(condition),
      metadata: conditionMetadata(index, context)
    });
  } catch {
    return { description, evaluated: false, held: false, timedOut: false };
  }
  if (result.status === "succeeded") return { description, evaluated: true, held: true, timedOut: false };
  if (result.status !== "failed" && result.status !== "timed_out") {
    return { description, evaluated: false, held: false, timedOut: false };
  }
  const timedOut = result.status === "timed_out";
  return { description, evaluated: true, held: false, timedOut, failure: conditionFailure(condition, description, timedOut, result) };
}
function conditionFailure(condition, description, timedOut, result) {
  const reported = result.failure;
  if (reported && isWebAutomationFailureCode(reported.code)) return reported;
  const code = timedOut ? WEB_AUTOMATION_FAILURE_CODES.TIMEOUT : WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH;
  const actual = reported?.actual ?? dispatchMessage(result.payload) ?? result.error ?? (timedOut ? `the wait for ${condition.assert.kind} ran out` : "the condition did not hold");
  return webAutomationFailureRecord(code, { expected: description, actual });
}
function verdict(outcomes, mode) {
  const evaluated = outcomes.filter((outcome) => outcome.evaluated);
  const unevaluated = outcomes.length - evaluated.length;
  if (evaluated.length === 0) {
    return {
      passed: true,
      checkedConditionCount: 0,
      message: outcomes.length === 0 ? "The expected state named no conditions, so nothing was checked." : `None of the ${outcomes.length} expected condition${outcomes.length === 1 ? "" : "s"} could be checked against the page.`
    };
  }
  const rejected = evaluated.filter((outcome) => !outcome.held);
  const passed = mode === "any" ? rejected.length < evaluated.length : rejected.length === 0;
  if (passed) {
    return {
      passed: true,
      checkedConditionCount: evaluated.length,
      message: unevaluated === 0 ? `${evaluated.length} expected condition${evaluated.length === 1 ? "" : "s"} held.` : `${evaluated.length} of ${outcomes.length} expected conditions held; ${unevaluated} could not be checked.`
    };
  }
  const representative = rejected.find((outcome) => outcome.timedOut) ?? rejected[0];
  return {
    passed: false,
    checkedConditionCount: evaluated.length,
    message: `${rejected.length} of ${evaluated.length} checked expected condition${evaluated.length === 1 ? "" : "s"} did not hold: ${representative.description}.`,
    failure: representative.failure ?? webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH, { expected: representative.description })
  };
}
function conditionMetadata(index, context) {
  return {
    source: EXPECTATION_SOURCE,
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    expectationSource: context.source,
    conditionIndex: index,
    ...context.nodeId === void 0 ? {} : { nodeId: context.nodeId },
    ...context.attemptId === void 0 ? {} : { attemptId: context.attemptId },
    ...context.stateRef === void 0 ? {} : { stateRef: context.stateRef }
  };
}
function dispatchMessage(payload) {
  const message = payload?.message;
  return typeof message === "string" && message.length > 0 ? message : void 0;
}
function errorText(error) {
  return error instanceof Error && error.message.length > 0 ? error.message : "the reason was not reported";
}

// domain/src/runtime/llm-evidence/limits.ts
import { AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES } from "fluxiq/automation-studio";
var WEB_LLM_EVIDENCE_BYTE_BUDGETS = Object.freeze({
  ceiling: 12e3,
  exploration: 6e3,
  failure: AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES
});
var WEB_LLM_EVIDENCE_BOUNDS = Object.freeze({
  elements: 40,
  url: 2e3,
  text: 300,
  selector: 500,
  tag: 40,
  role: 80,
  attribute: 200,
  options: 20,
  placement: 80,
  dialogs: 3
});
function serializedBytes(input) {
  return new TextEncoder().encode(JSON.stringify(input)).byteLength;
}
function evidenceByteLimit(input, fallback, ceiling = WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling) {
  const cap = Math.min(ceiling, WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling);
  if (input === void 0) return Math.min(fallback, cap);
  if (!Number.isSafeInteger(input) || Number(input) < 1 || Number(input) > 1e5) throw new Error("maxEvidenceBytes must be a positive bounded integer");
  return Math.min(Number(input), cap);
}

// domain/src/runtime/llm-evidence/location.ts
function safeEvidenceUrl(input) {
  if (typeof input !== "string" || !input || input.length > WEB_LLM_EVIDENCE_BOUNDS.url) throw new Error("web evidence URL must be bounded");
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:" || url.username || url.password) throw new Error("web evidence URL must be an HTTP(S) URL without credentials");
  return url;
}
function evidenceLocation(url) {
  return `${url.origin}${url.pathname}`;
}
function sameOriginHref(input, base) {
  if (typeof input !== "string" || !input || input.length > WEB_LLM_EVIDENCE_BOUNDS.url) return void 0;
  try {
    const url = new URL(input, base);
    return url.origin === base.origin && (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password ? evidenceLocation(url) : void 0;
  } catch {
    return void 0;
  }
}

// domain/src/runtime/llm-evidence/present.ts
function present(fields) {
  const source = fields;
  const written = {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value !== void 0) written[key] = value;
  }
  return written;
}

// domain/src/runtime/llm-evidence/untrusted-json.ts
function isJsonRecord(input) {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}
function jsonRecord(input, name) {
  if (!isJsonRecord(input)) throw new Error(`${name} must be an object`);
  return input;
}
function boundedText2(input, maximum) {
  if (typeof input !== "string") return void 0;
  const value = input.replace(/\s+/gu, " ").trim();
  return value ? value.slice(0, maximum) : void 0;
}
function trueFlag(input) {
  return input === true ? true : void 0;
}
function boundedCount(input, maximum) {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 0 || input > maximum) return void 0;
  return input;
}

// domain/src/runtime/llm-evidence/elements.ts
var FRAME_SELECTOR_PATTERN = /^frame\[(\d{1,6})\]\s*>>\s*(.+)$/u;
var FRAME_ID_ATTRIBUTE = "data-fluxiq-frame-id";
function sanitizedEvidenceElement(raw, context) {
  if (!isJsonRecord(raw)) return void 0;
  const tag = boundedText2(raw.tagName, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const addressed = frameAddressedSelector(raw);
  if (!tag || !addressed || isSensitiveElementDescriptor(raw)) return void 0;
  const attributes = isJsonRecord(raw.attributes) ? raw.attributes : {};
  const role = boundedText2(raw.role, WEB_LLM_EVIDENCE_BOUNDS.role);
  const name = boundedText2(raw.name, WEB_LLM_EVIDENCE_BOUNDS.text);
  const rawText = boundedText2(raw.visibleText ?? raw.text, WEB_LLM_EVIDENCE_BOUNDS.text);
  const text2 = rawText === name ? void 0 : rawText;
  const rawInputType = boundedText2(raw.inputType, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const inputType = rawInputType === "text" ? void 0 : rawInputType;
  const rawControlType = boundedText2(attributes.type, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const controlType = rawControlType === rawInputType || rawControlType === "text" ? void 0 : rawControlType;
  const href = sameOriginHref(raw.href, context.url);
  const options = tag === "select" ? sanitizedOptions(raw.options) : void 0;
  const hasValue = safeFillTag(tag, inputType) && typeof raw.hasValue === "boolean" ? raw.hasValue : void 0;
  const selectedValue = options ? sanitizedSelectedValue(raw.selectedValue, options) : void 0;
  const revealKind = semanticRevealKind(tag, role, attributes);
  const expanded = revealKind === "disclosure" ? semanticExpandedState(attributes) : void 0;
  const placement = elementPlacement(raw.context, { name, text: text2 });
  const focused = context.focusedSelector !== void 0 && context.focusedSelector === addressed.selector ? true : void 0;
  const element = present({
    target: context.target,
    tag,
    frameId: addressed.frameId,
    role: role || void 0,
    name: name || void 0,
    text: text2 || void 0,
    inputType: inputType || void 0,
    controlType: controlType || void 0,
    hasValue,
    selectedValue: selectedValue || void 0,
    href: href || void 0,
    options: options?.length ? options : void 0,
    revealKind,
    expanded,
    focused,
    recent: trueFlag(raw.recentlyInteracted),
    changed: trueFlag(raw.changed),
    form: placement.form,
    landmark: placement.landmark,
    heading: placement.heading,
    item: placement.item,
    cell: placement.cell
  });
  return { element, selector: addressed.selector };
}
function safeFillTag(tag, inputType) {
  return tag === "textarea" || tag === "input" && (!inputType || ["text", "search", "email", "tel", "url", "number"].includes(inputType));
}
function semanticRevealKind(tag, role, attributes) {
  if (role === "tab" || role === "menuitem" || role === "treeitem") return "view";
  if (tag === "summary") return "disclosure";
  const expanded = boundedText2(attributes["aria-expanded"], 10)?.toLowerCase();
  const controls = boundedText2(attributes["aria-controls"], WEB_LLM_EVIDENCE_BOUNDS.text);
  return expanded === "true" || expanded === "false" || controls ? "disclosure" : void 0;
}
function semanticExpandedState(attributes) {
  const expanded = boundedText2(attributes["aria-expanded"], 10)?.toLowerCase();
  return expanded === "true" ? true : expanded === "false" ? false : void 0;
}
function frameAddressedSelector(raw) {
  const rawSelector = boundedText2(raw.selector, WEB_LLM_EVIDENCE_BOUNDS.selector);
  if (!rawSelector) return void 0;
  const match = FRAME_SELECTOR_PATTERN.exec(rawSelector);
  const selector = match ? boundedText2(match[2], WEB_LLM_EVIDENCE_BOUNDS.selector) : rawSelector;
  if (!selector) return void 0;
  const frameId = stampedFrameId(raw) ?? (match ? boundedCount(Number(match[1]), 999999) : void 0);
  return frameId ? { selector, frameId } : { selector };
}
function stampedFrameId(raw) {
  const attributes = isJsonRecord(raw.attributes) ? raw.attributes : {};
  const stamped = boundedText2(attributes[FRAME_ID_ATTRIBUTE], 20);
  return stamped === void 0 ? void 0 : boundedCount(Number(stamped), 999999);
}
function elementPlacement(input, named) {
  const described = isJsonRecord(input) ? input : {};
  const form = boundedText2(described.formId ?? described.formName, WEB_LLM_EVIDENCE_BOUNDS.placement);
  const landmark = boundedText2(described.landmark, WEB_LLM_EVIDENCE_BOUNDS.tag);
  const rawHeading = boundedText2(described.heading, WEB_LLM_EVIDENCE_BOUNDS.placement);
  const heading = rawHeading === named.name || rawHeading === named.text ? void 0 : rawHeading;
  return {
    form: form || void 0,
    landmark: landmark || void 0,
    heading: heading || void 0,
    item: listPlacement(described.listPosition),
    cell: tablePlacement(described.tablePosition)
  };
}
function listPlacement(input) {
  if (!isJsonRecord(input)) return void 0;
  const index = boundedCount(input.index, 1e5);
  const total = boundedCount(input.total, 1e5);
  return index === void 0 || total === void 0 ? void 0 : { index, total };
}
function tablePlacement(input) {
  if (!isJsonRecord(input)) return void 0;
  const row = boundedCount(input.row, 1e5);
  const column = boundedCount(input.column, 1e5);
  if (row === void 0 || column === void 0) return void 0;
  const header = boundedText2(input.columnHeader, WEB_LLM_EVIDENCE_BOUNDS.placement);
  return present({ row, column, header: header || void 0 });
}
function sanitizedOptions(input) {
  if (!Array.isArray(input)) return void 0;
  const result = [];
  for (const raw of input.slice(0, WEB_LLM_EVIDENCE_BOUNDS.options)) {
    if (!isJsonRecord(raw)) continue;
    const value = boundedText2(raw.value, WEB_LLM_EVIDENCE_BOUNDS.attribute);
    const label = boundedText2(raw.label, WEB_LLM_EVIDENCE_BOUNDS.attribute);
    if (value && label) result.push({ value, label });
  }
  return result.length ? result : void 0;
}
function sanitizedSelectedValue(input, options) {
  const value = boundedText2(input, WEB_LLM_EVIDENCE_BOUNDS.attribute);
  return value && options.some((option) => option.value === value) ? value : void 0;
}

// domain/src/runtime/llm-evidence/page-evidence.ts
var READY_STATES = ["loading", "interactive", "complete"];
var ORDINARY_NAVIGATION_TYPE = "navigate";
var MAX_REDIRECTS = 100;
var MAX_BLOCKED_CONTROLS = 1e4;
function webLlmPageContext(snapshot, childFrameIds) {
  const evidence = pageEvidence(snapshot);
  const frame = evidenceFrame(snapshot.frame, childFrameIds);
  const loading = evidenceLoading(pageEvidenceWire(evidence?.loading));
  const navigation = evidenceNavigation(pageEvidenceWire(evidence?.navigation));
  const dialogs = evidenceDialogs(pageEvidenceWire(evidence?.dialogs));
  const blockedBy = evidenceBlocker(pageEvidenceWire(evidence?.overlays));
  const selectedText = boundedText2(snapshot.selectedText, WEB_LLM_EVIDENCE_BOUNDS.text);
  return present({
    frame,
    loading,
    navigation,
    dialogs,
    blockedBy,
    selectedText: selectedText || void 0,
    // The one page-context field this reader does not read. It is the element
    // funnel's number, so `sanitize.ts` supplies it beside the elements it
    // counted. Named here rather than left out, because leaving a field out is
    // exactly what this seam exists to make impossible.
    elementTotal: void 0
  });
}
function evidenceElementTotal(snapshot, carried) {
  const declared = boundedCount(snapshot.elementTotal, 1e7) ?? boundedCount(captureElementTotals(snapshot)?.matched, 1e7);
  const received = Array.isArray(snapshot.interactiveElements) ? snapshot.interactiveElements.length : 0;
  const total = Math.max(declared ?? 0, received);
  return total > carried ? total : void 0;
}
function capturedTruncated(snapshot) {
  if (trueFlag(snapshot.truncated) === true) return true;
  return trueFlag(captureElementTotals(snapshot)?.truncated) === true;
}
function pageEvidence(snapshot) {
  return pageEvidenceWire(snapshot.evidence);
}
function captureElementTotals(snapshot) {
  return pageEvidenceWire(pageEvidence(snapshot)?.elements);
}
function items(input) {
  return Array.isArray(input) ? input : [];
}
function evidenceFrame(input, childFrameIds) {
  const declared = isJsonRecord(input) ? input : void 0;
  const isTop = typeof declared?.isTop === "boolean" ? declared.isTop : void 0;
  if (isTop === void 0 && !childFrameIds.length) return void 0;
  return present({
    isTop: isTop ?? true,
    childFrameIds: childFrameIds.length ? childFrameIds : void 0
  });
}
function evidenceLoading(input) {
  if (!input) return void 0;
  const documentState = boundedText2(input.documentState, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const readyState = documentState && READY_STATES.includes(documentState) ? documentState : void 0;
  const spinner = items(input.indicators).map((indicator) => pageEvidenceWire(indicator)).some((indicator) => indicator?.kind === "spinner");
  const loading = present({
    readyState: readyState && readyState !== "complete" ? readyState : void 0,
    busy: trueFlag(input.busy),
    spinner: spinner ? true : void 0,
    pendingNavigation: trueFlag(input.pendingNavigation)
  });
  return Object.keys(loading).length ? loading : void 0;
}
function evidenceNavigation(input) {
  if (!input) return void 0;
  const type = boundedText2(input.type, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const redirects = boundedCount(input.redirects, MAX_REDIRECTS);
  const navigation = present({
    type: type && type !== ORDINARY_NAVIGATION_TYPE ? type : void 0,
    redirects: redirects || void 0,
    referrer: safeLocation(input.referrer)
  });
  return Object.keys(navigation).length ? navigation : void 0;
}
function safeLocation(input) {
  try {
    return evidenceLocation(safeEvidenceUrl(input));
  } catch {
    return void 0;
  }
}
function evidenceDialogs(input) {
  if (!input) return void 0;
  const dialogs = [];
  for (const item of items(input.open).slice(0, WEB_LLM_EVIDENCE_BOUNDS.dialogs)) {
    const raw = pageEvidenceWire(item);
    if (!raw) continue;
    const role = boundedText2(raw.role, WEB_LLM_EVIDENCE_BOUNDS.role);
    const name = boundedText2(raw.label, WEB_LLM_EVIDENCE_BOUNDS.text);
    const modal = trueFlag(raw.modal);
    if (!role && !name && !modal) continue;
    dialogs.push(present({
      role: role || void 0,
      name: name || void 0,
      modal
    }));
  }
  return dialogs.length ? dialogs : void 0;
}
function evidenceBlocker(input) {
  const blocker = items(input?.blockers).map((item) => pageEvidenceWire(item)).find((item) => item !== void 0);
  if (!blocker) return void 0;
  const role = boundedText2(blocker.role, WEB_LLM_EVIDENCE_BOUNDS.role);
  const name = boundedText2(blocker.label, WEB_LLM_EVIDENCE_BOUNDS.text);
  const blocks = boundedCount(blocker.blocks, MAX_BLOCKED_CONTROLS);
  if (!role && !name && !blocks) return void 0;
  return present({
    role: role || void 0,
    name: name || void 0,
    blocks: blocks || void 0
  });
}

// domain/src/runtime/llm-evidence/sanitize.ts
var WEB_LLM_EVIDENCE_SCHEMA_VERSION = "web-llm-evidence.v2";
function sanitizeWebLlmSnapshot(input, options = {}) {
  return sanitizeWebLlmSnapshotWithBindings(input, options).evidence;
}
function sanitizeWebLlmSnapshotWithBindings(input, options = {}) {
  const snapshot = jsonRecord(input, "web DOM snapshot");
  const url = safeEvidenceUrl(snapshot.url);
  if (options.expectedOrigin !== void 0 && url.origin !== options.expectedOrigin) throw new Error("web DOM snapshot escaped the expected origin");
  const maxEvidenceBytes = budgetFor(options);
  if (!Array.isArray(snapshot.interactiveElements)) throw new Error("web DOM snapshot elements are malformed");
  const focusedSelector = sanitizedEvidenceElement(snapshot.focusedElement, { target: "target.focus", url })?.selector;
  const elements = [];
  const selectors = /* @__PURE__ */ new Map();
  for (const raw of snapshot.interactiveElements) {
    if (elements.length >= WEB_LLM_EVIDENCE_BOUNDS.elements) break;
    const described = sanitizedEvidenceElement(raw, { target: `target.${elements.length + 1}`, url, focusedSelector });
    if (!described) continue;
    elements.push(described.element);
    selectors.set(described.element.target, described.selector);
  }
  const childFrameIds = [...new Set(elements.map((element) => element.frameId).filter((id) => id !== void 0))].sort((left, right) => left - right);
  const elementTotal = evidenceElementTotal(snapshot, elements.length);
  const title = boundedText2(snapshot.title, WEB_LLM_EVIDENCE_BOUNDS.text);
  const captureTruncated = capturedTruncated(snapshot);
  const elementsTruncated = snapshot.interactiveElements.length > WEB_LLM_EVIDENCE_BOUNDS.elements;
  const context = webLlmPageContext(snapshot, childFrameIds);
  const evidence = present({
    schemaVersion: WEB_LLM_EVIDENCE_SCHEMA_VERSION,
    trust: "untrusted-page-evidence",
    location: evidenceLocation(url),
    title: title || void 0,
    // The page context is carried field by field rather than spread, so a
    // packet field renamed or dropped in `page-evidence.ts` fails here instead
    // of quietly leaving the packet.
    frame: context.frame,
    loading: context.loading,
    navigation: context.navigation,
    dialogs: context.dialogs,
    blockedBy: context.blockedBy,
    selectedText: context.selectedText,
    elementTotal,
    elements,
    truncated: captureTruncated || elementsTruncated,
    captureTruncated: captureTruncated ? true : void 0,
    elementsTruncated: elementsTruncated ? true : void 0,
    // Not written here: `trimToBudget` below sets it if and only if a removal
    // was needed. Mentioned so the packet's key set stays exhaustive.
    budgetTruncated: void 0,
    // Nor are these: `markFailedTarget` writes exactly one of them, and only
    // for a packet that is describing a failure. Named for the same reason.
    failedTarget: void 0,
    failedTargetMissing: void 0,
    failedTargetUnknown: void 0
  });
  markFailedTarget(evidence, selectors, options.failedAction);
  trimToBudget(evidence, selectors, maxEvidenceBytes);
  return { evidence, selectors };
}
function markFailedTarget(evidence, selectors, failedAction) {
  if (!failedAction) return;
  if (!failedAction.selector) {
    evidence.failedTargetUnknown = true;
    return;
  }
  const handle = [...selectors.entries()].find(([, selector]) => selector === failedAction.selector)?.[0];
  if (handle === void 0) evidence.failedTargetMissing = true;
  else evidence.failedTarget = handle;
}
function budgetFor(options) {
  return options.budget === "failure" ? evidenceByteLimit(options.maxEvidenceBytes, WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure) : evidenceByteLimit(options.maxEvidenceBytes, WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration);
}
function trimToBudget(evidence, selectors, maxEvidenceBytes) {
  const markBudgetTruncated = () => {
    evidence.truncated = true;
    evidence.budgetTruncated = true;
  };
  const popElement = () => {
    const removed = evidence.elements.pop();
    if (removed) selectors.delete(removed.target);
    if (removed && evidence.failedTarget === removed.target) {
      delete evidence.failedTarget;
      evidence.failedTargetMissing = true;
    }
    markBudgetTruncated();
  };
  const droppable = ["selectedText", "title", "navigation", "loading", "elementTotal", "dialogs", "blockedBy", "frame"];
  while (serializedBytes(evidence) > maxEvidenceBytes) {
    if (evidence.elements.length > 1) {
      popElement();
      continue;
    }
    const field = droppable.shift();
    if (field !== void 0) {
      if (evidence[field] !== void 0) {
        delete evidence[field];
        markBudgetTruncated();
      }
      continue;
    }
    if (evidence.elements.length) {
      popElement();
      continue;
    }
    throw new Error("web DOM snapshot exceeds the evidence byte limit");
  }
}

// domain/src/runtime/llm-evidence/tool-rejection.ts
var WEB_LLM_TOOL_REJECTION_CODES = [
  "invalid_input",
  "cross_origin",
  "no_progress",
  "target_unobserved",
  "target_unsafe",
  "sensitive_value"
];

// domain/src/runtime/llm-evidence/vocabulary.ts
var WEB_LLM_EVIDENCE_TOOL_IDS = ["web.inspect_current_page", "web.navigate_same_origin", "web.reveal_safe"];
var WEB_LLM_INSPECT_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[0];
var WEB_LLM_NAVIGATE_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[1];
var WEB_LLM_REVEAL_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[2];
var WEB_LLM_INSPECT_RESULT_CODE = "web.inspect.succeeded";
var WEB_LLM_ACTION_RESULT_CODE = "web.action.succeeded";
var REJECTION_RESULT_CODE_PREFIX = "web.action.rejected.";
function webLlmToolRejectionResultCode(code) {
  return `${REJECTION_RESULT_CODE_PREFIX}${code}`;
}
var WEB_LLM_EVIDENCE_RESULT_CODES = Object.freeze([
  WEB_LLM_INSPECT_RESULT_CODE,
  WEB_LLM_ACTION_RESULT_CODE,
  ...WEB_LLM_TOOL_REJECTION_CODES.map(webLlmToolRejectionResultCode)
]);

// domain/src/runtime/host-runtime.ts
var WEB_STATE_DIFF_SCHEMA_VERSION = "web-state-diff.v2";
var SNAPSHOT_OUTPUT_ID = "web.dom.capture_snapshot";
var HOST_RUNTIME_SOURCE = "web-automation-host-runtime";
var MAX_DIFF_ELEMENTS = 10;
var WEB_AUTOMATION_NODE_IDS = new Set(WEB_AUTOMATION_ACTION_TYPES.map(webAutomationOutputNodeId));
var WEB_AUTOMATION_OUTPUT_IDS = new Set(WEB_AUTOMATION_ACTION_TYPES);
var POLICY_ACTION_DEFINITION_ID = "builtin.policy.action";
var HOST_RUNTIME_CAPABILITIES = Object.freeze(["state-snapshot", "state-diff", "expectation-evaluation"]);
function createWebAutomationHostRuntime(gateway2) {
  const evaluate = createWebAutomationExpectationEvaluator(gateway2.dispatch);
  let captures = 0;
  return {
    capabilities: HOST_RUNTIME_CAPABILITIES,
    async captureStateSnapshot(input) {
      if (!actsOnPage(input.node)) {
        throw new Error(`Node ${input.node.definitionId} does not act on a page, so no web state was captured.`);
      }
      const result = await gateway2.dispatch({
        outputId: SNAPSHOT_OUTPUT_ID,
        payload: {},
        metadata: {
          source: HOST_RUNTIME_SOURCE,
          domainId: WEB_AUTOMATION_DOMAIN_ID,
          nodeId: input.node.id,
          attemptId: input.attemptId,
          point: input.point
        }
      });
      if (!result.ok) throw new Error(result.error ?? "The web state snapshot was not captured.");
      const summary = sanitizeWebLlmSnapshot(actionSnapshot(result.payload));
      captures += 1;
      const stateSnapshotId = `web.state.${captures}`;
      return { stateSnapshotId, stateRef: `${stateSnapshotId}@${input.attemptId}:${input.point}`, capturedAt: Date.now(), summary };
    },
    inspectStateDiff(input) {
      if (input.before?.summary === void 0 || input.after?.summary === void 0) {
        throw new Error("A web state diff needs a snapshot on both sides, so none was computed.");
      }
      return webAutomationStateDiff(input.before?.summary, input.after?.summary, input.before?.stateRef, input.after?.stateRef);
    },
    expectationEvaluator: (conditions, mode, timeoutMs, context) => evaluate(conditions, mode, timeoutMs, context)
  };
}
function webAutomationStateDiff(before, after, beforeStateRef, afterStateRef) {
  const beforeElements = evidenceElements(before);
  const afterElements = evidenceElements(after);
  const beforeKeys = new Set(beforeElements.map(elementKey));
  const afterKeys = new Set(afterElements.map(elementKey));
  const added = afterElements.filter((element) => !beforeKeys.has(elementKey(element)));
  const removed = beforeElements.filter((element) => !afterKeys.has(elementKey(element)));
  const beforeLocation = evidenceText(before, "location");
  const afterLocation = evidenceText(after, "location");
  return {
    schemaVersion: WEB_STATE_DIFF_SCHEMA_VERSION,
    ...beforeStateRef === void 0 ? {} : { beforeStateRef },
    ...afterStateRef === void 0 ? {} : { afterStateRef },
    ...beforeLocation === void 0 ? {} : { beforeLocation },
    ...afterLocation === void 0 ? {} : { afterLocation },
    locationChanged: beforeLocation !== void 0 && afterLocation !== void 0 && beforeLocation !== afterLocation,
    titleChanged: evidenceText(before, "title") !== evidenceText(after, "title"),
    beforeElementCount: beforeElements.length,
    afterElementCount: afterElements.length,
    addedElementCount: added.length,
    removedElementCount: removed.length,
    addedElements: added.slice(0, MAX_DIFF_ELEMENTS),
    removedElements: removed.slice(0, MAX_DIFF_ELEMENTS)
  };
}
function actionSnapshot(payload) {
  const action = payload?.result;
  return isRecord(action) ? action.snapshot : void 0;
}
function actsOnPage(node) {
  if (WEB_AUTOMATION_NODE_IDS.has(node.definitionId)) return true;
  const outputId = node.parameterValues?.outputId;
  return node.definitionId === POLICY_ACTION_DEFINITION_ID && typeof outputId === "string" && WEB_AUTOMATION_OUTPUT_IDS.has(outputId);
}
function evidenceElements(summary) {
  const elements = summary?.elements;
  if (!Array.isArray(elements)) return [];
  const described = [];
  for (const element of elements) {
    if (!isRecord(element) || typeof element.tag !== "string" || !element.tag) continue;
    described.push({
      tag: element.tag,
      ...typeof element.role === "string" ? { role: element.role } : {},
      ...typeof element.name === "string" ? { name: element.name } : {},
      ...typeof element.text === "string" ? { text: element.text } : {},
      ...typeof element.form === "string" ? { form: element.form } : {}
    });
  }
  return described;
}
function elementKey(element) {
  return JSON.stringify([element.tag, element.role, element.name, element.text, element.form]);
}
function evidenceText(summary, field) {
  const value = summary?.[field];
  return typeof value === "string" ? value : void 0;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// domain/src/runtime/tests/host-runtime.test.ts
var CLICK_NODE_ID = webAutomationOutputNodeId("web.dom.click");
var POLICY_ACTION_ID = "builtin.policy.action";
function pageSnapshot(url, selectors, extra = {}) {
  return {
    url,
    title: "Checkout",
    ...extra,
    interactiveElements: selectors.map((selector) => ({ tagName: "button", selector, name: selector.replace(/[#.]/gu, "") }))
  };
}
function gateway(answers) {
  const calls = [];
  return {
    calls,
    gateway: {
      dispatch: async (request) => {
        calls.push({ outputId: request.outputId, metadata: request.metadata });
        const answer = answers[calls.length - 1] ?? { ok: false, error: "no answer" };
        return { outputId: request.outputId, ok: false, ...answer };
      }
    }
  };
}
function captureInput(definitionId, point = "before_action", parameterValues = {}) {
  return { node: { id: "node.1", definitionId, parameterValues }, attemptId: "node.1.attempt.1", inputs: {}, point };
}
test("a web attempt gets a bounded, sanitized state ref sourced from web.dom.capture_snapshot", async () => {
  const snapshot = pageSnapshot("https://shop.test/cart?token=leaked-token", ["#pay"]);
  snapshot.interactiveElements.push({ tagName: "input", selector: "#card", inputType: "text", value: "4111111111111111" });
  const { gateway: seam, calls } = gateway([{ ok: true, status: "succeeded", payload: { status: "succeeded", result: { snapshot } } }]);
  const boundary = createWebAutomationHostRuntime(seam);
  const ref = await boundary.captureStateSnapshot(captureInput(CLICK_NODE_ID));
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.outputId, "web.dom.capture_snapshot");
  assert.equal(calls[0]?.metadata.point, "before_action");
  assert.equal(calls[0]?.metadata.attemptId, "node.1.attempt.1");
  assert.equal(ref.stateSnapshotId, "web.state.1");
  assert.equal(ref.stateRef, "web.state.1@node.1.attempt.1:before_action");
  assert.equal(typeof ref.capturedAt, "number");
  assert.equal(ref.summary?.schemaVersion, "web-llm-evidence.v2");
  assert.equal(ref.summary?.location, "https://shop.test/cart");
  assert.doesNotMatch(JSON.stringify(ref.summary), /leaked-token|4111111111111111/u);
});
test("a recorded action, Core's policy node naming web.dom.click, gets a state ref from web.dom.capture_snapshot", async () => {
  const payload = { status: "succeeded", result: { snapshot: pageSnapshot("https://shop.test/cart", ["#pay"]) } };
  const { gateway: seam, calls } = gateway([{ ok: true, status: "succeeded", payload }]);
  const boundary = createWebAutomationHostRuntime(seam);
  const ref = await boundary.captureStateSnapshot(captureInput(POLICY_ACTION_ID, "before_action", { outputId: "web.dom.click", selector: "#pay" }));
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.outputId, "web.dom.capture_snapshot");
  assert.equal(ref.stateRef, "web.state.1@node.1.attempt.1:before_action");
  assert.equal(ref.summary?.schemaVersion, "web-llm-evidence.v2");
  assert.equal(typeof ref.summary?.truncated, "boolean");
});
test("a policy node naming no web output, or a web output on another node, is declined without a gateway round trip", async () => {
  const payload = { status: "succeeded", result: { snapshot: pageSnapshot("https://shop.test/cart", ["#pay"]) } };
  const { gateway: seam, calls } = gateway(Array.from({ length: 6 }, () => ({ ok: true, status: "succeeded", payload })));
  const boundary = createWebAutomationHostRuntime(seam);
  const declined = [
    captureInput(POLICY_ACTION_ID, "before_action", { outputId: "email.send" }),
    // The web output node's id is not an output id.
    captureInput(POLICY_ACTION_ID, "before_action", { outputId: CLICK_NODE_ID }),
    captureInput(POLICY_ACTION_ID, "before_action", { outputId: 7 }),
    captureInput(POLICY_ACTION_ID),
    { ...captureInput(POLICY_ACTION_ID), node: { id: "node.1", definitionId: POLICY_ACTION_ID } },
    captureInput("builtin.code.run", "before_action", { outputId: "web.dom.click" })
  ];
  for (const input of declined) {
    await assert.rejects(async () => boundary.captureStateSnapshot(input), /does not act on a page/u);
  }
  assert.equal(calls.length, 0);
});
test("a diff with a side missing is declined, so no diff claims every element appeared or left", async () => {
  const boundary = createWebAutomationHostRuntime(gateway([]).gateway);
  const summary = { schemaVersion: "web-llm-evidence.v2", location: "https://shop.test/cart", elements: [{ selector: "#pay" }] };
  const before = { stateSnapshotId: "web.state.1", stateRef: "web.state.1@a:before_action", capturedAt: 1, summary };
  const after = { stateSnapshotId: "web.state.2", stateRef: "web.state.2@a:after_action", capturedAt: 2, summary };
  const diff = async (sides) => boundary.inspectStateDiff({ ...sides, node: { id: "node.1", definitionId: POLICY_ACTION_ID }, attemptId: "a" });
  const oneSided = [
    { before },
    { after },
    // A ref that came back without a summary is a missing snapshot too.
    { before, after: { stateSnapshotId: after.stateSnapshotId, stateRef: after.stateRef, capturedAt: after.capturedAt } }
  ];
  for (const sides of oneSided) {
    await assert.rejects(() => diff(sides), /snapshot on both sides/u);
  }
  const both = await diff({ before, after });
  assert.equal(both.schemaVersion, WEB_STATE_DIFF_SCHEMA_VERSION);
  assert.equal(both.removedElementCount, 0);
});
test("each capture gets its own id, so a retry does not reuse the previous attempt's ref", async () => {
  const payload = { status: "succeeded", result: { snapshot: pageSnapshot("https://shop.test/cart", ["#pay"]) } };
  const { gateway: seam } = gateway([{ ok: true, status: "succeeded", payload }, { ok: true, status: "succeeded", payload }]);
  const boundary = createWebAutomationHostRuntime(seam);
  const first = await boundary.captureStateSnapshot(captureInput(CLICK_NODE_ID));
  const second = await boundary.captureStateSnapshot(captureInput(CLICK_NODE_ID, "after_action"));
  assert.notEqual(first.stateSnapshotId, second.stateSnapshotId);
  assert.notEqual(first.stateRef, second.stateRef);
});
test("a node that never touches the page is declined without a gateway round trip", async () => {
  const { gateway: seam, calls } = gateway([]);
  const boundary = createWebAutomationHostRuntime(seam);
  await assert.rejects(
    () => Promise.resolve(boundary.captureStateSnapshot(captureInput("builtin.llm.generate"))),
    /does not act on a page/u
  );
  assert.equal(calls.length, 0);
});
test("a snapshot that never arrived produces no ref rather than a ref pointing at nothing", async () => {
  const missingClient = createWebAutomationHostRuntime(gateway([{ ok: false, error: "A single paired web-automation client must be selected." }]).gateway);
  await assert.rejects(() => Promise.resolve(missingClient.captureStateSnapshot(captureInput(CLICK_NODE_ID))), /paired web-automation client/u);
  const emptyAnswer = createWebAutomationHostRuntime(gateway([{ ok: true, status: "succeeded", payload: { status: "succeeded" } }]).gateway);
  await assert.rejects(() => Promise.resolve(emptyAnswer.captureStateSnapshot(captureInput(CLICK_NODE_ID))));
});
test("the diff reports the move, the counts, and which elements came and went, and stays inside the schema", () => {
  const before = { schemaVersion: "web-llm-evidence.v2", location: "https://shop.test/cart", title: "Cart", elements: [{ target: "target.1", tag: "button", name: "Pay" }, { target: "target.2", tag: "a", name: "Edit" }] };
  const after = { schemaVersion: "web-llm-evidence.v2", location: "https://shop.test/thanks", title: "Thanks", elements: [{ target: "target.1", tag: "a", name: "Edit" }, { target: "target.2", tag: "a", name: "Receipt" }] };
  const diff = webAutomationStateDiff(before, after, "web.state.1@a:before_action", "web.state.2@a:after_action");
  assert.deepEqual(diff, {
    schemaVersion: WEB_STATE_DIFF_SCHEMA_VERSION,
    beforeStateRef: "web.state.1@a:before_action",
    afterStateRef: "web.state.2@a:after_action",
    beforeLocation: "https://shop.test/cart",
    afterLocation: "https://shop.test/thanks",
    locationChanged: true,
    titleChanged: true,
    beforeElementCount: 2,
    afterElementCount: 2,
    addedElementCount: 1,
    removedElementCount: 1,
    addedElements: [{ tag: "a", name: "Receipt" }],
    removedElements: [{ tag: "button", name: "Pay" }]
  });
});
test("the diff never lists more than the bound, and its counts stay exact", () => {
  const many = { elements: Array.from({ length: 30 }, (_, index) => ({ target: `target.${index + 1}`, tag: "li", name: `Item ${index}` })) };
  const grown = webAutomationStateDiff({ elements: [] }, many);
  assert.equal(grown.addedElementCount, 30);
  assert.equal(grown.addedElements.length, 10);
  assert.equal(grown.locationChanged, false);
  assert.equal(grown.beforeElementCount, 0);
});
test("the boundary declares what it can answer, including the expectation seam", () => {
  const boundary = createWebAutomationHostRuntime(gateway([]).gateway);
  assert.deepEqual([...boundary.capabilities], ["state-snapshot", "state-diff", "expectation-evaluation"]);
  assert.equal(typeof boundary.expectationEvaluator, "function");
  assert.equal(typeof boundary.inspectStateDiff, "function");
});
test("the boundary's expectation evaluator judges conditions through the same gateway", async () => {
  const { gateway: seam, calls } = gateway([{ ok: false, status: "failed", payload: { status: "failed", message: "Assertion did not hold: exists." } }]);
  const boundary = createWebAutomationHostRuntime(seam);
  const evaluation = await boundary.expectationEvaluator([{ kind: "exists", selector: "#receipt" }], "all", 0, { source: "transition_comparison" });
  assert.equal(calls[0]?.outputId, "web.dom.assert");
  assert.equal(evaluation.passed, false);
  assert.equal(evaluation.checkedConditionCount, 1);
  assert.equal(evaluation.failure?.code, "web.validation.state_mismatch");
});
