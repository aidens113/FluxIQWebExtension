// The setup port over the background's `fluxiq.panel.modelReadiness` message.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { PanelStore } from "../state";
import { modelKeyFromReply } from "./model";
import type { SetupPort } from "./setup-port";

/** Reads the model key through `request`. */
export function extensionSetupPort(request: PanelStore["request"]): SetupPort {
  return {
    async readModelKey() {
      try {
        return modelKeyFromReply(await request({ type: RUNTIME_MESSAGES.panelModelReadiness }));
      } catch {
        return "unknown";
      }
    }
  };
}
