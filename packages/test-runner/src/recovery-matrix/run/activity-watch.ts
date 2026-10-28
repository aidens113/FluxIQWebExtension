// Collects the recovery rows of Core's live activity while a case's run is in
// flight.
//
// Core keeps no activity on disk: `get-activity` answers the last 60 events of
// a project from memory (Core `runtime/activity/hub.ts`), and a run's later
// steps push its earlier rows out. A case whose check reads a recovery row
// therefore reads the stream every `intervalMs` from before the run starts to
// after it answers, and keeps every recovery row it saw, each once by Core's
// sequence number (`../records/recovery-activities.ts`). A read that fails is
// counted, not fatal: the check says the rows were not collected when no read
// ever succeeded.

import { matrixRecoveryActivities, type MatrixRecoveryActivity } from "../records/index.js";

export type MatrixActivityWatch = Readonly<{
  /** Stops reading, reads once more, and answers what was seen; `null` when no read succeeded. */
  stop(): Promise<MatrixActivityCollection>;
}>;

export type MatrixActivityCollection = Readonly<{ activities: readonly MatrixRecoveryActivity[] | null; reads: number; failedReads: number }>;

/** Starts reading the stream with `read` (one `get-activity` call) until `stop`. */
export function watchMatrixActivity(read: () => Promise<unknown>, intervalMs = 250): MatrixActivityWatch {
  const seen = new Map<number, MatrixRecoveryActivity>();
  let reads = 0;
  let failedReads = 0;
  let stopped = false;
  let pending = false;
  let inFlight: Promise<void> = Promise.resolve();
  const once = async () => {
    try {
      const snapshot = await read();
      reads += 1;
      for (const activity of matrixRecoveryActivities(snapshot)) seen.set(activity.sequence, activity);
    } catch {
      failedReads += 1;
    }
  };
  // One read at a time: a tick that finds the last read still out skips, so a slow Core never queues reads up.
  const tick = () => {
    if (stopped || pending) return;
    pending = true;
    inFlight = once().finally(() => { pending = false; });
  };
  const timer = setInterval(tick, intervalMs);
  tick();
  return {
    async stop() {
      stopped = true;
      clearInterval(timer);
      await inFlight;
      await once();
      const activities = reads > 0 ? [...seen.values()].sort((left, right) => left.sequence - right.sequence) : null;
      return { activities, reads, failedReads };
    },
  };
}
