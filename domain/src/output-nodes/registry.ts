import type { AutomationStudioNodeDefinition } from "fluxiq/automation-studio/nodes";
import type { WebAutomationActionType } from "../actions/types";
import { webAutomationOutputNodeDefinitions } from "./definitions";

export function getWebAutomationOutputNodeDefinition(outputId: WebAutomationActionType): AutomationStudioNodeDefinition | undefined {
  return webAutomationOutputNodeDefinitions.find((definition) => definition.outputAction?.fixedOutputId === outputId);
}

export function listWebAutomationOutputNodeDefinitions(): AutomationStudioNodeDefinition[] {
  return webAutomationOutputNodeDefinitions.map((definition) => structuredClone(definition));
}
