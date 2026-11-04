import assert from "node:assert/strict";
import test from "node:test";
import { assertBenchReport, assertRunEvaluation, type RunAnswerScore, type RunEvaluation } from "@fluxiq-web-extension/test-contracts";
import { aggregateBenchReport } from "../../aggregate-report.js";
import { benchAnswerRate, benchAnswerScore } from "../index.js";

const answer = (changed: Partial<RunAnswerScore> = {}): RunAnswerScore => ({ verdict: "right", ending: "result", wrongBecause: [], records: "held", finalState: "not_declared", change: "held", shown: "held", repeatedActs: [], missingActs: [], unaskedChanges: [], storedRows: 2, shownRows: 2, flow: "unproven", standIns: [], ...changed });
const WRONG = answer({ verdict: "wrong", wrongBecause: ["repeated_act"], repeatedActs: [{ name: "Two kettles", asked: 2, landed: 4 }], flow: "unproven" });

const llm = { mode: "disabled", profileId: null, calls: 0 };
const evaluation = (repeatIndex: number, changed: Partial<RunEvaluation> = {}): RunEvaluation => ({
  schemaVersion: "0.3", runId: `run-${repeatIndex}`, verdict: "passed", facilityFailure: null, invariants: [], metrics: {},
  scenarioId: "everything-store", workflowId: null, variantId: null, repeatIndex, lane: "flow", flowCreated: true, oracleVerdict: "passed", reportedVerdict: "passed",
  automationFailureReported: null, automationFailureExpected: null, harnessActivations: 0, durationMs: 10, actions: [], evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 }, llm,
  extraction: null, harnessRecovery: null, adaptationCost: null, adaptationValidation: null, adaptationPersistence: null, adaptationReuse: null, ...changed,
} as RunEvaluation);
const draftRight = (repeatIndex: number) => evaluation(repeatIndex, { flowCreated: false, oracleVerdict: null, reportedVerdict: null, answerVerdict: "right", answer: answer() });

test("an evaluation of a draft with a right answer is valid with no Flow and no playback verdict", () => {
  assert.doesNotThrow(() => assertRunEvaluation(draftRight(0)));
});

test("an evaluation from before answer scores reads as it did, stating none", () => {
  const old = evaluation(0);
  assert.doesNotThrow(() => assertRunEvaluation(old));
  assert.equal(old.answerVerdict, undefined);
});

test("the contract refuses a playback verdict with no Flow: oracleVerdict is the Flow's playback only", () => {
  assert.throws(() => assertRunEvaluation(evaluation(0, { flowCreated: false, oracleVerdict: "passed", reportedVerdict: null, answerVerdict: "right", answer: answer() })), /oracleVerdict/u);
});

test("what FluxIQ reported may stand beside an attempt judged with no Flow, and only there", () => {
  assert.doesNotThrow(() => assertRunEvaluation({ ...draftRight(0), reportedVerdict: "unverified" }));
  assert.throws(() => assertRunEvaluation(evaluation(0, { flowCreated: false, oracleVerdict: null, reportedVerdict: "unverified" })), /reportedVerdict/u);
});

test("the contract refuses a verdict and a score that disagree, or one without the other", () => {
  assert.throws(() => assertRunEvaluation(evaluation(0, { flowCreated: false, oracleVerdict: null, reportedVerdict: null, answerVerdict: "wrong", answer: answer() })), /answerVerdict/u);
  assert.throws(() => assertRunEvaluation(evaluation(0, { answerVerdict: "right" })), /answer/u);
  assert.throws(() => assertRunEvaluation(evaluation(0, { lane: "recording", flowCreated: null, answerVerdict: "right", answer: answer() })), /recording/u);
});

test("the answer rate and the pass rate stay apart: a draft that passed on its answer moves no Flow rate", () => {
  const report = aggregateBenchReport({
    reportId: "report-1", generatedAt: "2026-11-03T00:00:00.000Z", corpusId: "answer-first", repeatCount: 2, target: "isolated",
    results: [{ corpusRowId: "W01", scenarioId: "everything-store", workflowId: null, variantId: null, lane: "flow", evaluations: [draftRight(0), draftRight(1)] }],
  });
  assertBenchReport(report);
  const row = report.workflows[0]!;
  assert.equal(row.passRate, 0, "the Flow chain's rate: no Flow stood behind either pass");
  assert.equal(row.flakeClass, "stable-fail");
  assert.equal(row.answerRate, 1, "the person got the right answer both times");
  assert.equal(report.metrics.answerScore?.right, 2);
  assert.equal(report.metrics.answerScore?.flow.unproven, 2);
  assert.equal(report.metrics.ratesByLane?.flow?.flowCreationSuccess.count, 0);
});

test("a report of old runs states no answer score and infers none from their pass rate", () => {
  const report = aggregateBenchReport({
    reportId: "report-2", generatedAt: "2026-11-03T00:00:00.000Z", corpusId: "old", repeatCount: 1, target: "isolated",
    results: [{ corpusRowId: "W01", scenarioId: "everything-store", workflowId: null, variantId: null, lane: "flow", evaluations: [evaluation(0)] }],
  });
  assert.equal(report.workflows[0]?.passRate, 1);
  assert.equal(report.workflows[0]?.answerRate, undefined);
  assert.equal(report.metrics.answerScore, undefined);
});

test("the rate counts right over right and wrong; excused endings are reported and enter no rate", () => {
  const runs = [
    evaluation(0, { flowCreated: false, oracleVerdict: null, reportedVerdict: null, answerVerdict: "right", answer: answer() }),
    evaluation(1, { flowCreated: false, oracleVerdict: null, reportedVerdict: null, answerVerdict: "wrong", answer: WRONG }),
    evaluation(2, { flowCreated: false, oracleVerdict: null, reportedVerdict: null, answerVerdict: "budget_out", answer: answer({ verdict: "budget_out", ending: "budget_out" }) }),
    evaluation(3, { flowCreated: false, oracleVerdict: null, reportedVerdict: null, answerVerdict: "stopped_by_person", answer: answer({ verdict: "stopped_by_person", ending: "stopped_by_person" }) }),
  ];
  const score = benchAnswerScore(runs)!;
  assert.deepEqual([score.judged, score.right, score.wrong, score.budgetOut, score.stoppedByPerson, score.rate, score.runsWithRepeatedActs], [4, 1, 1, 1, 1, 0.5, 1]);
  assert.equal(benchAnswerRate(runs), 0.5);
  assert.equal(benchAnswerRate([runs[2]!]), null, "every judged run excused: a refusal to publish a number");
});

test("a run with a stand-in anywhere proves the Lab and not the product: it enters no rate and is counted apart", () => {
  const scripted = evaluation(0, { flowCreated: false, oracleVerdict: null, reportedVerdict: null, answerVerdict: "right", answer: answer({ standIns: ["chat_turn"] }) });
  const score = benchAnswerScore([scripted])!;
  assert.deepEqual([score.judged, score.right, score.standInRuns, score.rate], [0, 0, 1, null]);
  assert.equal(benchAnswerRate([scripted]), undefined);
});
