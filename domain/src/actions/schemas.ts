import type { JsonObject } from "fluxiq/core";
import type { WebAutomationActionType } from "./types";

export type WebAutomationActionDefinition = {
  actionType: WebAutomationActionType;
  label: string;
  description: string;
  parameterSchema: JsonObject;
};

const elementFingerprintSchema = {
  type: "object",
  label: "Element fingerprint",
  properties: {
    selector: { type: "string", label: "CSS selector" }, xpath: { type: "string", label: "XPath" },
    id: { type: "string", label: "ID" }, classNames: { type: "array", label: "Class names" },
    visibleText: { type: "string", label: "Visible text" }, tagName: { type: "string", label: "Tag name" },
    role: { type: "string", label: "ARIA role" }, name: { type: "string", label: "Accessible name" },
    href: { type: "string", label: "Link URL" }, attributes: { type: "object", label: "Attributes" }
  }
} satisfies JsonObject;

const visualTargetSchema = {
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
} satisfies JsonObject;

const elementProperties = { selector: { type: "string", label: "CSS selector" }, element: elementFingerprintSchema, visualTarget: visualTargetSchema };

const selectorSchema = {
  type: "object",
  required: ["selector"],
  properties: {
    ...elementProperties,
    timeoutMs: { type: "integer", label: "Timeout in ms" }
  }
} satisfies JsonObject;

export const webAutomationActionDefinitions: WebAutomationActionDefinition[] = [
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
