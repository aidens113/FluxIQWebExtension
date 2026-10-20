// The result a late copy of a command answered `not_seen` is refused with (plan
// B3, Core C8): the not-seen outcome on the wire, at one instant, and a payload
// that names the command and nothing else.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationNotSeenActionResult, webAutomationNotSeenOutcome } from "..";

test("a late copy of a command answered not_seen is refused as a failure that did nothing, naming only the command", () => {
  const outcome = webAutomationNotSeenOutcome();
  const result = webAutomationNotSeenActionResult("cmd-late", 1_000);
  assert.deepEqual(result, {
    commandId: "cmd-late",
    status: "failed",
    startedAt: 1_000,
    completedAt: 1_000,
    message: outcome.message,
    error: outcome.message,
    failure: outcome.failure,
    payload: { commandId: "cmd-late", status: "not_seen" }
  });
  assert.equal(result.failure?.effect, "unacted");
});
