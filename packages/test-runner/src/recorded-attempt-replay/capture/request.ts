import { scriptedTaskProcess } from "../../attempt-lane/scripted-model/scripts/index.js";
import type { CreatedFlowBuildRequest } from "../../flow-lane/index.js";

/** Fresh fixture criteria accompany the actual entry and its captured receipt. */
export function recordedCaptureRequest(input: { projectId: string; flowId: string; startLocation: string; taskId: string }): CreatedFlowBuildRequest {
  return { projectId: input.projectId, flowId: input.flowId, evidenceGuided: true, startLocation: input.startLocation, taskProcessing: { process: scriptedTaskProcess(input.taskId) } };
}
