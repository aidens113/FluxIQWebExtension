import type { BuildCategory, BuildTimeTotals, RunBuildTimeRow } from "./types.js";

const CATEGORIES: readonly BuildCategory[] = ["trial", "offline", "reset", "model", "exploration", "other"];

const zero = (): Record<BuildCategory, number> => ({ trial: 0, offline: 0, reset: 0, model: 0, exploration: 0, other: 0 });

function add(into: Record<string, number>, from: Record<string, number>): void {
  for (const [key, count] of Object.entries(from)) into[key] = (into[key] ?? 0) + count;
}

/** Pools many runs: summed milliseconds, time-weighted shares, and the unweighted mean of per-run shares. */
export function aggregateBuildTimes(rows: readonly RunBuildTimeRow[]): BuildTimeTotals {
  const totals: BuildTimeTotals = {
    runs: rows.length, wallMs: 0, exclusive: zero(), share: zero(), meanShare: zero(), idleMs: 0, modelInTrialMs: 0,
    resetInTrialMs: 0, trialCount: 0, liveTrialCount: 0, offlineTrialCount: 0, playbackMs: 0, incompleteSteps: 0, unknown: {}, ruleCounts: {}
  };
  const measuredRuns = rows.filter(row => row.measured.wallMs > 0);
  for (const { measured, incomplete } of rows) {
    totals.wallMs += measured.wallMs;
    for (const category of CATEGORIES) totals.exclusive[category] += measured.exclusive[category];
    totals.idleMs += measured.idleMs;
    totals.modelInTrialMs += measured.modelInTrialMs;
    totals.resetInTrialMs += measured.resetInTrialMs;
    totals.trialCount += measured.trialCount;
    totals.liveTrialCount += measured.liveTrialCount;
    totals.offlineTrialCount += measured.offlineTrialCount;
    totals.playbackMs += measured.playbackMs;
    totals.incompleteSteps += incomplete.length;
    add(totals.unknown, measured.unknown);
    add(totals.ruleCounts, measured.ruleCounts);
  }
  for (const category of CATEGORIES) {
    totals.share[category] = totals.wallMs > 0 ? totals.exclusive[category] / totals.wallMs : 0;
    totals.meanShare[category] = measuredRuns.length > 0 ? measuredRuns.reduce((sum, row) => sum + row.measured.exclusive[category] / row.measured.wallMs, 0) / measuredRuns.length : 0;
  }
  return totals;
}
