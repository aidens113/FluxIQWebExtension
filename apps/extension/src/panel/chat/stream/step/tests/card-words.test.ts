// An action card in words: Core's short name for the kind, what it acted on
// (or "the page" for an action on the page that named nothing), and how it
// went: done, passed, didn't work with why, and working or waiting only
// while it is the action of the moment.

import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVITY_ACTION_NAMES } from "fluxiq/ui";
import type { ActionCard } from "../action-card";
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
