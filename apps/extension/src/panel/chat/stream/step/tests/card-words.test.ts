// An action card in words: Core's short name for the kind, what it acted on
// (or "the page" for an action on the page that named nothing), and how it
// went: done, passed, didn't work with why, and working or waiting only
// while it is the action of the moment.

import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVITY_ACTION_NAMES } from "fluxiq/ui";
import type { ClientGatewayActivity } from "../../../../../shared/activity/index";
import { actionCard, type ActionCard } from "../action-card";
import { cardWords } from "../card-words";

function card(fields: Partial<ActionCard>): ActionCard {
  return { kind: "click", target: "Get a free quote", outcome: "done", why: null, key: "action:b#1", said: undefined, answer: undefined, check: false, ...fields };
}

test("the name, the target and the outcome, on one accessible line", () => {
  assert.deepEqual(cardWords(card({}), false), { state: "done", name: "Click", target: "Get a free quote", outcome: "Done", label: "Click, Get a free quote: Done" });
  assert.deepEqual(cardWords(card({ outcome: "failed", why: "it wasn't on the page" }), false), {
    state: "failed",
    name: "Click",
    target: "Get a free quote",
    outcome: "Didn't work: it wasn't on the page",
    label: "Click, Get a free quote: Didn't work: it wasn't on the page"
  });
});

// t193 (run-muqiojz4-04a7a8fc): "Click · the page" and "Action · the page" said nothing a person
// could tell apart; the message above the card says what the step did.
test("a card that named nothing says no target, never \"the page\"", () => {
  for (const kind of ["click", "type", "read", "other", "navigate", "look", "wait", "person_check", "permission", "draft", "test", "result_check", "repair"] as const) {
    const words = cardWords(card({ kind, target: null }), false);
    assert.equal(words.target, null, kind);
    assert.equal(words.name, ACTIVITY_ACTION_NAMES[kind]);
    assert.equal(words.label, `${ACTIVITY_ACTION_NAMES[kind]}: Done`);
  }
});

test("a failure says why in words: Core's reason first, else its sentence; a check passes or does not", () => {
  assert.equal(cardWords(card({ outcome: "failed", said: "The field was covered by a banner." }), false).outcome, "Didn't work: the field was covered by a banner.");
  assert.equal(cardWords(card({ outcome: "failed", said: "URL was refused." }), false).outcome, "Didn't work: URL was refused.");
  assert.equal(cardWords(card({ outcome: "failed" }), false).outcome, "Didn't work");
  assert.equal(cardWords(card({ kind: "test", check: true, target: null, said: "The form is open." }), false).outcome, "Passed: the form is open.");
  assert.equal(cardWords(card({ kind: "test", check: true, target: null, outcome: "failed", said: "No price was shown." }), false).outcome, "Didn't pass: no price was shown.");
  assert.equal(cardWords(card({ said: "Clicked it." }), false).outcome, "Done", "a done action's sentence repeats the card");
});

test("working shows only on the action of the moment; a wait says so until Core settles it", () => {
  assert.deepEqual([cardWords(card({ outcome: "working" }), true).state, cardWords(card({ outcome: "working" }), true).outcome], ["working", "Working on it"]);
  assert.deepEqual([cardWords(card({ kind: "person_check", target: null, outcome: "waiting" }), true).outcome, cardWords(card({ kind: "person_check", target: null, outcome: "waiting" }), true).label], ["Waiting for you", "Robot check: Waiting for you"]);
  const old = cardWords(card({ outcome: "working" }), false);
  assert.deepEqual([old.state, old.outcome, old.label], ["settled", null, "Click, Get a free quote"]);
  // Only Core's resolved row (any `resolution`, `cancelled` included) ends a
  // wait; the work moving on or ending does not, as in the Core panel.
  const waiting = cardWords(card({ outcome: "waiting" }), false);
  assert.deepEqual([waiting.state, waiting.outcome, waiting.label], ["waiting", "Waiting for you", "Click, Get a free quote: Waiting for you"]);
});

test("a wait on the person that Core settled says Core's sentence: done with it, or didn't work with why", () => {
  const robot = { kind: "person_check", target: null } as const;
  assert.equal(cardWords(card({ ...robot, answer: "You pressed Continue." }), false).outcome, "Done. You pressed Continue.");
  assert.equal(cardWords(card({ ...robot, outcome: "failed", why: "you pressed Stop", answer: "You pressed Stop." }), false).outcome, "Didn't work: you pressed Stop");
  assert.equal(cardWords(card({ ...robot, outcome: "failed", answer: "Something new happened." }), false).outcome, "Didn't work. Something new happened.", "a way to end Core has no why for yet");
  assert.equal(cardWords(card({ ...robot, answer: "You pressed Continue." }), false).label, "Robot check: Done. You pressed Continue.");
});

// t193 1002-M (`run-murzln6g-11debe1d`, C10): six test steps the test did not
// press read "Done", and the drawer's "×" the Flow passes over read "Didn't
// work: it didn't work the same way again".
test("a test step says what the test did with it: done again, checked, already done on the site, or skipped", () => {
  assert.equal(cardWords(card({ kind: "test", tested: "Checked, not pressed" }), false).outcome, "Checked, not pressed");
  assert.equal(cardWords(card({ kind: "test", tested: "Already done on the site" }), false).label, "Test run, Get a free quote: Already done on the site");
  assert.equal(cardWords(card({ kind: "test" }), false).outcome, "Done");

  const row = (seq: number, text: string): ClientGatewayActivity => ({
    activityId: "build:b", sequence: seq, subject: { kind: "build", id: "b", projectId: "p" }, at: "2026-10-02T06:08:30.000Z", phase: "verifying",
    label: "Trying the Flow from the start: clicking “×”", detail: { kind: "tool", title: "Clicking “×”", status: "succeeded", ref: "core.run_node", text }
  });
  const words = (seq: number, text: string) => cardWords(actionCard(row(seq, text), `action:build:b#${seq}`)!, false);
  assert.deepEqual([words(1, "Result: core.replay.failed · Excused: interruption · Node: web.output.dom-click").state, words(1, "Result: core.replay.failed · Excused: interruption · Node: web.output.dom-click").outcome], ["done", "Skipped: not there, optional"]);
  assert.equal(words(2, "Result: core.replay.verified · Node: web.output.dom-click").outcome, "Checked, not pressed");
  assert.equal(words(3, "Result: core.replay.remembered · Node: web.output.dom-click").outcome, "Already done on the site");
  assert.equal(words(4, "Result: core.replay.replayed · Node: web.output.dom-click").outcome, "Done");
  assert.equal(words(5, "Result: core.replay.failed · Node: web.output.dom-click").outcome, "Didn't work: it didn't work the same way again");
});

// t193 1002-M (C9): the completion check read "Test run · Passed" before the
// test had run a step. It checks the plan; the test is still to come.
test("the completion check is a ready check that says the test is still to come, never a test run that passed", () => {
  const check = (status: "succeeded" | "failed", text: string): ClientGatewayActivity => ({
    activityId: "build:b", sequence: 7, subject: { kind: "build", id: "b", projectId: "p" }, at: "2026-10-02T06:08:02.000Z", phase: "verifying",
    label: "The proposed Flow’s plan checks out; it still has to run cleanly", detail: { kind: "check", title: "Completion check", status, text }
  });
  const ready = cardWords(actionCard(check("succeeded", "It still has to run cleanly from its start."), "action:build:b#7")!, false);
  assert.equal(ready.name, "Ready check");
  assert.equal(ready.outcome, "Ready to test: it still has to run cleanly from its start.");
  assert.doesNotMatch(ready.label, /Test run|Passed/u);
  const back = cardWords(actionCard(check("failed", "The Flow never reads the list."), "action:build:b#8")!, false);
  assert.deepEqual([back.state, back.outcome], ["failed", "Sent back: the Flow never reads the list."]);
});
