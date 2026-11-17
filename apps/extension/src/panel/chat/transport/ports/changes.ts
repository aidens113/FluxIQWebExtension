import type { ChatChangesPort } from "@fluxiq/ui-components";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import { asRecord } from "../reply";
import type { RuntimeListen } from "./activity";

/**
 * Core's conversation changes, pushed by the background (`panelChanges`) whenever the gateway reports a conversation,
 * attempt or run change. With this port the chat reads on each push and drops its poll to the slow beat.
 * A push naming conversations tells the listener of each; one naming none tells it once with no conversation.
 */
export function changesPort(listen: RuntimeListen): ChatChangesPort {
  return {
    subscribe: (listener) => listen((message) => {
      const pushed = asRecord(message);
      if (pushed?.type !== RUNTIME_MESSAGES.panelChanges) return;
      const ids = Array.isArray(pushed.conversationIds) ? pushed.conversationIds.filter((id): id is string => typeof id === "string" && id !== "") : [];
      if (ids.length === 0) listener({});
      else for (const conversationId of ids) listener({ conversationId });
    })
  };
}
