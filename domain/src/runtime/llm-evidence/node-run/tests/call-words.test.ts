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
