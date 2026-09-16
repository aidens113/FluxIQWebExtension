import type { RunExtractionMeasurement } from "@fluxiq-web-extension/test-contracts";

/**
 * How many extraction steps each rate below stands on. It is stated beside the
 * rates, never inferred from them: a reader who cannot see how many steps
 * compared a record value cannot tell an accuracy measured over 68 records
 * from one measured over none, and the whole point of the split is that those
 * two are not the same claim.
 *
 * `judgedSteps` is always `comparedSteps + countOnlySteps + unjudgeableSteps`.
 */
export type ExtractionAccuracyBasis = {
  /** Steps measured against an expectation (`status === "judged"`). */
  judgedSteps: number;
  /** Steps with no judgement to make: expected but never run, or run with no expectation. */
  unjudgedSteps: number;
  /** Judged steps whose expectation listed the records, so their values were compared. */
  comparedSteps: number;
  /** Judged steps that stated a count and listed no records: counted, never compared. */
  countOnlySteps: number;
  /** Judged steps that stated neither, so nothing in them could be judged at all. */
  unjudgeableSteps: number;
};

/**
 * One pooled rate: `count` of `total` in the unit its metric defines (records
 * for record accuracy, steps for count accuracy), over `steps` extraction
 * steps.
 *
 * `rate` is `null` when `total` is 0 -- a **refusal** to publish a number for
 * a population that judged nothing, in the same spirit as the refusal
 * `assertExtraction` raises for an expectation nothing reported a value for.
 * A null rate is read as unmeasured and never as 0 or 1.
 */
export type ExtractionPooledRate = { count: number; total: number; steps: number; rate: number | null };

/** One lane's extraction accuracy, with the basis the rates were computed over. */
export type BenchExtractionAccuracy = {
  basis: ExtractionAccuracyBasis;
  /**
   * Σ `matchedRecords` ÷ Σ `max(expectedRecords, observedRecords)` over the
   * **compared** steps alone.
   */
  recordAccuracy: ExtractionPooledRate;
  /** Count-only steps whose observed record count equals the expected one, over the count-only steps. */
  countAccuracy: ExtractionPooledRate;
};

/**
 * Pools a lane's extraction measurements into a record accuracy and a count
 * accuracy, over separate populations that never mix.
 *
 * A step whose expectation stated a count and listed no records compared not
 * one value. Pooling it into the record accuracy scored it a perfect match --
 * `large-table`'s 1,000-record step alone would have contributed 1,000 matches
 * out of 1,000, swamping the roughly one-in-68 tolerance the corpus is sized
 * for and hiding a real record regression inside a green number (x5f). Such a
 * step is therefore **excluded from the record accuracy and stated separately**
 * as `countOnlySteps`, with its own rate over its own population: it judged
 * that the count was right, which is a smaller claim honestly made rather than
 * a larger one made up.
 *
 * The population is "the expectation listed records", not "records were
 * compared". A step that listed 68 records and observed none compared nothing
 * either, but it is a total extraction failure, and selecting on what was
 * compared would have dropped it out of the rate and let the failure raise the
 * number it belongs in. It stays, contributing 0 of 68.
 *
 * A step that stated neither a count nor records enters no rate at all:
 * `expectedRecords` was adopted from what the step observed, so calling it
 * count-accurate would score a hit for agreeing with itself.
 */
export function benchExtractionAccuracy(measurements: readonly RunExtractionMeasurement[]): BenchExtractionAccuracy {
  const judged = measurements.filter((measurement) => measurement.status === "judged");
  const compared = judged.filter((measurement) => measurement.recordsListed);
  const countOnly = judged.filter((measurement) => !measurement.recordsListed && measurement.countStated);
  const matchedRecords = sum(compared, (measurement) => measurement.matchedRecords);
  const pooledRecords = sum(compared, (measurement) => Math.max(measurement.expectedRecords, measurement.observedRecords));
  const exactCounts = countOnly.filter((measurement) => measurement.expectedRecords === measurement.observedRecords).length;
  return {
    basis: {
      judgedSteps: judged.length,
      unjudgedSteps: measurements.length - judged.length,
      comparedSteps: compared.length,
      countOnlySteps: countOnly.length,
      unjudgeableSteps: judged.length - compared.length - countOnly.length,
    },
    recordAccuracy: pooledRate(matchedRecords, pooledRecords, compared.length),
    countAccuracy: pooledRate(exactCounts, countOnly.length, countOnly.length),
  };
}

function pooledRate(count: number, total: number, steps: number): ExtractionPooledRate {
  return { count, total, steps, rate: total === 0 ? null : count / total };
}

function sum(measurements: readonly RunExtractionMeasurement[], of: (measurement: RunExtractionMeasurement) => number): number {
  return measurements.reduce((total, measurement) => total + of(measurement), 0);
}
