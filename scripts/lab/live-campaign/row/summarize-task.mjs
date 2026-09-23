import { distinct } from "../distinct.mjs";
import { parseLabResult, parseRunnerRefusal } from "../lab-run/index.mjs";
import { consequenceSummary } from "./consequences.mjs";
import { createdFlowShape } from "./created-flow-shape.mjs";
import { datasetJudgement } from "./dataset-judgement.mjs";
import { describeFacilityFailure } from "./facility-failure.mjs";
import { isIssueCode } from "./issue-code.mjs";
import { repairJudgement } from "./repair-judgement.mjs";
import { replaySummary } from "./replay-summary.mjs";
import { repairOutcome } from "./repair-outcome.mjs";
import { reportedSpend } from "./reported-spend.mjs";
import { rungAttribution } from "./rung-attribution.mjs";

/**
 * One summary row: what the run did, read from its bundle. Counts, codes and
 * identifiers only -- no page data, prompt or response.
 *
 * `timing` is what the campaign itself measured around this task, which
 * nothing in the bundle can say: the bundle knows the run, and the campaign
 * knows what the run cost the campaign. Omitted, the row reports no campaign
 * duration and every other member is unchanged.
 */
export function summarizeTask(task, attempts, final, bundle, timing = {}) {
  const result = parseLabResult(final.stdout);
  const refusal = parseRunnerRefusal(final.stderr);
  const { evaluation, run, liveLlm, flowLane } = bundle;
  const calls = liveLlm?.observed?.observedCalls ?? [];
  const spend = reportedSpend(liveLlm, flowLane);
  const recovery = evaluation?.harnessRecovery ?? flowLane?.harnessRecovery ?? null;
  const automationFailure = evaluation?.automationFailureReported ?? run?.automationFailure ?? null;
  const declaredFailure = evaluation?.automationFailureExpected ?? null;
  const declaredSpend = liveLlm?.expectedProviderCalls ?? null;
  const oracleVerdict = evaluation?.oracleVerdict ?? result?.observation?.oracleVerdict ?? null;
  // A created Flow's repair is counted beside its build in the same record the row's tokens and dollars come from;
  // `evaluation.llm.calls`, the fallback, already counts both.
  const observedCalls = liveLlm?.observed?.calls;
  const providerCalls = typeof observedCalls === "number" ? observedCalls + (liveLlm?.repair?.observed?.calls ?? 0) : evaluation?.llm?.calls ?? null;
  const repairing = task.kind === "repair";
  // What `--replays` did, for either kind: a creation task's Flow runs under a repair grant too.
  const repairLane = replaySummary(bundle.repairLane);
  // Which recovery answered for each node of the Flow this run executed. Read
  // beside `providerCalls` below, the two are the adversarial measurement: the
  // rung that absorbed the condition, and what it cost in model calls.
  const recoveryRungs = rungAttribution(flowLane);
  // What the build's own steps declared, and who permitted it. Read from the
  // live-LLM snapshot, which carries the build record whether the build
  // proposed a Flow or parked on a question nobody answered.
  const consequences = consequenceSummary(liveLlm);
  const repair = repairing ? repairOutcome(recovery, providerCalls, flowLane, repairLane) : null;
  let judgement;
  if (repairing) judgement = repairJudgement(task, repair, oracleVerdict);
  else {
    const dataset = task.judgeBy === "expected-dataset" ? datasetJudgement(evaluation?.extraction ?? result?.observation?.extraction ?? null) : null;
    judgement = { by: task.judgeBy, passed: dataset === null ? (oracleVerdict === null ? null : oracleVerdict === "passed") : dataset.passed, oracleVerdict, dataset };
  }
  // The run's own `evaluation.json` is the verdict, and the Lab's printed
  // result is the fallback for a run that has none (the existing and clone
  // targets run on no evaluation lane and publish no evaluation). The two
  // agree except where a scenario or variant declares the failure it must
  // report: such a run passes by reporting exactly that failure, which only
  // the evaluation applies (`packages/test-runner/src/run-evaluation`). Read
  // from the printed result alone, a correct refusal reads as a failure here,
  // in the totals, and in every dashboard built on them.
  const verdict = result ? (evaluation?.verdict ?? result.verdict) : "no-result";
  const lastFault = attempts.at(-1)?.ramFault ?? null;
  return {
    taskId: task.id, scenarioId: task.scenarioId, workflowId: task.workflowId ?? null, variantId: task.variantId ?? null, kind: task.kind,
    instruction: task.instruction ?? null, judgeBy: repairing ? task.expect : task.judgeBy, expectedDatasetId: task.expectedDatasetId ?? null,
    runId: result?.runId ?? null,
    verdict,
    // A creation task succeeds on its run's verdict. A repair run's verdict
    // judges the variant's expectations, which a proposal alone never meets,
    // so a repair task succeeds on its judgement instead.
    succeeded: repairing ? judgement.passed === true : verdict === "passed",
    exitCode: final.code,
    /**
     * The campaign's own wall clock for this task: every attempt, every retry
     * and the Lab's process startup, which is the number a dry run has to be
     * judged against. `null` when the caller measured none.
     */
    durationMs: isCount(timing.durationMs) ? timing.durationMs : null,
    /**
     * The runner's measurement of the one attempt that produced this row, from
     * its own `evaluation.json`. It excludes the retries and the startup that
     * `durationMs` includes, which is why both are here under distinct names:
     * a task that is slow because it ran twice and a task that is slow because
     * the run is slow are different problems and used to look identical.
     */
    runDurationMs: isCount(evaluation?.durationMs) ? evaluation.durationMs : null,
    attempts: attempts.length,
    ramFaults: attempts.map((attempt) => attempt.ramFault).filter(Boolean),
    /** A classified failure that came back identical on retry: deterministic, and never a RAM fault. */
    repeatedFailure: attempts.find((attempt) => attempt.repeatedFailure)?.repeatedFailure ?? null,
    flowCreated: evaluation?.flowCreated ?? result?.observation?.flowCreated ?? (flowLane?.flowId ? true : null),
    actionTypes: distinct((evaluation?.actions ?? run?.actions ?? flowLane?.actions ?? []).map((action) => action.actionType)),
    createdFlowShape: createdFlowShape(flowLane),
    /**
     * How the build ended, in the product's own words: `proposed`,
     * `permission_required` -- it asked a person for a lasting act and nobody
     * answered -- or `failed`. `null` for a run that made no build.
     */
    buildOutcome: typeof liveLlm?.build?.outcome === "string" ? liveLlm.build.outcome : null,
    /**
     * What the build's acting steps said they would lastingly do, who allowed
     * it (`answeredBy`), and the question it asked if nobody had. `null` for a
     * run that reached no build.
     */
    consequences,
    /**
     * What Core had still not written about the created Flow's own run when
     * the wait for it ran out: today only `recovery`, its recovery record. The
     * run is reported as it stands, so this separates "Core recovered nothing"
     * from "Core never said".
     */
    unsettled: typeof flowLane?.unsettled === "string" ? flowLane.unsettled : null,
    judgement,
    repair,
    /** `null` unless the run was given `--replays`; then whether its repair was applied, and whether each replay with no model met the goal. */
    repairLane,
    providerCalls,
    reportedTokens: spend.tokens,
    reportedCostUsd: spend.costUsd,
    spendSource: spend.source,
    callsWithoutReportedTokens: spend.callsWithoutReportedTokens,
    // A passed run has no failure category: the runner's own category survives
    // on the evaluation's judgement invariant, which is where a refusal the
    // declaration passed records what the runner had made of it.
    failureCategory: verdict === "passed" ? null : result?.failureCategory ?? evaluation?.failureCategory ?? refusal?.category ?? (lastFault ? `ram-fault: ${lastFault}` : null),
    automationFailure: failureLabel(automationFailure),
    /** The failure the scenario or variant declared this run must report, when it declared one. */
    declaredFailure: failureLabel(declaredFailure),
    /**
     * The provider spend the scenario or variant declared, when it declared
     * any: today only `0`, meaning the deterministic runtime was expected to
     * absorb the fault without the model. Read from the live-LLM snapshot,
     * which records the declaration whether or not it held, so a row showing
     * `providerCalls: 0` says whether that silence was intended.
     */
    declaredProviderCalls: declaredSpend === null ? null : declaredSpend.count,
    declaredProviderCallsBecause: declaredSpend === null ? null : declaredSpend.because,
    /**
     * Which recovery absorbed what this run met, from the Flow lane's own
     * attribution: the ladder rungs that ran, the ones that resolved a node,
     * and the busiest node's attempt count. `null` for a run that reached no
     * Flow lane. A row with `providerCalls: 0` and an empty `resolvedBy` is a
     * run where nothing had to recover -- which is the correct answer for a
     * control and a defect in an armed condition.
     */
    recoveryRungs,
    issueCodes: distinct([
      ...calls.flatMap((call) => call.validationCodes ?? []),
      ...(recovery?.interventions ?? []).flatMap((item) => item.validationCodes ?? []),
      ...(recovery?.runtimePatchAttempts ?? []).flatMap((item) => item.issueCodes ?? []),
      ...(flowLane?.proposalIssues ?? []),
      flowLane?.failure?.code, liveLlm?.build?.failure?.code, automationFailure?.code,
    ].filter(isIssueCode)).sort(),
    runPath: result?.path ?? null,
    // What stopped the run, when the run itself did not say: the runner's
    // refusal for an attempt with no result, or the facility failure a
    // finished bundle recorded.
    runnerMessage: result ? (verdict === "passed" ? null : describeFacilityFailure(evaluation?.facilityFailure)) : shortMessage(refusal?.message),
  };
}

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

/** A failure as `category/code`, its category alone when it carries no code, and `null` for none. */
function failureLabel(failure) {
  return failure ? [failure.category, failure.code].filter(Boolean).join("/") : null;
}

const MAX_MESSAGE_CHARS = 320;

/**
 * The refusal as printed, on one line and bounded, with any long token that
 * mixes letters and digits (a key, a hash, an id) redacted. A long name with
 * no digit, such as the environment variable a run was refused for, is kept:
 * it is what the reader needs.
 */
function shortMessage(message) {
  if (typeof message !== "string") return null;
  const line = message.replace(/\s+/gu, " ").trim()
    .replace(/[A-Za-z0-9_-]{32,}/gu, (token) => (/[0-9]/u.test(token) && /[A-Za-z]/u.test(token) ? "[redacted]" : token));
  return line.length <= MAX_MESSAGE_CHARS ? line : line.slice(0, MAX_MESSAGE_CHARS);
}
