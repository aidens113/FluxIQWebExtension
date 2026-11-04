import assert from "node:assert/strict";
import test from "node:test";
import { flowScoreOf, validateAttemptReportRow, validateAttemptSeries, validateRunAnswerScore } from "../../dist/index.js";

const row = (attempt, changed = {}) => ({
  schemaVersion: "0.1", taskId: "task-one", scenarioId: "everything-store", attempt, path: "explore", calls: 10, inputTokens: 100, outputTokens: 10, usd: 0.1, ms: 1000, liveSteps: 5,
  simulation: "not_run", answerVerdict: "right", oracleVerdict: null, flow: "unproven", repeatedActs: [], loopsCaught: { exact_repeat: 0 }, standIns: [], ...changed,
});
const series = (rows, changed = {}) => ({ schemaVersion: "0.1", taskId: "task-one", scenarioId: "everything-store", rows, firstRightAttempt: 1, attemptsUntilDeterministic: null, spendDeltas: [], secondStartedFromFirst: null, ...changed });

test("a row holds every column, and refuses one it does not know or a word outside the closed lists", () => {
  assert.equal(validateAttemptReportRow(row(1)).valid, true);
  assert.equal(validateAttemptReportRow(row(1, { surprise: 1 })).valid, false);
  assert.equal(validateAttemptReportRow(row(1, { path: "guess" })).valid, false);
  assert.equal(validateAttemptReportRow(row(1, { answerVerdict: "passed" })).valid, false, "the answer's words are not the oracle's");
  assert.equal(validateAttemptReportRow(row(0)).valid, false, "attempts count from 1");
  const { usd: _usd, ...noDollars } = row(1);
  assert.equal(validateAttemptReportRow(noDollars).valid, false);
});

test("a series counts its attempts from 1, in order, all of one task", () => {
  assert.equal(validateAttemptSeries(series([row(1), row(2)])).valid, true);
  assert.equal(validateAttemptSeries(series([row(2), row(1)])).valid, false);
  assert.equal(validateAttemptSeries(series([row(1), row(2, { taskId: "task-two" })])).valid, false);
});

test("a score is refused when its verdict does not follow from its parts", () => {
  const right = { verdict: "right", ending: "result", wrongBecause: [], records: "held", finalState: "held", change: "held", shown: "held", repeatedActs: [], missingActs: [], unaskedChanges: [], storedRows: 2, shownRows: 2, flow: "unproven", standIns: [] };
  assert.equal(validateRunAnswerScore(right).valid, true);
  assert.equal(validateRunAnswerScore({ ...right, ending: "no_result" }).valid, false, "the hard rule");
  assert.equal(validateRunAnswerScore({ ...right, shown: "failed" }).valid, false);
  assert.equal(validateRunAnswerScore({ ...right, verdict: "wrong", wrongBecause: ["no_result"], ending: "no_result" }).valid, true);
});

test("the Flow's score reads only the Flow: no Flow, or no playback, is unproven", () => {
  assert.equal(flowScoreOf({ flowCreated: false, oracleVerdict: null }), "unproven");
  assert.equal(flowScoreOf({ flowCreated: null, oracleVerdict: "passed" }), "unproven");
  assert.equal(flowScoreOf({ flowCreated: true, oracleVerdict: null }), "unproven");
  assert.equal(flowScoreOf({ flowCreated: true, oracleVerdict: "passed" }), "playback_held");
  assert.equal(flowScoreOf({ flowCreated: true, oracleVerdict: "failed" }), "playback_failed");
});
