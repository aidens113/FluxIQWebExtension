import { captureEvidence, type WebLlmEvidenceGateway, type WebLlmEvidenceToolRequest } from "../../../capture";
import type { WebLlmSnapshotBinding } from "../../../sanitize";
import { RecoverableToolRejection } from "../../../tool-rejection";
import type { WebNodeRun } from "../../context";
import type { WebNodeDispatchCapture } from "../types";
import type { WebNodePageOptions } from "./options";

/** The page as it stands, arrived or not; undefined only for an unreadable start-page build. */
export async function webNodeReadablePage(run: WebNodeRun, request: WebLlmEvidenceToolRequest, options?: WebNodePageOptions, capture?: WebNodeDispatchCapture): Promise<WebLlmSnapshotBinding | undefined> {
  try {
    const gateway: WebLlmEvidenceGateway = capture === undefined ? run.gateway : {
      ...run.gateway,
      executeAction: (sessionId, command) => capture.dispatch(command, () => run.gateway.executeAction(sessionId, command))
    };
    return run.restamp(await captureEvidence(gateway, run.sessionId, request, run.request.signal, undefined, options));
  } catch (error) {
    if (run.request.startLocation !== undefined && error instanceof RecoverableToolRejection && error.code === "page_unreadable") return undefined;
    throw error;
  }
}
