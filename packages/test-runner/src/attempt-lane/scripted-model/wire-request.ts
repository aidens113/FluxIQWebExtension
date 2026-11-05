/** What a request asks of the model, in the words Core's task kinds use. Anything else is a kind no script expects. */
export type ScriptedModelKind = string;

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
  const payload = payloadOf(message);
  const kind = payload === undefined ? "panel_command" : typeof payload.taskKind === "string" ? payload.taskKind : "unknown";
  const format = isRecord(wire.output_config) && isRecord(wire.output_config.format) ? wire.output_config.format : undefined;
  const schema = format && isRecord(format.schema) ? format.schema : undefined;
  const properties = schema && isRecord(schema.properties) ? schema.properties : undefined;
  return Object.freeze({ kind, ordinal: ordinalOf(kind), model: wire.model, jsonText: properties !== undefined && "result_json" in properties, message, payload });
}
