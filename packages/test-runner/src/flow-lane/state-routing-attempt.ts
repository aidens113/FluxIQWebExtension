// What an attempt says about the runtime consulting the page when its step
// could not run.
//
// Core's executor reads the page before any recovery rung when a step cannot
// run (t243, `executor/state-routing/`), and the run detail carries what it
// made of it as `stateRouting` (t250, `service/summaries/state-routing.ts`):
// `routed` or `effect_holds` beside the `skipped` mark that already names
// where the run went (`skipped-attempt.ts`); `guard_stopped` with the node it
// would have looped back to; and `no_match`, `unobserved` or `no_pre_states`
// on a step that found no way on and went on to fail or recover. Without it
// a failed step that consulted the page reads exactly like one that never did.
//
// Each outcome may also carry the ways on a safety guard refused (t387,
// `refused: [{ guard, toNodeId }]`, Core's closed guard codes), and a step that
// found no way on why it found none (t661, `noMatchCause`, a closed word). A
// record carrying `refused` was once rejected whole, so a `no_match` whose
// matches were all refused read like no consultation at all; an older Core
// that writes neither still parses.
//
// Each outcome reads only the fields it takes, and every other key -- one a
// newer Core adds, or one this outcome does not take -- is ignored and never
// copied (t657 round 3). A strict key check had dropped the whole record each
// time Core added a field. A field that is read must be in its shape, else the
// record is rejected.
//
// Closed words, a Core code and node ids only: the parse keeps nothing else.

import { attemptNodeId } from "./persisted-attempt.js";

/** Core's state routing outcomes (`executor/contracts.ts`, `AutomationStudioStateRoutingRecord`). */
export type PersistedStateRoutingOutcome = "effect_holds" | "routed" | "no_match" | "unobserved" | "no_pre_states" | "guard_stopped";

/** What the runtime made of the page, and the attempt's span in epoch ms on Core's clock. */
export type PersistedStateRouting = {
  outcome: PersistedStateRoutingOutcome;
  /** The Core code that asked: the readiness gate's, or the attempt's failure code. Absent on `routed` and `effect_holds`, whose `skipped` mark carries it. */
  code?: string;
  /** Only on `guard_stopped`: the node the page kept returning the run to. */
  toNodeId?: string;
  /** Each way on a safety guard refused: the guard's closed code and the node the route led to. Absent when none was refused. */
  refused?: PersistedStateRouteRefusal[];
  /** Only on a step that found no way on: why, as Core's closed word (t661). Absent from an older Core. */
  noMatchCause?: string;
  startedAt: number;
  finishedAt: number;
};

/** A way on Core's safety guard refused (`executor/contracts.ts`, `AutomationStudioStateRouteRefusal`). */
export type PersistedStateRouteRefusal = { guard: string; toNodeId: string };

/** Core's safety guards (C6, "Safe state routing"), the only codes a refused way on keeps. */
const GUARDS: ReadonlySet<string> = new Set(["unbound_value", "repeats_lasting_act", "not_checkpoint", "checkpoint_when_not_true", "ready_state_not_true"]);

/** The shape of a closed word: lowercase words joined by underscores, as Core writes its causes. */
const CLOSED_WORD = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;
const CLOSED_WORD_MAX = 64;

/** The shape of a Core code (`web.target.not_found`): dotted lowercase words. */
const CORE_CODE = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u;

/** The fields each outcome reads and the ones it must have; any other key is ignored. */
const SHAPES: Readonly<Record<PersistedStateRoutingOutcome, { allowed: readonly string[]; required: readonly string[] }>> = {
  routed: { allowed: ["outcome", "refused"], required: ["outcome"] },
  effect_holds: { allowed: ["outcome", "refused"], required: ["outcome"] },
  guard_stopped: { allowed: ["code", "outcome", "toNodeId", "refused"], required: ["outcome", "toNodeId"] },
  no_match: { allowed: ["code", "outcome", "refused", "noMatchCause"], required: ["outcome"] },
  unobserved: { allowed: ["code", "outcome", "refused", "noMatchCause"], required: ["outcome"] },
  no_pre_states: { allowed: ["code", "outcome", "refused", "noMatchCause"], required: ["outcome"] },
};

/**
 * Core's `stateRouting`, in one of its closed shapes, or nothing. The code is
 * kept only in the shape of a Core code, at most 120 characters, and the node
 * only in the shape of a node id (`attemptNodeId`), so a value that could carry
 * page text never reaches the bundle. A step that dispatched nothing may have
 * no finish; it finished when it started.
 */
export function stateRoutingAttemptOf(attempt: Record<string, unknown>, startedAt: number, finishedAt: number | undefined): PersistedStateRouting | undefined {
  const mark = attempt.stateRouting;
  if (typeof mark !== "object" || mark === null || Array.isArray(mark)) return undefined;
  const fields = mark as Record<string, unknown>;
  const { outcome } = fields;
  if (typeof outcome !== "string" || !Object.hasOwn(SHAPES, outcome)) return undefined;
  const shape = SHAPES[outcome as PersistedStateRoutingOutcome];
  const read = (key: string): unknown => shape.allowed.includes(key) ? fields[key] : undefined;
  if (shape.required.some(key => read(key) === undefined)) return undefined;
  const code = read("code");
  const toNodeId = read("toNodeId");
  const noMatchCause = read("noMatchCause");
  if (code !== undefined && (typeof code !== "string" || code.length > 120 || !CORE_CODE.test(code))) return undefined;
  if (toNodeId !== undefined && (typeof toNodeId !== "string" || attemptNodeId(toNodeId) === null)) return undefined;
  if (noMatchCause !== undefined && (typeof noMatchCause !== "string" || noMatchCause.length > CLOSED_WORD_MAX || !CLOSED_WORD.test(noMatchCause))) return undefined;
  const refused = refusedOf(read("refused"));
  if (refused === null) return undefined;
  return {
    outcome: outcome as PersistedStateRoutingOutcome,
    ...(code === undefined ? {} : { code: code as string }),
    ...(toNodeId === undefined ? {} : { toNodeId: toNodeId as string }),
    ...(refused.length ? { refused } : {}),
    ...(noMatchCause === undefined ? {} : { noMatchCause: noMatchCause as string }),
    startedAt,
    finishedAt: finishedAt ?? startedAt,
  };
}

/**
 * Core's refused ways on, each its guard's closed code and a node id and
 * nothing else (any other key on an entry is ignored); absent reads as none.
 * `null` when the list or an entry's guard or node is not in its shape, which
 * rejects the record.
 */
function refusedOf(value: unknown): PersistedStateRouteRefusal[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const refused: PersistedStateRouteRefusal[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return null;
    const { guard, toNodeId } = entry as Record<string, unknown>;
    if (typeof guard !== "string" || !GUARDS.has(guard) || typeof toNodeId !== "string" || attemptNodeId(toNodeId) === null) return null;
    refused.push({ guard, toNodeId });
  }
  return refused;
}
