// The real collaborators behind `handlePanelControl`. Kept apart from it so the
// control can be tested with no `chrome` at all; `background/index.ts` is the
// one caller.

import type { ExtensionStatus } from "../../shared/protocol";
import type { FluxIQConnection } from "../connection";
import { callCoreProgram } from "../connection/index";
import { readSettings, writeSettings } from "../storage";
import { acceptedPageUrl } from "./page-url";
import type { PanelControlDeps } from "./panel-control";

export function panelControlDeps(connection: FluxIQConnection, status: () => Promise<ExtensionStatus>): PanelControlDeps {
  return {
    relay: {
      // Credentials are read per call, so a token FluxIQ rotated on reconnect is the one sent.
      call: (endpoint, payload) => callCoreProgram(connection.coreApiCredentials(), endpoint, payload),
      projectId: () => connection.projectId(),
      pageLocation: activePageLocation
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

// The last-focused window's active tab: with the side panel or popup open, that
// is the page beside it. Anything but a web page is none. A failed query
// rejects, and the relay says so instead of sending as if there were no page.
async function activePageLocation(): Promise<string | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return acceptedPageUrl(tab?.url);
}
