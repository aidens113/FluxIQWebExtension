import type { RunEvaluation, RunManifest } from "@fluxiq-web-extension/test-contracts";
import type { RunLaneObservation } from "../flow-lane/index.js";
import { evaluateObservedRun } from "./observed-run-evaluation.js";
import { runOutcome } from "./run-outcome.js";

/** One evidence event, as far as an evaluation cares: which trigger closed the run, and at what sequence. */
export type RunClosingEvent = { sequence: number; trigger: string };

export type SingleRunInput = {
  runId: string;
  verdict: "passed" | "failed";
  /** The runner's raw failure category; absent on a pass. */
  failureCategory: string | undefined;
  scenarioId: string;
  /** `undefined` for the manifest's primary workflow, which the evaluation records as `null`. */
  workflowId: string | undefined;
  /** `undefined` when no variant was armed. */
  variantId: string | undefined;
  /** What the lane that ran this run observed. */
  observation: RunLaneObservation;
  /** The `run.json` the run just wrote. */
  manifest: RunManifest | undefined;
  /** The metrics the run finalizes its bundle with. */
  metrics: Record<string, number>;
  /** The run's evidence events, in order. */
  events: readonly RunClosingEvent[];
  /** The runner's own wall clock, used when `run.json` has no usable finish time. */
  wallClockMs: number;
};

/**
 * One scenario run's `RunEvaluation` — the same judgement `lab bench` records
 * per corpus row, for a run that was never part of a corpus.
 *
 * It exists because a `RunEvaluation` had no producer outside the bench, so
 * the only way to learn whether a run was good was to run the whole corpus.
 * Every automation field comes from the `RunLaneObservation` the lane
 * published, which until now nothing read: on the recording lane that is the
 * fixture oracle's own verdict and the Core probe's outcome, and on the Flow
 * lane the persisted Core run's.
 *
 * A single run is always `repeatIndex: 0` — it is nobody's replay — and it
 * scores against the resolved workflow's own `expected.failure`, which the
 * lane already carries on its observation.
 */
export function singleRunEvaluation(input: SingleRunInput): RunEvaluation {
  return evaluateObservedRun({
    identity: {
      scenarioId: input.scenarioId,
      workflowId: input.workflowId ?? null,
      variantId: input.variantId ?? null,
      repeatIndex: 0,
      expectedFailure: input.observation.automationFailureExpected,
    },
    outcome: runOutcome({
      runId: input.runId,
      verdict: input.verdict,
      failureCategory: input.failureCategory,
      metrics: input.metrics,
      manifest: input.manifest,
      wallClockMs: input.wallClockMs,
      ...closingSequences(input.events),
    }),
    observation: input.observation,
  });
}

/**
 * The `final` event closes a pass and the last `error` event closes a failure.
 * Read from the events in memory rather than from the journal on disk, and by
 * the same rule the bench applies to `events.ndjson`, so the two agree.
 */
function closingSequences(events: readonly RunClosingEvent[]): { finalSequence: number | undefined; errorSequence: number | undefined } {
  let finalSequence: number | undefined;
  let errorSequence: number | undefined;
  for (const event of events) {
    if (event.trigger === "final") finalSequence = event.sequence;
    else if (event.trigger === "error") errorSequence = event.sequence;
  }
  return { finalSequence, errorSequence };
}
