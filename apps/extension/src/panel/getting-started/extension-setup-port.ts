// The setup port over the background's `fluxiq.panel.modelReadiness` message.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { PanelStore } from "../state";
import { modelKeyFromReply, modelKeyLockWordsFromReply } from "./model";
import type { SetupPort } from "./setup-port";

/** Reads the model key through `request`. */
export function extensionSetupPort(request: PanelStore["request"]): SetupPort {
  let lockWords: string | undefined;
  return {
    async readModelKey() {
      try {
        const reply = await request({ type: RUNTIME_MESSAGES.panelModelReadiness });
        lockWords = modelKeyLockWordsFromReply(reply);
        return modelKeyFromReply(reply);
      } catch {
        lockWords = undefined;
        return "unknown";
      }
    },
    lockWords: () => lockWords
  };
}
