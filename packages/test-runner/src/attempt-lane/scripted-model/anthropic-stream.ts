export type ScriptedModelUsage = Readonly<{ inputTokens: number; outputTokens: number }>;

/** Bytes for tokens, the rough rule Core sizes a request by. Made up, and named `spend` on every row. */
export function scriptedModelUsage(requestBytes: number, replyBytes: number): ScriptedModelUsage {
  return { inputTokens: Math.ceil(requestBytes / 4), outputTokens: Math.max(1, Math.ceil(replyBytes / 4)) };
}

/** The reply as the JSON the request's output schema asks for. */
export function scriptedModelReplyText(value: unknown, jsonText: boolean): string {
  return JSON.stringify(jsonText ? { result_json: JSON.stringify(value) } : value);
}

/**
 * One complete Anthropic Messages stream of `text`, event by event, as Core's reader
 * takes it (`runtime/models/providers/anthropic/stream.ts`): the usage is the reply's,
 * `message_stop` is mandatory, and no cache is claimed.
 */
export function anthropicStreamBody(input: { model: string; text: string; usage: ScriptedModelUsage }): string {
  const usage = { input_tokens: input.usage.inputTokens, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 } };
  const events = [
    { type: "message_start", message: { id: `msg_scripted_${input.usage.inputTokens}`, type: "message", role: "assistant", model: input.model, content: [], stop_reason: null, usage: { ...usage, output_tokens: 0 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: input.text } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: input.usage.outputTokens } },
    { type: "message_stop" },
  ];
  return events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("");
}
