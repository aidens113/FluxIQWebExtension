// The longest run of a memory's entries, most important first, that fits a
// byte budget once stored (t737).
//
// Core bounds one stored value (`AUTOMATION_STUDIO_DOMAIN_BUILD_STATE_LIMITS`,
// 64 KiB) and refuses a write past it outright, which left a memory that grew
// past the bound with only its last stored copy (`./persistence.ts`). A memory
// whose entries can grow without bound picks the ones that matter most, puts
// them first, and stores only the run of them this returns.
//
// Bytes are counted as Core counts them: UTF-8 of the JSON, here of the list
// the entries make (`[a,b,...]`), so a caller adds what surrounds it.

import type { JsonValue } from "fluxiq/core";

const encoder = new TextEncoder();
const bytes = (value: JsonValue): number => encoder.encode(JSON.stringify(value)).length;

/** The longest leading run of `entries` whose serialized list is at most `budget` bytes; none when even `[]` is not. */
export function webNodeStoredPrefix<T extends JsonValue>(entries: readonly T[], budget: number): T[] {
  // The brackets of the list.
  let used = 2;
  if (used > budget) return [];
  const kept: T[] = [];
  for (const entry of entries) {
    // Every entry after the first brings its comma.
    const cost = bytes(entry) + (kept.length > 0 ? 1 : 0);
    if (used + cost > budget) break;
    used += cost;
    kept.push(entry);
  }
  return kept;
}
