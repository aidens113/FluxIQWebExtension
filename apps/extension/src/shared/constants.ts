export const EXTENSION_NAME = "FluxIQ Web Extension";
export const PROTOCOL_VERSION = 1;
export const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:4777/client";
export const HEARTBEAT_INTERVAL_MS = 20_000;
export const RECONNECT_BASE_DELAY_MS = 1_000;
export const RECONNECT_MAX_DELAY_MS = 30_000;
export const MAX_EVENT_QUEUE_SIZE = 1_000;

export const STORAGE_KEYS = {
  settings: "fluxiq.settings",
  session: "fluxiq.session",
  clientId: "fluxiq.clientId",
  queuedEvents: "fluxiq.queuedEvents"
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
  statusChanged: "fluxiq.statusChanged"
} as const;
