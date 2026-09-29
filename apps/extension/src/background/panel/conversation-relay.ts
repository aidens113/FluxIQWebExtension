// The panel's conversation with FluxIQ, relayed to Core's conversation
// endpoints with the pairing token.
//
// The thread belongs to Core. Nothing here remembers a conversation, a turn or
// an ask between two messages: each request is turned into one Core call (or,
// for a first message with no thread yet, an open followed by the message), and
// Core's payload comes back as Core sent it. The one addition is a first
// message's reply, which carries the `conversation` its thread was opened as,
// beside `append-turn`'s own `turn` and `response`, because the panel has no
// other way to learn the new thread's ID.
//
// The message shapes are `PanelConversation*Request` in `shared/protocol.ts`.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type {
  PanelConversationAnswerRequest,
  PanelConversationReadRequest,
  PanelConversationSendRequest,
  PanelRelayResponse
} from "../../shared/protocol";
import type { PanelRelayContext } from "./relay-context";
import { relayFailure } from "./relay-failure";

type ConversationMessage = { readonly type?: string; readonly [key: string]: unknown };

/** Relays one of the three conversation messages. Undefined for any other message type. */
export async function relayConversation(message: ConversationMessage, context: PanelRelayContext): Promise<PanelRelayResponse | undefined> {
  if (message.type === RUNTIME_MESSAGES.panelConversationRead) return read(message as Partial<PanelConversationReadRequest>, context);
  if (message.type === RUNTIME_MESSAGES.panelConversationSend) return send(message as Partial<PanelConversationSendRequest>, context);
  if (message.type === RUNTIME_MESSAGES.panelConversationAnswer) return answer(message as Partial<PanelConversationAnswerRequest>, context);
  return undefined;
}

async function read(message: Partial<PanelConversationReadRequest> & { conversationId?: unknown }, context: PanelRelayContext): Promise<PanelRelayResponse> {
  if (message.kind === "get" || message.conversationId !== undefined) {
    const projectId = projectFor(message.projectId, context);
    if (!projectId) return relayFailure("no_project");
    const conversationId = text(message.conversationId);
    if (!conversationId) return relayFailure("invalid_request", "Say which conversation to read.");
    const get = message as Partial<Extract<PanelConversationReadRequest, { kind: "get" }>>;
    return context.call("get-conversation", defined({ projectId, conversationId, sinceTurnId: text(get.sinceTurnId), limit: whole(get.limit) }));
  }
  const list = message as Partial<Extract<PanelConversationReadRequest, { kind: "list" }>>;
  // An explicit null asks across every project; left out, the session's project.
  const projectId = list.projectId === null ? null : projectFor(list.projectId, context) ?? null;
  return context.call("list-conversations", defined({
    projectId,
    status: text(list.status),
    subjectKind: text(list.subjectKind),
    subjectId: text(list.subjectId),
    limit: whole(list.limit)
  }));
}

async function send(message: Partial<PanelConversationSendRequest>, context: PanelRelayContext): Promise<PanelRelayResponse> {
  const projectId = projectFor(message.projectId, context);
  if (!projectId) return relayFailure("no_project");
  const opening = defined({ projectId, subjectKind: text(message.subjectKind), subjectId: text(message.subjectId), title: text(message.title) });
  if (message.kind === "open") return context.call("open-conversation", opening);

  const body = text(message.text);
  if (!body) return relayFailure("invalid_request", "There is no message to send.");
  const conversationId = text(message.conversationId);
  if (conversationId) return context.call("append-turn", turnPayload(projectId, conversationId, body, message));

  // A first message: open its thread, then send it there.
  const opened = await context.call("open-conversation", opening);
  if (!opened.ok) return opened;
  const conversation = (opened.payload as { conversation?: { conversationId?: unknown } } | null)?.conversation;
  const openedId = text(conversation?.conversationId);
  if (!openedId) return { ok: false, code: "failed", error: "FluxIQ opened a conversation but did not say which one." };
  const appended = await context.call("append-turn", turnPayload(projectId, openedId, body, message));
  if (!appended.ok) return appended;
  return { ok: true, payload: { conversation, ...(appended.payload as Record<string, unknown> | null ?? {}) } };
}

async function answer(message: Partial<PanelConversationAnswerRequest>, context: PanelRelayContext): Promise<PanelRelayResponse> {
  const projectId = projectFor(message.projectId, context);
  if (!projectId) return relayFailure("no_project");
  const askId = text(message.askId);
  const kind = text(message.kind);
  if (!askId || !kind) return relayFailure("invalid_request", "Say which question this answers, and how.");
  return context.call("answer-ask", defined({ projectId, askId, kind, value: typeof message.value === "string" ? message.value : undefined }));
}

// `capabilities` is always sent, an empty list when the panel names none: with
// it Core reads the message and writes its answer into the thread, and without
// it the turn would only be stored.
function turnPayload(projectId: string, conversationId: string, body: string, message: Partial<PanelConversationSendRequest>): Record<string, unknown> {
  return defined({
    projectId,
    conversationId,
    text: body,
    capabilities: Array.isArray(message.capabilities) ? message.capabilities : [],
    onScreen: message.onScreen && typeof message.onScreen === "object" ? message.onScreen : undefined
  });
}

function projectFor(requested: unknown, context: PanelRelayContext): string | undefined {
  return text(requested) ?? text(context.projectId());
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function whole(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function defined(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}
