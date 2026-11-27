import assert from "node:assert/strict";
import test from "node:test";
import { routedFetch, routeModelCall, scriptedModelKey, SCRIPTED_MODEL_CORRELATION_HEADER, startScriptedModelServer, type ScriptedModelScript } from "../index.js";

const KEY = scriptedModelKey();
const SCRIPT: ScriptedModelScript = {
  taskId: "task-one",
  replies: {
    panel_command: [(request) => ({ do: "flow.createHere", with: { instruction: request.message } })],
    evidence_tool_decision: [() => ({ kind: "evidence_tool_decision", summary: "Done.", decision: { kind: "complete", result: { summary: "Done." } } }), () => { throw new Error("the page shows no such control"); }],
  },
};

const JSON_TEXT = { output_config: { format: { type: "json_schema", schema: { type: "object", properties: { result_json: { type: "string" } } } } } };

function body(fields: Record<string, unknown>): string {
  return JSON.stringify({ model: "claude-sonnet-5-5", stream: true, messages: [{ role: "user", content: "List the apprentices" }], ...fields });
}

function post(origin: string, text: string, key = KEY, correlationId?: string): Promise<Response> {
  return fetch(`${origin}/v1/messages`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...(correlationId === undefined ? {} : { [SCRIPTED_MODEL_CORRELATION_HEADER]: correlationId }) }, body: text });
}

/** The text a stream's deltas spell, and the frames it is made of. */
async function streamed(response: Response): Promise<{ text: string; types: string[]; events: Record<string, unknown>[] }> {
  const frames = (await response.text()).split("\n\n").filter(Boolean);
  const events = frames.map((frame) => JSON.parse(frame.split("\n").find((line) => line.startsWith("data:"))!.slice(5)) as Record<string, unknown>);
  const text = events.flatMap((event) => (event.type === "content_block_delta" ? [(event.delta as { text: string }).text] : [])).join("");
  return { text, types: events.map((event) => String(event.type)), events };
}

test("a key built from parts, because both repositories are public", () => {
  assert.match(KEY, /^sk_live_(?:a1b2){8}$/u);
});

test("a chat turn is answered in the JSON text its schema asks for, as a stream Core's reader takes", async (t) => {
  const server = await startScriptedModelServer({ script: SCRIPT, key: KEY });
  t.after(() => server.close());
  const response = await post(server.origin, body(JSON_TEXT));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/event-stream/u);
  const { text, types, events } = await streamed(response);
  assert.deepEqual(types, ["message_start", "content_block_start", "content_block_delta", "content_block_stop", "message_delta", "message_stop"]);
  assert.deepEqual(JSON.parse(JSON.parse(text).result_json), { do: "flow.createHere", with: { instruction: "List the apprentices" } });
  assert.equal((events[0]!.message as { model: string }).model, "claude-sonnet-5-5", "Core refuses a reply naming another model");
  assert.deepEqual(server.counts(), { panel_command: 1 });
  assert.deepEqual(server.refusals(), []);
});

test("a task's kind comes from its user message, in blocks or whole, and a schema with its own shape is answered bare", async (t) => {
  const server = await startScriptedModelServer({ script: SCRIPT, key: KEY });
  t.after(() => server.close());
  const content = JSON.stringify({ taskKind: "evidence_tool_decision", context: {} });
  const response = await post(server.origin, body({ messages: [{ role: "user", content: [{ type: "text", text: content.slice(0, 9) }, { type: "text", text: content.slice(9) }] }], output_config: { format: { type: "json_schema", schema: { type: "object", properties: { kind: {} } } } } }));
  const { text } = await streamed(response);
  assert.equal(JSON.parse(text).kind, "evidence_tool_decision");
});

test("a judge's first ask, whose task is the last block of an earlier message and whose last message is prose, is read as its task and not as a chat turn", async (t) => {
  const server = await startScriptedModelServer({ script: SCRIPT, key: KEY });
  t.after(() => server.close());
  const task = JSON.stringify({ taskKind: "evidence_tool_decision", context: {} });
  const messages = [
    { role: "user", content: [{ type: "text", text: "the attempt's own record" }, { type: "text", text: `

${task}` }] },
    { role: "user", content: "The conversation above is the attempt's own record of deciding. Answer the judge's question." }
  ];
  const { text } = await streamed(await post(server.origin, body({ messages, output_config: { format: { type: "json_schema", schema: { type: "object", properties: { kind: {} } } } } })));
  assert.equal(JSON.parse(text).kind, "evidence_tool_decision");
});

test("a check continuing a decider sent as tools answers through core_check_answer with its whole reply; one without that tool keeps its text answer", async (t) => {
  const verdict = { kind: "diagnosis", summary: "Request appears met.", diagnosis: { answersRequest: "yes", defects: [] }, confidence: 0.8 };
  const server = await startScriptedModelServer({ script: { taskId: "task-one", replies: { loop_verification: [() => verdict, () => verdict] } }, key: KEY });
  t.after(() => server.close());
  const ask = JSON.stringify({ taskKind: "loop_verification", context: {} });
  const tools = [{ name: "core_run_node", description: "Run one node.", input_schema: { type: "object" } }, { name: "core_check_answer", description: "The answer of the check.", input_schema: { type: "object" } }];
  const continued = await streamed(await post(server.origin, body({ messages: [{ role: "user", content: ask }], tools, tool_choice: { type: "auto" } })));
  const started = continued.events.find((event) => event.type === "content_block_start")!.content_block as { type: string; name: string };
  assert.deepEqual([started.type, started.name], ["tool_use", "core_check_answer"]);
  const input = continued.events.flatMap((event) => (event.type === "content_block_delta" ? [(event.delta as { partial_json?: string }).partial_json ?? ""] : [])).join("");
  assert.deepEqual(JSON.parse(input), verdict);
  const own = await streamed(await post(server.origin, body({ messages: [{ role: "user", content: ask }], output_config: { format: { type: "json_schema", schema: { type: "object", properties: { kind: {} } } } } })));
  assert.equal(JSON.parse(own.text).kind, "diagnosis", "a check asked on its own request still answers in text");
  assert.deepEqual(server.refusals(), []);
});

test("what the script does not expect fails loudly with its kind, and is never answered", async (t) => {
  const server = await startScriptedModelServer({ script: SCRIPT, key: KEY });
  t.after(() => server.close());
  const judge = await post(server.origin, body({ messages: [{ role: "user", content: JSON.stringify({ taskKind: "loop_verification" }) }] }));
  assert.equal(judge.status, 400);
  assert.match(server.refusals()[0]!.refused!, /expects no request 1 of kind loop_verification/u);
  await post(server.origin, body({ messages: [{ role: "user", content: JSON.stringify({ taskKind: "evidence_tool_decision" }) }] }));
  const second = await post(server.origin, body({ messages: [{ role: "user", content: JSON.stringify({ taskKind: "evidence_tool_decision" }) }] }));
  assert.equal(second.status, 400, "a reply that cannot be made is a refusal, not junk");
  assert.match(server.refusals()[1]!.refused!, /could not answer request 2 of kind evidence_tool_decision: the page shows no such control/u);
  const second_chat = await post(server.origin, body(JSON_TEXT));
  assert.equal(second_chat.status, 200);
  const otherWords = body({ ...JSON_TEXT, messages: [{ role: "user", content: "List the mentors" }] });
  assert.equal((await post(server.origin, otherWords)).status, 400, "a second chat turn in other words was not scripted");
});

test("the same words in a later chat turn are read as before, and each such call is still counted", async (t) => {
  const server = await startScriptedModelServer({ script: SCRIPT, key: KEY });
  t.after(() => server.close());
  const first = await streamed(await post(server.origin, body(JSON_TEXT)));
  const again = await post(server.origin, body(JSON_TEXT));
  assert.equal(again.status, 200);
  assert.equal((await streamed(again)).text, first.text);
  assert.deepEqual(server.counts(), { panel_command: 2 }, "a repeated reading is a model call the report must count");
  assert.deepEqual(server.refusals(), []);
});

test("a call signed with any other key is refused", async (t) => {
  const server = await startScriptedModelServer({ script: SCRIPT, key: KEY });
  t.after(() => server.close());
  assert.equal((await post(server.origin, body(JSON_TEXT), "another-key")).status, 401);
  assert.equal(server.refusals()[0]!.kind, "wrong_key");
});

const MESSAGES = new URL("https://model-provider.example.test/v1/messages");
const MESSAGES_INIT = { method: "POST", headers: { "anthropic-version": "2026-10-21" } };

test("the wrapper sends a Messages call to the scripted server, leaves loopback alone, and refuses all else", () => {
  assert.equal(routeModelCall(MESSAGES, MESSAGES_INIT), "scripted");
  assert.equal(routeModelCall(new URL("http://127.0.0.1:3000/api/x"), { method: "POST" }), "as_is");
  assert.equal(routeModelCall(new URL("http://localhost:3000/"), undefined), "as_is");
  assert.equal(routeModelCall(new URL("https://other-provider.example.test/chat/completions"), { method: "POST", headers: { authorization: "Bearer x" } }), "refused", "another provider's shape");
  assert.equal(routeModelCall(new URL("https://model-provider.example.test/v1/messages"), { method: "POST" }), "refused", "the path without Core's header");
  assert.equal(routeModelCall(new URL("https://example.test/"), undefined), "refused");
});

test("a routed reply carries no URL, because Core refuses one from anywhere but its fixed endpoint", async () => {
  const seen: string[] = [];
  const real = (async (input: RequestInfo | URL) => {
    seen.push(String(input));
    return new Response("data: {}\n\n", { status: 200, headers: { "content-type": "text/event-stream" } });
  }) as typeof fetch;
  const routed = routedFetch(real, "http://127.0.0.1:9");
  const reply = await routed(String(MESSAGES), MESSAGES_INIT);
  assert.deepEqual(seen, ["http://127.0.0.1:9/v1/messages"]);
  assert.equal(reply.url, "");
  assert.equal(reply.headers.get("content-type"), "text/event-stream");
  await assert.rejects(() => routed("https://other-provider.example.test/chat/completions", { method: "POST" }), /refuses a call leaving this machine, to other-provider\.example\.test/u);
});

const RUN_A = "fnr-11111111-1111-4111-8111-111111111111";
const RUN_B = "fnr-22222222-2222-4222-8222-222222222222";

test("interleaved explorations keep independent reply cursors and accurate aggregate counts", async (t) => {
  const script: ScriptedModelScript = { taskId: "two-explorations", replies: { evidence_tool_decision: [
    (request) => ({ part: "first", ordinal: request.ordinal }),
    (request) => ({ part: "second", ordinal: request.ordinal })
  ] } };
  const server = await startScriptedModelServer({ script, key: KEY });
  t.after(() => server.close());
  const text = body({ messages: [{ role: "user", content: JSON.stringify({ taskKind: "evidence_tool_decision" }) }] });
  for (const [ordinal, part] of [[1, "first"], [2, "second"]] as const) {
    const replies = await Promise.all([RUN_A, RUN_B].map(async (run) => JSON.parse((await streamed(await post(server.origin, text, KEY, run))).text)));
    assert.deepEqual(replies, [{ part, ordinal }, { part, ordinal }]);
  }
  assert.deepEqual(server.counts(), { evidence_tool_decision: 4 });
  for (const run of [RUN_A, RUN_B]) assert.deepEqual(server.calls().filter((call) => call.correlationId === run).map((call) => call.ordinal), [1, 2]);
  assert.equal(server.calls().length, 4);
  assert.equal(server.refusals().length, 0);
});

test("a chat fallback belongs to its own correlated exploration", async (t) => {
  const server = await startScriptedModelServer({ script: SCRIPT, key: KEY });
  t.after(() => server.close());
  const words = (text: string) => body({ messages: [{ role: "user", content: text }] });
  assert.equal((await post(server.origin, words("first words"), KEY, RUN_A)).status, 200);
  assert.equal((await post(server.origin, words("other words"), KEY, RUN_B)).status, 200);
  assert.equal((await post(server.origin, words("first words"), KEY, RUN_B)).status, 400);
  assert.equal((await post(server.origin, words("first words"), KEY, RUN_A)).status, 200);
  assert.deepEqual(server.counts(), { panel_command: 4 });
});

test("missing or invalid attribution remains counted without recording the invalid value", async (t) => {
  const server = await startScriptedModelServer({ script: SCRIPT, key: KEY });
  t.after(() => server.close());
  assert.equal((await post(server.origin, body(JSON_TEXT))).status, 200);
  assert.equal((await post(server.origin, body(JSON_TEXT), KEY, "private-value-must-not-be-recorded")).status, 400);
  assert.equal(server.calls().length, 2);
  assert.ok(server.calls().every((call) => call.correlationId === undefined));
  assert.equal(server.refusals()[0]?.kind, "invalid_correlation");
  assert.doesNotMatch(JSON.stringify(server.calls()), /private-value-must-not-be-recorded/u);
});
