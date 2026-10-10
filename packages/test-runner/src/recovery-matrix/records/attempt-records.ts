// What a run's own attempt records say, in the closed words a matrix check
// judges by.
//
// The plan's trace contract (Core document C11) puts three records on an
// attempt: `lifecycle` (the event, the handler that ran, its disposition and
// whether its completion check held), `entry` (on a frame's first attempt: the
// entry it began at), and `stateRouting` (what the page made the run do when a
// step could not run, with the guard that refused a way on). Core's run detail
// carries each attempt as `get-flow-run-detail` returns it; this reads those
// fields where they are, on the attempt or under its `metadata`, and keeps only
// closed words, node ids and booleans. Evidence text, condition values and page
// words never leave Core through here.
//
// A Core that dispatches no handlers writes no `lifecycle`; one that chooses
// no entries writes no `entry`. Absent is reported as absent, and a check that
// needs the record says the row is not proven rather than reading the absence
// as a pass.

import { attemptNodeId } from "../../flow-lane/index.js";

export type MatrixLifecycleRecord = Readonly<{
  event: string;
  /** The handler's node id: Core writes `<graphFlowId>/<nodeId>`, and this is the part after the last `/`. */
  handlerId: string | null;
  /** The whole `<graphFlowId>/<nodeId>` as Core wrote it, which tells two graphs' handlers apart; `null` when unreadable. */
  handlerRef: string | null;
  disposition: string | null;
  /** `true`, `false` or `unknown`: what the handler's completion check came to; `null` when none was evaluated. */
  completionCheck: "true" | "false" | "unknown" | null;
}>;

export type MatrixEntryRecord = Readonly<{ kind: string; id: string | null }>;

export type MatrixStateRoutingRecord = Readonly<{
  outcome: string;
  toNodeId: string | null;
  /** Each way on a safety guard refused, by guard and target. */
  refused: readonly Readonly<{ guard: string; toNodeId: string | null }>[];
}>;

export type MatrixAttemptRecord = Readonly<{
  order: number;
  nodeId: string | null;
  definitionId: string | null;
  status: string;
  /** Core's `metadata.retry` is present: this attempt is a retry of its node. */
  retry: boolean;
  failure: Readonly<{ category: string | null; code: string | null }> | null;
  framePath: readonly string[] | null;
  lifecycle: MatrixLifecycleRecord | null;
  entry: MatrixEntryRecord | null;
  stateRouting: MatrixStateRoutingRecord | null;
}>;

const EVENTS = new Set(["start", "before", "retry", "fail", "before_next"]);
const DISPOSITIONS = new Set(["resume", "route", "resolve", "unhandled"]);
const ENTRY_KINDS = new Set(["default", "entry", "checkpoint", "resume"]);
const ROUTING_OUTCOMES = new Set(["effect_holds", "routed", "no_match", "unobserved", "no_pre_states", "guard_stopped"]);
const GUARDS = new Set(["unbound_value", "repeats_lasting_act", "frame", "checkpoint_when", "ready_state"]);
const STATUSES = new Set(["succeeded", "failed", "skipped", "cancelled", "waiting", "running", "retried", "timed_out"]);
const CODE = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u;
const CATEGORY = /^[a-z][a-z_]{0,63}$/u;
const MAX_FRAMES = 16;

/** Every attempt in Core's attempt order, read into closed records. */
export function matrixAttemptRecords(runDetail: Readonly<Record<string, unknown>>): MatrixAttemptRecord[] {
  const attempts = Array.isArray(runDetail.actionAttempts) ? runDetail.actionAttempts : [];
  return attempts
    .filter((value): value is Record<string, unknown> => record(value) !== undefined)
    .map((attempt, index) => ({ attempt, order: typeof attempt.order === "number" && Number.isFinite(attempt.order) ? attempt.order : index }))
    .sort((left, right) => left.order - right.order)
    .map(({ attempt, order }) => {
      const metadata = record(attempt.metadata) ?? {};
      return {
        order,
        nodeId: typeof attempt.nodeId === "string" ? attemptNodeId(attempt.nodeId) : null,
        definitionId: typeof attempt.definitionId === "string" && /^[a-z][a-z0-9_.-]{0,127}$/u.test(attempt.definitionId) ? attempt.definitionId : null,
        status: typeof attempt.status === "string" && STATUSES.has(attempt.status) ? attempt.status : "unknown",
        retry: record(metadata.retry) !== undefined,
        failure: failureOf(attempt.failure),
        framePath: framePathOf(attempt.framePath ?? metadata.framePath),
        lifecycle: lifecycleOf(attempt.lifecycle ?? metadata.lifecycle),
        entry: entryOf(attempt.entry ?? metadata.entry),
        stateRouting: stateRoutingOf(attempt.stateRouting ?? metadata.stateRouting),
      };
    });
}

function failureOf(value: unknown): MatrixAttemptRecord["failure"] {
  const failure = record(value);
  if (!failure) return null;
  return {
    category: typeof failure.category === "string" && CATEGORY.test(failure.category) ? failure.category : null,
    code: typeof failure.code === "string" && failure.code.length <= 120 && CODE.test(failure.code) ? failure.code : null,
  };
}

function framePathOf(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.length > MAX_FRAMES) return null;
  const frames = value.map(frame => (typeof frame === "string" ? attemptNodeId(frame) ?? frameName(frame) : null));
  return frames.every((frame): frame is string => frame !== null) ? frames : null;
}

/** A frame named by a Subflow id rather than a node id: the same safe identifier shape. */
function frameName(value: string): string | null {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(value) ? value : null;
}

function lifecycleOf(value: unknown): MatrixLifecycleRecord | null {
  const lifecycle = record(value);
  if (!lifecycle || typeof lifecycle.event !== "string" || !EVENTS.has(lifecycle.event)) return null;
  const disposition = record(lifecycle.disposition)?.kind ?? lifecycle.disposition;
  return {
    event: lifecycle.event,
    ...handlerOf(lifecycle.handlerId),
    disposition: typeof disposition === "string" && DISPOSITIONS.has(disposition) ? disposition : null,
    completionCheck: checkResult(record(lifecycle.completionCheck)?.result ?? lifecycle.completionCheck),
  };
}

/**
 * A handler as Core names it, `<graphFlowId>/<nodeId>` (the graph its
 * registration is stored in, then the handler node). Until t404 this was read
 * as one node id, which no handler id is, so every handler read as `null` and
 * a check that a handler did not run passed whatever ran.
 */
function handlerOf(value: unknown): Pick<MatrixLifecycleRecord, "handlerId" | "handlerRef"> {
  if (typeof value !== "string") return { handlerId: null, handlerRef: null };
  const cut = value.lastIndexOf("/");
  const nodePart = cut < 0 ? value : value.slice(cut + 1);
  const graphPart = cut < 0 ? null : value.slice(0, cut);
  const handlerId = attemptNodeId(nodePart) ?? frameName(nodePart);
  const graph = graphPart === null ? null : frameName(graphPart);
  return { handlerId, handlerRef: handlerId === null ? null : graph === null ? (cut < 0 ? handlerId : null) : `${graph}/${handlerId}` };
}

function checkResult(value: unknown): MatrixLifecycleRecord["completionCheck"] {
  if (value === true || value === "true") return "true";
  if (value === false || value === "false") return "false";
  if (value === "unknown") return "unknown";
  return null;
}

function entryOf(value: unknown): MatrixEntryRecord | null {
  const entry = record(value);
  if (!entry || typeof entry.kind !== "string" || !ENTRY_KINDS.has(entry.kind)) return null;
  return { kind: entry.kind, id: typeof entry.id === "string" ? attemptNodeId(entry.id) ?? frameName(entry.id) : null };
}

function stateRoutingOf(value: unknown): MatrixStateRoutingRecord | null {
  const routing = record(value);
  if (!routing || typeof routing.outcome !== "string" || !ROUTING_OUTCOMES.has(routing.outcome)) return null;
  const refused = (Array.isArray(routing.refused) ? routing.refused : [])
    .map(record)
    .filter((item): item is Record<string, unknown> => item !== undefined && typeof item.guard === "string" && GUARDS.has(item.guard))
    .map(item => ({ guard: item.guard as string, toNodeId: typeof item.toNodeId === "string" ? attemptNodeId(item.toNodeId) : null }));
  return { outcome: routing.outcome, toNodeId: typeof routing.toNodeId === "string" ? attemptNodeId(routing.toNodeId) : null, refused };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
