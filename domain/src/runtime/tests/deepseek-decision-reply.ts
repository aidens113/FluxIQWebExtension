import assert from "node:assert/strict";
import type { JsonObject } from "fluxiq/core";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const USAGE = { prompt_tokens: 14, completion_tokens: 7, total_tokens: 21 };

/**
 * A scripted DeepSeek reply to an evidence decision, in the form the request asked for. Since t1038 (D12) Core sends a
 * decision as function tools with the call required, so it is answered with the one call `wrapper` stands for: the
 * tool named as Core names it (a tool call by its tool's id, any other decision by its kind, each character outside
 * `[A-Za-z0-9_-]` written `_`), its input the decision without `kind` and `toolId` beside the wrapper's `summary`
 * (Core `runtime/llm/provider-task/decision-tools/`). A request with no tools is answered as JSON text, as before.
 */
export function deepSeekDecisionReply(body: Record<string, unknown>, wrapper: JsonObject): Response {
  const tools = Array.isArray(body.tools) ? body.tools.filter(isRecord) : [];
  if (tools.length === 0) {
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(wrapper) } }], usage: USAGE }), { status: 200, headers: { "content-type": "application/json" } });
  }
  assert.ok(isRecord(wrapper.decision), "a decision reply carries its decision");
  const { kind, toolId, ...input } = wrapper.decision;
  const name = String(kind === "tool_call" && typeof toolId === "string" ? toolId : kind).replace(/[^A-Za-z0-9_-]/gu, "_");
  const offered = tools.map((tool) => (isRecord(tool.function) ? tool.function.name : undefined));
  assert.ok(offered.includes(name), `the request offers no tool ${name}: ${offered.join(", ")}`);
  const call = { id: "call_0", type: "function", function: { name, arguments: JSON.stringify({ summary: wrapper.summary, ...input }) } };
  return new Response(JSON.stringify({ choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [call] } }], usage: USAGE }), { status: 200, headers: { "content-type": "application/json" } });
}
