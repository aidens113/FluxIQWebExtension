// The real collaborators behind `handlePanelControl`. Kept apart from it so the
// control can be tested with no `chrome` at all; `background/index.ts` is the
// one caller.

import type { ExtensionStatus } from "../../shared/protocol";
import type { FluxIQConnection } from "../connection";
import { callCoreProgram } from "../connection/index";
import { readSettings, writeSettings } from "../storage";
import type { PanelControlDeps } from "./panel-control";

export function panelControlDeps(connection: FluxIQConnection, status: () => Promise<ExtensionStatus>): PanelControlDeps {
  return {
    relay: {
      // Credentials are read per call, so a token FluxIQ rotated on reconnect is the one sent.
      call: (endpoint, payload) => callCoreProgram(connection.coreApiCredentials(), endpoint, payload),
      projectId: () => connection.projectId()
    },
    readSettings,
    writeSettings,
    applySettings: (settings) => connection.updateSettings(settings),
    status,
    openTab: async (url) => {
      await chrome.tabs.create({ url, active: true });
    }
  };
}
