import type { JsonObject } from "fluxiq/core";
import type { WebLlmEvidenceGateway } from "../../capture";
import { webNodeForwardedDispatch } from "./dispatch";
import type { WebNodeFrozenScope } from "./types";

/** Keep ordinary passive/effect-check captures on the selected operation's resource. */
export function webNodeFrozenGateway(gateway: WebLlmEvidenceGateway, scope: WebNodeFrozenScope): WebLlmEvidenceGateway {
  return {
    ...gateway,
    executeAction(sessionId, command) {
      if (command.actionType !== "web.dom.capture_snapshot") return gateway.executeAction(sessionId, command);
      const parameters: JsonObject = { ...command.parameters, browserTabId: scope.browserTabId, browserFrameId: scope.browserFrameId };
      if (scope.browserFrameUrlPath !== undefined) parameters.browserFrameUrlPath = scope.browserFrameUrlPath;
      const pinned = { ...command, parameters };
      return webNodeForwardedDispatch(command, pinned, () => gateway.executeAction(sessionId, pinned));
    }
  };
}
