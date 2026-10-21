import assert from "node:assert/strict";
import test from "node:test";
import { compareTrialObservations, trialObservation } from "../trial-observation.js";

const WORD = "words-from-the-page";

function feedback(overrides: { kept?: number; label?: string; status?: string; said?: string } = {}) {
  return {
    code: "candidate.trial_judged_no",
    stored: { rows: 15, refused: 0, missingRequired: 0 },
    reads: [{ nodeId: "subflow.read", label: "Read", seen: 32, kept: overrides.kept ?? 17, said: overrides.said ?? WORD, conditions: [{ condition: WORD, rejected: 9, rejectedByItself: 1 }] }],
    steps: [
      { step: 1, definitionId: "web.output.browser-navigate", status: "succeeded" },
      { step: 2, definitionId: "web.output.dom-extract_list", label: overrides.label ?? "Read", status: overrides.status ?? "succeeded" },
    ],
    judge: { expected: WORD },
  };
}

test("keeps counts, node definitions and statuses, and never a word of the feedback", () => {
  const observation = trialObservation(feedback());
  assert.deepEqual(observation.stored, { rows: 15, refused: 0, missingRequired: 0 });
  assert.deepEqual(observation.reads, [{ seen: 32, kept: 17, conditions: [{ rejected: 9, rejectedByItself: 1 }] }]);
  assert.deepEqual(observation.stoppedAt, { step: 2, definitionId: "web.output.dom-extract_list", status: "succeeded", attempts: null, failureCode: null });
  assert.equal(observation.code, "candidate.trial_judged_no");
  assert.ok(!JSON.stringify(observation).includes(WORD));
  assert.match(observation.wordsDigest.reads, /^[0-9a-f]{64}$/);
});

test("equal feedback compares equal; the code is not compared", () => {
  const live = trialObservation(feedback());
  const offline = trialObservation({ ...feedback(), code: "candidate.trial_not_judged" });
  assert.equal(compareTrialObservations(live, offline).equal, true);
});

test("a changed count, status or word is told apart field by field", () => {
  const live = trialObservation(feedback());
  assert.deepEqual(compareTrialObservations(live, trialObservation(feedback({ kept: 16 }))), { stored: true, reads: false, steps: true, stoppedAt: true, words: { reads: true, steps: true }, equal: false });
  const failed = compareTrialObservations(live, trialObservation(feedback({ status: "failed" })));
  assert.equal(failed.steps, false);
  assert.equal(failed.stoppedAt, false);
  assert.deepEqual(compareTrialObservations(live, trialObservation(feedback({ said: "other" }))).words, { reads: false, steps: true });
  assert.deepEqual(compareTrialObservations(live, trialObservation(feedback({ label: "Other" }))).words, { reads: true, steps: false });
});

test("feedback without reads, steps or stored rows reduces to empty", () => {
  const observation = trialObservation({ code: "candidate.execution_incomplete" });
  assert.deepEqual([observation.stored, observation.reads, observation.steps, observation.stoppedAt], [null, [], [], null]);
});
