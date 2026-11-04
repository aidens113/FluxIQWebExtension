import assert from "node:assert/strict";
import test from "node:test";
import { validateRunAnswerScore } from "@fluxiq-web-extension/test-contracts";
import { attemptEndingOfBuild, scoreAnswer } from "../index.js";

const HELD = { held: true, repeatedActs: [], missingActs: [], unaskedChanges: [] };
const parts = {
  ending: "finished" as const, hasResult: true, records: "held" as const, finalState: "held" as const, change: HELD,
  shown: { shown: "held" as const, shownRows: 2, secretShown: false }, storedRows: 2, flow: "unproven" as const, standIns: [],
};

test("a build's own failure code says how the attempt ended, and any other failure excuses nothing", () => {
  assert.equal(attemptEndingOfBuild(null), "finished");
  assert.equal(attemptEndingOfBuild("flow_bootstrap.evidence_budget_exhausted"), "budget_out");
  assert.equal(attemptEndingOfBuild("run.cancelled"), "stopped_by_person");
  assert.equal(attemptEndingOfBuild("flow_bootstrap.stalled"), "other");
});

test("a right answer with no Flow is right on the answer and unproven on the Flow", () => {
  const score = scoreAnswer(parts);
  assert.equal(score.verdict, "right");
  assert.equal(score.flow, "unproven");
  assert.deepEqual(score.wrongBecause, []);
});

test("the hard rule: a task that ends without its result fails", () => {
  const score = scoreAnswer({ ...parts, ending: "other", hasResult: false, records: "failed" });
  assert.equal(score.verdict, "wrong");
  assert.equal(score.ending, "no_result");
  assert.deepEqual(score.wrongBecause, ["no_result"]);
});

test("the hard rule's two exceptions: a spent budget and a person's Stop are excused, and neither is right", () => {
  for (const ending of ["budget_out", "stopped_by_person"] as const) {
    const score = scoreAnswer({ ...parts, ending, hasResult: false, records: "failed" });
    assert.equal(score.verdict, ending);
    assert.equal(score.ending, ending);
    assert.deepEqual(score.wrongBecause, []);
  }
});

test("a budget that ran out on an answer that holds is still a right answer", () => {
  assert.equal(scoreAnswer({ ...parts, ending: "budget_out" }).verdict, "right");
});

test("a right answer that never reached the person is wrong", () => {
  const score = scoreAnswer({ ...parts, shown: { shown: "failed", shownRows: 0, secretShown: false } });
  assert.equal(score.verdict, "wrong");
  assert.deepEqual(score.wrongBecause, ["not_shown"]);
  assert.equal(score.records, "held", "the stored rows stay right, so the report can say where it went wrong");
});

test("an act landed twice is wrong, by name, however right the rows read", () => {
  const score = scoreAnswer({ ...parts, change: { held: false, repeatedActs: [{ name: "One order placed", asked: 1, landed: 2 }], missingActs: [], unaskedChanges: [] } });
  assert.equal(score.verdict, "wrong");
  assert.deepEqual(score.wrongBecause, ["repeated_act"]);
  assert.deepEqual(score.repeatedActs, [{ name: "One order placed", asked: 1, landed: 2 }]);
});

test("each oracle that failed is named, and an unasked change is told apart from a repeat", () => {
  const score = scoreAnswer({ ...parts, records: "failed", finalState: "failed", change: { held: false, repeatedActs: [], missingActs: ["Phone case moved"], unaskedChanges: ["plus-trial"] } });
  assert.deepEqual(score.wrongBecause, ["records", "final_state", "change"]);
  assert.deepEqual(score.missingActs, ["Phone case moved"]);
  assert.deepEqual(score.unaskedChanges, ["plus-trial"]);
});

test("a declared secret shown to the person fails whatever else held", () => {
  assert.deepEqual(scoreAnswer({ ...parts, shown: { shown: "failed", shownRows: 2, secretShown: true } }).wrongBecause, ["secret_shown"]);
});

test("a task the table does not hold states no change oracle rather than guessing one", () => {
  assert.equal(scoreAnswer({ ...parts, change: null }).change, "not_declared");
});

test("the contract refuses a score its parts contradict", () => {
  const score = scoreAnswer(parts);
  const refused = (changed: Record<string, unknown>) => validateRunAnswerScore({ ...score, ...changed }).valid === false;
  assert.ok(refused({ ending: "no_result" }), "no_result can only say wrong");
  assert.ok(refused({ shown: "failed" }), "right cannot have failed to be shown");
  assert.ok(refused({ records: "failed" }), "right cannot have failed its records");
  assert.ok(refused({ verdict: "wrong" }), "wrong must say why");
  assert.ok(refused({ verdict: "budget_out" }), "budget_out needs that ending");
  assert.ok(refused({ wrongBecause: ["records"] }), "right has no reasons");
  assert.ok(refused({ repeatedActs: [{ name: "x", asked: 1, landed: 2 }] }), "right cannot hold a repeated act");
  assert.equal(validateRunAnswerScore(score).valid, true);
});
