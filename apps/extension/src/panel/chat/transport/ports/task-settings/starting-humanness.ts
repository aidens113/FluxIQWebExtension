import type { ExtensionStatus } from "../../../../../shared/protocol";

/**
 * The person's starting humanness, as the latest status carries it: the
 * Settings slider "Starting humanness for new Flows and tasks". A whole number
 * from 0 to 100; absent, or anything else, reads as 0, the last of the
 * precedence. Read from the status each time it is wanted, so a change in
 * Settings shows on the next read.
 */
export function startingHumanness(status: ExtensionStatus | undefined): number {
  // `FluxIQSettings` does not name the field yet (Settings' interface I1), so it is read narrowly here.
  const value = (status?.settings as { humanness?: unknown } | undefined)?.humanness;
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
