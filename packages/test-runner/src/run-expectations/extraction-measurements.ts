// The recording lane's own extraction measurements.
//
// The lane asserts each extract step as it runs (`assertExtraction`), and an
// assertion says only pass or fail. A rate needs the counts behind it, and
// until this module existed the recording lane published
// `RunEvaluation.extraction: null` -- unmeasured -- so every extraction number
// in a bench report stood on the Flow lane alone, and `paginationAccuracy` had
// no lane at all that could report the pages a read covered.
//
// This is the lane that can. FluxIQ's own extraction answers the intent seam
// with `pagesRead`, `truncated` and `durationMs` beside the records
// (`scenario-steps/extract-intent.ts`), so both sides of every comparison exist
// here. What the seam does not report stays unreported: an absent member is
// measured as `null` rather than defaulted, because a measurement nothing can
// judge must not be able to enter a rate.

import type { ExpectedExtraction, RunExtractionMeasurement, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { measureExtraction, type ExtractionRecord, type ObservedExtraction } from "./extraction.js";

/** What one extract step read: FluxIQ's records, and the read's own account of itself. */
export type ExtractionStepRead = {
  records: readonly ExtractionRecord[];
  observed: ObservedExtraction;
};

/**
 * What a step that never ran reported: nothing at all, and therefore no value
 * that was not a string. It is not a default for a step that did run -- a read
 * whose reporting is incomplete states `null` for each member it could not
 * report, which is what keeps it out of the rate built on that member.
 */
const NOTHING_READ: ObservedExtraction = { nonStringValues: 0 };

/**
 * One measurement per `extract` step of the workflow's recording script, in
 * script order, from what each step read.
 *
 * `read` is keyed by step id and holds an entry for every extract step that
 * ran, whether or not its assertion then passed: the measurement of a step
 * whose records did not match is exactly the measurement worth publishing, so
 * the caller records the read before it judges it.
 *
 * The status vocabulary is the Flow lane's (`flow-lane/expectations.ts`), and
 * is decided in the same order, so one workflow measured on both lanes is
 * measured the same way: a step no entry names is `not_expected`, an expected
 * step with no read is `not_run`, and an expected step that read is `judged`.
 *
 * Only the first entry naming a step is measured, while `assertExtraction`
 * asserts every one of them -- again as the Flow lane does. A second entry for
 * one step can therefore fail a run without appearing in its measurement; no
 * fixture writes one today.
 */
export function runExtractionMeasurements(input: {
  /** The workflow's recording script, whose `extract` steps these measure. */
  script: readonly ScenarioStep[];
  expected: readonly ExpectedExtraction[] | undefined;
  /** What each extract step that ran read, by step id. */
  read: ReadonlyMap<string, ExtractionStepRead>;
}): RunExtractionMeasurement[] {
  const expected = input.expected ?? [];
  return input.script.flatMap((step, stepIndex) => {
    if (step.operation !== "extract") return [];
    const declared = expected.filter((entry) => entry.step === step.id);
    const read = input.read.get(step.id);
    return [{
      stepIndex,
      status: declared.length === 0 ? "not_expected" : read === undefined ? "not_run" : "judged",
      ...measureExtraction(declared[0], read?.records ?? [], read?.observed ?? NOTHING_READ),
    }];
  });
}
