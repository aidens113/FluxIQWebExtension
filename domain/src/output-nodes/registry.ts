import type { AutomationStudioNodeDefinition } from "fluxiq/components/automation";
import { webAutomationOutputNodeDefinitions } from "./definitions";

export function listWebAutomationOutputNodeDefinitions(): AutomationStudioNodeDefinition[] {
  return webAutomationOutputNodeDefinitions.map((definition) => structuredClone(definition));
}
