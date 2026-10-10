// One check per required behaviour of the acceptance matrix, each judged from
// the run's own records (`case-evidence.ts`), never from what the runner did.
//
// Every check starts from the same floor: zero model calls as Core accounted
// them, and the site's acts as expected (`../records/site-state.ts`). On top of
// that each asks for the record that shows its behaviour. A check whose record
// Core did not write at all says `not-proven` and names the executor capability
// that writes it: a run that happened to do the right thing without the
// mechanism the row is about has proven nothing about the mechanism.

import type { RecoveryCheckId, RecoveryExecutorFeature, RecoveryMatrixCase } from "../matrix-row.js";
import type { MatrixAttemptRecord } from "../records/index.js";
import { firstPrimaryStep, modelGateReasons, stepOfNode, type MatrixCaseEvidence, type MatrixCheckResult } from "./case-evidence.js";

type Check = (evidence: MatrixCaseEvidence, matrixCase: RecoveryMatrixCase) => MatrixCheckResult;

/** Each check, by the id a case names it with. */
export const MATRIX_CHECKS: Readonly<Record<RecoveryCheckId, Check>> = {
  "cold-start": coldStart,
  "eligible-entry": eligibleEntry,
  "shortcut-refused": shortcutRefused,
  "popup-handled": popupHandled,
  "popup-honest-end": popupHonestEnd,
  "handler-precedence": handlerPrecedence,
  "inactive-handler": inactiveHandler,
  "known-alternative": knownAlternative,
  "outcome-reconciled": outcomeReconciled,
  "checkpoint-route": checkpointRoute,
  "worker-restart": workerRestart,
  "retries-absorbed": retriesAbsorbed,
  "deliberate-stop": deliberateStop,
};

/** Row 1: the run began at the primary Subflow's first step, never jumped, and completed normally. */
function coldStart(evidence: MatrixCaseEvidence, matrixCase: RecoveryMatrixCase): MatrixCheckResult {
  const reasons = floor(evidence, matrixCase);
  succeeded(evidence, reasons);
  const first = evidence.attempts.find(attempt => attempt.nodeId !== null);
  const expected = firstPrimaryStep(evidence.steps, evidence.primarySubflowKey);
  const began = first ? stepOfNode(evidence.steps, first.nodeId) : undefined;
  if (!expected || began !== expected) reasons.push("the run's first attempt was not on the primary Subflow's first step");
  const entries = evidence.attempts.filter(attempt => attempt.entry !== null);
  if (entries.some(attempt => attempt.entry!.kind !== "default")) reasons.push("an entry record names an entry other than the default");
  const jumps = routed(evidence.attempts);
  if (jumps.length) reasons.push(`the run was routed by page state ${jumps.length} time(s) on a cold start`);
  return result(reasons, [], { firstStep: began?.nodeKey ?? null, entryRecord: entries[0]?.entry?.kind ?? "absent", stateRoutes: jumps.length });
}

/** Row 2: the run began at the eligible entry, past the step already done, with its inputs bound. */
function eligibleEntry(evidence: MatrixCaseEvidence, matrixCase: RecoveryMatrixCase): MatrixCheckResult {
  const reasons = floor(evidence, matrixCase);
  succeeded(evidence, reasons);
  const entry = evidence.attempts.find(attempt => attempt.entry !== null)?.entry ?? null;
  if (entry === null) return result(reasons, ["entries"], { entryRecord: "absent" });
  if (entry.kind === "default") reasons.push("the run began at the default entry although the page already showed the step done");
  if (matrixCase.skippedStep && evidence.attempts.some(attempt => stepOfNode(evidence.steps, attempt.nodeId)?.nodeKey === matrixCase.skippedStep)) reasons.push(`step ${matrixCase.skippedStep} ran although the entry starts past it`);
  if (refusals(evidence.attempts, "unbound_value").length) reasons.push("a way on was refused for an unbound input");
  return result(reasons, [], { entryRecord: entry.kind });
}

/** Row 3: on a page that looks right with the wrong filters, the shortcut entry was refused and the run took the default. */
function shortcutRefused(evidence: MatrixCaseEvidence, matrixCase: RecoveryMatrixCase): MatrixCheckResult {
  const reasons = floor(evidence, matrixCase);
  succeeded(evidence, reasons);
  const entry = evidence.attempts.find(attempt => attempt.entry !== null)?.entry ?? null;
  const firstStep = stepOfNode(evidence.steps, evidence.attempts.find(attempt => attempt.nodeId !== null)?.nodeId ?? null);
  const observed = { entryRecord: entry?.kind ?? "absent", firstStep: firstStep?.nodeKey ?? null, stateRoutes: routed(evidence.attempts).length };
  if (firstStep !== firstPrimaryStep(evidence.steps, evidence.primarySubflowKey)) reasons.push("the run did not begin at the first step: it took the shortcut");
  if (routed(evidence.attempts).length) reasons.push("the run was routed by page state onto a later step");
  if (entry === null) return result(reasons, ["entries"], observed);
  if (entry.kind !== "default") reasons.push(`the run began at entry kind ${entry.kind}, not the default`);
  return result(reasons, [], observed);
}

/** Row 4: a handler cleared the promotion and the run carried on at the step it interrupted. */
function popupHandled(evidence: MatrixCaseEvidence, matrixCase: RecoveryMatrixCase): MatrixCheckResult {
  const reasons = floor(evidence, matrixCase);
  succeeded(evidence, reasons);
  const handled = lifecycle(evidence.attempts).filter(record => record.event === "before" || record.event === "retry");
  if (!lifecycle(evidence.attempts).length) return result(reasons, ["handlers"], { handlerRuns: 0 });
  if (!handled.some(record => record.disposition === "resume" && record.completionCheck === "true")) reasons.push("no before or retry handler resumed with its completion check true");
  return result(reasons, [], { handlerRuns: handled.length });
}

/** Row 5: the promotion would not close; the handler ran within its budget and the run ended honestly with the declared failure. */
function popupHonestEnd(evidence: MatrixCaseEvidence, matrixCase: RecoveryMatrixCase): MatrixCheckResult {
  const reasons = floor(evidence, matrixCase);
  if (evidence.run.status !== "failed") reasons.push(`Core reported the run ${evidence.run.status}, not an honest failure`);
  const declared = matrixCase.declaredFailure;
  if (declared && (evidence.run.failure?.category !== declared.category || evidence.run.failure?.code !== declared.code)) reasons.push(`the run ended with ${evidence.run.failure?.category ?? "no failure"}/${evidence.run.failure?.code ?? "no code"}, not the declared ${declared.category}/${declared.code}`);
  const busiest = Math.max(0, ...attemptsPerNode(evidence.attempts).values());
  if (busiest > 4) reasons.push(`a node was attempted ${busiest} times, more than the first attempt and three retries`);
  const runs = lifecycle(evidence.attempts);
  if (!runs.length) return result(reasons, ["handlers"], { handlerRuns: 0, mostAttemptsOnANode: busiest });
  if (runs.length > 12) reasons.push(`handlers ran ${runs.length} times, past the run's budget of 12`);
  if (runs.some(record => record.completionCheck === "true")) reasons.push("a handler's completion check held although the promotion never closed");
  return result(reasons, [], { handlerRuns: runs.length, mostAttemptsOnANode: busiest });
}

/** Row 6: node and automation handlers both matched; the node's ran, and the automation's did not for that occurrence. */
function handlerPrecedence(evidence: MatrixCaseEvidence, matrixCase: RecoveryMatrixCase): MatrixCheckResult {
  const reasons = floor(evidence, matrixCase);
  succeeded(evidence, reasons);
  const runs = lifecycle(evidence.attempts);
  if (!runs.length) return result(reasons, ["handlers"], { handlerRuns: 0 });
  const first = runs[0]!;
  if (!matrixCase.expectHandler || !first.handlerId?.includes(`.${matrixCase.expectHandler}`)) reasons.push("the first handler to run was not the node-scoped one");
  return result(reasons, [], { handlerRuns: runs.length, firstHandler: first.handlerId });
}

/** Row 7: the inactive part's handler matched the page and was never run; the active part's handler shows dispatch happened. */
function inactiveHandler(evidence: MatrixCaseEvidence, matrixCase: RecoveryMatrixCase): MatrixCheckResult {
  const reasons = floor(evidence, matrixCase);
  succeeded(evidence, reasons);
  const runs = lifecycle(evidence.attempts);
  if (!runs.length) return result(reasons, ["handlers"], { handlerRuns: 0 });
  const quiet = matrixCase.quietSubflow;
  // A handler whose id cannot be read cannot be shown not to be the inactive part's: the check fails rather than pass on nothing (t404).
  if (runs.some(record => record.handlerId === null)) reasons.push("a handler ran whose id the run's records do not name, so the inactive part's handler cannot be ruled out");
  if (!quiet) reasons.push("the case names no inactive Subflow to watch");
  else if (runs.some(record => record.handlerId?.includes(`.${quiet}.`))) reasons.push(`a handler of the inactive part ${quiet} ran`);
  return result(reasons, [], { handlerRuns: runs.length });
}

/** Row 8: the primary way failed, a fail handler ran the alternative part and resolved, and the same success check held. */
function knownAlternative(evidence: MatrixCaseEvidence, matrixCase: RecoveryMatrixCase): MatrixCheckResult {
  const reasons = floor(evidence, matrixCase);
  succeeded(evidence, reasons);
  const runs = lifecycle(evidence.attempts).filter(record => record.event === "fail");
  if (!lifecycle(evidence.attempts).length) return result(reasons, ["handlers", "call-subflow"], { failHandlerRuns: 0 });
  if (!runs.some(record => record.disposition === "resolve")) reasons.push("no fail handler resolved the failed step with the alternative's outputs");
  if (!evidence.attempts.some(attempt => (attempt.framePath?.length ?? 0) > 1)) reasons.push("no attempt ran in a called part's frame");
  return result(reasons, [], { failHandlerRuns: runs.length });
}

/** Row 9: the acknowledgement of a committing act was lost; the act was reconciled, not repeated. */
function outcomeReconciled(evidence: MatrixCaseEvidence, matrixCase: RecoveryMatrixCase): MatrixCheckResult {
  const reasons = floor(evidence, matrixCase);
  if (evidence.faultFired !== true) reasons.push("the perturbation never fired, so no acknowledgement was lost");
  if (evidence.run.status !== "succeeded" && evidence.run.failure?.code?.endsWith("outcome_uncertain") !== true) reasons.push(`Core reported the run ${evidence.run.status} without an uncertain-outcome stop`);
  return result(reasons, [], { faultFired: evidence.faultFired });
}

/** Row 10: a handler routed the run back to a checkpoint and no completed confirmation was repeated. */
function checkpointRoute(evidence: MatrixCaseEvidence, matrixCase: RecoveryMatrixCase): MatrixCheckResult {
  const reasons = floor(evidence, matrixCase);
  succeeded(evidence, reasons);
  const runs = lifecycle(evidence.attempts);
  if (!runs.length) return result(reasons, ["handlers", "checkpoints"], { routes: 0 });
  const routes = runs.filter(record => record.disposition === "route");
  if (!routes.length) reasons.push("no handler routed the run to a checkpoint");
  return result(reasons, [], { routes: routes.length });
}

/** Row 11: the extension's worker was stopped mid-act; the act landed once and the run reached an honest end. */
function workerRestart(evidence: MatrixCaseEvidence, matrixCase: RecoveryMatrixCase): MatrixCheckResult {
  const reasons = floor(evidence, matrixCase);
  if (evidence.faultFired !== true) reasons.push("the perturbation never fired, so the worker was never stopped mid-act");
  if (evidence.run.status !== "succeeded" && evidence.run.failure?.code?.endsWith("outcome_uncertain") !== true) reasons.push(`Core reported the run ${evidence.run.status} without an uncertain-outcome stop`);
  return result(reasons, [], { faultFired: evidence.faultFired });
}

/** Row 13a: the site refused a press for going too fast; the node's retry absorbed it, the run succeeded, and nothing was a true failure. */
function retriesAbsorbed(evidence: MatrixCaseEvidence, matrixCase: RecoveryMatrixCase): MatrixCheckResult {
  const reasons = floor(evidence, matrixCase);
  succeeded(evidence, reasons);
  const retries = evidence.attempts.filter(attempt => attempt.retry).length;
  if (retries === 0) reasons.push("no attempt was a retry: the refusal the row is about was never met");
  return result(reasons, [], { retries });
}

/** Row 13b: a step failed, its authored failed path took the run to an End marked failed, and the run ended there with no model. */
function deliberateStop(evidence: MatrixCaseEvidence, matrixCase: RecoveryMatrixCase): MatrixCheckResult {
  const reasons = floor(evidence, matrixCase);
  if (evidence.run.status !== "failed") reasons.push(`Core reported the run ${evidence.run.status}, not the authored stop`);
  const last = [...evidence.attempts].reverse().find(attempt => attempt.nodeId !== null);
  const lastStep = last ? stepOfNode(evidence.steps, last.nodeId) : undefined;
  if (lastStep?.endStatus !== "failed") reasons.push("the run's last attempt was not on the End the Flow marked failed");
  const failedSteps = new Set(evidence.attempts.filter(attempt => attempt.status === "failed").map(attempt => stepOfNode(evidence.steps, attempt.nodeId)?.nodeKey).filter(key => key !== undefined));
  if (!failedSteps.size) reasons.push("no step failed, so no failed path was taken");
  return result(reasons, [], { lastStep: lastStep?.nodeKey ?? null, failedSteps: [...failedSteps] });
}

/** The floor every case is held to: zero model calls, and the site's acts as expected. The goal facts where the case judges by them. */
function floor(evidence: MatrixCaseEvidence, matrixCase: RecoveryMatrixCase): string[] {
  const reasons = modelGateReasons(evidence.model);
  reasons.push(...evidence.site.reasons);
  if (matrixCase.goalFacts && evidence.goalHeld !== true) reasons.push("the scenario's goal facts did not hold on the page after the run");
  return reasons;
}

function succeeded(evidence: MatrixCaseEvidence, reasons: string[]): void {
  if (evidence.run.status !== "succeeded") reasons.push(`Core reported the run ${evidence.run.status}${evidence.run.failure ? ` with ${evidence.run.failure.category}/${evidence.run.failure.code ?? "no code"}` : ""}`);
}

function lifecycle(attempts: readonly MatrixAttemptRecord[]) {
  return attempts.flatMap(attempt => (attempt.lifecycle ? [attempt.lifecycle] : []));
}

function routed(attempts: readonly MatrixAttemptRecord[]) {
  return attempts.filter(attempt => attempt.stateRouting?.outcome === "routed" || attempt.stateRouting?.outcome === "effect_holds");
}

function refusals(attempts: readonly MatrixAttemptRecord[], guard: string) {
  return attempts.flatMap(attempt => attempt.stateRouting?.refused.filter(refusal => refusal.guard === guard) ?? []);
}

function attemptsPerNode(attempts: readonly MatrixAttemptRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const attempt of attempts) if (attempt.nodeId !== null) counts.set(attempt.nodeId, (counts.get(attempt.nodeId) ?? 0) + 1);
  return counts;
}

/**
 * The verdict: `not-proven` when the record the behaviour needs was never
 * written (the other reasons are kept, since a failure is a failure either
 * way), `failed` on any reason, `passed` otherwise.
 */
function result(reasons: readonly string[], missing: readonly RecoveryExecutorFeature[], observed: Readonly<Record<string, unknown>>): MatrixCheckResult {
  const verdict = reasons.length ? "failed" : missing.length ? "not-proven" : "passed";
  return { verdict, reasons: [...reasons], missingRecords: [...missing], observed };
}
