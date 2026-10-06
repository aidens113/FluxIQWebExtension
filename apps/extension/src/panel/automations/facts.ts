// Run facts (plan 3.9): what the panel can truthfully say about one run, from
// its summary and whatever else is known -- the adaptations `runAutomation`
// said it created, whether it said future runs changed, and the statuses the
// run's detail listed. A fact nobody reported stays undefined.
//
// `learned` counts only the run's adaptations Core reports `applied`: one that
// was created but is still proposed, testing or merely validated has not
// changed what future runs do, so it is never "learned". With the run's
// adaptation ids and their statuses known it is the number applied; when Core
// said nothing durable changed it is 0; otherwise it stays undefined. The
// summary's `adaptationCount` (created, applied or not) does not feed it.

import type { RunFacts, RunOutcome, RunSummary } from "./types";

/** Everything known about one run. Only `run` is required. */
export type RunFactsInput = {
  run: RunSummary;
  createdAdaptationIds?: readonly string[] | undefined;
  durableBehaviorChanged?: boolean | undefined;
  /** The run's own adaptations, when its detail named them. */
  adaptationIds?: readonly string[] | undefined;
  /** Status by adaptation id, from the run's detail. */
  adaptationStatuses?: ReadonlyMap<string, string> | undefined;
};

const OUTCOMES: Readonly<Record<string, RunOutcome>> = {
  queued: "running",
  running: "running",
  succeeded: "completed",
  failed: "failed",
  cancelled: "stopped"
};
const PASSED = new Set(["validated", "applied"]);
const DROPPED = new Set(["rejected", "disabled", "reverted", "superseded"]);

/** Reads what can be said about a run; unknown stays undefined. */
export function runFacts(input: RunFactsInput): RunFacts {
  const { run } = input;
  const outcome = Object.hasOwn(OUTCOMES, run.status) ? OUTCOMES[run.status] : undefined;
  const durationMs = run.startedAt !== undefined && run.finishedAt !== undefined && run.finishedAt >= run.startedAt
    ? run.finishedAt - run.startedAt
    : undefined;
  const aiActivations = run.interventionCount;

  // The run's own adaptations and what Core says became of each.
  const ids = input.createdAdaptationIds ?? input.adaptationIds;
  const statuses = ids === undefined || input.adaptationStatuses === undefined
    ? []
    : ids.map((id) => input.adaptationStatuses?.get(id));
  const learned = ids !== undefined && input.adaptationStatuses !== undefined
    ? statuses.filter((status) => status === "applied").length
    : input.durableBehaviorChanged === false ? 0 : undefined;
  // Every change the run tried, kept or not: what is still being checked, or did not hold.
  const changesTried = ids?.length ?? run.adaptationCount;
  const known = statuses.filter((status): status is string => status !== undefined);
  const validated = known.some((status) => PASSED.has(status)) ? true
    : known.length > 0 && known.length === statuses.length && known.every((status) => DROPPED.has(status)) ? false
      : undefined;
  const futureRunsUpdated = input.durableBehaviorChanged === true || known.includes("applied")
    ? true
    : input.durableBehaviorChanged === false ? false : undefined;

  return {
    outcome,
    durationMs,
    aiUsed: aiActivations === undefined ? undefined : aiActivations > 0,
    aiActivations,
    learned,
    changesTried,
    validated,
    futureRunsUpdated
  };
}
