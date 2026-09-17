import { distinct } from "../distinct.mjs";

/**
 * A repair task's judgement. `passed` is `null` when the outcome says nothing
 * about the model: no recovery record, a refusal the model was never asked to
 * make, or a final state nobody checked.
 *
 * - `repair`: a validated diagnosis, and an accepted patch of the task's kind
 *   that created a proposal or adaptation or was executed. Where the Lab
 *   judged the declared repair, its verdict must be `repaired`, which is what
 *   shows the proposal names the right control (`targetVerified`). An executed
 *   patch must also leave the declared final state true. With neither, the
 *   proposal's target is not in the record and `targetVerified` stays `null`.
 * - `refusal`: the model consulted, the run `refused`, and the declared final
 *   state (nothing pressed, nothing changed) still true.
 */
export function repairJudgement(task, outcome, oracleVerdict) {
  const executed = outcome.accepted.some((patch) => patch.kind === task.patchKind && patch.executed);
  const lab = outcome.targetJudgement;
  const targetVerified = task.expect !== "repair" ? null : lab ? lab.verdict === "repaired" && (!executed || oracleVerdict === "passed") : executed ? oracleVerdict === "passed" : null;
  const judged = (passed, reason) => ({ by: task.expect, passed, reason, oracleVerdict, targetVerified });
  if (!outcome.measured) return judged(null, "no recovery record: no Flow ran");
  if (task.expect === "refusal") {
    if (!outcome.consulted) return judged(null, "the model was never consulted, so nothing was refused");
    if (!outcome.refused) return judged(false, outcome.patchExecuted ? "a patch was executed" : "a patch was accepted, or a proposal or adaptation was created");
    if (oracleVerdict === null) return judged(null, "the final state was not checked");
    if (oracleVerdict !== "passed") return judged(false, "the declared final state does not hold");
    return judged(true, `refused at ${outcome.refusedAt}`);
  }
  if (!outcome.consulted) return judged(false, "the model was never consulted");
  if (!outcome.diagnosisValidated) return judged(false, "no diagnosis validated");
  const fitting = outcome.accepted.filter((patch) => patch.kind === task.patchKind);
  if (fitting.length === 0) {
    const kinds = distinct(outcome.accepted.map((patch) => patch.kind));
    return judged(false, kinds.length > 0 ? `accepted ${kinds.join(", ")}, not ${task.patchKind}` : "no patch was accepted");
  }
  if (!fitting.some((patch) => patch.produced || patch.executed)) return judged(false, `the accepted ${task.patchKind} created no proposal or adaptation`);
  if (lab?.verdict === "wrong_target") return judged(false, `the proposal named a different control (${lab.mismatchedFields.join(", ") || "unnamed fields"} differ)`);
  if (lab && lab.verdict !== "repaired") return judged(false, `the Lab judged the declared repair ${lab.verdict}`);
  if (executed && oracleVerdict !== "passed") return judged(false, "the executed repair did not reach the declared final state");
  if (executed) return judged(true, "repaired, executed and checked");
  return judged(true, lab ? "repair proposed, naming the declared control" : "repair proposed; its target is not in the record");
}
