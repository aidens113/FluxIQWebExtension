// The plan's measures for one case ("Measures per round"), counted from the
// run's own records and the site's state.
//
// An incident is a node that met a failure or a retry. It closed without a
// model when the run went on past it (its last attempt succeeded, or a later
// attempt ran on another node: a planned fail) with no provider call. A true
// failure is the plan's (Core document C6): retries spent and no path on, so
// the run ended on that node's failed attempt, and not at an End the Flow
// marked failed. Retries and planned fails are counted apart from it.
//
// Three measures cannot be read off a provider-free run and say so: an in-run
// fix needs a model, as does an escalation, and a hand-authored Flow cost
// nothing to learn. Handler-check overhead needs per-boundary timings, which
// the trace contract does not carry; it is `null` until it does.

import type { MatrixCaseEvidence } from "./checks/index.js";
import { stepOfNode } from "./checks/index.js";

export type MatrixCaseMeasures = Readonly<{
  incidents: number;
  closedWithoutModel: number;
  /** `closedWithoutModel / incidents`; `null` for a run that met no incident. */
  deterministicRecoveryRate: number | null;
  retries: number;
  plannedFails: number;
  trueFailures: number;
  modelCalls: number | null;
  /** `modelCalls / trueFailures`; `null` with no true failure. */
  modelCallsPerTrueFailure: number | null;
  /** Always 0 provider-free: an in-run fix is a model's. */
  carriedOnAfterInRunFix: 0;
  /** Always 0 provider-free: there is no escalation to avoid. */
  escalationsAHandlerCouldHaveAvoided: 0;
  /** State routes taken (a cold start or an ordinary run should take none). */
  stateRoutes: number;
  duplicatedActs: number;
  /** 1 when Core reported success and the site or the goal says otherwise. */
  falseSuccesses: 0 | 1;
  /** A hand-authored Flow learned nothing: 0 dollars. */
  learningCostUsd: 0;
  handlerCheckOverheadMs: number | null;
}>;

export function matrixCaseMeasures(evidence: MatrixCaseEvidence): MatrixCaseMeasures {
  const attempts = evidence.attempts.filter(attempt => attempt.nodeId !== null);
  const byNode = new Map<string, number[]>();
  attempts.forEach((attempt, index) => byNode.set(attempt.nodeId!, [...(byNode.get(attempt.nodeId!) ?? []), index]));
  let incidents = 0;
  let closed = 0;
  let planned = 0;
  let trueFailures = 0;
  for (const indexes of byNode.values()) {
    const own = indexes.map(index => attempts[index]!);
    // An End the Flow marked failed ends the run as authored; reaching it is not an incident.
    if (stepOfNode(evidence.steps, own[0]!.nodeId)?.endStatus !== undefined) continue;
    if (!own.some(attempt => attempt.status === "failed" || attempt.retry)) continue;
    incidents += 1;
    const lastIndex = indexes[indexes.length - 1]!;
    const last = attempts[lastIndex]!;
    const movedOn = lastIndex < attempts.length - 1;
    if (last.status === "failed" && movedOn) planned += 1;
    const endedHere = last.status === "failed" && !movedOn && stepOfNode(evidence.steps, last.nodeId)?.endStatus !== "failed";
    if (endedHere) trueFailures += 1;
    else if (evidence.model.calls === 0) closed += 1;
  }
  const calls = evidence.model.calls;
  const goalBroken = evidence.goalHeld === false;
  return {
    incidents,
    closedWithoutModel: closed,
    deterministicRecoveryRate: incidents ? closed / incidents : null,
    retries: attempts.filter(attempt => attempt.retry).length,
    plannedFails: planned,
    trueFailures,
    modelCalls: calls,
    modelCallsPerTrueFailure: trueFailures && calls !== null ? calls / trueFailures : null,
    carriedOnAfterInRunFix: 0,
    escalationsAHandlerCouldHaveAvoided: 0,
    stateRoutes: attempts.filter(attempt => attempt.stateRouting?.outcome === "routed" || attempt.stateRouting?.outcome === "effect_holds").length,
    duplicatedActs: evidence.site.duplicatedActs,
    falseSuccesses: evidence.run.status === "succeeded" && (!evidence.site.held || goalBroken) ? 1 : 0,
    learningCostUsd: 0,
    handlerCheckOverheadMs: null,
  };
}
