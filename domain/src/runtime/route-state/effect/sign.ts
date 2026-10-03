// The effect a Flow node keeps of what its step did to the page (t243): Core's
// `signRouteEffect(before, after)` over the full route states either side of
// the step. When the step later cannot run, Core hands it to
// `./holds.ts` to ask whether the page already shows what the step did,
// as when a site remembers the store a recorded step chose.
//
// It holds hashes only, the same names and hashes as the route signature's
// `controls` (`../page-features.ts`), so it carries no page text and stays
// well inside Core's 2,048-character bound -- 32 hashes of 8 characters and a
// path hash at most:
//
//   - `added`: the 16 smallest hashes of the control names `after` has and
//     `before` has not, sorted;
//   - `removed`: the same for the names `before` has and `after` has not;
//   - `path`: the path shape `after` is on, present only when the step moved
//     to another shape.

import type { JsonObject } from "fluxiq/core";
import { WEB_ROUTE_EFFECT_FORMAT } from "./format";
import { webRoutePageFeatures } from "../page-features";

export function webAutomationRouteEffect(before: JsonObject, after: JsonObject): JsonObject {
  const from = webRoutePageFeatures(before);
  const to = webRoutePageFeatures(after);
  const effect: JsonObject = {
    v: WEB_ROUTE_EFFECT_FORMAT.version,
    added: smallestMissing(to.controlHashes, from.controlHashes),
    removed: smallestMissing(from.controlHashes, to.controlHashes)
  };
  if (to.path !== from.path) effect.path = to.path;
  return effect;
}

/** The smallest hashes of `sorted` that `other` lacks, in order; `sorted` is already sorted. */
function smallestMissing(sorted: readonly string[], other: readonly string[]): string[] {
  const exclude = new Set(other);
  return sorted.filter((hash) => !exclude.has(hash)).slice(0, WEB_ROUTE_EFFECT_FORMAT.sampleSize);
}
