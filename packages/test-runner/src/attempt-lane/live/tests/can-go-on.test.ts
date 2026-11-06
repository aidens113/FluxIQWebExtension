import assert from "node:assert/strict";
import test from "node:test";
import type { AttemptOutcome } from "../../driver.js";
import { attemptCanGoOn } from "../can-go-on.js";

function outcome(verdict: AttemptOutcome["answer"]["verdict"], status: AttemptOutcome["record"]["status"] = "achieved"): AttemptOutcome {
  const held: unknown = { record: { status }, answer: { verdict } };
  return held as AttemptOutcome;
}

test("a right answer and a budget that ran out both leave something to go on from", () => {
  assert.equal(attemptCanGoOn(outcome("right"), false), undefined);
  assert.equal(attemptCanGoOn(outcome("budget_out", "budget_out"), false), undefined);
});

test("it stops, saying why, on a wrong answer, a person's Stop, a wait with nobody coming and an empty balance", () => {
  assert.match(attemptCanGoOn(outcome("wrong"), false) ?? "", /no known state/u);
  assert.match(attemptCanGoOn(outcome("stopped_by_person", "stopped_by_person"), false) ?? "", /person stopped/u);
  assert.match(attemptCanGoOn(outcome("right", "waiting_for_person"), false) ?? "", /waiting for a person/u);
  assert.match(attemptCanGoOn(outcome("budget_out", "budget_out"), true) ?? "", /balance/u);
});
