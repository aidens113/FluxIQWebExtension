export const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:4777/client";
export const DEFAULT_CORE_API_URL = "http://127.0.0.1:3000";
export const LEGACY_GATEWAY_CORE_API_URL = "http://127.0.0.1:4777";
export const HEARTBEAT_INTERVAL_MS = 20_000;
export const RECONNECT_BASE_DELAY_MS = 1_000;
export const RECONNECT_MAX_DELAY_MS = 30_000;
export const MAX_EVENT_QUEUE_SIZE = 1_000;

export const STORAGE_KEYS = {
  settings: "fluxiq.settings",
  session: "fluxiq.session",
  clientId: "fluxiq.clientId",
  queuedEvents: "fluxiq.queuedEvents",
  // In `chrome.storage.session`, not `local`: forgotten when the browser closes.
  disconnectedByPerson: "fluxiq.disconnectedByPerson"
} as const;

export const RUNTIME_MESSAGES = {
  getStatus: "fluxiq.getStatus",
  connect: "fluxiq.connect",
  disconnect: "fluxiq.disconnect",
  resetSession: "fluxiq.resetSession",
  dismissRecordingLock: "fluxiq.dismissRecordingLock",
  getRecordingLog: "fluxiq.getRecordingLog",
  listRecordings: "fluxiq.listRecordings",
  startRecording: "fluxiq.startRecording",
  stopRecording: "fluxiq.stopRecording",
  contentReady: "fluxiq.contentReady",
  contentEvent: "fluxiq.contentEvent",
  executeAction: "fluxiq.executeAction",
  captureSnapshot: "fluxiq.captureSnapshot",
  statusChanged: "fluxiq.statusChanged",
  // The panel's own requests (background/panel/). Each is accepted only from
  // the side panel or the popup (`background/control-page.ts`).
  panelSaveSettings: "fluxiq.panel.saveSettings",
  panelOpenFluxIQ: "fluxiq.panel.openFluxIQ",
  panelConversationRead: "fluxiq.panel.conversationRead",
  panelConversationSend: "fluxiq.panel.conversationSend",
  panelConversationAnswer: "fluxiq.panel.conversationAnswer",
  panelStopRun: "fluxiq.panel.stopRun",
  testArmScriptedNavigation: "fluxiq.test.armScriptedNavigation",
  testAwaitScriptedNavigation: "fluxiq.test.awaitScriptedNavigation",
  testCancelScriptedNavigation: "fluxiq.test.cancelScriptedNavigation"
} as const;
