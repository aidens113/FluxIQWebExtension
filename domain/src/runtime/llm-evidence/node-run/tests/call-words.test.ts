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
  t30: { ok: true, selector: "#add", frameId: undefined, element: { tagName: "button", visibleText: "Add to cart" } },
  t50: { ok: true, selector: "#size-12", frameId: undefined, element: { tagName: "div", visibleText: "12 Double Rolls$16.47" }, words: "12 Double Rolls $16.47" }
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

// t194 (`run-murwcmx2-a1c6edf7`, screenshot 00016): every step of the build's test named its
// subject except the list read, a bare "Test run". A read names the fields it reads.
test("a list read names the fields it reads, never the selectors behind them", () => {
  const read = (fields: unknown) => run("web.output.dom-extract_list", { extractList: { handle: "extraction.2", fields }, timeoutMs: 20000 });
  assert.deepEqual(read({ name: "div_css-1h13pfs_h2 span", price: "span.price" }), { target: "name and price" });
  assert.deepEqual(read({ name: "a", price: "b", rating: "c", url: "d@href", plus: "e", ad: "data-ad-id" }), { target: "name, price, rating and 3 more" });
  assert.deepEqual(read({ product_title: "a" }), { target: "product title" });
  assert.deepEqual(read(["name", { name: "price" }]), { target: "name and price" });
  assert.equal(read({}), undefined);
  assert.equal(read("name"), undefined);
  assert.equal(run("web.output.dom-extract_list", { timeoutMs: 20000 }), undefined);
});

// S4 of the read-list redesign: a Next page step names the control it moves the
// list by when the call names the page's own (`control: "tN"`), and otherwise
// says it is the list's Next page; never the retired word "paginate".
test("a Next page run names the page's own control, else the list's Next page, and never paginate", () => {
  const next = (nextPage: unknown) => run("web.output.dom-next_page", { nextPage });
  known.t40 = { ok: true, selector: "a.next", frameId: undefined, element: { tagName: "a", visibleText: "Next ›" } };
  assert.deepEqual(next({ list: "extraction.2", control: "t40" }), { target: "Next ›" });
  assert.deepEqual(next({ list: "extraction.2" }), { target: "Next page" });
  assert.deepEqual(next({ list: "extraction.2", control: "t99" }), { target: "Next page" });
  assert.deepEqual(next({ item: "li.result", pagination: { next: "a.next" } }), { target: "Next page" });
  assert.deepEqual(run("web.output.dom-next_page", { timeoutMs: 30000 }), { target: "Next page" });
  for (const words of [next({ list: "extraction.2" }), next({ list: "extraction.2", control: "t40" })]) {
    assert.doesNotMatch(JSON.stringify(words), /paginat/iu);
  }
});

// U-B3-3 (`run-mux6pndp-16feb842`): the draft's `does.target` read the size chip's captured text, its lines run together.
test("a shown control is named by the words the packet printed for it, never by words an identity alone carries", () => {
  assert.deepEqual(run("web.output.dom-click", { target: { handle: "t50" } }), { target: "12 Double Rolls $16.47" });
  assert.deepEqual(webLlmCallWords({ ...SCOPE, toolId: "web.describe_element", value: { target: "t50" } }, resolve), { target: "12 Double Rolls $16.47" });
  assert.deepEqual(run("web.output.dom-click", { element: { tagName: "div", visibleText: "12 Double Rolls$16.47", words: "Injected" } }), { target: "12 Double Rolls$16.47" }, "a step's own identity is named as it is written");
});
