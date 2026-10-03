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
// Closed words, a Core code and a node id only: the parse keeps nothing else.

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
  startedAt: number;
  finishedAt: number;
};

/** The shape of a Core code (`web.target.not_found`): dotted lowercase words. */
const CORE_CODE = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u;

/** Each outcome's allowed keys and the ones it must have: a record with any other key is not Core's shape. */
const SHAPES: Readonly<Record<PersistedStateRoutingOutcome, { allowed: readonly string[]; required: readonly string[] }>> = {
  routed: { allowed: ["outcome"], required: ["outcome"] },
  effect_holds: { allowed: ["outcome"], required: ["outcome"] },
  guard_stopped: { allowed: ["code", "outcome", "toNodeId"], required: ["outcome", "toNodeId"] },
  no_match: { allowed: ["code", "outcome"], required: ["outcome"] },
  unobserved: { allowed: ["code", "outcome"], required: ["outcome"] },
  no_pre_states: { allowed: ["code", "outcome"], required: ["outcome"] },
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
  const { outcome, code, toNodeId } = fields;
  if (typeof outcome !== "string" || !Object.hasOwn(SHAPES, outcome)) return undefined;
  const shape = SHAPES[outcome as PersistedStateRoutingOutcome];
  const keys = Object.keys(fields);
  if (keys.some(key => !shape.allowed.includes(key)) || shape.required.some(key => !keys.includes(key))) return undefined;
  if (code !== undefined && (typeof code !== "string" || code.length > 120 || !CORE_CODE.test(code))) return undefined;
  if (toNodeId !== undefined && (typeof toNodeId !== "string" || attemptNodeId(toNodeId) === null)) return undefined;
  return {
    outcome: outcome as PersistedStateRoutingOutcome,
    ...(code === undefined ? {} : { code: code as string }),
    ...(toNodeId === undefined ? {} : { toNodeId: toNodeId as string }),
    startedAt,
    finishedAt: finishedAt ?? startedAt,
  };
}
