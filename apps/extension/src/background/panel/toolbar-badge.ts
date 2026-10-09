// What the toolbar button says about FluxIQ when no panel is open.
//
// Firefox's popup closes the moment the person clicks the page, so a recording
// or a run would otherwise be invisible there. The badge says "REC" while a
// recording is going, "!" while FluxIQ's work waits on the person -- a run
// held for them (Take over), a question, a check only they can pass -- and
// "..." while FluxIQ is running steps, and nothing otherwise. Recording wins
// over both, since it is the one the person started and must remember to
// stop; "!" wins over "...", since it is the one that needs the person.
//
// A run is a series of steps with gaps between them, and each step's status
// ends before the next begins. So "..." holds for a short while after a step
// finishes, and only then clears: a badge that blinked off between every step
// would say the run had ended when it had not.

import type { ActivityDisplay } from "../../shared/activity/index";
import type { ExtensionStatus } from "../../shared/protocol";

/** How long "..." stays up after a step finishes, waiting for the next one. */
export const RUN_BADGE_HOLD_MS = 10_000;

export type ToolbarBadge = {
  readonly text: "REC" | "!" | "..." | "";
  /** When the badge must be worked out again, because a hold runs out then. */
  readonly recheckAt?: number | undefined;
};

/** `activity` is the activity display shown now (`ActivityRelay`); null or absent when there is none. */
export function toolbarBadge(status: Pick<ExtensionStatus, "recordingState" | "runtime">, now: number, activity: Pick<ActivityDisplay, "outcome"> | null = null): ToolbarBadge {
  if (status.recordingState === "recording") return { text: "REC" };
  if (activity?.outcome === "waiting") return { text: "!" };
  const runtime = status.runtime;
  if (runtime?.state === "running") return { text: "..." };
  if (runtime && runtime.state !== "idle" && typeof runtime.finishedAt === "number") {
    const holdUntil = runtime.finishedAt + RUN_BADGE_HOLD_MS;
    if (holdUntil > now) return { text: "...", recheckAt: holdUntil };
  }
  return { text: "" };
}
