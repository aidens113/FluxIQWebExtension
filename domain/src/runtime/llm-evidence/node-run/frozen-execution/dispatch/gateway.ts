import { webAutomationCheckWaitParameters } from "../../../../../actions/check-wait";
import type { WebLlmEvidenceGateway } from "../../../capture";
import { present } from "../../../present";
import { webNodeFinalDispatch } from "./final";

/** Lower the owning gateway's defaults, then report that exact command before sending it. */
export function webNodeFinalGateway(sessions: WebLlmEvidenceGateway): WebLlmEvidenceGateway {
  return present<WebLlmEvidenceGateway>({
    eligibleSessionIds: () => sessions.eligibleSessionIds(),
    structureDetectionSessionIds: sessions.structureDetectionSessionIds?.bind(sessions),
    executeAction: (sessionId, command) => {
      const actual = { ...command, parameters: webAutomationCheckWaitParameters(command.actionType, command.parameters) };
      webNodeFinalDispatch(sessionId, command, actual);
      return sessions.executeAction(sessionId, actual);
    }
  });
}
