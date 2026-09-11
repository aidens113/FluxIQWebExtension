import type { AutomationStudioNodeDefinition } from "fluxiq/automation-studio/nodes";
import { webAutomationOutputNodeDefinitions } from "./definitions";

export function listWebAutomationOutputNodeDefinitions(): AutomationStudioNodeDefinition[] {
  return webAutomationOutputNodeDefinitions.map((definition) => structuredClone(definition));
}
