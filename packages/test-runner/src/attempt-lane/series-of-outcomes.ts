import type { AttemptContinuation, AttemptSeries } from "@fluxiq-web-extension/test-contracts";
import { proveContinuation } from "./continuation.js";
import type { AttemptOutcome, AttemptTask } from "./driver.js";
import { attemptReportRow, attemptSeries } from "./report.js";

/**
 * The series of the attempts that ended, in order: each proven against the one before it, and the deterministic summary
 * over those after the first. `asked` is how many attempts the run asked for in all, so a series that stopped short says
 * how many later attempts never ran. Used both for a finished run and for one that stopped (`unscored-attempt-evidence.ts`).
 */
export function seriesOfOutcomes(task: AttemptTask, outcomes: readonly AttemptOutcome[], asked: number): { series: AttemptSeries; continuations: AttemptContinuation[] } {
  const continuations = outcomes.slice(1).map((later, index) => proveContinuation(outcomes[index]!, later));
  const series = attemptSeries(task, outcomes.map((outcome) => attemptReportRow(task, outcome)), continuations, asked, new Map(outcomes.map((outcome) => [outcome.record.ordinal, outcome.record.flowId ?? null])));
  return { series, continuations };
}
