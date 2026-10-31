import type { AutomationNodeParameter } from "fluxiq/automation-studio/nodes";

/** Absence means ordinary typing; unresolved values cannot establish that. */
export const WEB_AUTOMATION_SUBMIT_PARAMETER: AutomationNodeParameter = Object.freeze({
  id: "submit", label: "Send Form After Typing", valueType: "boolean", defaultValue: false
});
