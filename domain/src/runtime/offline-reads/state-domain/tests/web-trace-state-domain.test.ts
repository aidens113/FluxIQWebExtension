// The web port of Core's trace state rule: labels from the domain's safety table, the
// three declared normalisations and nothing more, reading an answer, and the layer mark.

import assert from "node:assert/strict";
import test from "node:test";
import { readClientGatewayTraceOperation } from "fluxiq/client-gateway";
import { webTraceStateCallKind, webTraceStateCanonicalKey, webTraceStateDomain, webTraceStateIsOneTimeLayerAct, webTraceStatePageMoveForm, webTraceStateReadAnswer, webTraceStateSiblingKey, WEB_TRACE_STATE_NORMALISATIONS } from "../index";

const element = { tagName: "button", visibleText: "Save", selector: "#save", classNames: ["primary"], context: { landmark: "main" } };

/** An exploration's click: the element once, under the parameters. */
const explored = (extra: Record<string, unknown> = {}) => readClientGatewayTraceOperation({ actionType: "web.dom.click", parameters: { selector: "#save", element, checkWaitMs: 300, ...extra } });

/** A Flow step's click: the same element again on the wire and as an adapted target, Core's lossy copies. */
const flowStep = (extra: Record<string, unknown> = {}, wire: Record<string, unknown> = { selector: "#save", element: { selector: "#save", tagName: "button", visibleText: "Save" } }) => readClientGatewayTraceOperation({
  actionType: "web.dom.click",
  target: wire,
  parameters: { selector: "#save", element, timeoutMs: 5000, checkWaitMs: 600, target: { kind: "element", fingerprint: { selector: "#save", tagName: "button", visibleText: "Save" }, source: "recorded" }, ...extra }
});

test("labels calls from the domain's safety table", () => {
  for (const action of ["web.dom.capture_snapshot", "web.dom.extract", "web.dom.extract_list", "web.dom.assert", "web.dom.wait_for_selector", "web.dom.wait_for_text", "web.page.facts"]) assert.equal(webTraceStateCallKind(action), "read", action);
  for (const action of ["web.browser.navigate", "web.dom.next_page"]) assert.equal(webTraceStateCallKind(action), "page_move", action);
  for (const action of ["web.dom.click", "web.dom.type", "web.dom.check", "web.dom.select", "web.dom.scroll", "web.dom.upload", "web.something.new"]) assert.equal(webTraceStateCallKind(action), "act", action);
  assert.equal(webTraceStatePageMoveForm("web.browser.navigate"), "absolute");
  assert.equal(webTraceStatePageMoveForm("web.dom.next_page"), "relative");
});

test("an exploration's call and a Flow step's call of the same element have one key", () => {
  assert.equal(webTraceStateCanonicalKey(explored()), webTraceStateCanonicalKey(flowStep()));
});

test("declares exactly its three normalisations", () => {
  assert.deepEqual(WEB_TRACE_STATE_NORMALISATIONS.map((normalisation) => normalisation.id), ["target_form", "wait_fields", "new_tab"]);
  assert.equal(webTraceStateDomain.normalisations, WEB_TRACE_STATE_NORMALISATIONS);
});

test("wait fields and newTab make no difference", () => {
  const navigate = (extra: Record<string, unknown>) => readClientGatewayTraceOperation({ actionType: "web.browser.navigate", parameters: { url: "https://shop.example/a", ...extra } });
  assert.equal(webTraceStateCanonicalKey(navigate({ newTab: true, checkWaitMs: 1 })), webTraceStateCanonicalKey(navigate({ timeoutMs: 9 })));
});

test("never normalises a real difference", () => {
  const base = webTraceStateCanonicalKey(explored());
  for (const extra of [{ text: "a" }, { url: "b" }, { value: "c" }, { checked: true }, { ensureState: { checked: true } }, { browserTabId: 3 }, { rejectedSamples: "x" }]) {
    assert.notEqual(webTraceStateCanonicalKey(explored(extra)), base, JSON.stringify(extra));
  }
  const read = (where: unknown) => readClientGatewayTraceOperation({ actionType: "web.dom.extract_list", parameters: { extractList: { item: ".row", where } } });
  assert.notEqual(webTraceStateCanonicalKey(read([{ field: "a", equals: ["1"] }])), webTraceStateCanonicalKey(read([{ field: "a", equals: ["2"] }])));
});

test("keeps row identity in the key, and leaves only it out of the sibling key", () => {
  const onRow = (record: string, listPosition = 1) => explored({ element: { ...element, context: { landmark: "main", record, listPosition } } });
  assert.notEqual(webTraceStateCanonicalKey(onRow("first")), webTraceStateCanonicalKey(onRow("second")));
  assert.equal(webTraceStateSiblingKey(onRow("first")), webTraceStateSiblingKey(onRow("second", 2)));
  assert.notEqual(webTraceStateSiblingKey(onRow("first")), webTraceStateSiblingKey(explored({ selector: "#other", element: { ...element, context: { landmark: "main", record: "first" } } })));
});

test("keeps the target forms when they name another element", () => {
  const renamed = readClientGatewayTraceOperation({
    actionType: "web.dom.click",
    target: { selector: "#save" },
    parameters: { selector: "#save", element, target: { kind: "element", selectedCandidate: { selector: "#publish" }, fingerprint: { selector: "#publish", visibleText: "Publish" } } }
  });
  assert.notEqual(webTraceStateCanonicalKey(renamed), webTraceStateCanonicalKey(explored()));
  assert.notEqual(webTraceStateCanonicalKey(flowStep({}, { selector: "#other", element })), webTraceStateCanonicalKey(explored()));
  assert.notEqual(webTraceStateCanonicalKey(flowStep({}, { selector: "#save", element: { selector: "#save", visibleText: "Delete" } })), webTraceStateCanonicalKey(explored()));
});

test("reads an answer: outcome, position, rows and whether it gave up waiting", () => {
  const answer = (status: string, payload: Record<string, unknown> = {}, failure?: Record<string, unknown>) => ({ status, payload, ...(failure ? { failure } : {}) });
  assert.deepEqual(webTraceStateReadAnswer(null), { outcome: "failed", position: null, rows: null, timedOut: false });
  assert.deepEqual(webTraceStateReadAnswer(answer("succeeded", { url: "https://shop.example/a?q=1#x", validation: { status: "passed" } })), { outcome: "succeeded", position: "https://shop.example/a?q=1#x", rows: null, timedOut: false });
  assert.equal(webTraceStateReadAnswer(answer("succeeded", { url: "https://shop.example/a#" })).position, "https://shop.example/a");
  assert.equal(webTraceStateReadAnswer(answer("succeeded", { snapshot: { url: "https://shop.example/b" } })).position, "https://shop.example/b");
  assert.equal(webTraceStateReadAnswer(answer("succeeded", { validation: { status: "failed" } })).outcome, "failed");
  assert.deepEqual(webTraceStateReadAnswer(answer("timed_out")), { outcome: "failed", position: null, rows: null, timedOut: true });
  assert.equal(webTraceStateReadAnswer(answer("failed", {}, { code: "web.action.timeout" })).timedOut, true);
  const rows = webTraceStateReadAnswer(answer("succeeded", { extracted: [{ b: "2", a: "1" }, { a: "1", b: "2" }] })).rows;
  assert.equal(rows?.[0], rows?.[1]);
  assert.deepEqual(webTraceStateReadAnswer(answer("succeeded", { extracted: "one value" })).rows, ['"one value"']);
});

test("marks an act on a control in front of the page, from its own element or the look before it", () => {
  const look = (elements: readonly unknown[], blockers: readonly unknown[] = []) => ({ status: "succeeded", payload: { snapshot: { interactiveElements: elements, evidence: { overlays: { blockers } } } } });
  assert.equal(webTraceStateIsOneTimeLayerAct(explored(), null), false);
  assert.equal(webTraceStateIsOneTimeLayerAct(explored(), look([{ selector: "#save" }])), false);
  assert.equal(webTraceStateIsOneTimeLayerAct(explored(), look([{ selector: "#save", frontLayer: true }])), true);
  assert.equal(webTraceStateIsOneTimeLayerAct(explored(), look([{ selector: "#save", context: { dialog: "Cookies" } }])), true);
  assert.equal(webTraceStateIsOneTimeLayerAct(explored({ selector: "#cover #save" }), look([], [{ selector: "#cover" }])), true);
  assert.equal(webTraceStateIsOneTimeLayerAct(explored({ element: { ...element, frontLayer: true } }), null), true);
});
