// What a build's call names, for the chat (`../call-words.ts`): the crossborder
// build's chat said "Typing into the page" and "Looking at the page" for every step
// (`run-muqc07fh-eeffbc86`).

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmTargetResolution } from "../../plan-resolution";
import { webLlmCallWords } from "../call-words";

const SCOPE = { projectId: "p1", flowId: "f1" };
const known: Record<string, WebLlmTargetResolution> = {
  t11: { ok: true, selector: "#q", frameId: undefined, element: { tagName: "input", accessibleName: "Search", inputType: "search" } },
  t20: { ok: true, selector: "#pw", frameId: undefined, element: { tagName: "input", accessibleName: "Password", inputType: "password" } },
  t30: { ok: true, selector: "#add", frameId: undefined, element: { tagName: "button", visibleText: "Add to cart" } }
};
const resolve = (_scope: unknown, handle: string): WebLlmTargetResolution => known[handle] ?? { ok: false, code: "unknown" };
const run = (node: string, parameters: Record<string, unknown>) => webLlmCallWords({ ...SCOPE, toolId: "core.run_node", value: { node, parameters, consequences: [] } as never }, resolve);

test("a typed search names the field and the words typed", () => {
  assert.deepEqual(run("web.output.dom-type", { target: { handle: "t11" }, text: "USB-C hub", submit: true }), { target: "Search", text: "USB-C hub" });
  assert.deepEqual(run("web.output.dom-type", { selector: "t11", text: "towels" }), { target: "Search", text: "towels" });
});

test("never the words typed into a password field, an unknown control, or a secret request", () => {
  assert.deepEqual(run("web.output.dom-type", { target: { handle: "t20" }, text: "hunter2" }), { target: "Password" });
  assert.equal(run("web.output.dom-type", { target: { handle: "t99" }, text: "hunter2" }), undefined);
  assert.deepEqual(run("web.output.dom-type", { target: { handle: "t11" }, text: { secret: "card" } }), { target: "Search" });
});

test("a press names its control; a find names what it looks for; anything else names nothing", () => {
  assert.deepEqual(run("web.output.dom-click", { target: { handle: "t30" } }), { target: "Add to cart" });
  assert.deepEqual(run("web.output.dom-keypress", { target: { handle: "t11" }, key: "Enter" }), { target: "Search", text: "Enter" });
  assert.deepEqual(webLlmCallWords({ ...SCOPE, toolId: "web.find_on_page", value: { query: "Voltbay" } }, resolve), { text: "Voltbay" });
  assert.equal(run("web.output.browser-navigate", { url: "https://a.test/" }), undefined);
  assert.equal(webLlmCallWords({ ...SCOPE, toolId: "core.flow_draft", value: {} }, resolve), undefined);
});

// t193 (`run-muqiojz4-04a7a8fc`): a dry run's steps carry no handle the build was shown, only the
// element's identity, and read a bare "Test run"; looks at a control read "Looking at the page".
test("a step with no handle the build was shown is named from the element identity it carries", () => {
  assert.deepEqual(run("web.output.dom-click", { selector: "main > div > span:nth-of-type(3)", element: { tagName: "span", visibleText: "+" } }), { target: "+" });
  assert.deepEqual(run("web.output.dom-click", { element: { tagName: "button", accessibleName: "Add to cart" }, timeoutMs: 10000 }), { target: "Add to cart" });
  assert.deepEqual(run("web.output.dom-type", { selector: "input[name=q]", element: { tagName: "input", accessibleName: "Search", inputType: "search" }, text: "towels" }), { target: "Search", text: "towels" });
  assert.deepEqual(run("web.output.dom-type", { selector: "#pw", element: { tagName: "input", accessibleName: "Password", inputType: "password" }, text: "hunter2" }), { target: "Password" });
  assert.deepEqual(run("web.output.dom-click", { target: { handle: "t30" }, element: { accessibleName: "Stale name" } }), { target: "Add to cart" }, "a handle the build was shown comes first");
});

test("a look at one control names it: its details, or the list around it", () => {
  const look = (toolId: string, value: Record<string, unknown>) => webLlmCallWords({ ...SCOPE, toolId, value: value as never }, resolve);
  assert.deepEqual(look("web.describe_element", { target: "t30" }), { target: "Add to cart" });
  assert.deepEqual(look("web.detect_repeating_structure", { target: "t30" }), { target: "Add to cart" });
  assert.equal(look("web.detect_repeating_structure", {}), undefined);
  assert.equal(look("web.describe_element", { target: "t99" }), undefined);
  assert.deepEqual(look("web.recovery.describe_element", { target: "t11" }), { target: "Search" });
  assert.deepEqual(look("web.recovery.press", { target: "t30", consequences: [] }), { target: "Add to cart" });
  assert.deepEqual(look("web.recovery.find_on_page", { query: "Colour" }), { text: "Colour" });
  assert.deepEqual(look("web.recovery.enter_field", { target: "t11", value: "towels" }), { target: "Search", text: "towels" });
  assert.deepEqual(look("web.recovery.enter_field", { target: "t20", value: "hunter2" }), { target: "Password" });
});
