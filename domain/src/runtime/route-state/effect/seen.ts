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
//
// **Or the page still stands where the step found it (t1062).** A step that took
// controls away from under their headings keeps that as `marked` (`./sign.ts`).
// When the page shows every one of them under its heading again and none of what
// the step brought under its own, it is the page the step was made on, with
// nothing the step did on it: `not_seen`, however few names the step added. A
// stepper's Next adds one name ("Back") or none, so the rule above could never
// say it was not done, and a Next carried from an earlier attempt was held on
// every replay of the Flow (company-website `run-mwxixc4p-b7945aed`). Still not
// on the path the step moved to: a page there may have done it another way.

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
  if (!hashes(added)) return "unknown";
  if (path !== undefined && typeof path !== "string") return "unknown";
  const now = webRoutePageFeatures(observed);
  if (path !== undefined && path === now.path) return "unknown";
  const shown = new Set(now.controlHashes);
  if (added.length >= MIN_ADDED_FOR_ABSENCE && !added.some((hash) => shown.has(hash))) return "not_seen";
  return standsWhereFound(effect.marked, now.markedHashes) ? "not_seen" : "unknown";
}

/** Whether the page shows every control the step took away, under its heading, and none it brought (header, t1062). */
function standsWhereFound(marked: unknown, now: readonly string[]): boolean {
  if (typeof marked !== "object" || marked === null || Array.isArray(marked)) return false;
  const { added, removed } = marked as { added?: unknown; removed?: unknown };
  if (!hashes(added) || !hashes(removed) || removed.length === 0) return false;
  const shown = new Set(now);
  return removed.every((hash) => shown.has(hash)) && !added.some((hash) => shown.has(hash));
}

function hashes(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((hash) => typeof hash === "string");
}
