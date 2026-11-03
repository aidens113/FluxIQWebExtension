import type { ChatHostStatus } from "@fluxiq/ui-components";
import type { ExtensionStatus } from "../../shared/protocol";

/** What the chat knows of the extension's connection; `ownerKey` is the extension's own identity for who the chat belongs to. */
export function hostStatusOf(status: ExtensionStatus, ownerKey: string): ChatHostStatus {
  return {
    connected: status.connectionState === "connected",
    ownerKey,
    projectId: status.projectId ?? undefined,
    recording: status.recordingState === "recording" || status.recordingState === "paused"
  };
}
