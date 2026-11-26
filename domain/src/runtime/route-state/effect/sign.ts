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
//
// **Nor is what a layer the page raised by itself shows (t499).** A help or chat
// bubble a page puts up on every load was up on the page a "Set as my store"
// press reloaded, and its control was kept beside the store chip; a later run on
// a page that remembered the store, with the bubble closed by an earlier step,
// never saw the effect hold (`run-mv6i28zl-a53d36db` F1). A caller that can read
// the capture's layers names the controls that sit only in such a layer
// (`pageRaised`: read by `../../llm-evidence/plan-resolution/self-changing/page-raised.ts`,
// hashed by `./layer-only.ts`), and they are left out of `added` -- not of
// `removed`, which is signed from what the act's own page lost and is never
// tested. When the act added nothing else, the layer is what the act opened (a
// press that answers with a dialog on a new page), and its controls are kept.
// The host's own `signRouteEffect` has route states only and names no layer.
//
// **Where it happened, too (t1062): `marked`.** The names say what the page offers, not
// where: a stepper's Next stays "Next" from one step to the next, and a step that only moved
// it on added one name ("Back") or none, too few for its absence to say anything
// (`./seen.ts`). So the effect also keeps the same samples over the names under their
// headings (`../page-features.ts`, `markedHashes`) -- "Next" under "Where are you?" taken
// away, "Back" and "Next" under the next step's heading brought -- whenever the step took
// one away. Company-website `run-mwxixc4p-b7945aed`: the widget's Next, carried from the
// first attempt, was held on every replay because nothing could show it had not been done.
// Hashes only, as the rest; well inside the bound with both samples full.

import type { JsonObject } from "fluxiq/core";
import { WEB_ROUTE_EFFECT_FORMAT } from "./format";
import { webRoutePageFeatures } from "../page-features";

const NONE: ReadonlySet<string> = new Set();

export function webAutomationRouteEffect(before: JsonObject, after: JsonObject, selfChanging: ReadonlySet<string> = NONE, pageRaised: ReadonlySet<string> = NONE): JsonObject {
  const from = webRoutePageFeatures(before);
  const to = webRoutePageFeatures(after);
  // What is left out, most first: the first that leaves the act something it added is signed, else nothing is.
  const tries = [new Set([...selfChanging, ...pageRaised]), selfChanging];
  const effect = tries.map((left) => signed(from.controlHashes, to.controlHashes, left)).find((tried) => (tried.added as string[]).length > 0)
    ?? signed(from.controlHashes, to.controlHashes, NONE);
  if (to.path !== from.path) effect.path = to.path;
  // Where on the page, as well as what (t1062): only a step that took a control away from under its heading says it.
  const marked = { added: smallestMissing(to.markedHashes, from.markedHashes, NONE), removed: smallestMissing(from.markedHashes, to.markedHashes, NONE) };
  if (marked.removed.length > 0) effect.marked = marked;
  return effect;
}

/**
 * The effect's hashes, leaving out every hash in `left`. A layer's controls are
 * on the page the act left, so leaving them out never changes `removed`.
 */
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
