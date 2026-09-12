// src/runtime/tests/reusable-evidence-coordinator.test.ts
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
function produceWebReusableEvidence(input2, options = {}) {
  if (input2.evidence.schemaVersion !== WEB_LLM_EVIDENCE_SCHEMA_VERSION || input2.evidence.trust !== "untrusted-page-evidence" || !Array.isArray(input2.evidence.elements)) {
    throw new Error("Reusable web evidence requires the current sanitized evidence schema");
  }
  enforceSourceItemLimit(input2.evidence.elements.length, WEB_REUSABLE_EVIDENCE_MAX_ELEMENTS, "element");
  enforceSourceItemLimit(input2.actions?.length ?? 0, WEB_REUSABLE_EVIDENCE_MAX_ACTIONS, "action");
  enforceSourceItemLimit(input2.clientCapabilities?.length ?? 0, WEB_REUSABLE_EVIDENCE_MAX_CAPABILITIES, "capability");
  const location = safeLocation(input2.evidence.location);
  const elements = normalizedElements(input2.evidence.elements, location);
  const actions = normalizedActions(input2.actions ?? []);
  const capabilities = normalizedCapabilities(input2.clientCapabilities ?? []);
  const structuralDigest = digest({ location, elements });
  const capabilityDigest = digest({ schemaVersion: WEB_REUSABLE_EVIDENCE_CAPABILITY_SCHEMA_VERSION, capabilities });
  const fingerprintBase = {
    schemaVersion: WEB_REUSABLE_EVIDENCE_FINGERPRINT_SCHEMA_VERSION,
    sanitizerVersion: WEB_REUSABLE_EVIDENCE_SANITIZER_VERSION,
    evidenceSchemaVersion: boundedTag(input2.evidence.schemaVersion, "evidence schema version"),
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
function normalizedElements(input2, location) {
  const unique = /* @__PURE__ */ new Map();
  for (const element of input2) {
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
function normalizedActions(input2) {
  const unique = /* @__PURE__ */ new Map();
  for (const action of input2) {
    const definitionId = boundedTag(action.definitionId, "action definition ID");
    if (!definitionId.startsWith("web.")) continue;
    if (action.status !== "succeeded" && action.status !== "failed") continue;
    if (action.route !== void 0 && action.route !== "success" && action.route !== "failed") continue;
    const normalized = compact2({ definitionId, status: action.status, route: action.route });
    unique.set(canonicalJson(normalized), normalized);
  }
  return [...unique.values()].sort(compareCanonical);
}
function normalizedCapabilities(input2) {
  const values = input2.map((value) => boundedTag(value, "client capability"));
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
function stableByteCount(input2) {
  let value = 0;
  for (let index = 0; index < 8; index += 1) {
    const next = serializedBytes({ ...input2, byteCount: value });
    if (next === value) return value;
    value = next;
  }
  return value;
}
function safeLocation(input2) {
  const url = new URL(input2);
  if (url.protocol !== "http:" && url.protocol !== "https:" || url.username || url.password) throw new Error("Reusable web evidence requires an HTTP(S) location without credentials");
  return { origin: url.origin, path: url.pathname };
}
function sameOriginHref(input2, origin) {
  if (typeof input2 !== "string" || !input2) return false;
  try {
    const url = new URL(input2, origin);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password && url.origin === origin;
  } catch {
    return false;
  }
}
function sensitiveControl(element) {
  const types = [element.inputType, element.controlType].filter((value) => typeof value === "string").map((value) => value.toLowerCase());
  return types.some((value) => value === "password" || value === "hidden" || value === "file" || value === "credit-card" || value === "one-time-code");
}
function boundedLimit(input2, hardMaximum, label) {
  if (input2 === void 0) return hardMaximum;
  if (!Number.isSafeInteger(input2) || input2 < 1 || input2 > hardMaximum) throw new Error(`${label} must be between 1 and ${hardMaximum}`);
  return input2;
}
function enforceSourceItemLimit(actual, maximum, label) {
  if (actual > maximum) throw new Error(`Reusable web evidence ${label} count exceeds ${maximum}`);
}
function boundedTag(input2, label) {
  const value = boundedText(input2, 160);
  if (!value || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u.test(value)) throw new Error(`${label} is malformed`);
  return value;
}
function boundedToken(input2, maximum) {
  const value = boundedText(input2, maximum);
  return value && /^[A-Za-z0-9_.:-]+$/u.test(value) ? value : void 0;
}
function boundedText(input2, maximum) {
  if (typeof input2 !== "string") return void 0;
  const value = input2.replace(/\s+/gu, " ").trim();
  return value ? value.slice(0, maximum) : void 0;
}
function compact2(input2) {
  return Object.fromEntries(Object.entries(input2).filter(([, value]) => value !== void 0));
}
function compareCanonical(left, right) {
  return canonicalJson(left).localeCompare(canonicalJson(right));
}
function digest(input2) {
  return createHash("sha256").update(canonicalJson(input2)).digest("hex");
}
function serializedBytes(input2) {
  return Buffer.byteLength(JSON.stringify(input2), "utf8");
}
function canonicalJson(input2) {
  if (Array.isArray(input2)) return `[${input2.map(canonicalJson).join(",")}]`;
  if (input2 && typeof input2 === "object") return `{${Object.entries(input2).filter(([, value]) => value !== void 0).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${JSON.stringify(key)}:${canonicalJson(value)}`).join(",")}}`;
  return JSON.stringify(input2);
}

// src/runtime/reusable-evidence-coordinator.ts
function mapCompletedWebReusableEvidenceToPutRequest(input2) {
  if (input2.completionStatus !== "completed") throw new Error("Reusable web evidence can be written only after completion");
  const projectId = identifier(input2.projectId, "project");
  const flowId = identifier(input2.flowId, "Flow");
  const subflowId = input2.subflowId === void 0 ? void 0 : identifier(input2.subflowId, "Subflow");
  const recordId = input2.recordId === void 0 ? void 0 : identifier(input2.recordId, "record");
  const sourceRunIds = identifiers(input2.sourceRunIds ?? [], "source run");
  const sourceAdaptationIds = identifiers(input2.sourceAdaptationIds ?? [], "source adaptation");
  if (!sourceRunIds.length && !sourceAdaptationIds.length) throw new Error("Reusable web evidence requires explicit source provenance");
  if (!Number.isSafeInteger(input2.completedAt) || input2.completedAt < 0) throw new Error("Reusable web evidence completion time is invalid");
  if (input2.ttlMs !== void 0 && (!Number.isSafeInteger(input2.ttlMs) || input2.ttlMs < 1)) throw new Error("Reusable web evidence TTL is invalid");
  const produced = produceWebReusableEvidence({
    evidence: input2.evidence,
    ...input2.actions === void 0 ? {} : { actions: input2.actions },
    ...input2.clientCapabilities === void 0 ? {} : { clientCapabilities: input2.clientCapabilities }
  });
  const compatibilityTags = produced.fingerprint.compatibilityTags.map((tag) => {
    const separator = tag.indexOf(":");
    if (separator < 1 || separator === tag.length - 1) throw new Error("Reusable web evidence compatibility tag is malformed");
    return { name: tag.slice(0, separator), value: tag.slice(separator + 1) };
  });
  compatibilityTags.push({ name: "web.fingerprint", value: produced.fingerprint.digest });
  compatibilityTags.push({ name: "web.fingerprint-schema", value: WEB_REUSABLE_EVIDENCE_FINGERPRINT_SCHEMA_VERSION });
  compatibilityTags.sort((left, right) => left.name.localeCompare(right.name) || left.value.localeCompare(right.value));
  return {
    projectId,
    record: {
      ...recordId ? { recordId } : {},
      flowId,
      ...subflowId ? { subflowId } : {},
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      evidenceKind: input2.evidenceKind,
      evidenceSchemaVersion: produced.fingerprint.evidenceSchemaVersion,
      sanitizerVersion: produced.fingerprint.sanitizerVersion,
      compatibilityTags,
      promptProjection: produced.promptProjection,
      outcome: input2.outcome,
      reviewerState: input2.reviewerState,
      validationState: input2.validationState,
      sourceRunIds,
      sourceAdaptationIds,
      createdAt: input2.completedAt,
      ...input2.ttlMs === void 0 ? {} : { ttlMs: input2.ttlMs }
    }
  };
}
async function writeCompletedWebReusableEvidence(input2, port) {
  if (input2.enabled !== true) return { status: "disabled" };
  const request = mapCompletedWebReusableEvidenceToPutRequest(input2);
  let response;
  try {
    response = await port.putReusableLlmContext(request);
  } catch {
    throw new Error("Protected reusable-context write was rejected by Core");
  }
  const recordId = response.payload?.context?.recordId;
  const contentDigest = response.payload?.context?.contentDigest;
  if (!response.ok || typeof recordId !== "string" || !recordId || typeof contentDigest !== "string" || !/^[a-f0-9]{64}$/u.test(contentDigest)) {
    throw new Error("Protected reusable-context write was rejected by Core");
  }
  return { status: "stored", recordId, contentDigest };
}
function identifiers(input2, label) {
  if (input2.length > 25) throw new Error(`Reusable web evidence ${label} IDs exceed 25`);
  return [...new Set(input2.map((value) => identifier(value, label)))].sort();
}
function identifier(input2, label) {
  const value = typeof input2 === "string" ? input2.trim() : "";
  if (!value || value.length > 200 || !/^[A-Za-z0-9._:-]+$/u.test(value)) throw new Error(`Reusable web evidence ${label} ID is invalid`);
  return value;
}

// src/runtime/tests/reusable-evidence-coordinator.test.ts
function input(overrides = {}) {
  return {
    enabled: true,
    completionStatus: "completed",
    projectId: "project.one",
    flowId: "flow.one",
    subflowId: "subflow.one",
    evidenceKind: "runtime_failure",
    evidence: {
      schemaVersion: "web-llm-evidence.v1",
      trust: "untrusted-page-evidence",
      location: "https://example.test/form?secret=query#fragment",
      elements: [
        { target: "target.1", tag: "textarea", selector: '[data-testid="adapted-name"]', name: "Name", hasValue: true },
        { target: "target.2", tag: "input", selector: "#password", inputType: "password", name: "Password" },
        { target: "target.3", tag: "select", selector: "#plan", name: "Plan", selectedValue: "private-value", options: [{ value: "private-value", label: "Private label" }] }
      ],
      truncated: false
    },
    actions: [{ definitionId: "web.output.dom-type", status: "failed", route: "failed" }],
    clientCapabilities: ["web.actions.v1", "web.snapshots.v1"],
    outcome: "failed",
    reviewerState: "unreviewed",
    validationState: "unknown",
    sourceRunIds: ["run.one"],
    sourceAdaptationIds: [],
    completedAt: 1e3,
    ttlMs: 6e4,
    ...overrides
  };
}
test("maps completed sanitized evidence to the protected Core put contract", () => {
  const request = mapCompletedWebReusableEvidenceToPutRequest(input());
  assert.equal(request.projectId, "project.one");
  assert.deepEqual(request.record.sourceRunIds, ["run.one"]);
  assert.equal(request.record.domainId, "web-automation");
  assert.equal(request.record.outcome, "failed");
  assert.match(request.record.compatibilityTags.find((tag) => tag.name === "web.fingerprint")?.value ?? "", /^[a-f0-9]{64}$/u);
  const serialized = JSON.stringify(request);
  assert.doesNotMatch(serialized, /secret=query|fragment|private-value|Private label|Password|adapted-name|#plan|#password|target\.1/iu);
  assert.doesNotMatch(serialized, /selector|selectedValue|hasValue|options|rawDom|cookie|headers/iu);
  const projection = request.record.promptProjection;
  assert.ok(projection.facts.some((fact) => fact.kind === "action" && fact.status === "failed"));
  assert.ok(projection.facts.some((fact) => fact.kind === "element" && fact.tag === "textarea"));
});
test("does not call Core while feature-gated off", async () => {
  let calls = 0;
  const result = await writeCompletedWebReusableEvidence(input({ enabled: false }), { putReusableLlmContext: async () => {
    calls += 1;
    return { ok: true };
  } });
  assert.deepEqual(result, { status: "disabled" });
  assert.equal(calls, 0);
});
test("writes once and returns only protected Core identity", async () => {
  const requests = [];
  const result = await writeCompletedWebReusableEvidence(input(), {
    putReusableLlmContext: async (request) => {
      requests.push(request);
      return { ok: true, payload: { context: { recordId: "llm-context:one", contentDigest: "a".repeat(64) } } };
    }
  });
  assert.deepEqual(result, { status: "stored", recordId: "llm-context:one", contentDigest: "a".repeat(64) });
  assert.equal(requests.length, 1);
});
test("fails closed on incomplete provenance and every rejected protected write", async () => {
  assert.throws(() => mapCompletedWebReusableEvidenceToPutRequest(input({ completionStatus: "running" })), /only after completion/u);
  assert.throws(() => mapCompletedWebReusableEvidenceToPutRequest(input({ sourceRunIds: [], sourceAdaptationIds: [] })), /explicit source provenance/u);
  let rejectedCalls = 0;
  await assert.rejects(() => writeCompletedWebReusableEvidence(input(), { putReusableLlmContext: async () => {
    rejectedCalls += 1;
    return { ok: false };
  } }), /rejected by Core/u);
  assert.equal(rejectedCalls, 1);
  let thrownCalls = 0;
  await assert.rejects(() => writeCompletedWebReusableEvidence(input(), { putReusableLlmContext: async () => {
    thrownCalls += 1;
    throw new Error("content protection unavailable");
  } }), /rejected by Core/u);
  assert.equal(thrownCalls, 1);
});
