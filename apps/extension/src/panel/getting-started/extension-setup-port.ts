// The setup port over the background's `fluxiq.panel.modelReadiness` message: the same reading the chat's key card
// uses (`readModelAccess`), so a reply is understood in one place.

import { listenToRuntime } from "../chat/feed";
import { readModelAccess, subscribeModelAccess } from "../chat/transport";
import type { RuntimeListen } from "../chat/transport/ports";
import type { PanelStore } from "../state";
import type { SetupPort } from "./setup-port";

/** Reads the AI key through `request` and follows the background's pushes heard through `listen`. */
export function extensionSetupPort(request: PanelStore["request"], listen: RuntimeListen = listenToRuntime): SetupPort {
  return {
    subscribeModelKey: (listener) => subscribeModelAccess(listen, listener),
    async readModelKey() {
      const read = await readModelAccess(request);
      return read.ok ? read.state : "unknown";
    }
  };
}
