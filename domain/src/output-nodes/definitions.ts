import type { AutomationNodeParameter, AutomationNodePort } from "fluxiq/automation-studio/nodes";
import type { AutomationStudioNodeDefinition } from "fluxiq/automation-studio/nodes";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import { webAutomationActionDefinitions } from "../actions/schemas";
import type { WebAutomationActionDefinition } from "../actions/schemas";
import type { WebAutomationActionType } from "../actions/types";

const controlInput: AutomationNodePort = { id: "in", label: "In", valueType: "signal", role: "control" };
const outputPorts: AutomationNodePort[] = [
  { id: "success", label: "Success", valueType: "any", role: "success" },
  { id: "failed", label: "Failed", valueType: "any", role: "failure" }
];

export function webAutomationOutputNodeId(outputId: WebAutomationActionType): string {
  return `web.output.${outputId.replace(/^web\./, "").replace(/\./g, "-")}`;
}

export const webAutomationOutputNodeDefinitions: AutomationStudioNodeDefinition[] = webAutomationActionDefinitions.map((definition) =>
  createWebAutomationOutputNodeDefinition(definition)
);

export function createWebAutomationOutputNodeDefinition(definition: WebAutomationActionDefinition): AutomationStudioNodeDefinition {
  const safeOutput = isSafeOutput(definition.actionType);
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
    parameters: parametersForOutput(definition.actionType).map((parameter) => ({
      ...parameter,
      ...(requiredParameters.has(parameter.id) ? { required: true } : {}),
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

function parametersForOutput(outputId: WebAutomationActionType): AutomationNodeParameter[] {
  const selectorParameters: AutomationNodeParameter[] = [
    { id: "target", label: "Adapted Target", valueType: "object", ui: { control: "value" } },
    { id: "selector", label: "Selector", valueType: "string", ui: { control: "text", placeholder: "CSS selector" } },
    { id: "element", label: "Element", valueType: "object", ui: { control: "value" } },
    { id: "visualTarget", label: "Visual Target", valueType: "object", ui: { control: "value" } },
    { id: "timeoutMs", label: "Timeout", valueType: "number", defaultValue: 10_000 }
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
    { id: "timeoutMs", label: "Timeout", valueType: "number", defaultValue: 10_000 }
  ];
  if (outputId === "web.dom.capture_snapshot") return [];
  return selectorParameters;
}

function isSafeOutput(outputId: WebAutomationActionType): boolean {
  return outputId === "web.dom.extract" || outputId === "web.dom.capture_snapshot" || outputId.startsWith("web.dom.wait");
}

function iconForOutput(outputId: WebAutomationActionType): string {
  if (outputId === "web.browser.navigate") return "navigation";
  if (outputId === "web.dom.click") return "mouse-pointer-click";
  if (outputId === "web.dom.type") return "text-cursor-input";
  if (outputId === "web.dom.extract") return "scan-search";
  if (outputId === "web.dom.capture_snapshot") return "camera";
  return "square-dot";
}
