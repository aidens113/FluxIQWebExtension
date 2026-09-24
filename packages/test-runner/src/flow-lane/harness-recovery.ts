import { harnessRecoveryRungs, validateRunHarnessRecovery, type HarnessRecoveryRung, type RunHarnessPatchAttempt, type RunHarnessRecovery } from "@fluxiq-web-extension/test-contracts";
import type { ExistingRunDetail } from "../existing-fluxiq-control.js";
import { RunnerFailure } from "../failure.js";
import type { FluxIQHttpOptions } from "../http-control/index.js";

/** The part of Core's run detail that says what recovery did, as the control client parses it. */
export type HarnessRecoveryDetail = Pick<ExistingRunDetail, "interventions" | "runtimePatchAttempts" | "adaptationIds" | "changeProposalIds">;

/**
 * The read a recovery record comes from. `ExistingFluxIQControlClient` satisfies
 * it, and its `getRunDetail` is the one parser of these shapes
 * (`runIntervention` and `runtimePatchAttempt` in `existing-fluxiq-control.ts`,
 * neither exported): it already reduces an issue to its code and a patch's
 * adaptation and proposal to whether one was created, and it fails a malformed
 * field with its path.
 */
export type HarnessRecoveryControl = {
  getRunDetail(projectId: string, runId: string, bounds?: FluxIQHttpOptions): Promise<HarnessRecoveryDetail>;
};

/** The shape `RunHarnessRecovery` requires of an identifier (`harness-recovery-validation.ts`): no space, so no text. */
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const IDENTIFIER_MAX_LENGTH = 256;

/**
 * What Core's recovery harness did during a terminal run, from the run detail
 * the Flow lane has already read.
 *
 * A detail whose four recovery fields are each absent, null or empty recorded
 * no recovery, and is answered from that detail alone: `attempted: false`,
 * which reads as "no recovery", never as a failed one. Only a detail that
 * recorded something -- or holds something other than an empty list where one
 * belongs -- is read again through the control client's parser, so the
 * provider-free runs the bench makes cost no second read. The second read is of
 * a terminal run, so both reads describe the same run.
 *
 * Each item is rebuilt field by field, so what the parser keeps and this record
 * does not -- request ids, prompt versions, providers, models, token counts,
 * times -- stays behind. An identifier that is not identifier-shaped fails the
 * read by its path rather than carrying text into the bundle.
 */
export async function readHarnessRecovery(
  control: HarnessRecoveryControl,
  scope: { projectId: string; runId: string },
  runDetail: Readonly<Record<string, unknown>>,
  bounds: FluxIQHttpOptions,
): Promise<RunHarnessRecovery> {
  if (!recoveryRecorded(runDetail)) return conforming({ attempted: false, interventions: [], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [], ...recoveryRefusal(runDetail) });
  const detail = await control.getRunDetail(scope.projectId, scope.runId, bounds);
  const interventions = (detail.interventions ?? []).map((item) => ({ kind: item.kind, validationOk: item.validationOk ?? null, validationCodes: [...(item.validationCodes ?? [])] }));
  const refusals = targetOverrideRefusalCases(runDetail);
  const runtimePatchAttempts = (detail.runtimePatchAttempts ?? []).map((attempt, index): RunHarnessPatchAttempt => ({
    kind: attempt.kind ?? null,
    proposalOnly: attempt.proposalOnly ?? null,
    executed: attempt.executed ?? null,
    preflightOk: attempt.preflightOk ?? null,
    issueCodes: withRefusalCase(attempt.issueCodes, refusals[index]),
    adaptationCreated: attempt.adaptationCreated,
    changeProposalCreated: attempt.changeProposalCreated,
    // Only where Core asked the recovery's permission gate about this patch, so
    // a record of a run that asked none reads exactly as it always did.
    ...(attempt.permissionOutcome ? { permissionOutcome: attempt.permissionOutcome, permissionRequired: attempt.permissionRequired === true } : {}),
  }));
  const adaptationIds = identifiers(detail.adaptationIds ?? [], "runDetail.adaptationIds");
  const changeProposalIds = identifiers(detail.changeProposalIds ?? [], "runDetail.changeProposalIds");
  const attempted = interventions.length + runtimePatchAttempts.length + adaptationIds.length + changeProposalIds.length > 0;
  // A refusal belongs on any run that got no repair, not only on one whose
  // recovery never started. `refusalCode` was `attempted ? null : ...`, so the
  // loop's own reasons -- the plan asked for no patch, the grant's scope
  // allowed none, a person's answer was needed -- had nowhere to go the moment
  // a single intervention existed. What silences it now is a recovery that
  // produced something, because then the lists are the answer.
  const produced = runtimePatchAttempts.length + adaptationIds.length + changeProposalIds.length > 0;
  return conforming({ attempted, interventions, runtimePatchAttempts, adaptationIds, changeProposalIds, ...(produced ? { refusalCode: null, refusalRung: null } : recoveryRefusal(runDetail)) });
}

/**
 * Why this run got no repair, as Core's code and the rung that decided, or
 * nulls when Core recorded no refusal.
 *
 * Three places, in the order a recovery reaches them. Core writes
 * `llmGate: { invoked: false, code, reason }` at each early return, so an
 * `invoked: false` code is the gate declining before the loop began. Once the
 * loop has run, `patchSkippedCode` is why no patch call followed and
 * `patchSkippedRung` is which stage decided; `patchHeldCode` is a patch the
 * model wrote that a person has to allow first. Core's sentences -- `reason`,
 * `patchSkipped` -- stay behind in every case.
 */
function recoveryRefusal(runDetail: Readonly<Record<string, unknown>>): { refusalCode: string | null; refusalRung: HarnessRecoveryRung | null } {
  const none = { refusalCode: null, refusalRung: null };
  const metadata = runDetail.metadata;
  const gate = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>).llmGate : undefined;
  if (!gate || typeof gate !== "object" || Array.isArray(gate)) return none;
  const { invoked, code, patchSkippedCode, patchSkippedRung, patchHeldCode, patchHeldRung } = gate as Record<string, unknown>;
  if (invoked === false && code !== undefined) return { refusalCode: code as string, refusalRung: "gate" };
  if (patchSkippedCode !== undefined) return { refusalCode: patchSkippedCode as string, refusalRung: rung(patchSkippedRung) };
  if (patchHeldCode !== undefined) return { refusalCode: patchHeldCode as string, refusalRung: rung(patchHeldRung) ?? "resolution" };
  return none;
}

/** One of Core's rungs, or `null` when Core named none or named a word it does not own. */
function rung(value: unknown): HarnessRecoveryRung | null {
  return typeof value === "string" && (harnessRecoveryRungs as readonly string[]).includes(value) ? value as HarnessRecoveryRung : null;
}

/**
 * The record, once the contract accepts it. The parser's kinds and codes are
 * already closed, so this fails only when the parser and the contract have
 * drifted apart -- and then before anything reaches the bundle, by path.
 */
function conforming(recovery: RunHarnessRecovery): RunHarnessRecovery {
  const checked = validateRunHarnessRecovery(recovery);
  if (checked.valid) return recovery;
  const paths = checked.issues.map((issue) => `harnessRecovery${issue.path.slice(1)} ${issue.message}`);
  throw new RunnerFailure("runtime.behavior", `Core's recovery record does not fit the evaluation contract: ${paths.join("; ")}`, { details: { paths: checked.issues.map((issue) => `harnessRecovery${issue.path.slice(1)}`) } });
}

/**
 * Whether the detail holds anything in its recovery fields. Deliberately not a
 * parse: anything other than absent, null or an empty list -- a malformed value
 * included -- counts, so that the parser, not this check, decides what it is.
 */
function recoveryRecorded(detail: Readonly<Record<string, unknown>>): boolean {
  const metadata = detail.metadata;
  const patchAttemptsRecorded = metadata !== undefined && metadata !== null
    && (typeof metadata !== "object" || Array.isArray(metadata) || !emptyList((metadata as Record<string, unknown>).runtimePatchAttempts));
  return patchAttemptsRecorded || !emptyList(detail.interventions) || !emptyList(detail.adaptationIds) || !emptyList(detail.changeProposalIds);
}

const TARGET_OVERRIDE_REJECTED = "runtime_patch.target_override_rejected";
/** Core's refusal reasons and the domain's two statuses: lowercase words joined by underscores. */
const REFUSAL_CASE = /^[a-z]+(?:_[a-z]+)*$/u;
const REFUSAL_CASE_MAX_LENGTH = 64;

/**
 * Which case each refused target override was, by position in Core's
 * `runtimePatchAttempts`, which the control client's parser keeps in order.
 *
 * Core records the domain's refusal beside the issue as
 * `targetOverrideRefusal: { status, reason? }` (`live-patch.ts`), where
 * `reason` is one of Core's own closed words. The control client reduces the
 * issue sentence to `runtime_patch.target_override_rejected` alone, which reads
 * the same for an action the domain cannot repair, an invented parameter and a
 * handle the model was never shown. The case is read from the structured field
 * rather than the sentence, and only a word of the reason's shape is kept, so
 * nothing the sentence carries can reach the record.
 */
function targetOverrideRefusalCases(runDetail: Readonly<Record<string, unknown>>): Array<string | undefined> {
  const metadata = runDetail.metadata;
  const attempts = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>).runtimePatchAttempts : undefined;
  if (!Array.isArray(attempts)) return [];
  return attempts.map((attempt) => {
    const refusal = attempt && typeof attempt === "object" && !Array.isArray(attempt) ? (attempt as Record<string, unknown>).targetOverrideRefusal : undefined;
    if (!refusal || typeof refusal !== "object" || Array.isArray(refusal)) return undefined;
    const { status, reason } = refusal as Record<string, unknown>;
    if (status !== "absent" && status !== "ambiguous") return undefined;
    if (reason === undefined) return status;
    return typeof reason === "string" && reason.length <= REFUSAL_CASE_MAX_LENGTH && REFUSAL_CASE.test(reason) ? reason : undefined;
  });
}

/** The parser's codes, and the refusal's case beside the rejection it explains. */
function withRefusalCase(issueCodes: readonly string[], refusalCase: string | undefined): string[] {
  const codes = [...issueCodes];
  if (refusalCase === undefined || !codes.includes(TARGET_OVERRIDE_REJECTED)) return codes;
  const specific = `${TARGET_OVERRIDE_REJECTED}.${refusalCase}`;
  return codes.includes(specific) ? codes : [...codes, specific];
}

function emptyList(value: unknown): boolean {
  return value === undefined || value === null || (Array.isArray(value) && value.length === 0);
}

function identifiers(values: readonly string[], at: string): string[] {
  return values.map((value, index) => {
    if (value.length > IDENTIFIER_MAX_LENGTH || !IDENTIFIER.test(value)) {
      throw new RunnerFailure("environment.missing", `Malformed FluxIQ API response: ${at}[${index}] must be a Core identifier of at most ${IDENTIFIER_MAX_LENGTH} characters`);
    }
    return value;
  });
}
