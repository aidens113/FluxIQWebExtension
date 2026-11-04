// One saved run replayed through Core's loop detector, and what it would have
// done. The record of what was tried is shared by the run's loops, as an
// attempt's is live.

import { automationStudioLlmLoopAttemptRecord, automationStudioLlmLoopReplay, type AutomationStudioLlmLoopFiring, type AutomationStudioLlmLoopPattern } from "fluxiq/automation";
import { readLoopReplayLoops } from "./read-steps.js";

/** One firing, with the loop it was in. */
export type LoopReplayFiring = AutomationStudioLlmLoopFiring & { role: string | null; briefId: string | null };

/** What the replay found in one run. */
export type LoopReplayRun = {
  loops: number;
  calls: number;
  /** Incidents caught, by the pattern that first showed each. */
  caught: Record<AutomationStudioLlmLoopPattern, number>;
  firings: LoopReplayFiring[];
};

/** Replays a run's `steps/`; a run with no step folders comes back empty. */
export async function replayLoopRun(stepsDirectory: string, options: { byHandle?: boolean } = {}): Promise<LoopReplayRun> {
  const loops = await readLoopReplayLoops(stepsDirectory, options);
  const record = automationStudioLlmLoopAttemptRecord();
  const caught: LoopReplayRun["caught"] = { exact_repeat: 0, near_repeat: 0, cycle: 0, no_progress: 0, same_fix: 0, same_act: 0 };
  const firings: LoopReplayFiring[] = [];
  let calls = 0;
  for (const loop of loops) {
    calls += loop.events.filter((event) => event.kind === "call").length;
    const replayed = automationStudioLlmLoopReplay(loop.events, { record });
    for (const pattern of Object.keys(caught) as AutomationStudioLlmLoopPattern[]) caught[pattern] += replayed.tally.caught[pattern];
    firings.push(...replayed.firings.map((firing) => ({ ...firing, role: loop.role, briefId: loop.briefId })));
  }
  return { loops: loops.length, calls, caught, firings };
}
