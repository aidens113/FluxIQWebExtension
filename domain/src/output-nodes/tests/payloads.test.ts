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

// -- The frame the interaction was recorded in --------------------------------
// `client/gateway-mapping.ts` writes `browserFrameId` onto the recorded event
// and `client/gateway-action-parameters.ts` lifts it back onto
// `action.frameId`. This is the middle link: without it a click recorded in an
// iframe replays against the top document.

test("a DOM action carries the frame it was recorded in", () => {
  const recorded = { element: { ...checkbox, checked: true }, inputValue: "on", browserFrameId: 3 };
  assert.equal(webAutomationOutputPayload("web.dom.check", recorded).browserFrameId, 3);
  assert.equal(webAutomationOutputPayload("web.dom.click", recorded).browserFrameId, 3);
  assert.equal(webAutomationOutputPayload("web.dom.scroll", { scroll: { x: 0, y: 640 }, browserFrameId: 3 }).browserFrameId, 3);
});

test("frame 0 is the top document, and is carried as a frame rather than dropped", () => {
  assert.equal(webAutomationOutputPayload("web.dom.click", { element: checkbox, browserFrameId: 0 }).browserFrameId, 0);
});

test("a frame id that is not a frame is dropped rather than replayed", () => {
  for (const browserFrameId of [-1, 1.5, "3", null, undefined]) {
    const parameters = webAutomationOutputPayload("web.dom.click", { element: checkbox, browserFrameId } as never);
    assert.equal("browserFrameId" in parameters, false, JSON.stringify(browserFrameId));
  }
});

test("a browser-scoped action acts on the tab, so it takes no frame", () => {
  // A navigation, a tab operation and a download are run by the worker against
  // the tab; routing one into a child frame would address the wrong thing.
  assert.equal("browserFrameId" in webAutomationOutputPayload("web.browser.navigate", { url: "https://example.test", browserFrameId: 3 }), false);
  assert.equal("browserFrameId" in webAutomationOutputPayload("web.browser.tab", { browserFrameId: 3 }), false);
});

test("an unexecutable event stays empty rather than becoming a command carrying only a frame", () => {
  assert.deepEqual(webAutomationOutputPayload("web.dom.assert", { element: checkbox, browserFrameId: 3 }), {});
  assert.deepEqual(webAutomationOutputPayload("web.dom.capture_snapshot", { browserFrameId: 3 }), {});
});
