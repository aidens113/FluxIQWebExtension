import type { BenchDistribution, BenchExtractionMetrics, BenchExtractionRateMetric, BenchRate, RunEvaluation, RunExtractionMeasurement } from "@fluxiq-web-extension/test-contracts";
import type { BenchResultRuns } from "./aggregate-report.js";
import { benchDistribution } from "./distribution.js";
import { benchExtractionAccuracy } from "./extraction-accuracy.js";

/** What one published extraction rate is counted in, and over which steps or runs. */
export type BenchExtractionRateDefinition = { unit: string; definition: string };

/**
 * Each extraction rate's unit and population, published beside the number in
 * `report.md`.
 *
 * It is here, in the module that computes the rates, for the reason
 * `BENCH_RATE_DEFINITIONS` is in `aggregate-report.ts`: the definition and the
 * counting rule have to move together, and a definition kept somewhere else is
 * how the printed sentence comes to describe a rate that is no longer computed
 * that way.
 *
 * Two of these populations are not what a reader assumes from the metric's
 * name, which is exactly why they are printed rather than left in the code.
 * `extractionCountAccuracy` is over the **count-only** steps, not over every
 * step whose count was checked: a step that listed its records has its count
 * judged inside the record accuracy's `max(expected, observed)` denominator
 * instead, and counting it twice would let one step move two rates. And
 * `extractionRecordAccuracy` is over the compared steps alone, so a lane with
 * one compared step and twenty count-only ones can print a confident 1.000
 * that stands on one step -- which the basis line beside the table says, in
 * steps.
 */
export const BENCH_EXTRACTION_RATE_DEFINITIONS: Readonly<Record<BenchExtractionRateMetric, BenchExtractionRateDefinition>> = {
  extractionRecordAccuracy: {
    unit: "records",
    definition: "judged steps whose expectation listed the records: the matched records over the pooled max(expected, observed). A count-only step is not in it",
  },
  extractionCountAccuracy: {
    unit: "steps",
    definition: "judged steps that stated a count and listed no records, whose observed count equals the expected one. A step that listed its records is judged in the record accuracy instead, never here",
  },
  extractionExactSuccess: {
    unit: "runs",
    definition: "runs that judged at least one extraction step, every judged step of which matched. A step whose expectation could judge nothing is a miss, not an exclusion",
  },
  extractionFieldCompleteness: {
    unit: "fields",
    definition: "the expected fields of judged steps, counted present when the record carried a value for the field. A field the extraction could not read arrives as null and carried none",
  },
  paginationAccuracy: {
    unit: "steps",
    definition: "judged steps stating both an expected page count and the pages the read followed, where the two are equal. A lane that cannot observe pages has an empty population and publishes no rate",
  },
  extractionFalseSuccess: {
    unit: "runs",
    definition: "positive runs that judged an extraction step and got a verdict, where FluxIQ reported success while a judged step did not match. Lower is better",
  },
};

/**
 * One lane's `BenchExtractionMetrics`, or `undefined` when no run on the lane
 * measured extraction at all.
 *
 * Absent means unmeasured. A recording-lane run publishes
 * `RunEvaluation.extraction: null` because it asserts each extract step as it
 * runs and keeps no per-step measurement, and every evaluation written before
 * schema 0.3 says the same; a block of zeros for either would claim the bench
 * measured extraction and found none.
 *
 * Every rate here obeys one rule: **a step that could not judge something
 * enters no rate for it**. A count-only step is excluded from the record
 * accuracy and pooled into the count accuracy instead
 * (`benchExtractionAccuracy`); a step whose expectation named pages on a lane
 * that cannot observe them enters no pagination accuracy; and a population
 * with nothing in it publishes `rate: null` rather than a flattering number.
 * The three step counts state the basis, so a reader can see how much of the
 * lane each rate stands on.
 */
export function benchExtractionMetrics(results: readonly BenchResultRuns[]): BenchExtractionMetrics | undefined {
  const runs = results.flatMap((result, resultIndex) => result.evaluations.map((evaluation) => ({ evaluation, resultIndex })));
  if (!runs.some(({ evaluation }) => evaluation.extraction !== null)) return undefined;
  const steps = runs.flatMap(({ evaluation, resultIndex }) => (evaluation.extraction ?? []).map((measurement) => ({ measurement, resultIndex })));
  const measured = runs.filter(({ evaluation }) => evaluation.extraction !== null);
  const accuracy = benchExtractionAccuracy(steps.map(({ measurement }) => measurement));
  const judged = steps.filter(({ measurement }) => measurement.status === "judged");
  return {
    judgedSteps: accuracy.basis.judgedSteps,
    unjudgedSteps: accuracy.basis.unjudgedSteps,
    comparedSteps: accuracy.basis.comparedSteps,
    countOnlySteps: accuracy.basis.countOnlySteps,
    unjudgeableSteps: accuracy.basis.unjudgeableSteps,
    extractionRecordAccuracy: rateOverSteps(accuracy.recordAccuracy, judged.filter(({ measurement }) => measurement.recordsListed)),
    extractionCountAccuracy: rateOverSteps(accuracy.countAccuracy, judged.filter(({ measurement }) => !measurement.recordsListed && measurement.countStated)),
    extractionFieldCompleteness: fieldCompleteness(judged),
    paginationAccuracy: paginationAccuracy(judged),
    extractionExactSuccess: exactSuccess(measured),
    extractionFalseSuccess: falseSuccess(measured),
    extractionDurationMs: distributionOf(steps, (measurement) => measurement.durationMs),
    extractionMsPerPage: distributionOf(steps, (measurement) => (measurement.durationMs === null || !measurement.pagesFollowed ? null : measurement.durationMs / measurement.pagesFollowed)),
  };
}

/**
 * Whether one judged step matched what its expectation could judge.
 *
 * A compared step matched when every expected record was compared and matched
 * and no record was left over on either side; a count-only step matched when
 * the counts agree. A step that judged neither cannot have matched: there is
 * nothing it could have matched.
 */
export function extractionStepMatched(measurement: RunExtractionMeasurement): boolean {
  if (measurement.status !== "judged") return false;
  if (measurement.recordsListed) {
    return measurement.expectedRecords === measurement.observedRecords
      && measurement.matchedRecords === measurement.comparedRecords
      && measurement.comparedRecords === measurement.expectedRecords
      && measurement.presentFields === measurement.expectedFields;
  }
  return measurement.countStated && measurement.expectedRecords === measurement.observedRecords;
}

/** Whether a judged step actually compared something, which is what makes a mismatch evidence rather than a gap. */
const stepJudgedSomething = (measurement: RunExtractionMeasurement): boolean =>
  measurement.status === "judged" && (measurement.recordsListed || measurement.countStated);

type Step = { measurement: RunExtractionMeasurement; resultIndex: number };
type Run = { evaluation: RunEvaluation; resultIndex: number };

/** A pooled rate from `benchExtractionAccuracy` with the workflow results its steps came from. */
function rateOverSteps(pooled: { count: number; total: number }, population: readonly Step[]): BenchRate {
  return { count: pooled.count, total: pooled.total, workflows: workflowsOf(population), rate: pooled.total === 0 ? null : pooled.count / pooled.total };
}

/**
 * Σ present fields ÷ Σ expected fields over the judged steps, in fields.
 *
 * Only a step whose expectation listed records names a field at all, so a
 * count-only step contributes nothing to either side and cannot dilute the
 * rate. A field is present when the record carried a **value** for it: a field
 * restored as `null` carried none (`run-expectations/extraction/judgement.ts`,
 * `carriesField`), which is what keeps this from reading 1.000 on the Flow
 * lane, where Core's stored schema guarantees every key.
 */
function fieldCompleteness(judged: readonly Step[]): BenchRate {
  const population = judged.filter(({ measurement }) => measurement.expectedFields > 0);
  const present = sum(population, ({ measurement }) => measurement.presentFields);
  const expected = sum(population, ({ measurement }) => measurement.expectedFields);
  return { count: present, total: expected, workflows: workflowsOf(population), rate: expected === 0 ? null : present / expected };
}

/**
 * Judged steps whose observed page count equals the expected one, over the
 * steps where both were stated.
 *
 * Both sides are required. A step whose expectation named no pages has nothing
 * to be accurate about, and a step whose lane could not observe the pages it
 * followed has nothing to compare -- the Flow lane is exactly that today,
 * because Core's run detail and run datasets record no page count for an
 * extraction. Such a step enters no rate, so a lane that cannot observe pages
 * publishes `rate: null` instead of a number that means "not measured".
 */
function paginationAccuracy(judged: readonly Step[]): BenchRate {
  const population = judged.filter(({ measurement }) => measurement.expectedPages !== null && measurement.pagesFollowed !== null);
  const exact = population.filter(({ measurement }) => measurement.expectedPages === measurement.pagesFollowed).length;
  return { count: exact, total: population.length, workflows: workflowsOf(population), rate: population.length === 0 ? null : exact / population.length };
}

/**
 * Runs whose every judged extraction step matched, over the runs that judged
 * at least one, in runs.
 *
 * A run holding a step that judged nothing is a **miss**, not an exclusion.
 * The claim is "this run's extraction was exactly right", and a step whose
 * expectation nothing could judge leaves the run unable to support it — the
 * same rule `initialExecutionSuccess` applies to a run in which FluxIQ
 * executed nothing, and for the same reason: excluding it would shrink the
 * denominator silently, while a miss moves the number a reader actually looks
 * at. `unjudgeableSteps` beside it says how much of the gap is this.
 */
function exactSuccess(measured: readonly Run[]): BenchRate {
  const population = measured.filter(({ evaluation }) => (evaluation.extraction ?? []).some((measurement) => measurement.status === "judged"));
  const exact = population.filter(({ evaluation }) => (evaluation.extraction ?? []).filter((measurement) => measurement.status === "judged").every(extractionStepMatched)).length;
  return { count: exact, total: population.length, workflows: workflowsOf(population), rate: population.length === 0 ? null : exact / population.length };
}

/**
 * Positive runs FluxIQ reported as successful while a judged extraction did
 * not match, over the positive runs that judged one and got a verdict. Lower
 * is better.
 *
 * A step that judged nothing is **not** evidence of a false success here,
 * although it is a miss for exact success. The two claims differ: "everything
 * matched" cannot be made without a comparison, while "something was wrong and
 * FluxIQ said otherwise" needs a comparison that actually failed. Counting a
 * gap as a false success would report a defect the bench never observed.
 *
 * `oracleVerdict` is deliberately not read, so the historical `falseSuccess`
 * stays comparable across the reports on disk.
 */
function falseSuccess(measured: readonly Run[]): BenchRate {
  const population = measured.filter(({ evaluation }) =>
    evaluation.automationFailureExpected === null && evaluation.reportedVerdict !== null && (evaluation.extraction ?? []).some(stepJudgedSomething));
  const reported = population.filter(({ evaluation }) =>
    evaluation.reportedVerdict === "passed" && (evaluation.extraction ?? []).some((measurement) => stepJudgedSomething(measurement) && !extractionStepMatched(measurement))).length;
  return { count: reported, total: population.length, workflows: workflowsOf(population), rate: population.length === 0 ? null : reported / population.length };
}

function distributionOf(steps: readonly Step[], of: (measurement: RunExtractionMeasurement) => number | null): BenchDistribution {
  return benchDistribution(steps.flatMap(({ measurement }) => {
    const value = of(measurement);
    return value === null || !Number.isFinite(value) ? [] : [value];
  }));
}

const workflowsOf = (population: readonly { resultIndex: number }[]): number => new Set(population.map(({ resultIndex }) => resultIndex)).size;
const sum = (population: readonly Step[], of: (step: Step) => number): number => population.reduce((total, step) => total + of(step), 0);
