// A bounded, content-free copy of a record Core wrote about a run.
//
// The decision trace (`read-decision-trace.ts`) copies Core's recovery and
// re-author records out of a run before the run root is deleted. Those records
// are Core's own nested JSON, and naming every member of every one of them here
// would be a second copy of Core's schema that falls behind the first. So the
// rule is the one `existing-fluxiq-control/publishable-step-value.ts` applies to
// a decision row, applied through the tree: a count, a flag, and a string with a
// code's shape travel; a sentence, a selector, an address and a label do not,
// because the test is the value's shape and not its name. Decision rows met on
// the way (`{ toolId, ... }`) go through `publishableStepFields` itself, so a
// refused amendment reads the same here as in the build's own record.
//
// Two further guards, because a nested record is not a decision row: members
// whose *name* says they hold content (a label, a value, a URL, a message) are
// dropped whatever their shape, since a one-word label passes the shape test;
// and the tree is bounded in depth, width and length so a record cannot grow
// the bundle without limit.

import { publishableStepFields, publishableStepValue, type PublishableStepValue } from "../../existing-fluxiq-control/index.js";

/** The deepest a copied record may nest, the most members one record keeps, and the most entries one list keeps. */
const MAX_DEPTH = 6;
const MAX_RECORD_FIELDS = 48;
const MAX_LIST_ENTRIES = 32;
/** A decision-row list is Core's own trace, bounded by Core at two rows a decision; this is the Lab's bound on it (`adaptation-evidence-loop.ts`). */
const MAX_STEP_ROWS = 129;
/** A member name Core would write: a plain identifier, never a path or a sentence. */
const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/u;
/**
 * Names whose values are content rather than accounting. A value under one of
 * these is dropped even when it has a code's shape, because a one-word label,
 * a price or a host name has one.
 */
const CONTENT_FIELD = /(?:label|text|value|values|selector|url|href|host|origin|title|name|query|prompt|reply|content|message|reason|answer|instruction|body|header|cookie|token|secret|key|password|summary|description|example|sample|record|records|row|rows|field|fields|input|inputs|output|outputs)$/iu;

/** What one copied member may hold. */
export type PublishableTree = PublishableStepValue | readonly PublishableTree[] | { readonly [field: string]: PublishableTree };

/**
 * The publishable part of `value`, or `undefined` when none of it may travel.
 * An emptied record or list is `undefined` too, so "nothing publishable" and
 * "absent" read alike and the copy never carries a husk.
 */
export function publishableTree(value: unknown, depth = 0): PublishableTree | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "object") return publishableStepValue(value, true);
  if (depth >= MAX_DEPTH) return undefined;
  if (Array.isArray(value)) return publishableList(value, depth);
  const members: Record<string, PublishableTree> = {};
  for (const [field, member] of Object.entries(value as Record<string, unknown>)) {
    if (Object.keys(members).length >= MAX_RECORD_FIELDS) break;
    if (!FIELD_NAME.test(field) || CONTENT_FIELD.test(field)) continue;
    const kept = publishableTree(member, depth + 1);
    if (kept !== undefined) members[field] = kept;
  }
  return Object.keys(members).length === 0 ? undefined : Object.freeze(members);
}

function publishableList(value: readonly unknown[], depth: number): PublishableTree | undefined {
  if (value.length > 0 && value.every(isDecisionRow)) {
    const rows = value.slice(0, MAX_STEP_ROWS).flatMap((row) => {
      const toolId = publishableStepValue(row.toolId, true);
      return typeof toolId === "string" ? [Object.freeze({ toolId, ...publishableStepFields(row) })] : [];
    });
    return rows.length === 0 ? undefined : Object.freeze(rows);
  }
  const kept = value.slice(0, MAX_LIST_ENTRIES).flatMap((entry) => {
    const member = publishableTree(entry, depth + 1);
    return member === undefined ? [] : [member];
  });
  return kept.length === 0 ? undefined : Object.freeze(kept);
}

function isDecisionRow(value: unknown): value is Record<string, unknown> & { toolId: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value) && typeof (value as Record<string, unknown>).toolId === "string";
}
