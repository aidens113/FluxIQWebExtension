// What an attempt says about a step the run skipped rather than ran.
//
// A sometimes-present step -- a popup, a banner, a consent prompt -- whose
// target Core observed absent is skipped, not failed (Core
// `executor/step-skip/absent-step.ts`). Its attempt reads `succeeded` with no
// failure, so this mark, carried by the run detail (Core
// `service/summaries/conversions.ts`), is the only thing that tells a skip from
// a press. The playback step log matches each skip to the host attempt that
// observed the absence by its epoch-ms span (`lab-runs/write-playback-steps.ts`).

/** A skipped attempt: why, what observed it, and its span in epoch ms on Core's clock. */
export type PersistedFlowActionSkip = { reason: "target_absent"; code: string; startedAt: number; finishedAt: number };

/** The shape of a Core code (`web.target.not_found`, `executor.ready_state.not_shown`): dotted lowercase words. */
const CORE_CODE = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u;

/**
 * Core's `skipped` mark, in its one closed shape, or nothing. The code is kept
 * only in the shape of a Core code, at most 120 characters, so a value that
 * could carry page text never reaches the bundle. A skip that dispatched
 * nothing may have no finish; it finished when it started.
 */
export function skippedAttemptOf(attempt: Record<string, unknown>, startedAt: number, finishedAt: number | undefined): PersistedFlowActionSkip | undefined {
  const mark = attempt.skipped;
  if (typeof mark !== "object" || mark === null || Array.isArray(mark)) return undefined;
  const { reason, code } = mark as Record<string, unknown>;
  if (reason !== "target_absent" || typeof code !== "string" || code.length > 120 || !CORE_CODE.test(code)) return undefined;
  return { reason, code, startedAt, finishedAt: finishedAt ?? startedAt };
}
