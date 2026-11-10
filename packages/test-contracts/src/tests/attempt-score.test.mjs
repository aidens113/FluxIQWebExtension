import assert from "node:assert/strict";
import test from "node:test";
import { attemptCountsAsLive, attemptStandIns, flowScoreOf, validateAttemptReportRow, validateAttemptSeries, validateRunAnswerScore } from "../../dist/index.js";

const row = (attempt, changed = {}) => ({
  schemaVersion: "0.2", taskId: "task-one", scenarioId: "everything-store", attempt, path: "explore", calls: 10, inputTokens: 100, outputTokens: 10, usd: 0.1, ms: 1000, liveSteps: 5,
  simulation: "not_run", answerVerdict: "right", oracleVerdict: null, flow: "unproven", repeatedActs: [], loopsCaught: { exact_repeat: 0 }, standIns: [], live: true, ...changed,
});
const series = (rows, changed = {}) => ({ schemaVersion: "0.2", taskId: "task-one", scenarioId: "everything-store", rows, firstRightAttempt: 1, attemptsUntilDeterministic: null, spendDeltas: [], continuations: [], deterministic: null, ...changed });

test("a row holds every column, and refuses one it does not know or a word outside the closed lists", () => {
  assert.equal(validateAttemptReportRow(row(1)).valid, true);
  assert.equal(validateAttemptReportRow(row(1, { cacheHitPercent: 83 })).valid, true);
  assert.equal(validateAttemptReportRow(row(1, { cacheHitPercent: 101 })).valid, false);
  assert.equal(validateAttemptReportRow(row(1, { surprise: 1 })).valid, false);
  assert.equal(validateAttemptReportRow(row(1, { path: "guess" })).valid, false);
  assert.equal(validateAttemptReportRow(row(1, { answerVerdict: "passed" })).valid, false, "the answer's words are not the oracle's");
  assert.equal(validateAttemptReportRow(row(0)).valid, false, "attempts count from 1");
  const { usd: _usd, ...noDollars } = row(1);
  assert.equal(validateAttemptReportRow(noDollars).valid, false);
});

test("a row with any stand-in can never be counted as live, and a scripted model above all", () => {
  assert.equal(validateAttemptReportRow(row(1, { standIns: ["model", "spend"], live: false })).valid, true);
  assert.equal(validateAttemptReportRow(row(1, { standIns: ["model", "spend"], live: true })).valid, false);
  assert.equal(validateAttemptReportRow(row(1, { standIns: ["spend"], live: true })).valid, false);
  assert.equal(validateAttemptReportRow(row(1, { standIns: [], live: false })).valid, false, "no stand-in at all is live");
  const { live: _live, ...unsaid } = row(1);
  assert.equal(validateAttemptReportRow(unsaid).valid, false, "a row must say");
  assert.equal(attemptCountsAsLive([]), true);
  assert.equal(attemptCountsAsLive(["model"]), false);
  assert.equal(attemptStandIns.includes("model"), true);
});

const proof = (to, held = true) => ({ fromAttempt: to - 1, toAttempt: to, held, refused: held ? [] : ["second_ran_another_flow"] });
const later = (attempt, held = true, calls = 0) => ({ attempt, path: "run_flow", flowId: "flow-1", continuationHeld: held, calls, ms: 1000 });
const three = (changed = {}) => series([row(1), row(2, { path: "run_flow", calls: 0 }), row(3, { path: "run_flow", calls: 0 })], {
  continuations: [proof(2), proof(3)],
  deterministic: { asked: 2, ran: 2, attempts: [later(2), later(3)], zeroCallAttempts: 2, allHeld: true }, ...changed,
});

test("a series counts its attempts from 1, in order, all of one task", () => {
  const two = (rows) => series(rows, { continuations: [proof(2)], deterministic: { asked: 1, ran: 1, attempts: [later(2)], zeroCallAttempts: 1, allHeld: true } });
  assert.equal(validateAttemptSeries(two([row(1), row(2, { path: "run_flow", calls: 0 })])).valid, true);
  assert.equal(validateAttemptSeries(two([row(2), row(1)])).valid, false);
  assert.equal(validateAttemptSeries(two([row(1), row(2, { taskId: "task-two", path: "run_flow", calls: 0 })])).valid, false);
});

test("a series holds one continuation per later attempt and a deterministic summary that says what the rows say", () => {
  assert.equal(validateAttemptSeries(three()).valid, true);
  assert.equal(validateAttemptSeries(series([row(1)])).valid, true, "a diagnosis-only series has no later attempt");
  assert.equal(validateAttemptSeries(three({ continuations: [proof(2)] })).valid, false, "a proof for each later attempt");
  assert.equal(validateAttemptSeries(three({ continuations: [proof(2), proof(4)] })).valid, false, "in order");
  assert.equal(validateAttemptSeries(three({ continuations: [proof(2), { ...proof(3), held: true, refused: ["x"] }] })).valid, false, "held means nothing refused");
  const { deterministic } = three();
  assert.equal(validateAttemptSeries(three({ deterministic: { ...deterministic, zeroCallAttempts: 1 } })).valid, false, "zero-call attempts are counted, not asserted");
  assert.equal(validateAttemptSeries(three({ deterministic: { ...deterministic, attempts: [later(2), later(3, true, 4)] } })).valid, false, "calls are the row's");
  assert.equal(validateAttemptSeries(three({ deterministic: { ...deterministic, attempts: [later(2), later(3, false)] } })).valid, false, "the held flag is the proof's");
  assert.equal(validateAttemptSeries(three({ deterministic: { ...deterministic, asked: 3 } })).valid, false, "held cannot be claimed while an attempt asked for did not run");
  assert.equal(validateAttemptSeries(three({ deterministic: { ...deterministic, asked: 3, allHeld: false } })).valid, true, "a series that stopped short says so");
  assert.equal(validateAttemptSeries(three({ continuations: [proof(2), proof(3, false)], deterministic: { ...deterministic, attempts: [later(2), later(3, false)] } })).valid, false, "allHeld cannot be true with a refusal");
  assert.equal(validateAttemptSeries(three({ deterministic: { ...deterministic, surprise: 1 } })).valid, false);
  assert.equal(validateAttemptSeries(three({ secondStartedFromFirst: true })).valid, false, "the old field is gone");
  assert.equal(validateAttemptSeries(three({ deterministic: null })).valid, false, "no later attempt may go unsaid");
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

test("a scripted model's score names its spend too: the usage it reports is made up", () => {
  const right = { verdict: "right", ending: "result", wrongBecause: [], records: "held", finalState: "held", change: "held", shown: "held", repeatedActs: [], missingActs: [], unaskedChanges: [], storedRows: 2, shownRows: 2, flow: "unproven" };
  assert.equal(validateRunAnswerScore({ ...right, standIns: ["model", "spend"] }).valid, true);
  assert.equal(validateRunAnswerScore({ ...right, standIns: ["model"] }).valid, false);
});
