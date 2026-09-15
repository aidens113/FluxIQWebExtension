import type { ExpectedExtraction } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";

/** One record: each field's value, or `null` where the item held no value for it, as `ExpectedExtraction` spells it. */
type ExtractionRecord = Record<string, string | null>;

/**
 * Asserts one extract step's records against every `expected.extracted` entry
 * naming it. `count` is the exact number of records; `records` is the complete
 * list, compared exactly and in order, so a longer or shorter result fails;
 * when both are given both must hold. A `null` value matches only a field
 * present with `null`, never a field left out of the record or an empty string.
 */
export function assertExtraction(expected: readonly ExpectedExtraction[] | undefined, stepId: string, records: readonly ExtractionRecord[]): void {
  for (const entry of expected ?? []) {
    if (entry.step !== stepId) continue;
    if (entry.count !== undefined && records.length !== entry.count) {
      throw new RunnerFailure("runtime.behavior", `Extract step ${stepId} yielded ${records.length} record(s), expected ${entry.count}`, { details: { stepId, expectedCount: entry.count, actualCount: records.length } });
    }
    if (entry.records === undefined) continue;
    if (records.length !== entry.records.length) {
      throw new RunnerFailure("runtime.behavior", `Extract step ${stepId} yielded ${records.length} record(s), expected the ${entry.records.length} listed`, { details: { stepId, expectedCount: entry.records.length, actualCount: records.length } });
    }
    const index = entry.records.findIndex((wanted, position) => !sameRecord(wanted, records[position]!));
    if (index >= 0) {
      throw new RunnerFailure("runtime.behavior", `Extract step ${stepId} record ${index} does not match`, { details: { stepId, index, expected: entry.records[index], actual: records[index] } });
    }
  }
}

function sameRecord(expected: ExtractionRecord, actual: ExtractionRecord): boolean {
  const keys = Object.keys(expected);
  return keys.length === Object.keys(actual).length && keys.every((key) => Object.hasOwn(actual, key) && actual[key] === expected[key]);
}
