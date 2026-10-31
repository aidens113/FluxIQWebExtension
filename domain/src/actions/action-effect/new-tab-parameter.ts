import type { AutomationNodeParameter } from "fluxiq/automation-studio/nodes";

/** Ordinary navigation reuses its tab; an unresolved new-tab request may open one. */
export const WEB_AUTOMATION_NEW_TAB_PARAMETER: AutomationNodeParameter = Object.freeze({
  id: "newTab", label: "New Tab", valueType: "boolean", defaultValue: false
});
