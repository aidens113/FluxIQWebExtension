import type { RunEvaluation, RunManifest } from "@fluxiq-web-extension/test-contracts";
import type { RunLaneObservation } from "../flow-lane/index.js";
import { flowLaneEvidenceSizes } from "./flow-lane-evidence-sizes.js";
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
  /** The campaign repeat this run satisfies; absent for a standalone run. */
  repeatIndex?: number;
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
  /**
   * The directory the run's evidence bundle is being written into
   * (`EvidenceBundle.stagingPath`, which `finalize` renames). A Flow-lane run's
   * evidence sizes are read from its `snapshots/flow-lane.json`, the file the
   * bench reads from the finalized bundle. Absent, no evidence size is read.
   */
  bundlePath?: string;
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
 * A Flow-lane run's evidence sizes come from the `snapshots/flow-lane.json` in
 * its bundle, read by `flowLaneEvidenceSizes`, the reader the bench's Flow lane
 * also uses (`bench/evaluate-run.ts`, `evaluateFlowRun`), so one run and its
 * bench row record the same packets. A recording-lane run contributes none, as
 * on the bench.
 *
 * A standalone run defaults to `repeatIndex: 0`; a campaign supplies the exact
 * repeat identity from its receipt. It scores against the resolved workflow's
 * own `expected.failure`, which the lane already carries on its observation.
 */
export function singleRunEvaluation(input: SingleRunInput): RunEvaluation {
  const evidence = input.observation.lane === "flow" && input.bundlePath !== undefined ? flowLaneEvidenceSizes(input.bundlePath) : undefined;
  return evaluateObservedRun({
    identity: {
      scenarioId: input.scenarioId,
      workflowId: input.workflowId ?? null,
      variantId: input.variantId ?? null,
      repeatIndex: input.repeatIndex ?? 0,
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
    ...(evidence ? { evidence } : {}),
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
