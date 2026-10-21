// Whether an action only observes the page (the P5 gate): the domain's own
// classification, read through the one exported question that asks it --
// whether a snapshot may answer a parameter change of that action
// (`webOfflineReadEligible`, which holds exactly the actions the domain's
// safety table marks `safe`). Everything else acts on the page, scrolls
// included: a scroll may load more.

import { webOfflineReadEligible, type WebAutomationActionType } from "@fluxiq-web-extension/domain/node";

export function isObservingAction(actionType: string): boolean {
  return webOfflineReadEligible(actionType as WebAutomationActionType, ["parameters"]);
}
