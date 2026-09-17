import { failureCategories, type FailureCategory, type RunEvaluation, type RunManifest } from "@fluxiq-web-extension/test-contracts";

/**
 * The one invariant every evaluated run carries: the runner's own verdict on
 * it, or -- for a run whose scenario declares the failure it must report --
 * that declaration's judgement, restated under the same id
 * (`declared-failure-verdict.ts`).
 */
export const RUNNER_VERDICT_INVARIANT = "runner-verdict";

/**
 * The run-as-a-test half of a `RunEvaluation`: the runner's verdict, the
 * test-rig category behind a failure, the evidence event that closed the run,
 * and the run's duration. Nothing here reads what the automation did.
 */
export type RunOutcome = Pick<RunEvaluation, "runId" | "verdict" | "invariants" | "metrics" | "durationMs"> & { failureCategory?: FailureCategory };

export type RunOutcomeInput = {
  runId: string;
  verdict: "passed" | "failed";
  /** The runner's raw category string; coerced to the test-rig taxonomy. */
  failureCategory: string | undefined;
  metrics: Record<string, number>;
  /** `run.json`: its start and finish times are the run's duration when both are readable. */
  manifest: RunManifest | undefined;
  /** The caller's wall clock, used when `run.json` has no usable finish time. */
  wallClockMs: number;
  /** Sequence of the run's `final` evidence event; the closing event of a pass. */
  finalSequence: number | undefined;
  /** Sequence of the run's last `error` evidence event; the closing event of a failure. */
  errorSequence: number | undefined;
};

/**
 * The half of an evaluation both the bench and a single `lab run` compute the
 * same way. Stating it once is what keeps a single run's evaluation and a
 * bench row's comparable: the two differ only in where their
 * `RunLaneObservation` comes from, never in how the run-as-a-test is judged.
 */
export function runOutcome(input: RunOutcomeInput): RunOutcome {
  const passed = input.verdict === "passed";
  const category = passed ? undefined : testRigCategory(input.failureCategory);
  const closing = passed ? input.finalSequence : input.errorSequence;
  return {
    runId: input.runId,
    verdict: input.verdict,
    ...(category === undefined ? {} : { failureCategory: category }),
    invariants: [{ id: RUNNER_VERDICT_INVARIANT, passed, expected: "passed", actual: passed ? "passed" : `failed: ${category}`, evidenceSequences: closing === undefined ? [] : [closing] }],
    metrics: { ...input.metrics },
    durationMs: runDurationMs(input.manifest) ?? input.wallClockMs,
  };
}

/** A run's own measured duration, or `undefined` when `run.json` cannot supply one. */
export function runDurationMs(manifest: RunManifest | undefined): number | undefined {
  if (!manifest?.finishedAt) return undefined;
  const duration = Date.parse(manifest.finishedAt) - Date.parse(manifest.startedAt);
  return Number.isFinite(duration) && duration >= 0 ? duration : undefined;
}

/**
 * `RunEvaluation.failureCategory` is the test-rig taxonomy: why the facility
 * could not produce a trustworthy run. Its only producer is
 * `classifyRunnerFailure`, which already returns a `FailureCategory`, so a
 * value outside the list means the runner grew a category the evaluation
 * contract does not carry and `unknown` is the honest reading of it.
 *
 * This is not the axis the automation fails on, and the coercion must not be
 * widened to admit that one. A web-automation failure code from
 * `domain/src/runtime/failure/codes.ts` (`web.target.not_found`) and the Core
 * `AutomationStudioAdaptiveFailureClass` it carries (`target_not_found`) both
 * belong on `automationFailureReported`; arriving here, either is correctly
 * read as `unknown`, because neither says anything about the facility.
 */
function testRigCategory(value: string | undefined): FailureCategory {
  return value !== undefined && (failureCategories as readonly string[]).includes(value) ? value as FailureCategory : "unknown";
}
