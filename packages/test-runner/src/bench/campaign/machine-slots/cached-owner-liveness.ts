import type { PidPresence } from "./pid-presence.js";

type LivenessOwner = Readonly<{ ticketId: string; pid: number; bootIdentitySha256: string; processIdentitySha256: string }>;

export type CachedOwnerLivenessOptions = Readonly<{
  /** The full identity probe. Its `false` is the only way an owner is ever reported not live. */
  verify: (owner: LivenessOwner) => Promise<boolean>;
  /** A spawn-free check of whether any process holds a PID. */
  presence: (pid: number) => PidPresence;
  /** A monotonic millisecond clock. */
  monotonicNowMs: () => number;
  /** How long a verified owner whose PID stays present is trusted before its identity is probed again. */
  reverifyIntervalMs: number;
}>;

export type CachedOwnerLiveness = Readonly<{
  /** Resolves `false` only when the full identity probe says the owner is gone. */
  isLive(owner: LivenessOwner): Promise<boolean>;
  /** Records an owner whose identity the caller has just probed itself. */
  markVerified(owner: LivenessOwner): void;
}>;

/**
 * Decides slot and ticket owner liveness for one slot wait without running
 * the full identity probe on every poll. On Windows that probe starts
 * powershell.exe, and the wait loop polls every 100 ms, so probing every
 * owner on every poll kept PowerShell starting for as long as a cell queued.
 *
 * The safety direction is unchanged: only `verify` can report an owner not
 * live, so nothing is archived on this cache's word. The cache can only keep
 * calling a dead owner live, and only for a bounded time:
 * - an owner record seen for the first time is always probed;
 * - a PID reported absent is probed before a "not live" verdict, so a crashed
 *   owner is recovered on the next poll;
 * - a presence result that is not evidence is probed, exactly as before;
 * - a PID still present is trusted for at most `reverifyIntervalMs` after the
 *   start of the last successful probe, which bounds how long a PID reused by
 *   another process can hold a slot or a queue position.
 *
 * A probe failure propagates, so the caller still fails closed.
 */
export function createCachedOwnerLiveness(options: CachedOwnerLivenessOptions): CachedOwnerLiveness {
  const verifiedAt = new Map<string, number>();
  const probe = async (key: string, owner: LivenessOwner): Promise<boolean> => {
    // Stamp before probing so a slow probe cannot lengthen the trusted window.
    const startedAt = options.monotonicNowMs();
    const live = await options.verify(owner);
    if (live) verifiedAt.set(key, startedAt);
    else verifiedAt.delete(key);
    return live;
  };
  return Object.freeze({
    isLive: async (owner: LivenessOwner): Promise<boolean> => {
      const key = keyOf(owner);
      const lastVerifiedAt = verifiedAt.get(key);
      if (lastVerifiedAt === undefined) return probe(key, owner);
      // Absent: confirm before any verdict. Unknown: no evidence, so probe as before this cache existed.
      if (options.presence(owner.pid) !== "present") return probe(key, owner);
      // Present: another process may hold the PID now, so re-probe once the window closes.
      if (options.monotonicNowMs() - lastVerifiedAt >= options.reverifyIntervalMs) return probe(key, owner);
      return true;
    },
    markVerified: (owner: LivenessOwner): void => {
      verifiedAt.set(keyOf(owner), options.monotonicNowMs());
    },
  });
}

/** One entry per owner record, so a new record on an already verified PID is still probed on first sight. */
function keyOf(owner: LivenessOwner): string {
  return JSON.stringify([owner.ticketId, owner.pid, owner.bootIdentitySha256, owner.processIdentitySha256]);
}
