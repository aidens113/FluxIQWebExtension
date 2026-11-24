import assert from "node:assert/strict";
import test from "node:test";
import { judgeSiteChallenge, type SiteChallengeObservation } from "../index.js";

const whole: SiteChallengeObservation = {
  armedCheck: "type-the-characters", personRequired: true, askOnThread: true, askInChat: true,
  handOff: { did: "cleared", cleared: true, answer: "person_done", via: "chat", check: "type-the-characters", note: null },
  clearedItself: false, after: { readSucceeded: true, checkGone: true }, stageError: null,
};

test("a site challenge passes only when every stage held", () => {
  assert.deepEqual(judgeSiteChallenge(whole), { siteChallenge: "passed", stage: "continue", code: null, how: "person" });
});

test("the first stage that did not hold names the failure", () => {
  const failing = (change: Partial<SiteChallengeObservation>) => judgeSiteChallenge({ ...whole, ...change });
  const failure = (stage: string, code: string) => ({ siteChallenge: "failed", stage, code, how: null });
  assert.deepEqual(failing({ armedCheck: null }), failure("arm", "declared_check_not_shown"));
  assert.deepEqual(failing({ askOnThread: false }), failure("hand_off", "no_person_ask_on_thread"));
  assert.deepEqual(failing({ askInChat: false }), failure("hand_off", "ask_not_shown_in_chat"));
  assert.deepEqual(failing({ handOff: null }), failure("person_pass", "no_hand_off_recorded"));
  assert.deepEqual(failing({ handOff: { ...whole.handOff!, did: "declined-tampered", cleared: false, answer: "person_stop" } }), failure("person_pass", "product_touched_the_check_before_the_person"));
  assert.deepEqual(failing({ handOff: { ...whole.handOff!, did: "could-not-clear", cleared: false } }), failure("person_pass", "person_could-not-clear"));
  assert.deepEqual(failing({ handOff: { ...whole.handOff!, via: "core" } }), failure("person_pass", "answer_not_given_in_chat"));
  assert.deepEqual(failing({ after: null }), failure("continue", "run_did_not_continue"));
  assert.deepEqual(failing({ after: { readSucceeded: false, checkGone: true } }), failure("continue", "read_after_the_check_failed"));
  assert.deepEqual(failing({ after: { readSucceeded: true, checkGone: false } }), failure("continue", "check_still_on_the_page"));
});

test("a check the site lifts by itself is waited out, but never one a row says needs a person", () => {
  const lifted = { askOnThread: false, askInChat: false, handOff: null, clearedItself: true };
  assert.deepEqual(judgeSiteChallenge({ ...whole, ...lifted, personRequired: false }), { siteChallenge: "passed", stage: "continue", code: null, how: "waited_out" });
  assert.deepEqual(judgeSiteChallenge({ ...whole, ...lifted, personRequired: true }), { siteChallenge: "failed", stage: "hand_off", code: "required_person_check_cleared_without_a_person", how: null });
  assert.deepEqual(judgeSiteChallenge({ ...whole, ...lifted, personRequired: false, after: { readSucceeded: false, checkGone: true } }), { siteChallenge: "failed", stage: "continue", code: "read_after_the_check_failed", how: null });
});
