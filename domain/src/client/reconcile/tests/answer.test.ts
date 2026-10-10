// What the browser answers when Core asks what became of a command (plan B3,
// Core C8), and how the output dispatcher restates a command Core settled as
// never received.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationInterruptedDispatchReading, webAutomationNotSeenOutcome, webAutomationReconcileAnswer } from "../..";

const kept = { commandId: "cmd-1", status: "succeeded" as const, payload: { pressed: true } };

test("each state is answered from what the browser knows, in order", () => {
  assert.deepEqual(webAutomationReconcileAnswer("cmd-1", { running: true, result: kept, recordLeft: true, seen: true }), { commandId: "cmd-1", state: "running" });
  assert.deepEqual(webAutomationReconcileAnswer("cmd-1", { running: false, result: kept, recordLeft: false, seen: true }), { commandId: "cmd-1", state: "landed", result: kept });
  assert.deepEqual(webAutomationReconcileAnswer("cmd-1", { running: false, recordLeft: true, seen: false }), { commandId: "cmd-1", state: "unknown" });
  assert.deepEqual(webAutomationReconcileAnswer("cmd-1", { running: false, recordLeft: false, seen: true }), { commandId: "cmd-1", state: "unknown" });
  assert.deepEqual(webAutomationReconcileAnswer("cmd-1", { running: false, recordLeft: false, seen: false }), { commandId: "cmd-1", state: "not_seen" });
});

test("a command the browser never received is a retryable failure that did nothing, whatever the act", () => {
  const outcome = webAutomationNotSeenOutcome();
  assert.equal(outcome.status, "failed");
  assert.equal(outcome.failure.code, "web.transport.transient");
  assert.equal(outcome.failure.retryable, true);
  assert.equal(outcome.failure.effect, "unacted");
});

test("the dispatcher restates Core's not_seen result for a press as a failure that did nothing", () => {
  const reading = webAutomationInterruptedDispatchReading("web.dom.click", {}, { status: "not_seen" });
  assert.equal(reading?.status, "failed");
  assert.equal(reading?.failure.effect, "unacted");
  assert.equal(webAutomationInterruptedDispatchReading("web.dom.click", {}, { status: "succeeded" }), undefined);
});
