// What each activity phase is called in the chat header, and the colour its
// chip takes. Every phase is set by a real Core event (the contract's
// `ClientGatewayActivityPhase`); `idle` is the header's own word for "nothing
// has been reported since the extension's worker started".

import type { ClientGatewayActivityPhase } from "../../../shared/activity/index";

/** A phase the header can show: Core's, or `idle` when there is none. */
export type ChatPhase = ClientGatewayActivityPhase | "idle";

/** The token family a phase chip is drawn in (panel/theme/tokens.css). */
export type ChatTone = "accent" | "success" | "warning" | "danger" | "neutral";

/** Each phase's chip label and tone. */
export const PHASE_COPY: Readonly<Record<ChatPhase, { label: string; tone: ChatTone }>> = {
  idle: { label: "Idle", tone: "neutral" },
  thinking: { label: "Thinking", tone: "accent" },
  exploring: { label: "Exploring", tone: "accent" },
  building: { label: "Building", tone: "accent" },
  running: { label: "Running", tone: "accent" },
  extracting: { label: "Extracting", tone: "accent" },
  verifying: { label: "Verifying", tone: "accent" },
  repairing: { label: "Repairing", tone: "warning" },
  waiting_permission: { label: "Needs you", tone: "warning" },
  done: { label: "Done", tone: "success" },
  failed: { label: "Failed", tone: "danger" }
};
