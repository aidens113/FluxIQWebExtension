// The one control the defence may press to clear one layer, or none.
//
// Guard 1 of `clear.ts` and the press question of `way-out.ts`, asked of one
// overlay in one place, so the layer that is cleared and the layer whose
// presence makes a missing target worth clearing for (`presence.ts`) are
// decided by the same rule and cannot drift: a layer that asks for what only a
// person can give -- a robot check, a credential or code, a payment
// confirmation (`../challenge-evidence.ts`) -- has no way out here, whatever
// its buttons say.

import { challengeIn } from "../challenge-evidence";
import { dismissControlIn } from "./way-out";

/** The control that clears this overlay, or `undefined` when it is a challenge or carries no way out that may be pressed. */
export function pressableWayOut(overlay: Element): Element | undefined {
  if (challengeIn(overlay, "dialog")) return undefined;
  return dismissControlIn(overlay);
}
