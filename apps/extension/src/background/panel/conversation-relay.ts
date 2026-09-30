// The panel's conversation with FluxIQ, relayed to Core's conversation
// endpoints with the pairing token.
//
// The thread belongs to Core. Nothing here remembers a conversation, a turn or
// an ask between two messages: each request is turned into one Core call (or,
// for a first message with no thread yet, an open followed by the message), and
// Core's payload comes back as Core sent it. The one addition is a first
// message's reply, which carries the `conversation` its thread was opened as,
// beside `append-turn`'s own `turn` and `response`, because the panel has no
// other way to learn the new thread's ID. The other is filling in a list's
// `subjectId` when it asks for the project's own thread (`subjectKind:
// "project"` alone): that id is the project id, which the panel does not know
// before its first read.
//
// Every message offers Core what the chat can do and says where the person is:
// - `capabilities` is always `CHAT_CAPABILITIES` (ids only: Core executes each
//   one server-side and supplies its own descriptor), followed by any object
//   entry the panel named whose id is not already offered.
// - `onScreen` carries the panel's flowId, subflowId, runId and recordingId, and
//   `pageUrl`: the active tab's web address from `pageLocation`, or else the
//   panel's own `pageUrl` when it is an http(s) address of at most 2048
//   characters. Core builds from that page. It is left out when empty. The
//   address is never logged.
// An automation's chat is opened with `kind: "open"`, `subjectKind: "flow"` and
// the Flow's id as `subjectId`; Core then reads "run it" in that thread as that
// Flow.
//
// The message shapes are `PanelConversation*Request` in `shared/protocol.ts`.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type {
  PanelConversationAnswerRequest,
  PanelConversationReadRequest,
  PanelConversationSendRequest,
  PanelRelayResponse
} from "../../shared/protocol";
import { CHAT_CAPABILITIES } from "./chat-capabilities";
import { acceptedPageUrl } from "./page-url";
import type { PanelRelayContext } from "./relay-context";
import { relayFailure } from "./relay-failure";

type ConversationMessage = { readonly type?: string; readonly [key: string]: unknown };

/** Core's subject kind for a thread about the project itself; its subject id is the project id. */
const PROJECT_SUBJECT = "project";

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
  const subjectKind = text(list.subjectKind);
  let subjectId = text(list.subjectId);
  if (subjectKind === PROJECT_SUBJECT && subjectId === undefined) {
    // The project's own thread: its subject id is the project id, which only
    // this side knows before the first read. Core takes a subject only whole.
    if (!projectId) return relayFailure("no_project");
    subjectId = projectId;
  }
  return context.call("list-conversations", defined({
    projectId,
    status: text(list.status),
    subjectKind,
    subjectId,
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
  if (conversationId) return withPayload(() => turnPayload(projectId, conversationId, body, message, context), (payload) => context.call("append-turn", payload));

  // A first message: open its thread, then send it there.
  const opened = await context.call("open-conversation", opening);
  if (!opened.ok) return opened;
  const conversation = (opened.payload as { conversation?: { conversationId?: unknown } } | null)?.conversation;
  const openedId = text(conversation?.conversationId);
  if (!openedId) return { ok: false, code: "failed", error: "FluxIQ opened a conversation but did not say which one." };
  const appended = await withPayload(() => turnPayload(projectId, openedId, body, message, context), (payload) => context.call("append-turn", payload));
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

// `capabilities` is never empty: with it Core reads the message, may run one of
// them, and writes its answer into the thread; without it the turn would only
// be stored.
async function turnPayload(
  projectId: string,
  conversationId: string,
  body: string,
  message: Partial<PanelConversationSendRequest>,
  context: PanelRelayContext
): Promise<Record<string, unknown>> {
  return defined({
    projectId,
    conversationId,
    text: body,
    capabilities: capabilitiesFor(message.capabilities),
    onScreen: await onScreenFor(message.onScreen, context)
  });
}

function capabilitiesFor(requested: unknown): unknown[] {
  const offered: unknown[] = [...CHAT_CAPABILITIES];
  const ids = new Set(CHAT_CAPABILITIES.map((capability) => capability.id));
  for (const entry of Array.isArray(requested) ? requested : []) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const id = (entry as { id?: unknown }).id;
    if (typeof id === "string") {
      if (ids.has(id)) continue;
      ids.add(id);
    }
    offered.push(entry);
  }
  return offered;
}

const ON_SCREEN_FIELDS = ["flowId", "subflowId", "runId", "recordingId"] as const;

async function onScreenFor(requested: unknown, context: PanelRelayContext): Promise<Record<string, string> | undefined> {
  const panel = requested && typeof requested === "object" ? requested as Record<string, unknown> : {};
  const onScreen: Record<string, string> = {};
  for (const field of ON_SCREEN_FIELDS) {
    const value = text(panel[field]);
    if (value) onScreen[field] = value;
  }
  const pageUrl = acceptedPageUrl(await context.pageLocation()) ?? acceptedPageUrl(panel.pageUrl);
  if (pageUrl) onScreen.pageUrl = pageUrl;
  return Object.keys(onScreen).length > 0 ? onScreen : undefined;
}

// The page is part of what the person asked ("automate this page"), so a
// message is not sent as though they were on no page when the browser could
// not say which one it is: the send fails, saying why, and the words stay in
// the composer.
async function withPayload(
  build: () => Promise<Record<string, unknown>>,
  send: (payload: Record<string, unknown>) => Promise<PanelRelayResponse>
): Promise<PanelRelayResponse> {
  let payload: Record<string, unknown>;
  try {
    payload = await build();
  } catch (error) {
    return { ok: false, code: "failed", error: `The browser could not say which page you are on, so nothing was sent: ${error instanceof Error ? error.message : String(error)}` };
  }
  return send(payload);
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
