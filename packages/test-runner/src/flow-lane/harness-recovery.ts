import { harnessRecoveryRungs, isCoreCode, isCoreIdentifier, isCoreKind, validateRunHarnessRecovery, type HarnessRecoveryRung, type RunHarnessPatchAttempt, type RunHarnessRecovery, type RunHarnessRecoveryContextSections, type RunHarnessResultReauthor, type RunHarnessResultRepair } from "@fluxiq-web-extension/test-contracts";
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
  if (!recoveryRecorded(runDetail)) return conforming({ attempted: false, interventions: [], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [], ...recoveryRefusal(runDetail), ...refutedResultRoute(runDetail) });
  const detail = await control.getRunDetail(scope.projectId, scope.runId, bounds);
  // Core's result checks are filed as interventions too, marked by their source; the parser drops the mark, so it is read from the raw detail by id.
  const checkIds = resultCheckInterventionIds(runDetail);
  const parsed = detail.interventions ?? [];
  const reduced = (item: (typeof parsed)[number]) => ({ kind: item.kind, validationOk: item.validationOk ?? null, validationCodes: [...(item.validationCodes ?? [])] });
  const interventions = parsed.filter((item) => !checkIds.has(item.interventionId)).map(reduced);
  const resultChecks = parsed.filter((item) => checkIds.has(item.interventionId)).map(reduced);
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
  // loop's own reasons -- the plan asked for no patch, the run's intent
  // allowed none, a person's answer was needed -- had nowhere to go the moment
  // a single intervention existed. What silences it now is a recovery that
  // produced something, because then the lists are the answer.
  const produced = runtimePatchAttempts.length + adaptationIds.length + changeProposalIds.length > 0;
  const contextSections = recoveryContextSections(runDetail);
  return conforming({ attempted, interventions, runtimePatchAttempts, adaptationIds, changeProposalIds, ...(produced ? { refusalCode: null, refusalRung: null } : recoveryRefusal(runDetail)), ...(contextSections !== undefined ? { contextSections } : {}), ...refutedResultRoute(runDetail), ...(resultChecks.length > 0 ? { resultChecks } : {}) });
}

/** The source Core marks a post-run result check's intervention with (`result-verification/verify.ts`). */
const RESULT_CHECK_SOURCE = "verifyAutomationStudioRunResult";

/**
 * The ids of the interventions that were Core's result checks, not recovery.
 * Core files each check as a run intervention whose `metadata.source` names
 * the verifier; the control client's parser keeps `kind` and drops the
 * source, so read alone, two checks of a run that needed no recovery were
 * published as two diagnoses (run-murwd8le-79e735a8, Cause 12).
 */
function resultCheckInterventionIds(runDetail: Readonly<Record<string, unknown>>): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(runDetail.interventions)) return ids;
  for (const item of runDetail.interventions) {
    const intervention = plainRecord(item);
    if (typeof intervention?.interventionId === "string" && isResultCheckIntervention(intervention)) ids.add(intervention.interventionId);
  }
  return ids;
}

/**
 * Whether one run intervention was Core's post-run result check rather than
 * the harness acting: a check, never a recovery or a harness activation.
 */
export function isResultCheckIntervention(item: unknown): boolean {
  return plainRecord(plainRecord(item)?.metadata)?.source === RESULT_CHECK_SOURCE;
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
  const gate = plainRecord(metadataValue(runDetail, "llmGate"));
  if (!gate) return none;
  const { invoked, code, patchSkippedCode, patchSkippedRung, patchHeldCode, patchHeldRung } = gate;
  if (invoked === false && code !== undefined) return { refusalCode: code as string, refusalRung: "gate" };
  if (patchSkippedCode !== undefined) return { refusalCode: patchSkippedCode as string, refusalRung: rung(patchSkippedRung) };
  if (patchHeldCode !== undefined) return { refusalCode: patchHeldCode as string, refusalRung: rung(patchHeldRung) ?? "resolution" };
  return none;
}

/**
 * Which sections of Core's recovery context the model was shown, and why each
 * other one was not.
 *
 * Core has written this on every run since the context existed -- the summary
 * in its `recovery/context-summary.ts`, which carries section names, byte
 * counts and reasons and never a section's contents, built so that a test could
 * require a section was carried without the test holding page data. Nothing
 * here read it, so "was the model told what it should have been told" was a
 * question a run could not answer. `recovered_failures` is the immediate
 * reason it matters: a repair that cannot see what the run was rescued from is
 * being asked to explain a page it has only seen once, at its worst moment.
 *
 * Names and Core's reasons only. Byte counts are deliberately left behind --
 * they say nothing this lane asserts on, and a size is one more number to keep
 * stable in a fixture.
 */
function recoveryContextSections(runDetail: Readonly<Record<string, unknown>>): RunHarnessRecoveryContextSections | null | undefined {
  const gate = plainRecord(metadataValue(runDetail, "llmGate"));
  if (!gate) return undefined;
  const summary = gate.recoveryContext;
  if (summary === undefined) return undefined;
  const sections = plainRecord(summary);
  if (!sections) return null;
  const { included, omitted } = sections;
  return {
    included: entries(included).map((entry) => String(entry.section)),
    omitted: entries(omitted).map((entry) => ({ section: String(entry.section), reason: String(entry.reason) }))
  };
}

/**
 * What became of the route a wrong answer takes back into the build loop, and
 * Core's marker that the result reached the failure entry point at all.
 *
 * **This is the fact six live runs could not state.** Core decides the route in
 * `runtime/recovery/refuted-result/reauthor.ts` and records the decision on the
 * run under `resultReauthor`, with its sibling `resultRepair` for the marker;
 * both were computed, both were stored, and neither reached a bundle. A reader
 * of `run-muhpo10p-771abad6` saw `runtimePatchAttempts: []` and a `null`
 * refusal, which reads as a repair loop switched off, and the cause was twice
 * attributed to the wrong gate.
 *
 * Each member is absent when Core wrote nothing under its key, so a run that
 * never reached the route is never published as one that was refused. The
 * mutation this is written against: defaulting either member to a
 * "not attempted" record.
 */
function refutedResultRoute(runDetail: Readonly<Record<string, unknown>>): Pick<RunHarnessRecovery, "resultReauthor" | "resultRepair"> {
  const reauthor = resultReauthor(metadataValue(runDetail, "resultReauthor"));
  const repair = resultRepair(metadataValue(runDetail, "resultRepair"));
  return {
    ...(reauthor === undefined ? {} : { resultReauthor: reauthor }),
    ...(repair === undefined ? {} : { resultRepair: repair }),
  };
}

/**
 * Core's `resultReauthor` record, as closed words, Core identifiers and flags.
 *
 * Core writes one of two shapes -- `{ routed: true, adaptationId?, applied?,
 * code? }` or `{ routed: false, code: <one of four refusal words> }` -- so the
 * one key `code` means two different things, and they are separated here:
 * `refusal` for the gate that closed the route, `failureCode` for the step a
 * taken route failed at. Reading them into one member would publish a refusal
 * word as if a step had failed under it.
 *
 * A value Core wrote in a shape this record cannot carry becomes `null` rather
 * than failing the read. This is a note *about* a run whose outcome Core has
 * already decided, and a whole product result must not be thrown away over it.
 */
function resultReauthor(value: unknown): RunHarnessResultReauthor | null | undefined {
  if (value === undefined) return undefined;
  const record = plainRecord(value);
  if (!record) return null;
  const routed = record.routed === true;
  const code = record.code;
  return {
    routed,
    // Core's word for the gate, only on the side of the decision that has one.
    refusal: !routed && isCoreKind(code) ? code : null,
    adaptationId: routed && isCoreIdentifier(record.adaptationId) ? record.adaptationId : null,
    applied: routed && record.applied === true,
    failureCode: routed && isCoreCode(code) ? code : null,
    // What kind of failure that code was. Only on a taken route, and each one
    // only where Core recorded it: the code alone is a stage's default and says
    // nothing a reader can act on (`@fluxiq-web-extension/test-contracts`).
    ...(routed && isCoreKind(record.stage) ? { failureStage: record.stage } : {}),
    ...(routed && typeof record.retryable === "boolean" ? { failureRetryable: record.retryable } : {}),
    ...(routed && isCoreKind(record.providerInvocation) ? { providerInvocation: record.providerInvocation } : {}),
    ...(routed && isCoreKind(record.providerResponse) ? { providerResponse: record.providerResponse } : {}),
    ...(routed && Number.isSafeInteger(record.providerStatus) ? { providerStatus: record.providerStatus as number } : {}),
  };
}

/** Core's `resultRepair` marker: whether the result entered the failure entry point, the node it was filed against, and the verdict code that sent it there. */
function resultRepair(value: unknown): RunHarnessResultRepair | null | undefined {
  if (value === undefined) return undefined;
  const record = plainRecord(value);
  if (!record) return null;
  const attempted = record.attempted === true;
  return {
    attempted,
    nodeId: attempted && isCoreIdentifier(record.nodeId) ? record.nodeId : null,
    // Core writes an empty string where the verification did not perform, which
    // is no code rather than a code of no characters.
    code: isCoreCode(record.code) ? record.code : null,
  };
}

/** One member of Core's run metadata, or nothing when the run carries no metadata record. */
function metadataValue(runDetail: Readonly<Record<string, unknown>>, key: string): unknown {
  return plainRecord(runDetail.metadata)?.[key];
}

/** A plain record, or nothing when the value is absent, null, a list or a scalar. */
function plainRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

/** A list of Core's `{ section, ... }` records, or nothing when it is not one. */
function entries(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry) && typeof entry.section === "string");
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
  const attempts = metadataValue(runDetail, "runtimePatchAttempts");
  if (!Array.isArray(attempts)) return [];
  return attempts.map((attempt) => {
    const refusal = plainRecord(plainRecord(attempt)?.targetOverrideRefusal);
    if (!refusal) return undefined;
    const { status, reason } = refusal;
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
