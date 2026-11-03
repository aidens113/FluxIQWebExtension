import type { ChatTransport } from "@fluxiq/ui-components";
import type { PanelStore } from "../../state";
import { listenToRuntime } from "../feed";
import { activityPort, conversationPort, modelsPort, recordingsPort, runsPort, type RuntimeListen } from "./ports";

/**
 * The chat's transport over the extension's background: each port sends the
 * message the panel always sent and flattens the reply. Pushes come from the
 * runtime's broadcast; `listen` is the test seam for it.
 */
export function createExtensionChatTransport(request: PanelStore["request"], listen: RuntimeListen = listenToRuntime): ChatTransport {
  return {
    conversation: conversationPort(request),
    activity: activityPort(request, listen),
    runs: runsPort(request),
    recordings: recordingsPort(request),
    models: modelsPort(request)
  };
}
