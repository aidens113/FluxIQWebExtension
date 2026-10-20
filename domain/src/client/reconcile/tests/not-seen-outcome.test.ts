// What a command the browser never received is, in this domain's words (plan
// B3, Core C8): a retryable failure that did nothing, whatever the act.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationNotSeenOutcome } from "..";

test("a command the browser never received is a retryable failure that did nothing, whatever the act", () => {
  const outcome = webAutomationNotSeenOutcome();
  assert.equal(outcome.status, "failed");
  assert.equal(outcome.failure.code, "web.transport.transient");
  assert.equal(outcome.failure.retryable, true);
  assert.equal(outcome.failure.effect, "unacted");
});
