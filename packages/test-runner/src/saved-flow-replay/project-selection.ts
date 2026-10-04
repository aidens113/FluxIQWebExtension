import { RunnerFailure } from "../failure.js";

/** Bind replay to its explicit project, never search other projects for a Flow. */
export async function selectReplayProject(
  control: { selectExistingContext(projectId: string): Promise<void>; listFlowSummaries(projectId: string): Promise<readonly { flowId: string }[]> },
  input: { defaultProjectId: string; projectId?: string; flowId: string },
): Promise<string> {
  const projectId = input.projectId === undefined ? input.defaultProjectId : input.projectId.trim();
  if (!projectId) throw new RunnerFailure("fixture.invalid", "Replay requires a nonempty project identity");
  await control.selectExistingContext(projectId);
  if (!(await control.listFlowSummaries(projectId)).some(flow => flow.flowId === input.flowId)) {
    throw new RunnerFailure("fixture.invalid", "The selected project holds no matching saved Flow");
  }
  return projectId;
}
