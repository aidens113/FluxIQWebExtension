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
// Core's `automationStudioRecordConditionHolds` (`fluxiq/automation-studio/nodes`)
// is the one judge of whether a value satisfies a condition, and the plan
// resolver that accepts a model's condition, and Core's own dataset processing,
// are held to the same function. A blank or whitespace-only value is one the
// page does not have, by Core's rule. A second implementation of
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
//
// **And it says what its read found.** A condition with a read of its own is
// described downstream without the part that addresses the page, so
// `attribute aria-label is present` is all the judge of `run-munw7ffn-fe1cecd2`
// was told of the store's Brightaisle Plus badge, and it advised adding a Plus
// condition the Flow already had. So the filter writes, into the caller's `seen`,
// the first value each condition read on an item it held of, whole
// (`domain/src/actions/extraction/seen-values.ts` copies it at the wire,
// uncut). **A condition over a column writes it too.** Whether the column's
// values reach a stored row is not known here -- the stored schema and the
// answer's `columns` are applied after the read -- and a column read only to
// filter by reaches none: run `run-mv5jnc51-9eac63f2`'s judges were shown
// `plus is present` beside eight `attribute absent` witnesses and nothing the
// read found on a row it kept, and three times refuted an exact answer as a
// broken read. Core says the value only where the column is not stored
// (`result-verification/read-account/condition.ts`).
//
// **And what it read on the rows the read kept.** A condition that holds of
// every item narrows nothing, and `rejected: 0` does not say why: run
// `run-mvbr0w7e-6a01c05b`'s repair resent one `is present` condition six times
// because nothing told it that condition kept every row or what it read on them.
// So the filter also writes, into the caller's `kept`, the first few distinct
// values each condition tested on an item **every** condition held of, at most
// `WEB_AUTOMATION_EXTRACT_CONDITION_KEPT_VALUES_MOST` each
// (`domain/src/actions/extraction/kept-values.ts`): values it already tested,
// never more of the item.

import { WEB_AUTOMATION_EXTRACT_CONDITION_KEPT_VALUES_MOST, type WebAutomationExtractionRejectionObservation } from "@fluxiq-web-extension/domain/client";
import { automationStudioRecordConditionHolds } from "fluxiq/automation-studio/nodes";
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

/**
 * Which conditions reject an item, or `undefined` when the request names none
 * and every item is a record. `seen`, when given, holds one entry per condition,
 * and each `null` entry takes the first non-empty value that condition tested
 * on an item it held of, whether it read the value itself or named a column.
 * `kept`, when given, holds one list per condition, and an item every condition
 * held of adds each condition's non-empty value to its list when the list does
 * not hold it yet and is not full.
 */
export type ExtractItemFilter = ((item: Element, record: ReadRecord, seen?: (string | null)[], capture?: { observations: WebAutomationExtractionRejectionObservation[]; page: number; item: number }, kept?: string[][]) => ExtractItemRejections) | undefined;

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
  return (item, record, seen, capture, kept) => {
    // The run's instant when the request carries it, so a relative date is judged as at run end; else this item's own clock.
    const now = request.now ?? Date.now();
    let rejectedBy: number[] | undefined;
    const values: (string | undefined)[] = [];
    for (const [index, entry] of conditions.entries()) {
      const value = valueOf(entry, item, record);
      values.push(value);
      if (automationStudioRecordConditionHolds(entry.says, value, now)) {
        if (seen?.[index] === null && value) seen[index] = value;
        continue;
      }
      rejectedBy ??= [];
      rejectedBy.push(index);
      if (capture) {
        const declared = entry.value.kind === "read" ? entry.value.reader : normalizeExtractField(entry.value.key, request.fields[entry.value.key]!);
        capture.observations.push({ conditionIndex: index, state: value === undefined ? "absent" : "present", ...(value === undefined ? {} : { value }), source: entry.value.kind, ...(declared === undefined ? {} : { readKind: declared.kind }), page: capture.page, item: capture.item });
      }
    }
    // A condition judges the text the page shows. Held to full disclosure
    // after: every condition that read its own value, on an item they all held
    // of, and on a rejected item only one that rejected it, since that
    // rejection judged partial text (`list-reader.ts`).
    for (const [index, entry] of conditions.entries()) {
      if (entry.value.kind !== "read" || (entry.value.reader.kind !== "text" && entry.value.reader.kind !== "column")) continue;
      if (rejectedBy === undefined || rejectedBy.includes(index)) readField(item, entry.name, entry.value.reader, "complete");
    }
    if (rejectedBy) return rejectedBy;
    if (kept) noteKept(kept, values);
    return KEPT;
  };
}

/** Each condition's value on an item every condition held of, added to its list once, while the list has room. */
function noteKept(kept: string[][], values: readonly (string | undefined)[]): void {
  for (const [index, value] of values.entries()) {
    const list = kept[index];
    if (!value || list === undefined || list.length >= WEB_AUTOMATION_EXTRACT_CONDITION_KEPT_VALUES_MOST || list.includes(value)) continue;
    list.push(value);
  }
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

/** The value a condition tests on an item, or `undefined` when the item does not have it. */
function valueOf(entry: Condition, item: Element, record: ReadRecord): string | undefined {
  return entry.value.kind === "field"
    ? valueInRecord(record, entry.value.key)
    : readField(item, entry.name, entry.value.reader, "visible") ?? undefined;
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
