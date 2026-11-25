import assert from "node:assert/strict";
import test from "node:test";
import { scriptedModelScriptFor, type ScriptedModelRequest } from "../../index.js";

const script = scriptedModelScriptFor("bigbox-retail-rated-delivery-towels");
const reply = script.replies.evidence_tool_decision![0]!;
type Decision = { kind: string; callId?: string; toolId?: string; input?: { node?: string; parameters?: Record<string, any> }; add?: boolean; amendments?: Array<Record<string, unknown>>; result?: Record<string, unknown> };
const made = (...ids: string[]) => ids.map((callId) => ({ callId, toolId: "core.run_node", value: { ok: true, extraction: "extraction.2" } }));
const page = 'URL ~/search?q=paper+towels\nt10 field "Search everything at ValueRidge"\nt11 checkbox "Paper Towels"\nt12 checkbox "Delivery"\nt13 select "Sort by" options "Best match|Highest rating"\nt20 link "Hearthside Paper Towels"';

function decide(shown = page, extra: readonly Record<string, unknown>[] = []): Decision {
  const request: ScriptedModelRequest = { kind: "evidence_tool_decision", ordinal: 1, model: "fixture", jsonText: true, message: "", payload: { taskKind: "evidence_tool_decision", context: { evidenceLoop: { evidence: [...extra, { callId: "core.current_view", toolId: "core.current_view", value: { groups: [{ group: "top", callId: "page", value: { page: shown } }] } }] } } } };
  return (reply(request) as { decision: Decision }).decision;
}

const reached = () => made("search", "department", "delivery", "sort");
const COLUMNS = ["text", "price", "number", "text_2", "lines"];
const detection = { callId: "columns", toolId: "core.run_node", value: { columns: COLUMNS, read: { extracted: [{ text: "Hearthside Paper Towels", price: "$14.47", number: "4.9", text_2: "Sponsored", lines: "Pickup today · Delivery today" }, { text: "Other Paper Towels", price: "$9.00", number: "4.7", text_2: "", lines: "Pickup today" }] }, extraction: "extraction.1" } };
const draft = (repeats = false) => ({ callId: "core.flow_draft", toolId: "core.flow_draft", value: { steps: [{ step: 5, actionId: "web.output.dom-extract_list", callId: "read-first", input: { parameters: { extractList: { handle: "extraction.2" } } }, ...(repeats ? { routing: "repeats through step 6 while step 6 succeeds" } : {}) }, { step: 6, actionId: "web.output.dom-next_page" }] } });

test("the unchanged realistic task has four chat turns and two judge slots for each attempt", () => {
  assert.equal(script.taskId, "bigbox-retail-rated-delivery-towels");
  assert.equal(script.replies.panel_command?.length, 4);
  assert.equal(script.replies.loop_verification?.length, 8);
});

test("clears a transient cover using its visible handle and leaves it out of the saved Flow", () => {
  const result = decide('t1 button "Accept all"\n' + page);
  assert.equal(result.callId, "consent");
  assert.equal(result.input?.parameters?.target.handle, "t1");
  assert.equal(result.add, undefined);
});

test("a facet whose name carries its count, as the store's page prints it, is pressed by its handle", () => {
  const counted = page.replace('t11 checkbox "Paper Towels"', 't11 checkbox "Paper Towels (28)" unchecked group="Department"').replace('t12 checkbox "Delivery"', 't12 checkbox "Delivery (21)" unchecked group="Fulfillment"');
  const department = decide(counted, made("search"));
  assert.equal(department.callId, "department");
  assert.equal(department.input?.parameters?.target.handle, "t11");
  assert.equal(decide(counted, made("search", "department")).input?.parameters?.target.handle, "t12");
});

test("search, department, delivery and the native Highest rating option are ordinary added steps", () => {
  assert.equal(decide().input?.parameters?.text, "paper towels");
  assert.equal(decide(page, made("search")).callId, "department");
  assert.equal(decide(page, made("search", "department")).callId, "delivery");
  const sort = decide(page, made("search", "department", "delivery"));
  assert.equal(sort.input?.node, "web.output.dom-select");
  assert.equal(sort.input?.parameters?.value, "rating_high");
  assert.equal(sort.add, true);
});

test("one call reads the card's list and keeps every column, and a failure retains its actual cause", () => {
  const probe = decide(page, reached());
  assert.equal(probe.callId, "columns");
  assert.deepEqual(probe.input?.parameters?.extractList, { handle: "t20", minItems: 0 });
  assert.equal(probe.add, undefined);
  assert.throws(() => decide(page, [...reached(), { ...detection, value: { ok: false, code: "target_unobserved" } }]), /target_unobserved/u);
});

test("the read keeps the requested columns and the two the task's processing names, and filters by the column names the first read answered", () => {
  const result = decide(page, [...reached(), detection]);
  assert.equal(result.callId, "read-first");
  assert.deepEqual(result.input?.parameters?.extractList.handle, "t20");
  assert.deepEqual(result.input?.parameters?.extractList.fields, { name: "text", price: "price", rating: "number", ad: "text_2", fulfillment: "lines" });
  assert.deepEqual(result.input?.parameters?.extractList.where, [{ field: "text_2", is: "present", not: true }, { field: "number", atLeast: 4.5 }, { field: "text", contains: ["holder", "dispenser"], not: true }]);
  assert.equal(result.input?.parameters?.extractList.paginate, undefined);
  assert.deepEqual(result.input?.parameters?.recordOutput.schema.fields.map((field: { id: string }) => field.id), ["name", "price", "rating"]);
});

test("the first-visit detours the framework drafted are dropped before the read and next-page steps are repeated", () => {
  const steps = { callId: "core.flow_draft", toolId: "core.flow_draft", value: { steps: [{ step: 2, actionId: "web.output.dom-click", callId: "consent", disposition: "kept" }, { step: 5, actionId: "web.output.dom-extract_list", callId: "read-first", disposition: "kept", input: { parameters: { extractList: { handle: "extraction.2" } } } }, { step: 6, actionId: "web.output.dom-click", callId: "offer", disposition: "kept" }, { step: 7, actionId: "web.output.dom-next_page", callId: "next", disposition: "kept" }] } };
  const result = decide(page, [...reached(), detection, ...made("read-first", "next"), steps]);
  assert.deepEqual(result.amendments, [{ step: 2, change: "drop" }, { step: 6, change: "drop" }]);
});

test("authors read/next as a while-loop that ends only at the list's ended output", () => {
  const first = [...reached(), detection, ...made("read-first")];
  const next = decide(page, [...first, draft()]);
  assert.equal(next.input?.node, "web.output.dom-next_page");
  assert.deepEqual(next.input?.parameters?.nextPage, { list: "extraction.2" });
  const loop = decide(page, [...first, ...made("next"), draft()]);
  assert.deepEqual(loop.amendments, [{ step: 5, change: "repeat", while: 6, through: 6 }]);
  assert.equal(Object.hasOwn(loop.amendments?.[0] ?? {}, "most"), false);
});

test("runs the loop from the current read and never invents answer rows", () => {
  const done = [...reached(), detection, ...made("read-first", "next"), draft(true)];
  const forward = decide(page, done);
  assert.equal(forward.toolId, "core.run_flow");
  assert.deepEqual(forward.input, { from: 5 });
  const end = decide(page, [...done, ...made("read-rest")]);
  assert.equal(end.kind, "complete");
  assert.deepEqual(Object.keys(end.result ?? {}), ["summary"]);
  assert.throws(() => decide(page, [...done, { callId: "read-rest", toolId: "core.run_flow", value: { ok: false, code: "fixture.failure" } }]), /fixture.failure/u);
});
