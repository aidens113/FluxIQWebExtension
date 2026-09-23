// Which items of a repeating structure are records: the page half of an
// extraction request's `where` (contract C5).
//
// A detected run is every element the page renders from one template, and a
// results page renders its advertisements from the same template as its
// results. The everything store's four sponsored placements are the same card
// as its sixteen results with a grey "Sponsored" label pushed in front, so a
// read of "every product on the first page, leaving out sponsored placements"
// returned twenty rows: the columns were right and the row set was wrong.
//
// A condition names one value and says what must be true of it. What it may
// name is a field this request already reads (`field`, by key) or a field of
// its own (`read`, in either of the grammars `field-spec.ts` knows), so the
// value tested is always something the page states and the author named --
// never a word found in the item's prose. There is deliberately no substring
// or equality test over text: a sponsored card is told apart by the mark its
// own author put on it, and this repository deleted a word-list heuristic on
// 2026-09-18 rather than keep guessing from wording.
//
// What may be said about the value:
//
// - `is: "present"`, which is also what a condition saying nothing else means:
//   the page has the value. `is: "absent"`: it does not. That is the test a
//   mark wants -- an ad label, a `data-ad-id`, a pinned badge -- because a mark
//   *being there* is the whole of what it says;
// - a numeric bound, read off the number in the value: `$1,299.00` is 1299 and
//   `4.5 out of 5 stars` is 4.5. An item whose value is missing, or holds no
//   number, fails a bound, because a row with no price is not a row under $50.
//
// Every condition must hold. An item that fails one is not read at all: it is
// not a record, it does not count toward `maxItems`, and a required field it
// happens to lack is not reported missing, because the request never asked for
// it.
//
// A condition reads through the one field reader (`field-reader.ts`), so a
// value inside a sensitive control refuses the whole extraction here exactly as
// it does in a column (decision D2), rather than quietly deciding a row.

import type { WebAutomationExtractItemCondition, WebAutomationExtractListRequest } from "../types";
import { readField } from "./field-reader";
import { normalizeExtractField, type ExtractFieldReader } from "./field-spec";

/** One record as the reader built it: a value per included field, `null` where an optional field was unreadable. */
type ReadRecord = Record<string, string | null>;

/** The numeric bounds a condition may put on its value, and what each requires of the number. */
const BOUNDS = [
  ["atLeast", (value: number, bound: number) => value >= bound],
  ["atMost", (value: number, bound: number) => value <= bound],
  ["lessThan", (value: number, bound: number) => value < bound],
  ["greaterThan", (value: number, bound: number) => value > bound]
] as const satisfies ReadonlyArray<readonly [keyof WebAutomationExtractItemCondition, (value: number, bound: number) => boolean]>;

/**
 * The first number written in the value: an optional sign, digits with group
 * separators, and an optional fraction. It is the first rather than the whole
 * because a page writes a price for a screen reader and again for the eye, and
 * puts a rating beside the count of ratings -- `$39.99$39.99` and
 * `4.5 out of 5 stars` both say one number and repeat or qualify it.
 */
const NUMBER = /-?\d[\d,]*(?:\.\d+)?/u;

/** One normalized condition: where its value comes from, and what must be true of it. */
type Condition = {
  /** The already-read field key it tests, or the reader it reads its own value with. */
  value: { kind: "field"; key: string } | { kind: "read"; reader: ExtractFieldReader };
  /** Where the author wrote it, for a refusal that names the condition rather than a selector. */
  name: string;
  says: WebAutomationExtractItemCondition;
};

/** Whether an item is a record, or `undefined` when the request names no conditions and every item is. */
export type ExtractItemFilter = ((item: Element, record: ReadRecord) => boolean) | undefined;

/**
 * The filter the request's `where` describes, or `undefined` for a request
 * that names none. Every condition is normalized before anything on the page is
 * read, as every field is, so a condition the page cannot honour refuses the
 * read before it starts rather than midway through a list.
 */
export function itemFilterFor(request: WebAutomationExtractListRequest): ExtractItemFilter {
  const written = request.where;
  if (written === undefined || written.length === 0) return undefined;
  const conditions = written.map((condition, index) => normalize(condition, index, request));
  return (item, record) => conditions.every((entry) => holds(entry, item, record));
}

function normalize(condition: WebAutomationExtractItemCondition, index: number, request: WebAutomationExtractListRequest): Condition {
  const name = `where[${index}]`;
  if (condition.field !== undefined) {
    const declared = request.fields[condition.field];
    // A condition over a column the read does not take could only ever be
    // false, so it is refused rather than silently emptying the list.
    if (declared === undefined) throw new Error(`The extract_list condition ${name} names the field ${JSON.stringify(condition.field)}, which the request does not read.`);
    if (normalizeExtractField(condition.field, declared) === undefined) {
      throw new Error(`The extract_list condition ${name} names the field ${JSON.stringify(condition.field)}, whose column is excluded and so is never read.`);
    }
    return { value: { kind: "field", key: condition.field }, name, says: condition };
  }
  if (condition.read === undefined) throw new Error(`The extract_list condition ${name} names no value to test.`);
  const reader = normalizeExtractField(name, condition.read);
  if (reader === undefined) throw new Error(`The extract_list condition ${name} reads a column that is excluded, so it would never have a value.`);
  // A condition asks whether the page has the value, so it reads for itself
  // rather than through a field's own optionality: `required: false` here would
  // make an unreadable value `null` instead of nothing.
  return { value: { kind: "read", reader: { ...reader, required: true } }, name, says: condition };
}

function holds(entry: Condition, item: Element, record: ReadRecord): boolean {
  const value = entry.value.kind === "field"
    ? valueInRecord(record, entry.value.key)
    : readField(item, entry.name, entry.value.reader) ?? undefined;
  const bounds = BOUNDS.filter(([key]) => entry.says[key] !== undefined);
  if (bounds.length === 0) return (value !== undefined) === (entry.says.is !== "absent");
  if (value === undefined) return false;
  const number = numberIn(value);
  if (number === undefined) return false;
  return bounds.every(([key, satisfies]) => satisfies(number, entry.says[key] as number));
}

/**
 * The value a record carries for a key, or `undefined` when the page could not
 * read it. An optional field the page could not read is `null` in its record
 * (D16) and a required one is absent from it; both mean the item does not have
 * the value, which is what a condition asks.
 */
function valueInRecord(record: ReadRecord, key: string): string | undefined {
  return Object.hasOwn(record, key) ? record[key] ?? undefined : undefined;
}

function numberIn(value: string): number | undefined {
  const found = NUMBER.exec(value);
  if (found === null) return undefined;
  const number = Number(found[0].replaceAll(",", ""));
  return Number.isFinite(number) ? number : undefined;
}
