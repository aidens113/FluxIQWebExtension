/**
 * The shape both the signer (`./signature.ts`) and the comparator
 * (`./compare-signatures.ts`) agree on. A change to what is hashed, or how,
 * is a new `version`, so a signature recorded under the old rule is never
 * read as if it followed the new one: the comparator refuses it outright.
 */
export const WEB_ROUTE_SIGNATURE_FORMAT = Object.freeze({
  version: "web-route.v1",
  /** How many of the smallest control-name hashes a signature keeps. */
  sketchSize: 64
} as const);
