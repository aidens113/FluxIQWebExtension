/** What a request asks of the model, in the words Core's task kinds use. Anything else is a kind no script expects. */
export type ScriptedModelKind = string;

/** One decision tool of a request, as the wire carries it. */
export type ScriptedModelTool = Readonly<{ name: string; description: string }>;

/**
 * One Anthropic Messages request as a script reads it, from the wire and nothing else:
 * `payload` is the task's whole user message (`runtime/llm/provider-task/request-messages.ts`
 * in Core), and a chat turn has none. `message` is the last user message as words.
 */
export type ScriptedModelRequest = Readonly<{
  kind: ScriptedModelKind;
  /** Which request of its kind this is, from 1. */
  ordinal: number;
  model: string;
  /** The output schema asks for the answer as JSON text in `result_json`. */
  jsonText: boolean;
  message: string;
  /** The tools the request offers, in its order; none for a chat turn. */
  tools?: readonly ScriptedModelTool[];
  payload: Readonly<Record<string, unknown>> | undefined;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function wordsOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((block) => (isRecord(block) && typeof block.text === "string" ? block.text : "")).join("");
}

/** A task's user message is one JSON object; a person's words are not. One that opens as an object and does not read throws, as no request Core makes. */
function payloadOf(message: string): Record<string, unknown> | undefined {
  if (!message.trimStart().startsWith("{")) return undefined;
  const parsed: unknown = JSON.parse(message);
  return isRecord(parsed) ? parsed : undefined;
}

/** The task a conversation continues: the newest earlier message whose last text block is a task's JSON object, naming its `taskKind`. */
function continuedPayload(earlier: readonly unknown[]): Record<string, unknown> | undefined {
  for (const message of [...earlier].reverse()) {
    const content = isRecord(message) ? message.content : undefined;
    const blocks = Array.isArray(content) ? content : [];
    const text = blocks.length === 0 ? "" : wordsOf([blocks.at(-1)]).trim();
    if (!text.startsWith("{")) continue;
    try {
      const parsed = payloadOf(text);
      if (parsed !== undefined && typeof parsed.taskKind === "string") return parsed;
    } catch (error) {
      // A block that opens as an object and is not JSON is no task: the next earlier message is tried. Any other failure is not that.
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  return undefined;
}

/**
 * Reads a request's kind and contents off the wire. A task's user message is JSON
 * naming its `taskKind`; a chat turn is the person's words, which carry none
 * (`runtime/llm/anthropic/panel-command.ts`). Throws on a body that is no Messages
 * request, because answering that would be answering with junk.
 */
export function readScriptedModelRequest(body: string, ordinalOf: (kind: ScriptedModelKind) => number): ScriptedModelRequest {
  const wire: unknown = JSON.parse(body);
  if (!isRecord(wire) || typeof wire.model !== "string" || !Array.isArray(wire.messages) || wire.messages.length === 0) throw new Error("The request is not an Anthropic Messages request");
  if (wire.stream !== true) throw new Error("The request does not ask for a stream, which every Core call does");
  const last: unknown = wire.messages.at(-1);
  const message = wordsOf(isRecord(last) ? last.content : undefined);
  // A judge that continues the decider (`models/providers/anthropic/continuation.ts` in Core) sends the attempt's own
  // conversation with the judge's task as the last block of an earlier message and a closing word of prose (a `system`
  // turn) after it: the task is then read from there, never taken for a chat turn.
  const payload = payloadOf(message) ?? continuedPayload(wire.messages.slice(0, -1));
  const kind = payload === undefined ? "panel_command" : typeof payload.taskKind === "string" ? payload.taskKind : "unknown";
  const format = isRecord(wire.output_config) && isRecord(wire.output_config.format) ? wire.output_config.format : undefined;
  const schema = format && isRecord(format.schema) ? format.schema : undefined;
  const properties = schema && isRecord(schema.properties) ? schema.properties : undefined;
  const tools = Array.isArray(wire.tools) ? wire.tools.flatMap((tool): ScriptedModelTool[] => (isRecord(tool) && typeof tool.name === "string" ? [{ name: tool.name, description: typeof tool.description === "string" ? tool.description : "" }] : [])) : [];
  return Object.freeze({ kind, ordinal: ordinalOf(kind), model: wire.model, jsonText: properties !== undefined && "result_json" in properties, message, tools, payload });
}
