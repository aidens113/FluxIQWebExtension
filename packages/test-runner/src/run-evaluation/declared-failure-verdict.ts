import type { ExpectedFailure, FailureCategory, RunEvaluation } from "@fluxiq-web-extension/test-contracts";
import { RUNNER_VERDICT_INVARIANT, type RunOutcome } from "./run-outcome.js";

/**
 * The test-rig categories a declared failure speaks for: the ones raised
 * because an action did not succeed.
 *
 * A scenario or variant that declares `expected.failure` is asking the
 * automation to refuse. Its expectations are still written for the workflow it
 * was recorded from -- `member-directory`'s `member-left` variant inherits
 * `expected.actions: [{ web.dom.click, succeeded }]` from the workflow it
 * arms -- so the run that refuses correctly fails `assertFlowActions` with
 * `action.dispatch` and reads as broken. That is the one judgement the
 * declaration replaces.
 *
 * Every other category is deliberately outside the set. A negative variant
 * still has to leave the page as it declares (`runtime.behavior`, and the
 * oracle below), still may not leak a secret (`security.redaction`), and still
 * needs a recording, an extension and a gateway that work. A declaration says
 * the automation must refuse; it does not say the rest of the run may break.
 */
const ACTION_OUTCOME_CATEGORIES: ReadonlySet<FailureCategory> = new Set<FailureCategory>(["action.dispatch", "action.targeting"]);

export type DeclaredFailureInput = {
  /** The resolved workflow's `expected.failure`; `null` for a scenario that declares none. */
  expected: ExpectedFailure | null;
  /** The failure FluxIQ reported for the automation, as the lane observed it. */
  reported: RunEvaluation["automationFailureReported"];
  /** The fixture oracle's verdict, which a declared failure never overrides; `null` when it was not consulted. */
  oracleVerdict: RunEvaluation["oracleVerdict"];
  /** The run's facility diagnostic; a run the rig broke says nothing about the refusal. */
  facilityFailure: RunEvaluation["facilityFailure"];
  /** The run-as-a-test judgement as the runner made it. */
  outcome: RunOutcome;
};

/** Whether the run reported exactly the declared failure: the same category, and the same code when one is declared. */
export function reportsDeclaredFailure(expected: ExpectedFailure, reported: RunEvaluation["automationFailureReported"]): boolean {
  if (reported === null || reported.category !== expected.category) return false;
  return expected.code === undefined || reported.code === expected.code;
}

/**
 * The run-as-a-test judgement of a run whose scenario declared the failure it
 * must report: it passes by reporting exactly that failure, and fails by
 * reporting a different one, reporting none, or succeeding.
 *
 * It exists because a correct refusal was recorded as a failure. The
 * `member-left` variant of `member-directory` declares
 * `target_not_found` / `web.target.not_found`; after the wrong-row fix
 * `run-mu5vfd6o-d98abd77` reported exactly that, its oracle passed, and its
 * `runner-verdict` invariant still read `expected: passed, actual: failed:
 * action.dispatch` -- so every refusal task and every negative variant read as
 * broken in the run record, the campaign summary and the dashboard.
 *
 * Three things the declaration does **not** override, each of which would
 * otherwise turn this into a hole in exactly the cases negative variants exist
 * to catch:
 *
 * - A failed oracle. `member-left` declares that nothing was pressed on
 *   another member (`dialogClosed`, `noToast`, the unchanged roster). The
 *   lane consults the oracle before it asserts anything (`run-flow-lane.ts`),
 *   so a run that refused *and* mutated the page has a passing failure record
 *   and a failing oracle; the oracle wins.
 * - A rig category outside `ACTION_OUTCOME_CATEGORIES`.
 * - A facility failure, and an `inconclusive` run: the rig broke, so the run
 *   observed nothing about the refusal either way.
 *
 * Nothing changes for a scenario that declares no failure: `expected` is
 * `null` and the outcome is returned untouched.
 */
export function declaredFailureOutcome(input: DeclaredFailureInput): RunOutcome {
  const { expected, outcome } = input;
  if (expected === null) return outcome;
  if (input.facilityFailure !== null || outcome.verdict === "inconclusive") return outcome;
  const judgeable = outcome.verdict === "passed" || (outcome.failureCategory !== undefined && ACTION_OUTCOME_CATEGORIES.has(outcome.failureCategory));
  if (!judgeable) return outcome;
  const passed = reportsDeclaredFailure(expected, input.reported) && input.oracleVerdict !== "failed";
  // A run that succeeded where a failure was declared has no category of its
  // own: FluxIQ behaved other than the scenario says it must, which is the
  // run-as-a-test reading of `runtime.behavior`.
  const failureCategory: FailureCategory | undefined = passed ? undefined : outcome.failureCategory ?? "runtime.behavior";
  return {
    runId: outcome.runId,
    verdict: passed ? "passed" : "failed",
    ...(failureCategory === undefined ? {} : { failureCategory }),
    invariants: outcome.invariants.map((invariant) => (invariant.id === RUNNER_VERDICT_INVARIANT ? restated(input, passed) : invariant)),
    metrics: outcome.metrics,
    durationMs: outcome.durationMs,
  };
}

/**
 * The run's one judgement invariant, restated in the declaration's terms. The
 * id is unchanged, so anything reading invariants by id keeps working, and
 * `expected` says which rule judged the run.
 *
 * `actual` keeps what the runner itself said, because the runner's category is
 * the only record of *why* it failed a run the declaration then passed, and an
 * evaluation that passes may carry no `failureCategory` at all.
 */
function restated(input: DeclaredFailureInput, passed: boolean): RunEvaluation["invariants"][number] {
  const previous = input.outcome.invariants.find((invariant) => invariant.id === RUNNER_VERDICT_INVARIANT);
  const actual = [
    `reported ${describeFailure(input.reported)}`,
    ...(input.oracleVerdict === "failed" ? ["the declared final state does not hold"] : []),
    ...(input.outcome.verdict === "failed" && input.outcome.failureCategory !== undefined ? [`the runner failed the run: ${input.outcome.failureCategory}`] : []),
  ].join("; ");
  return {
    id: RUNNER_VERDICT_INVARIANT,
    passed,
    expected: `the declared failure ${describeFailure(input.expected)}`,
    actual,
    evidenceSequences: [...(previous?.evidenceSequences ?? [])],
  };
}

/** A failure as `category/code`, its category alone when it carries no code, and `no failure` for none. */
function describeFailure(failure: { category: string; code?: string } | null): string {
  if (failure === null) return "no failure";
  return failure.code === undefined ? failure.category : `${failure.category}/${failure.code}`;
}
