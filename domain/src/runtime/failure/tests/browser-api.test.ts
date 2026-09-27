// The browser's own refusal, read into a code, and the measurement that made it
// necessary.
//
// The first row is the exact message out of
// `test-runs/run-muht9lpw-a39aa056/snapshots/flow-lane.json`. It was classified
// `web.action.failed` — retryable — and Core's ladder spent three attempts at
// 250 ms and 1000 ms on a fault only a manifest edit can clear, then fell to
// diagnosis and ended the run. That row is the regression test: the message must
// reach a code the table declares non-retryable, or the run is spent again.

import assert from "node:assert/strict";
import test from "node:test";
import { webBrowserApiFailureCode } from "../browser-api";
import { WEB_AUTOMATION_FAILURE_CODES, WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS, webAutomationFailureRecord } from "../codes";
import { classifyWebAutomationFailure } from "../classify";

const RUN_MUHT9LPW = 'Cannot access contents of url "about:blank". Extension manifest must request permission to access this host.';

test("the message that cost run-muht9lpw-a39aa056 three attempts is now a refusal no retry is spent on", () => {
  const code = webBrowserApiFailureCode(RUN_MUHT9LPW);
  assert.equal(code, WEB_AUTOMATION_FAILURE_CODES.BROWSER_PERMISSION_DENIED);
  const definition = WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS[WEB_AUTOMATION_FAILURE_CODES.BROWSER_PERMISSION_DENIED];
  assert.equal(definition.retryable, false, "a manifest refusal retried is a ladder spent for nothing");
  assert.equal(definition.stage, "dispatch");
  assert.equal(definition.category, "blocked_by_capability_or_policy");
});

test("the refusal reaches the code through the classifier, which is the path the worker takes", () => {
  const record = classifyWebAutomationFailure(new Error(RUN_MUHT9LPW), { status: "failed", actionType: "web.dom.click" });
  assert.equal(record?.code, WEB_AUTOMATION_FAILURE_CODES.BROWSER_PERMISSION_DENIED);
  assert.equal(record?.retryable, false);
  // And through the message-only path, which is what an unanswered command has.
  const fromMessage = classifyWebAutomationFailure(undefined, { status: "failed", message: RUN_MUHT9LPW });
  assert.equal(fromMessage?.code, WEB_AUTOMATION_FAILURE_CODES.BROWSER_PERMISSION_DENIED);
});

test("every wording of the same refusal lands on the same code", () => {
  for (const message of [
    "Cannot access a chrome:// URL",
    "The extensions gallery cannot be scripted.",
    "Missing host permission for the tab",
    "Permission denied",
    "This page cannot be scripted due to an ExtensionsSettings policy."
  ]) {
    assert.equal(webBrowserApiFailureCode(message), WEB_AUTOMATION_FAILURE_CODES.BROWSER_PERMISSION_DENIED, message);
  }
});

test("a channel that was not there yet is transient, and the table says a retry can clear it", () => {
  for (const message of [
    "Could not establish connection. Receiving end does not exist.",
    "The message port closed before a response was received.",
    "Frame with ID 7 was removed."
  ]) {
    assert.equal(webBrowserApiFailureCode(message), WEB_AUTOMATION_FAILURE_CODES.TRANSPORT_TRANSIENT, message);
  }
  assert.equal(WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS[WEB_AUTOMATION_FAILURE_CODES.TRANSPORT_TRANSIENT].retryable, true);
});

test("a refusal and a dead channel in one message is read as the refusal, because that is the fact no retry can clear", () => {
  assert.equal(
    webBrowserApiFailureCode("Could not establish connection: cannot access contents of the page"),
    WEB_AUTOMATION_FAILURE_CODES.BROWSER_PERMISSION_DENIED
  );
});

test("a message naming nothing keeps the caller's own code, so this reading can only ever sharpen one", () => {
  for (const message of [undefined, "", "   ", "the element was detached", "something went wrong"]) {
    assert.equal(webBrowserApiFailureCode(message), undefined, String(message));
  }
  const record = classifyWebAutomationFailure(new Error("the element was detached"), { status: "failed" });
  assert.equal(record?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED);
});

test("a producer that already classified itself is never re-read, however its message reads", () => {
  // The strongest-evidence rule in `classify.ts`: a carried record wins outright.
  // A page that legitimately reported AUTH_REQUIRED while the word "permission
  // denied" was on it must not be turned into a manifest refusal.
  const carried = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED, { actual: "permission denied" });
  const record = classifyWebAutomationFailure(undefined, { status: "failed", failure: carried });
  assert.equal(record?.code, WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED);
});

test("both new codes are consistent records Core's parser can accept", () => {
  for (const code of [WEB_AUTOMATION_FAILURE_CODES.BROWSER_PERMISSION_DENIED, WEB_AUTOMATION_FAILURE_CODES.TRANSPORT_TRANSIENT]) {
    const record = webAutomationFailureRecord(code, { expected: "the action to run", actual: "the browser refused" });
    assert.equal(record.code, code);
    assert.equal(record.retryable, WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS[code].retryable);
    assert.equal(record.stage, WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS[code].stage);
  }
});
