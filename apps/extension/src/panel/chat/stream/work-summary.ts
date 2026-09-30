// The one line a folded group of work shows: "Worked for 2m 5s · 46 steps",
// "12 steps so far" while it is still going, and how many failed when any
// did. Times are Core's own event times, so the duration is how long the work
// took, not how long this panel was open.

import type { WorkGroup } from "./thread-entries";

/** The group's summary line. `working` is true while the live line carries it. */
export function workSummary(group: WorkGroup, working: boolean): string {
  const count = group.rows.length;
  const steps = `${count} ${count === 1 ? "step" : "steps"}`;
  const failed = group.rows.filter((row) => row.status === "failed").length;
  const tail = failed > 0 ? ` · ${failed} failed` : "";
  if (working) return `${steps} so far${tail}`;
  const took = duration(group.endAt - group.startAt);
  return `${took === undefined ? "Worked" : `Worked for ${took}`} · ${steps}${tail}`;
}

/** `ms` as "45s", "2m 5s", "12m" or "1h 4m"; undefined when it is not a readable span. */
export function duration(ms: number): string | undefined {
  if (!Number.isFinite(ms) || ms < 0) return undefined;
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 10) return seconds % 60 === 0 ? `${minutes}m` : `${minutes}m ${seconds % 60}s`;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 === 0 ? `${hours}h` : `${hours}h ${minutes % 60}m`;
}
