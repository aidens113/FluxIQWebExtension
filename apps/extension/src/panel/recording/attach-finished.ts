// Waits for a recording that has just ended to be saved, then attaches it to the
// next message. Stopping returns at once, and FluxIQ saves the recording a moment
// later, so the list is read until the recording the person described shows up
// finished and was not there before. Only then is the newest recording attached:
// attaching earlier would attach an older one.

import type { PendingRecording } from "./pending-recording-store";

/** What the wait reads and does. */
export type FinishedRecordingDeps = {
  /** The recordings FluxIQ lists, or undefined when the list could not be read. */
  list(): Promise<ReadonlyArray<{ id: string; description?: string | undefined; status?: string | undefined; endedAt?: number | undefined }> | undefined>;
  /** Attaches the newest described recording to the next message; answers whether one was there. */
  attach(): Promise<boolean>;
  wait(ms: number): Promise<void>;
};

/** How long, and how often, the list is read. */
export type FinishedRecordingTiming = { readonly tries: number; readonly everyMs: number };

export const FINISHED_TIMING: FinishedRecordingTiming = { tries: 40, everyMs: 1000 };

/** Whether `pending`'s recording was attached before the tries ran out. Never throws. */
export async function attachFinishedRecording(pending: PendingRecording, deps: FinishedRecordingDeps, timing: FinishedRecordingTiming = FINISHED_TIMING): Promise<boolean> {
  for (let attempt = 0; attempt < timing.tries; attempt += 1) {
    if (attempt > 0) await deps.wait(timing.everyMs);
    try {
      const items = await deps.list();
      const saved = items?.some((item) => !pending.known.includes(item.id) && (item.description ?? "").trim() === pending.description && (item.status === "completed" || item.endedAt !== undefined));
      if (saved === true && await deps.attach()) return true;
    } catch {
      /* best-effort: a failed read is read again on the next try */
    }
  }
  return false;
}
