import type { ChatChangesPort } from "@fluxiq/ui-components";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import { asRecord } from "../reply";
import type { RuntimeListen } from "./activity";

/**
 * Core's conversation changes, pushed by the background (`panelChanges`): `server.conversation_changed` names the
 * conversation, activity names the conversation or project it belongs to, and `server.session_ready` (a reconnect,
 * after which Core replays nothing) names none. A push naming conversations tells the listener of each; one naming
 * none tells it once with no conversation, which is a full re-read.
 *
 * `complete: true`: every change the chat shows reaches it by one of those pushes, so it runs no poll.
 */
export function changesPort(listen: RuntimeListen): ChatChangesPort {
  return {
    complete: true,
    subscribe: (listener) => listen((message) => {
      const pushed = asRecord(message);
      if (pushed?.type !== RUNTIME_MESSAGES.panelChanges) return;
      const ids = Array.isArray(pushed.conversationIds) ? pushed.conversationIds.filter((id): id is string => typeof id === "string" && id !== "") : [];
      if (ids.length === 0) listener({});
      else for (const conversationId of ids) listener({ conversationId });
    })
  };
}
