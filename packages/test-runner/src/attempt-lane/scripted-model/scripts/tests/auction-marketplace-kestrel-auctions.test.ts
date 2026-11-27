import assert from "node:assert/strict";
import test from "node:test";
import { scriptedModelScriptFor, scriptedTaskProcess, type ScriptedModelRequest } from "../../index.js";

const TASK = "auction-marketplace-kestrel-auctions";
const script = scriptedModelScriptFor(TASK);
const reply = script.replies.evidence_tool_decision![0]!;
type Decision = { kind: string; callId?: string; toolId?: string; input?: { node?: string; parameters?: Record<string, any> }; add?: boolean; amendments?: Array<Record<string, unknown>> };
const made = (...ids: string[]) => ids.map((callId) => ({ callId, toolId: "core.run_node", value: { ok: true } }));

function decide(shown: string, extra: readonly Record<string, unknown>[] = []): Decision {
  const request: ScriptedModelRequest = { kind: "evidence_tool_decision", ordinal: 1, model: "fixture", jsonText: true, message: "", payload: { taskKind: "evidence_tool_decision", context: { evidenceLoop: { evidence: [...extra, { callId: "core.current_view", toolId: "core.current_view", value: { groups: [{ group: "top", callId: "page", value: { page: shown } }] } }] } } } };
  return (reply(request) as { decision: Decision }).decision;
}

const home = 't21 field[search] "Search for anything" =""\nt114 clickable "Reject all"';
const results = 't21 field[search] "Search for anything" ="kestrel 35"\nt61 link "Auction" ~/sch/i.html?_nkw=kestrel+35&LH_Auction=1\nt71 link "Kestrel 35S rangefinder camera, 40mm f/1.7" same href';
const detection = { callId: "detect", toolId: "web.detect_repeating_structure", value: { extraction: "extraction.1", fields: [] } };
const draft = (repeats = false) => ({ callId: "core.flow_draft", toolId: "core.flow_draft", value: { steps: [{ step: 3, actionId: "web.output.dom-extract_list", callId: "read-first", input: { parameters: { extractList: { handle: "extraction.2" } } }, ...(repeats ? { routing: "repeats through step 4 while step 4 succeeds" } : {}) }, { step: 4, actionId: "web.output.dom-next_page" }] } });

test("the Kestrel auctions task has four chat turns, each declaring its processing, and eight judge slots", () => {
  assert.equal(script.replies.panel_command?.length, 4);
  assert.equal(script.replies.loop_verification?.length, 8);
  const turn = script.replies.panel_command![0]!({ kind: "panel_command", ordinal: 1, model: "fixture", jsonText: false, message: "m", payload: undefined });
  assert.deepEqual(turn, { do: "flow.createHere", with: { instruction: "m" }, process: scriptedTaskProcess(TASK) });
});

test("declines the cookies without adding the step, then searches the box by its words", () => {
  const cookies = decide(home);
  assert.equal(cookies.callId, "cookies");
  assert.equal(cookies.input?.parameters?.target.handle, "t114");
  assert.equal(cookies.add, undefined);
  assert.equal(decide(home, made("cookies")).input?.parameters?.text, "kestrel 35");
});

test("narrows to auctions, detects the card list and reads every column of it", () => {
  assert.equal(decide(results, made("cookies", "search")).input?.parameters?.target.handle, "t61");
  const detect = decide(results, made("cookies", "search", "auction"));
  assert.equal(detect.callId, "detect");
  assert.equal(detect.toolId, "web.detect_repeating_structure");
  const read = decide(results, [...made("cookies", "search", "auction", "detect"), detection]);
  assert.equal(read.callId, "read-first");
  assert.deepEqual(read.input?.parameters?.extractList, { handle: "extraction.1" });
});

test("pages the draft's list, loops the read through its next page, runs it and completes", () => {
  const upto = [...made("cookies", "search", "auction", "detect", "read-first"), detection];
  const next = decide(results, [...upto, draft()]);
  assert.equal(next.callId, "next");
  assert.deepEqual(next.input?.parameters?.nextPage, { list: "extraction.2" });
  const withNext = [...upto, ...made("next")];
  assert.deepEqual(decide(results, [...withNext, draft()]).amendments, [{ step: 3, change: "repeat", while: 4, through: 4 }]);
  assert.equal(decide(results, [...withNext, draft(true)]).callId, "read-rest");
  assert.equal(decide(results, [...withNext, ...made("read-rest"), draft(true)]).kind, "complete");
});
