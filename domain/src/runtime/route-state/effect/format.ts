/**
 * The shape both the effect signer (`./sign.ts`) and its judge
 * (`./holds.ts`) agree on. A change to what is hashed, or how, is a new
 * `version`, so an effect recorded under the old rule is never read as if it
 * followed the new one: the judge refuses it outright.
 */
export const WEB_ROUTE_EFFECT_FORMAT = Object.freeze({
  version: "web-effect.v1",
  /** How many of the smallest added (and removed) control-name hashes an effect keeps. */
  sampleSize: 16
} as const);
