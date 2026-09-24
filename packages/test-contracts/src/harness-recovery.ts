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
  /**
   * Why this run got no repair, as Core's own code, never its sentence.
   *
   * From the gate when recovery never started (`runDetail.metadata.llmGate.code`):
   * `llm.gate.training_mode` when the Flow's settings do not allow LLM
   * intervention, `llm.gate.training_budget_exhausted`, or
   * `llm.gate.<prior action>` when a deterministic answer must come first
   * (`known_recovery`, `reroute`, `known_adaptation`, `manual_intervention`).
   *
   * From the loop when it started and stopped without repairing anything
   * (`llmGate.patchSkippedCode`, `llmGate.patchHeldCode`): the plan asked for
   * no patch, the grant's scope allowed none, a person's permission was
   * needed. **That half was missing.** The field had to be `null` whenever
   * `attempted` was true, so a recovery that engaged, spent a diagnosis call
   * and then declined recorded no reason at all: live run
   * `run-muesyox4-930bef98` (2026-09-23) filed two interventions, no patch
   * attempt and a `null` refusal, which reads exactly like a repair loop that
   * is switched off.
   *
   * `null` when Core recorded no refusal, and when the recovery produced
   * something -- a patch attempt, an adaptation, a change proposal -- because
   * then what it did is the answer and the lists carry it. Absent in a record
   * written before the field existed, which says nothing either way.
   */
  refusalCode?: string | null;
  /**
   * Which rung of Core's recovery loop declined, beside the code for why.
   * `gate` is a recovery that never started; the other four are Core's own
   * loop stages. `null` when there is no refusal to attribute, and **absent**
   * when Core named no rung -- an older Core, not an unattributed refusal.
   */
  refusalRung?: HarnessRecoveryRung | null;
};

/**
 * The rungs a refusal can come from: Core's gate, then its four loop stages
 * (`recovery/stages.ts`). The code says why nothing was repaired; this says
 * who decided, which is the difference between "the plan would not ask for a
 * patch" and "a person has to answer first".
 */
export const harnessRecoveryRungs = ["gate", "diagnosis", "plan", "exploration", "resolution"] as const;
export type HarnessRecoveryRung = (typeof harnessRecoveryRungs)[number];

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
 *
 * `permissionOutcome` is what the recovery's permission gate said about a
 * patch that would lastingly act (`recovery/annotation/patches.ts`), and
 * `permissionRequired` is `true` exactly when the patch was held back as the
 * request a person answers rather than run. Both are `null` when Core asked
 * no gate, and **absent** only in a record written before they existed.
 *
 * `verdict` is Core's judgement of this attempt's trial. It is per attempt,
 * not per run, because Core records it on each attempt and a run may try more
 * than one change: a second drift after a repaired node starts a second trial.
 * `null` when Core stated no verdict for the attempt. **Absent** only in a
 * record written before the member existed, which reads as unmeasured, the
 * same as `null`, and never as a trial that proved nothing.
 */
export type RunHarnessPatchAttempt = {
  kind: string | null;
  proposalOnly: boolean | null;
  executed: boolean | null;
  preflightOk: boolean | null;
  issueCodes: string[];
  adaptationCreated: boolean;
  changeProposalCreated: boolean;
  permissionOutcome?: HarnessPatchPermissionOutcome | null;
  permissionRequired?: boolean | null;
  verdict?: RunHarnessChangeVerdict | null;
};

/**
 * What the recovery's permission gate said about one patch that would run:
 * `permitted` (nothing lasting declared, or all of it allowed), `required`
 * (held back as a person's request), `undeclared` (it did not say what it
 * would do, so it did not run), `not_asked` (it could not have run whatever
 * the person said).
 */
export const harnessPatchPermissionOutcomes = ["permitted", "required", "undeclared", "not_asked"] as const;
export type HarnessPatchPermissionOutcome = (typeof harnessPatchPermissionOutcomes)[number];

/**
 * The outcomes of Core's change verdict (`AutomationStudioChangeVerdict`), the
 * same four words as the runtime patch verification it replaces.
 * `not_executed` is a patch that never ran: proposed only, refused at
 * preflight, or not applicable to the Flow.
 */
export const harnessChangeVerdictOutcomes = ["verified", "contradicted", "unverifiable", "not_executed"] as const;
export type HarnessChangeVerdictOutcome = (typeof harnessChangeVerdictOutcomes)[number];

/**
 * The evidence a `verified` verdict may rest on. Core also checks that each
 * changed node succeeded and that the run could continue, but neither is
 * evidence the change was right, so neither is ever a basis: a change whose
 * node merely succeeded is `unverifiable`.
 */
export const harnessChangeVerdictBases = ["expected_state", "expected_route", "expected_outputs", "records", "downstream_assertion"] as const;
export type HarnessChangeVerdictBasis = (typeof harnessChangeVerdictBases)[number];

/**
 * Core's verdict on one change's trial, reduced to closed words: never Core's
 * reason sentence, and never the checks' node ids. `basis` is non-empty
 * exactly when `outcome` is `verified`, and names each kind of evidence once.
 */
export type RunHarnessChangeVerdict = { outcome: HarnessChangeVerdictOutcome; basis: HarnessChangeVerdictBasis[] };
