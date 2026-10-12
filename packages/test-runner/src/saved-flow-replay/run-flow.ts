import { executeRecordedFlowRun, type PersistedFlowRunControl } from "../flow-lane/index.js";

/** Wait for Core's completed verification/accounting publication without asking a model into the replay. */
export async function runProviderFreeReplayFlow(control: PersistedFlowRunControl, input: {
  projectId: string; flowId: string; facilityRunId: string;
  actionTypes: ReadonlyMap<string, string>; inputs: Record<string, unknown>;
}) {
  return await executeRecordedFlowRun(control, {
    projectId: input.projectId, flowId: input.flowId, facilityRunId: input.facilityRunId,
    actionTypes: input.actionTypes, inputs: input.inputs
  }, {}, { awaitVerdict: true });
}
