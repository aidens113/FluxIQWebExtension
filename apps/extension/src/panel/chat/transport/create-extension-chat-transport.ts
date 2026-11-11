import type { ChatDownload, ChatTransport } from "@fluxiq/ui-components";
import type { ExtensionStatus } from "../../../shared/protocol";
import type { PanelStore } from "../../state";
import { downloadFile } from "../../automations";
import { listenToRuntime } from "../feed";
import { activityPort, conversationPort, modelsPort, recordingsPort, resultsPort, runsPort, taskSettingsPort, type RuntimeListen } from "./ports";

/**
 * The chat's transport over the extension's background: each port sends the
 * message the panel always sent and flattens the reply. Pushes come from the
 * runtime's broadcast; `listen` is the test seam for it, and `download` the one
 * for saving a file. `status` is the panel's latest status, which carries the
 * person's starting humanness; with it, each task's answer card offers its own
 * humanness (`taskSettings`), and without it the card offers none.
 */
export function createExtensionChatTransport(
  request: PanelStore["request"],
  listen: RuntimeListen = listenToRuntime,
  download: ChatDownload = downloadFile,
  status?: () => ExtensionStatus | undefined
): ChatTransport {
  return {
    conversation: conversationPort(request),
    activity: activityPort(request, listen),
    runs: runsPort(request),
    recordings: recordingsPort(request),
    models: modelsPort(request),
    results: resultsPort(request, listen, download),
    ...(status === undefined ? {} : { taskSettings: taskSettingsPort(request, status) })
  };
}
