import type { JsonObject } from "fluxiq/core";
import { assertExtraction, extractedValueMatches, measureExtraction, type ExtractionRecord } from "../../../../../../packages/test-runner/src/run-expectations/index.js";
import { expect } from "../../../fixtures/extension-context";
import { photoToggleScenario } from "./scenario";

/** Uses the official positional oracle, including its existing strict same-origin URL transport contract. */
export function assertPhotoDataset(rows: JsonObject[] | undefined, origin: string) {
  const records: ExtractionRecord[] = (rows ?? []).map(row => {
    const fields: ExtractionRecord = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value !== "string" && value !== null) throw new Error("diagnostic.dataset_non_string_value");
      fields[key] = value;
    }
    expect(Object.keys(fields)).toEqual(["link"]);
    return fields;
  });
  const expected = photoToggleScenario.expected;
  const context = { scenarioOrigin: origin };
  assertExtraction([expected], expected.step, records, { nonStringValues: 0 }, context);
  const measured = measureExtraction(expected, records, { nonStringValues: 0 }, context);
  expect(measured.expectedRecords).toBe(3);
  expect(measured.observedRecords).toBe(3);
  expect(measured.comparedRecords).toBe(3);
  expect(measured.matchedRecords).toBe(3);
  expect(measured.unexpectedFields).toBe(0);
  const wanted = String(expected.records![0]!.link);
  expect(extractedValueMatches(wanted, new URL(wanted, "https://foreign.invalid").href, context)).toBe(false);
  return measured;
}
