import type { JsonObject } from "fluxiq/core";
import { webAutomationResolvedActionEffect } from "../../actions/action-effect";

/** A lost acknowledgement of a committing action cannot establish it unacted. */
export function webAutomationActionCommits(actionType: string, parameters: JsonObject | undefined): boolean {
  return webAutomationResolvedActionEffect(actionType, parameters)?.effectClass === "commit";
}
