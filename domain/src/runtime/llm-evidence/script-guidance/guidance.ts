import type { AutomationStudioFlowScriptGuidance } from "fluxiq/automation-studio";
import { WEB_FLOW_SCRIPT_CONTROL_OPERATIONS } from "./act";

/** Host-authored operation advice, independent of examples and system instructions. */
export const WEB_FLOW_SCRIPT_GUIDANCE: AutomationStudioFlowScriptGuidance = {
  version: "web-guidance-1",
  act: { controlOperations: WEB_FLOW_SCRIPT_CONTROL_OPERATIONS }
};
