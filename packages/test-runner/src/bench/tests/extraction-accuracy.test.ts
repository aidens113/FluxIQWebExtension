import assert from "node:assert/strict";
import test from "node:test";
import type { ExpectedExtraction, ExtractionMeasurementStatus, RunExtractionMeasurement } from "@fluxiq-web-extension/test-contracts";
import { benchExtractionAccuracy } from "../extraction-accuracy.js";
import { measureExtraction, type ExtractionRecord } from "../../run-expectations/index.js";

const NOTHING_REPORTED = { nonStringValues: 0 };

/**
 * One measured step, through the producer the bench reads rather than a
 * hand-written measurement: the defect below was a disagreement between what
 * `measureExtraction` counted and what pooling it meant, so a test that wrote
 * the counts itself could not have found it.
 */
function step(stepIndex: number, entry: ExpectedExtraction | undefined, records: readonly ExtractionRecord[], status: ExtractionMeasurementStatus = "judged"): RunExtractionMeasurement {
  return { stepIndex, status, ...measureExtraction(entry, records, NOTHING_REPORTED) };
}

/** `large-table`'s count-only step: 1,000 records expected, 1,000 returned, and every value of them junk. */
const thousandJunkRecords = Array.from({ length: 1000 }, () => ({ name: "", price: "" }));
const countOnlyStep = () => step(0, { step: "big", count: 1000 }, thousandJunkRecords);
/** A fully compared step: two records listed, the second one wrong. */
const comparedStep = () => step(1, { step: "read", records: [{ name: "Kettle" }, { name: "Lamp" }] }, [{ name: "Kettle" }, { name: "Skillet" }]);

test("a count-only step is excluded from the pooled record accuracy instead of scoring a perfect match", () => {
  const countOnly = countOnlyStep();
  // The producer no longer calls 1,000 uncompared records 1,000 matches: pooling every
  // step naively read 1001/1002 = 0.999 for a bench in which one record value was compared
  // and it was wrong.
  assert.deepEqual({ compared: countOnly.comparedRecords, matched: countOnly.matchedRecords }, { compared: 0, matched: 0 });

  const { basis, recordAccuracy, countAccuracy } = benchExtractionAccuracy([countOnly, comparedStep()]);
  // The honest rate: one record of the two that were compared matched.
  assert.deepEqual(recordAccuracy, { count: 1, total: 2, steps: 1, rate: 0.5 });
  assert.equal(recordAccuracy.total, 2); // never 1002: the 1,000 counted records are not in the denominator either
  // The count-only step is stated, with the smaller claim it can support: the count was right.
  assert.deepEqual(countAccuracy, { count: 1, total: 1, steps: 1, rate: 1 });
  assert.deepEqual(basis, { judgedSteps: 2, unjudgedSteps: 0, comparedSteps: 1, countOnlySteps: 1, unjudgeableSteps: 0 });
});

test("a step whose listed records were never observed stays in the rate as a zero, never as an exclusion", () => {
  const expected = Array.from({ length: 68 }, (_, index) => ({ name: `row-${index}` }));
  const extractedNothing = step(0, { step: "read", records: expected }, []);
  assert.equal(extractedNothing.comparedRecords, 0); // nothing to compare against -- but the expectation listed records, so it is judged
  const { basis, recordAccuracy } = benchExtractionAccuracy([extractedNothing]);
  assert.deepEqual(recordAccuracy, { count: 0, total: 68, steps: 1, rate: 0 });
  assert.equal(basis.comparedSteps, 1);
});

test("a step that stated neither a count nor records enters no rate: it cannot agree with itself into a hit", () => {
  const silent = step(0, { step: "read" }, [{ name: "Kettle" }, { name: "Lamp" }]);
  assert.deepEqual({ expected: silent.expectedRecords, observed: silent.observedRecords, stated: silent.countStated }, { expected: 2, observed: 2, stated: false });
  const { basis, recordAccuracy, countAccuracy } = benchExtractionAccuracy([silent]);
  assert.deepEqual(basis, { judgedSteps: 1, unjudgedSteps: 0, comparedSteps: 0, countOnlySteps: 0, unjudgeableSteps: 1 });
  assert.equal(recordAccuracy.rate, null);
  assert.equal(countAccuracy.rate, null);
});

test("a lane that compared no record publishes no record accuracy at all", () => {
  const { basis, recordAccuracy, countAccuracy } = benchExtractionAccuracy([countOnlyStep(), step(1, { step: "empty", count: 0 }, [{ name: "Kettle" }])]);
  assert.deepEqual(recordAccuracy, { count: 0, total: 0, steps: 0, rate: null }); // a refusal, read as unmeasured and never as 1
  assert.deepEqual(countAccuracy, { count: 1, total: 2, steps: 2, rate: 0.5 }); // the second step returned a record where none was expected
  assert.deepEqual(basis, { judgedSteps: 2, unjudgedSteps: 0, comparedSteps: 0, countOnlySteps: 2, unjudgeableSteps: 0 });
});

test("steps with no judgement to make are counted apart from the judged ones", () => {
  const notRun = step(0, { step: "read", records: [{ name: "Kettle" }] }, [], "not_run");
  const notExpected = step(1, undefined, [{ name: "Lamp" }], "not_expected");
  const { basis, recordAccuracy, countAccuracy } = benchExtractionAccuracy([notRun, notExpected, comparedStep()]);
  assert.deepEqual(basis, { judgedSteps: 1, unjudgedSteps: 2, comparedSteps: 1, countOnlySteps: 0, unjudgeableSteps: 0 });
  assert.deepEqual(recordAccuracy, { count: 1, total: 2, steps: 1, rate: 0.5 });
  assert.deepEqual(countAccuracy, { count: 0, total: 0, steps: 0, rate: null });
  assert.deepEqual(benchExtractionAccuracy([]).basis, { judgedSteps: 0, unjudgedSteps: 0, comparedSteps: 0, countOnlySteps: 0, unjudgeableSteps: 0 });
});
