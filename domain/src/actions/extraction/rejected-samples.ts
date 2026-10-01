// The rows each `where` condition turned down, for the model that is
// still writing the conditions -- and for nobody else.
//
// Counts cannot tell a condition that removed advertisements from one that
// removed answers. Live run `run-munq5s8x-6d620cdf` wrote
// `name not contains ["ear tips", "charging case", ...]` to leave accessories
// out, and three of the thirteen true earbuds are named "... Wireless Charging
// Case ...". Build and re-author both saw `rejected: [13, 20, 27, 16]` and
// nothing else, so neither could see that the accessory rule was eating
// earbuds. A row it rejected, read by the model that wrote it, says so at once.
//
// **These are page values, which nothing else on the summary is**, so they are
// held to four rules that together keep them where they are useful:
//
// - **Asked for, never sent by default.** The page collects them only when the
//   command carries `rejectedSamples: true` beside `extractList`, which the
//   exploring node run adds to the one command it dispatches and never to the
//   parameters the Flow keeps (`runtime/llm-evidence/node-run/rejected-rows.ts`).
//   A Flow played back asks for none, so no stored result, dataset, bundle or
//   run artifact of a playback can carry one.
// - **Every row, whole.** No row count and no character cut (user, 2026-09-30:
//   "Remove ANY AND ALL LIMITS ON THE NUMBER OF ELEMENTS PASSED TO MODEL. DO NOT
//   HIDE INFORMATION"). What keeps a secret out is the screen the node run puts
//   every row through, the kept rows' own (`runtime/llm-evidence/node-run/
//   rejected-rows.ts`), not a bound.
// - **Declared fields only.** A row carries keys of the read's own
//   `fieldNames` and nothing else, exactly as a kept row does; an excluded
//   column is never read (D12), and a sensitive one refuses the whole read (D2)
//   before any row, kept or rejected, exists.
// - **One list per condition, positionally**, beside `conditions.rejected`, so
//   `rejectedSamples[2]` are rows `where[2]` turned down. A row several
//   conditions rejected is a sample of each.
// - **The rows a condition removed alone lead its list**, and
//   `rejectedSamplesAlone[2]` says how many: rows every other condition held
//   of, which are the ones that show whether `where[2]` is right. On
//   `run-mup2u8o3-6697c4be` the accessory rule's 20 rows hid that it was eating
//   earbuds; its 5 alone rows were 2 accessories and the 3 true pairs.

import type { WebAutomationExtractionSummary } from "./summary";

/** The parameter, and the summary member, that ask for and carry the samples: one name, so the two cannot drift. */
export const WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY = "rejectedSamples" satisfies keyof WebAutomationExtractionSummary;

/** The summary member that says how many leading rows of each list its condition removed alone. */
export const WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_ALONE_KEY = "rejectedSamplesAlone" satisfies keyof WebAutomationExtractionSummary;

/** One rejected row: a declared field's value, or `null` where an optional field was unreadable. */
export type WebAutomationExtractionRejectedRow = Record<string, string | null>;

/**
 * The rows copied whole, or `undefined` when they are not
 * well formed: not one list per condition, a row that is not a record of
 * strings or `null`, or a key the read does not declare.
 */
export function webAutomationExtractionRejectedSamplesValue(
  value: unknown,
  conditions: number,
  fieldNames: readonly string[]
): WebAutomationExtractionRejectedRow[][] | undefined {
  if (!Array.isArray(value) || value.length !== conditions) return undefined;
  const out: WebAutomationExtractionRejectedRow[][] = [];
  for (const rows of value) {
    if (!Array.isArray(rows)) return undefined;
    const kept: WebAutomationExtractionRejectedRow[] = [];
    for (const row of rows) {
      const copied = rowValue(row, fieldNames);
      if (copied === undefined) return undefined;
      kept.push(copied);
    }
    out.push(kept);
  }
  return out;
}

function rowValue(value: unknown, fieldNames: readonly string[]): WebAutomationExtractionRejectedRow | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row: WebAutomationExtractionRejectedRow = {};
  for (const [key, cell] of Object.entries(value)) {
    if (!fieldNames.includes(key)) return undefined;
    if (cell === null) row[key] = null;
    else if (typeof cell === "string") row[key] = cell;
    else return undefined;
  }
  return row;
}

/**
 * How many leading rows of each list its condition removed alone, copied, or
 * `undefined` when it is not one count per list, none above its list's length.
 */
export function webAutomationExtractionRejectedSamplesAloneValue(
  value: unknown,
  lists: readonly (readonly WebAutomationExtractionRejectedRow[])[]
): number[] | undefined {
  if (!Array.isArray(value) || value.length !== lists.length) return undefined;
  const out: number[] = [];
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "number" || !Number.isSafeInteger(entry) || entry < 0 || entry > (lists[index]?.length ?? 0)) return undefined;
    out.push(entry);
  }
  return out;
}
