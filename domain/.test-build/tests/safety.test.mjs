// src/tests/safety.test.ts
import assert from "node:assert/strict";
import test from "node:test";

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

// src/constants.ts
var WEB_AUTOMATION_DOMAIN_ID = "web-automation";

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

// src/io/manifest-definitions.ts
var webAutomationManifestInputs = [
  ...stateInputDefinitions,
  ...actionInputDefinitions.map(([id, title, outputId]) => ({ id, title, role: "action", outputId }))
];
var webAutomationManifestOutputs = webAutomationActionDefinitions.map((action) => ({
  id: action.actionType,
  title: action.label,
  description: action.description,
  schema: action.parameterSchema,
  capabilities: ["web.actions"],
  safety: {
    level: WEB_AUTOMATION_ACTION_SAFETY[action.actionType],
    requiresApproval: WEB_AUTOMATION_ACTION_SAFETY[action.actionType] !== "safe"
  }
}));

// src/tests/safety.test.ts
var SAFE_OUTPUTS = [
  "web.dom.wait_for_selector",
  "web.dom.wait_for_text",
  "web.dom.extract",
  "web.dom.capture_snapshot",
  // An assertion and a list extraction only read the page. The other five
  // outputs added in Week 1 change the page or the browser, so they are review.
  "web.dom.assert",
  "web.dom.extract_list"
];
test("the safety registry classifies every output exactly once, and only the observe and wait outputs as safe", () => {
  assert.deepEqual(Object.keys(WEB_AUTOMATION_ACTION_SAFETY).sort(), [...WEB_AUTOMATION_ACTION_TYPES].sort());
  for (const outputId of WEB_AUTOMATION_ACTION_TYPES) {
    assert.equal(WEB_AUTOMATION_ACTION_SAFETY[outputId], SAFE_OUTPUTS.includes(outputId) ? "safe" : "review", outputId);
  }
});
test("the domain manifest and the output-node definitions give each output one consistent classification", () => {
  for (const outputId of WEB_AUTOMATION_ACTION_TYPES) {
    const manifestOutputs = webAutomationManifestOutputs.filter((output) => output.id === outputId);
    const nodes = webAutomationOutputNodeDefinitions.filter((definition) => definition.outputAction?.fixedOutputId === outputId);
    assert.equal(manifestOutputs.length, 1, `${outputId} has one manifest output`);
    assert.equal(nodes.length, 1, `${outputId} has one output node`);
    const safe = SAFE_OUTPUTS.includes(outputId);
    assert.deepEqual({
      level: manifestOutputs[0].safety.level,
      requiresApproval: manifestOutputs[0].safety.requiresApproval,
      privileged: nodes[0].safety?.privileged,
      requiresOperatorApproval: nodes[0].safety?.requiresOperatorApproval
    }, {
      level: safe ? "safe" : "review",
      requiresApproval: !safe,
      privileged: !safe,
      requiresOperatorApproval: !safe
    }, outputId);
  }
});
