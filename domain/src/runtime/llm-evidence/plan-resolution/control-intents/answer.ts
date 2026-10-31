import type { AutomationStudioResolvedControlIntent } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { WebPlanHandleView, WebPlanNodeResolution } from "../resolve-plan-node";
import type { WebLlmTargetReach } from "../target-packets";
import { present } from "../../present";

/** Construct the narrow host answer; semantic intent never enters executable parameters or saved identity. */
export function webPlanResolvedAnswer(outcome: {
  parameters: JsonObject;
  views: readonly WebPlanHandleView[];
  effect?: JsonObject | undefined;
  controlIntent?: AutomationStudioResolvedControlIntent | undefined;
}, reach: WebLlmTargetReach | undefined): WebPlanNodeResolution {
  const answer: Extract<WebPlanNodeResolution, { status: "resolved" }> = { status: "resolved", parameters: outcome.parameters };
  if (outcome.controlIntent !== undefined) answer.controlIntent = { ...outcome.controlIntent };
  if (reach === "view_history" && outcome.effect !== undefined) answer.effect = outcome.effect;
  if (reach !== "view_history" || outcome.views.length === 0) return answer;
  const seen = new Set<string>();
  const handleViews: WebPlanHandleView[] = [];
  for (const entry of outcome.views) {
    const key = `${entry.handle}\u0000${entry.view}\u0000${entry.location}`;
    if (seen.has(key)) continue;
    seen.add(key);
    handleViews.push(present<WebPlanHandleView>({ handle: entry.handle, view: entry.view, location: entry.location, control: entry.control }));
  }
  answer.handleViews = handleViews;
  return answer;
}
