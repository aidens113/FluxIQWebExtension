import type { ExpectedExtraction, RunExtractionMeasurement } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import { extractedValueMatches, type ExtractedValueContext } from "./extracted-value-match.js";

/** One record: each field's value, or `null` where the item held no value for it, as `ExpectedExtraction` spells it. */
export type ExtractionRecord = Record<string, string | null>;

/**
 * What an extract step reported beside its records. Every member but
 * `nonStringValues` is optional because a step that reports nothing must not
 * be judged on it: an expectation is checked against a reported value, never
 * against a missing one, and an unreported value is measured as `null`
 * (`RunExtractionMeasurement.pagesFollowed`).
 */
export type ObservedExtraction = {
  pagesRead?: number;
  truncated?: boolean;
  durationMs?: number;
  /** Values the step's records carried that were not strings, counted by the caller that read them. */
  nonStringValues: number;
};

/**
 * One step's measurement. `stepIndex` and `status` are the caller's: only the
 * run knows a step's position, and only it can tell a step that never ran from
 * one that ran unexpected.
 */
export type ExtractionStepMeasurement = Omit<RunExtractionMeasurement, "stepIndex" | "status">;

const NOTHING_REPORTED: ObservedExtraction = { nonStringValues: 0 };

/**
 * Measures one extract step's records against the entry expecting them, in
 * counts and booleans only (D6): no step id, field name, or page value enters
 * the result, so an evaluation carrying it can be shared without carrying what
 * the page showed.
 *
 * Matching is positional, as `assertExtraction` has always compared, and the
 * two share `matchesRecord` so a measurement and an assertion cannot disagree.
 * `context` is the run's, and lets a record's same-origin absolute URL match a
 * root-relative expected one (`extractedValueMatches`); without it every value
 * is compared exactly.
 *
 * - `expectedFields` and `presentFields` are summed over the aligned positions
 *   `i < min(expected, observed)`, counting each expected record's fields that
 *   `optionalFields` does not name, and whether the observed record at that
 *   position carried them. An optional field is left out of both, which is what
 *   makes it optional.
 * - `unexpectedFields` counts, over every observed record, the fields the
 *   expectation names nowhere -- neither in a record nor in `optionalFields`.
 *   It is counted, not asserted, and is separate from field completeness.
 * - An entry that lists `records` is the only one whose records are compared,
 *   and it is the only one reporting `recordsListed`. `comparedRecords` is the
 *   number of positions compared (`min(expected, observed)`) and
 *   `matchedRecords` a subset of it.
 * - An entry that states only a `count` names no field and no record, so it
 *   compares nothing: `comparedRecords` and `matchedRecords` are both **0**,
 *   and `countStated` marks it as a count to judge rather than a comparison.
 *   Reporting `min(expected, observed)` matches instead -- which this did, and
 *   which read as one match per record whenever the count was right -- scored a
 *   pooled record accuracy of 1.0 for a step in which not one value was ever
 *   looked at (x5f). A step that judged nothing must not be able to contribute
 *   a success to a published number.
 * - An entry silent on both cannot contradict the records at all, so the
 *   observed count stands as the expected one and `countStated` is false:
 *   `expectedRecords === observedRecords` then says nothing, and a count
 *   accuracy that pooled it would score it a free hit.
 * - With no entry, the step ran unexpected: nothing was expected, so every
 *   expectation-derived count is 0 and both flags are false.
 */
export function measureExtraction(entry: ExpectedExtraction | undefined, records: readonly ExtractionRecord[], observed: ObservedExtraction, context?: ExtractedValueContext): ExtractionStepMeasurement {
  const optional = new Set(entry?.optionalFields ?? []);
  const expected = entry?.records;
  let expectedRecords = 0;
  let comparedRecords = 0;
  let matchedRecords = 0;
  let expectedFields = 0;
  let presentFields = 0;
  let unexpectedFields = 0;
  if (entry) {
    expectedRecords = expected?.length ?? entry.count ?? records.length;
    if (expected) {
      const named = new Set([...expected.flatMap((record) => Object.keys(record)), ...optional]);
      comparedRecords = Math.min(expected.length, records.length);
      for (let position = 0; position < comparedRecords; position += 1) {
        const wanted = expected[position]!;
        const actual = records[position]!;
        if (matchesRecord(wanted, actual, optional, context)) matchedRecords += 1;
        for (const key of Object.keys(wanted)) {
          if (optional.has(key)) continue;
          expectedFields += 1;
          if (carriesField(actual, key, wanted[key]!)) presentFields += 1;
        }
      }
      for (const record of records) unexpectedFields += Object.keys(record).filter((key) => !named.has(key)).length;
    }
  }
  return {
    expectedRecords, observedRecords: records.length,
    recordsListed: expected !== undefined, countStated: entry?.count !== undefined,
    comparedRecords, matchedRecords,
    expectedFields, presentFields, unexpectedFields,
    // The declared pages, so a pagination accuracy has both sides of its
    // comparison. Null when the entry declared none, and independent of
    // whether anything reported `pagesRead`: a step whose expectation named
    // pages and whose lane could not observe them is a stated gap, not a hit.
    expectedPages: entry?.pages ?? null,
    pagesFollowed: observed.pagesRead ?? null,
    truncated: observed.truncated ?? null,
    durationMs: observed.durationMs ?? null,
    nonStringValues: observed.nonStringValues,
  };
}

/**
 * Asserts one extract step's records against every `expected.extracted` entry
 * naming it. `count` is the exact number of records; `records` is the complete
 * list, compared exactly and in order, so a longer or shorter result fails;
 * when both are given both must hold. A `null` value matches only a field
 * present with `null`, never a field left out of the record or an empty string
 * (D16). A field named in `optionalFields` may be absent from an item, or
 * present on one the expectation omits it from; a field outside it must be
 * present on every item the expectation names it on, carrying a value: a field
 * present with `null` carried none, and fails as a field the record did not
 * carry unless the expectation asked for `null` there.
 *
 * `pages` and `truncated` are asserted against what the step reported, and an
 * entry declaring either while the caller reported neither is **refused**
 * rather than passed. `observed` still defaults to nothing reported, because
 * `run-scenario.ts` is a pinned three-argument call site, but an expectation
 * nothing can judge must not read as a met one: it would be a green run
 * asserting less than the fixture says, which is worse than declaring no
 * expectation at all. The Flow lane is the other caller and passes an
 * `observed`; a member its Core datasets cannot report is removed from the
 * entry there and published as unjudged, rather than reaching this refusal,
 * which would blame the fixture for a limit of that lane
 * (`flow-lane/expectations.ts`, `LANE_UNOBSERVABLE`). The refusal is
 * `fixture.invalid` -- the facility could not produce a trustworthy judgement
 * of this entry -- never `runtime.behavior`, which would blame the automation
 * for the runner's missing observation. It is raised before any content
 * assertion, so the failure always names the unjudgeable entry rather than
 * whichever comparison happened to fail first.
 *
 * `nonStringValues` is measured here rather than asserted -- the Flow lane
 * refuses a run carrying any before its records are compared
 * (`flow-lane/expectations.ts`).
 *
 * `context` is compared with exactly as `measureExtraction` compares. The Flow
 * lanes pass the run's; the recording lane's pinned four-argument call passes
 * none, and its records are read by the fixture's own selectors, so an href
 * there is the attribute as written.
 */
export function assertExtraction(expected: readonly ExpectedExtraction[] | undefined, stepId: string, records: readonly ExtractionRecord[], observed: ObservedExtraction = NOTHING_REPORTED, context?: ExtractedValueContext): void {
  for (const entry of expected ?? []) {
    if (entry.step !== stepId) continue;
    const unjudgeable = unjudgeableFields(entry, observed);
    if (unjudgeable.length > 0) {
      throw new RunnerFailure("fixture.invalid", `Extract step ${stepId} declares ${unjudgeable.join(" and ")}, which nothing reported for this run, so the expectation cannot be judged`, {
        details: { stepId, unjudgeableFields: unjudgeable, ...(entry.pages !== undefined ? { expectedPages: entry.pages } : {}), ...(entry.truncated !== undefined ? { expectedTruncated: entry.truncated } : {}) },
      });
    }
    const measured = measureExtraction(entry, records, observed, context);
    const optional = new Set(entry.optionalFields ?? []);
    if (entry.count !== undefined && records.length !== entry.count) {
      throw new RunnerFailure("runtime.behavior", `Extract step ${stepId} yielded ${records.length} record(s), expected ${entry.count}`, { details: { stepId, expectedCount: entry.count, actualCount: records.length } });
    }
    if (entry.pages !== undefined && observed.pagesRead !== undefined && observed.pagesRead !== entry.pages) {
      throw new RunnerFailure("runtime.behavior", `Extract step ${stepId} read ${observed.pagesRead} page(s), expected ${entry.pages}`, { details: { stepId, expectedPages: entry.pages, actualPages: observed.pagesRead } });
    }
    if (entry.truncated !== undefined && observed.truncated !== undefined && observed.truncated !== entry.truncated) {
      throw new RunnerFailure("runtime.behavior", `Extract step ${stepId} reported truncated=${observed.truncated}, expected ${entry.truncated}`, { details: { stepId, expectedTruncated: entry.truncated, actualTruncated: observed.truncated } });
    }
    if (entry.records === undefined) continue;
    if (records.length !== entry.records.length) {
      throw new RunnerFailure("runtime.behavior", `Extract step ${stepId} yielded ${records.length} record(s), expected the ${entry.records.length} listed`, { details: { stepId, expectedCount: entry.records.length, actualCount: records.length } });
    }
    if (measured.presentFields < measured.expectedFields) {
      const index = entry.records.findIndex((wanted, position) => Object.keys(wanted).some((key) => !optional.has(key) && !carriesField(records[position]!, key, wanted[key]!)));
      const wanted = entry.records[index]!;
      const missing = Object.keys(wanted).filter((key) => !optional.has(key) && !carriesField(records[index]!, key, wanted[key]!));
      throw new RunnerFailure("runtime.behavior", `Extract step ${stepId} record ${index} carried no value for ${missing.length} required field(s) no optionalFields entry names`, { details: { stepId, index, missingFields: missing } });
    }
    if (measured.matchedRecords !== entry.records.length) {
      const index = entry.records.findIndex((wanted, position) => !matchesRecord(wanted, records[position]!, optional, context));
      throw new RunnerFailure("runtime.behavior", `Extract step ${stepId} record ${index} does not match`, { details: { stepId, index, expected: entry.records[index], actual: records[index] } });
    }
  }
}

/**
 * The fields an entry declares that nothing reported, so no comparison of them
 * is possible: `pages` without a `pagesRead`, `truncated` without a
 * `truncated`. Empty for an entry stating neither, which is every entry the
 * pinned three-argument callers can judge in full today.
 */
function unjudgeableFields(entry: ExpectedExtraction, observed: ObservedExtraction): string[] {
  const fields: string[] = [];
  if (entry.pages !== undefined && observed.pagesRead === undefined) fields.push("pages");
  if (entry.truncated !== undefined && observed.truncated === undefined) fields.push("truncated");
  return fields;
}

/**
 * Whether an observed record **carried a value** for one expected field, which
 * is what field completeness counts.
 *
 * A field present with `null` carried no value: `null` is how both readers
 * spell "the item held nothing here" -- FluxIQ's own extraction returns it for
 * an optional field it cannot read, and the Flow lane's dataset reader
 * restores it for every schema field a stored row lacks (D16). Counting such a
 * field as present would make `extractionFieldCompleteness` read 1.000 on the
 * Flow lane for every run, since Core's stored schema guarantees the key: a
 * rate that can only be perfect measures nothing.
 *
 * An expectation that **expects** `null` expects that absence, so a record
 * holding `null` there carried exactly what was asked for and counts as
 * present. Otherwise a correct read of an item with no value would be scored
 * as an incomplete one.
 */
function carriesField(actual: ExtractionRecord, key: string, expected: string | null): boolean {
  if (!Object.hasOwn(actual, key)) return false;
  return actual[key] !== null || expected === null;
}

/**
 * One record against one expectation. Every expected field must be present
 * with an equal value, and every observed field must be one the expectation
 * holds, unless `optionalFields` names it: a field may then be absent from
 * either side. With no optional field this is equality of both the key set
 * and every value, where equal is `extractedValueMatches`: exact, except that
 * a same-origin absolute URL equals a root-relative expected one.
 */
function matchesRecord(expected: ExtractionRecord, actual: ExtractionRecord, optional: ReadonlySet<string>, context: ExtractedValueContext | undefined): boolean {
  for (const key of Object.keys(expected)) {
    if (!Object.hasOwn(actual, key)) { if (!optional.has(key)) return false; continue; }
    if (!extractedValueMatches(expected[key] as string | null, actual[key] as string | null, context)) return false;
  }
  return Object.keys(actual).every((key) => Object.hasOwn(expected, key) || optional.has(key));
}
