// The real collaborators behind `handlePanelControl`. Kept apart from it so the
// control can be tested with no `chrome` at all; `background/index.ts` is the
// one caller.

import type { ExtensionStatus } from "../../shared/protocol";
import { DEFAULT_CORE_API_URL } from "../../shared/constants";
import type { FluxIQConnection } from "../connection";
import { callCoreProgram } from "../connection/index";
import { readSettings, writeSettings } from "../storage";
import { chatPageLocation } from "./chat-page";
import type { PanelControlDeps } from "./panel-control";

export function panelControlDeps(connection: FluxIQConnection, status: () => Promise<ExtensionStatus>): PanelControlDeps {
  return {
    relay: {
      // Credentials are read per call, so a token FluxIQ rotated on reconnect is the one sent.
      call: (endpoint, payload) => callCoreProgram(connection.coreApiCredentials(), endpoint, payload),
      projectId: () => connection.resolveProjectId("panel"),
      // The page beside the panel (`chat-page.ts`). A failed query rejects, and
      // the relay says so instead of sending as if there were no page.
      pageLocation: () => chatPageLocation({
        activeTabs: async () => {
          const [focused, all] = await Promise.all([
            chrome.tabs.query({ active: true, lastFocusedWindow: true }),
            chrome.tabs.query({ active: true })
          ]);
          return [...focused, ...all];
        },
        ownOrigins: () => {
          const settings = connection.currentSettings();
          return [settings.coreApiUrl || DEFAULT_CORE_API_URL, settings.gatewayUrl];
        }
      })
    },
    readSettings,
    writeSettings,
    applySettings: (settings) => connection.updateSettings(settings),
    status,
    openTab: async (url) => {
      await chrome.tabs.create({ url, active: true });
    },
    activity: {
      read: () => connection.activityState(),
      setOverlay: (overlay) => connection.setActivityOverlay(overlay)
    }
  };
}
