import type { AutomationStudioFlowScriptExamples } from "fluxiq/automation-studio";
import { WEB_FLOW_SCRIPT_FORMAT_EXAMPLES } from "./format";
import { WEB_FLOW_SCRIPT_ACT_EXAMPLES } from "./act";
import { WEB_FLOW_SCRIPT_LOOP_EXAMPLES } from "./loop";
import { WEB_FLOW_SCRIPT_STATE_EXAMPLES } from "./state";

/** Web-authored worked examples, independently versioned from system instructions. */
export const WEB_FLOW_SCRIPT_EXAMPLES: AutomationStudioFlowScriptExamples = {
  version: "web-examples-1",
  format: WEB_FLOW_SCRIPT_FORMAT_EXAMPLES,
  act: WEB_FLOW_SCRIPT_ACT_EXAMPLES,
  loop: WEB_FLOW_SCRIPT_LOOP_EXAMPLES,
  state: WEB_FLOW_SCRIPT_STATE_EXAMPLES
};
