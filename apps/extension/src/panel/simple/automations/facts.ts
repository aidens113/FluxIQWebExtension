// Run facts (plan 3.9): what the card can truthfully say about one run, from
// its summary and whatever else is known -- the adaptations `runAutomation`
// said it created, whether it said future runs changed, and the statuses the
// run's detail listed. A fact nobody reported stays undefined.

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
  const learned = input.createdAdaptationIds?.length ?? run.adaptationCount;

  // The run's own adaptations and what Core says became of each.
  const ids = input.createdAdaptationIds ?? input.adaptationIds;
  const statuses = ids === undefined || input.adaptationStatuses === undefined
    ? []
    : ids.map((id) => input.adaptationStatuses?.get(id));
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
    validated,
    futureRunsUpdated
  };
}
