import type { JsonObject } from "fluxiq/core";

// Drop the keys whose value is `undefined`. Every payload in this directory is
// assembled as one object literal with a line per optional field, so a field
// the page did not offer is written as `undefined` and removed here rather than
// reaching the wire as an explicit null that a consumer would read as "observed
// and empty". Only the top level is compacted; nested literals call this too.
export function compactJsonObject(value: Record<string, unknown>): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as JsonObject;
}
