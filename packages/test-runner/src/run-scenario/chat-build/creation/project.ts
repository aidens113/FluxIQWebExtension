import type { CreationContext } from "./context.js";
import { RunnerFailure } from "../../../failure.js";

type Control = {
  createProject(input: { name: string; description: string; domainId: string; authorizationPin?: string }): Promise<string>;
  selectExistingContext(projectId: string): Promise<void>;
};

/** The independent chat build's scope, prepared before its browser or person. */
export async function prepareIndependentCreationProject<T extends { projectId?: string; control?: Control; authorizationPin?: string }>(
  topology: T,
  input: { independent: boolean; runId: string; workspace: string | null; domainId: string; writeIdentity(identity: CreationContext): Promise<unknown> },
): Promise<T> {
  if (!input.independent) return topology;
  if (!topology.control) throw new RunnerFailure("environment.missing", "Independent creation requires authenticated project control");
  const projectId = await topology.control.createProject({
    name: `Creation ${input.runId}`, description: "Run-owned independent creation project",
    domainId: input.domainId,
    ...(topology.authorizationPin ? { authorizationPin: topology.authorizationPin } : {}),
  });
  if (!projectId.trim()) throw new RunnerFailure("recording.persistence", "Independent creation returned no project identity");
  // Persist ownership before selection: a refused selection must not orphan its identity.
  await input.writeIdentity({ schemaVersion: 1, runId: input.runId, workspace: input.workspace,
    projectId, domainId: input.domainId, flowId: null, outcome: "prepared", savedFlowHash: null });
  await topology.control.selectExistingContext(projectId);
  return { ...topology, projectId };
}
