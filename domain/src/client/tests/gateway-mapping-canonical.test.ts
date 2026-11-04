// The state rule's canonical key against the page's own reader of a command. Two calls the
// key calls one must reach the page as one element and one selector, and a call the mapper
// sends to another element must have another key. This is what makes the normalisation safe,
// proved at the point it matters: `webAutomationActionFromGatewayCommand`, what a page runs.
//
// It also pins the live wire. The canonical form is a way of reading commands, in
// `runtime/offline-reads/state-domain/`; nothing in the dispatch path changed for it. A Flow
// step and an exploration's call still send what they sent, and the two rows below hold the
// bytes of each so a later change to either is seen here.

import assert from "node:assert/strict";
import test from "node:test";
import { readClientGatewayTraceOperation } from "fluxiq/client-gateway";
import type { JsonObject } from "fluxiq/core";
import { outputTargetFromPayload } from "../../output-nodes";
import { webTraceStateCanonicalKey, webTraceStateHandleScope } from "../../runtime/offline-reads";
import { webAutomationActionFromGatewayCommand } from "../gateway-mapping";

const element: JsonObject = { tagName: "button", visibleText: "Save changes", selector: "#save", classNames: ["primary"], context: { landmark: "main" } };

/** An exploration's call, and a Flow step's call of the same element: the same parameters, with Core's re-derivation written back and the wire target built from it. */
const explored: JsonObject = { selector: "#save", element, checkWaitMs: 300 };
const adapted: JsonObject = { kind: "element", fingerprint: { selector: "#save", tagName: "button", visibleText: "Save changes" }, source: "recorded" };
const stepParameters: JsonObject = { selector: "#save", element, timeoutMs: 5000, checkWaitMs: 600, target: adapted };

const operationOf = (parameters: JsonObject, target?: JsonObject) => readClientGatewayTraceOperation({ actionType: "web.dom.click", parameters, ...(target === undefined ? {} : { target }) });
const pageReads = (parameters: JsonObject, target?: JsonObject) => {
  const command = webAutomationActionFromGatewayCommand({ commandId: "c", actionType: "web.dom.click", parameters, ...(target === undefined ? {} : { target }) });
  if (!("selector" in command)) assert.fail("the mapper refused the command");
  return { selector: command.selector, element: command.element };
};

test("a Flow step's wire target is still what it was: the byte form the live path sends", () => {
  assert.deepEqual(outputTargetFromPayload(stepParameters), { selector: "#save", element });
  assert.deepEqual(outputTargetFromPayload({ selector: "#save", element }), { selector: "#save", element });
});

test("one key means one element and one selector at the page", () => {
  const target = outputTargetFromPayload(stepParameters)!;
  assert.equal(webTraceStateCanonicalKey(operationOf(stepParameters, target)), webTraceStateCanonicalKey(operationOf(explored)));
  assert.deepEqual(pageReads(stepParameters, target), pageReads(explored));
});

test("a repair that renamed the control is another key, because the page is sent another element", () => {
  const renamed: JsonObject = { kind: "element", fingerprint: { selector: "#publish", tagName: "button", visibleText: "Publish" }, source: "runtime" };
  const repaired: JsonObject = { selector: "#save", element, target: renamed };
  const target = outputTargetFromPayload(repaired)!;
  assert.notDeepEqual(pageReads(repaired, target), pageReads(explored), "the target wins at the page");
  assert.notEqual(webTraceStateCanonicalKey(operationOf(repaired, target)), webTraceStateCanonicalKey(operationOf(explored)));
});

test("a row is another key and another element at the page: a loop's row is never made equal", () => {
  const onRow = (key: string): JsonObject => ({ selector: "#save", element: { ...element, context: { landmark: "main", record: { keyAttribute: "data-id", key } } } });
  assert.notDeepEqual(pageReads(onRow("first")), pageReads(onRow("second")));
  assert.notEqual(webTraceStateCanonicalKey(operationOf(onRow("first"))), webTraceStateCanonicalKey(operationOf(onRow("second"))));
});

test("the tab a command names still reaches the page unread by the key: only the rule reads it as a place", () => {
  const parameters: JsonObject = { selector: "#save", browserTabId: 41, browserFrameId: 0 };
  const command = webAutomationActionFromGatewayCommand({ commandId: "c", actionType: "web.dom.click", parameters });
  if (!("tabId" in command)) assert.fail("the mapper refused the command");
  assert.equal(command.tabId, 41);
  assert.equal(command.frameId, 0);
  assert.equal(webTraceStateCanonicalKey(webTraceStateHandleScope()(operationOf(parameters))), webTraceStateCanonicalKey(operationOf({ selector: "#save" })));
});
