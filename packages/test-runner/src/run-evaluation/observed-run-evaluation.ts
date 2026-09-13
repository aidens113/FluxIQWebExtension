import { EVALUATION_SCHEMA_VERSION, assertRunEvaluation, type ExpectedFailure, type InvariantResult, type RunEvaluation } from "@fluxiq-web-extension/test-contracts";
import type { RunLaneObservation } from "../flow-lane/index.js";
import { evidenceBudgetInvariant } from "./evidence-budget-invariant.js";
import type { FlowLaneEvidence } from "./flow-lane-evidence-sizes.js";
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
   * The sizes of the evidence the run's lane measured, when it measured any,
   * with the located packets they came from. Both Flow-lane producers pass
   * them, read by `flowLaneEvidenceSizes` from the bundle's
   * `snapshots/flow-lane.json`: the bench's (`bench/evaluate-run.ts`) and a
   * single `lab run` (`single-run-evaluation.ts`). A recording-lane run
   * contributes none: absent, both lists are empty, the truncation count is 0,
   * and no budget invariant is added.
   */
  evidence?: FlowLaneEvidence;
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
 *
 * Measured packets are also judged against their budget here
 * (`evidenceBudgetInvariant`), so a packet over it fails the run and its bench
 * row alike.
 */
export function evaluateObservedRun(input: ObservedRun): RunEvaluation {
  const { identity, outcome, observation, evidence } = input;
  const judged = withEvidenceBudget(outcome, evidence ? evidenceBudgetInvariant(evidence.packets) : undefined);
  const evaluation: RunEvaluation = {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    runId: outcome.runId,
    verdict: judged.verdict,
    ...(judged.failureCategory === undefined ? {} : { failureCategory: judged.failureCategory }),
    invariants: judged.invariants,
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
    // they are not a Week 1 metric. Only the contract's fields are copied.
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

/**
 * The run-as-a-test judgement with the evidence budget's invariant added, when
 * there is one. A breach fails a run the runner passed, as `performance.budget`,
 * because the contract refuses a passed verdict beside a failed invariant. A run
 * the runner already failed, or could not judge, keeps its verdict and category
 * and still records the breach.
 */
function withEvidenceBudget(outcome: RunOutcome, budget: InvariantResult | undefined): Pick<RunOutcome, "verdict" | "failureCategory" | "invariants"> {
  if (budget === undefined) return outcome;
  const invariants = [...outcome.invariants, budget];
  if (budget.passed || outcome.verdict !== "passed") return { ...outcome, invariants };
  return { verdict: "failed", failureCategory: "performance.budget", invariants };
}
