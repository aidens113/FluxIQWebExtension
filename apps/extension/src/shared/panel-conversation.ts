// The panel's conversation requests: the messages the chat sends the
// background worker for Core's threads (`background/panel/conversation-relay.ts`
// and `thread-change-relay.ts`). `protocol.ts` re-exports them, so they are
// named from there as every other panel message is.

/**
 * The panel's requests to FluxIQ Core that the background worker relays with
 * the pairing token (`background/panel/`). Each is the `RUNTIME_MESSAGES.panel*`
 * message named beside it, plus these fields. A `projectId` left out means the
 * project this browser's session belongs to (`ExtensionStatus.projectId`).
 *
 * The relay adds nothing and keeps nothing: a successful reply carries Core's
 * payload exactly as Core returned it, and no conversation state lives in the
 * background worker.
 */
export type PanelConversationReadRequest =
  /**
   * `list-conversations`. `projectId: null` lists every thread in the projects
   * this browser can see; left out, it is the session's project when one is
   * known, and every project when none is.
   */
  | { kind: "list"; projectId?: string | null | undefined; status?: "open" | "resolved" | undefined; subjectKind?: string | undefined; subjectId?: string | undefined; limit?: number | undefined }
  /**
   * `list-conversations` for the chat's thread list: every thread in the named
   * project, or, with `projectId` left out, every thread in every project this
   * browser can see. Unlike `list`, a left-out project is never the session's.
   */
  | { kind: "list-all"; projectId?: string | undefined; limit?: number | undefined }
  /** `get-conversation`: one thread, from `sinceTurnId` when given. */
  | { kind: "get"; projectId?: string | undefined; conversationId: string; sinceTurnId?: string | undefined; limit?: number | undefined };

export type PanelConversationSendRequest = {
  /**
   * `open` starts a thread and sends nothing (`open-conversation`). Otherwise
   * `text` is sent: into `conversationId` when given (`append-turn`), or into a
   * thread opened for it first, whose `conversation` then joins the reply.
   */
  kind?: "open" | "append" | undefined;
  projectId?: string | undefined;
  conversationId?: string | undefined;
  text?: string | undefined;
  /**
   * Extra capabilities Core may answer with. The relay always offers the
   * chat's own (`background/panel/chat-capabilities.ts`, which Core runs
   * itself) and adds these after them, minus any id already offered.
   */
  capabilities?: unknown[] | undefined;
  /**
   * What the panel has open. `pageUrl` is only a fallback: the relay sends the
   * active tab's address when the browser gives one, and Core builds from it.
   */
  onScreen?: { flowId?: string; subflowId?: string; runId?: string; recordingId?: string; pageUrl?: string } | undefined;
  subjectKind?: string | undefined;
  subjectId?: string | undefined;
  title?: string | undefined;
  /**
   * With `kind: "open"`, the thread list's New chat: `open-conversation` with
   * `fresh: true`, which always makes a new thread instead of continuing the
   * subject's open one. A subject of `panel` (the chat with no project open),
   * or `project` with no id, is the project's own thread.
   */
  fresh?: boolean | undefined;
};

/**
 * `panelConversationRename` (`rename-conversation`): a person's own name for a
 * thread. Core trims `title` and refuses an empty one or one over 200
 * characters in its own words. `projectId` is the thread's own, from its list
 * row; left out, Core looks for the thread in every project this browser may
 * change, and is never sent the session's project in its place.
 */
export type PanelConversationRenameRequest = {
  projectId?: string | undefined;
  conversationId: string;
  title: string;
};

/**
 * `panelConversationDelete` (`delete-conversation`): removes a thread, every
 * turn and every question in it. Core refuses one whose work is still running
 * (`conversation_run_active`) in its own words. `projectId` as for a rename.
 */
export type PanelConversationDeleteRequest = {
  projectId?: string | undefined;
  conversationId: string;
};

/** `answer-ask`: the person's answer to a question FluxIQ asked in a thread. */
export type PanelConversationAnswerRequest = {
  projectId?: string | undefined;
  askId: string;
  kind: string;
  value?: string | undefined;
};
