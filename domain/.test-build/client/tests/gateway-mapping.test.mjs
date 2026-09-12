// src/client/tests/gateway-mapping.test.ts
import assert from "node:assert/strict";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";

// src/actions/types.ts
var WEB_AUTOMATION_EXTRACT_MAX_PAGES = 50;
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

// src/constants.ts
var WEB_AUTOMATION_DOMAIN_ID = "web-automation";
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

// src/recording/state.ts
var WEB_AUTOMATION_STATE_NAMESPACE = "web";

// src/recording/web-state.ts
var WEB_AUTOMATION_SCREEN_FRAME_ID = "screen";
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
function elementStateId(element) {
  const stable = stableElementPathId(element);
  if (stable) return sanitizeStateId(stable);
  const name = stableAttribute(element, "name");
  if (name) return sanitizeStateId(`${name}.${element.selector}`);
  return sanitizeStateId(element.selector);
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

// src/client/gateway-action-parameters.ts
function webAutomationLiftedActionParameters(parameters) {
  return {
    // Which tab and frame the action runs in, as opposed to the tab a
    // `web.browser.tab` operation acts on, which travels inside `tab`.
    tabId: nonNegativeInteger(parameters.browserTabId ?? parameters.tabId),
    frameId: nonNegativeInteger(parameters.browserFrameId ?? parameters.frameId),
    newTab: booleanValue(parameters.newTab),
    option: optionSelectorValue(parameters.option),
    scroll: scrollRequestValue(parameters.scroll),
    wait: waitRequestValue(parameters.wait),
    modifiers: keyModifiersValue(parameters.modifiers),
    checked: booleanValue(parameters.checked),
    assert: assertRequestValue(parameters.assert),
    extractList: extractListRequestValue(parameters.extractList),
    upload: uploadRequestValue(parameters.upload),
    dialog: dialogRequestValue(parameters.dialog),
    tab: tabRequestValue(parameters.tab),
    download: downloadRequestValue(parameters.download)
  };
}
function optionSelectorValue(value) {
  const request = jsonObject(value);
  if (!request) return void 0;
  if (request.by === "value") {
    const optionValue = stringValue2(request.value);
    return optionValue === void 0 ? void 0 : { by: "value", value: optionValue };
  }
  if (request.by === "label") {
    const label = stringValue2(request.label);
    return label === void 0 ? void 0 : { by: "label", label };
  }
  const index = nonNegativeInteger(request.index);
  return request.by === "index" && index !== void 0 ? { by: "index", index } : void 0;
}
function scrollRequestValue(value) {
  const request = jsonObject(value);
  const mode = memberOf(request?.mode, ["by", "toElement", "untilStable"]);
  if (!request || mode === void 0) return void 0;
  if (mode === "toElement") return { mode };
  const y = finiteNumber(request.y);
  if (mode === "by") {
    const x = finiteNumber(request.x);
    return { mode, ...x !== void 0 ? { x } : {}, ...y !== void 0 ? { y } : {} };
  }
  const maxScrolls = positiveInteger(request.maxScrolls);
  return maxScrolls === void 0 ? void 0 : { mode, maxScrolls, ...y !== void 0 ? { y } : {} };
}
function waitRequestValue(value) {
  const request = jsonObject(value);
  const condition = memberOf(request?.condition, WAIT_CONDITIONS);
  if (!request || condition === void 0) return void 0;
  const url = nonEmptyString(request.url);
  const stableForMs = positiveInteger(request.stableForMs);
  return { condition, ...url !== void 0 ? { url } : {}, ...stableForMs !== void 0 ? { stableForMs } : {} };
}
function keyModifiersValue(value) {
  const request = jsonObject(value);
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
  const request = jsonObject(value);
  const kind = memberOf(request?.kind, ASSERT_KINDS);
  if (!request || kind === void 0) return void 0;
  const expected = stringValue2(request.expected);
  const timeoutMs = positiveInteger(request.timeoutMs);
  return { kind, ...expected !== void 0 ? { expected } : {}, ...timeoutMs !== void 0 ? { timeoutMs } : {} };
}
function extractListRequestValue(value) {
  const request = jsonObject(value);
  const item = nonEmptyString(request?.item);
  const fields = fieldMapValue(request?.fields);
  if (!request || item === void 0 || fields === void 0) return void 0;
  const paginate = request.paginate === void 0 ? void 0 : paginationValue(request.paginate);
  if (request.paginate !== void 0 && paginate === void 0) return void 0;
  const maxItems = positiveInteger(request.maxItems);
  return { item, fields, ...paginate !== void 0 ? { paginate } : {}, ...maxItems !== void 0 ? { maxItems } : {} };
}
function fieldMapValue(value) {
  const fields = jsonObject(value);
  if (!fields) return void 0;
  const entries = Object.entries(fields);
  const named = entries.filter(([name, selector]) => name.length > 0 && nonEmptyString(selector) !== void 0);
  return named.length > 0 && named.length === entries.length ? Object.fromEntries(named) : void 0;
}
function paginationValue(value) {
  const paginate = jsonObject(value);
  const next = nonEmptyString(paginate?.next);
  const maxPages = positiveInteger(paginate?.maxPages);
  if (next === void 0 || maxPages === void 0) return void 0;
  return { next, maxPages: Math.min(maxPages, WEB_AUTOMATION_EXTRACT_MAX_PAGES) };
}
function uploadRequestValue(value) {
  const request = jsonObject(value);
  const supplied = Array.isArray(request?.files) ? request.files : void 0;
  if (supplied === void 0 || supplied.length === 0) return void 0;
  const files = [];
  let totalBytes = 0;
  for (const entry of supplied) {
    const file = jsonObject(entry);
    const name = nonEmptyString(file?.name);
    const mimeType = nonEmptyString(file?.mimeType);
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
  const request = jsonObject(value);
  const response = memberOf(request?.response, ["accept", "dismiss"]);
  if (!request || response === void 0) return void 0;
  const promptText = response === "accept" ? stringValue2(request.promptText) : void 0;
  return { response, ...promptText !== void 0 ? { promptText } : {} };
}
function tabRequestValue(value) {
  const request = jsonObject(value);
  const operation = memberOf(request?.operation, ["open", "switch", "close"]);
  if (!request || operation === void 0) return void 0;
  const tabId = nonNegativeInteger(request.tabId);
  if (operation === "open") {
    const url = nonEmptyString(request.url);
    const active = booleanValue(request.active);
    return { operation, ...url !== void 0 ? { url } : {}, ...active !== void 0 ? { active } : {} };
  }
  if (operation === "switch") {
    const urlPattern = nonEmptyString(request.urlPattern);
    return { operation, ...tabId !== void 0 ? { tabId } : {}, ...urlPattern !== void 0 ? { urlPattern } : {} };
  }
  return { operation, ...tabId !== void 0 ? { tabId } : {} };
}
function downloadRequestValue(value) {
  const request = jsonObject(value);
  if (!request) return void 0;
  const filename = nonEmptyString(request.filename);
  const timeoutMs = positiveInteger(request.timeoutMs);
  return { ...filename !== void 0 ? { filename } : {}, ...timeoutMs !== void 0 ? { timeoutMs } : {} };
}
var WAIT_CONDITIONS = ["present", "visible", "enabled", "absent", "url", "stable"];
var ASSERT_KINDS = ["exists", "absent", "text", "url", "visible", "enabled"];
function booleanValue(value) {
  return typeof value === "boolean" ? value : void 0;
}
function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function nonNegativeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
}
function positiveInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : void 0;
}
function stringValue2(value) {
  return typeof value === "string" ? value : void 0;
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

// src/client/gateway-mapping.ts
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
function webAutomationActionFromGatewayCommand(command) {
  const normalized = normalizeWebAutomationActionType(command.actionType);
  if (!normalized.ok) {
    return { commandId: command.commandId, status: "rejected", actionType: command.actionType, message: normalized.message, failure: normalized.failure };
  }
  const parameters = command.parameters ?? {};
  const target = command.target ?? {};
  return compactJsonObject2({
    commandId: command.commandId,
    actionType: normalized.actionType,
    selector: stringValue3(target.selector) ?? stringValue3(parameters.selector),
    text: stringValue3(parameters.text),
    value: stringValue3(parameters.value),
    key: stringValue3(parameters.key),
    url: stringValue3(parameters.url),
    timeoutMs: numberValue2(command.timeoutMs ?? parameters.timeoutMs),
    coordinates: pointValue(target.coordinates ?? parameters.coordinates),
    visualTarget: jsonObject2(target.visualTarget ?? parameters.visualTarget),
    ...webAutomationLiftedActionParameters(parameters),
    options: parameters
  });
}
function normalizeWebAutomationActionType(actionType) {
  if (CANONICAL_ACTION_TYPES.has(actionType)) return { ok: true, actionType };
  const canonical = LEGACY_ACTION_TYPE_ALIASES.get(actionType);
  if (canonical !== void 0) return { ok: true, actionType: canonical };
  const requested = typeof actionType === "string" && actionType.length > 0 ? actionType : "(missing)";
  return { ok: false, failure: UNSUPPORTED_ACTION_TYPE_FAILURE, message: `Unsupported web automation action type: ${requested}` };
}
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
function stringValue3(value) {
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
function jsonObject2(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function compactJsonObject2(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}

// src/client/tests/gateway-mapping.test.ts
var unsupportedTypeFailure = { category: "blocked_by_capability_or_policy", code: "web.action.unsupported_type", retryable: false, stage: "dispatch" };
var wireRows = [
  ["content.ready", WEB_AUTOMATION_EVENTS.clientReady],
  ["browser.tab", WEB_AUTOMATION_EVENTS.tabStateChanged],
  ["browser.navigation", WEB_AUTOMATION_EVENTS.pageNavigated],
  ["dom.click", WEB_AUTOMATION_EVENTS.elementClicked],
  ["dom.input", WEB_AUTOMATION_EVENTS.elementInputChanged],
  ["dom.change", WEB_AUTOMATION_EVENTS.elementChanged],
  ["dom.submit", WEB_AUTOMATION_EVENTS.formSubmitted],
  ["dom.keydown", WEB_AUTOMATION_EVENTS.keyboardPressed],
  ["dom.scroll", WEB_AUTOMATION_EVENTS.scrollChanged],
  ["dom.wheel", WEB_AUTOMATION_EVENTS.mouseWheel],
  ["dom.mutation", WEB_AUTOMATION_EVENTS.domMutated],
  ["dom.focus", WEB_AUTOMATION_EVENTS.elementFocused],
  ["dom.blur", WEB_AUTOMATION_EVENTS.elementBlurred],
  ["dom.snapshot", WEB_AUTOMATION_EVENTS.snapshotCaptured],
  ["action.result", WEB_AUTOMATION_EVENTS.actionExecuted],
  ["client.error", WEB_AUTOMATION_EVENTS.clientError]
];
for (const [kind, eventType] of wireRows) {
  const event = createWebAutomationRecordingEvent({ kind, sequence: 3, url: "https://example.test", title: "Example", eventTimestampMs: 30 });
  assert.equal(event.eventType, eventType, `${kind}: event type on the wire`);
  assert.equal(event.domainId, WEB_AUTOMATION_DOMAIN_ID, `${kind}: domainId at the top level`);
  assert.equal(event.metadata?.clientKind, kind, `${kind}: client kind kept in metadata`);
}
assert.equal(createWebAutomationRecordingEvent({ kind: "dom.unknown", sequence: 1, url: "https://example.test", title: "Example", eventTimestampMs: 1 }).eventType, WEB_AUTOMATION_EVENTS.clientError);
for (const actionType of WEB_AUTOMATION_ACTION_TYPES) {
  assert.deepEqual(normalizeWebAutomationActionType(actionType), { ok: true, actionType });
}
var legacyAliases = {
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
for (const [alias, actionType] of Object.entries(legacyAliases)) {
  assert.deepEqual(normalizeWebAutomationActionType(alias), { ok: true, actionType }, alias);
}
for (const unknown of ["web.dom.hover", "dom.hover", "extract", "WEB.DOM.CLICK", " web.dom.click", "web.", ""]) {
  const normalized = normalizeWebAutomationActionType(unknown);
  assert.equal(normalized.ok, false, JSON.stringify(unknown));
  assert.deepEqual(normalized.ok ? void 0 : normalized.failure, unsupportedTypeFailure, JSON.stringify(unknown));
  assert.deepEqual(parseAutomationStudioFailureRecord(normalized.ok ? void 0 : normalized.failure), unsupportedTypeFailure, JSON.stringify(unknown));
}
var emptyType = normalizeWebAutomationActionType("");
assert.equal(emptyType.ok ? void 0 : emptyType.message, "Unsupported web automation action type: (missing)");
assert.deepEqual(webAutomationActionFromGatewayCommand({
  commandId: "command.type",
  actionType: "dom.type",
  target: { selector: "input[name=q]" },
  parameters: { text: "ada" }
}), {
  commandId: "command.type",
  actionType: "web.dom.type",
  selector: "input[name=q]",
  text: "ada",
  options: { text: "ada" }
});
assert.deepEqual(webAutomationActionFromGatewayCommand({
  commandId: "command.scroll",
  actionType: "web.dom.scroll",
  parameters: { x: 0, y: 640 }
}), {
  commandId: "command.scroll",
  actionType: "web.dom.scroll",
  options: { x: 0, y: 640 }
});
var rejected = webAutomationActionFromGatewayCommand({ commandId: "command.hover", actionType: "web.dom.hover", target: { selector: "#menu" } });
assert.deepEqual(rejected, {
  commandId: "command.hover",
  status: "rejected",
  actionType: "web.dom.hover",
  message: "Unsupported web automation action type: web.dom.hover",
  failure: unsupportedTypeFailure
});
assert.equal("selector" in rejected, false, "a rejected command carries nothing to execute");
assert.equal(webAutomationActionFromGatewayCommand({ commandId: "command.legacy", actionType: "dom.hover" }).actionType, "dom.hover");
assert.equal("status" in webAutomationActionFromGatewayCommand({ commandId: "command.legacy", actionType: "dom.hover" }), true);
console.log("Web automation gateway mapping tests passed.");
