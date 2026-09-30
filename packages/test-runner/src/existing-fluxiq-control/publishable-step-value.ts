// What may travel out of Core's audit detail on one decision row, decided by
// the shape of each value rather than by a list of field names.
//
// Two readers publish those rows -- `adaptation-evidence-loop.ts` for a build
// Core proposed, `flow-lane/creation/build-proposal.ts` for one it refused --
// and the rule has to be the same in both, or a proposed build and a refused
// one stop reading alike. It was a three-field whitelist written out in each
// of them, so widening the record meant widening it in two places and
// forgetting one. This is the one copy.
//
// The policy it enforces is unchanged and load-bearing: nothing the tool
// returned and nothing the model wrote is admitted. An identifier, a closed
// code, a count, a byte size, a flag and a timestamp pass; a prompt, a reply,
// free text, a selector, an address and a control's label do not. Because the
// test is the value's shape and not its name, a member Core adds later is
// carried through with no change here and the guarantee still holds.

/**
 * The most members one row may carry, counting its `toolId`, and the most one
 * nested record or list inside it.
 */
const MAX_STEP_FIELDS = 24;
const MAX_STEP_RECORD_FIELDS = 24;
const MAX_STEP_LIST_ENTRIES = 32;
/** Core's own maximum number of draft targets on one amendment decision. */
const MAX_DRAFT_CHANGE_TARGETS = 16;
/** The shape a field name must have to be one Core wrote: a plain member name, never a path or a sentence. */
const STEP_FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/u;
/**
 * The shape a string must have to travel. This is Core's own rule for a code
 * (`flow-bootstrap-commands/evidence-trace.ts`), widened only by `+` so a
 * timestamp's UTC offset survives. It admits no whitespace, so it admits no
 * sentence.
 */
const PUBLISHABLE_TEXT = /^[A-Za-z0-9_.:+-]{1,128}$/u;
/** Content-derived digests are not stable build-local identities and must not become evidence. */
const CONTENT_DIGEST = /^(?:sha(?:1|224|256|384|512)[:.-])?[a-f0-9]{32,}$/iu;
/** The identifier grammar Core applies to a published evidence-loop step id. */
const EVIDENCE_STEP_ID = /^[a-z0-9_.:-]{1,200}$/iu;

const PROGRESS_FIELDS = new Set(["draftRevisionBefore", "draftRevisionAfter", "pageState", "draftState", "answerabilityState"]);
const DRAFT_CHANGE_FIELDS = new Set(["targetedStepIds", "appliedCount", "refusedCount", "keptStepCount", "rerunStepId"]);
const DRAFT_FIELDS = new Set(["bytes", "budget", "steps", "instructionBytes", "unlisted", "withoutInput", "inputTooLarge", "overBudget", "budgetBelowFloor"]);
const ANSWERABILITY_FIELDS = new Set(["recordsRequested", "recordProducerPresent", "recordStorePresent", "issueCode"]);
const AMENDMENT_REFUSAL_FIELDS = new Set(["step", "reason", "nodeId"]);
/**
 * Why an amendment changed nothing, in the draft's own closed vocabulary (Core
 * `flow-bootstrap/evidence-loop-steps.ts`, `EVIDENCE_STEP_AMENDMENT_REFUSAL_REASONS`).
 * A reason outside it refuses the whole list, as Core's reader of a stored step does.
 */
const AMENDMENT_REFUSAL_REASONS: readonly string[] = ["no_such_step", "already_so", "no_such_position", "run_by_the_loop", "no_step_before_it", "not_a_kept_step"];
/** Core's own bounds on one step's refusals: the most amendments one decision may carry, and the largest position a refusal may name. */
const MAX_AMENDMENT_REFUSALS = 16;
const MAX_AMENDED_POSITION = 9_999;
/** Core's flat refusal form, `<step>:<reason>[:<node>]`. Its node part may run past `PUBLISHABLE_TEXT`'s 128, which is how the generic rule dropped it. */
const AMENDMENT_REFUSAL_CODE = /^([0-9]{1,4}):([a-z_]{1,40})(?::([a-z0-9_.:-]{1,200}))?$/iu;

type PublishableStepScalar = string | number | boolean;
type PublishableStepRecordValue = PublishableStepScalar | readonly PublishableStepScalar[];
/** One refused amendment: the draft position the model named, the draft's closed reason, and the node where Core resolved one. */
export type PublishableAmendmentRefusal = Readonly<{ step: number; reason: string; nodeId?: string }>;
/**
 * What one member of a decision row may hold: a count, a flag, a closed code or
 * identifier, a bounded list of those, a bounded one-level record of them, or --
 * for `amendmentsRefused` alone -- Core's bounded list of refused amendments.
 */
export type PublishableStepValue = PublishableStepScalar | readonly PublishableStepScalar[] | Readonly<Record<string, PublishableStepRecordValue>> | readonly PublishableAmendmentRefusal[];

/**
 * One member of a decision row, or `undefined` for one that may not travel.
 *
 * Numbers and flags are kept as they are. A string is kept only when it has a
 * code's shape. A list keeps the members of it that do, as
 * `exploration-record.ts` does with a list of codes, and a record -- Core's
 * per-call `usage` today -- keeps the members of it that are scalars of the
 * same kind. Lists inside generic records do not travel. The sole nested-list
 * seam, `draftChange.targetedStepIds`, is handled atomically by
 * `publishableStepFields`: silently filtering or truncating an amendment's
 * targets would publish a different claim. Nothing nests further than that.
 */
export function publishableStepValue(value: unknown, nested = false): PublishableStepValue | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") return PUBLISHABLE_TEXT.test(value) && !CONTENT_DIGEST.test(value) ? value : undefined;
  if (typeof value !== "object" || value === null) return undefined;
  if (nested) return undefined;
  if (Array.isArray(value)) {
    const kept = publishableScalarList(value);
    return kept.length === 0 ? undefined : Object.freeze(kept);
  }
  if (!isRecord(value)) return undefined;
  const members: Record<string, PublishableStepRecordValue> = {};
  for (const [field, member] of Object.entries(value)) {
    if (!STEP_FIELD_NAME.test(field) || Object.keys(members).length >= MAX_STEP_RECORD_FIELDS) continue;
    const kept = publishableStepValue(member, true);
    if (Array.isArray(kept) && kept.length === 0) continue;
    if (kept !== undefined) members[field] = kept as PublishableStepRecordValue;
  }
  return Object.keys(members).length === 0 ? undefined : Object.freeze(members);
}

function publishableScalarList(value: readonly unknown[]): PublishableStepScalar[] {
  return value.slice(0, MAX_STEP_LIST_ENTRIES).flatMap((item) => {
    const member = publishableStepValue(item, true);
    return member === undefined || typeof member === "object" ? [] : [member];
  });
}

/**
 * Every member of a decision row that may travel, except `toolId`: the row's
 * own identity, which each reader takes by its own rule -- one refuses a
 * malformed record, the other drops the row -- and writes itself.
 *
 * A member is left behind only for failing the shape test above or for having
 * a name no producer would write. Nothing is dropped for not being recognized.
 */
export function publishableStepFields(entry: Record<string, unknown>): Record<string, PublishableStepValue> {
  const fields: Record<string, PublishableStepValue> = {};
  for (const [field, value] of Object.entries(entry)) {
    // `toolId` is already the first of the row's members, so it is counted here.
    if (field === "toolId" || !STEP_FIELD_NAME.test(field) || Object.keys(fields).length + 1 >= MAX_STEP_FIELDS) continue;
    const kept = publishableNamedStepField(field, value);
    if (kept !== undefined) fields[field] = kept;
  }
  return fields;
}

/**
 * Core's four progress records are named public shapes, rather than arbitrary
 * one-level records. Validate them as a unit before publishing them so the
 * runtime contract matches the narrower TypeScript types exposed by both
 * build readers. Every other member retains the generic legacy shape rule.
 */
function publishableNamedStepField(field: string, value: unknown): PublishableStepValue | undefined {
  if (field === "progress") return progressRecord(value);
  if (field === "draftChange") return draftChangeRecord(value);
  if (field === "draft") return draftRecord(value);
  if (field === "answerability") return answerabilityRecord(value);
  if (field === "amendmentsRefused") return amendmentRefusalList(value);
  if (field === "amendmentRefusals") return amendmentRefusalCodes(value);
  return publishableStepValue(value);
}

function progressRecord(value: unknown): PublishableStepValue | undefined {
  if (!isExactRecord(value, PROGRESS_FIELDS)
    || !nonNegativeInteger(value.draftRevisionBefore) || !nonNegativeInteger(value.draftRevisionAfter)
    || !oneOf(value.pageState, ["changed", "unchanged", "unobserved"])
    || !oneOf(value.draftState, ["changed", "unchanged"])
    || !oneOf(value.answerabilityState, ["first_observed", "changed", "unchanged", "unobserved"])) return undefined;
  return Object.freeze({
    draftRevisionBefore: value.draftRevisionBefore,
    draftRevisionAfter: value.draftRevisionAfter,
    pageState: value.pageState,
    draftState: value.draftState,
    answerabilityState: value.answerabilityState,
  });
}

function draftChangeRecord(value: unknown): PublishableStepValue | undefined {
  if (!isExactRecord(value, DRAFT_CHANGE_FIELDS) || !Array.isArray(value.targetedStepIds)
    || value.targetedStepIds.length > MAX_DRAFT_CHANGE_TARGETS
    || !value.targetedStepIds.every(buildLocalStepId)
    || new Set(value.targetedStepIds).size !== value.targetedStepIds.length
    || !nonNegativeInteger(value.appliedCount) || !nonNegativeInteger(value.refusedCount) || !nonNegativeInteger(value.keptStepCount)
    || (value.rerunStepId !== undefined && !buildLocalStepId(value.rerunStepId))) return undefined;
  return Object.freeze({
    targetedStepIds: Object.freeze([...value.targetedStepIds]) as readonly string[],
    appliedCount: value.appliedCount,
    refusedCount: value.refusedCount,
    keptStepCount: value.keptStepCount,
    ...(value.rerunStepId === undefined ? {} : { rerunStepId: value.rerunStepId }),
  });
}

function draftRecord(value: unknown): PublishableStepValue | undefined {
  if (!isExactRecord(value, DRAFT_FIELDS)
    || !nonNegativeInteger(value.bytes) || !nonNegativeInteger(value.budget)
    || !nonNegativeInteger(value.steps) || !nonNegativeInteger(value.instructionBytes)
    || !optionalNonNegativeInteger(value.unlisted) || !optionalNonNegativeInteger(value.withoutInput) || !optionalNonNegativeInteger(value.inputTooLarge)
    || !optionalTrue(value.overBudget) || !optionalTrue(value.budgetBelowFloor)) return undefined;
  return Object.freeze({ ...value }) as Readonly<Record<string, PublishableStepRecordValue>>;
}

function answerabilityRecord(value: unknown): PublishableStepValue | undefined {
  if (!isExactRecord(value, ANSWERABILITY_FIELDS)
    || typeof value.recordsRequested !== "boolean" || typeof value.recordProducerPresent !== "boolean" || typeof value.recordStorePresent !== "boolean"
    || (value.issueCode !== undefined && value.issueCode !== "bootstrap.cannot_answer_instruction")) return undefined;
  return Object.freeze({ ...value }) as Readonly<Record<string, PublishableStepRecordValue>>;
}

/**
 * Core's refused amendments, validated as a unit.
 *
 * The generic rule keeps no list of records, so this list reached every bundle
 * as nothing: `run-mulx76vv-a882551e` refused eighteen amendments and the
 * bundle kept no reason and no node for any of them. Every member is a
 * position, a code from the draft's closed set, or a node identifier -- the
 * three things Core's own reader of a stored step admits -- and a list holding
 * anything else is refused whole rather than filtered, because a shorter list
 * would claim fewer refusals than Core made.
 */
function amendmentRefusalList(value: unknown): PublishableStepValue | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_AMENDMENT_REFUSALS) return undefined;
  const refusals: PublishableAmendmentRefusal[] = [];
  for (const refusal of value) {
    if (!isExactRecord(refusal, AMENDMENT_REFUSAL_FIELDS) || !amendedPosition(refusal.step) || !oneOf(refusal.reason, AMENDMENT_REFUSAL_REASONS)
      || (refusal.nodeId !== undefined && !buildLocalStepId(refusal.nodeId))) return undefined;
    refusals.push(Object.freeze({ step: refusal.step, reason: refusal.reason, ...(refusal.nodeId === undefined ? {} : { nodeId: refusal.nodeId as string }) }));
  }
  return Object.freeze(refusals);
}

/** The same refusals in Core's flat form, held to the same closed reasons and node grammar, and refused whole on any member that is not one. */
function amendmentRefusalCodes(value: unknown): PublishableStepValue | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_AMENDMENT_REFUSALS) return undefined;
  for (const code of value) {
    const match = typeof code === "string" ? AMENDMENT_REFUSAL_CODE.exec(code) : null;
    if (!match || !oneOf(match[2], AMENDMENT_REFUSAL_REASONS) || (match[3] !== undefined && !buildLocalStepId(match[3]))) return undefined;
  }
  return Object.freeze([...value] as string[]);
}

function amendedPosition(value: unknown): value is number {
  return nonNegativeInteger(value) && value <= MAX_AMENDED_POSITION;
}

function buildLocalStepId(value: unknown): value is string {
  return typeof value === "string" && EVIDENCE_STEP_ID.test(value) && !CONTENT_DIGEST.test(value);
}

function isExactRecord(value: unknown, fields: ReadonlySet<string>): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).every((field) => fields.has(field));
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function optionalNonNegativeInteger(value: unknown): boolean {
  return value === undefined || nonNegativeInteger(value);
}

function optionalTrue(value: unknown): boolean {
  return value === undefined || value === true;
}

function oneOf(value: unknown, allowed: readonly string[]): value is string {
  return typeof value === "string" && allowed.includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
