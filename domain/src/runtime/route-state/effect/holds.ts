// Whether a step's recorded effect (`./sign.ts`) is already on the page
// observed now -- Core's `routeEffectHolds(effect, observed)` (t243). Core asks
// it when the step cannot run; when it holds, the run takes the step's own
// success edge instead of running the ladder.
//
// It holds only on positive evidence, when all of these are true:
//
//   - the effect is `web-effect.v1`;
//   - the step added at least one control name: an effect that added nothing
//     says nothing about the page, so it never holds;
//   - every added hash is among the hashes of all the observed page's control
//     names, taken exactly rather than through a sketch;
//   - when the step moved to another path shape, the observed page is on it.
//
// `removed` is deliberately not tested. A layer the run itself opened, such as
// the store picker an earlier step opens, may still show controls the step's
// recorded run removed (another store's "Set as my store"), and the page has
// still done what the step does.

import type { JsonObject } from "fluxiq/core";
import { WEB_ROUTE_EFFECT_FORMAT } from "./format";
import { webRoutePageFeatures } from "../page-features";

export function webAutomationRouteEffectHolds(effect: JsonObject, observed: JsonObject): boolean {
  if (effect.v !== WEB_ROUTE_EFFECT_FORMAT.version) return false;
  const { added, path } = effect;
  if (!Array.isArray(added) || added.length === 0) return false;
  if (!added.every((hash): hash is string => typeof hash === "string")) return false;
  if (path !== undefined && typeof path !== "string") return false;
  const now = webRoutePageFeatures(observed);
  if (path !== undefined && path !== now.path) return false;
  const shown = new Set(now.controlHashes);
  return added.every((hash) => shown.has(hash));
}
