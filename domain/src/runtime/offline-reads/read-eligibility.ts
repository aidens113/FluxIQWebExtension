// Which changed commands a snapshot may answer (P5, tier 2). Only an action
// the domain itself classifies as observing the page -- `safe` in
// `WEB_AUTOMATION_ACTION_SAFETY`, the one classification the manifest and the
// output nodes derive from -- and only when every difference from the recorded
// operation lies under its parameters or its target. An act is never
// evaluated offline: what it would do lastingly is not in any snapshot, so it
// stays the matcher's gap (tier 3).

import { WEB_AUTOMATION_ACTION_SAFETY } from "../../actions/safety";
import type { WebAutomationActionType } from "../../actions/types";

const COMPARED_ROOTS: readonly string[] = ["parameters", "target"];

export function webOfflineReadEligible(actionType: WebAutomationActionType, fields: readonly string[]): boolean {
  if (WEB_AUTOMATION_ACTION_SAFETY[actionType] !== "safe") return false;
  return fields.length > 0 && fields.every((path) => COMPARED_ROOTS.some((root) => path === root || path.startsWith(`${root}.`)));
}
