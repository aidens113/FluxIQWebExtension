import { distinct } from "../distinct.mjs";
import { isIssueCode } from "./issue-code.mjs";

const LAB_REPAIR_VERDICTS = new Set(["repaired", "wrong_target", "refused", "not_proposed", "not_attempted", "proposal_unreadable"]);
const TARGET_FIELDS = new Set(["tagName", "accessibleName", "controlType"]);

/**
 * What the model did about a broken run, from `harnessRecovery` (kinds, flags,
 * codes and ids only). A patch is accepted when it passed preflight with no
 * issue code. A run is `refused` when the model was consulted and nothing came
 * of it: no patch accepted or executed, no proposal, no adaptation.
 * `refusedAt` says where: `preflight` (a patch was returned and rejected, with
 * `refusalCodes`), `no-patch` (a validated diagnosis and no patch), or
 * `no-validated-diagnosis`. `replayProviderCalls` stays `null`: the Lab's adapt
 * lane only proposes, so nothing is applied or replayed to count.
 *
 * `targetJudgement` is the Lab's own judgement of a declared repair
 * (`snapshots/flow-lane.json` `repair`, from the scenario's `repair.js`): the
 * one record that says what a proposal pointed at, as a closed verdict and
 * the names of the target fields that differed. `null` where the Lab judged
 * none.
 */
export function repairOutcome(recovery, providerCalls, flowLane) {
  const targetJudgement = labRepairJudgement(flowLane);
  if (!recovery) return { measured: false, consulted: null, diagnosisValidated: null, patchKinds: [], accepted: [], patchExecuted: null, refused: null, refusedAt: null, refusalCodes: [], changeProposalCreated: null, adaptationCreated: null, targetJudgement, replayProviderCalls: null };
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
  const refusalCodes = !refused ? [] : distinct([
    ...rejected.flatMap((attempt) => attempt.issueCodes ?? []),
    ...interventions.filter((item) => item.validationOk === false).flatMap((item) => item.validationCodes ?? []),
  ].filter(isIssueCode)).sort();
  return {
    measured: true, consulted, diagnosisValidated,
    patchKinds: distinct(attempts.map((attempt) => attempt.kind)),
    accepted: attempts.filter(isAccepted).map((attempt) => ({ kind: attempt.kind ?? null, executed: attempt.executed === true, produced: attempt.changeProposalCreated === true || attempt.adaptationCreated === true })),
    patchExecuted, refused, refusedAt, refusalCodes, changeProposalCreated, adaptationCreated, targetJudgement, replayProviderCalls: null,
  };
}

/** The Lab's declared-repair verdict and differing field names, or `null`; anything outside those closed sets is dropped. */
function labRepairJudgement(flowLane) {
  const judged = flowLane?.repair;
  if (!judged || typeof judged !== "object" || !LAB_REPAIR_VERDICTS.has(judged.verdict)) return null;
  const fields = Array.isArray(judged.mismatchedFields) ? judged.mismatchedFields : [];
  return { verdict: judged.verdict, mismatchedFields: fields.filter((field) => TARGET_FIELDS.has(field)) };
}
