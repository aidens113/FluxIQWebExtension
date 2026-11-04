// The run's own handles, read as where they stand in the run: two runs' calls compare,
// and a tab the run opened still differs from the one it started on.

import assert from "node:assert/strict";
import test from "node:test";
import { readClientGatewayTraceOperation } from "fluxiq/client-gateway";
import { webTraceStateCanonicalKey, webTraceStateHandleScope } from "../index";

const click = (handles: Record<string, unknown> = {}) => readClientGatewayTraceOperation({ actionType: "web.dom.click", parameters: { selector: "#save", ...handles } });
const key = (scope: ReturnType<typeof webTraceStateHandleScope>, handles: Record<string, unknown> = {}) => webTraceStateCanonicalKey(scope(click(handles)));

test("an exploration's handles and a Flow step with none are one call", () => {
  assert.equal(key(webTraceStateHandleScope(), { browserTabId: 41, browserFrameId: 0 }), key(webTraceStateHandleScope()));
});

test("two runs' first tabs are one tab, whatever each was numbered", () => {
  assert.equal(key(webTraceStateHandleScope(), { browserTabId: 41 }), key(webTraceStateHandleScope(), { browserTabId: 977 }));
});

test("a genuinely new tab still differs from the first, and is the same as another run's second tab", () => {
  const first = webTraceStateHandleScope();
  const onHome = key(first, { browserTabId: 41 });
  const onNew = key(first, { browserTabId: 42 });
  assert.notEqual(onNew, onHome);
  assert.equal(key(first, { browserTabId: 41 }), onHome, "the first tab keeps its place");
  const other = webTraceStateHandleScope();
  key(other, { browserTabId: 900 });
  assert.equal(key(other, { browserTabId: 901 }), onNew);
});

test("a tab a run opened before it named any is not the one it started on", () => {
  const scope = webTraceStateHandleScope();
  scope(readClientGatewayTraceOperation({ actionType: "web.browser.navigate", parameters: { url: "https://shop.example/a", newTab: true } }));
  assert.notEqual(key(scope, { browserTabId: 7 }), key(webTraceStateHandleScope()));
});

test("a child frame differs from the top frame, by its place and not its number, and its path stays in the key", () => {
  const first = webTraceStateHandleScope();
  const second = webTraceStateHandleScope();
  assert.notEqual(key(first, { browserFrameId: 12 }), key(webTraceStateHandleScope()));
  assert.equal(key(second, { browserFrameId: 99 }), key(webTraceStateHandleScope(), { browserFrameId: 5 }));
  assert.notEqual(key(webTraceStateHandleScope(), { browserFrameUrlPath: "/a" }), key(webTraceStateHandleScope(), { browserFrameUrlPath: "/b" }));
});

test("an instant inside the recording's time is its own clock; one outside asks about another time and stays a different read", () => {
  const read = (now?: number) => readClientGatewayTraceOperation({ actionType: "web.dom.extract_list", parameters: { extractList: { item: ".row", fields: { when: ".when" }, where: [{ field: "when", within: "7 days" }], ...(now === undefined ? {} : { now }) } } });
  const clock = { fromMs: 1_000, toMs: 2_000 };
  const key = (now?: number, span = clock) => webTraceStateCanonicalKey(webTraceStateHandleScope(span)(read(now)));
  assert.equal(key(1_500), key());
  assert.equal(key(1_000), key(2_000));
  assert.notEqual(key(5_000), key());
  assert.notEqual(key(999), key());
  // With no clock, a call is on its own run's: the recording's own instant, and a saved run walked as a simulated one.
  assert.equal(webTraceStateCanonicalKey(webTraceStateHandleScope()(read(9_999_999))), key());
});

test("reading an already read call changes nothing", () => {
  const scope = webTraceStateHandleScope();
  scope(click({ browserTabId: 1 }));
  const once = scope(click({ browserTabId: 2 }));
  assert.equal(webTraceStateCanonicalKey(scope(once)), webTraceStateCanonicalKey(once));
});
