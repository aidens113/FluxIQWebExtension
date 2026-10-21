// How one step of a candidate's plan moves where the next step stands (`./views.ts`, t748 U1): a press names
// the control it presses, so the next step stands where exploration's press of it led; a step that only reads, or
// acts on a control in place, leaves the page where it was; anything else -- a navigation, a key, a page fact, a
// node this domain does not run -- may move it anywhere, so the next step stands nowhere in particular.

import type { JsonObject } from "fluxiq/core";
import { webAutomationActionEffect } from "../../../../actions/effect";
import { webAutomationActionDefinitions } from "../../../../actions/schemas";
import type { WebAutomationActionType } from "../../../../actions/types";
import { webAutomationOutputNodeId } from "../../../../output-nodes";
import { webPlanFirstTargetHandle } from "../first-target-handle";
import type { WebLlmPlanStepMove } from "./views";

/** The acts that work on one control where it is, leaving the page standing. */
const IN_PLACE: ReadonlySet<WebAutomationActionType> = new Set(["web.dom.type", "web.dom.clear", "web.dom.select", "web.dom.scroll", "web.dom.check", "web.dom.upload"]);
const ACTION_OF_NODE: ReadonlyMap<string, WebAutomationActionType> = new Map(webAutomationActionDefinitions.map((definition) => [webAutomationOutputNodeId(definition.actionType), definition.actionType]));

/** How the step `nodeDefinitionId` with the parameters it was written with moves where the next one stands (header). */
export function webPlanStepMove(step: { nodeDefinitionId: string; parameters: JsonObject }): WebLlmPlanStepMove {
  const action = ACTION_OF_NODE.get(step.nodeDefinitionId);
  if (action === undefined) return "moves";
  if (action === "web.dom.click") {
    const handle = webPlanFirstTargetHandle(step.parameters);
    return handle === undefined ? "moves" : { press: handle };
  }
  return webAutomationActionEffect(action) === "observe" || IN_PLACE.has(action) ? "stays" : "moves";
}
