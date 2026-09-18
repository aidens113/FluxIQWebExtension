// What a failed extraction leaves behind: which records did not match, which
// of the expectation's own fields differed, and what each side held there.
//
// Nothing in a run said this before. `evaluation.json` carries counts alone
// and refuses every string that is not a closed name (D6);
// `snapshots/flow-lane.json` states counts, statuses and closed names and says
// so in its own header; and the one failure message names a single record
// index and never reaches the bundle at all, because `RunnerFailure.details`
// is not written anywhere -- `run-scenario.ts` publishes the message and the
// category and drops the rest. So `company-directory-logistics-sector` could
// read forty companies, match thirty-five, and leave nobody able to say which
// five or how. That is the dominant remaining extraction defect and the one
// nothing could be chased through.
//
// This is a separate artifact rather than a wider evaluation because the two
// have opposite boundaries. The evaluation is shareable precisely because no
// string a page could have supplied is in it. This file exists to carry the
// two values, so it states in its own `policy` what may be in it, and says in
// place of every value it withheld that it withheld one.
//
// What may be in it:
//
// - **The expectation's own field names.** A fixture author wrote them and
//   they are in this repository; a selector, a URL and a page heading are not
//   and never appear.
// - **Expected values**, in full to a cap. They are authored text, already
//   readable in `apps/scenario-lab`.
// - **Observed values of fields the expectation names**, in full to a cap,
//   when the disclosure rule allows it. A field the expectation names nowhere
//   is counted and never shown: an unnamed field is the one place a page can
//   put something no fixture author chose, so it is the one place a value
//   could be something nobody meant to publish.
//
// And the bundle redacts on top of this: `EvidenceBundle.writeStructured`
// scrubs every configured secret and the live provider credential from what it
// writes and refuses a document still holding a sensitive token pattern.

import type { ExpectedExtraction } from "@fluxiq-web-extension/test-contracts";
import { extractionRecordPairing, matchesExtractionRecord, type ExtractionRecord } from "./judgement.js";
import type { ExtractedValueContext } from "./value-match.js";

/** The artifact `snapshots/extraction-mismatches.json` holds. */
export const EXTRACTION_MISMATCH_SCHEMA_VERSION = "0.1" as const;

/** At most this many mismatching record positions are detailed per step; the rest are counted. */
const MAX_RECORDS_PER_STEP = 25;
/** At most this many differing fields are detailed per record; the rest are counted. */
const MAX_FIELDS_PER_RECORD = 12;
/** A published value longer than this is cut, and says that it was. */
const MAX_VALUE_CHARACTERS = 200;

/**
 * Whether this run's observed values may be published beside the expected
 * ones, and which rule decided it. The name is published in the artifact, so a
 * reader sees the rule rather than a gap.
 *
 * `fixture-page`: the records were read from a scenario-lab fixture whose page
 * and whose expected records are both authored in this repository, and the
 * scenario declares no replay secret. An observed value of a field the
 * expectation names is then page text a fixture author wrote, and publishing
 * it is the whole point of the artifact.
 *
 * `scenario-declares-secrets`: the scenario declares values that must never be
 * taken from a recording (`ScenarioSecret`), so its page holds a secret by
 * construction -- `sensitive-input` plants an unlock code in every saved card
 * and `storefront-checkout` a password and four card fields. Extraction
 * already refuses to read a sensitive control (D2), so no record should ever
 * carry one; this withholds anyway, because "should never" is what a leak is
 * made of, and the price is one class of fixture losing its observed values
 * rather than every fixture losing them. The expected values are still shown:
 * they are the fixture's authored text, and a declared secret's value comes
 * from the environment and is in no expectation.
 */
export const extractionDisclosureRules = ["fixture-page", "scenario-declares-secrets"] as const;
export type ExtractionDisclosureRule = (typeof extractionDisclosureRules)[number];

/**
 * What one side held at a compared field.
 *
 * `absent` and `null` are different answers and the difference is the defect
 * in more than one run: a field the record never carried is not a field
 * carried with no value (D16). `withheld` states the length of what was there
 * without stating the text, so a read that returned something is never
 * confused with a read that returned nothing.
 */
export type ExtractionFieldValue =
  | { held: "absent" }
  | { held: "null" }
  | { held: "text"; characters: number; value: string; cut?: true }
  | { held: "withheld"; characters: number; rule: ExtractionDisclosureRule };

/** Why one record position did not match. */
export const extractionMismatchKinds = ["values-differ", "moved", "expected-not-observed", "observed-not-expected"] as const;
export type ExtractionMismatchKind = (typeof extractionMismatchKinds)[number];

/** One field of one record, as the two sides held it. */
export type ExtractionFieldMismatch = { field: string; expected: ExtractionFieldValue; observed: ExtractionFieldValue };

/** One record position that did not match, and what differs there. */
export type ExtractionRecordMismatch = {
  /** The position in both lists, from 0. */
  position: number;
  kind: ExtractionMismatchKind;
  /** For `moved`: the position the expected record was observed at instead. */
  observedAtPosition?: number;
  /** The expectation's own fields that differ here, to `MAX_FIELDS_PER_RECORD`. */
  fields: ExtractionFieldMismatch[];
  /** Differing named fields past that bound. */
  furtherFields: number;
  /**
   * Fields this observed record carried that the expectation names nowhere.
   * Counted, never named: a record can mismatch on one of these alone, and
   * that is worth seeing, but naming it would publish a key a page chose.
   */
  unexpectedFields: number;
};

/** One extract step's mismatches. */
export type ExtractionStepMismatches = {
  stepIndex: number;
  /** The step's id, which the fixture wrote and `expected.extracted` names. */
  stepId: string;
  expectedRecords: number;
  observedRecords: number;
  comparedRecords: number;
  matchedRecords: number;
  matchedInAnyOrder: number;
  /**
   * Every expected record was observed and only the arrangement differs, so
   * the read was right and its order was not. It is stated rather than left to
   * a reader comparing three counts, because it is the first question anyone
   * asks of a partial match and the one the counts alone could not answer.
   */
  orderOnly: boolean;
  /** Record positions that did not match, in full. */
  mismatchedRecords: number;
  /** Of those, the ones detailed below. */
  detailedRecords: number;
  records: ExtractionRecordMismatch[];
  disclosure: ExtractionDisclosureRule;
};

/** The whole artifact: what may be in it, and every step that did not match. */
export type ExtractionMismatchReport = {
  schemaVersion: typeof EXTRACTION_MISMATCH_SCHEMA_VERSION;
  policy: {
    maxRecordsPerStep: number;
    maxFieldsPerRecord: number;
    maxValueCharacters: number;
    boundary: string;
  };
  steps: ExtractionStepMismatches[];
};

const BOUNDARY = "Field names and expected values are the fixture's own, authored in this repository. An observed value is published only for a field the expectation names, and only under the step's stated disclosure rule; every other observed value states its length and that it was withheld. No selector, URL, page heading or raw markup is published, and the bundle redacts every configured secret from this file on write.";

/** One step's mismatch detail, or `undefined` when there is nothing to detail. */
export function extractionStepMismatches(input: {
  stepIndex: number;
  stepId: string;
  /** The entry that was measured; `undefined` when the step had no expectation. */
  entry: ExpectedExtraction | undefined;
  records: readonly ExtractionRecord[];
  disclosure: ExtractionDisclosureRule;
  context?: ExtractedValueContext;
}): ExtractionStepMismatches | undefined {
  const expected = input.entry?.records;
  // Only an expectation that lists records compares a value, and only a
  // comparison can mismatch. A count-only entry judged no value and has no
  // mismatch to detail, which is the same line `measureExtraction` draws.
  if (!expected) return undefined;
  const optional = new Set(input.entry?.optionalFields ?? []);
  const named = new Set([...expected.flatMap((record) => Object.keys(record)), ...optional]);
  const records = input.records;
  const comparedRecords = Math.min(expected.length, records.length);
  const pairing = extractionRecordPairing(expected, records, optional, input.context);
  const matchedRecords = pairing.reduce<number>((total, at, position) => total + (at === position ? 1 : 0), 0);
  const matchedInAnyOrder = pairing.filter((at) => at !== undefined).length;
  const positions = Math.max(expected.length, records.length);
  const mismatches: ExtractionRecordMismatch[] = [];
  let mismatchedRecords = 0;
  // A step that read nothing at all is one fact, not one per expected record:
  // the counts above state it, and twenty-five copies of "every field absent"
  // would bury the steps that did read something in the same artifact.
  const readNothing = records.length === 0;
  for (let position = 0; position < positions; position += 1) {
    if (pairing[position] === position) continue;
    mismatchedRecords += 1;
    if (readNothing || mismatches.length >= MAX_RECORDS_PER_STEP) continue;
    mismatches.push(recordMismatch({ position, expected, records, pairing, optional, named, disclosure: input.disclosure, context: input.context }));
  }
  if (mismatchedRecords === 0) return undefined;
  return {
    stepIndex: input.stepIndex, stepId: input.stepId,
    expectedRecords: expected.length, observedRecords: records.length,
    comparedRecords, matchedRecords, matchedInAnyOrder,
    orderOnly: expected.length === records.length && matchedInAnyOrder === comparedRecords && matchedRecords < comparedRecords,
    mismatchedRecords, detailedRecords: mismatches.length, records: mismatches,
    disclosure: input.disclosure,
  };
}

/** The artifact over every step that had something to detail. */
export function extractionMismatchReport(steps: readonly (ExtractionStepMismatches | undefined)[]): ExtractionMismatchReport {
  return {
    schemaVersion: EXTRACTION_MISMATCH_SCHEMA_VERSION,
    policy: { maxRecordsPerStep: MAX_RECORDS_PER_STEP, maxFieldsPerRecord: MAX_FIELDS_PER_RECORD, maxValueCharacters: MAX_VALUE_CHARACTERS, boundary: BOUNDARY },
    steps: steps.filter((step): step is ExtractionStepMismatches => step !== undefined),
  };
}

function recordMismatch(input: {
  position: number;
  expected: readonly ExtractionRecord[];
  records: readonly ExtractionRecord[];
  pairing: readonly (number | undefined)[];
  optional: ReadonlySet<string>;
  named: ReadonlySet<string>;
  disclosure: ExtractionDisclosureRule;
  context: ExtractedValueContext | undefined;
}): ExtractionRecordMismatch {
  const { position, expected, records, pairing, optional, named, disclosure, context } = input;
  const wanted = expected[position];
  const actual = records[position];
  if (!wanted) return { position, kind: "observed-not-expected", fields: [], furtherFields: 0, unexpectedFields: unexpectedFieldCount(actual, named) };
  const movedTo = pairing[position];
  // A moved record matched whole, so no field of it differs and it carries no
  // field the expectation does not name -- `matchesExtractionRecord` would not
  // have paired it otherwise. Where it was read is the entire finding.
  if (movedTo !== undefined) return { position, kind: "moved", observedAtPosition: movedTo, fields: [], furtherFields: 0, unexpectedFields: 0 };
  if (!actual) {
    // The expectation has a record here and the run read none, so every field
    // it wanted is absent. Shown as fields rather than as a bare kind, because
    // a reader chasing one column wants to see that column named.
    const fields = [...named].filter((field) => Object.hasOwn(wanted, field)).map((field) => ({ field, expected: fieldValue(wanted, field, disclosure, true), observed: { held: "absent" } as ExtractionFieldValue }));
    return { position, kind: "expected-not-observed", fields: fields.slice(0, MAX_FIELDS_PER_RECORD), furtherFields: Math.max(0, fields.length - MAX_FIELDS_PER_RECORD), unexpectedFields: 0 };
  }
  const differing = [...named]
    .filter((field) => !fieldMatches(wanted, actual, field, optional, context))
    .map((field) => ({ field, expected: fieldValue(wanted, field, disclosure, true), observed: fieldValue(actual, field, disclosure, false) }));
  return {
    position, kind: "values-differ",
    fields: differing.slice(0, MAX_FIELDS_PER_RECORD),
    furtherFields: Math.max(0, differing.length - MAX_FIELDS_PER_RECORD),
    unexpectedFields: unexpectedFieldCount(actual, named),
  };
}

/**
 * Whether one named field agrees, by exactly the rule `matchesExtractionRecord`
 * applies to it: a field either side carries and the other does not differs
 * unless `optionalFields` names it, and a field both carry is compared with
 * the run's own value rule.
 */
function fieldMatches(wanted: ExtractionRecord, actual: ExtractionRecord, field: string, optional: ReadonlySet<string>, context: ExtractedValueContext | undefined): boolean {
  const onExpected = Object.hasOwn(wanted, field);
  const onActual = Object.hasOwn(actual, field);
  if (!onExpected || !onActual) return optional.has(field) || (!onExpected && !onActual);
  return matchesExtractionRecord({ [field]: wanted[field]! }, { [field]: actual[field]! }, optional, context);
}

/** Fields an observed record carried that the expectation names nowhere. */
function unexpectedFieldCount(record: ExtractionRecord | undefined, named: ReadonlySet<string>): number {
  return record ? Object.keys(record).filter((field) => !named.has(field)).length : 0;
}

/**
 * One side's value at one field. `authored` marks the expectation's side,
 * which is fixture text and is published whatever the disclosure rule says;
 * the observed side is page text and is withheld when the rule withholds.
 */
function fieldValue(record: ExtractionRecord, field: string, disclosure: ExtractionDisclosureRule, authored: boolean): ExtractionFieldValue {
  if (!Object.hasOwn(record, field)) return { held: "absent" };
  const value = record[field];
  if (value === null || value === undefined) return { held: "null" };
  const characters = [...value].length;
  if (!authored && disclosure !== "fixture-page") return { held: "withheld", characters, rule: disclosure };
  const cut = [...value].slice(0, MAX_VALUE_CHARACTERS).join("");
  return { held: "text", characters, value: cut, ...(cut === value ? {} : { cut: true as const }) };
}
