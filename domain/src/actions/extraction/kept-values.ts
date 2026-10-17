// What each `where` condition read on the rows the read kept: a few values per
// condition, beside its counts in the summary's `conditions`.
//
// A condition that holds of every item it is asked about narrows nothing, and
// its counts alone (`rejected: 0`) do not say why. Run `run-mvbr0w7e-6a01c05b`'s
// result repair resent one `is present` condition six decisions running: every
// row had the value, so the condition kept all of them, and nothing it was told
// said that or what it had read on those rows. These values are what it read:
// the first few distinct values each condition tested on items **every**
// condition held of -- the rows the read kept -- whole, at most
// `WEB_AUTOMATION_EXTRACT_CONDITION_KEPT_VALUES_MOST` per condition, and an
// empty list where it read none (a value absent on every kept row).
//
// They are values the condition already tested, never more of the item than
// that, and bounded by count so a list of a thousand rows still sends a few. The
// page collects them on every read (`apps/extension/src/content/extraction/
// item-filter.ts`); they are page text, so the node run's evidence screens them
// with the rest of the read (`../../runtime/llm-evidence/node-run/read-result.ts`)
// and Core carries them onto the draft step only where that evidence shows them.

/** Per condition, positionally beside `conditions.rejected`, the first few distinct values it read on rows the read kept. */
export type WebAutomationExtractionConditionKeptValues = string[][];

/** The most values one condition carries: enough to show what it reads, never the list. */
export const WEB_AUTOMATION_EXTRACT_CONDITION_KEPT_VALUES_MOST = 3;

/**
 * The values copied, or `undefined` when they are not well formed: not one
 * list per condition, a list longer than the bound, or an entry that is not a
 * non-empty string.
 */
export function webAutomationExtractionConditionKeptValuesValue(value: unknown, conditions: number): WebAutomationExtractionConditionKeptValues | undefined {
  if (!Array.isArray(value) || value.length !== conditions) return undefined;
  const lists: string[][] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length > WEB_AUTOMATION_EXTRACT_CONDITION_KEPT_VALUES_MOST) return undefined;
    if (!entry.every((item) => typeof item === "string" && item.length > 0)) return undefined;
    lists.push([...(entry as string[])]);
  }
  return lists;
}
