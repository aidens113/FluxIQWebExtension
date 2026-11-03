import type { ChatConversationPort } from "@fluxiq/ui-components";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import type { PanelStore } from "../../../state";
import { payloadOf } from "../reply";

/** Core's conversation through the background's relays. */
export function conversationPort(request: PanelStore["request"]): ChatConversationPort {
  return {
    listThreads: async (query) => payloadOf(await request({ type: RUNTIME_MESSAGES.panelConversationRead, kind: "list", ...query })),
    readThread: async (query) => payloadOf(await request({ type: RUNTIME_MESSAGES.panelConversationRead, kind: "get", ...query })),
    send: async (message) => payloadOf(await request({ type: RUNTIME_MESSAGES.panelConversationSend, ...message })),
    answer: async (answer) => payloadOf(await request({ type: RUNTIME_MESSAGES.panelConversationAnswer, ...answer }))
  };
}
