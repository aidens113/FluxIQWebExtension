// src/runtime/tests/adapter-redaction.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";

// src/sensitivity/signature.ts
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

// src/sensitivity/descriptor.ts
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

// src/sensitivity/redaction.ts
var WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT = "(withheld: the action ran on a control that holds a secret)";
function isProducerRedactedComparison(validation) {
  if (!validation || typeof validation !== "object" || Array.isArray(validation)) return false;
  return validation.redacted === true;
}

// src/runtime/adapter.ts
import { createHash } from "node:crypto";
import { AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES as AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES2 } from "fluxiq/automation-studio";

// src/constants.ts
var WEB_AUTOMATION_DOMAIN_ID = "web-automation";

// src/actions/types.ts
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

// src/output-nodes/targets.ts
function outputTargetFromPayload(payload) {
  const adaptedTarget = objectValue(payload.target);
  const adaptedFingerprint = objectValue(adaptedTarget?.fingerprint);
  const selectedCandidate = selectedTargetCandidate(adaptedTarget);
  const explicitVisualTarget = objectValue(adaptedTarget?.visualTarget) ?? objectValue(payload.visualTarget);
  const element = firstElementFingerprint(elementFingerprintSources(payload, adaptedTarget, adaptedFingerprint, selectedCandidate));
  const selector = stringValue(selectedCandidate?.selector) ?? stringValue(adaptedFingerprint?.selector) ?? stringValue(adaptedTarget?.selector) ?? stringValue(payload.selector) ?? stringValue(element?.selector) ?? stringValue(explicitVisualTarget?.selector);
  if (!selector && !explicitVisualTarget) return void 0;
  return compact({
    selector,
    ...element ? { element } : {},
    ...explicitVisualTarget ? { visualTarget: explicitVisualTarget } : {}
  });
}
function elementFingerprintSources(payload, adaptedTarget, adaptedFingerprint, selectedCandidate) {
  const adapted = [adaptedTarget?.element, selectedCandidate, adaptedFingerprint];
  return adaptedTarget?.selectedCandidate !== void 0 ? [...adapted, payload.element] : [payload.element, ...adapted];
}
function firstElementFingerprint(sources) {
  for (const source of sources) {
    const fingerprint = elementFingerprint(source);
    if (fingerprint && Object.keys(fingerprint).length > 0) return fingerprint;
  }
  return void 0;
}
function selectedTargetCandidate(target) {
  const selectedCandidateId = stringValue(objectValue(target?.selectedCandidate)?.candidateId);
  if (!selectedCandidateId || !Array.isArray(target?.candidates)) return void 0;
  return target.candidates.map(objectValue).find((candidate) => stringValue(candidate?.candidateId) === selectedCandidateId);
}
function elementFingerprint(value) {
  const element = objectValue(value);
  if (!element) return void 0;
  const attributes = objectValue(element.attributes);
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
    testId: elementTestId(element, attributes),
    accessibleName: stringValue(element.accessibleName) ?? stringValue(attributes?.["aria-label"]),
    label: stringValue(element.label),
    attributes
  });
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

// src/io/gateway-output-dispatcher.ts
async function dispatchWebAutomationOutput(fluxiq, request) {
  const sessionId = targetSessionId(fluxiq, request.metadata);
  if (!sessionId) return { ok: false, outputId: request.outputId, error: "A single paired web-automation client must be selected before dispatching an output." };
  try {
    const target = outputTargetFromPayload(request.payload);
    const command = target ? {
      actionType: request.outputId,
      parameters: request.payload,
      target
    } : {
      actionType: request.outputId,
      parameters: request.payload
    };
    const result = await fluxiq.programs.automationStudioClientGateway.executeAction(sessionId, command);
    const succeeded = result.status === "succeeded";
    const message = stringValue2(result.message);
    return {
      // `ok` stays the success flag; `status` is the command's own outcome, so
      // Core sees `timed_out` or `cancelled` rather than a bare failure.
      ok: succeeded,
      outputId: request.outputId,
      status: result.status,
      payload: compact2({ status: result.status, message: result.message, result: result.payload }),
      // Core's IO path builds the node message from `error` alone
      // (`failedDispatchResult`), so a command that failed with only a message
      // — the usual shape of a client-side timeout or cancellation — would
      // otherwise arrive with no reason. A success never gains an error.
      ...result.error ? { error: result.error } : !succeeded && message ? { error: message } : {},
      ...result.failure ? { failure: result.failure } : {}
    };
  } catch (error) {
    return { ok: false, outputId: request.outputId, error: error instanceof Error ? error.message : "Web automation output dispatch failed." };
  }
}
function targetSessionId(fluxiq, metadata) {
  const requested = stringValue2(metadata?.sessionId);
  const eligible = fluxiq.programs.clientGateway.snapshot().sessions.filter(
    (session) => (session.status === "connected" || session.status === "ready") && session.clientType === "extension" && session.capabilities.some(
      (capability) => capability.id === "web.actions" && (capability.metadata?.domainId === WEB_AUTOMATION_DOMAIN_ID || capability.actionTypes?.some((actionType) => actionType.startsWith("web.")))
    )
  );
  if (requested) return eligible.some((session) => session.sessionId === requested) ? requested : void 0;
  return eligible.length === 1 ? eligible[0]?.sessionId : void 0;
}
function compact2(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== void 0));
}
function stringValue2(value) {
  return typeof value === "string" ? value : void 0;
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

// src/runtime/failure/codes.ts
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

// src/runtime/failure/carrier.ts
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

// src/runtime/failure/classify.ts
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

// src/runtime/llm-evidence/limits.ts
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

// src/runtime/llm-evidence/location.ts
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

// src/runtime/llm-evidence/untrusted-json.ts
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

// src/runtime/llm-evidence/elements.ts
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
  return {
    target: context.target,
    tag,
    selector: addressed.selector,
    ...addressed.frameId === void 0 ? {} : { frameId: addressed.frameId },
    ...role ? { role } : {},
    ...name ? { name } : {},
    ...text2 ? { text: text2 } : {},
    ...inputType ? { inputType } : {},
    ...controlType ? { controlType } : {},
    ...hasValue === void 0 ? {} : { hasValue },
    ...selectedValue ? { selectedValue } : {},
    ...href ? { href } : {},
    ...options?.length ? { options } : {},
    ...revealKind ? { revealKind } : {},
    ...expanded === void 0 ? {} : { expanded },
    ...focused ? { focused } : {},
    ...trueFlag(raw.recentlyInteracted) ? { recent: true } : {},
    ...trueFlag(raw.changed) ? { changed: true } : {},
    ...placement
  };
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
  if (!isJsonRecord(input)) return {};
  const form = boundedText2(input.formId ?? input.formName, WEB_LLM_EVIDENCE_BOUNDS.placement);
  const landmark = boundedText2(input.landmark, WEB_LLM_EVIDENCE_BOUNDS.tag);
  const rawHeading = boundedText2(input.heading, WEB_LLM_EVIDENCE_BOUNDS.placement);
  const heading = rawHeading === named.name || rawHeading === named.text ? void 0 : rawHeading;
  return {
    ...form ? { form } : {},
    ...landmark ? { landmark } : {},
    ...heading ? { heading } : {},
    ...listPlacement(input.listPosition),
    ...tablePlacement(input.tablePosition)
  };
}
function listPlacement(input) {
  if (!isJsonRecord(input)) return {};
  const index = boundedCount(input.index, 1e5);
  const total = boundedCount(input.total, 1e5);
  return index === void 0 || total === void 0 ? {} : { item: { index, total } };
}
function tablePlacement(input) {
  if (!isJsonRecord(input)) return {};
  const row = boundedCount(input.row, 1e5);
  const column = boundedCount(input.column, 1e5);
  if (row === void 0 || column === void 0) return {};
  const header = boundedText2(input.columnHeader, WEB_LLM_EVIDENCE_BOUNDS.placement);
  return { cell: { row, column, ...header ? { header } : {} } };
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

// src/page-evidence/wire.ts
function pageEvidenceWire(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}

// src/runtime/llm-evidence/page-evidence.ts
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
  return {
    ...frame ? { frame } : {},
    ...loading ? { loading } : {},
    ...navigation ? { navigation } : {},
    ...dialogs ? { dialogs } : {},
    ...blockedBy ? { blockedBy } : {},
    ...selectedText ? { selectedText } : {}
  };
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
  return {
    isTop: isTop ?? true,
    ...childFrameIds.length ? { childFrameIds } : {}
  };
}
function evidenceLoading(input) {
  if (!input) return void 0;
  const documentState = boundedText2(input.documentState, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const readyState = documentState && READY_STATES.includes(documentState) ? documentState : void 0;
  const spinner = items(input.indicators).map((indicator) => pageEvidenceWire(indicator)).some((indicator) => indicator?.kind === "spinner");
  const loading = {
    ...readyState && readyState !== "complete" ? { readyState } : {},
    ...trueFlag(input.busy) ? { busy: true } : {},
    ...spinner ? { spinner: true } : {},
    ...trueFlag(input.pendingNavigation) ? { pendingNavigation: true } : {}
  };
  return Object.keys(loading).length ? loading : void 0;
}
function evidenceNavigation(input) {
  if (!input) return void 0;
  const type = boundedText2(input.type, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const redirects = boundedCount(input.redirects, MAX_REDIRECTS);
  const navigation = {
    ...type && type !== ORDINARY_NAVIGATION_TYPE ? { type } : {},
    ...redirects ? { redirects } : {},
    ...safeLocationField("referrer", input.referrer)
  };
  return Object.keys(navigation).length ? navigation : void 0;
}
function safeLocationField(key, input) {
  try {
    return { [key]: evidenceLocation(safeEvidenceUrl(input)) };
  } catch {
    return {};
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
    const selector = boundedText2(raw.selector, WEB_LLM_EVIDENCE_BOUNDS.selector);
    const modal = trueFlag(raw.modal);
    if (!role && !name && !selector && !modal) continue;
    dialogs.push({
      ...role ? { role } : {},
      ...name ? { name } : {},
      ...modal ? { modal } : {},
      ...selector ? { selector } : {}
    });
  }
  return dialogs.length ? dialogs : void 0;
}
function evidenceBlocker(input) {
  const blocker = items(input?.blockers).map((item) => pageEvidenceWire(item)).find((item) => item !== void 0);
  if (!blocker) return void 0;
  const selector = boundedText2(blocker.selector, WEB_LLM_EVIDENCE_BOUNDS.selector);
  if (!selector) return void 0;
  const role = boundedText2(blocker.role, WEB_LLM_EVIDENCE_BOUNDS.role);
  const name = boundedText2(blocker.label, WEB_LLM_EVIDENCE_BOUNDS.text);
  const blocks = boundedCount(blocker.blocks, MAX_BLOCKED_CONTROLS);
  return {
    selector,
    ...role ? { role } : {},
    ...name ? { name } : {},
    ...blocks ? { blocks } : {}
  };
}

// src/runtime/llm-evidence/sanitize.ts
var WEB_LLM_EVIDENCE_SCHEMA_VERSION = "web-llm-evidence.v1";
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
    const element = sanitizedEvidenceElement(raw, { target: `target.${elements.length + 1}`, url, focusedSelector });
    if (!element) continue;
    elements.push(element);
    selectors.set(element.target, element.selector);
  }
  const childFrameIds = [...new Set(elements.map((element) => element.frameId).filter((id) => id !== void 0))].sort((left, right) => left - right);
  const elementTotal = evidenceElementTotal(snapshot, elements.length);
  const title = boundedText2(snapshot.title, WEB_LLM_EVIDENCE_BOUNDS.text);
  const captureTruncated = capturedTruncated(snapshot);
  const elementsTruncated = snapshot.interactiveElements.length > WEB_LLM_EVIDENCE_BOUNDS.elements;
  const evidence = {
    schemaVersion: WEB_LLM_EVIDENCE_SCHEMA_VERSION,
    trust: "untrusted-page-evidence",
    location: evidenceLocation(url),
    ...title ? { title } : {},
    ...webLlmPageContext(snapshot, childFrameIds),
    ...elementTotal === void 0 ? {} : { elementTotal },
    elements,
    truncated: captureTruncated || elementsTruncated,
    ...captureTruncated ? { captureTruncated: true } : {},
    ...elementsTruncated ? { elementsTruncated: true } : {}
  };
  trimToBudget(evidence, selectors, maxEvidenceBytes);
  return { evidence, selectors };
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

// src/runtime/llm-evidence/tool-rejection.ts
var WEB_LLM_TOOL_REJECTION_CODES = [
  "invalid_input",
  "cross_origin",
  "no_progress",
  "target_unobserved",
  "target_unsafe",
  "sensitive_value"
];

// src/runtime/llm-evidence/vocabulary.ts
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

// src/runtime/adapter.ts
function createWebAutomationRuntimeAdapter(options) {
  return {
    adapterId: options.adapterId ?? "web-automation.gateway",
    label: options.label ?? "Web Automation Gateway Runtime",
    transport: "direct",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    capabilities: () => webAutomationRuntimeCapabilities,
    canExecute: (command) => canExecuteWebAutomationCommand(command),
    execute: (command) => executeWebAutomationRuntimeCommand(options.fluxiq, command),
    captureSnapshot: (command) => captureWebAutomationSnapshot(options.fluxiq, command),
    readState: (command) => captureWebAutomationSnapshot(options.fluxiq, command)
  };
}
function canExecuteWebAutomationCommand(command) {
  if (command.domainId !== void 0 && command.domainId !== WEB_AUTOMATION_DOMAIN_ID) return false;
  if (command.kind === "capture_snapshot" || command.kind === "read_state") return true;
  if (command.kind !== "execute_action") return false;
  const outputId = command.outputId ?? command.actionType;
  return WEB_AUTOMATION_ACTION_TYPES.includes(outputId);
}
async function executeWebAutomationRuntimeCommand(fluxiq, command) {
  const outputId = command.outputId ?? command.actionType;
  if (!outputId || !WEB_AUTOMATION_ACTION_TYPES.includes(outputId)) {
    return rejected(command, `Unsupported web automation output: ${outputId ?? "(missing)"}`, WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE);
  }
  const payload = command.parameters ?? {};
  const startedAt = Date.now();
  const request = {
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    outputId,
    payload
  };
  if (command.metadata) request.metadata = command.metadata;
  const result = await dispatchWebAutomationOutput(fluxiq, request);
  const message = result.error ?? dispatchPayloadMessage(result.payload);
  const status = result.status ?? (result.ok ? "succeeded" : "failed");
  const diagnostics = failureDiagnostics(status, result.payload);
  const clientResult = jsonObject(result.payload?.result);
  const withholdComparison = isSensitiveElementDescriptor(clientResult?.element) && !isProducerRedactedComparison(clientResult?.validation);
  const failure = commandFailure(status, outputId, message, result.failure, diagnostics?.evidenceDigest, withholdComparison);
  const runtimeResult = {
    commandId: command.commandId ?? `web.${Date.now()}`,
    status,
    startedAt,
    completedAt: Date.now(),
    ...result.error ? { error: result.error } : {},
    ...message ? { message } : {},
    ...failure ? { failure } : {},
    metadata: compact3({
      outputId,
      ...result.metadata ?? {},
      ...diagnostics ? { failureDiagnostics: diagnostics.report, ...diagnostics.evidence ? { failureEvidence: diagnostics.evidence } : {} } : {}
    })
  };
  if (result.payload !== void 0) runtimeResult.payload = withholdComparison ? secretSafeDispatchPayload(result.payload) : result.payload;
  const target = outputTargetFromPayload(payload);
  if (target) runtimeResult.target = target;
  return runtimeResult;
}
async function captureWebAutomationSnapshot(fluxiq, command) {
  const session = selectWebAutomationSession(fluxiq, command.metadata);
  if (!session) return rejected(command, "A single paired web-automation client must be selected before capturing state.", WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED);
  await fluxiq.programs.clientGateway.captureSnapshot(session.sessionId, {
    kind: command.kind === "read_state" ? "state" : "structured",
    ...command.metadata ? { metadata: command.metadata } : {}
  });
  return {
    commandId: command.commandId ?? `web.snapshot.${Date.now()}`,
    status: "succeeded",
    completedAt: Date.now(),
    message: "Snapshot command dispatched to web automation client.",
    metadata: { sessionId: session.sessionId, clientId: session.clientId }
  };
}
function selectWebAutomationSession(fluxiq, metadata) {
  const requestedSessionId = typeof metadata?.sessionId === "string" ? metadata.sessionId : void 0;
  const sessions = fluxiq.programs.clientGateway.snapshot().sessions.filter(
    (session) => (session.status === "connected" || session.status === "ready") && session.clientType === "extension" && session.capabilities.some(
      (capability) => capability.id === "web.actions" && (capability.metadata?.domainId === WEB_AUTOMATION_DOMAIN_ID || capability.actionTypes?.some((actionType) => actionType.startsWith("web.")))
    )
  );
  if (requestedSessionId) return sessions.find((session) => session.sessionId === requestedSessionId);
  return sessions.length === 1 ? sessions[0] : void 0;
}
function rejected(command, message, code) {
  return {
    commandId: command.commandId ?? `web.rejected.${Date.now()}`,
    status: "rejected",
    completedAt: Date.now(),
    message,
    error: message,
    failure: webAutomationFailureRecord(code, { expected: "a dispatchable web automation command", actual: message })
  };
}
function commandFailure(status, actionType, message, reported, evidenceDigest, withholdComparison) {
  const client = clientReportedFailure(reported, withholdComparison);
  const outcome = {
    // `rejected` is a dispatch status Core's command vocabulary has and the
    // client's does not; a client that refused an action did not run it, which
    // is a failure with a reason, so it classifies as one.
    status: status === "rejected" ? "failed" : status,
    actionType,
    ...message === void 0 ? {} : { message },
    ...client === void 0 ? {} : { failure: client }
  };
  const failure = classifyWebAutomationFailure(void 0, outcome);
  if (failure === void 0) return void 0;
  if (evidenceDigest === void 0 || failure.evidenceDigest !== void 0) return failure;
  return { ...failure, evidenceDigest };
}
function clientReportedFailure(reported, withholdComparison) {
  if (reported === void 0) return void 0;
  const { evidenceDigest } = reported;
  const expected = secretSafeComparisonText(reported.expected, withholdComparison);
  const actual = secretSafeComparisonText(reported.actual, withholdComparison);
  if (isWebAutomationFailureCode(reported.code)) return webAutomationFailureRecord(reported.code, { expected, actual, evidenceDigest });
  const unnamed = `unrecognized web automation failure code: ${reported.code}`;
  return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, {
    expected,
    actual: actual === void 0 ? unnamed : `${actual}; ${unnamed}`,
    evidenceDigest
  });
}
function secretSafeComparisonText(text2, withholdComparison) {
  if (text2 === void 0 || !withholdComparison) return text2;
  return WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT;
}
function secretSafeDispatchPayload(payload) {
  const actionResult = jsonObject(payload.result);
  const validation = jsonObject(actionResult?.validation);
  if (!actionResult || !validation || validation.status === "none") return payload;
  return {
    ...payload,
    result: {
      ...actionResult,
      validation: {
        ...validation,
        ...validation.expected === void 0 ? {} : { expected: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT },
        ...validation.actual === void 0 ? {} : { actual: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT }
      }
    }
  };
}
function failureDiagnostics(status, payload) {
  if (status === "succeeded") return void 0;
  const actionResult = jsonObject(payload?.result);
  if (!actionResult) return void 0;
  const evidence = sanitizedFailureEvidence(actionResult.snapshot);
  const evidenceDigest = evidence === void 0 ? void 0 : createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
  const report = compact3({
    url: safeLocation(actionResult.url),
    title: boundedTitle(actionResult.title),
    selector: boundedSelector(jsonObject(actionResult.element)?.selector),
    evidenceDigest
  });
  if (Object.keys(report).length === 0) return void 0;
  return { report, ...evidence ? { evidence } : {}, ...evidenceDigest ? { evidenceDigest } : {} };
}
function sanitizedFailureEvidence(snapshot) {
  if (!jsonObject(snapshot)) return void 0;
  try {
    return sanitizeWebLlmSnapshot(snapshot, { maxEvidenceBytes: AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES2 });
  } catch {
    return void 0;
  }
}
function dispatchPayloadMessage(payload) {
  const message = payload?.message;
  return typeof message === "string" && message.length > 0 ? message : void 0;
}
function safeLocation(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > 2e3) return void 0;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return void 0;
    return url.username || url.password ? void 0 : `${url.origin}${url.pathname}`;
  } catch {
    return void 0;
  }
}
function boundedTitle(value) {
  return typeof value === "string" && value.length > 0 ? value.slice(0, 300) : void 0;
}
function boundedSelector(value) {
  return typeof value === "string" && value.length > 0 ? value.slice(0, 500) : void 0;
}
function jsonObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function compact3(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== void 0));
}

// src/runtime/tests/adapter-redaction.test.ts
var typeCommand = {
  kind: "execute_action",
  commandId: "command.type",
  outputId: "web.dom.type",
  parameters: { selector: '[data-testid="payment"]' }
};
async function runCommand(result) {
  const fluxiq = {
    programs: {
      clientGateway: {
        snapshot: () => ({
          sessions: [{
            sessionId: "session.one",
            clientId: "client.one",
            status: "ready",
            clientType: "extension",
            capabilities: [{ id: "web.actions", actionTypes: ["web.dom.type"] }]
          }]
        })
      },
      automationStudioClientGateway: { executeAction: async () => result }
    }
  };
  const adapter = createWebAutomationRuntimeAdapter({ fluxiq });
  return await adapter.execute(typeCommand, {});
}
var producerSentinel = "SENTINEL-VALUE-A-PRODUCER-SHOULD-HAVE-WITHHELD";
function sensitivePayload(overrides = {}) {
  return {
    commandId: "client.command.sensitive",
    actionType: "web.dom.type",
    status: "succeeded",
    url: "https://fixture.test/checkout",
    title: "Checkout",
    element: { selector: '[data-testid="payment"]', tagName: "input", inputType: "text", attributes: { autocomplete: "billing cc-number" } },
    validation: { status: "passed", expected: `the field holds "${producerSentinel}"`, actual: `the field holds "${producerSentinel}"` },
    ...overrides
  };
}
var leakingClientRecord = {
  category: "output_not_observed",
  code: "web.validation.output_not_observed",
  retryable: true,
  stage: "verification",
  expected: `the field holds "${producerSentinel}"`,
  actual: `the field holds "${producerSentinel}", which is not the text that was sent`
};
test("a client's failure record for a sensitive control leaves without its comparison", async () => {
  const result = await runCommand({
    commandId: "client.command.fourteen",
    status: "failed",
    message: "The field did not keep the text.",
    failure: leakingClientRecord,
    payload: sensitivePayload({ status: "failed", validation: { status: "failed", expected: `the field holds "${producerSentinel}"`, actual: "the field holds something else" } })
  });
  assert.equal(JSON.stringify(result).includes(producerSentinel), false, "nothing the producer failed to withhold reaches an attempt trace");
  assert.equal(result.failure?.code, "web.validation.output_not_observed", "the classification is untouched: only the two strings are");
  assert.equal(result.failure?.category, "output_not_observed");
  assert.equal(result.failure?.retryable, true);
  assert.equal(result.failure?.expected, WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT);
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure, "Core keeps the withheld record whole");
});
test("a sensitive control's post-condition is withheld from the dispatch payload as well as the record", async () => {
  const result = await runCommand({ commandId: "client.command.sensitive", status: "succeeded", message: "Text entered.", payload: sensitivePayload() });
  assert.equal(JSON.stringify(result).includes(producerSentinel), false, "a succeeded action leaks the same way a failed one does, and is checked the same way");
  const action = result.payload.result;
  assert.deepEqual(action.validation, { status: "passed", expected: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT, actual: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT }, "withheld text leaves without the flag: the flag is the producer's declaration, and a layer that stamps its own output disarms the next guard");
  assert.equal(action.element !== void 0, true, "the descriptor the guard read still rides with the result");
});
test("a code this domain does not name is still withheld before it becomes UNKNOWN", async () => {
  const result = await runCommand({
    commandId: "client.command.fifteen",
    status: "failed",
    message: "The field did not keep the text.",
    failure: { ...leakingClientRecord, code: "web.validation.invented" },
    payload: sensitivePayload({ status: "failed" })
  });
  assert.equal(JSON.stringify(result).includes(producerSentinel), false, "the UNKNOWN branch re-uses the sender's `actual`, so it needs the guard too");
  assert.equal(result.failure?.code, "web.action.unknown");
  assert.match(String(result.failure?.actual), /unrecognized web automation failure code/u, "the drift is still named");
});
test("an ordinary control keeps the comparison an operator acts on", async () => {
  const ordinary = {
    ...leakingClientRecord,
    expected: 'the field holds "synthetic-control-text"',
    actual: 'the field holds ""'
  };
  const result = await runCommand({
    commandId: "client.command.sixteen",
    status: "failed",
    message: "The field did not keep the text.",
    failure: ordinary,
    payload: sensitivePayload({
      status: "failed",
      element: { selector: 'input[name="username"]', tagName: "input", inputType: "text", attributes: { autocomplete: "username" } },
      validation: { status: "failed", expected: 'the field holds "synthetic-control-text"', actual: 'the field holds ""' }
    })
  });
  assert.equal(result.failure?.expected, 'the field holds "synthetic-control-text"', "redaction stays targeted, or it costs every diagnosis");
  assert.equal(result.failure?.actual, 'the field holds ""');
  assert.deepEqual(result.payload.result.validation, { status: "failed", expected: 'the field holds "synthetic-control-text"', actual: 'the field holds ""' });
});
test("the guard reaches exactly as far as the descriptor the client sent", async () => {
  const undescribed = sensitivePayload({ status: "failed" });
  delete undescribed.element;
  const result = await runCommand({
    commandId: "client.command.seventeen",
    status: "failed",
    message: "The field did not keep the text.",
    failure: leakingClientRecord,
    payload: undescribed
  });
  assert.equal(JSON.stringify(result).includes(producerSentinel), true, "with no descriptor this layer cannot judge, and says so here rather than in a comment");
});
var redactedPhrasing = "the field holds a withheld value of 19 characters";
var producerRedactedRecord = {
  category: "output_not_observed",
  code: "web.validation.output_not_observed",
  retryable: true,
  stage: "verification",
  expected: redactedPhrasing,
  actual: `${redactedPhrasing}, which is not the text that was sent`
};
test("a producer that declared it withheld the values keeps its phrasing on both exits", async () => {
  const result = await runCommand({
    commandId: "client.command.eighteen",
    status: "failed",
    message: "The field did not keep the text.",
    failure: producerRedactedRecord,
    payload: sensitivePayload({
      status: "failed",
      validation: { status: "failed", expected: redactedPhrasing, actual: `${redactedPhrasing}, which is not the text that was sent`, redacted: true }
    })
  });
  assert.equal(result.failure?.expected, redactedPhrasing, "the length the producer measured is what a person debugging a read-back needs");
  assert.match(String(result.failure?.actual), /is not the text that was sent/u, "and the half that says the comparison failed");
  assert.equal(String(result.failure?.actual).includes(WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT), false, "a declared redaction is not withheld a second time");
  assert.deepEqual(
    result.payload.result.validation,
    { status: "failed", expected: redactedPhrasing, actual: `${redactedPhrasing}, which is not the text that was sent`, redacted: true },
    "the dispatch payload keeps it too, or the flag buys back nothing"
  );
});
var absentDeclarations = [
  ["no flag at all, which is every client that predates the contract", void 0],
  ["a flag that says the opposite", false],
  ["a string that merely looks like the flag", "true"],
  ["a truthy value that is not the boolean", 1]
];
for (const [what, redacted] of absentDeclarations) {
  test(`an absent declaration withholds: ${what}`, async () => {
    const validation = { status: "failed", expected: `the field holds "${producerSentinel}"`, actual: `the field holds "${producerSentinel}"` };
    if (redacted !== void 0) validation.redacted = redacted;
    const result = await runCommand({
      commandId: "client.command.nineteen",
      status: "failed",
      message: "The field did not keep the text.",
      failure: leakingClientRecord,
      payload: sensitivePayload({ status: "failed", validation })
    });
    assert.equal(JSON.stringify(result).includes(producerSentinel), false, "the flag is the only thing that buys the text through, and this is not the flag");
    assert.equal(result.failure?.expected, WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT);
    assert.equal(result.payload.result.validation !== void 0, true);
  });
}
