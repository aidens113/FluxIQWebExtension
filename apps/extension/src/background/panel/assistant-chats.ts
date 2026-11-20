// The assistant's own threads (`list-panel-threads`, project id "panel"), read
// into the conversation shape `list-conversations` answers, so the chat's
// all-chats list shows both kinds. Core answers them flat (`subjectKind:
// "panel"`), which the chat's conversation reader refuses, so each is given a
// project subject here, as Core's web panel does
// (`apps/web/src/features/chats/parse-panel-threads.ts`). A record without an
// id, a valid status or a time is dropped alone.

/** The project id Core gives the assistant's own threads; it is never shown to a person. */
const PANEL_PROJECT = "panel";

export function panelThreadsAsConversations(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): Record<string, unknown>[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;
    const { conversationId, status, createdAt, updatedAt } = record;
    if (typeof conversationId !== "string" || !conversationId) return [];
    if (status !== "open" && status !== "resolved") return [];
    if (typeof createdAt !== "number" || typeof updatedAt !== "number") return [];
    const count = (field: unknown) => (typeof field === "number" && field >= 0 ? field : 0);
    return [{
      conversationId,
      projectId: typeof record.projectId === "string" && record.projectId ? record.projectId : PANEL_PROJECT,
      subject: { kind: "project", id: PANEL_PROJECT },
      status,
      title: typeof record.title === "string" && record.title.trim() ? record.title : null,
      turnCount: count(record.turnCount),
      pendingAskCount: count(record.pendingAskCount),
      createdAt,
      updatedAt
    }];
  });
}
