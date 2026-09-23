// What an attempt says about the recovery that produced it.
//
// These four members arrived together and answer one question: which recovery
// answered for this node, and at what cost. The node id joins a retried
// attempt back to the node it retried; `retry` names the ladder rung that
// asked for it; `readiness` says what the run did about the state the node
// expected before it ran; and the host's own target resolution names the
// strategy the browser actually found the element by, which is the one
// recovery that leaves no rung behind it.
//
// They live apart from the run reader that calls them because they are read
// by the rung attribution rather than by the run: `recovery-attribution.ts`
// takes the whole measurement from `nodeId`, `retry` and `hostTargetResolution`
// and from nothing else on the attempt.
//
// Every value is rebuilt member by member from something this module
// recognises. A record Core would not have written is read as absent rather
// than half-read, and an identifier that is not identifier-shaped is dropped:
// a rung loses its attribution, and no unbounded string reaches the bundle.

/**
 * The ladder rungs the executor runs itself, in ladder order, as Core names
 * them (`AUTOMATION_STUDIO_LADDER_RUNG_KINDS`). A rung Core adds and this list
 * does not name is read as absent rather than passed through, because this
 * word is what a rung expectation is judged against.
 */
export const PERSISTED_LADDER_RUNGS = ["skip_satisfied_node", "await_recorded_state", "clear_interference", "retry_node"] as const;
export type PersistedLadderRung = (typeof PERSISTED_LADDER_RUNGS)[number];

/** Core's `metadata.retry`: a closed rung name and three integers, nothing else. */
export type PersistedFlowActionRetry = { attemptNumber: number; maxAttempts: number; backoffMs: number; rung: PersistedLadderRung };

/** Core's `metadata.readiness`, without its message, which is the host's sentence. */
export type PersistedFlowActionReadiness = { ceilingMs: number; waitedMs: number; satisfied: boolean; checkedConditionCount: number };

/**
 * The strategies the web host reports (`domain/src/actions/types.ts`,
 * `WebAutomationTargetStrategy`). Closed, because the strategy is what a
 * target-recovery expectation is judged against.
 */
export const PERSISTED_HOST_TARGET_STRATEGIES = ["selector", "coordinates", "visual-target", "fingerprint", "active-element", "scored-candidate"] as const;
export type PersistedHostTargetStrategy = (typeof PERSISTED_HOST_TARGET_STRATEGIES)[number];

/**
 * The browser's own `WebAutomationTargetResolution`, narrowed the way Core's
 * is. Every member is a closed enum or a number; the domain states that as a
 * property of the type and pins it with a test, and Core re-checks it where it
 * projects the record, so nothing derived from the page is here.
 */
export type PersistedHostTargetResolution = { strategy: PersistedHostTargetStrategy; candidateCount: number; bestScore?: number; runnerUpScore?: number; confidence?: number };

/**
 * The shape a Core node id has: an identifier, at most 128 characters, with no
 * whitespace and so no sentence and no page text.
 */
const NODE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

/** Core's node id for the attempt, or `null` where it named none this reader recognises. */
export function attemptNodeId(nodeId: string): string | null {
  return NODE_ID.test(nodeId) ? nodeId : null;
}

/** Core's `metadata.retry`, rebuilt member by member; absent unless every member is one Core writes. */
export function retryOf(attempt: Record<string, unknown>): PersistedFlowActionRetry | undefined {
  const record = optionalRecord(optionalRecord(attempt.metadata)?.retry);
  if (!record) return undefined;
  const { attemptNumber, maxAttempts, backoffMs, rung } = record;
  if (!isCount(attemptNumber) || !isCount(maxAttempts) || !isCount(backoffMs)) return undefined;
  return isLadderRung(rung) ? { attemptNumber, maxAttempts, backoffMs, rung } : undefined;
}

function isLadderRung(value: unknown): value is PersistedLadderRung {
  return typeof value === "string" && (PERSISTED_LADDER_RUNGS as readonly string[]).includes(value);
}

/** Core's `metadata.readiness`, without its message. */
export function readinessOf(attempt: Record<string, unknown>): PersistedFlowActionReadiness | undefined {
  const record = optionalRecord(optionalRecord(attempt.metadata)?.readiness);
  if (!record) return undefined;
  const { ceilingMs, waitedMs, satisfied, checkedConditionCount } = record;
  if (!isCount(ceilingMs) || !isCount(waitedMs) || !isCount(checkedConditionCount) || typeof satisfied !== "boolean") return undefined;
  return { ceilingMs, waitedMs, satisfied, checkedConditionCount };
}

/**
 * Core's `metadata.hostTargetResolution`, rebuilt member by member rather than
 * copied. Core narrows it where it projects the attempt; this narrows it again
 * on the way into the bundle, because a bundle's contents are this package's
 * to answer for.
 */
export function hostTargetResolutionOf(attempt: Record<string, unknown>): PersistedHostTargetResolution | undefined {
  const record = optionalRecord(optionalRecord(attempt.metadata)?.hostTargetResolution);
  if (!record) return undefined;
  const { strategy, candidateCount, bestScore, runnerUpScore, confidence } = record;
  if (!isHostTargetStrategy(strategy) || !isCount(candidateCount)) return undefined;
  return {
    strategy,
    candidateCount,
    ...(isRatio(bestScore) ? { bestScore } : {}),
    ...(isRatio(runnerUpScore) ? { runnerUpScore } : {}),
    ...(isRatio(confidence) ? { confidence } : {}),
  };
}

function isHostTargetStrategy(value: unknown): value is PersistedHostTargetStrategy {
  return typeof value === "string" && (PERSISTED_HOST_TARGET_STRATEGIES as readonly string[]).includes(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRatio(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
