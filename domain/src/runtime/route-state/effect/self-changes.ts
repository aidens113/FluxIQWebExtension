// What one page changed between two route states with nothing done to it in
// between (t496): the control names, as the hashes a step's effect is made of
// (`../page-features.ts`), that the later state shows and the earlier did not
// (`appeared`), and the reverse (`disappeared`). Every one, in order, never a
// sample: the build's memory of what a page changes by itself
// (`../../llm-evidence/plan-resolution/self-changing/`) reads it, and
// the signer (`./sign.ts`) leaves those names out of what an act added.
//
// It says nothing of why. Only its caller knows that no act came between the
// two states and that they are of one document.

import type { JsonObject } from "fluxiq/core";
import { webRoutePageFeatures } from "../page-features";

export function webAutomationRouteSelfChanges(earlier: JsonObject, later: JsonObject): { appeared: string[]; disappeared: string[] } {
  const from = webRoutePageFeatures(earlier).controlHashes;
  const to = webRoutePageFeatures(later).controlHashes;
  const had = new Set(from);
  const has = new Set(to);
  return { appeared: to.filter((hash) => !had.has(hash)), disappeared: from.filter((hash) => !has.has(hash)) };
}
