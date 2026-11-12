import type { ChatConversationPort } from "@fluxiq/ui-components";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import { present } from "../../../../shared/present";
import type { PanelConversationDeleteRequest, PanelConversationReadRequest, PanelConversationRenameRequest, PanelConversationSendRequest } from "../../../../shared/protocol";
import type { PanelStore } from "../../../state";
import { payloadOf, threadChangeOf } from "../reply";
import { personActivationIsActive } from "./person-activation";

type Typed = { type: string };

/** Said when an answer reaches the transport with no person's press behind it. */
const PRESS_IT_YOURSELF = "Press the answer yourself to give it.";

/**
 * Core's conversation through the background's relays. The thread list's four
 * (`listAllThreads`, `newThread`, `renameThread`, `deleteThread`) write each
 * field of their message by name against its contract in `shared/protocol.ts`.
 * New chat is an open, never a message: it goes as `kind: "open"`, so the
 * background does not put the sending status on the page.
 *
 * An answer to a FluxIQ question requires a person's activation: it is sent
 * only while the panel holds a person's live user activation (`activation`,
 * the browser's own by default), and otherwise answers a failed result and
 * sends nothing. Every answer leaves the panel through here. Reads and sends
 * are not answers and are not gated.
 */
export function conversationPort(request: PanelStore["request"], activation: () => boolean = personActivationIsActive): ChatConversationPort {
  return {
    listThreads: async (query) => payloadOf(await request({ type: RUNTIME_MESSAGES.panelConversationRead, kind: "list", ...query })),
    readThread: async (query) => payloadOf(await request({ type: RUNTIME_MESSAGES.panelConversationRead, kind: "get", ...query })),
    send: async (message) => payloadOf(await request({ type: RUNTIME_MESSAGES.panelConversationSend, ...message })),
    // Read before the first await, in the same task as the press that made the answer.
    answer: async (answer) => {
      if (!activation()) return { ok: false, sentence: PRESS_IT_YOURSELF };
      return payloadOf(await request({ type: RUNTIME_MESSAGES.panelConversationAnswer, ...answer }));
    },
    listAllThreads: async (query) => payloadOf(await request(present<Typed & Extract<PanelConversationReadRequest, { kind: "list-all" }>>({
      type: RUNTIME_MESSAGES.panelConversationRead,
      kind: "list-all",
      projectId: query.projectId,
      limit: query.limit
    }))),
    newThread: async (opening) => threadChangeOf(await request(present<Typed & PanelConversationSendRequest>({
      type: RUNTIME_MESSAGES.panelConversationSend,
      kind: "open",
      fresh: true,
      projectId: opening.projectId,
      conversationId: undefined,
      text: undefined,
      capabilities: undefined,
      onScreen: undefined,
      subjectKind: opening.subjectKind,
      subjectId: opening.subjectId,
      title: opening.title
    }))),
    renameThread: async (change) => threadChangeOf(await request(present<Typed & PanelConversationRenameRequest>({
      type: RUNTIME_MESSAGES.panelConversationRename,
      projectId: change.projectId,
      conversationId: change.conversationId,
      title: change.title
    }))),
    deleteThread: async (change) => threadChangeOf(await request(present<Typed & PanelConversationDeleteRequest>({
      type: RUNTIME_MESSAGES.panelConversationDelete,
      projectId: change.projectId,
      conversationId: change.conversationId
    })))
  };
}
