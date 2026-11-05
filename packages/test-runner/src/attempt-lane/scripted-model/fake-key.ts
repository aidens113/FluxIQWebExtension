/**
 * The key a scripted run installs through Secret Keys, so everything between the
 * chat and the provider call is the product's. It is built from parts because both
 * repositories are public, and it opens nothing: every call it signs goes to the
 * scripted server, which refuses any other.
 */
export function scriptedModelKey(): string {
  return ["sk", "live", "a1b2".repeat(8)].join("_");
}
