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
//
// **What the page changes by itself is not the act's (t496).** A banner that
// turns every few seconds turned between the look an act was made from and the
// page the act left, and its new slide's link was kept as something the act
// added. `./holds.ts` needs every added name on the page, so a run on a page
// that already showed the act's effect saw it only while that slide was up:
// the store step of `run-mv6eq215-a986f1f3` failed twice and then held, on a
// page that never changed. So a caller that has seen the page change names by
// itself, with nothing done to it (`selfChanging`, hashes as in `./self-changes.ts`),
// has them left out of `added` and `removed` before the sample is taken.
// Should nothing the act added be left, the effect is signed as before: an
// effect that added nothing never holds, and the step keeps the effect it had.

import type { JsonObject } from "fluxiq/core";
import { WEB_ROUTE_EFFECT_FORMAT } from "./format";
import { webRoutePageFeatures } from "../page-features";

const NONE: ReadonlySet<string> = new Set();

export function webAutomationRouteEffect(before: JsonObject, after: JsonObject, selfChanging: ReadonlySet<string> = NONE): JsonObject {
  const from = webRoutePageFeatures(before);
  const to = webRoutePageFeatures(after);
  const steady = signed(from.controlHashes, to.controlHashes, selfChanging);
  const effect = (steady.added as string[]).length > 0 || selfChanging.size === 0 ? steady : signed(from.controlHashes, to.controlHashes, NONE);
  if (to.path !== from.path) effect.path = to.path;
  return effect;
}

/** The effect's hashes, leaving out every hash in `left`. */
function signed(from: readonly string[], to: readonly string[], left: ReadonlySet<string>): JsonObject {
  return {
    v: WEB_ROUTE_EFFECT_FORMAT.version,
    added: smallestMissing(to, from, left),
    removed: smallestMissing(from, to, left)
  };
}

/** The smallest hashes of `sorted` that `other` lacks and `left` does not hold, in order; `sorted` is already sorted. */
function smallestMissing(sorted: readonly string[], other: readonly string[], left: ReadonlySet<string>): string[] {
  const exclude = new Set(other);
  return sorted.filter((hash) => !exclude.has(hash) && !left.has(hash)).slice(0, WEB_ROUTE_EFFECT_FORMAT.sampleSize);
}
