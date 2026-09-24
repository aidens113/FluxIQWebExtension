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
// A condition names one value and says what must be true of it. This file owns
// only the first half: what it may name is a field this request already reads
// (`field`, by key) or a field of its own (`read`, in either of the grammars
// `field-spec.ts` knows), so the value tested is always something the page
// states and the author named -- never a word found somewhere in the item's
// prose, which is the guess this repository deleted on 2026-09-18.
//
// **What may be said about the value is not decided here**, and deliberately so:
// `webAutomationExtractConditionHolds` in the domain package
// (`domain/src/actions/extraction/condition-match.ts`) is the one judge of
// whether a value satisfies a condition, and the plan resolver that accepts a
// model's condition is held to the same function. A second implementation of
// "under $50" or "not a charging case" living here would be a row set that
// differs between the page and everything that reasons about the page, and
// nothing would report it. In short, a condition may test whether the page has
// the value at all, the number in it, or its text, and may invert the result.
//
// Every condition must hold. An item that fails one is not read at all: it is
// not a record, it does not count toward `maxItems`, and a required field it
// happens to lack is not reported missing, because the request never asked for
// it.
//
// **What this file does not decide is what happens when nothing survives.** A
// condition that is slightly wrong -- a comparison against a column that holds
// no number, an expression that compiles and matches nothing -- rejects every
// item, and an empty table looks exactly like a page that had nothing on it. So
// the reader keeps the rows it read and says the conditions emptied the list
// (`list-reader.ts`), and this file's job is only to say which conditions did
// it. The measurement: `run-mug3tnti-9ab80b85` returned 0 records where 13 were
// wanted, from conditions this vocabulary made writable, and neither the person
// nor the repair could tell that from a page with nothing to find.
//
// A condition reads through the one field reader (`field-reader.ts`), so a
// value inside a sensitive control refuses the whole extraction here exactly as
// it does in a column (decision D2), rather than quietly deciding a row.

import { webAutomationExtractConditionHolds } from "@fluxiq-web-extension/domain/client";
import type { WebAutomationExtractItemCondition, WebAutomationExtractListRequest } from "../types";
import { readField } from "./field-reader";
import { normalizeExtractField, type ExtractFieldReader } from "./field-spec";

/** One record as the reader built it: a value per included field, `null` where an optional field was unreadable. */
type ReadRecord = Record<string, string | null>;

/** One normalized condition: where its value comes from, and what must be true of it. */
type Condition = {
  /** The already-read field key it tests, or the reader it reads its own value with. */
  value: { kind: "field"; key: string } | { kind: "read"; reader: ExtractFieldReader };
  /** Where the author wrote it, for a refusal that names the condition rather than a selector. */
  name: string;
  says: WebAutomationExtractItemCondition;
};

/**
 * The conditions that rejected an item, by their position in `where`, and empty
 * for an item every condition held of -- which is a record.
 *
 * It is the rejecting conditions rather than a yes or no because a read that
 * kept nothing has to be able to say **which** condition emptied it
 * (`list-reader.ts`). A model that wrote four conditions and got no rows back
 * learns nothing from "no rows"; "the third rejected all thirty" is the one
 * fact that tells it what to change.
 *
 * Every condition is asked, and none short-circuits the rest, so each one's
 * count is its own rather than an artefact of the order they were written in.
 */
export type ExtractItemRejections = readonly number[];

/** Which conditions reject an item, or `undefined` when the request names none and every item is a record. */
export type ExtractItemFilter = ((item: Element, record: ReadRecord) => ExtractItemRejections) | undefined;

/** No condition rejected the item, shared because it is the answer for every row a read keeps. */
const KEPT: ExtractItemRejections = [];

/**
 * The filter the request's `where` describes, or `undefined` for a request
 * that names none -- an absent `where`, and an empty one, which says the same
 * thing. Every condition is normalized before anything on the page is read, as
 * every field is, so a condition the page cannot honour refuses the read before
 * it starts rather than midway through a list.
 */
export function itemFilterFor(request: WebAutomationExtractListRequest): ExtractItemFilter {
  const written = request.where;
  if (written === undefined || written.length === 0) return undefined;
  const conditions = written.map((condition, index) => normalize(condition, index, request));
  return (item, record) => {
    let rejectedBy: number[] | undefined;
    for (const [index, entry] of conditions.entries()) {
      if (holds(entry, item, record)) continue;
      rejectedBy ??= [];
      rejectedBy.push(index);
    }
    return rejectedBy ?? KEPT;
  };
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
  return webAutomationExtractConditionHolds(entry.says, value);
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
