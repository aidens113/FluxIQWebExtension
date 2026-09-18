import { distinct } from "../distinct.mjs";
import { parseLabResult, parseRunnerRefusal } from "../lab-run/index.mjs";
import { createdFlowShape } from "./created-flow-shape.mjs";
import { datasetJudgement } from "./dataset-judgement.mjs";
import { describeFacilityFailure } from "./facility-failure.mjs";
import { isIssueCode } from "./issue-code.mjs";
import { repairJudgement } from "./repair-judgement.mjs";
import { repairOutcome } from "./repair-outcome.mjs";
import { reportedSpend } from "./reported-spend.mjs";

/**
 * One summary row: what the run did, read from its bundle. Counts, codes and
 * identifiers only -- no page data, prompt or response.
 */
export function summarizeTask(task, attempts, final, bundle) {
  const result = parseLabResult(final.stdout);
  const refusal = parseRunnerRefusal(final.stderr);
  const { evaluation, run, liveLlm, flowLane } = bundle;
  const calls = liveLlm?.observed?.observedCalls ?? [];
  const spend = reportedSpend(liveLlm, flowLane);
  const recovery = evaluation?.harnessRecovery ?? flowLane?.harnessRecovery ?? null;
  const automationFailure = evaluation?.automationFailureReported ?? run?.automationFailure ?? null;
  const declaredFailure = evaluation?.automationFailureExpected ?? null;
  const oracleVerdict = evaluation?.oracleVerdict ?? result?.observation?.oracleVerdict ?? null;
  // A created Flow's repair is counted beside its build in the same record the row's tokens and dollars come from;
  // `evaluation.llm.calls`, the fallback, already counts both.
  const observedCalls = liveLlm?.observed?.calls;
  const providerCalls = typeof observedCalls === "number" ? observedCalls + (liveLlm?.repair?.observed?.calls ?? 0) : evaluation?.llm?.calls ?? null;
  const repairing = task.kind === "repair";
  const repair = repairing ? repairOutcome(recovery, providerCalls, flowLane) : null;
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
    attempts: attempts.length,
    ramFaults: attempts.map((attempt) => attempt.ramFault).filter(Boolean),
    /** A classified failure that came back identical on retry: deterministic, and never a RAM fault. */
    repeatedFailure: attempts.find((attempt) => attempt.repeatedFailure)?.repeatedFailure ?? null,
    flowCreated: evaluation?.flowCreated ?? result?.observation?.flowCreated ?? (flowLane?.flowId ? true : null),
    actionTypes: distinct((evaluation?.actions ?? run?.actions ?? flowLane?.actions ?? []).map((action) => action.actionType)),
    createdFlowShape: createdFlowShape(flowLane),
    judgement,
    repair,
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
