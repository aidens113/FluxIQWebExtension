import { EVALUATION_SCHEMA_VERSION, assertRunEvaluation, type ExpectedFailure, type RunEvaluation, type RunEvidenceSizes } from "@fluxiq-web-extension/test-contracts";
import type { RunLaneObservation } from "../flow-lane/index.js";
import type { RunOutcome } from "./run-outcome.js";

/** Which run an evaluation describes, and the failure it was planned to expect. */
export type RunEvaluationIdentity = {
  scenarioId: string;
  workflowId: string | null;
  variantId: string | null;
  /** 0 for a single run and for the first run of a repeat series. */
  repeatIndex: number;
  /** The resolved workflow's `expected.failure`, as the caller planned it. */
  expectedFailure: ExpectedFailure | null;
};

export type ObservedRun = {
  identity: RunEvaluationIdentity;
  /** How the run fared as a test. */
  outcome: RunOutcome;
  /**
   * What the run's lane observed about the automation. Every automation field
   * of the evaluation is taken from here and derived nowhere else, so the only
   * question a caller has to answer is which observation is the true one.
   *
   * `automationFailureExpected` on the observation is the lane's own copy and
   * is deliberately not read: the evaluation scores against
   * `identity.expectedFailure`, which for the bench is the corpus plan's
   * resolved `expected.failure` rather than the lane's.
   */
  observation: RunLaneObservation;
  /**
   * The sizes of the evidence the run's lane measured, when it measured any.
   * Both Flow-lane producers pass them, read by `flowLaneEvidenceSizes` from
   * the bundle's `snapshots/flow-lane.json`: the bench's
   * (`bench/evaluate-run.ts`) and a single `lab run` (`single-run-evaluation.ts`).
   * A recording-lane run contributes none: absent, both lists are empty and the
   * truncation count is 0.
   */
  evidence?: RunEvidenceSizes;
};

/**
 * The one place a `RunEvaluation` is assembled and validated. Both producers
 * go through it — `lab bench`, per corpus run, and `lab run`, once — so the
 * field set, the Week 1 defaults, and the contract check cannot drift apart
 * between a single run and a bench row.
 *
 * What the two callers may still differ on is the `RunLaneObservation` and the
 * evidence sizes they hand it. `lab run` passes the observation the lane
 * published. The bench's recording lane passes a substitute derived from the
 * persisted run manifest, because its eight historical reports were measured
 * that way. The evidence sizes do not differ: both producers' Flow lanes read
 * them from the run bundle through `flowLaneEvidenceSizes`. See
 * `bench/evaluate-run.ts`.
 */
export function evaluateObservedRun(input: ObservedRun): RunEvaluation {
  const { identity, outcome, observation, evidence } = input;
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
    lane: observation.lane,
    flowCreated: observation.flowCreated,
    oracleVerdict: observation.oracleVerdict,
    reportedVerdict: observation.reportedVerdict,
    automationFailureReported: observation.automationFailureReported,
    automationFailureExpected: identity.expectedFailure,
    harnessActivations: observation.harnessActivations,
    durationMs: outcome.durationMs,
    actions: [...observation.actions],
    // A recording-lane run contributes no evidence sizes: it runs no Flow, so
    // Core captured no sanitized packet, and it passes none. `rawSnapshotBytes`
    // is empty on every lane, because no producer measures raw snapshots and
    // they are not a Week 1 metric.
    evidence: evidence
      ? { sanitizedPacketBytes: [...evidence.sanitizedPacketBytes], rawSnapshotBytes: [...evidence.rawSnapshotBytes], truncationCount: evidence.truncationCount }
      : { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 },
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
