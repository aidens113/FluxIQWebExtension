import assert from "node:assert/strict";
import test from "node:test";
import { scriptedModelScriptFor, type ScriptedModelRequest } from "../../index.js";

const SCRIPT = scriptedModelScriptFor("crossborder-marketplace-free-hubs-under-ten");
const decide = SCRIPT.replies.evidence_tool_decision![0]!;

function request(page: string, extra: readonly Record<string, unknown>[] = []): ScriptedModelRequest {
  const evidence = [...extra, { callId: "core.current_view", toolId: "core.current_view", value: { groups: [{ group: "top", callId: "x", value: { page } }] } }];
  return { kind: "evidence_tool_decision", ordinal: 1, model: "m", jsonText: true, message: "", payload: { taskKind: "evidence_tool_decision", context: { evidenceLoop: { evidence } } } };
}

type Called = { decision: { kind: string; callId?: string; toolId?: string; input?: { node?: string; parameters?: Record<string, any> } } };
const decision = (page: string, extra?: readonly Record<string, unknown>[]) => (decide(request(page, extra)) as Called).decision;
const made = (...ids: string[]) => ids.map((callId) => ({ callId, toolId: "core.run_node", value: { ok: true } }));

const RESULTS = 'URL ~/search?q=usb+c+hub\nt30 clickable "Free shipping"\nt31 field placeholder "Max" =""\nt32 clickable "OK"\nt33 clickable "Price ↑"\nt40 link "Keelson USB C Hub 7 in 1" same href';

test("a script is registered for the task, with a chat turn for each of its two attempts", () => {
  assert.equal(SCRIPT.taskId, "crossborder-marketplace-free-hubs-under-ten");
  assert.equal(SCRIPT.replies.panel_command?.length, 2);
});

test("it clears what covers the page by the handle the page gives, each only while it shows", () => {
  assert.equal(decision('URL ~/\nt5 "No thanks"').input?.parameters?.target.handle, "t5");
  assert.equal(decision('URL ~/\nt77 "No thanks"').input?.parameters?.target.handle, "t77");
  assert.equal(decision('URL ~/\nt6 "Accept all"', made("dismiss-welcome")).callId, "accept-cookies");
});

test("it narrows by free shipping, types the ceiling and applies it, then sorts, taking each handle from the page", () => {
  assert.equal(decision(RESULTS).callId, "free-shipping");
  assert.equal(decision(RESULTS).input?.parameters?.target.handle, "t30");
  const typed = decision(RESULTS, made("free-shipping"));
  assert.equal(typed.input?.node, "web.output.dom-type");
  assert.equal(typed.input?.parameters?.target.handle, "t31");
  assert.equal(typed.input?.parameters?.text, "10");
  assert.equal(decision(RESULTS, made("free-shipping", "ceiling-typed")).input?.parameters?.target.handle, "t32");
  assert.equal(decision(RESULTS, made("free-shipping", "ceiling-typed", "ceiling-applied")).input?.parameters?.target.handle, "t33");
});

test("it reads the rows from the fields the page's own structure gives, leaving out the ads, and then completes", () => {
  const before = made("free-shipping", "ceiling-typed", "ceiling-applied", "sort-by-price");
  assert.equal(decision(RESULTS, before).toolId, "web.detect_repeating_structure");
  const fields = [
    { key: "a_title", sample: "Keelson USB C Hub 9 in 1 Multiport Adapter", type: "text", kind: "text", coverage: 1 },
    { key: "b_store", sample: "Voltbay Official Store", type: "text", kind: "text", coverage: 1 },
    { key: "c_price", sample: "8,99 €", type: "currency", kind: "text", coverage: 1 },
    { key: "d_rating", sample: "4.7", type: "text", kind: "text", coverage: 0.9 },
    { key: "e_ad", sample: "Ad", type: "text", kind: "text", coverage: 0.2 },
  ];
  const read = decision(RESULTS, [...before, { callId: "detect-hubs", toolId: "web.detect_repeating_structure", value: { extraction: "extraction.9", fields } }]);
  assert.equal(read.input?.node, "web.output.dom-extract_list");
  assert.deepEqual(read.input?.parameters?.extractList.fields, { title: "a_title", store: "b_store", price: "c_price", rating: "d_rating" });
  assert.deepEqual(read.input?.parameters?.extractList.where, [{ field: "e_ad", is: "present", not: true }]);
  assert.equal(decision(RESULTS, [...before, ...made("read-hubs")]).kind, "complete");
});

test("it never answers a traffic screen, and a page without what it needs fails loudly", () => {
  assert.throws(() => decision('URL ~/search?q=usb+c+hub\nt1 "I\'m not a robot"', made("free-shipping")), /Max price box|shows nothing/u);
  assert.throws(() => decision('URL ~/search?q=usb+c+hub\nt1 "Hub"'), /shows nothing matching/u);
});
