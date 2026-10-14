import { executeProviderFreeReplayRun, type PersistedFlowRunControl } from "../flow-lane/index.js";

/**
 * `lab replay`'s run of the saved Flow: no model, and read back only once Core
 * has published its verdict and the accounting saved with it. The rule is
 * the one every replay shares (`flow-lane/replay/provider-free-replay-run.ts`).
 */
export async function runProviderFreeReplayFlow(control: PersistedFlowRunControl, input: {
  projectId: string; flowId: string; facilityRunId: string;
  actionTypes: ReadonlyMap<string, string>; inputs: Record<string, unknown>;
}) {
  return await executeProviderFreeReplayRun(control, {
    projectId: input.projectId, flowId: input.flowId, facilityRunId: input.facilityRunId,
    actionTypes: input.actionTypes, inputs: input.inputs
  });
}
