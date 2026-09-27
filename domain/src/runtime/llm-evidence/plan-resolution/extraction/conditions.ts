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
//   where: [{ field: "title", contains: ["ear tips", "charging case"], not: true }]
//
// The column is named exactly as a kept column is -- a detected key, a key in
// another case, `column:Header` or a bare header, or the nearest column to a
// name written slightly wrong (`./column-match.ts`) -- and refused exactly as
// one is, so there is one vocabulary for "which column" and not two.
//
// What the condition then *says* about that column is not this file's
// vocabulary either: it is `actions/extraction/condition-grammar.ts`, the one
// the dispatch reader also uses. On 2026-09-24 an instruction carrying three
// qualifying conditions and two exclusions reached the Flow carrying none of
// them (`run-mug1z9k9-ef625d8b`), and a grammar the resolver accepted but the
// page refused would be the same wrong answer with more steps.
//
// **The resolved condition carries the column's own spec rather than a field
// key**, and that is deliberate. The item a read leaves out is usually one it
// does not want a column for either: a Flow that excludes sponsored placements
// wants sixteen rows of name, price, rating and url, not seventeen columns one
// of which is the ad label. Carrying the spec lets a condition test a column
// the table does not keep, and leaves the saved request able to run with no
// reference to its own field map.
//
// **A condition may also name a column by the key the plan keeps it under**,
// and until 2026-09-23 it could not. A plan that keeps a column renames it --
// `fields: { rating: "css-1f32dgn", price: "css-00egoa7" }` -- and the next
// thing it writes is `where: [{ field: "rating", atLeast: 4 }]`, in the words
// it has just this moment invented. That named no detected column and was
// refused `web.handle.unknown_field`, so the one condition that survived a live
// build was the one over a column the plan did *not* keep and therefore did not
// rename: the advertisement mark, named by its detected key. Both first-page
// reads of the 2026-09-23 campaign left the sponsored cards out and applied no
// other condition at all (`run-mudwci8d-de88aa32`, `run-mudw1ktb-0557816b`,
// twelve rows of an unnarrowed page), which is exactly the shape of a
// vocabulary that accepts the mark and refuses "rated 4.0 or higher".
//
// The plan's own keys are not a guess: they are declared in the same object,
// two lines above, and each names one detected column. The detected vocabulary
// is still read first, so a key that means something to the detection keeps
// meaning it; only a name the detection does not know is looked for among the
// columns the plan kept.
//
// **A bare string is refused rather than read.** `where: ["ad_label"]` could
// only mean `is: "present"`, which is the opposite of what a person writing it
// about sponsored placements means, and a filter that silently keeps the
// complement of what was asked for is worse than one that refuses.

import type { WebAutomationExtractField, WebAutomationExtractItemCondition } from "../../../../actions/extraction";
import { webAutomationExtractConditionSayingValue } from "../../../../actions/extraction";
import { present } from "../../present";
import { isJsonRecord } from "../../untrusted-json";
import { webExtractionComparedShape, type WebExtractionColumnAssumption } from "./column-match";
import { webExtractionNamedColumn, type WebExtractionColumn, type WebExtractionColumnIssue, type WebExtractionColumnLook } from "./columns";
import type { WebPlanValuePath } from "../handle-tokens";

export type WebExtractionConditions =
  /** `where` is empty when the clause was written and says nothing, which is what writing no clause says. */
  | { ok: true; where: WebAutomationExtractItemCondition[]; assumed: WebExtractionColumnAssumption[] }
  | { ok: false; issue: WebExtractionColumnIssue; path: WebPlanValuePath };

/**
 * The columns a condition may name: the ones the detection showed the model,
 * and the ones this same plan keeps, under the model's own keys.
 */
export type WebExtractionConditionColumns = {
  detected: Record<string, WebAutomationExtractField>;
  kept: Record<string, WebAutomationExtractField>;
};

/** The keys a condition may use to name its column, in the order they are read. The first one written wins, and two that disagree are malformed. */
const COLUMN_KEYS = ["field", "read", "column", "key"] as const;

/**
 * The keys this file reads for itself: the ones that name the column, and the
 * two a `read` reference carries. Every other key is a phrase about the value,
 * read by the one grammar the dispatch also reads
 * (`actions/extraction/condition-grammar.ts`), so a condition this resolver
 * accepts is a condition the page runs.
 */
const NAMING_KEYS: readonly string[] = [...COLUMN_KEYS, "header", "handle", "location"];

const HEADER_PREFIX = "column:";

/**
 * The conditions `where` describes over the detected columns, or why it
 * describes none. `path` is where `where` itself sits in the value.
 *
 * One condition written on its own is read as a list of one: a model that has
 * one thing to say about which items it wants should not have to remember a
 * shape to say it in.
 *
 * An empty clause resolves to no conditions rather than being refused. Writing
 * `where: []` says what writing no `where` says, filtering is optional, and
 * where a shape can be read two ways the wider reading wins.
 */
export function keptWebExtractionConditions(where: unknown, columns: WebExtractionConditionColumns, path: WebPlanValuePath): WebExtractionConditions {
  const written = Array.isArray(where) ? where : [where];
  if (written.length === 0) return { ok: true, where: [], assumed: [] };
  const conditions: WebAutomationExtractItemCondition[] = [];
  const assumed: WebExtractionColumnAssumption[] = [];
  for (const [index, entry] of written.entries()) {
    const at = Array.isArray(where) ? [...path, index] : path;
    const condition = readCondition(entry, columns, at);
    if (!condition.ok) return condition;
    conditions.push(condition.condition);
    if (condition.assumed !== undefined) assumed.push(condition.assumed);
  }
  return { ok: true, where: conditions, assumed };
}

type OneCondition =
  | { ok: true; condition: WebAutomationExtractItemCondition; assumed: WebExtractionColumnAssumption | undefined }
  | { ok: false; issue: WebExtractionColumnIssue; path: WebPlanValuePath };

function readCondition(entry: unknown, columns: WebExtractionConditionColumns, path: WebPlanValuePath): OneCondition {
  if (!isJsonRecord(entry)) return { ok: false, issue: "web.handle.malformed", path };
  const named = columnName(entry);
  if (named === undefined) return { ok: false, issue: "web.handle.malformed", path };
  // What the condition *says* is read before the column it says it about,
  // because a comparison on the number in a value is a signal for which column
  // was meant (`./column-match.ts`). Which refusal wins is unchanged: the column
  // is still answered for before the grammar is.
  const says = webAutomationExtractConditionSayingValue(entry, NAMING_KEYS);
  const column = conditionColumn(named, columns, webExtractionComparedShape(says.ok ? says.says : undefined), path);
  if (!column.ok) return column;
  // A key the grammar cannot place or act on is refused where it was written;
  // a condition contradicting itself is refused as a whole, since no one key
  // explains it.
  if (!says.ok) return { ok: false, issue: "web.handle.malformed", path: says.key === undefined ? path : [...path, says.key] };
  return {
    ok: true,
    assumed: column.assumed,
    condition: present<WebAutomationExtractItemCondition>({
      field: undefined,
      read: column.field,
      is: says.says.is,
      atLeast: says.says.atLeast,
      atMost: says.says.atMost,
      lessThan: says.says.lessThan,
      greaterThan: says.says.greaterThan,
      equals: says.says.equals,
      matches: says.says.matches,
      contains: says.says.contains,
      startsWith: says.says.startsWith,
      endsWith: says.says.endsWith,
      not: says.says.not
    })
  };
}

/**
 * The column a condition names, read in the detection's vocabulary first and
 * then in the plan's own: a name the detection knows always means the column
 * the detection showed, and only a name it does not know is looked for among
 * the columns this plan keeps.
 *
 * **Both vocabularies are read strictly before either is guessed at**, and the
 * order is what makes the plan's own keys usable at all. A plan that renames a
 * detected column to `rating` and then writes `{field: "rating", atLeast: 4}` has
 * named the key it invented two lines above, exactly; if a guess at the detected
 * keys answered first, that exact name would resolve to whichever detected
 * column happened to be nearest and the condition would test the wrong column
 * while looking resolved. A guess is the last thing tried, never the first.
 *
 * `wanted` is the shape the condition's own comparison needs, passed down so a
 * guess among similarly named columns can be settled by it. A name with no
 * plausible candidate in either vocabulary is still refused, with the detection's
 * refusal, because the detection is the vocabulary the model was shown.
 */
function conditionColumn(
  named: string,
  columns: WebExtractionConditionColumns,
  wanted: WebExtractionColumnLook["wanted"],
  path: WebPlanValuePath
): WebExtractionColumn {
  let unknown: WebExtractionColumn | undefined;
  for (const look of [
    { guess: false, wanted, among: "detected" },
    { guess: false, wanted, among: "kept" },
    { guess: true, wanted, among: "detected" },
    { guess: true, wanted, among: "kept" }
  ] as const satisfies readonly WebExtractionColumnLook[]) {
    const column = webExtractionNamedColumn(named, look.among === "kept" ? columns.kept : columns.detected, path, look);
    if (column.ok || column.issue !== "web.handle.unknown_field") return column;
    unknown ??= column;
  }
  return unknown!;
}

/** The column the condition names: one of the naming keys, or a table header. Two that disagree name no one column. */
function columnName(entry: Record<string, unknown>): string | undefined {
  const names = [...new Set(COLUMN_KEYS.flatMap((key) => (entry[key] === undefined ? [] : [entry[key]])))];
  if (names.length > 1 || names.some((name) => typeof name !== "string" || name === "")) return undefined;
  const named = names[0] as string | undefined;
  if (named !== undefined) return entry.header === undefined ? named : undefined;
  return typeof entry.header === "string" && entry.header !== "" ? `${HEADER_PREFIX}${entry.header}` : undefined;
}
