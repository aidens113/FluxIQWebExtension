import { resolveAutomationStudioNodeActionEffect, type AutomationStudioResolvedActionEffect } from "fluxiq/automation-studio/action-effect";
import { WEB_AUTOMATION_NODE_ACTION_EFFECT } from "./table";
import { WEB_AUTOMATION_SUBMIT_PARAMETER } from "./submit-parameter";
import { WEB_AUTOMATION_NEW_TAB_PARAMETER } from "./new-tab-parameter";

/** Resolve from raw parameters: never erase unresolved bindings before this. */
export function webAutomationResolvedActionEffect(actionType: string, parameters?: Readonly<Record<string, unknown>>): AutomationStudioResolvedActionEffect | undefined {
  if (!Object.hasOwn(WEB_AUTOMATION_NODE_ACTION_EFFECT, actionType)) return undefined;
  const actionEffect = WEB_AUTOMATION_NODE_ACTION_EFFECT[actionType as keyof typeof WEB_AUTOMATION_NODE_ACTION_EFFECT];
  const schema = actionType === "web.dom.type" ? [WEB_AUTOMATION_SUBMIT_PARAMETER]
    : actionType === "web.browser.navigate" ? [WEB_AUTOMATION_NEW_TAB_PARAMETER] : [];
  return resolveAutomationStudioNodeActionEffect({ actionEffect, parameters: schema }, parameters);
}
