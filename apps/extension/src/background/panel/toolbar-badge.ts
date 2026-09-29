// What the toolbar button says about FluxIQ when no panel is open.
//
// Firefox's popup closes the moment the person clicks the page, so a recording
// or a run would otherwise be invisible there. The badge says "REC" while a
// recording is going and "..." while FluxIQ is running steps, and nothing
// otherwise; recording wins when both are true, since it is the one the person
// started and must remember to stop.
//
// A run is a series of steps with gaps between them, and each step's status
// ends before the next begins. So "..." holds for a short while after a step
// finishes, and only then clears: a badge that blinked off between every step
// would say the run had ended when it had not.

import type { ExtensionStatus } from "../../shared/protocol";

/** How long "..." stays up after a step finishes, waiting for the next one. */
export const RUN_BADGE_HOLD_MS = 10_000;

export type ToolbarBadge = {
  readonly text: "REC" | "..." | "";
  /** When the badge must be worked out again, because a hold runs out then. */
  readonly recheckAt?: number | undefined;
};

export function toolbarBadge(status: Pick<ExtensionStatus, "recordingState" | "runtime">, now: number): ToolbarBadge {
  if (status.recordingState === "recording") return { text: "REC" };
  const runtime = status.runtime;
  if (runtime?.state === "running") return { text: "..." };
  if (runtime && runtime.state !== "idle" && typeof runtime.finishedAt === "number") {
    const holdUntil = runtime.finishedAt + RUN_BADGE_HOLD_MS;
    if (holdUntil > now) return { text: "...", recheckAt: holdUntil };
  }
  return { text: "" };
}
