// Whether a lasting step's recorded effect (`./sign.ts`) appeared on the page
// observed just after the step answered success -- Core's
// `routeEffectSeen(effect, observed)` (t476). Core asks it of a step that
// declared a lasting consequence and no `done when:`, so that a step whose act
// never took effect is not counted as done: in `run-mv5tusj4-b7ee0630` an Add to
// cart the page only woke on was reported done, and the trial, the playback and
// the build's reset ledger all took a cart line that was never added as made.
//
// Three answers, and only one of them judges anything:
//
//   - `seen` when the effect holds (`./holds.ts`): every control name the step
//     added is on the page, on the path it moved to.
//   - `not_seen` only on strong evidence of absence: the effect is
//     `web-effect.v1`, the step added at least `MIN_ADDED_FOR_ABSENCE` control
//     names, *none* of them is on the page, and the page is not on the path the
//     step moved to. An Add to cart that answers opens its panel -- "View cart",
//     "Continue shopping", the panel's close -- and an add that never happened
//     shows not one of them.
//   - `unknown` otherwise: some of what the step added is there, the step moved
//     to the path the page is on, it added too little to say, or the effect is
//     not one this host reads.
//
// Why none rather than not all: the effect is a sample of up to 16 names the
// recorded run's page gained, and a later run's page need not gain each of them
// -- the panel of a second add may word its quantity differently, a carousel the
// recorded run caught turning is elsewhere now. Every one missing is the act's
// own answer missing. `removed` is not read, for the reason `./holds.ts` gives.

import type { JsonObject } from "fluxiq/core";
import { WEB_ROUTE_EFFECT_FORMAT } from "./format";
import { webAutomationRouteEffectHolds } from "./holds";
import { webRoutePageFeatures } from "../page-features";

/** The fewest control names a step must have added for their absence to say its act did not take effect. */
export const MIN_ADDED_FOR_ABSENCE = 3;

export function webAutomationRouteEffectSeen(effect: JsonObject, observed: JsonObject): "seen" | "not_seen" | "unknown" {
  if (webAutomationRouteEffectHolds(effect, observed)) return "seen";
  if (effect.v !== WEB_ROUTE_EFFECT_FORMAT.version) return "unknown";
  const { added, path } = effect;
  if (!Array.isArray(added) || added.length < MIN_ADDED_FOR_ABSENCE) return "unknown";
  if (!added.every((hash): hash is string => typeof hash === "string")) return "unknown";
  if (path !== undefined && typeof path !== "string") return "unknown";
  const now = webRoutePageFeatures(observed);
  if (path !== undefined && path === now.path) return "unknown";
  const shown = new Set(now.controlHashes);
  return added.some((hash) => shown.has(hash)) ? "unknown" : "not_seen";
}
