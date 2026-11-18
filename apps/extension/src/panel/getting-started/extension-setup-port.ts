// The setup port over the background's `fluxiq.panel.modelReadiness` message: the same reading the chat's key card
// uses (`readModelAccess`), so a reply is understood in one place.

import { readModelAccess } from "../chat/transport";
import type { PanelStore } from "../state";
import type { SetupPort } from "./setup-port";

/** Reads the AI key through `request`. */
export function extensionSetupPort(request: PanelStore["request"]): SetupPort {
  return {
    async readModelKey() {
      const read = await readModelAccess(request);
      return read.ok ? read.state : "unknown";
    }
  };
}
