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
  return { kind: "click", target: "Get a free quote", outcome: "done", why: null, key: "action:b#1", said: undefined, check: false, ...fields };
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

test("an action on the page that named nothing acts on the page; one that is not on a control names no target", () => {
  assert.equal(cardWords(card({ kind: "type", target: null }), false).target, "the page");
  assert.equal(cardWords(card({ kind: "read", target: null }), false).target, "the page");
  assert.equal(cardWords(card({ kind: "other", target: null }), false).target, "the page");
  for (const kind of ["navigate", "look", "wait", "person_check", "permission", "draft", "test", "repair"] as const) {
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

test("working and waiting show only on the action of the moment; otherwise the card says nothing about how it went", () => {
  assert.deepEqual([cardWords(card({ outcome: "working" }), true).state, cardWords(card({ outcome: "working" }), true).outcome], ["working", "Working on it"]);
  assert.deepEqual([cardWords(card({ kind: "person_check", target: null, outcome: "waiting" }), true).outcome, cardWords(card({ kind: "person_check", target: null, outcome: "waiting" }), true).label], ["Waiting for you", "Robot check: Waiting for you"]);
  for (const outcome of ["working", "waiting"] as const) {
    const words = cardWords(card({ outcome }), false);
    assert.deepEqual([words.state, words.outcome, words.label], ["settled", null, "Click, Get a free quote"], outcome);
  }
});
