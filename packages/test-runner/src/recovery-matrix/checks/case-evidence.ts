// Everything a matrix case's verdict is judged from, gathered once after the
// run: the run's status and failure, its attempts in closed records, the saved
// Flow's step map, what the site received, whether the scenario's goal held on
// the page, and Core's own account of model calls.

import type { MatrixFlowStep } from "../compile/index.js";
import type { RecoveryExecutorFeature } from "../matrix-row.js";
import type { MatrixAttemptRecord, SiteReading } from "../records/index.js";

export type MatrixCaseEvidence = Readonly<{
  /**
   * `failure` is the failed attempt's own failure; `stopCode` the run's own stop
   * code from its run detail (`run-stop-code.ts`), null when Core recorded none.
   */
  run: Readonly<{ status: "succeeded" | "failed" | "cancelled" | "unknown"; failure: Readonly<{ category: string; code: string | null }> | null; stopCode: string | null }>;
  attempts: readonly MatrixAttemptRecord[];
  steps: readonly MatrixFlowStep[];
  /** The key of the Subflow the Router runs when no situation block applies: where a cold start begins. */
  primarySubflowKey: string;
  site: SiteReading;
  /** The scenario's playback goal facts on the page after the run; `null` when the case does not judge by them. */
  goalHeld: boolean | null;
  /** Core's accounting: provider calls, interventions and harness activations; `null` where Core published none. */
  model: Readonly<{ calls: number | null; interventions: number | null; harnessActivations: number }>;
  /** Whether the case's perturbation fired; `null` for a case without one. */
  faultFired: boolean | null;
}>;

export type MatrixVerdict = "passed" | "failed" | "not-proven";

export type MatrixCheckResult = Readonly<{
  verdict: MatrixVerdict;
  /** Why the case did not pass, in closed sentences; empty when it passed. */
  reasons: readonly string[];
  /** The executor records the proof needs that the run did not write, when the verdict is `not-proven`. */
  missingRecords: readonly RecoveryExecutorFeature[];
  observed: Readonly<Record<string, unknown>>;
}>;

/** The step a run's attempt was on: the saved node id ends `.<subflowKey>.<nodeKey>`. */
export function stepOfNode(steps: readonly MatrixFlowStep[], nodeId: string | null): MatrixFlowStep | undefined {
  if (nodeId === null) return undefined;
  return steps.find(step => nodeId.endsWith(`.${step.subflowKey}.${step.nodeKey}`));
}

/** The primary Subflow's first step, where a cold start begins. */
export function firstPrimaryStep(steps: readonly MatrixFlowStep[], primaryKey: string): MatrixFlowStep | undefined {
  return steps.find(step => step.subflowKey === primaryKey);
}

/**
 * The gate every case passes first: Core accounted zero provider calls, zero
 * interventions and zero harness activations. A count Core did not publish is
 * not zero, so it fails the case as unknown rather than passing it.
 */
export function modelGateReasons(model: MatrixCaseEvidence["model"]): string[] {
  const reasons: string[] = [];
  if (model.calls === null) reasons.push("Core published no provider-call accounting for the run, so zero calls is not shown");
  else if (model.calls !== 0) reasons.push(`Core accounted ${model.calls} model provider call(s) to the run`);
  if (model.interventions !== null && model.interventions !== 0) reasons.push(`Core recorded ${model.interventions} model intervention(s)`);
  if (model.harnessActivations !== 0) reasons.push(`Core's recovery harness activated ${model.harnessActivations} time(s)`);
  return reasons;
}
