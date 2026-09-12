// T1 coverage of the recorded-payload mapping for `web.dom.check`, the one
// action added in Week 1 that a recorded user event produces.
//
// The rule under test: a toggle replays only when the recording says which
// state it was left in. A checkbox's recorded value is its `value` attribute
// ("on" by default), not its checked state, so guessing from it would invert
// the user's action half the time.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationOutputPayload } from "../payloads";

const checkbox = { selector: "input#terms", tagName: "input", inputType: "checkbox", id: "terms" };
const radio = { selector: "input#plan-team", tagName: "input", inputType: "radio", id: "plan-team" };

test("a checkbox with a recorded checked state maps to that state", () => {
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: { ...checkbox, checked: true }, inputValue: "on" }).checked, true);
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: { ...checkbox, checked: false }, inputValue: "on" }).checked, false);
});

test("a checkbox with no recorded state carries no state, rather than a guess", () => {
  const parameters = webAutomationOutputPayload("web.dom.check", { element: checkbox, inputValue: "on" });
  assert.equal("checked" in parameters, false, "the recorded value 'on' is the value attribute, not the checked state");
  assert.equal(parameters.selector, "input#terms", "the target is still recorded");
});

test("a custom control's aria-checked is a recorded state", () => {
  const widget = { selector: "#toggle", tagName: "div", role: "switch", attributes: { "aria-checked": "true" } };
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: widget }).checked, true);
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: { ...widget, attributes: { "aria-checked": "false" } } }).checked, false);
});

test("a radio needs no recorded state: its change can only mean selected", () => {
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: radio, inputValue: "team" }).checked, true);
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: { selector: "#r", tagName: "div", role: "radio" } }).checked, true);
});

test("a check keeps the fingerprint and visual target replay falls back on", () => {
  const visualTarget = { namespace: "web", statePath: "web.elements.terms", selector: "input#terms" };
  const parameters = webAutomationOutputPayload("web.dom.check", { element: { ...checkbox, checked: true, xpath: "/html/body/form/input" }, visualTarget });
  assert.equal((parameters.element as { xpath?: string }).xpath, "/html/body/form/input");
  assert.deepEqual(parameters.visualTarget, visualTarget);
});

test("the dispatch-only actions have no recorded payload", () => {
  // None of these is produced by a recorded user event: they are authored, or
  // driven by a Flow. Their parameters come from the node, not from a mapping.
  for (const outputId of ["web.dom.assert", "web.dom.extract_list", "web.dom.upload", "web.dom.dialog", "web.browser.tab", "web.browser.download"]) {
    assert.deepEqual(webAutomationOutputPayload(outputId, { element: checkbox, inputValue: "on" }), {}, outputId);
  }
});
