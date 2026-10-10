// The control a Flow node presses, as a fact target (t430): a press only,
// whether written as the web output or as a recorded action naming it.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationPressedControl } from "../pressed-control";

test("a web press names its selector, element description and frame", () => {
  const element = { tagName: "button", text: "Not now" };
  assert.deepEqual(webAutomationPressedControl({ definitionId: "web.output.dom-click", parameterValues: { selector: "#not-now", element, frameId: 3, timeoutMs: 8000 } }), { selector: "#not-now", element, frameId: 3 });
  assert.deepEqual(webAutomationPressedControl({ definitionId: "web.output.dom-click", parameterValues: { element } }), { element });
});

test("a recorded action naming the press is read from its parameters", () => {
  assert.deepEqual(webAutomationPressedControl({ definitionId: "builtin.policy.action", parameterValues: { outputId: "web.dom.click", parameters: { selector: "#close" } } }), { selector: "#close" });
});

test("anything that is not a press, or names no target, has no pressed control", () => {
  assert.equal(webAutomationPressedControl({ definitionId: "web.output.dom-type", parameterValues: { selector: "#q", text: "lamp" } }), undefined);
  assert.equal(webAutomationPressedControl({ definitionId: "builtin.policy.action", parameterValues: { outputId: "web.dom.type", parameters: { selector: "#q" } } }), undefined);
  assert.equal(webAutomationPressedControl({ definitionId: "web.output.dom-click", parameterValues: { selector: "  " } }), undefined);
  assert.equal(webAutomationPressedControl({ definitionId: "web.output.dom-click" }), undefined);
});
