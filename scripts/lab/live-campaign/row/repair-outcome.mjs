import { distinct } from "../distinct.mjs";
import { isIssueCode } from "./issue-code.mjs";

const LAB_REPAIR_VERDICTS = new Set(["repaired", "wrong_target", "refused", "not_proposed", "not_attempted", "proposal_unreadable"]);
const TARGET_FIELDS = new Set(["tagName", "accessibleName", "controlType"]);
/** Core's recovery rungs, as `harnessRecoveryRungs` closes them; anything else is dropped rather than carried. */
const RECOVERY_RUNGS = new Set(["gate", "diagnosis", "plan", "exploration", "resolution"]);

/**
 * What the model did about a broken run, from `harnessRecovery` (kinds, flags,
 * codes and ids only). A patch is accepted when it passed preflight with no
 * issue code. A run is `refused` when the model was consulted and nothing came
 * of it: no patch accepted or executed, no proposal, no adaptation.
 * `refusedAt` says where: `preflight` (a patch was returned and rejected, with
 * `refusalCodes`), `no-patch` (a validated diagnosis and no patch), or
 * `no-validated-diagnosis`. `refusedRung` is Core's own word for the rung of
 * its recovery loop that declined, when Core named one.
 *
 * `refusalCodes` carries Core's `refusalCode` beside the rejected patches'
 * issue codes. Without it the commonest refusal of all -- a validated
 * diagnosis that asked for no patch -- summarised as `refusedAt: "no-patch"`
 * and an empty code list, which is exactly the campaign row live run
 * `run-muesyox4-930bef98` produced (2026-09-23) and says nothing about why.
 *
 * `replayProviderCalls` is the repair lane's count
 * over its replays (`replay-summary.mjs`), and `null` unless the run was given
 * `--replays` and replayed: the adapt lane alone only proposes, so nothing is
 * applied or replayed to count.
 *
 * `targetJudgement` is the Lab's own judgement of a declared repair
 * (`snapshots/flow-lane.json` `repair`, from the scenario's `repair.js`): the
 * one record that says what a proposal pointed at, as a closed verdict and
 * the names of the target fields that differed. `null` where the Lab judged
 * none.
 */
export function repairOutcome(recovery, providerCalls, flowLane, repairLane = null) {
  const replayProviderCalls = repairLane?.replayProviderCalls ?? null;
  const targetJudgement = labRepairJudgement(flowLane);
  if (!recovery) return { measured: false, consulted: null, diagnosisValidated: null, patchKinds: [], accepted: [], patchExecuted: null, refused: null, refusedAt: null, refusedRung: null, refusalCodes: [], changeProposalCreated: null, adaptationCreated: null, targetJudgement, replayProviderCalls };
  const interventions = recovery.interventions ?? [];
  const attempts = recovery.runtimePatchAttempts ?? [];
  const isAccepted = (attempt) => attempt.preflightOk === true && (attempt.issueCodes ?? []).length === 0;
  const consulted = (providerCalls ?? 0) > 0 || interventions.length > 0;
  const diagnosisValidated = interventions.some((item) => item.kind === "diagnosis" && item.validationOk === true);
  const patchExecuted = attempts.some((attempt) => attempt.executed === true);
  const changeProposalCreated = (recovery.changeProposalIds ?? []).length > 0 || attempts.some((attempt) => attempt.changeProposalCreated === true);
  const adaptationCreated = (recovery.adaptationIds ?? []).length > 0 || attempts.some((attempt) => attempt.adaptationCreated === true);
  const rejected = attempts.filter((attempt) => !isAccepted(attempt));
  const refused = consulted && rejected.length === attempts.length && !patchExecuted && !changeProposalCreated && !adaptationCreated;
  const refusedAt = !refused ? null : rejected.length > 0 ? "preflight" : diagnosisValidated ? "no-patch" : "no-validated-diagnosis";
  const refusedRung = refused && RECOVERY_RUNGS.has(recovery.refusalRung) ? recovery.refusalRung : null;
  const refusalCodes = !refused ? [] : distinct([
    recovery.refusalCode,
    ...rejected.flatMap((attempt) => attempt.issueCodes ?? []),
    ...interventions.filter((item) => item.validationOk === false).flatMap((item) => item.validationCodes ?? []),
  ].filter(isIssueCode)).sort();
  return {
    measured: true, consulted, diagnosisValidated,
    patchKinds: distinct(attempts.map((attempt) => attempt.kind)),
    accepted: attempts.filter(isAccepted).map((attempt) => ({ kind: attempt.kind ?? null, executed: attempt.executed === true, produced: attempt.changeProposalCreated === true || attempt.adaptationCreated === true })),
    patchExecuted, refused, refusedAt, refusedRung, refusalCodes, changeProposalCreated, adaptationCreated, targetJudgement, replayProviderCalls,
  };
}

/** The Lab's declared-repair verdict and differing field names, or `null`; anything outside those closed sets is dropped. */
function labRepairJudgement(flowLane) {
  const judged = flowLane?.repair;
  if (!judged || typeof judged !== "object" || !LAB_REPAIR_VERDICTS.has(judged.verdict)) return null;
  const fields = Array.isArray(judged.mismatchedFields) ? judged.mismatchedFields : [];
  return { verdict: judged.verdict, mismatchedFields: fields.filter((field) => TARGET_FIELDS.has(field)) };
}
