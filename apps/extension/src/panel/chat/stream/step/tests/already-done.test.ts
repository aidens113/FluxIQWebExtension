// A run step Core skipped because this run had already done its act for that
// row (Core's `executor/step-loop/already-done.ts`, t411) is its own short
// step message whose card reads "Already done" for the row: never a failure,
// never a step done again, never a retry that worked.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayActivity } from "../../../../../shared/activity/index";
import { activityEvent } from "../../../tests/activity-fixture";
import { isAlreadyDoneStep } from "../already-done";
import { cardWords } from "../card-words";
import { stepMessages } from "../messages";

const run = (sequence: number, fields: Partial<ClientGatewayActivity>) => activityEvent(sequence, { activityId: "run:r1", subject: { kind: "run", id: "r1", projectId: "p" }, ...fields });
/** Core's "Running step N" row for a confirm on `row`. */
const confirm = (sequence: number, index: number, row: string) => run(sequence, {
  phase: "running",
  label: `Running step ${index} of 6: Clicking “Confirm”`,
  step: { index, count: 6, nodeId: "n4.confirm", label: "Confirm", row },
  detail: { kind: "step", title: "Clicking “Confirm”", status: "started", ref: "n4.confirm", text: "Node: web.click" }
});
/** Core's row for the same confirm skipped as already done, as `already-done.ts` in Core emits it. */
const alreadyDone = (sequence: number, index: number, row: string | undefined) => run(sequence, {
  phase: "running",
  label: row ? `Already done for ${row}` : "Already done: Confirm",
  step: { index, count: 6, nodeId: "n4.confirm", label: "Confirm", ...(row ? { row } : {}) },
  detail: { kind: "step", title: row ? `Already done for ${row}` : "Already done: Confirm", status: "succeeded", ref: "n4.confirm" }
});
const failedConfirm = (sequence: number) => run(sequence, {
  phase: "repairing",
  label: "Recovering from a failed step: Confirm",
  detail: { kind: "step", title: "Confirm", status: "failed", ref: "n4.confirm", text: "Result: web.action.rate_limited · Node: web.click" }
});

test("only Core's already-done row is read as one: a started step, a recovery row and a run's end are not", () => {
  assert.equal(isAlreadyDoneStep(alreadyDone(1, 4, "Lin Zhao")), true);
  assert.equal(isAlreadyDoneStep(confirm(1, 4, "Lin Zhao")), false);
  assert.equal(isAlreadyDoneStep(failedConfirm(1)), false);
  // A finished step that names the node it ran is a step that ran.
  assert.equal(isAlreadyDoneStep(run(1, { phase: "running", step: { index: 4, count: 6, nodeId: "n4.confirm" }, detail: { kind: "step", title: "Confirm", status: "succeeded", ref: "n4.confirm", text: "Node: web.click" } })), false);
  assert.equal(isAlreadyDoneStep(run(1, { phase: "done", final: true, detail: { kind: "step", title: "Run finished", status: "succeeded" } })), false);
  assert.equal(isAlreadyDoneStep(run(1, { phase: "running", detail: { kind: "step", title: "Recovered", status: "succeeded", ref: "n4.confirm", recovery: { kind: "route", subject: "Requests", outcome: "succeeded" } } })), false);
});

test("an already-done step is a short step message whose card says Already done for its row, after the steps that did the work", () => {
  const events = [
    confirm(1, 4, "Amara Osei"),
    confirm(2, 4, "Lin Zhao"),
    alreadyDone(3, 4, "Amara Osei"),
    alreadyDone(4, 4, "Lin Zhao"),
    run(5, { phase: "done", final: true, detail: { kind: "step", title: "Run finished", status: "succeeded" } })
  ];
  const messages = stepMessages(events, 100).filter((message) => message.title !== "Run finished");
  assert.deepEqual(messages.map((message) => message.title), ["Step 4: Confirm", "Step 4: Confirm", "Step 4: Confirm", "Step 4: Confirm"]);
  const words = messages.map((message) => cardWords(message.actions[0]!, false));
  assert.deepEqual(words.map((card) => [card.target, card.state, card.outcome]), [
    ["Confirm · Amara Osei", "done", "Done"],
    ["Confirm · Lin Zhao", "done", "Done"],
    ["Confirm · Amara Osei", "done", "Already done"],
    ["Confirm · Lin Zhao", "done", "Already done"]
  ]);
  for (const card of words) assert.doesNotMatch(card.label, /Didn't work|already_done|executor\./u);
  assert.deepEqual(messages.map((message) => message.actions[0]!.again), [undefined, undefined, undefined, undefined], "nothing is folded as done again");
});

test("an already-done step after a failed one is no retry that worked, and a step with no row still says Already done", () => {
  const events = [
    confirm(1, 4, "Lin Zhao"),
    failedConfirm(2),
    alreadyDone(3, 4, "Lin Zhao"),
    alreadyDone(4, 5, undefined)
  ];
  const messages = stepMessages(events, 100);
  const cards = messages.map((message) => message.actions[0]!);
  assert.deepEqual(cards.map((card) => [card.outcome, card.retried === undefined]), [["failed", true], ["done", true], ["done", true]]);
  assert.equal(cardWords(cards[1]!, false).outcome, "Already done");
  assert.equal(cardWords(cards[2]!, false).outcome, "Already done");
  assert.equal(messages[2]!.title, "Step 5: Confirm");
});
