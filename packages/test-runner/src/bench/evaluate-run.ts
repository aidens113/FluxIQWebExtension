import { EVALUATION_SCHEMA_VERSION, assertRunEvaluation, failureCategories, type ExpectedFailure, type FailureCategory, type RunEvaluation, type RunManifest } from "@fluxiq-web-extension/test-contracts";
import { classifyRunnerFailure } from "../failure.js";

/**
 * Where each recording-lane measurement comes from. The bench writes these
 * into `runs.json` and `report.md`, so a `0` or an empty list that was not
 * observed is never read as an observation.
 */
export const RECORDING_LANE_SOURCES = {
  verdict: "the runner's verdict from runScenario",
  oracleVerdict: "derived from the runner's verdict: passed gives passed; a runtime.behavior failure (the category of the page-fact, final-state, extraction, and console-error assertions) gives failed; any other failure gives null, the oracle not reached. The runner does not publish which assertion failed.",
  reportedVerdict: "run.json actions[].status and automationFailure, from the Core round-trip probe; null when FluxIQ executed no action",
  harnessActivations: "0: the recording lane runs no Flow, so no Core run detail exposes harness activations",
  durationMs: "run.json finishedAt minus startedAt; the bench's wall clock when run.json is unreadable",
  actionLatency: "run.json actions[].durationMs; an unfinished action has none and is left out",
  evidenceSizes: "none: the recording lane's bundle holds no sanitized packets or raw snapshots, so both lists are empty and truncationCount is 0",
  llm: "disabled: Week 1 benches run provider-free",
} as const;

const RUNNER_VERDICT = "runner-verdict";

/** Which run of the corpus an evaluation describes. */
export type RunEvaluationIdentity = {
  scenarioId: string;
  workflowId: string | null;
  variantId: string | null;
  repeatIndex: number;
  /** The resolved workflow's `expected.failure`. */
  expectedFailure: ExpectedFailure | null;
};

export type RecordingRunInput = RunEvaluationIdentity & {
  result: { runId: string; verdict: "passed" | "failed"; failureCategory?: string };
  manifest: RunManifest | undefined;
  metrics: Record<string, number>;
  /** Sequence of the run's `final` evidence event. */
  finalSequence: number | undefined;
  /** Sequence of the run's last `error` evidence event. */
  errorSequence: number | undefined;
  /** The bench's wall-clock measurement of the attempt, used when `run.json` has no finish time. */
  wallClockMs: number;
};

type RunOutcome = Pick<RunEvaluation, "runId" | "verdict" | "invariants" | "metrics" | "oracleVerdict" | "reportedVerdict" | "automationFailureReported" | "durationMs" | "actions"> & { failureCategory?: FailureCategory };

/** A recording-lane run's `RunEvaluation`, validated, from its runner result and bundle. */
export function evaluateRecordingRun(input: RecordingRunInput): RunEvaluation {
  const passed = input.result.verdict === "passed";
  const category = passed ? undefined : testRigCategory(input.result.failureCategory);
  const closing = passed ? input.finalSequence : input.errorSequence;
  const reported = reportedOutcome(input.manifest);
  return assemble(input, {
    runId: input.result.runId,
    verdict: input.result.verdict,
    ...(category === undefined ? {} : { failureCategory: category }),
    invariants: [{ id: RUNNER_VERDICT, passed, expected: "passed", actual: passed ? "passed" : `failed: ${category}`, evidenceSequences: closing === undefined ? [] : [closing] }],
    metrics: { ...input.metrics },
    oracleVerdict: passed ? "passed" : category === "runtime.behavior" ? "failed" : null,
    reportedVerdict: reported.verdict,
    automationFailureReported: reported.failure,
    durationMs: runDurationMs(input.manifest) ?? input.wallClockMs,
    actions: (input.manifest?.actions ?? []).flatMap((action) => action.durationMs === undefined ? [] : [{ actionType: action.actionType, durationMs: action.durationMs }]),
  });
}

/** An attempt whose runner threw before finalizing a bundle: inconclusive, since nothing about the automation was observed. */
export function evaluateFailedAttempt(input: RunEvaluationIdentity & { attemptId: string; error: unknown; wallClockMs: number }): RunEvaluation {
  const category = classifyRunnerFailure(input.error);
  return assemble(input, {
    runId: input.attemptId,
    verdict: "inconclusive",
    failureCategory: category,
    invariants: [{ id: RUNNER_VERDICT, passed: false, expected: "passed", actual: `runner threw before finalizing a bundle: ${category}`, evidenceSequences: [] }],
    metrics: {},
    oracleVerdict: null,
    reportedVerdict: null,
    automationFailureReported: null,
    durationMs: input.wallClockMs,
    actions: [],
  });
}

function assemble(identity: RunEvaluationIdentity, outcome: RunOutcome): RunEvaluation {
  const evaluation: RunEvaluation = {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    runId: outcome.runId,
    verdict: outcome.verdict,
    ...(outcome.failureCategory === undefined ? {} : { failureCategory: outcome.failureCategory }),
    invariants: outcome.invariants,
    metrics: outcome.metrics,
    scenarioId: identity.scenarioId,
    workflowId: identity.workflowId,
    variantId: identity.variantId,
    repeatIndex: identity.repeatIndex,
    lane: "recording",
    flowCreated: null,
    oracleVerdict: outcome.oracleVerdict,
    reportedVerdict: outcome.reportedVerdict,
    automationFailureReported: outcome.automationFailureReported,
    automationFailureExpected: identity.expectedFailure,
    harnessActivations: 0,
    durationMs: outcome.durationMs,
    actions: outcome.actions,
    evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 },
    llm: { mode: "disabled", profileId: null, calls: 0 },
    harnessRecovery: null,
    adaptationCost: null,
    adaptationValidation: null,
    adaptationPersistence: null,
    adaptationReuse: null,
  };
  assertRunEvaluation(evaluation);
  return evaluation;
}

/**
 * FluxIQ's verdict from the actions it executed. `automationFailure` absent
 * means the lane could not observe one, and no action means FluxIQ ran
 * nothing: both leave the verdict unknown.
 *
 * `failure.code` is a web-automation failure code from
 * `domain/src/runtime/failure/codes.ts` and is reported as observed. It is not
 * checked against that closed set: the domain package cannot be imported here
 * (see `reports/w3-runner-alignment.md`), and inventing a second copy of the
 * set to check it against is the drift this alignment exists to remove.
 */
function reportedOutcome(manifest: RunManifest | undefined): { verdict: RunEvaluation["reportedVerdict"]; failure: RunEvaluation["automationFailureReported"] } {
  const actions = manifest?.actions ?? [];
  const failure = manifest?.automationFailure;
  if (actions.length === 0 || failure === undefined) return { verdict: null, failure: null };
  if (failure) return { verdict: "failed", failure: { category: failure.category, ...(failure.code === undefined ? {} : { code: failure.code }) } };
  if (actions.every((action) => action.status === "succeeded")) return { verdict: "passed", failure: null };
  return { verdict: "failed", failure: { category: "ambiguous_or_unknown" } };
}

function runDurationMs(manifest: RunManifest | undefined): number | undefined {
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
