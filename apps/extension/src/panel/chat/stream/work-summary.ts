// The one quiet line a fold of work shows, the way ChatGPT's does:
//
//   done        "Worked for 2m 5s · 46 steps"
//   partial     "Worked for 3m": the relay no longer holds the work's first
//               steps, so a count would be a wrong number, and none is given
//   working     "12 steps so far", or "Show the work so far" when partial
//   failed      the same line, ending "· didn't finish" when the unit of work
//               itself failed (a step that failed along the way is not that:
//               exploring is trying, and its mark in the list says so)
//
// Times are Core's own event times, so the duration is how long the work
// took, not how long this panel was open. Markers such as "Started building"
// are listed but not counted as steps.

import type { WorkFold } from "./thread-entries";

/** The fold's summary line. `working` is true while the live line carries it. */
export function workSummary(fold: WorkFold, working: boolean): string {
  const count = fold.rows.filter((row) => row.counted).length;
  const steps = `${count} ${count === 1 ? "step" : "steps"}`;
  if (working) return fold.complete && count > 0 ? `${steps} so far` : "Show the work so far";
  const took = duration(fold.endAt - fold.startAt);
  const head = took === undefined ? "Worked" : `Worked for ${took}`;
  const parts = [head];
  if (fold.complete && count > 0) parts.push(steps);
  if (workFailed(fold)) parts.push("didn't finish");
  return parts.join(" · ");
}

/** True when the fold's last unit of work ended in failure. */
export function workFailed(fold: WorkFold): boolean {
  const last = fold.rows[fold.rows.length - 1];
  return last !== undefined && last.status === "failed" && (last.phase === "failed" || !last.counted);
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
