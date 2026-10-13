/**
 * The shape both the effect signer (`./sign.ts`) and its judge
 * (`./holds.ts`) agree on. A change to what is hashed, or how, is a new
 * `version`, so an effect recorded under the old rule is never read as if it
 * followed the new one: the judge refuses it outright.
 *
 * Leaving names out of what an act added is not such a change. The names the
 * page changes by itself (t496) and those of a layer the page raised by itself
 * (t499) are hashed exactly as before and simply not kept, and the judge's rule
 * -- every kept name on the page -- reads an effect with fewer names the same
 * way. So `web-effect.v1` stays: an effect saved before t499, layer names and
 * all, checks as it always did, and a newly signed one asks less of the page.
 */
export const WEB_ROUTE_EFFECT_FORMAT = Object.freeze({
  version: "web-effect.v1",
  /** How many of the smallest added (and removed) control-name hashes an effect keeps. */
  sampleSize: 16
} as const);
