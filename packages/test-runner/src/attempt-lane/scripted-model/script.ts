import type { ScriptedModelKind, ScriptedModelRequest } from "./wire-request.js";

/**
 * One reply: what the model would answer to this request, as the decoded JSON its
 * output schema asks for. It reads what it needs from the request's real evidence and
 * throws when that is not there, which fails the run with its kind rather than
 * answering with junk.
 */
export type ScriptedReply = (request: ScriptedModelRequest) => unknown;

/**
 * A task's script: the ordered replies per request kind. A request past the end of its
 * kind's list, or of a kind with no list, fails loudly. Scripts are test fixtures, so
 * they may name the task; nothing in product guidance sees them.
 */
export type ScriptedModelScript = Readonly<{
  taskId: string;
  replies: Readonly<Record<ScriptedModelKind, readonly ScriptedReply[]>>;
}>;
