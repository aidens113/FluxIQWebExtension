import { failureCategories, type EvaluationLane, type FailureCategory, type RunEvaluation, type RunManifest } from "@fluxiq-web-extension/test-contracts";
import { classifyRunnerFailure } from "../failure.js";
import type { RunLaneObservation } from "../flow-lane/index.js";
import { evaluateObservedRun, flowLaneEvidenceSizes, runOutcome, type RunEvaluationIdentity, type RunOutcome } from "../run-evaluation/index.js";

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
  evidenceSizes: "none: the recording lane runs no Flow, so Core captures no sanitized packet for it; sanitizedPacketBytes is empty and truncationCount is 0. rawSnapshotBytes is empty on every lane: no producer measures raw snapshots, and they are not a Week 1 metric",
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
  evidenceSizes: "the run bundle's snapshots/flow-lane.json actions[].evidencePackets: sanitizedPacketBytes holds the UTF-8 size of each state-snapshot packet Core captured before and after a web action attempt, one entry per measured packet, and truncationCount counts those the domain trimmed. The failure packet is not in Core's run detail and is not measured. Both are empty and 0 when that file is absent, which is a run in which no Flow ran, and also when it is unreadable. rawSnapshotBytes is empty: no producer measures raw snapshots, and they are not a Week 1 metric. A measured packet over the domain's exploration budget fails the run's evidence-packet-budget invariant",
  llm: "disabled: Week 1 benches run provider-free",
} as const;

const RUNNER_VERDICT = "runner-verdict";

/** Which run of the corpus an evaluation describes; owned by `run-evaluation`, which both producers share. */
export type { RunEvaluationIdentity } from "../run-evaluation/index.js";

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

/**
 * A Flow-lane run, whose runner result carries the lane's own observation of
 * what the Flow did and the path of the bundle it finalized, from which the
 * evidence sizes are read.
 */
export type FlowRunInput = Omit<RecordingRunInput, "result"> & {
  result: RecordingRunInput["result"] & { path: string; observation?: RunLaneObservation };
};

/**
 * A recording-lane run's `RunEvaluation`, validated, from its runner result and bundle.
 *
 * It contributes no evidence sizes: the recording lane runs no Flow, so Core
 * captured no sanitized packet for it, and `evaluateObservedRun` records empty
 * lists and a truncation count of 0.
 */
export function evaluateRecordingRun(input: RecordingRunInput): RunEvaluation {
  return evaluateObservedRun({ identity: input, outcome: outcomeOf(input), observation: benchRecordingObservation(input) });
}

/**
 * A Flow-lane run's `RunEvaluation`, from the lane's own observation rather
 * than from an inference over the run manifest: only the lane knows whether a
 * Flow was created, what the persisted Core run reported, and whether the
 * fixture oracle was consulted after it.
 *
 * A run planned on this lane that failed before the Flow lane was reached
 * publishes a recording-lane observation, or none at all. It is still reported
 * as a Flow-lane run -- `flowCreated: false`, nothing executed -- because that
 * is what happened: Flow creation is precisely what did not occur, and
 * `flowCreationSuccess` must count it as a miss rather than lose it.
 */
export function evaluateFlowRun(input: FlowRunInput): RunEvaluation {
  const observed = input.result.observation?.lane === "flow" ? input.result.observation : undefined;
  return evaluateObservedRun({
    identity: input,
    outcome: outcomeOf(input),
    observation: {
      lane: "flow",
      flowCreated: observed?.flowCreated ?? false,
      oracleVerdict: observed?.oracleVerdict ?? null,
      reportedVerdict: observed?.reportedVerdict ?? null,
      automationFailureReported: observed?.automationFailureReported ?? null,
      automationFailureExpected: input.expectedFailure,
      harnessActivations: observed?.harnessActivations ?? 0,
      actions: observed ? [...observed.actions] : [],
    },
    evidence: flowLaneEvidenceSizes(input.result.path),
  });
}

/** An attempt whose runner threw before finalizing a bundle: inconclusive, since nothing about the automation was observed. */
export function evaluateFailedAttempt(input: RunEvaluationIdentity & { lane: EvaluationLane; attemptId: string; error: unknown; wallClockMs: number }): RunEvaluation {
  const category = classifyRunnerFailure(input.error);
  return evaluateObservedRun({
    identity: input,
    outcome: {
      runId: input.attemptId,
      verdict: "inconclusive",
      failureCategory: category,
      invariants: [{ id: RUNNER_VERDICT, passed: false, expected: "passed", actual: `runner threw before finalizing a bundle: ${category}`, evidenceSequences: [] }],
      metrics: {},
      durationMs: input.wallClockMs,
    },
    observation: {
      lane: input.lane,
      flowCreated: input.lane === "flow" ? false : null,
      oracleVerdict: null,
      reportedVerdict: null,
      automationFailureReported: null,
      automationFailureExpected: input.expectedFailure,
      harnessActivations: 0,
      actions: [],
    },
  });
}

/** The run-as-a-test half, judged by the rule a single `lab run` also uses. */
const outcomeOf = (input: RecordingRunInput): RunOutcome => runOutcome({
  runId: input.result.runId,
  verdict: input.result.verdict,
  failureCategory: input.result.failureCategory,
  metrics: input.metrics,
  manifest: input.manifest,
  wallClockMs: input.wallClockMs,
  finalSequence: input.finalSequence,
  errorSequence: input.errorSequence,
});

/**
 * The recording-lane observation **the bench uses**: derived from the
 * persisted run manifest rather than taken from the observation `runScenario`
 * publishes. This is the single place the two producers of a `RunEvaluation`
 * differ, and it is deliberate.
 *
 * Two of its three observed fields agree with the lane by construction.
 * `reportedVerdict` and `automationFailureReported` are read from the same
 * actions and the same `automationFailure` the lane saw, after a round trip
 * through `run.json`.
 *
 * `oracleVerdict` does not agree. The bench infers it from the runner's
 * verdict and its test-rig category, and that inference cannot tell a fixture
 * that disagreed from a rig that broke after the oracle had already passed: a
 * disallowed console error, a network-policy violation, and the Core probe's
 * page-state check all raise `runtime.behavior` after `assertFinalState`
 * succeeded, and all are read here as an oracle failure. The lane publishes
 * the oracle's real verdict and would say `passed`.
 *
 * The inference stays because eight bench reports on disk were measured with
 * it and have to remain comparable; correcting it moves `falseFailure` and
 * `falseSuccess`, which is a deliberate bench change rather than a refactor.
 * Until it is made, a single `lab run` is the more honest of the two, and
 * `run-evaluation/tests/bench-parity.test.ts` pins exactly where they part.
 */
function benchRecordingObservation(input: RecordingRunInput): RunLaneObservation {
  const passed = input.result.verdict === "passed";
  const category = passed ? undefined : testRigCategory(input.result.failureCategory);
  const reported = reportedOutcome(input.manifest);
  return {
    lane: "recording",
    flowCreated: null,
    oracleVerdict: passed ? "passed" : category === "runtime.behavior" ? "failed" : null,
    reportedVerdict: reported.verdict,
    automationFailureReported: reported.failure,
    automationFailureExpected: input.expectedFailure,
    harnessActivations: 0,
    actions: (input.manifest?.actions ?? []).flatMap((action) => action.durationMs === undefined ? [] : [{ actionType: action.actionType, durationMs: action.durationMs }]),
  };
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

/**
 * The test-rig coercion, kept here only to reproduce the oracle-verdict
 * inference above. `runOutcome` applies the same rule to
 * `RunEvaluation.failureCategory`; this copy exists because the inference
 * needs the coerced category before the outcome is built, and it is the one
 * thing that must not follow if that rule ever changes -- the inference has to
 * keep reading exactly what the eight historical reports were measured with.
 */
function testRigCategory(value: string | undefined): FailureCategory {
  return value !== undefined && (failureCategories as readonly string[]).includes(value) ? value as FailureCategory : "unknown";
}
