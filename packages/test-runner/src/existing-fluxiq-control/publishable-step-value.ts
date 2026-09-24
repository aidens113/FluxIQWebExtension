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
/** The shape a field name must have to be one Core wrote: a plain member name, never a path or a sentence. */
const STEP_FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/u;
/**
 * The shape a string must have to travel. This is Core's own rule for a code
 * (`flow-bootstrap-commands/evidence-trace.ts`), widened only by `+` so a
 * timestamp's UTC offset survives. It admits no whitespace, so it admits no
 * sentence.
 */
const PUBLISHABLE_TEXT = /^[A-Za-z0-9_.:+-]{1,128}$/u;

/** What one member of a decision row may hold: a count, a flag, a closed code or identifier, a bounded list of those, or a bounded record of them (Core's per-call `usage`). */
export type PublishableStepValue = string | number | boolean | readonly (string | number | boolean)[] | Readonly<Record<string, string | number | boolean>>;

/**
 * One member of a decision row, or `undefined` for one that may not travel.
 *
 * Numbers and flags are kept as they are. A string is kept only when it has a
 * code's shape. A list keeps the members of it that do, as
 * `exploration-record.ts` does with a list of codes, and a record -- Core's
 * per-call `usage` today -- keeps the members of it that are scalars of the
 * same kind. Nothing nests further than that: a structure deep enough to hold
 * a page is not a member of a decision.
 */
export function publishableStepValue(value: unknown, nested = false): PublishableStepValue | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") return PUBLISHABLE_TEXT.test(value) ? value : undefined;
  if (nested || typeof value !== "object" || value === null) return undefined;
  if (Array.isArray(value)) {
    const kept = value.slice(0, MAX_STEP_LIST_ENTRIES).flatMap((item) => {
      const member = publishableStepValue(item, true);
      return member === undefined ? [] : [member as string | number | boolean];
    });
    return kept.length === 0 ? undefined : Object.freeze(kept);
  }
  if (!isRecord(value)) return undefined;
  const members: Record<string, string | number | boolean> = {};
  for (const [field, member] of Object.entries(value)) {
    if (!STEP_FIELD_NAME.test(field) || Object.keys(members).length >= MAX_STEP_RECORD_FIELDS) continue;
    const kept = publishableStepValue(member, true);
    if (kept !== undefined) members[field] = kept as string | number | boolean;
  }
  return Object.keys(members).length === 0 ? undefined : Object.freeze(members);
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
    const kept = publishableStepValue(value);
    if (kept !== undefined) fields[field] = kept;
  }
  return fields;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
