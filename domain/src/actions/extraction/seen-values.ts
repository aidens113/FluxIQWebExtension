// What each `where` condition's own read found on the page: one short value per
// condition, beside its counts in the summary's `conditions`.
//
// A condition that names its value by a read of its own is described to the
// judge without the part that addresses the page, so on its own it is only a
// kind of read: `attribute aria-label is present`. Live run
// `run-munw7ffn-fe1cecd2` wrote exactly that for the everything store's
// Brightaisle Plus badge, an icon whose accessible name is "Brightaisle Plus",
// and the judge, told nothing else, advised adding a Plus condition the Flow
// already had. One value the read produced says what the condition is about.
//
// **The first value the condition's read produced on an item that condition
// held of**, whole (no character cut, user 2026-09-30), and `null` when it
// has none: a condition that names a column of the read (whose values are the
// records themselves), one that held of no item, or one that held only where
// its value was absent. One value per condition and
// collected on every read, unlike the rejected samples (`./rejected-samples.ts`),
// because it is one string rather than rows. It is page text, so Core
// screens it before anything says it (`result-verification/read-account`).

/** One value per condition, positionally, beside `conditions.rejected`; `null` where the condition's read produced none on an item it held of. */
export type WebAutomationExtractionConditionSeen = (string | null)[];

/**
 * The values copied whole, or `undefined` when they are not
 * well formed: not one entry per condition, or an entry that is neither a
 * string nor `null`.
 */
export function webAutomationExtractionConditionSeenValue(value: unknown, conditions: number): WebAutomationExtractionConditionSeen | undefined {
  if (!Array.isArray(value) || value.length !== conditions) return undefined;
  if (!value.every((entry) => entry === null || typeof entry === "string")) return undefined;
  return [...(value as (string | null)[])];
}
