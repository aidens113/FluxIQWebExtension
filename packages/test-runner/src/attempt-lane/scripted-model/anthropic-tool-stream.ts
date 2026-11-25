import type { ScriptedModelUsage } from "./anthropic-stream.js";
import type { ScriptedModelToolCall } from "./tool-call.js";

/**
 * One complete Anthropic Messages stream of one tool call, as the real API streams it and Core's reader
 * takes it: a `tool_use` block that starts with an empty input, its input as `input_json_delta` pieces, and
 * `stop_reason: "tool_use"`.
 */
export function anthropicToolStreamBody(input: { model: string; call: ScriptedModelToolCall; usage: ScriptedModelUsage }): string {
  const usage = { input_tokens: input.usage.inputTokens, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 } };
  const json = JSON.stringify(input.call.input);
  const middle = Math.max(1, Math.floor(json.length / 2));
  const events = [
    { type: "message_start", message: { id: `msg_scripted_${input.usage.inputTokens}`, type: "message", role: "assistant", model: input.model, content: [], stop_reason: null, usage: { ...usage, output_tokens: 0 } } },
    { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: `toolu_scripted_${input.usage.inputTokens}`, name: input.call.name, input: {} } },
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: json.slice(0, middle) } },
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: json.slice(middle) } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: input.usage.outputTokens } },
    { type: "message_stop" },
  ];
  return events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("");
}
