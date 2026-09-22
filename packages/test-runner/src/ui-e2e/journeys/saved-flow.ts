// A Flow a journey saved, as a later journey needs it: its identities in Core,
// the page it runs on, and how its answer is judged. The restart journey takes
// these, stops and restarts Core, and requires every identity to come back
// unchanged and every rerun to give the same answer.
import type { DemoWorkspaceState } from "../../demo-workspace/index.js";
import type { ExistingFluxIQControlClient } from "../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../failure.js";

/** How a saved Flow's answer is judged: its stored dataset against a digest, or the scenario's final-state oracle. */
export type SavedFlowJudge =
  | Readonly<{ kind: "dataset"; sha256: string; records: number }>
  | Readonly<{ kind: "final_state" }>;

export type SavedJourneyFlow = Readonly<{
  /** Which journey saved it; a closed name, never a page value. */
  label: "extraction" | "failure";
  scenarioId: string;
  scenarioPath: string;
  state: DemoWorkspaceState;
  judge: SavedFlowJudge;
}>;

/** Every identity a saved Flow has in Core, and the content hash of its parent and generated graph. */
export type SavedFlowIdentity = Readonly<{
  projectId: string;
  flowId: string;
  subflowId: string;
  graphFlowId: string;
  routerId: string;
  parentContentHash: string;
  graphContentHash: string;
}>;

/** Reads `flow`'s identities from Core; fails `restart.flow_missing` when Core no longer holds the Flow as it was saved. */
export async function readSavedFlowIdentity(control: ExistingFluxIQControlClient, flow: SavedJourneyFlow): Promise<SavedFlowIdentity> {
  const { projectId, flowId, subflowId, graphFlowId, routerId } = flow.state;
  const missing = (part: string) => new RunnerFailure("runtime.behavior", "Core no longer holds a saved Flow as it was saved", { details: { reasonCode: "restart.flow_missing", flow: flow.label, part } });
  const parent = await control.getExactFlow(projectId, flowId).catch(() => { throw missing("parent"); });
  const subflow = (await control.listFlowSubflows(projectId, flowId)).find(item => item.subflowId === subflowId);
  if (!subflow || subflow.graphFlowId !== graphFlowId) throw missing("subflow");
  const graph = await control.getExactFlow(projectId, graphFlowId).catch(() => { throw missing("graph"); });
  const router = await control.getFlowRouter(projectId, flowId);
  if (!router || router.routerId !== routerId || router.fallback?.subflowId !== subflowId) throw missing("router");
  return { projectId, flowId, subflowId, graphFlowId, routerId, parentContentHash: parent.contentHash, graphContentHash: graph.contentHash };
}

/** The identity fields that differ between two readings, by name; empty when they are the same Flow, unchanged. */
export function changedIdentityFields(before: SavedFlowIdentity, after: SavedFlowIdentity): string[] {
  return (Object.keys(before) as Array<keyof SavedFlowIdentity>).filter(key => before[key] !== after[key]);
}
