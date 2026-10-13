// Run facts (plan 3.9): what the panel can truthfully say about one run, from
// its summary and whatever else is known -- the adaptations `runAutomation`
// said it created, whether it said future runs changed, and the statuses the
// run's detail listed. A fact nobody reported stays undefined.
//
// The run's own durable flag says whether it kept a change. Current adaptation
// statuses can change after that run and cannot supply historical attribution.
// The API reports no exact kept count or kinds, so positive counts stay unknown;
// an explicit false proves zero, and a missing flag remains unknown.

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
  const durable = input.durableBehaviorChanged ?? run.durableBehaviorChanged;
  const learned = durable === false ? 0 : undefined;
  // Every change the run tried, kept or not: what is still being checked, or did not hold.
  const changesTried = ids?.length ?? run.adaptationCount;
  const known = statuses.filter((status): status is string => status !== undefined);
  const validated = known.some((status) => PASSED.has(status)) ? true
    : known.length > 0 && known.length === statuses.length && known.every((status) => DROPPED.has(status)) ? false
      : undefined;
  const futureRunsUpdated = durable;

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
