// What a command the browser lost in flight is reported as (plan B3, Core C8):
// a committing act is an `unknown` outcome Core holds as uncertain, any other
// act a failure that did nothing, and both carry the browser's own account --
// `interrupted`, effect `unknown` -- in a payload that names nothing about the page.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationInterruptedActionResult, webAutomationInterruptedDispatchReading, WEB_AUTOMATION_INTERRUPTED_STATUS } from "..";

/** Core's durable ledger accepts these statuses and fields and nothing else (`command-ledger/dispatch.ts`). */
const WIRE_STATUSES = ["succeeded", "failed", "unknown", "timed_out", "cancelled"];
const WIRE_FIELDS = ["commandId", "status", "startedAt", "completedAt", "message", "target", "payload", "error", "clearedWait", "failure", "metadata"];

test("a committing act lost in flight is unknown on the wire, ambiguous in its record, and interrupted in its payload", () => {
  const result = webAutomationInterruptedActionResult({ commandId: "cmd-1", actionType: "web.dom.click", committing: true, startedAt: 100 }, 250);
  assert.equal(result.commandId, "cmd-1");
  assert.equal(result.status, "unknown");
  assert.equal(result.failure?.code, "web.action.unknown");
  assert.equal(result.failure?.effect, "ambiguous");
  assert.equal(result.failure?.retryable, false);
  assert.deepEqual(result.payload, { commandId: "cmd-1", actionType: "web.dom.click", status: "interrupted", effect: "unknown", startedAt: 100 });
  assert.equal(result.startedAt, 100);
  assert.equal(result.completedAt, 250);
});

test("any other act lost in flight is a retryable failure that did nothing", () => {
  const result = webAutomationInterruptedActionResult({ commandId: "cmd-2", actionType: "web.dom.type", committing: false, startedAt: 100 }, 250);
  assert.equal(result.status, "failed");
  assert.equal(result.failure?.code, "web.transport.transient");
  assert.equal(result.failure?.effect, "unacted");
  assert.equal(result.failure?.retryable, true);
  assert.equal(result.payload?.status, WEB_AUTOMATION_INTERRUPTED_STATUS);
  assert.equal(result.payload?.effect, "unknown");
});

test("the result is one Core's durable ledger accepts, and carries no tab, frame, document or address", () => {
  for (const committing of [true, false]) {
    const result = webAutomationInterruptedActionResult({ commandId: "cmd-3", actionType: "web.dom.click", committing, startedAt: 1 }, 2);
    assert.ok(WIRE_STATUSES.includes(result.status));
    assert.deepEqual(Object.keys(result).filter((key) => !WIRE_FIELDS.includes(key)), []);
    assert.doesNotMatch(JSON.stringify(result.payload), /tab|frame|document|url/iu);
  }
});

test("the dispatcher decides committing again from the command it sent, and leaves every other result alone", () => {
  const interrupted = { status: "interrupted", effect: "unknown" };
  assert.equal(webAutomationInterruptedDispatchReading("web.dom.click", {}, interrupted)?.status, "unknown");
  assert.equal(webAutomationInterruptedDispatchReading("web.dom.type", { submit: true }, interrupted)?.failure.effect, "ambiguous");
  assert.equal(webAutomationInterruptedDispatchReading("web.dom.type", {}, interrupted)?.failure.effect, "unacted");
  for (const payload of [undefined, null, [], { status: "failed" }, { status: "succeeded", effect: "unknown" }]) {
    assert.equal(webAutomationInterruptedDispatchReading("web.dom.click", {}, payload), undefined, JSON.stringify(payload));
  }
});
