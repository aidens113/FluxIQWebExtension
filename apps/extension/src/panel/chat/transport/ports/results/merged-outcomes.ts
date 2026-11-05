import type { ChatTaskOutcome } from "@fluxiq/ui-components";

/**
 * A thread's outcomes, oldest first: Core's attempts, and the runs this panel saw finish that no
 * attempt already tells. An attempt's own session is a run too, so the feed can report it finished:
 * the attempt's record is the account of it, and the run is not told a second time.
 */
export function mergedOutcomes(attempts: readonly ChatTaskOutcome[], runs: readonly ChatTaskOutcome[]): ChatTaskOutcome[] {
  const runsTold = new Set(attempts.map(({ attempt }) => attempt.runId));
  const ids = new Set(attempts.map(({ attempt }) => attempt.attemptId));
  const others = runs.filter(({ attempt }) => !ids.has(attempt.attemptId) && (attempt.runId === undefined || !runsTold.has(attempt.runId)));
  return [...attempts, ...others].sort((one, other) => one.attempt.startedAtMs - other.attempt.startedAtMs);
}
