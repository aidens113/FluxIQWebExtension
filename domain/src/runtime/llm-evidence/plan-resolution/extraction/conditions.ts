// Which items of a detected list a plan wants, written as the model was shown
// the list (contract C5).
//
// A detected run is every element the page renders from one template, and a
// results page renders its advertisements from the same template as its
// results: the everything store's four sponsored placements are the same card
// as its sixteen results with a grey label pushed in front. The model could say
// which **columns** to keep (`./columns.ts`) and not which **items**,
// so "collect every product on the first page, leaving out sponsored
// placements" read twenty rows where sixteen were asked for -- right columns,
// wrong row set, and a positional match against the expected table failed on
// every row.
//
// A condition names a detected column and says what must be true of it, so what
// a read narrows by is always a value the page states and the detection showed:
//
//   where: [{ field: "ad_label", is: "absent" }]
//   where: [{ field: "rating", atLeast: 4 }, { field: "price", lessThan: 50 }]
//
// The column is named exactly as a kept column is -- a detected key, a key in
// another case, `column:Header` or a bare header -- and refused exactly as one
// is, so there is one vocabulary for "which column" and not two.
//
// **The resolved condition carries the column's own spec rather than a field
// key**, and that is deliberate. The item a read leaves out is usually one it
// does not want a column for either: a Flow that excludes sponsored placements
// wants sixteen rows of name, price, rating and url, not seventeen columns one
// of which is the ad label. Carrying the spec lets a condition test a column
// the table does not keep, and leaves the saved request able to run with no
// reference to its own field map.
//
// **A bare string is refused rather than read.** `where: ["ad_label"]` could
// only mean `is: "present"`, which is the opposite of what a person writing it
// about sponsored placements means, and a filter that silently keeps the
// complement of what was asked for is worse than one that refuses.

import type { WebAutomationExtractField, WebAutomationExtractItemCondition } from "../../../../actions/extraction";
import { WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS, WEB_AUTOMATION_EXTRACT_CONDITION_PRESENCE } from "../../../../actions/extraction";
import { present } from "../../present";
import { isJsonRecord } from "../../untrusted-json";
import { webExtractionNamedColumn, type WebExtractionColumnIssue } from "./columns";
import type { WebPlanValuePath } from "../handle-tokens";

export type WebExtractionConditions =
  | { ok: true; where: WebAutomationExtractItemCondition[] }
  | { ok: false; issue: WebExtractionColumnIssue; path: WebPlanValuePath };

/** The keys a condition may use to name its column, in the order they are read. The first one written wins, and two that disagree are malformed. */
const COLUMN_KEYS = ["field", "read", "column", "key"] as const;

/** Every key one condition may carry. */
const CONDITION_KEYS: ReadonlySet<string> = new Set<string>([
  ...COLUMN_KEYS,
  "header",
  "handle",
  "location",
  "is",
  ...WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS
]);

const HEADER_PREFIX = "column:";

/**
 * The conditions `where` describes over the detected columns, or why it
 * describes none. `path` is where `where` itself sits in the value.
 *
 * One condition written on its own is read as a list of one: a model that has
 * one thing to say about which items it wants should not have to remember a
 * shape to say it in.
 */
export function keptWebExtractionConditions(where: unknown, detected: Record<string, WebAutomationExtractField>, path: WebPlanValuePath): WebExtractionConditions {
  const written = Array.isArray(where) ? where : [where];
  if (written.length === 0) return { ok: false, issue: "web.handle.malformed", path };
  const conditions: WebAutomationExtractItemCondition[] = [];
  for (const [index, entry] of written.entries()) {
    const at = Array.isArray(where) ? [...path, index] : path;
    const condition = readCondition(entry, detected, at);
    if (!condition.ok) return condition;
    conditions.push(condition.condition);
  }
  return { ok: true, where: conditions };
}

type OneCondition = { ok: true; condition: WebAutomationExtractItemCondition } | { ok: false; issue: WebExtractionColumnIssue; path: WebPlanValuePath };

function readCondition(entry: unknown, detected: Record<string, WebAutomationExtractField>, path: WebPlanValuePath): OneCondition {
  if (!isJsonRecord(entry)) return { ok: false, issue: "web.handle.malformed", path };
  const stray = Object.keys(entry).find((key) => !CONDITION_KEYS.has(key));
  if (stray !== undefined) return { ok: false, issue: "web.handle.malformed", path: [...path, stray] };
  const named = columnName(entry);
  if (named === undefined) return { ok: false, issue: "web.handle.malformed", path };
  const column = webExtractionNamedColumn(named, detected, path);
  if (!column.ok) return column;
  const is = entry.is === undefined ? undefined : presenceOf(entry.is);
  if (entry.is !== undefined && is === undefined) return { ok: false, issue: "web.handle.malformed", path: [...path, "is"] };
  const bounds: Partial<Record<(typeof WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS)[number], number>> = {};
  for (const key of WEB_AUTOMATION_EXTRACT_CONDITION_BOUNDS) {
    const bound = entry[key];
    if (bound === undefined) continue;
    if (typeof bound !== "number" || !Number.isFinite(bound)) return { ok: false, issue: "web.handle.malformed", path: [...path, key] };
    bounds[key] = bound;
  }
  // "The value is not there" and "the number in it is under fifty" cannot both
  // have been meant, so the pair is refused rather than read one way.
  if (is === "absent" && Object.keys(bounds).length > 0) return { ok: false, issue: "web.handle.malformed", path };
  return {
    ok: true,
    condition: present<WebAutomationExtractItemCondition>({
      field: undefined,
      read: column.field,
      is,
      atLeast: bounds.atLeast,
      atMost: bounds.atMost,
      lessThan: bounds.lessThan,
      greaterThan: bounds.greaterThan
    })
  };
}

/** The column the condition names: one of the naming keys, or a table header. Two that disagree name no one column. */
function columnName(entry: Record<string, unknown>): string | undefined {
  const names = [...new Set(COLUMN_KEYS.flatMap((key) => (entry[key] === undefined ? [] : [entry[key]])))];
  if (names.length > 1 || names.some((name) => typeof name !== "string" || name === "")) return undefined;
  const named = names[0] as string | undefined;
  if (named !== undefined) return entry.header === undefined ? named : undefined;
  return typeof entry.header === "string" && entry.header !== "" ? `${HEADER_PREFIX}${entry.header}` : undefined;
}

function presenceOf(value: unknown): "present" | "absent" | undefined {
  return typeof value === "string" && (WEB_AUTOMATION_EXTRACT_CONDITION_PRESENCE as readonly string[]).includes(value)
    ? value as "present" | "absent"
    : undefined;
}
