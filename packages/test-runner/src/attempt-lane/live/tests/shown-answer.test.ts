import assert from "node:assert/strict";
import test from "node:test";
import { ATTEMPT_REPORT_SCHEMA_VERSION, type AttemptReportRow, type RunAnswerScore } from "@fluxiq-web-extension/test-contracts";
import { judgeShownAnswer } from "../../../flow-lane/index.js";
import { attemptResultLine, shownAnswerOfDom, type AnswerTurnDom } from "../index.js";

const dom = (changed: Partial<AnswerTurnDom> = {}): AnswerTurnDom => ({ attemptId: "attempt.one", kind: "rows", headline: "Found 2 of 2", columns: ["Name", "Role"], rows: [["Ada", "Fitter"], ["Ben", "Engineer"]], siteTitle: "On the site: nothing changed", siteLines: [], note: null, text: null, visible: true, ...changed });
const ids = new Map([["Name", "name"], ["Role", "role"]]);

test("no turn, or one a person cannot see, is an answer that never reached them", () => {
  assert.equal(shownAnswerOfDom(null, ids), null);
  assert.equal(shownAnswerOfDom(dom({ visible: false }), ids), null);
});

test("a turn's rows are keyed for the oracle by id, with the cells as the panel prints them", () => {
  const shown = shownAnswerOfDom(dom(), ids);
  assert.ok(shown?.form === "turn");
  assert.deepEqual(shown.turn.rows, { totalRows: 2, truncated: false, previewRows: [{ name: "Ada", role: "Fitter" }, { name: "Ben", role: "Engineer" }] });
  assert.equal(shown.turn.kind, "rows");
  assert.deepEqual(shown.turn.acts, []);
});

test("a count comes from what the turn says, so a preview short of the whole is told as one", () => {
  const shown = shownAnswerOfDom(dom({ headline: "Found 40 rows", note: "Showing 2 of 40 rows here. CSV and JSON have every row." }), ids);
  assert.ok(shown?.form === "turn");
  assert.equal(shown.turn.rows?.totalRows, 40);
  assert.equal(shown.turn.rows?.truncated, true);
});

test("each act line is told by the words the turn prints for its state", () => {
  const shown = shownAnswerOfDom(dom({ columns: [], rows: [], kind: "done_on_site", headline: "Done on the site", siteLines: ["Added a kettle to the cart.", "This may have happened, look to be sure: Saved a job.", "Not done: Sent the form.", "Saved a job, then it was undone."] }), ids);
  assert.ok(shown?.form === "turn");
  assert.deepEqual(shown.turn.acts.map((act) => act.state), ["landed", "may_have_landed", "not_done", "undone"]);
  assert.equal(shown.turn.rows, undefined);
});

test("a turn that holds no answer kind is what a budget or a wait showed, kept as partial", () => {
  const shown = shownAnswerOfDom(dom({ kind: "budget_out", headline: "I reached this task's budget." }), ids);
  assert.ok(shown?.form === "turn");
  assert.equal(shown.turn.kind, "partial");
});

const ROW: AttemptReportRow = { schemaVersion: ATTEMPT_REPORT_SCHEMA_VERSION, taskId: "task-one", scenarioId: "company-website", attempt: 1, path: "explore", calls: 7, inputTokens: 1, outputTokens: 1, usd: 0.1234, ms: 65_000, liveSteps: 9, simulation: "not_run", answerVerdict: "right", oracleVerdict: null, flow: "unproven", repeatedActs: [], loopsCaught: {}, standIns: ["model", "spend"], live: false };
const ANSWER: RunAnswerScore = { verdict: "right", ending: "result", wrongBecause: [], records: "held", finalState: "held", change: "held", shown: "held", repeatedActs: [], missingActs: [], unaskedChanges: [], storedRows: 4, shownRows: 4, flow: "unproven", standIns: ["model", "spend"] };

test("the result line says a scripted row is not live, in words", () => {
  const line = attemptResultLine({ row: ROW, answer: ANSWER, status: "achieved" });
  assert.equal(line, "task-one attempt 1: answer right. Ended achieved, 4 rows stored, 4 shown, 9 live steps, 7 calls, $0.1234, 65 s. NOT LIVE, stand-ins: model, spend.");
  const live = attemptResultLine({ row: { ...ROW, standIns: [], live: true }, answer: { ...ANSWER, verdict: "wrong", wrongBecause: ["not_shown"], shown: "failed", shownRows: 0, standIns: [] }, status: "waiting_for_person", waitingFor: "permission" });
  assert.match(live, /answer wrong because not_shown\. Ended waiting_for_person for permission/u);
  assert.match(live, /counted as live\.$/u);
});

const EXPECTED = { step: "s", count: 2, records: [{ name: "Ada", role: "Fitter" }, { name: "Ben", role: "Engineer" }] };
const judged = (shown: Parameters<typeof judgeShownAnswer>[0]["shown"]) => judgeShownAnswer({ shown, expected: EXPECTED, askedActs: 0, secretValues: [], scenarioOrigin: "http://127.0.0.1:1" }).shown;

test("the oracle holds what the panel showed: the right rows pass, and a wrong cell, a short count or no turn fail", () => {
  assert.equal(judged(shownAnswerOfDom(dom(), ids)), "held");
  assert.equal(judged(shownAnswerOfDom(dom({ rows: [["Ada", "Fitter"], ["Ben", "Plumber"]] }), ids)), "failed");
  assert.equal(judged(shownAnswerOfDom(dom({ headline: "Found 3 of 3" }), ids)), "failed");
  assert.equal(judged(shownAnswerOfDom(null, ids)), "failed", "right in the store and never shown");
  assert.equal(judged(shownAnswerOfDom(dom({ visible: false }), ids)), "failed");
});
