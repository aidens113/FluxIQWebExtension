import assert from "node:assert/strict";
import test from "node:test";
import { assertRunEvaluation, type ExpectedExtraction, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { runExtractionMeasurements, type ExtractionStepRead } from "../extraction-measurements.js";

const records = [{ name: "Kettle", price: "$25.00" }, { name: "Lamp", price: "$40.00" }];

/** What FluxIQ's own extraction reports: the records, and the read's account of itself. */
const fluxiqRead = (overrides: Partial<ExtractionStepRead["observed"]> = {}): ExtractionStepRead => ({
  records,
  observed: { nonStringValues: 0, pagesRead: 3, truncated: false, durationMs: 120, ...overrides },
});

const script: ScenarioStep[] = [
  { id: "open", operation: "navigate", path: "/catalog" },
  { id: "read-all", operation: "extract", target: "testid:card", fields: { name: "testid:name", price: "testid:price" } },
  { id: "settled", operation: "checkpoint" },
  { id: "read-more", operation: "extract", target: "testid:row", fields: { name: "testid:name" } },
];

const expected: ExpectedExtraction[] = [{ step: "read-all", count: 2, records, pages: 3, truncated: false }];

test("one measurement per extract step, at its own position in the script", () => {
  const measurements = runExtractionMeasurements({ script, expected, read: new Map([["read-all", fluxiqRead()]]) });
  assert.deepEqual(measurements.map((measurement) => [measurement.stepIndex, measurement.status]), [[1, "judged"], [3, "not_expected"]]);
});

test("the pages, truncation and duration FluxIQ reported reach the measurement, so both sides of a pagination comparison exist", () => {
  const [judged] = runExtractionMeasurements({ script, expected, read: new Map([["read-all", fluxiqRead()]]) });
  assert.equal(judged?.expectedPages, 3);
  assert.equal(judged?.pagesFollowed, 3);
  assert.equal(judged?.truncated, false);
  assert.equal(judged?.durationMs, 120);
  assert.equal(judged?.matchedRecords, 2);
  assert.equal(judged?.comparedRecords, 2);
  assert.equal(judged?.presentFields, judged?.expectedFields);
});

/**
 * The defect this whole chain exists to prevent, in its newest possible form:
 * publishing real numbers must not become a way to publish numbers nothing
 * earned. A read that reported no pages states `null`, and a step stating
 * `null` enters no pagination rate at all (`bench/extraction-metrics.ts`).
 */
test("what the read did not report is stated as null, never defaulted", () => {
  const referenceReader: ExtractionStepRead = { records, observed: { nonStringValues: 0 } };
  const [judged] = runExtractionMeasurements({ script, expected, read: new Map([["read-all", referenceReader]]) });
  assert.equal(judged?.pagesFollowed, null);
  assert.equal(judged?.truncated, null);
  assert.equal(judged?.durationMs, null);
  // The declared side is still stated: the gap is in what was observed, and a
  // measurement that dropped the expectation too would look like a step that
  // was never paginated rather than one whose pages nothing reported.
  assert.equal(judged?.expectedPages, 3);
});

test("an expected step that never ran is not_run with nothing observed, and judges no value", () => {
  const [notRun] = runExtractionMeasurements({ script, expected, read: new Map() });
  assert.equal(notRun?.status, "not_run");
  assert.equal(notRun?.expectedRecords, 2);
  assert.equal(notRun?.observedRecords, 0);
  assert.equal(notRun?.comparedRecords, 0);
  assert.equal(notRun?.matchedRecords, 0);
  assert.equal(notRun?.pagesFollowed, null);
  assert.equal(notRun?.nonStringValues, 0);
});

test("a step that ran with no expectation judges nothing, and a script with no extract step measures nothing", () => {
  const [, unexpected] = runExtractionMeasurements({ script, expected, read: new Map([["read-more", fluxiqRead()]]) });
  assert.equal(unexpected?.status, "not_expected");
  assert.equal(unexpected?.expectedRecords, 0);
  assert.equal(unexpected?.recordsListed, false);
  assert.equal(unexpected?.countStated, false);
  assert.equal(unexpected?.comparedRecords, 0);
  assert.deepEqual(runExtractionMeasurements({ script: script.filter((step) => step.operation !== "extract"), expected: undefined, read: new Map() }), []);
});

test("a step whose records did not match is still measured, which is the measurement worth publishing", () => {
  const wrong: ExtractionStepRead = { records: [records[0]!, { name: "Lamp", price: "$41.00" }], observed: { nonStringValues: 1, pagesRead: 2, truncated: true, durationMs: 90 } };
  const [judged] = runExtractionMeasurements({ script, expected, read: new Map([["read-all", wrong]]) });
  assert.equal(judged?.status, "judged");
  assert.equal(judged?.comparedRecords, 2);
  assert.equal(judged?.matchedRecords, 1);
  assert.equal(judged?.pagesFollowed, 2);
  assert.equal(judged?.truncated, true);
  assert.equal(judged?.nonStringValues, 1);
});

/**
 * The measurements are published inside a `RunEvaluation`, whose validator
 * refuses a string anywhere in one (D6): no step id, field name or page value
 * may reach it. Checked against the real validator rather than by reading the
 * shape, because this producer builds each measurement from a fixture's own
 * steps and expectations, which are made of exactly those strings.
 */
test("the published measurements carry counts and flags only, and pass the evaluation contract", () => {
  const measurements = runExtractionMeasurements({ script, expected, read: new Map([["read-all", fluxiqRead()]]) });
  assert.equal(JSON.stringify(measurements).includes("read-all"), false);
  assert.equal(JSON.stringify(measurements).includes("Kettle"), false);
  assert.doesNotThrow(() => assertRunEvaluation({
    schemaVersion: "0.3", runId: "run-1", verdict: "passed", facilityFailure: null, invariants: [], metrics: { steps: 4 },
    scenarioId: "product-catalog", workflowId: "paginated-extraction", variantId: null, repeatIndex: 0,
    lane: "recording", flowCreated: null, oracleVerdict: "passed", reportedVerdict: "passed",
    automationFailureReported: null, automationFailureExpected: null, harnessActivations: 0, durationMs: 1000, actions: [],
    evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 },
    llm: { mode: "disabled", profileId: null, calls: 0 },
    extraction: measurements,
    harnessRecovery: null, adaptationCost: null, adaptationValidation: null, adaptationPersistence: null, adaptationReuse: null,
  }));
});
