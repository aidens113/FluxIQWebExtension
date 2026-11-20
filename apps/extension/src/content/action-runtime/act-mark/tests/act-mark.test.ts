// t968: the page sends the worker's token back once, just before the action
// first acts, and only for a command that carried one.

import assert from "node:assert/strict";
import test from "node:test";
import { ACT_MARK_MESSAGE, type ActMarkMessage } from "../../../../shared/act-mark-message";
import { actedClock } from "../../acted-at";
import { actMarkSender } from "..";

test("a command with a token marks its first act once, before the act's moment is read", () => {
  const sent: ActMarkMessage[] = [];
  actedClock.begin(actMarkSender("token-1", (message) => void sent.push(message)));
  assert.deepEqual(sent, [], "beginning an action sends nothing");
  actedClock.note(1_000);
  actedClock.note(1_200);
  assert.deepEqual(sent, [{ type: ACT_MARK_MESSAGE, token: "token-1" }]);
  assert.equal(actedClock.read(), 1_000);
});

test("an action that only reads sends no mark, and a new action does not inherit the last one's", () => {
  const sent: ActMarkMessage[] = [];
  actedClock.begin(actMarkSender("token-2", (message) => void sent.push(message)));
  actedClock.begin();
  actedClock.note(2_000);
  assert.deepEqual(sent, []);
});

test("a command with no token has no mark, and a mark that cannot be sent never stops the act", () => {
  assert.equal(actMarkSender(undefined), undefined);
  assert.equal(actMarkSender(""), undefined);
  actedClock.begin(actMarkSender("token-3", () => { throw new Error("no receiver"); }));
  assert.doesNotThrow(() => actedClock.note(3_000));
  actedClock.begin(actMarkSender("token-4", () => Promise.reject(new Error("Receiving end does not exist"))));
  assert.doesNotThrow(() => actedClock.note(4_000));
  assert.equal(actedClock.read(), 4_000);
});
