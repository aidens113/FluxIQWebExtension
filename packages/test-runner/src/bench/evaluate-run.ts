import { EVALUATION_SCHEMA_VERSION, assertRunEvaluation, failureCategories, type EvaluationLane, type ExpectedFailure, type FailureCategory, type RunEvaluation, type RunManifest } from "@fluxiq-web-extension/test-contracts";
import { classifyRunnerFailure } from "../failure.js";
import type { RunLaneObservation } from "../flow-lane/index.js";

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

/**
 * Where each Flow-lane measurement comes from. Unlike the recording lane, this
 * lane does not re-derive anything: `runScenario` publishes a
 * `RunLaneObservation` from the Flow it built and ran, and the bench reports
 * that. An attempt that failed before the Flow lane was reached publishes a
 * recording-lane observation or none, and is reported as `flowCreated: false`
 * with nothing executed.
 */
export const FLOW_LANE_SOURCES = {
  verdict: "the runner's verdict from runScenario",
  oracleVerdict: "the Flow lane's own observation: whether the workflow's expected final state held after the generated Flow ran; null when no Flow ran, so the oracle was not consulted",
  reportedVerdict: "the persisted Core run's status and its actions[].status; null when recording, proposal, or approval produced no runnable Flow, so FluxIQ executed nothing",
  flowCreated: "whether recording, proposal, and approval produced a runnable Flow; false when the run failed before the Flow lane was reached",
  harnessActivations: "the persisted Core run's harness activations",
  durationMs: "run.json finishedAt minus startedAt; the bench's wall clock when run.json is unreadable",
  actionLatency: "the persisted Core run's actions[].durationMs; an unfinished action has none and is left out",
  evidenceSizes: "none: no lane populates sanitized packet or raw snapshot sizes, so both lists are empty and truncationCount is 0",
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

/** A Flow-lane run, whose runner result carries the lane's own observation of what the Flow did. */
export type FlowRunInput = Omit<RecordingRunInput, "result"> & {
  result: RecordingRunInput["result"] & { observation?: RunLaneObservation };
};

type RunOutcome = Pick<RunEvaluation, "runId" | "verdict" | "invariants" | "metrics" | "lane" | "flowCreated" | "oracleVerdict" | "reportedVerdict" | "automationFailureReported" | "harnessActivations" | "durationMs" | "actions"> & { failureCategory?: FailureCategory };

/** A recording-lane run's `RunEvaluation`, validated, from its runner result and bundle. */
export function evaluateRecordingRun(input: RecordingRunInput): RunEvaluation {
  const passed = input.result.verdict === "passed";
  const category = passed ? undefined : testRigCategory(input.result.failureCategory);
  const reported = reportedOutcome(input.manifest);
  return assemble(input, {
    ...common(input, passed, category),
    lane: "recording",
    flowCreated: null,
    oracleVerdict: passed ? "passed" : category === "runtime.behavior" ? "failed" : null,
    reportedVerdict: reported.verdict,
    automationFailureReported: reported.failure,
    harnessActivations: 0,
    actions: (input.manifest?.actions ?? []).flatMap((action) => action.durationMs === undefined ? [] : [{ actionType: action.actionType, durationMs: action.durationMs }]),
  });
}

/**
 * A Flow-lane run's `RunEvaluation`, from the lane's own observation rather
 * than from an inference over the run manifest: only the lane knows whether a
 * Flow was created, what the persisted Core run reported, and whether the
 * fixture oracle was consulted after it.
 *
 * A run planned on this lane that failed before the Flow lane was reached
 * publishes a recording-lane observation, or none at all. It is still reported
 * as a Flow-lane run — `flowCreated: false`, nothing executed — because that
 * is what happened: Flow creation is precisely what did not occur, and
 * `flowCreationSuccess` must count it as a miss rather than lose it.
 */
export function evaluateFlowRun(input: FlowRunInput): RunEvaluation {
  const passed = input.result.verdict === "passed";
  const category = passed ? undefined : testRigCategory(input.result.failureCategory);
  const observed = input.result.observation?.lane === "flow" ? input.result.observation : undefined;
  return assemble(input, {
    ...common(input, passed, category),
    lane: "flow",
    flowCreated: observed?.flowCreated ?? false,
    oracleVerdict: observed?.oracleVerdict ?? null,
    reportedVerdict: observed?.reportedVerdict ?? null,
    automationFailureReported: observed?.automationFailureReported ?? null,
    harnessActivations: observed?.harnessActivations ?? 0,
    actions: observed ? [...observed.actions] : [],
  });
}

/** An attempt whose runner threw before finalizing a bundle: inconclusive, since nothing about the automation was observed. */
export function evaluateFailedAttempt(input: RunEvaluationIdentity & { lane: EvaluationLane; attemptId: string; error: unknown; wallClockMs: number }): RunEvaluation {
  const category = classifyRunnerFailure(input.error);
  return assemble(input, {
    runId: input.attemptId,
    verdict: "inconclusive",
    failureCategory: category,
    invariants: [{ id: RUNNER_VERDICT, passed: false, expected: "passed", actual: `runner threw before finalizing a bundle: ${category}`, evidenceSequences: [] }],
    metrics: {},
    lane: input.lane,
    flowCreated: input.lane === "flow" ? false : null,
    oracleVerdict: null,
    reportedVerdict: null,
    automationFailureReported: null,
    harnessActivations: 0,
    durationMs: input.wallClockMs,
    actions: [],
  });
}

/** The run-as-a-test half both lanes share: the runner's verdict, its test-rig category, and the evidence event that closed it. */
function common(input: RecordingRunInput, passed: boolean, category: FailureCategory | undefined): Pick<RunOutcome, "runId" | "verdict" | "failureCategory" | "invariants" | "metrics" | "durationMs"> {
  const closing = passed ? input.finalSequence : input.errorSequence;
  return {
    runId: input.result.runId,
    verdict: input.result.verdict,
    ...(category === undefined ? {} : { failureCategory: category }),
    invariants: [{ id: RUNNER_VERDICT, passed, expected: "passed", actual: passed ? "passed" : `failed: ${category}`, evidenceSequences: closing === undefined ? [] : [closing] }],
    metrics: { ...input.metrics },
    durationMs: runDurationMs(input.manifest) ?? input.wallClockMs,
  };
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
    lane: outcome.lane,
    flowCreated: outcome.flowCreated,
    oracleVerdict: outcome.oracleVerdict,
    reportedVerdict: outcome.reportedVerdict,
    automationFailureReported: outcome.automationFailureReported,
    // The corpus plan's resolved `expected.failure`, not the lane's copy of
    // it: what the bench planned to require is what classification accuracy is
    // scored against.
    automationFailureExpected: identity.expectedFailure,
    harnessActivations: outcome.harnessActivations,
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
 * checked against that closed set. The domain is importable here now, so this
 * is a choice rather than a limitation: a bench run reports what the automation
 * said it was, and narrowing an observed code to a known set at this point would
 * hide exactly the drift a bench exists to measure.
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
