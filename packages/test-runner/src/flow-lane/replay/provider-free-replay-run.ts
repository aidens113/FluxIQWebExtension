// Running a saved Flow again with no model, to show what it costs without one.
//
// Every replay that proves a Flow is reusable asks Core the same question:
// did this run call a provider? Core answers in its own accounting, and for a
// run that asked no model anything that accounting is a zero written in the
// same save as the run's verdict (Core `result-verification/run-record.ts`),
// never in the earlier save that marks the run succeeded. A replay read between
// the two finds a finished run with no accounting, and "nobody counted" is not
// "no call": the replay fails as unknown.
//
// That happened twice, on two replay paths. `lab replay` met it first and was
// made to wait for the verdict (72a858be); the in-run repair replay did not
// wait and failed run-mv8k9k2e-1f1065a8, whose replay outlived its 30 s request
// and was read back 0.4 s before Core's verdict save. So the rule lives here,
// once, and every replay runs through it: `saved-flow-replay/run-flow.ts` and
// `flow-lane/repair/replay-repair.ts` both do.

import type { FluxIQHttpOptions } from "../../http-control/index.js";
import { executeRecordedFlowRun, type PersistedFlowRunControl, type PersistedFlowRunOutcome } from "../persisted-flow-run.js";

/** A replay's run: everything a recorded run takes, except a model to take part in it. */
export type ProviderFreeReplayRun = Omit<Parameters<typeof executeRecordedFlowRun>[1], "llmExecution">;

/**
 * Runs the Flow with no model and reads it back only once Core has recorded
 * its verdict on a succeeded run, so the accounting read after it is the one
 * Core wrote. A failed run is never judged, so it is never held up waiting.
 */
export async function executeProviderFreeReplayRun(
  control: PersistedFlowRunControl,
  input: ProviderFreeReplayRun,
  bounds: FluxIQHttpOptions = {},
): Promise<PersistedFlowRunOutcome> {
  // Dropped as well as typed out: a replay that brought a model along would measure the model.
  const { llmExecution: _model, ...replay } = input as ProviderFreeReplayRun & { llmExecution?: unknown };
  return await executeRecordedFlowRun(control, replay, bounds, { awaitVerdict: true });
}
