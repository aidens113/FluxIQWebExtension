// A run's attempts as its own trace holds them, for the records Core's run
// detail does not carry.
//
// `get-flow-run-detail` projects each attempt into the run detail's closed
// fields (`./attempt-records.ts`), and a field it does not project never
// reaches a reader. A stale target's re-acquire (t786) is one: graph-run stamps
// `reacquire` on the attempt that followed it (`AutomationStudioTargetReacquireRecord`:
// the source node, the lineage kind, the outcome and why), and the run
// detail's conversion leaves it out. The runtime session (`get-runtime-session`)
// carries the trace itself, so this reads its `trace.attempts` in order and
// keeps only node ids, closed words, integers and booleans.

import { attemptNodeId } from "../../flow-lane/index.js";

export type MatrixReacquireRecord = Readonly<{
  sourceNodeId?: string | null;
  kind: "row" | "output" | "identity" | null;
  outcome: "found" | "gone" | "unmatched" | "unavailable";
  /** Why it was not found, as Core's or the host's closed word (`ambiguous`, `unidentifiable`); `null` when none. */
  reason: string | null;
  /** The host went back to where the source ran before re-running it. */
  returned?: boolean;
}>;

export type MatrixTraceAttempt = Readonly<{
  /** The attempt's place in the trace, from 0. */
  index: number;
  nodeId: string | null;
  status: string;
  failure: Readonly<{ category: string | null; code: string | null }> | null;
  /** Which attempt of its node's arrival this is, from 2, when it is a retry; `null` for an arrival's first attempt. */
  retryNumber: number | null;
  reacquire: MatrixReacquireRecord | null;
}>;

const STATUSES = new Set(["running", "succeeded", "failed", "waiting", "cancelled"]);
const OUTCOMES = new Set(["found", "gone", "unmatched", "unavailable"]);
const CODE = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u;
const WORD = /^[a-z][a-z_]{0,63}$/u;
const IDENTITY_REASONS = new Set(["ambiguous", "unidentifiable", "observation_unavailable", "observation_incomplete", "place_unproved", "unsupported_target", "no_refresh_declaration", "scope_rejected", "scope_unreadable", "unresolved_parameters", "parameters_unreadable", "host_failed", "malformed_answer", "invalid_patch", "binding_changed", "authority_changed", "action_effect_unavailable", "aborted"]);

/** Every attempt of the runtime session's trace, in trace order; none when the session carries no trace. */
export function matrixTraceAttempts(runtimeSession: unknown): MatrixTraceAttempt[] {
  const trace = record(record(runtimeSession)?.trace);
  const attempts = Array.isArray(trace?.attempts) ? trace.attempts : [];
  return attempts.flatMap((value, index) => {
    const attempt = record(value);
    if (!attempt) return [];
    const retry = record(attempt.retry);
    return [{
      index,
      nodeId: typeof attempt.nodeId === "string" ? attemptNodeId(attempt.nodeId) : null,
      status: typeof attempt.status === "string" && STATUSES.has(attempt.status) ? attempt.status : "unknown",
      failure: failureOf(attempt.failure),
      retryNumber: typeof retry?.attemptNumber === "number" && Number.isInteger(retry.attemptNumber) && retry.attemptNumber > 0 ? retry.attemptNumber : null,
      reacquire: reacquireOf(attempt.reacquire),
    }];
  });
}

function reacquireOf(value: unknown): MatrixReacquireRecord | null {
  const reacquire = record(value);
  if (!reacquire || typeof reacquire.outcome !== "string" || !OUTCOMES.has(reacquire.outcome)) return null;
  if (reacquire.kind === "identity") {
    // Identity recovery has no source lineage. Copy only its closed diagnosis;
    // even a malformed producer cannot make it publish target or patch data.
    if (reacquire.sourceNodeId !== undefined || reacquire.returned !== undefined) return null;
    return {
      kind: "identity",
      outcome: reacquire.outcome as MatrixReacquireRecord["outcome"],
      reason: typeof reacquire.reason === "string" && IDENTITY_REASONS.has(reacquire.reason) ? reacquire.reason : null
    };
  }
  return {
    sourceNodeId: typeof reacquire.sourceNodeId === "string" ? attemptNodeId(reacquire.sourceNodeId) : null,
    kind: reacquire.kind === "row" || reacquire.kind === "output" ? reacquire.kind : null,
    outcome: reacquire.outcome as MatrixReacquireRecord["outcome"],
    reason: typeof reacquire.reason === "string" && WORD.test(reacquire.reason) ? reacquire.reason : null,
    returned: reacquire.returned === true,
  };
}

function failureOf(value: unknown): MatrixTraceAttempt["failure"] {
  const failure = record(value);
  if (!failure) return null;
  return {
    category: typeof failure.category === "string" && WORD.test(failure.category) ? failure.category : null,
    code: typeof failure.code === "string" && failure.code.length <= 120 && CODE.test(failure.code) ? failure.code : null,
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
