// The error a replay receipt keeps: its category, its message, and -- for a
// failed extension start -- the start's closed diagnostic projection.
//
// Replay `replay-mv62rwy7-fcb23be8` failed on the extension's service worker and
// its receipt kept only the category and message, so whether Chrome had seen a
// worker at all was lost. `extensionStartFailureDetails` keeps codes and
// integers only (stage, timings, worker count, connection flag), never the
// browser's message or a URL; anything else on the failure is dropped.

import { classifyRunnerFailure } from "../failure.js";
import { extensionStartFailureDetails } from "../run-scenario/index.js";

export function replayErrorOf(error: unknown): Readonly<{ category: string; message: string; details?: Readonly<Record<string, unknown>> }> {
  const details = extensionStartFailureDetails(error);
  return { category: classifyRunnerFailure(error), message: error instanceof Error ? error.message : String(error), ...(details ? { details } : {}) };
}
