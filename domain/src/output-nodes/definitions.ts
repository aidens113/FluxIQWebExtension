import type { AutomationNodeParameter, AutomationNodePort } from "fluxiq/automation-studio/nodes";
import type { AutomationStudioNodeDefinition } from "fluxiq/automation-studio/nodes";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import { WEB_AUTOMATION_ACTION_SAFETY } from "../actions/safety";
import { webAutomationActionDefinitions } from "../actions/schemas";
import type { WebAutomationActionDefinition } from "../actions/schemas";
import type { WebAutomationActionType } from "../actions/types";

const controlInput: AutomationNodePort = { id: "in", label: "In", valueType: "signal", role: "control" };
const outputPorts: AutomationNodePort[] = [
  { id: "success", label: "Success", valueType: "any", role: "success" },
  { id: "failed", label: "Failed", valueType: "any", role: "failure" }
];

/**
 * The post-conditions Core's transition comparison evaluates after the action.
 *
 * Core reads `node.parameterValues.expectedState` (`runtime/executor/
 * expected-transition.ts`) and hands it to the host boundary's
 * `expectationEvaluator` (`runtime/executor/transition-comparison.ts`), which
 * the domain binds over the `web.dom.assert` condition vocabulary. Declaring
 * the parameter here is what puts a value at that path for an authored or
 * generated web node: nothing else in this repository writes it, so without
 * this declaration the comparison has nothing to evaluate and Core falls back
 * to counting keys of an object that is never present.
 *
 * The shape is the assert request plus the element it is about:
 * `{ conditions: [{ kind, selector?, expected?, timeoutMs? }], mode?, timeoutMs? }`,
 * `kind` one of `exists`, `absent`, `text`, `url`, `visible`, `enabled`
 * (`actions/types.ts`, `WebAutomationAssertKind`), `mode` `all` or `any`.
 * It carries no default: an empty condition list would ask the host to prove
 * nothing and report a pass.
 */
const expectedStateParameter: AutomationNodeParameter = {
  id: "expectedState",
  label: "Expected State",
  description: "Post-conditions checked after this action, as web.dom.assert conditions: { conditions: [{ kind, selector, expected }], mode, timeoutMs }.",
  valueType: "object",
  ui: { control: "value" }
};

export function webAutomationOutputNodeId(outputId: WebAutomationActionType): string {
  return `web.output.${outputId.replace(/^web\./, "").replace(/\./g, "-")}`;
}

export const webAutomationOutputNodeDefinitions: AutomationStudioNodeDefinition[] = webAutomationActionDefinitions.map((definition) =>
  createWebAutomationOutputNodeDefinition(definition)
);

export function createWebAutomationOutputNodeDefinition(definition: WebAutomationActionDefinition): AutomationStudioNodeDefinition {
  const safeOutput = WEB_AUTOMATION_ACTION_SAFETY[definition.actionType] === "safe";
  const requiredParameters = new Set(
    Array.isArray(definition.parameterSchema.required)
      ? definition.parameterSchema.required.filter((value): value is string => typeof value === "string")
      : []
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
      ...(requiredParameters.has(parameter.id) ? { required: true } : {}),
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
      ...(requiredParameters.has("selector") ? { elementTarget: true } : {})
    }
  };
}

function parametersForOutput(outputId: WebAutomationActionType): AutomationNodeParameter[] {
  const selectorParameters: AutomationNodeParameter[] = [
    { id: "target", label: "Adapted Target", valueType: "object", ui: { control: "value" } },
    { id: "selector", label: "Selector", valueType: "string", ui: { control: "text", placeholder: "CSS selector" } },
    { id: "element", label: "Element", valueType: "object", ui: { control: "value" } },
    { id: "visualTarget", label: "Visual Target", valueType: "object", ui: { control: "value" } },
    { id: "timeoutMs", label: "Timeout", valueType: "number", defaultValue: 10_000 }
  ];
  // A structured parameter is an `object` whose shape is the matching field of
  // `WebAutomationActionCommand`, declared in `actions/schemas.ts`. The flat
  // scalars beside it stay authorable, and a recorded action fills them.
  const structured = (id: string, label: string): AutomationNodeParameter => ({ id, label, valueType: "object", ui: { control: "value" } });
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
    { id: "timeoutMs", label: "Timeout", valueType: "number", defaultValue: 10_000 },
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

function iconForOutput(outputId: WebAutomationActionType): string {
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
