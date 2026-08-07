import { webAutomationActionDefinitions } from "../actions/schemas";
import { actionInputDefinitions, stateInputDefinitions } from "./input-model";

/** Static domain contract shared by the host module and the runtime IO adapters. */
export const webAutomationManifestInputs = [
  ...stateInputDefinitions,
  ...actionInputDefinitions.map(([id, title, outputId]) => ({ id, title, role: "action" as const, outputId }))
];

export const webAutomationManifestOutputs = webAutomationActionDefinitions.map((action) => ({
  id: action.actionType,
  title: action.label,
  description: action.description,
  schema: action.parameterSchema,
  capabilities: ["web.actions"],
  safety: { level: action.actionType === "web.dom.extract" || action.actionType.startsWith("web.dom.wait") ? "safe" as const : "review" as const, requiresApproval: action.actionType !== "web.dom.extract" }
}));
