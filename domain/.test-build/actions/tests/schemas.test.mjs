// src/actions/tests/schemas.test.ts
import assert from "node:assert/strict";
import test from "node:test";

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

// src/actions/tests/schemas.test.ts
function definitionFor(actionType) {
  const definition = webAutomationActionDefinitions.find((candidate) => candidate.actionType === actionType);
  assert.ok(definition, `${actionType} has no parameter definition`);
  return definition;
}
function propertiesOf(actionType) {
  const properties = definitionFor(actionType).parameterSchema.properties;
  assert.ok(properties && typeof properties === "object" && !Array.isArray(properties), `${actionType} declares no properties`);
  return properties;
}
function requiredOf(actionType) {
  const required = definitionFor(actionType).parameterSchema.required;
  return Array.isArray(required) ? required.filter((key) => typeof key === "string") : [];
}
function objectAt(properties, key) {
  const value = properties[key];
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${key} is not an object schema`);
  return value;
}
test("every action type has exactly one definition, and no definition is orphaned", () => {
  assert.deepEqual(
    webAutomationActionDefinitions.map((definition) => definition.actionType).sort(),
    [...WEB_AUTOMATION_ACTION_TYPES].sort()
  );
  for (const definition of webAutomationActionDefinitions) {
    assert.equal(definition.label.trim().length > 0, true, `${definition.actionType} needs a label`);
    assert.equal(definition.description.trim().length > 0, true, `${definition.actionType} needs a description`);
    assert.equal(definition.parameterSchema.type, "object", `${definition.actionType} parameters must be an object`);
  }
});
test("an element fingerprint carries Core's identity signals", () => {
  const element = objectAt(propertiesOf("web.dom.click"), "element");
  const properties = element.properties;
  for (const signal of ["testId", "accessibleName", "label", "selector", "xpath", "role", "attributes"]) {
    assert.ok(properties[signal], `the element fingerprint is missing ${signal}`);
  }
});
test("web.dom.check names the state to leave the control in", () => {
  const properties = propertiesOf("web.dom.check");
  assert.deepEqual(requiredOf("web.dom.check"), ["selector"]);
  assert.equal(properties.checked.type, "boolean");
  assert.ok(properties.selector && properties.element && properties.visualTarget);
});
test("web.dom.assert carries the condition, its expectation, and a timeout", () => {
  assert.deepEqual(requiredOf("web.dom.assert"), ["assert"]);
  const assertion = objectAt(propertiesOf("web.dom.assert"), "assert");
  assert.deepEqual(assertion.required, ["kind"]);
  const properties = assertion.properties;
  assert.deepEqual(properties.kind.enum, ["exists", "absent", "text", "url", "visible", "enabled"]);
  assert.equal(properties.expected.type, "string");
  assert.equal(properties.timeoutMs.type, "integer");
});
test("web.dom.extract_list mirrors the scenario contract's extract step and bounds its pagination", () => {
  assert.deepEqual(requiredOf("web.dom.extract_list"), ["extractList"]);
  const request = objectAt(propertiesOf("web.dom.extract_list"), "extractList");
  assert.deepEqual(request.required, ["item", "fields"]);
  const properties = request.properties;
  assert.equal(properties.item.type, "string");
  assert.equal(properties.fields.type, "object");
  assert.equal(properties.maxItems.type, "integer");
  const paginate = properties.paginate;
  assert.deepEqual(paginate.required, ["next", "maxPages"]);
  assert.equal(paginate.properties.maxPages.maximum, WEB_AUTOMATION_EXTRACT_MAX_PAGES);
});
test("web.dom.upload carries each file's name, type, and content", () => {
  assert.deepEqual(requiredOf("web.dom.upload"), ["selector", "upload"]);
  const upload = objectAt(propertiesOf("web.dom.upload"), "upload");
  assert.deepEqual(upload.required, ["files"]);
  const files = upload.properties.files;
  assert.equal(files.type, "array");
  assert.deepEqual(files.items.required, ["name", "mimeType", "contentBase64"]);
});
test("web.dom.dialog arms one of the two answers a native dialog accepts", () => {
  assert.deepEqual(requiredOf("web.dom.dialog"), ["dialog"]);
  const dialog = objectAt(propertiesOf("web.dom.dialog"), "dialog");
  assert.deepEqual(dialog.required, ["response"]);
  const properties = dialog.properties;
  assert.deepEqual(properties.response.enum, ["accept", "dismiss"]);
  assert.equal(properties.promptText.type, "string");
});
test("web.browser.tab names the operation and how the tab is identified", () => {
  assert.deepEqual(requiredOf("web.browser.tab"), ["tab"]);
  const tab = objectAt(propertiesOf("web.browser.tab"), "tab");
  assert.deepEqual(tab.required, ["operation"]);
  const properties = tab.properties;
  assert.deepEqual(properties.operation.enum, ["open", "switch", "close"]);
  for (const key of ["url", "active", "tabId", "urlPattern"]) assert.ok(properties[key], `tab is missing ${key}`);
});
test("web.browser.download waits for a named file or the next one", () => {
  assert.deepEqual(requiredOf("web.browser.download"), []);
  const download = objectAt(propertiesOf("web.browser.download"), "download");
  const properties = download.properties;
  assert.equal(properties.filename.type, "string");
  assert.equal(properties.timeoutMs.type, "integer");
});
test("the original eleven gained the parameters D6 added to them", () => {
  assert.equal(propertiesOf("web.browser.navigate").newTab.type, "boolean");
  const option = objectAt(propertiesOf("web.dom.select"), "option");
  assert.deepEqual(option.properties.by.enum, ["value", "label", "index"]);
  const scroll = objectAt(propertiesOf("web.dom.scroll"), "scroll");
  assert.deepEqual(scroll.properties.mode.enum, ["by", "toElement", "untilStable"]);
  assert.ok(scroll.properties.maxScrolls, "untilStable needs a scroll bound");
  assert.ok(propertiesOf("web.dom.scroll").selector);
  const modifiers = objectAt(propertiesOf("web.dom.keypress"), "modifiers");
  for (const key of ["alt", "ctrl", "meta", "shift"]) assert.ok(modifiers.properties[key], `modifiers is missing ${key}`);
  for (const waiting of ["web.dom.wait_for_selector", "web.dom.wait_for_text"]) {
    const wait = objectAt(propertiesOf(waiting), "wait");
    assert.deepEqual(
      wait.properties.condition.enum,
      ["present", "visible", "enabled", "absent", "url", "stable"],
      `${waiting} must offer every wait condition`
    );
  }
});
