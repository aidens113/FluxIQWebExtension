import assert from "node:assert/strict";
import test from "node:test";
import { scriptedModelScriptFor, type ScriptedModelRequest } from "../../index.js";

const script = scriptedModelScriptFor("bigbox-retail-new-store-cheapest-towels");
const reply = script.replies.evidence_tool_decision![0]!;
type Decision = { kind: string; callId?: string; toolId?: string; input?: { node?: string; parameters?: Record<string, any>; consequences?: string[] }; add?: boolean; amendments?: Array<Record<string, unknown>> };
const made = (...ids: string[]) => ids.map((callId) => ({ callId, toolId: "core.run_node", value: { ok: true } }));

function decide(shown: string, extra: readonly Record<string, unknown>[] = []): Decision {
  const request: ScriptedModelRequest = { kind: "evidence_tool_decision", ordinal: 1, model: "fixture", jsonText: true, message: "", payload: { taskKind: "evidence_tool_decision", context: { evidenceLoop: { evidence: [...extra, { callId: "core.current_view", toolId: "core.current_view", value: { groups: [{ group: "top", callId: "page", value: { page: shown } }] } }] } } } };
  return (reply(request) as { decision: Decision }).decision;
}

const picker = 't7 button "Pickup or delivery? Carden Falls Supercenter"\nt351 button "Set as my store"\nt358 "Millbrook Crossing Supercenter"\nt356 button "Set as my store"\nt359 "Millbrook Crossing Neighborhood Market"\nt361 button "Set as my store"';
const results = 't11 field[search] "Search" placeholder "Search"\nt402 checkbox "Paper Towels (28)" unchecked group="Department"\nt421 checkbox "Today (20)" unchecked group="Speed"\nt473 select "Sort by" ="Best match" [Best match|Price low to high]\nt1295 button "+ Add"\nt1392 button "+ Add"\nt380 link "\u{1F6D2} 1 $3.97" ~';

test("the new-store task has four chat turns and eight judge slots", () => {
  assert.equal(script.taskId, "bigbox-retail-new-store-cheapest-towels");
  assert.equal(script.replies.panel_command?.length, 4);
  assert.equal(script.replies.loop_verification?.length, 8);
});

test("declines cookies, opens the picker and picks the Neighborhood Market's own button", () => {
  assert.equal(decide('t319 button "Reject all"\n' + picker).callId, "cookies");
  assert.equal(decide(picker, made("cookies")).input?.parameters?.target.handle, "t7");
  const store = decide(picker, made("cookies", "picker"));
  assert.equal(store.callId, "store");
  assert.equal(store.input?.parameters?.target.handle, "t361");
  assert.deepEqual(store.input?.consequences, ["modify_existing"]);
});

test("search, filters, sort and the first + Add are found by their words", () => {
  const done = (...ids: string[]) => made("cookies", "picker", "store", ...ids);
  assert.equal(decide(results, done()).input?.parameters?.text, "paper towels");
  assert.equal(decide(results, done("search")).input?.parameters?.target.handle, "t402");
  assert.equal(decide(results, done("search", "department")).input?.parameters?.target.handle, "t421");
  assert.equal(decide(results, done("search", "department", "today")).input?.parameters?.value, "price_low");
  const add = decide(results, done("search", "department", "today", "sort"));
  assert.equal(add.callId, "add");
  assert.equal(add.input?.parameters?.target.handle, "t1295");
  const cart = decide(results, done("search", "department", "today", "sort", "add"));
  assert.equal(cart.callId, "cart");
  assert.equal(cart.input?.parameters?.target.handle, "t380");
});

test("marks the + Add step with the draft's open act, once, then completes", () => {
  const all = made("cookies", "picker", "store", "search", "department", "today", "sort", "add", "cart", "detect", "read-cart");
  const draft = { callId: "core.flow_draft", toolId: "core.flow_draft", value: { acts: [{ id: "a1", todo: "no_step_added", choices: [{ id: "a1.fulfilment", todo: "no_step_added" }] }], steps: [{ step: 9, does: { target: "+ Add" }, disposition: "kept" }] } };
  const structure = { callId: "detect", toolId: "web.detect_repeating_structure", value: { extraction: "extraction.1", fields: [] } };
  const amend = decide(results, [...all, structure, draft]);
  assert.equal(amend.kind, "amend_draft");
  assert.deepEqual(amend.amendments, [{ step: 9, change: "keep", act: "a1.fulfilment" }]);
  const checked = { callId: "core.amendment_check.5", toolId: "core.amendment_check", value: { ok: true } };
  assert.equal(decide(results, [...all, structure, draft, checked]).kind, "complete");
});

test("a repair that starts on the results the replay left opens the cart by its words and does not add a second time", () => {
  const left = 'URL ~?q=paper+towels&sort=price_low   (~ = http://127.0.0.1:1/scenarios/bigbox-retail/search)\nt380 link "\u{1F6D2} 2 $5.25" ~\nt1295 button "+ Add"';
  const cart = decide(left);
  assert.equal(cart.callId, "cart");
  assert.equal(cart.input?.parameters?.target.handle, "t380");
  const before = decide(left.replace("2 $5.25", "1 $3.97"));
  assert.equal(before.callId, "add");
});
