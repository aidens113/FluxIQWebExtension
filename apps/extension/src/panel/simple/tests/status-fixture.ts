// A complete ExtensionStatus for tests, with only what a test is about overridden.

import type { ExtensionStatus } from "../../../shared/protocol";

/** A fresh, never-paired, disconnected status with `overrides` applied. */
export function statusWith(overrides: Partial<ExtensionStatus> = {}): ExtensionStatus {
  return {
    connectionState: "disconnected",
    recordingState: "idle",
    gatewayUrl: "ws://127.0.0.1:4777/client",
    clientId: "client-1",
    paired: false,
    queueSize: 0,
    eventCount: 0,
    recentActivities: [],
    ...overrides
  };
}
