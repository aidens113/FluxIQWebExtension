import type { AutomationStudioTargetActionabilityRecord } from "fluxiq/automation-studio/actionability";
import { webOwnDataProperty } from "./own-data";
import { webActionabilityProperty } from "./property";

/** Lift only after gateway acceptance, keeping the actual wire result untouched. */
export function webActionabilityFromPayload(result: unknown): AutomationStudioTargetActionabilityRecord | undefined {
  const payload = webOwnDataProperty(result, "payload");
  return payload.kind === "data" ? webActionabilityProperty(payload.value) : undefined;
}
