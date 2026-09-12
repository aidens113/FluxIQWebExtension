// src/runtime/tests/reusable-evidence.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// src/constants.ts
var WEB_AUTOMATION_DOMAIN_ID = "web-automation";

// src/actions/types.ts
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

// src/io/input-model.ts
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

// src/runtime/llm-evidence.ts
var WEB_LLM_EVIDENCE_SCHEMA_VERSION = "web-llm-evidence.v1";

// src/runtime/reusable-evidence.ts
import { createHash } from "node:crypto";
var WEB_REUSABLE_EVIDENCE_FINGERPRINT_SCHEMA_VERSION = "web-reusable-evidence-fingerprint.v1";
var WEB_REUSABLE_EVIDENCE_PROJECTION_SCHEMA_VERSION = "web-reusable-evidence-projection.v1";
var WEB_REUSABLE_EVIDENCE_SANITIZER_VERSION = "web-reusable-evidence-sanitizer.v1";
var WEB_REUSABLE_EVIDENCE_CAPABILITY_SCHEMA_VERSION = "web-client-capabilities.v1";
var WEB_REUSABLE_EVIDENCE_MAX_ELEMENTS = 40;
var WEB_REUSABLE_EVIDENCE_MAX_ACTIONS = 20;
var WEB_REUSABLE_EVIDENCE_MAX_CAPABILITIES = 20;
var WEB_REUSABLE_EVIDENCE_MAX_PROJECTION_ITEMS = 24;
var WEB_REUSABLE_EVIDENCE_MAX_PROJECTION_BYTES = 4096;
function produceWebReusableEvidence(input, options = {}) {
  if (input.evidence.schemaVersion !== WEB_LLM_EVIDENCE_SCHEMA_VERSION || input.evidence.trust !== "untrusted-page-evidence" || !Array.isArray(input.evidence.elements)) {
    throw new Error("Reusable web evidence requires the current sanitized evidence schema");
  }
  enforceSourceItemLimit(input.evidence.elements.length, WEB_REUSABLE_EVIDENCE_MAX_ELEMENTS, "element");
  enforceSourceItemLimit(input.actions?.length ?? 0, WEB_REUSABLE_EVIDENCE_MAX_ACTIONS, "action");
  enforceSourceItemLimit(input.clientCapabilities?.length ?? 0, WEB_REUSABLE_EVIDENCE_MAX_CAPABILITIES, "capability");
  const location = safeLocation(input.evidence.location);
  const elements = normalizedElements(input.evidence.elements, location);
  const actions = normalizedActions(input.actions ?? []);
  const capabilities = normalizedCapabilities(input.clientCapabilities ?? []);
  const structuralDigest = digest({ location, elements });
  const capabilityDigest = digest({ schemaVersion: WEB_REUSABLE_EVIDENCE_CAPABILITY_SCHEMA_VERSION, capabilities });
  const fingerprintBase = {
    schemaVersion: WEB_REUSABLE_EVIDENCE_FINGERPRINT_SCHEMA_VERSION,
    sanitizerVersion: WEB_REUSABLE_EVIDENCE_SANITIZER_VERSION,
    evidenceSchemaVersion: boundedTag(input.evidence.schemaVersion, "evidence schema version"),
    capabilitySchemaVersion: WEB_REUSABLE_EVIDENCE_CAPABILITY_SCHEMA_VERSION,
    location,
    structuralDigest,
    capabilityDigest,
    compatibilityTags: [
      `web.location:${digest(location)}`,
      `web.structure:${structuralDigest}`,
      `web.capabilities:${capabilityDigest}`,
      `web.sanitizer:${WEB_REUSABLE_EVIDENCE_SANITIZER_VERSION}`
    ]
  };
  const fingerprint = { ...fingerprintBase, digest: digest(fingerprintBase) };
  const candidates = [
    ...elements.map(promptElementFact),
    ...actions.map((action) => ({ kind: "action", ...action }))
  ];
  return {
    fingerprint,
    promptProjection: boundedProjection(fingerprint, candidates, options)
  };
}
function normalizedElements(input, location) {
  const unique = /* @__PURE__ */ new Map();
  for (const element of input) {
    const tag = boundedToken(element.tag, 40);
    const selector = boundedText(element.selector, 500);
    if (!tag || !selector || sensitiveControl(element)) continue;
    const normalized = compact2({
      tag: tag.toLowerCase(),
      selectorDigest: digest(selector),
      role: boundedToken(element.role, 80)?.toLowerCase(),
      name: boundedText(element.name, 160),
      inputType: boundedToken(element.inputType, 40)?.toLowerCase(),
      controlType: boundedToken(element.controlType, 40)?.toLowerCase(),
      optionCount: Array.isArray(element.options) ? Math.min(element.options.length, 20) : void 0,
      sameOriginLink: sameOriginHref(element.href, location.origin) ? true : void 0
    });
    unique.set(canonicalJson(normalized), normalized);
  }
  return [...unique.values()].sort(compareCanonical);
}
function normalizedActions(input) {
  const unique = /* @__PURE__ */ new Map();
  for (const action of input) {
    const definitionId = boundedTag(action.definitionId, "action definition ID");
    if (!definitionId.startsWith("web.")) continue;
    if (action.status !== "succeeded" && action.status !== "failed") continue;
    if (action.route !== void 0 && action.route !== "success" && action.route !== "failed") continue;
    const normalized = compact2({ definitionId, status: action.status, route: action.route });
    unique.set(canonicalJson(normalized), normalized);
  }
  return [...unique.values()].sort(compareCanonical);
}
function normalizedCapabilities(input) {
  const values = input.map((value) => boundedTag(value, "client capability"));
  return [...new Set(values)].sort();
}
function promptElementFact(element) {
  const { selectorDigest: _selectorDigest, ...fact } = element;
  return { kind: "element", ...fact };
}
function boundedProjection(fingerprint, candidates, options) {
  const maxBytes = boundedLimit(options.maxProjectionBytes, WEB_REUSABLE_EVIDENCE_MAX_PROJECTION_BYTES, "projection byte limit");
  const maxItems = boundedLimit(options.maxProjectionItems, WEB_REUSABLE_EVIDENCE_MAX_PROJECTION_ITEMS, "projection item limit");
  const facts = candidates.slice(0, maxItems);
  let truncated = facts.length !== candidates.length;
  for (; ; ) {
    const base = {
      schemaVersion: WEB_REUSABLE_EVIDENCE_PROJECTION_SCHEMA_VERSION,
      sanitizerVersion: WEB_REUSABLE_EVIDENCE_SANITIZER_VERSION,
      compatibilityDigest: fingerprint.digest,
      location: fingerprint.location,
      facts,
      truncated
    };
    const withDigest = { ...base, digest: digest(base) };
    const byteCount = stableByteCount(withDigest);
    const result = { ...withDigest, byteCount };
    if (serializedBytes(result) <= maxBytes) return result;
    if (!facts.length) throw new Error("Web reusable-evidence projection envelope exceeds the byte limit");
    facts.pop();
    truncated = true;
  }
}
function stableByteCount(input) {
  let value = 0;
  for (let index = 0; index < 8; index += 1) {
    const next = serializedBytes({ ...input, byteCount: value });
    if (next === value) return value;
    value = next;
  }
  return value;
}
function safeLocation(input) {
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:" || url.username || url.password) throw new Error("Reusable web evidence requires an HTTP(S) location without credentials");
  return { origin: url.origin, path: url.pathname };
}
function sameOriginHref(input, origin) {
  if (typeof input !== "string" || !input) return false;
  try {
    const url = new URL(input, origin);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password && url.origin === origin;
  } catch {
    return false;
  }
}
function sensitiveControl(element) {
  const types = [element.inputType, element.controlType].filter((value) => typeof value === "string").map((value) => value.toLowerCase());
  return types.some((value) => value === "password" || value === "hidden" || value === "file" || value === "credit-card" || value === "one-time-code");
}
function boundedLimit(input, hardMaximum, label) {
  if (input === void 0) return hardMaximum;
  if (!Number.isSafeInteger(input) || input < 1 || input > hardMaximum) throw new Error(`${label} must be between 1 and ${hardMaximum}`);
  return input;
}
function enforceSourceItemLimit(actual, maximum, label) {
  if (actual > maximum) throw new Error(`Reusable web evidence ${label} count exceeds ${maximum}`);
}
function boundedTag(input, label) {
  const value = boundedText(input, 160);
  if (!value || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u.test(value)) throw new Error(`${label} is malformed`);
  return value;
}
function boundedToken(input, maximum) {
  const value = boundedText(input, maximum);
  return value && /^[A-Za-z0-9_.:-]+$/u.test(value) ? value : void 0;
}
function boundedText(input, maximum) {
  if (typeof input !== "string") return void 0;
  const value = input.replace(/\s+/gu, " ").trim();
  return value ? value.slice(0, maximum) : void 0;
}
function compact2(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== void 0));
}
function compareCanonical(left, right) {
  return canonicalJson(left).localeCompare(canonicalJson(right));
}
function digest(input) {
  return createHash("sha256").update(canonicalJson(input)).digest("hex");
}
function serializedBytes(input) {
  return Buffer.byteLength(JSON.stringify(input), "utf8");
}
function canonicalJson(input) {
  if (Array.isArray(input)) return `[${input.map(canonicalJson).join(",")}]`;
  if (input && typeof input === "object") return `{${Object.entries(input).filter(([, value]) => value !== void 0).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${JSON.stringify(key)}:${canonicalJson(value)}`).join(",")}}`;
  return JSON.stringify(input);
}

// src/runtime/tests/reusable-evidence.test.ts
var evidence = (overrides = {}) => ({
  schemaVersion: "web-llm-evidence.v1",
  trust: "untrusted-page-evidence",
  location: "https://example.test/form?token=private#secret",
  elements: [
    { target: "target.1", tag: "textarea", selector: '[data-testid="instruction-name-adapted"]', name: "Name", hasValue: true },
    { target: "target.2", tag: "select", selector: "#plan", name: "Plan", selectedValue: "enterprise", options: [{ value: "starter", label: "Starter" }, { value: "enterprise", label: "Private enterprise choice" }] },
    { target: "target.3", tag: "input", selector: "#password", inputType: "password", name: "Account password" },
    { target: "target.4", tag: "a", selector: "#next", name: "Next", href: "https://example.test/next?ticket=private" },
    { target: "target.5", tag: "a", selector: "#away", name: "Away", href: "https://outside.test/path?cross=private" }
  ],
  truncated: false,
  ...overrides
});
test("produces deterministic versioned compatibility and a non-executable bounded projection", () => {
  const input = {
    evidence: evidence(),
    actions: [{ definitionId: "web.output.dom-type", status: "failed", route: "failed" }],
    clientCapabilities: ["web.snapshots.v1", "web.actions.v1"]
  };
  const first = produceWebReusableEvidence(input);
  const reordered = produceWebReusableEvidence({
    ...input,
    evidence: evidence({ elements: [...input.evidence.elements].reverse(), title: "Irrelevant title noise" }),
    clientCapabilities: [...input.clientCapabilities].reverse()
  });
  assert.deepEqual(first, reordered);
  assert.match(first.fingerprint.digest, /^[a-f0-9]{64}$/u);
  assert.equal(first.promptProjection.byteCount, Buffer.byteLength(JSON.stringify(first.promptProjection), "utf8"));
  assert.ok(first.promptProjection.byteCount <= WEB_REUSABLE_EVIDENCE_MAX_PROJECTION_BYTES);
  const serialized = JSON.stringify(first);
  assert.doesNotMatch(serialized, /private|enterprise|password|token|ticket|target\.1|instruction-name-adapted|#plan|#next/iu);
  assert.deepEqual(first.fingerprint.location, { origin: "https://example.test", path: "/form" });
  assert.ok(first.promptProjection.facts.some((fact) => fact.kind === "element" && fact.tag === "textarea" && fact.name === "Name"));
  assert.equal(first.promptProjection.facts.filter((fact) => fact.kind === "element" && fact.sameOriginLink).length, 1);
});
test("changes compatibility for relevant page, control, and capability revisions", () => {
  const baseline = produceWebReusableEvidence({ evidence: evidence(), clientCapabilities: ["web.actions.v1"] });
  const changedPath = produceWebReusableEvidence({ evidence: evidence({ location: "https://example.test/other" }), clientCapabilities: ["web.actions.v1"] });
  const changedControl = produceWebReusableEvidence({ evidence: evidence({ elements: [{ target: "noise", tag: "textarea", selector: "#renamed", name: "Name" }] }), clientCapabilities: ["web.actions.v1"] });
  const changedCapability = produceWebReusableEvidence({ evidence: evidence(), clientCapabilities: ["web.actions.v2"] });
  for (const candidate of [changedPath, changedControl, changedCapability]) assert.notEqual(candidate.fingerprint.digest, baseline.fingerprint.digest);
});
test("keeps opposite run outcomes compatible while preserving them in prompt content", () => {
  const common = { evidence: evidence(), clientCapabilities: ["web.actions.v1"] };
  const succeeded = produceWebReusableEvidence({ ...common, actions: [{ definitionId: "web.output.dom-type", status: "succeeded", route: "success" }] });
  const failed = produceWebReusableEvidence({ ...common, actions: [{ definitionId: "web.output.dom-type", status: "failed", route: "failed" }] });
  assert.deepEqual(succeeded.fingerprint, failed.fingerprint);
  assert.notEqual(succeeded.promptProjection.digest, failed.promptProjection.digest);
  assert.notDeepEqual(succeeded.promptProjection.facts, failed.promptProjection.facts);
  assert.ok(succeeded.promptProjection.facts.some((fact) => fact.kind === "action" && fact.status === "succeeded"));
  assert.ok(failed.promptProjection.facts.some((fact) => fact.kind === "action" && fact.status === "failed"));
});
test("enforces exact item and byte bounds by deterministic trimming", () => {
  const many = Array.from({ length: 40 }, (_, index) => ({ target: `target.${index + 1}`, tag: "button", selector: `[data-id="${index}"]`, name: `Action ${index} ${"x".repeat(100)}` }));
  const first = produceWebReusableEvidence({ evidence: evidence({ elements: many }) }, { maxProjectionItems: 7, maxProjectionBytes: 900 });
  const second = produceWebReusableEvidence({ evidence: evidence({ elements: [...many].reverse() }) }, { maxProjectionItems: 7, maxProjectionBytes: 900 });
  assert.deepEqual(first, second);
  assert.equal(first.promptProjection.truncated, true);
  assert.ok(first.promptProjection.facts.length <= 7);
  assert.ok(first.promptProjection.byteCount <= 900);
  assert.equal(first.promptProjection.byteCount, Buffer.byteLength(JSON.stringify(first.promptProjection), "utf8"));
  assert.throws(() => produceWebReusableEvidence({ evidence: evidence() }, { maxProjectionBytes: 10 }), /envelope exceeds/u);
  assert.throws(() => produceWebReusableEvidence({ evidence: evidence() }, { maxProjectionBytes: WEB_REUSABLE_EVIDENCE_MAX_PROJECTION_BYTES + 1 }), /between 1 and/u);
  assert.throws(() => produceWebReusableEvidence({ evidence: evidence({ elements: [...many, many[0]] }) }), /element count exceeds 40/u);
  assert.throws(() => produceWebReusableEvidence({ evidence: evidence(), actions: Array.from({ length: 21 }, () => ({ definitionId: "web.output.dom-click", status: "failed" })) }), /action count exceeds 20/u);
  assert.throws(() => produceWebReusableEvidence({ evidence: evidence(), clientCapabilities: Array.from({ length: 21 }, (_, index) => `web.capability.${index}`) }), /capability count exceeds 20/u);
});
test("rejects credentialed and non-http locations", () => {
  assert.throws(() => produceWebReusableEvidence({ evidence: evidence({ location: "https://user:secret@example.test/form" }) }), /without credentials/u);
  assert.throws(() => produceWebReusableEvidence({ evidence: evidence({ location: "file:///private/form" }) }), /HTTP\(S\)/u);
  assert.throws(() => produceWebReusableEvidence({ evidence: evidence({ schemaVersion: "web-llm-evidence.v0" }) }), /current sanitized evidence schema/u);
});
