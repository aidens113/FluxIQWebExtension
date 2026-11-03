// Core's sentences plus the real web reading say what Core alone used to say when
// it read the element's fields itself. The expected sentences are the ones Core's
// own tests held then (`automation-activity/wording/tests/`).

import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioActivityAction, automationStudioActivityToolCall, runWithAutomationStudioActivityControlReader } from "fluxiq/automation";
import { webActivityControlReader } from "../activity-control";
import { createWebAutomationOutputNodeImplementationBundle } from "../native-runtime";

const said = (input: Parameters<typeof automationStudioActivityAction>[0]) => runWithAutomationStudioActivityControlReader(webActivityControlReader, () => automationStudioActivityAction(input));

test("the bundle gives Core this reading", () => {
  assert.equal(createWebAutomationOutputNodeImplementationBundle().activityControlReader, webActivityControlReader);
});

test("names a step by the field's label, then its accessible name, then the words it shows", () => {
  const click = "web.output.dom-click";
  assert.equal(said({ id: click, parameters: { element: { accessibleName: "Get a free quote" } } }), "Clicking “Get a free quote”");
  assert.equal(said({ id: click, parameters: { element: { visibleText: "12 Double Rolls" } } }), "Clicking “12 Double Rolls”");
  assert.equal(said({ id: "web.output.dom-type", parameters: { element: { label: "Quantity", accessibleName: "Other", visibleText: "Shown" } } }), "Typing into “Quantity”");
  assert.equal(said({ id: click, parameters: { element: { accessibleName: "Name", visibleText: "Shown" } } }), "Clicking “Name”");
});

test("skips a name that is no person's words and takes the next", () => {
  assert.equal(said({ id: "web.output.dom-click", parameters: { element: { label: "css-0732x7m", accessibleName: "   ", visibleText: "Real words" } } }), "Clicking “Real words”");
});

test("says the verb alone for a step that carries no element", () => {
  assert.equal(said({ id: "web.output.dom-click", parameters: {} }), "Clicking on the page");
  assert.equal(said({ id: "web.output.dom-click", parameters: { element: "not one" } }), "Clicking on the page");
  assert.equal(said({ id: "web.output.dom-click" }), "Clicking on the page");
});

test("says a swatch, a chip or a radio as chosen, and still ticks a box", () => {
  const check = (element: Record<string, unknown> | undefined) => said({ id: "web.output.dom-check", parameters: element ? { checked: true, element } : { checked: true } });
  assert.equal(check({ tagName: "div", accessibleName: "Space Grey" }), "Choosing “Space Grey”");
  assert.equal(check({ tagName: "div", visibleText: "7-in-1" }), "Choosing “7-in-1”");
  assert.equal(check({ tagName: "input", inputType: "radio", label: "Express" }), "Choosing “Express”");
  assert.equal(check({ tagName: "button", role: "option", accessibleName: "Large" }), "Choosing “Large”");
  assert.equal(check({ tagName: "input", inputType: "checkbox", label: "Gift wrap" }), "Ticking “Gift wrap”");
  assert.equal(check({ tagName: "div", role: "checkbox", accessibleName: "Remember me" }), "Ticking “Remember me”");
  assert.equal(check(undefined), "Ticking a box");
});

test("a page view's role word still decides for a call with no element", () => {
  const check = (role: string) => said({ id: "web.output.dom-check", parameters: { checked: true }, words: { target: "Spain", role } });
  assert.equal(check("radio"), "Choosing “Spain”");
  assert.equal(check("checkbox"), "Ticking “Spain”");
  assert.equal(check(""), "Choosing “Spain”");
});

test("a step skipped as not shown names its control", () => {
  assert.equal(said({ parameters: { element: { accessibleName: "Not now" } }, notShown: true }), "Skipped “Not now”: it was not shown");
});

test("a model's call is named the same way, from the parameters it carries", () => {
  const call = { callId: "c1", toolId: "core.run_node", value: { node: "web.output.dom-click", parameters: { element: { accessibleName: "Get a free quote" } } } };
  const title = runWithAutomationStudioActivityControlReader(webActivityControlReader, () => automationStudioActivityToolCall(call).title);
  assert.equal(title, "Clicking “Get a free quote”");
  assert.equal(automationStudioActivityToolCall(call).title, "Clicking on the page");
});
