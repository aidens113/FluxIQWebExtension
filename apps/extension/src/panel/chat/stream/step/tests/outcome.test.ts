// The quiet outcome line under a step message: done or didn't work in words,
// passed or didn't pass for a check, Core's sentence after it, and "Working
// on it" only on the newest message of work still running.

import assert from "node:assert/strict";
import test from "node:test";
import type { StepMessage } from "../messages";
import { outcomeWords } from "../outcome";

function message(fields: Partial<StepMessage>): StepMessage {
  return { key: "step:b#1", activityId: "b", kind: "decision", title: "Clicking Search", text: "It runs the search.", outcome: null, at: 0, sequence: 1, latest: true, ...fields };
}

test("an action's outcome in words, with Core's sentence when it has one", () => {
  assert.deepEqual(outcomeWords(message({ outcome: { status: "succeeded", text: undefined } }), false), { state: "succeeded", label: "Done" });
  assert.deepEqual(outcomeWords(message({ outcome: { status: "failed", text: "The button was covered." } }), true), { state: "failed", label: "Didn't work. The button was covered." });
  assert.deepEqual(outcomeWords(message({ kind: "check", outcome: { status: "succeeded", text: undefined } }), false), { state: "succeeded", label: "Passed" });
  assert.deepEqual(outcomeWords(message({ kind: "check", outcome: { status: "failed", text: undefined } }), false), { state: "failed", label: "Didn't pass" });
  assert.equal(outcomeWords(message({}), true), null, "a decision with no action has no outcome line");
});

test("an action under way says so only on the newest message of running work", () => {
  const started = { status: "started", text: undefined } as const;
  assert.deepEqual(outcomeWords(message({ outcome: started }), true), { state: "working", label: "Working on it" });
  assert.equal(outcomeWords(message({ outcome: started }), false), null, "the work settled without saying the action ended");
  assert.equal(outcomeWords(message({ outcome: started, latest: false }), true), null, "the work moved on");
});
