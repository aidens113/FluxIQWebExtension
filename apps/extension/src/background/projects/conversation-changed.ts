// `server.conversation_changed` carries a conversation id and its project and
// no content. It becomes one `panelChanges` message naming that conversation,
// so the chat reads that thread and the thread list again.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { PanelChangesMessage } from "../../shared/protocol";

/** The panel message for one `server.conversation_changed` payload, or undefined when it names no conversation. */
export function conversationChangedFor(payload: unknown, at: number): PanelChangesMessage | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const { conversationId, projectId } = payload as { conversationId?: unknown; projectId?: unknown };
  if (typeof conversationId !== "string" || conversationId === "") return undefined;
  return {
    type: RUNTIME_MESSAGES.panelChanges,
    projectId: typeof projectId === "string" && projectId ? projectId : null,
    conversationIds: [conversationId],
    at
  };
}
