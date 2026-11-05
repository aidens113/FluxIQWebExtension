import assert from "node:assert/strict";
import test from "node:test";
import type { AttemptReportRow, RunAnswerScore } from "@fluxiq-web-extension/test-contracts";
import { attemptResultLine } from "../result-line.js";

const ANSWER: RunAnswerScore = { verdict: "right", ending: "result", wrongBecause: [], records: "held", finalState: "held", change: "held", shown: "held", repeatedActs: [], missingActs: [], unaskedChanges: [], storedRows: 5, shownRows: 5, flow: "unproven", standIns: ["model", "spend"] };
const ROW = { schemaVersion: "0.1", taskId: "task-a", scenarioId: "local-classifieds", attempt: 1, path: "explore", calls: 26, inputTokens: 10, outputTokens: 1, usd: 1.31, ms: 70_000, liveSteps: 32, simulation: "not_run", answerVerdict: "right", oracleVerdict: null, flow: "unproven", repeatedActs: [], loopsCaught: {}, standIns: ["model", "spend"], live: false } satisfies AttemptReportRow;
const LATER: AttemptReportRow = { ...ROW, attempt: 2, path: "run_flow", calls: 1, against: { reseeded: false, foundDone: ["Three saved"], changed: [] } };

test("a first attempt's line says nothing of an earlier one, and names its stand-ins", () => {
  const line = attemptResultLine({ row: ROW, answer: ANSWER, status: "achieved" });
  assert.doesNotMatch(line, /no reseed/u);
  assert.match(line, /NOT LIVE, stand-ins: model, spend\./u);
});

test("a second attempt's line says what it ran against, what it found, what it changed, its path and the proof", () => {
  const line = attemptResultLine({ row: LATER, answer: ANSWER, status: "achieved", startedFromFirst: true });
  assert.match(line, /It ran against what attempt 1 left, with no reseed; it found already done: Three saved\./u);
  assert.match(line, /It changed nothing on the site\./u);
  assert.match(line, /It took the run of the saved Flow, and needed nothing else\./u);
  assert.match(line, /proven by the digest/u);
  assert.match(line, /NOT LIVE, stand-ins: model, spend\./u);
});

test("a Run again on saves already standing says it found them as asked and pressed nothing", () => {
  const line = attemptResultLine({ row: LATER, answer: ANSWER, status: "achieved", startedFromFirst: true, askedAgain: { pressedAgain: [], foundAsAsked: ["Three saved"], undone: [], notPressed: [] } });
  assert.ok(line.includes("answer right. You asked to do it again (Run again): it found already as asked and pressed nothing: Three saved. It ran against what attempt 1 left"), line);
});

test("a Run again that moved a count again calls it no repeat, and one that undid a toggle says so", () => {
  const counted = attemptResultLine({ row: LATER, answer: ANSWER, status: "achieved", askedAgain: { pressedAgain: ["Two kettles"], foundAsAsked: [], undone: [], notPressed: [] } });
  assert.ok(counted.includes("You asked to do it again (Run again): it did again: Two kettles, so these are no repeated acts."), counted);
  const undid = attemptResultLine({ row: LATER, answer: { ...ANSWER, verdict: "wrong", wrongBecause: ["change"] }, status: "achieved", askedAgain: { pressedAgain: [], foundAsAsked: [], undone: ["Three saved"], notPressed: [] } });
  assert.ok(undid.includes("answer wrong because change. You asked to do it again (Run again): it undid what was asked: Three saved."), undid);
  const idle = attemptResultLine({ row: LATER, answer: ANSWER, status: "achieved", askedAgain: { pressedAgain: [], foundAsAsked: [], undone: [], notPressed: [] } });
  assert.ok(idle.includes("You asked to do it again (Run again): it did nothing."), idle);
});

test("what it changed is named, and a proof that was refused says so", () => {
  const pressed: AttemptReportRow = { ...LATER, path: "run_flow_then_explore", against: { reseeded: false, foundDone: ["Three saved"], changed: ["unsaved pine-table"] } };
  const line = attemptResultLine({ row: pressed, answer: { ...ANSWER, verdict: "wrong", wrongBecause: ["change"], change: "failed" }, status: "achieved", startedFromFirst: false });
  assert.match(line, /answer wrong because change\./u);
  assert.match(line, /It changed the site: unsaved pine-table\./u);
  assert.match(line, /then explored on from where that stopped/u);
  assert.match(line, /is not proven/u);
});
