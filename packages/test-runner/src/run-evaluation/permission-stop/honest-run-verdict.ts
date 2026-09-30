import type { RunEvaluation } from "@fluxiq-web-extension/test-contracts";
import { PERMISSION_STOP_INVARIANT } from "./permission-stop-invariant.js";

/**
 * A run's verdict as a person reads it: the evaluation's own, except that a
 * build that stopped to ask for permission reads `stopped_for_permission`
 * rather than a bare `failed`. It is never `passed`: a run passes only when it
 * created a Flow and that Flow did the task.
 */
export type HonestRunVerdict = RunEvaluation["verdict"] | "stopped_for_permission";

/** The verdict of one evaluation, reading its permission-stop invariant (`permissionStopInvariant`). */
export function honestRunVerdict(evaluation: Pick<RunEvaluation, "verdict" | "invariants">): HonestRunVerdict {
  const stopped = evaluation.invariants.some((invariant) => invariant.id === PERMISSION_STOP_INVARIANT && !invariant.passed);
  return stopped ? "stopped_for_permission" : evaluation.verdict;
}
