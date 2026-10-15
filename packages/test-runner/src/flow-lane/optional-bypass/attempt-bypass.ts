// Whether Core went on past a failed optional step by its own rule.
//
// An optional step -- a popup, a banner, a consent prompt marked `optional:
// yes`, or a node marked sometimes-present -- is only sometimes there to be
// done, so the run going on past it is "what the Flow says to do, not a
// recovery" (Core `runtime/executor/step-skip/optional-step.ts`,
// `automationStudioOptionalStepWayOn`). Core's trial gate and executor read a
// failed optional step that way. The Lab read the same attempt as the run's
// failure: A8 wave 15 pair 2 (`run-mv9v3u68-6efbd7ae`) had Core's playback
// succeed, its result check confirm and the oracle pass, and was reported
// failed for the `web.target.ambiguous` on a "close the chat popup if it shows"
// step Core had gone past to its Merge.
//
// The predicate is not copied here. Core does not export it, and a second copy
// of a graph rule would drift from the first. What is read instead is Core's
// own record that it applied the rule: the ladder candidate Core selected for
// the failed attempt, which the run detail carries on the attempt itself
// (`metadata.recoverySelected`, `service/summaries/conversions.ts`), being the
// optional way-on, and the run's next attempt being on that way-on's target
// (the Merge, in the shape a build writes). Both must hold: a way-on selected
// for a run that then went elsewhere is not a bypass. The attempt's own mark is
// read rather than `runDetail.recoveryAttempts`, because those are built from
// the top-level trace alone and a step inside a called subflow -- where a
// build puts its optional steps -- has an attempt id of its own frame.
//
// The way-on is told from a plain failed route by the mark Core's ladder sets on
// that candidate alone (`optionalStepWayOn`, `recovery-ladder.ts`), never by its
// label, which is display text. A plain failed route -- a non-optional step's
// failure branch -- carries no mark, so it still fails the run.

import { attemptNodeId } from "../persisted-attempt.js";

/** Where the run went on after Core passed a failed optional step: the way-on's target node. */
export type PersistedOptionalBypass = { toNodeId: string };

/** Core's attempt-id prefix for a refuted result's attempt, which ran no node. */
const RESULT_VERIFICATION_ATTEMPT_PREFIX = "result-verification.";

/**
 * One entry per attempt, in the order given (Core's `order`): the bypass Core
 * recorded for that attempt, or `undefined`. Only a `failed` attempt can carry
 * one.
 */
export function optionalBypassesOf(attempts: readonly Record<string, unknown>[]): (PersistedOptionalBypass | undefined)[] {
  return attempts.map((attempt, index) => {
    if (attempt.status !== "failed") return undefined;
    const toNodeId = wayOnOf(attempt);
    if (toNodeId === undefined || nextNodeId(attempts, index) !== toNodeId) return undefined;
    return { toNodeId };
  });
}

/** The node Core's selected candidate sent the run on to, when that candidate is the optional way-on. */
function wayOnOf(attempt: Record<string, unknown>): string | undefined {
  const selected = recordOf(recordOf(attempt.metadata)?.recoverySelected);
  if (!selected || selected.optionalStepWayOn !== true) return undefined;
  const { targetNodeId } = selected;
  return typeof targetNodeId === "string" && attemptNodeId(targetNodeId) !== null ? targetNodeId : undefined;
}

/** The node of the first attempt after `index` that ran one; a refuted result's attempt ran none. */
function nextNodeId(attempts: readonly Record<string, unknown>[], index: number): string | undefined {
  for (const attempt of attempts.slice(index + 1)) {
    if (typeof attempt.attemptId === "string" && attempt.attemptId.startsWith(RESULT_VERIFICATION_ATTEMPT_PREFIX)) continue;
    if (typeof attempt.nodeId === "string" && attempt.nodeId.length > 0) return attempt.nodeId;
  }
  return undefined;
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
