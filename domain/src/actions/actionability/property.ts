import { parseAutomationStudioTargetActionabilityRecord, type AutomationStudioTargetActionabilityRecord } from "fluxiq/automation-studio/actionability";
import { webOwnDataProperty } from "./own-data";

/** The current producer's optional exact-target control, without invoking accessors. */
export function webActionabilityProperty(source: unknown): AutomationStudioTargetActionabilityRecord | undefined {
  const property = webOwnDataProperty(source, "actionability");
  return property.kind === "data" ? parseAutomationStudioTargetActionabilityRecord(property.value) : undefined;
}
