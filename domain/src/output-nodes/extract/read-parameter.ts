import type { AutomationNodeParameter } from "fluxiq/automation-studio/nodes";
import { WEB_AUTOMATION_EXTRACT_READ_EXAMPLE, WEB_AUTOMATION_EXTRACT_READ_GRAMMAR } from "./catalog-text";

/**
 * The single-value read's `extract` parameter: which value of its target it
 * reads, shaped as `actions/schemas.ts` declares it (`{ mode, attribute? }`,
 * contract C3), with the grammar and example a model reads (`./catalog-text.ts`).
 */
export function webAutomationExtractReadParameter(): AutomationNodeParameter {
  return {
    id: "extract",
    label: "Read",
    description: WEB_AUTOMATION_EXTRACT_READ_GRAMMAR,
    valueType: "object",
    example: structuredClone(WEB_AUTOMATION_EXTRACT_READ_EXAMPLE),
    ui: { control: "value" }
  };
}
