import { captureEvidence, type WebLlmEvidenceGateway, type WebLlmEvidenceToolRequest } from "../../../capture";
import type { WebLlmSnapshotBinding } from "../../../sanitize";
import { RecoverableToolRejection } from "../../../tool-rejection";
import type { WebNodeRun } from "../../context";
import type { WebNodeDispatchCapture } from "../types";
import type { WebNodePageOptions } from "./options";

/** One look: the page it read, or the refusal that said the page could not be read (the host's failure rides on it). */
export type WebNodePageRead =
  | { kind: "read"; page: WebLlmSnapshotBinding }
  | { kind: "unreadable"; rejection: RecoverableToolRejection };

/** One look, with an unreadable page kept apart from a readable one; any other fault is thrown as it always was. */
export async function webNodeReadPage(run: WebNodeRun, request: WebLlmEvidenceToolRequest, options?: WebNodePageOptions, capture?: WebNodeDispatchCapture): Promise<WebNodePageRead> {
  try {
    const gateway: WebLlmEvidenceGateway = capture === undefined ? run.gateway : {
      ...run.gateway,
      executeAction: (sessionId, command) => capture.dispatch(command, () => run.gateway.executeAction(sessionId, command))
    };
    return { kind: "read", page: run.restamp(await captureEvidence(gateway, run.sessionId, request, run.request.signal, undefined, options)) };
  } catch (error) {
    if (error instanceof RecoverableToolRejection && error.code === "page_unreadable") return { kind: "unreadable", rejection: error };
    throw error;
  }
}
