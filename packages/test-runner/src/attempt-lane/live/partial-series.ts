import type { AttemptSeries } from "@fluxiq-web-extension/test-contracts";
import type { AttemptTask } from "../driver.js";
import { seriesOfOutcomes } from "../series-of-outcomes.js";
import type { ScoredAttempt } from "./unscored-attempt-evidence.js";

/**
 * The series of the attempts that ended and were scored, for a run that stopped before it could write its own: rows, each
 * continuation and the deterministic summary over what ran, with `asked` saying how many attempts the run asked for.
 * `undefined` when none was scored. `cacheHitPercent` is the share each attempt's own steps read from the cache, where known.
 */
export function partialSeries(input: { task: AttemptTask | undefined; scored: ReadonlyMap<number, ScoredAttempt>; asked: number; cacheHitPercent: (attempt: number) => number | null }): AttemptSeries | undefined {
  if (!input.task || input.scored.size === 0) return undefined;
  const outcomes = [...input.scored.entries()].sort(([left], [right]) => left - right).map(([, each]) => each.outcome);
  const { series } = seriesOfOutcomes(input.task, outcomes, input.asked);
  const rows = series.rows.map((row) => {
    const hit = input.cacheHitPercent(row.attempt);
    return hit === null ? row : { ...row, cacheHitPercent: hit };
  });
  return { ...series, rows };
}
