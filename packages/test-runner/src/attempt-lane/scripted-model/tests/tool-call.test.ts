import assert from "node:assert/strict";
import test from "node:test";
import { scriptedModelKey, scriptedModelToolCall, startScriptedModelServer, type ScriptedModelScript } from "../index.js";

const KEY = scriptedModelKey();
const TOOLS = [
  { name: "complete", description: "Finishes the task with its result." },
  { name: "amend_draft", description: "Changes the Flow draft by the amendments given." },
  { name: "core_run_node", description: "Calls the offered tool core.run_node (evidenceLoop.tools describes it); its input goes in input." },
  { name: "core_run_flow", description: "Calls the offered tool core.run_flow (evidenceLoop.tools describes it); its input goes in input." },
];
const CALL = { kind: "evidence_tool_decision", summary: "Press it.", decision: { kind: "tool_call", callId: "c1", toolId: "core.run_flow", input: { from: 5 }, add: true } };

test("a tool call decision becomes the request's tool for that id, with its input and summary and no kind or toolId", () => {
  assert.deepEqual(scriptedModelToolCall(CALL, TOOLS), { name: "core_run_flow", input: { summary: "Press it.", callId: "c1", input: { from: 5 }, add: true } });
});

test("another decision is found by the kind its tool is named from, with a clash suffix allowed", () => {
  const complete = { kind: "evidence_tool_decision", summary: "Done.", decision: { kind: "complete", result: { summary: "Done." } } };
  assert.equal(scriptedModelToolCall(complete, TOOLS).name, "complete");
  assert.equal(scriptedModelToolCall({ ...complete, decision: { kind: "amend_draft", amendments: [] } }, [{ name: "amend_draft_2", description: "" }]).name, "amend_draft_2");
});

test("a request offering no such tool fails, naming what it offers", () => {
  assert.throws(() => scriptedModelToolCall(CALL, TOOLS.slice(0, 2)), /no tool for the decision tool_call of core\.run_flow; it offers complete, amend_draft/u);
  assert.throws(() => scriptedModelToolCall({ kind: "x" }, TOOLS), /not an evidence decision/u);
});

async function post(origin: string, body: unknown): Promise<Response> {
  return fetch(`${origin}/v1/messages`, { method: "POST", headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-5-5", stream: true, ...(body as object) }) });
}

const events = async (response: Response): Promise<Record<string, any>[]> => (await response.text()).split("\n\n").filter(Boolean).map((frame) => JSON.parse(frame.split("\n").find((line) => line.startsWith("data:"))!.slice(5)));
const TASK = (taskKind: string) => [{ role: "user", content: JSON.stringify({ taskKind, context: {} }) }];

test("a decision with tools is streamed as a tool_use block, as the Messages API streams it", async (t) => {
  const script: ScriptedModelScript = { taskId: "tools", replies: { evidence_tool_decision: [() => CALL], loop_verification: [() => ({ diagnosis: "ok" })] } };
  const server = await startScriptedModelServer({ script, key: KEY });
  t.after(() => server.close());
  const sent = await events(await post(server.origin, { messages: TASK("evidence_tool_decision"), tools: TOOLS.map((tool) => ({ ...tool, input_schema: { type: "object" } })), tool_choice: { type: "auto", disable_parallel_tool_use: true } }));
  assert.deepEqual(sent.map((event) => event.type), ["message_start", "content_block_start", "content_block_delta", "content_block_delta", "content_block_delta", "content_block_stop", "message_delta", "message_stop"]);
  assert.deepEqual(sent[1]!.content_block, { type: "tool_use", id: sent[1]!.content_block.id, name: "core_run_flow", input: {} });
  const deltas = sent.filter((event) => event.type === "content_block_delta");
  for (const event of deltas) assert.equal(event.delta.type, "input_json_delta");
  const joined = deltas.map((event) => event.delta.partial_json).join("");
  assert.deepEqual(JSON.parse(joined), { summary: "Press it.", callId: "c1", input: { from: 5 }, add: true });
  assert.equal(sent[6]!.delta.stop_reason, "tool_use");
  // The judge continuing the decider carries the same tools but answers in text.
  const judge = await events(await post(server.origin, { messages: TASK("loop_verification"), tools: TOOLS.map((tool) => ({ ...tool, input_schema: { type: "object" } })) }));
  assert.equal(judge[1]!.content_block.type, "text");
  assert.equal(judge.at(-2)!.delta.stop_reason, "end_turn");
  assert.deepEqual(server.refusals(), []);
});

test("a decision whose tool the request does not offer is refused, not answered", async (t) => {
  const script: ScriptedModelScript = { taskId: "tools", replies: { evidence_tool_decision: [() => CALL] } };
  const server = await startScriptedModelServer({ script, key: KEY });
  t.after(() => server.close());
  const response = await post(server.origin, { messages: TASK("evidence_tool_decision"), tools: [TOOLS[0]] });
  assert.equal(response.status, 400);
  assert.match(server.refusals()[0]!.refused!, /could not answer request 1 .*no tool for the decision tool_call of core\.run_flow/u);
});
