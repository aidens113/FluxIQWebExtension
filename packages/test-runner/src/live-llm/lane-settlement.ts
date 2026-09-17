// A live provider run's accounting, settled however the Flow lane ends.
//
// The runner used to settle only after the lane returned, so a lane that threw
// -- an unexpected failure from the Flow, a failed expectation -- left the run
// with no `snapshots/live-llm.json` and `llm.calls: 0`, although the provider
// had been called and paid (`run-mu4rpka7-845d919a`). The order that mattered
// is kept: a finished lane is settled before its expectations are judged by the
// caller, and a budget breach outranks whatever the lane then reports.

import type { ExistingRunDetail } from "../existing-fluxiq-control.js";
import type { RunnerFailure } from "../failure.js";
import type { LiveLlmRunBundle } from "./live-llm-run.js";

/** The two settlements a live run offers, as `LiveLlmRun` implements them. */
export type LiveLlmLaneSettlement = {
  settle(control: LiveLlmLaneDetailReader, input: { projectId: string; runId: string }, bundle: LiveLlmRunBundle, publish: LiveLlmLanePublish): Promise<void>;
  settleUnfinished(control: LiveLlmLaneDetailReader, input: { projectId: string; runId: string | undefined }, bundle: LiveLlmRunBundle, publish: LiveLlmLanePublish): Promise<RunnerFailure | undefined>;
};
type LiveLlmLaneDetailReader = { getRunDetail(projectId: string, runId: string): Promise<ExistingRunDetail> };
type LiveLlmLanePublish = (details: Record<string, unknown>) => Promise<unknown>;

/**
 * Runs `runLane`, telling it where to report Core's run id, and settles the
 * live run from that run whatever happens.
 *
 * - The lane returns: `settle`, whose own refusals (an overspend, no provider
 *   reached) fail the run as before.
 * - The lane throws: `settleUnfinished` writes the snapshot from the run the
 *   lane identified, and the lane's failure is rethrown -- unless the run broke
 *   its budget, which is thrown in its place.
 *
 * With no live run the lane simply runs.
 */
export async function runLaneWithLiveLlmSettlement<T extends { run: { runId: string } }>(
  settlement: {
    live: LiveLlmLaneSettlement | undefined;
    control: LiveLlmLaneDetailReader;
    projectId: string;
    bundle: LiveLlmRunBundle;
    publish: LiveLlmLanePublish;
  },
  runLane: (flowRunIdentified: (runId: string) => void) => Promise<T>,
): Promise<T> {
  const { live } = settlement;
  if (!live) return await runLane(() => undefined);
  let runId: string | undefined;
  try {
    const lane = await runLane((identified) => { runId = identified; });
    runId = lane.run.runId;
    await live.settle(settlement.control, { projectId: settlement.projectId, runId }, settlement.bundle, settlement.publish);
    return lane;
  } catch (error) {
    // A settlement that cannot even write its snapshot must not hide why the lane failed.
    const breach = await live.settleUnfinished(settlement.control, { projectId: settlement.projectId, runId }, settlement.bundle, settlement.publish).catch(() => undefined);
    throw breach ?? error;
  }
}
