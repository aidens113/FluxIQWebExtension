// What the chat stage reads back from Core while a build started from the
// extension's chat runs: the project's chat threads and their turns, read the
// way FluxIQ's own panel reads them (`list-conversations`, `get-conversation`),
// and the project's own Flows (`list-flows`), so the Flow the chat made is the
// one that was not there before the instruction was sent.
//
// Every one of these reads is safe to repeat, so each is retried
// (`../retried-read.ts`): lane A's run `run-mv0fu9uq-107ab0de` died on one
// unretried 10 s `list-flows` before the instruction was ever typed.

import type { FluxIQHttpOptions } from "../../../http-control/index.js";
import { retriedRead } from "../retried-read.js";

export type CreatedFlowChatReadControl = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: FluxIQHttpOptions, domainId?: string): Promise<unknown>;
  /** How the reader tells time and waits between tries; the real clock when absent. Tests pass a fake. */
  readClock?: Readonly<{ now(): number; sleep(ms: number): Promise<void> }>;
};

/** Where the chat is read: the run's project and the domain Core holds it to. */
export type CreatedFlowChatScope = Readonly<{ projectId: string; domainId: string }>;

/** One turn of a chat thread, with only what the stage reads. */
export type CreatedFlowChatTurn = Readonly<{
  turnId: string;
  ordinal: number;
  author: string;
  text: string;
  ask: Readonly<{ askId: string; kind: string; status: string; controlKind: string | null }> | null;
  attachment: Readonly<{ kind: string; ref: string }> | null;
}>;

const READ_BOUNDS: FluxIQHttpOptions = { timeoutMs: 10_000 };
/** A thread's turns are read a page at a time. */
const TURN_PAGE = 200;
/** No chat in a Lab run is longer than this many pages; a reader past it is reading a loop. */
const MAX_PAGES = 20;

/** Every chat thread of the project, by id. */
export async function chatConversationIds(control: CreatedFlowChatReadControl, scope: CreatedFlowChatScope): Promise<string[]> {
  const listed = record(await chatRead(control, scope, "list-conversations", { projectId: scope.projectId }));
  return (Array.isArray(listed.conversations) ? listed.conversations : []).flatMap((thread) => isRecord(thread) && typeof thread.conversationId === "string" ? [thread.conversationId] : []);
}

/** Every turn of one thread, oldest first, a page at a time. */
export async function chatThreadTurns(control: CreatedFlowChatReadControl, scope: CreatedFlowChatScope, conversationId: string): Promise<CreatedFlowChatTurn[]> {
  const turns: CreatedFlowChatTurn[] = [];
  let sinceTurnId: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const payload = record(await chatRead(control, scope, "get-conversation", { projectId: scope.projectId, conversationId, limit: TURN_PAGE, ...(sinceTurnId ? { sinceTurnId } : {}) }));
    const thread = record(payload.conversation);
    const read = (Array.isArray(thread.turns) ? thread.turns : []).flatMap(turnOf);
    turns.push(...read);
    const last = read.at(-1)?.turnId;
    if (thread.hasMore !== true || last === undefined) break;
    sinceTurnId = last;
  }
  return turns;
}

/**
 * The project's own Flows, by id. A Flow's Subflows are listed as Flows of
 * their own (`metadata.subflowGraph`), and a build that makes one Flow makes
 * several of those, so they are left out: the count is of Flows a person made.
 */
export async function projectFlowIds(control: CreatedFlowChatReadControl, scope: CreatedFlowChatScope): Promise<string[]> {
  const listed = record(await chatRead(control, scope, "list-flows", { projectId: scope.projectId }));
  return (Array.isArray(listed.flows) ? listed.flows : []).flatMap((entry) => {
    const flow = isRecord(entry) && isRecord(entry.flow) ? entry.flow : entry;
    if (!isRecord(flow) || typeof flow.flowId !== "string") return [];
    return isRecord(flow.metadata) && flow.metadata.subflowGraph === true ? [] : [flow.flowId];
  });
}

/** One read with the chat's bound, retried (`../retried-read.ts`). */
function chatRead(control: CreatedFlowChatReadControl, scope: CreatedFlowChatScope, endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
  return retriedRead(endpoint, () => control.automationStudioCall(endpoint, payload, READ_BOUNDS, scope.domainId), control.readClock);
}

function turnOf(value: unknown): CreatedFlowChatTurn[] {
  if (!isRecord(value) || typeof value.turnId !== "string" || typeof value.ordinal !== "number") return [];
  const ask = isRecord(value.ask) && typeof value.ask.askId === "string" && typeof value.ask.kind === "string"
    ? Object.freeze({ askId: value.ask.askId, kind: value.ask.kind, status: typeof value.ask.status === "string" ? value.ask.status : "unknown", controlKind: isRecord(value.ask.control) && typeof value.ask.control.kind === "string" ? value.ask.control.kind : null })
    : null;
  const attachment = isRecord(value.attachment) && typeof value.attachment.kind === "string" && typeof value.attachment.ref === "string"
    ? Object.freeze({ kind: value.attachment.kind, ref: value.attachment.ref })
    : null;
  return [Object.freeze({ turnId: value.turnId, ordinal: value.ordinal, author: typeof value.author === "string" ? value.author : "unknown", text: typeof value.text === "string" ? value.text : "", ask, attachment })];
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
