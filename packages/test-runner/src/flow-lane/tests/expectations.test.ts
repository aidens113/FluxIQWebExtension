import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import type { ExpectedExtraction, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { assertFlowActions, assertFlowExtraction, assertFlowFailure, judgeFlowExtraction } from "../expectations.js";
import type { PersistedFlowAction } from "../persisted-flow-run.js";
import type { FlowRunDataset } from "../run-datasets.js";

const action = (actionType: string, status: PersistedFlowAction["status"]): PersistedFlowAction => ({ actionType, nodeId: "node-1", attemptIndex: 0, status, startedAt: new Date(0).toISOString(), durationMs: 1, failure: null });

/** Approved Flows' node output ids, as `flowActionTypes` maps them: one that can extract, and one that cannot. */
const extractingFlow = new Map([["node.open", "web.dom.click"], ["node.extract", "web.dom.extract_list"]]);
const clickOnlyFlow = new Map([["node.open", "web.dom.click"]]);

test("every expected action must appear with its expected outcome", () => {
  const actions = [action("web.dom.type", "succeeded"), action("web.dom.click", "succeeded")];
  assertFlowActions([{ action: "web.dom.type" }, { action: "web.dom.click", outcome: "succeeded" }], actions);
  assertFlowActions(undefined, actions);
  assert.throws(
    () => assertFlowActions([{ action: "web.dom.select" }], actions),
    (error: unknown) => error instanceof RunnerFailure && error.category === "action.dispatch",
  );
  assert.throws(() => assertFlowActions([{ action: "web.dom.click", outcome: "failed" }], actions), /outcome failed/);
});

/**
 * Lab Stage 2's W15 `popup-blocked` and W26 `no-context`: each negative variant
 * pins `{ action: "web.dom.click" }` with no outcome, Core failed the click with
 * the variant's expected failure, and a missing outcome read as `succeeded`
 * failed both rows.
 */
test("an expected action with no outcome is judged on its presence only, never as succeeded", () => {
  const failedClick = [action("web.dom.type", "succeeded"), action("web.dom.click", "failed")];
  assertFlowActions([{ action: "web.dom.click" }], failedClick);
  // A declared outcome is still judged.
  assert.throws(() => assertFlowActions([{ action: "web.dom.click", outcome: "succeeded" }], failedClick), /with outcome succeeded; it produced web\.dom\.type:succeeded, web\.dom\.click:failed$/);
  // Absence still fails, and neither the message nor the details claim an outcome the entry did not declare.
  assert.throws(
    () => assertFlowActions([{ action: "web.dom.click" }], [action("web.dom.type", "succeeded")]),
    (error: unknown) => error instanceof RunnerFailure && error.category === "action.dispatch"
      && error.message === "The Flow did not produce a web.dom.click action; it produced web.dom.type:succeeded"
      && error.details !== undefined && !("expectedOutcome" in error.details),
  );
  assert.throws(() => assertFlowActions([{ action: "web.dom.click" }], []), /action; it produced no attempts$/);
});

test("an expected failure is matched against Core's structured record, by category and declared code", () => {
  assertFlowFailure({ category: "auth_required" }, { category: "auth_required", code: "web.auth.session_expired", retryable: false });
  assertFlowFailure({ category: "auth_required", code: "session.expired" }, { category: "auth_required", code: "session.expired", retryable: false });
  assert.throws(() => assertFlowFailure({ category: "auth_required" }, null), /reported no structured failure/);
  assert.throws(() => assertFlowFailure({ category: "auth_required" }, { category: "timeout", code: "web.action.timeout", retryable: false }), /expected auth_required/);
  assert.throws(() => assertFlowFailure({ category: "auth_required", code: "session.expired" }, { category: "auth_required", code: "other", retryable: false }), /failure code/);
});

test("a workflow expecting no failure fails on any reported failure, so a differently broken run cannot pass", () => {
  assertFlowFailure(undefined, null);
  assert.throws(
    () => assertFlowFailure(undefined, { category: "target_not_found", code: "web.target.selector_miss", retryable: false }),
    (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /unexpected target_not_found/.test(error.message),
  );
});

/** The recording's candidate order, as `recordedCandidateOrder` builds it. */
const candidateOrder = new Map([["node.open", 0], ["node.extract", 1], ["node.extract.second", 2]]);

const script = (...stepIds: string[]): ScenarioStep[] => [
  { id: "open", operation: "click", target: "#open" },
  ...stepIds.map((id): ScenarioStep => ({ id, operation: "extract", target: ".item", fields: { name: ".name" } })),
];

const dataset = (nodeId: string, records: Array<Record<string, string | null>>, overrides: Partial<FlowRunDataset> = {}): FlowRunDataset => ({
  datasetId: `dataset.${nodeId}`, nodeIds: [nodeId], records, recordCount: records.length,
  storeTruncated: false, invalidCount: 0, nonStringValues: 0, pages: 1, ...overrides,
});

/** A Flow holding one extract node per recorded extract step, which is what an approved Flow of that recording has. */
const extractingFlowOf = (steps: number) => new Map([["node.open", "web.dom.click"], ...Array.from({ length: steps }, (_value, index) => [`node.extract.${index}`, "web.dom.extract_list"] as const)]);

const scenarioOrigin = "http://127.0.0.1:4310";

const judge = (expected: ExpectedExtraction[] | undefined, steps: string[], datasets: FlowRunDataset[], actionTypes = extractingFlow) =>
  judgeFlowExtraction({ expected, script: script(...steps), datasets, actionTypes, candidateOrder, durationsByNode: new Map([["node.extract", 40]]), scenarioOrigin });

/**
 * A Flow whose extraction reads a link's resolved address stores it on the
 * run's own port, which a fixture cannot write down. The lane resolves the
 * fixture's root-relative href against the run's origin, in the measurement
 * it publishes and in the assertion it then makes, and nowhere else.
 */
test("a same-origin absolute URL matches the root-relative href expected, in the measurement and the assertion, and never another origin", () => {
  const expected = [{ name: "Alpha", url: "/scenarios/catalog/products/alpha" }, { name: "Beta", url: "/scenarios/catalog/products/beta" }];
  const onOrigin = (origin: string) => expected.map((record) => ({ ...record, url: `${origin}${record.url}` }));

  const judged = judge([{ step: "read-catalog", count: 2, records: expected }], ["read-catalog"], [dataset("node.extract", onOrigin(scenarioOrigin))]);
  assert.equal(judged.measurements[0]?.matchedRecords, 2);
  assertFlowExtraction(judged);

  const elsewhere = judge([{ step: "read-catalog", count: 2, records: expected }], ["read-catalog"], [dataset("node.extract", onOrigin("http://127.0.0.1:4311"))]);
  assert.equal(elsewhere.measurements[0]?.matchedRecords, 0);
  assert.throws(() => assertFlowExtraction(elsewhere), /record 0 does not match/);

  // An expected absolute URL is compared as written, even on the run's own origin.
  const absolute = onOrigin(scenarioOrigin);
  assertFlowExtraction(judge([{ step: "read-catalog", records: absolute }], ["read-catalog"], [dataset("node.extract", absolute)]));
  const rootRelative = judge([{ step: "read-catalog", records: absolute }], ["read-catalog"], [dataset("node.extract", expected)]);
  assert.equal(rootRelative.measurements[0]?.matchedRecords, 0);
  assert.throws(() => assertFlowExtraction(rootRelative), /record 0 does not match/);
});

test("a step's records are compared against the dataset Core stored for it, and its measurement states the basis", () => {
  const page = [{ name: "Alpha" }, { name: "Beta" }];
  const judged = judge([{ step: "read-catalog", count: 2, records: page }], ["read-catalog"], [dataset("node.extract", page)]);
  assert.equal(judged.expectation, "judged");
  assert.deepEqual(judged.measurements.map(measurement => [measurement.stepIndex, measurement.status, measurement.comparedRecords, measurement.matchedRecords, measurement.durationMs]), [[1, "judged", 2, 2, 40]]);
  assertFlowExtraction(judged);

  const wrong = judge([{ step: "read-catalog", records: [{ name: "Beta" }, { name: "Alpha" }] }], ["read-catalog"], [dataset("node.extract", page)]);
  assert.equal(wrong.measurements[0]?.matchedRecords, 0);
  assert.throws(() => assertFlowExtraction(wrong), /record 0 does not match/);
  assert.throws(() => assertFlowExtraction(judge([{ step: "read-catalog", count: 3 }], ["read-catalog"], [dataset("node.extract", page)])), /expected 3/);
});

/**
 * Pairing by attempt index mis-aligned the moment any node retried, and
 * pairing by node id would read Core's ids into the judgement. The datasets
 * arrive here in Core's own order, which is the reverse of the recording's.
 */
test("datasets pair with extract steps by candidate order, not by the order Core listed them", () => {
  const first = [{ name: "Alpha" }];
  const second = [{ name: "Beta" }];
  const judged = judge(
    [{ step: "read-first", records: first }, { step: "read-second", records: second }],
    ["read-first", "read-second"],
    [dataset("node.extract.second", second), dataset("node.extract", first)],
    extractingFlowOf(2),
  );
  assert.deepEqual(judged.measurements.map(measurement => measurement.matchedRecords), [1, 1]);
  assertFlowExtraction(judged);
});

/**
 * An `extract` step now records a data-extraction action, so a Flow without an
 * extract node is a recording defect. The lane used to publish
 * `not_applicable` here and judge nothing at all.
 */
test("a Flow with fewer extract nodes than recorded extract steps fails as a recording defect, never as an unjudged expectation", () => {
  const judged = judge([{ step: "read-catalog", count: 1 }], ["read-catalog"], [], clickOnlyFlow);
  assert.equal(judged.expectation, "judged");
  assert.equal(judged.extractNodes, 0);
  assert.throws(() => assertFlowExtraction(judged), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "recording.contract");
    assert.deepEqual(error.details, { extractNodes: 0, extractSteps: 1 });
    return true;
  });
  // A workflow that declares no extraction has nothing to judge, whatever the Flow holds.
  assert.equal(judge(undefined, ["read-catalog"], []).expectation, "not_expected");
  assertFlowExtraction(judge([], ["read-catalog"], [], clickOnlyFlow));
});

test("an expected step the run stored no dataset for is measured as not run, and fails as a missing extraction", () => {
  const judged = judge([{ step: "read-catalog", count: 2, records: [{ name: "Alpha" }, { name: "Beta" }] }], ["read-catalog"], []);
  assert.deepEqual(judged.measurements.map(measurement => [measurement.status, measurement.expectedRecords, measurement.observedRecords, measurement.comparedRecords]), [["not_run", 2, 0, 0]]);
  assert.throws(() => assertFlowExtraction(judged), /stored no extraction records for expected extract step read-catalog/);
});

test("an extract step no expectation names is measured as not expected, so it enters no rate", () => {
  const judged = judge([], ["read-catalog"], [dataset("node.extract", [{ name: "Alpha" }])]);
  assert.deepEqual(judged.measurements.map(measurement => [measurement.status, measurement.recordsListed, measurement.countStated, measurement.observedRecords]), [["not_expected", false, false, 1]]);
});

/** X0.7: a value the reader leaves out of a record can make that record match, so it is judged before the records. */
test("a judged extraction whose datasets carried a value that is not a string fails as that, even when the records match", () => {
  const page = [{ name: "Alpha" }];
  const judged = judge([{ step: "read-catalog", records: page }], ["read-catalog"], [dataset("node.extract", page, { nonStringValues: 1 })]);
  assert.equal(judged.nonStringValues, 1);
  assert.throws(() => assertFlowExtraction(judged), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "runtime.behavior");
    assert.equal(error.message, "The Flow's extract attempts carried 1 field value(s) that are not strings");
    return true;
  });
});

/**
 * Core's run detail and its run datasets record no page count for an
 * extraction, and a dataset's `truncated` is Core's own row cap rather than
 * the page's item cap. Neither may be read as the other, and neither may pass
 * silently: the step names them as unjudged, the measurement reports
 * `pagesFollowed: null`, and `expectedPages` keeps the declared side so a
 * pagination accuracy has both or neither.
 */
test("pages and truncated are named as unjudged on this lane rather than refused or quietly met", () => {
  const page = [{ name: "Alpha" }, { name: "Beta" }];
  const judged = judge([{ step: "read-catalog", records: page, pages: 3, truncated: false }], ["read-catalog"], [dataset("node.extract", page, { storeTruncated: true })]);
  assert.deepEqual(judged.steps[0]?.unjudged, ["pages", "truncated"]);
  assert.equal(judged.steps[0]?.measurement.expectedPages, 3);
  assert.equal(judged.steps[0]?.measurement.pagesFollowed, null);
  assert.equal(judged.steps[0]?.measurement.truncated, null);
  // The entry handed to the assertion no longer declares them, so it is neither refused as unjudgeable nor judged against Core's row cap.
  assert.deepEqual(judged.steps[0]?.entries, [{ step: "read-catalog", records: page }]);
  assertFlowExtraction(judged);
});

/**
 * D16: Core stores a field the page could not read as an absent key, the
 * reader restores it as `null`, and an expectation matches `null` only against
 * `null`. A restored null carried no value, so it is not a present field.
 */
test("a restored null matches an expected null and is not counted as a field the record carried", () => {
  const records = [{ name: "Alpha", price: null }];
  const matching = judge([{ step: "read-catalog", records: [{ name: "Alpha", price: null }] }], ["read-catalog"], [dataset("node.extract", records)]);
  assert.equal(matching.measurements[0]?.matchedRecords, 1);
  assert.equal(matching.measurements[0]?.presentFields, 2, "an expected null is carried when the record holds null");
  assertFlowExtraction(matching);

  const wanted = judge([{ step: "read-catalog", records: [{ name: "Alpha", price: "12.00" }] }], ["read-catalog"], [dataset("node.extract", records)]);
  assert.deepEqual([wanted.measurements[0]?.expectedFields, wanted.measurements[0]?.presentFields], [2, 1]);
  assert.throws(() => assertFlowExtraction(wanted), /carried no value for 1 required field/);
});
