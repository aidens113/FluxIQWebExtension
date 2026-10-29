// Finding a read's row again among the same read's fresh rows (t786, D4), by
// what the row is and never by where it was: a re-render moves rows, so the
// row's old position is the one thing that cannot say which row it is.
//
// - **With key columns** (`./row-key-columns.ts`) a candidate is the row when
//   its identity under them is the stale row's, as Core computes it for a
//   read's dedupe (`automationStudioRecordRowIdentity`: layout and case aside).
// - **Without** every word column must be equal, spacing and case aside, while
//   a column that says only a number, count, price or time
//   (`./volatile-text.ts`) may differ -- that is what a re-render changes. A
//   word column one side has and the other does not is a difference. So a
//   candidate equal to the stale row except in one word -- the same post text
//   under another author, a title one word apart -- is another item, never
//   this one.
//
// **Exactly one.** One candidate is `found`; none is `gone`; several are
// `unmatched`/`ambiguous`, because picking one of two identical rows is the
// positional guess this exists to avoid. A stale row that says fewer than two
// things an item can be told by -- key or word values, counts and times not
// counted -- is `unmatched`/`unidentifiable`: too little to tell one row from
// another, the same floor a saved control is held to
// (`element-fingerprint/shortfall.ts`).

import type { AutomationStudioTargetReacquireAnswer } from "fluxiq/automation-studio";
import { automationStudioRecordRowIdentity } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { WEB_ELEMENT_IDENTITY_MINIMUM_SIGNALS } from "../../element-fingerprint";
import { webReacquireText } from "./text";
import { webReacquireVolatileText } from "./volatile-text";

/** The one candidate that is the stale row, or why there is none (header). */
export function webReacquireRow(input: { stale: JsonValue; candidates: readonly JsonValue[]; keyColumns: readonly string[] }): AutomationStudioTargetReacquireAnswer {
  const { stale, keyColumns } = input;
  if (!record(stale)) return { outcome: "unmatched", reason: "unidentifiable" };
  const said = Object.keys(stale).filter((column) => (keyColumns.includes(column) && filled(stale[column])) || words(stale[column]) !== undefined);
  if (said.length < WEB_ELEMENT_IDENTITY_MINIMUM_SIGNALS) return { outcome: "unmatched", reason: "unidentifiable" };
  const keyed = keyColumns.length > 0 ? automationStudioRecordRowIdentity(stale, keyColumns) : undefined;
  const rows = input.candidates.filter(record);
  const matches = keyed !== undefined
    ? rows.filter((row) => automationStudioRecordRowIdentity(row, keyColumns) === keyed)
    : rows.filter((row) => sameWords(stale, row));
  if (matches.length === 1) return { outcome: "found", value: matches[0]! };
  return matches.length === 0 ? { outcome: "gone" } : { outcome: "unmatched", reason: "ambiguous" };
}

/** Whether every word column of either row is the same in both (header). */
function sameWords(stale: JsonObject, candidate: JsonObject): boolean {
  const columns = new Set([...Object.keys(stale), ...Object.keys(candidate)]);
  for (const column of columns) {
    const before = words(stale[column]);
    const now = words(candidate[column]);
    if ((before !== undefined || now !== undefined) && before !== now) return false;
  }
  return true;
}

/** A word value as compared, or `undefined` for a blank, a non-string, or a number, count, price or time. */
function words(value: JsonValue | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = webReacquireText(value);
  return text === "" || webReacquireVolatileText(text) ? undefined : text;
}

function filled(value: JsonValue | undefined): boolean {
  return typeof value === "string" ? value.trim() !== "" : value !== undefined && value !== null;
}

function record(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
