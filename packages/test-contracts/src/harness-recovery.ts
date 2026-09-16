/**
 * What FluxIQ Core's recovery harness did during one Flow run, as Core's run
 * detail reports it: each LLM intervention, each runtime patch attempt, and the
 * adaptations and change proposals the run created. **Identifiers, closed
 * codes, booleans and counts only**: never a prompt, a response, a selector,
 * page text or a message, so an evaluation can carry it without carrying what a
 * page showed or what a model said.
 *
 * Core deletes an isolated run's workspace when the run ends, so this record,
 * written into the run's bundle and evaluation, is the only place the answer
 * survives: whether a patch was preflighted, executed or only proposed, and
 * whether it produced an adaptation or a change proposal.
 *
 * `attempted` is `false` exactly when all four lists are empty. That is a run
 * that needed no recovery, or was allowed none, and it reads as "no recovery",
 * never as a failed one. A recovery that was tried and changed nothing reads as
 * `attempted: true` with no executed patch and no adaptation.
 */
export type RunHarnessRecovery = {
  attempted: boolean;
  /** In Core's order. */
  interventions: RunHarnessIntervention[];
  /** In Core's order: one per patch the model returned, run or only proposed. */
  runtimePatchAttempts: RunHarnessPatchAttempt[];
  /** The adaptations the run created (Core's `runDetail.adaptationIds`). */
  adaptationIds: string[];
  /** The change proposals the run created (Core's `runDetail.changeProposalIds`). */
  changeProposalIds: string[];
};

/**
 * One LLM intervention Core recorded. `kind` is Core's intervention kind
 * (`diagnosis`, `runtime_patch`, ...). `validationOk` is whether the model's
 * response validated, `null` when Core recorded no validation, and
 * `validationCodes` are the issue codes validation reported, without their
 * messages.
 */
export type RunHarnessIntervention = { kind: string; validationOk: boolean | null; validationCodes: string[] };

/**
 * One runtime patch Core preflighted, executed, or only proposed. `kind` is
 * Core's patch kind (`temporary_target_override`, ...), `null` when Core named
 * none the runner recognizes. Each nullable flag is `null` when Core did not
 * state it. `issueCodes` are the preflight issues as closed codes
 * (`runtime_patch.target_node_invalid`, ...), never Core's issue text.
 * `adaptationCreated` and `changeProposalCreated` say whether this attempt
 * produced one; the identifiers are on the run's own lists.
 */
export type RunHarnessPatchAttempt = {
  kind: string | null;
  proposalOnly: boolean | null;
  executed: boolean | null;
  preflightOk: boolean | null;
  issueCodes: string[];
  adaptationCreated: boolean;
  changeProposalCreated: boolean;
};
