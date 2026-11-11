// Opening the thread this window last showed, once the chat's thread list has
// been read and lists it.
//
// The chat takes the thread to restore only when it is made, and the browser
// answers the memory later, so the restore rides on the list's first read: the
// read waits for the memory (a session-storage read, quicker than the list's
// trip to Core), and when the list comes back holding that thread while the
// chat still shows its latest chat, the thread opens before the chat sees the
// list. The chat then keeps it, as it keeps any thread on screen. A thread no
// longer listed (deleted, or in a project not open now) is ignored, as is a
// memory the browser could not read: the chat opens on its usual thread.

import type { ChatConversationPort, ChatTarget } from "@fluxiq/ui-components";
import type { RememberedThread, ThreadMemory } from "./session-thread-memory";

/** What the restore needs of the mounted chat. */
export type RestoringChat = { target(): ChatTarget; open(target: ChatTarget): void };

/** `port`, whose first thread list read opens `memory`'s thread on `chat()`. */
export function restoringThreadList(port: ChatConversationPort, memory: ThreadMemory, chat: () => RestoringChat | undefined): ChatConversationPort {
  const listAll = port.listAllThreads;
  if (listAll === undefined) return port;
  let restoring = true;
  let recalled: Promise<RememberedThread | undefined> | undefined;
  return {
    ...port,
    async listAllThreads(query) {
      let remembered: RememberedThread | undefined;
      if (restoring) {
        recalled ??= memory.recall();
        try {
          remembered = await recalled;
        } catch { /* best-effort: an unreadable memory only opens the usual thread */ }
      }
      const result = await listAll.call(port, query);
      if (!restoring || !result.ok) return result;
      restoring = false;
      const mounted = chat();
      if (remembered !== undefined && mounted !== undefined && mounted.target().kind === "latest" && listed(result.value.conversations, remembered.conversationId)) {
        mounted.open({ kind: "thread", conversationId: remembered.conversationId, projectId: remembered.projectId });
      }
      return result;
    }
  };
}

function listed(conversations: unknown, conversationId: string): boolean {
  return Array.isArray(conversations) && conversations.some((record) => (record as { conversationId?: unknown } | null)?.conversationId === conversationId);
}
