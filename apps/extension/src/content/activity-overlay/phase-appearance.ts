// How each activity phase looks on the page: the word a person reads, the
// accent colour, and the mark beside it.
//
// The accents are chosen against the overlay's own dark card, never against
// the page, because the card carries its own background: every accent keeps at
// least 4.5:1 against it, so the phase name stays readable on a white page and
// a black one alike.

import type { ClientGatewayActivityPhase } from "../../shared/activity";

/** The mark beside the phase: a pulsing dot while work is under way, a settled glyph otherwise. */
export type ActivityPhaseMark = "pulse" | "check" | "cross" | "attention";

export type ActivityPhaseAppearance = { name: string; accent: string; mark: ActivityPhaseMark };

/** Every phase Core sends. A phase a newer Core adds falls back to `UNKNOWN_PHASE_APPEARANCE`. */
export const ACTIVITY_PHASE_APPEARANCE: Readonly<Record<ClientGatewayActivityPhase, ActivityPhaseAppearance>> = Object.freeze({
  thinking: { name: "Thinking", accent: "#b39dfb", mark: "pulse" },
  exploring: { name: "Exploring", accent: "#5cc8fa", mark: "pulse" },
  building: { name: "Building", accent: "#f5b94a", mark: "pulse" },
  running: { name: "Running", accent: "#7cb2fb", mark: "pulse" },
  extracting: { name: "Extracting", accent: "#4fdcc4", mark: "pulse" },
  verifying: { name: "Verifying", accent: "#a0a8fb", mark: "pulse" },
  repairing: { name: "Repairing", accent: "#fca468", mark: "pulse" },
  waiting_permission: { name: "Waiting for you", accent: "#f7d354", mark: "attention" },
  done: { name: "Done", accent: "#5fdf8e", mark: "check" },
  failed: { name: "Failed", accent: "#fa8a8a", mark: "cross" }
});

/** A phase this build does not know: shown plainly, in a neutral colour, still marked as under way. */
export const UNKNOWN_PHASE_APPEARANCE: ActivityPhaseAppearance = Object.freeze({ name: "Working", accent: "#c3c8d2", mark: "pulse" });
