/** Safe identity for a created Flow; never includes chat, page or credentials. */
export type CreationContext = Readonly<{
  schemaVersion: 1;
  runId: string;
  workspace: string | null;
  projectId: string;
  domainId: string;
  flowId: string | null;
  outcome: "prepared" | "building" | "created" | "failed";
  savedFlowHash: string | null;
}>;

export async function writeCreationContext(
  writer: { writeStructured(name: string, value: unknown): Promise<unknown> },
  identity: CreationContext,
): Promise<CreationContext> {
  const screened: CreationContext = {
    schemaVersion: 1, runId: identity.runId, workspace: identity.workspace,
    projectId: identity.projectId, domainId: identity.domainId,
    flowId: identity.flowId, outcome: identity.outcome, savedFlowHash: identity.savedFlowHash,
  };
  await writer.writeStructured("snapshots/creation-context.json", screened);
  return screened;
}
