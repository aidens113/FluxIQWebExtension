import type { HonestRunVerdict } from "./honest-run-verdict.js";

/** Runs counted by verdict; a permission stop has its own count and is in neither `passed` nor `failed`. */
export type VerdictTotals = { runs: number; passed: number; failed: number; stoppedForPermission: number; inconclusive: number };

/** The totals a summary reports for `verdicts`. `passed` counts only runs that created a Flow that did the task. */
export function verdictTotals(verdicts: readonly HonestRunVerdict[]): VerdictTotals {
  const count = (verdict: HonestRunVerdict) => verdicts.filter((each) => each === verdict).length;
  return { runs: verdicts.length, passed: count("passed"), failed: count("failed"), stoppedForPermission: count("stopped_for_permission"), inconclusive: count("inconclusive") };
}
