// The one statement this domain makes about the act behind a failure, and
// what Core's own retry decision makes of it on a saved Flow's playback (t361,
// the user's rule of 2026-10-07): every node gets the first attempt and three
// retries, and only a lasting act whose effect is uncertain is held back.
//
// A failure found at verification or confirmation of an act that does not
// last -- a field whose read-back does not match, a tick or a choice that did
// not take, a navigation not confirmed -- is retryable, where t355 set it
// `retryable: false`. A committing act stays held back, as uncertain. Core's
// decision is asked through its public `automationStudioAssessAttemptFault`,
// with the node as a saved Flow's web node is written: no effect marker, its
// step's declared consequences under Core's key.

import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_DECLARED_CONSEQUENCES_METADATA_KEY, automationStudioAssessAttemptFault, type AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { WebAutomationActionType } from "../../actions/types";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord, type WebAutomationFailureCode } from "../failure";
import { webLastingActStatement } from "../lasting-act-statement";

/** The client's record for `code`, as the extension builds it from the closed set. */
function record(code: WebAutomationFailureCode, actual = "not as expected"): AutomationStudioFailureRecord {
  return webAutomationFailureRecord(code, { expected: "the step's result", actual });
}

/** The statement for one action's failure. */
function stated(actionType: WebAutomationActionType, parameters: JsonObject, code: WebAutomationFailureCode, actual?: string): AutomationStudioFailureRecord {
  const failure = record(code, actual);
  return webLastingActStatement(actionType, parameters, failure, failure);
}

/** Core's decision for the stated record, on a Flow node whose step declared `declared`. */
function decided(definitionId: string, failure: AutomationStudioFailureRecord, declared: string[] = []) {
  const node = { id: "node.step", definitionId, metadata: { [AUTOMATION_STUDIO_DECLARED_CONSEQUENCES_METADATA_KEY]: declared } };
  return automationStudioAssessAttemptFault({ attemptId: "node.step.attempt.1", nodeId: "node.step", definitionId, startedAt: 0, status: "failed", route: "failed", inputs: {}, outputs: {}, effects: [], failure }, node, 0);
}

test("a plain type whose read-back does not match stays retryable, and Core makes it again", () => {
  const failure = stated("web.dom.type", { selector: "#qty", text: "3" }, WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, "the field holds \"1\"");
  assert.equal(failure.retryable, true);
  assert.equal(failure.stage, "verification");
  assert.equal(failure.effect, undefined);
  const decision = decided("web.output.dom-type", failure);
  assert.equal(decision?.disposition, "retry");
  assert.equal(decision?.actUncertain, undefined);
});

test("a check, a choice or a navigation whose verification or confirmation failed is made again", () => {
  for (const [actionType, definitionId, parameters] of [
    ["web.dom.check", "web.output.dom-check", { selector: "#gift", checked: true }],
    ["web.dom.select", "web.output.dom-select", { selector: "#size", value: "L" }],
    ["web.browser.navigate", "web.output.browser-navigate", { url: "https://example.test/cart" }]
  ] as const) {
    const failure = stated(actionType, parameters, WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED);
    assert.equal(failure.retryable, true, actionType);
    assert.equal(decided(definitionId, failure)?.disposition, "retry", actionType);
  }
});

test("a click whose confirmation failed is not made again: its outcome is uncertain", () => {
  const failure = stated("web.dom.click", { selector: "#add" }, WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED);
  assert.equal(failure.effect, "ambiguous");
  const decision = decided("web.output.dom-click", failure, ["create_new"]);
  assert.equal(decision?.disposition, "refuse");
  assert.equal(decision?.actUncertain, true);
  // A click whose step declared none still commits: the domain's statement says so.
  assert.equal(decided("web.output.dom-click", failure)?.actUncertain, true);
});

test("typing that sends its form, or a plain type whose step declared a lasting consequence, is held back the same way", () => {
  const submitted = stated("web.dom.type", { selector: "#q", text: "lamp", submit: true }, WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED);
  assert.equal(decided("web.output.dom-type", submitted)?.actUncertain, true);
  const plain = stated("web.dom.type", { selector: "#note", text: "hi" }, WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED);
  const declared = decided("web.output.dom-type", plain, ["modify_existing"]);
  assert.equal(declared?.disposition, "refuse");
  assert.equal(declared?.actUncertain, true);
});
