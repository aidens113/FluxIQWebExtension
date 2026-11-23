import type { ExistingFluxIQControlClient } from "../../existing-fluxiq-control.js";
import { offlinePreflightProbeGraph } from "./probe-graph.js";

/** The probe's own task, in the same words as its description: generic, never a scenario's task. */
const PROBE_INSTRUCTION = "Confirm with the person, then read this isolated fixture page.";

/** Uses the same public create/subflow/save routes as an ordinary saved Flow. */
export async function saveOfflinePreflightProbe(control: Pick<ExistingFluxIQControlClient, "automationStudioCall">, input: { projectId: string; authorizationPin: string }) {
  const call = (endpoint: string, payload: Record<string, unknown>) => control.automationStudioCall(endpoint, { ...input, ...payload }, {}, "web-automation") as Promise<Record<string, any>>;
  const created = await call("create-flow", { name: "Offline read probe", description: "Confirm, then read this isolated fixture page." });
  const flowId = created.flow?.flowId;
  if (typeof flowId !== "string") throw new Error("preflight_probe_flow_missing");
  // Core runs only a Flow with a written, active task instruction (`instruction-led/authority.ts`);
  // without one the chat's run ended "Write active instructions ..." (t986-preflight-social-v1).
  // Saved through the same public route a person's build words take, and without the PIN that route refuses.
  const written = await control.automationStudioCall("save-flow-generation-instruction", { projectId: input.projectId, flowId, instruction: PROBE_INSTRUCTION }, {}, "web-automation") as Record<string, any>;
  if (written?.instruction?.status !== "active") throw new Error("preflight_probe_instruction_inactive");
  const { subflow } = await call("create-flow-subflow", { flowId, name: "Primary", role: "primary" });
  if (typeof subflow?.graphFlowId !== "string" || typeof subflow?.subflowId !== "string") throw new Error("preflight_probe_subflow_missing");
  const { flow } = await call("get-flow", { flowId: subflow.graphFlowId });
  if (!flow) throw new Error("preflight_probe_graph_missing");
  await call("save-flow", { flow: { ...flow, ...offlinePreflightProbeGraph() } });
  await call("save-flow-map-fallback", { flowId, kind: "subflow", targetSubflowId: subflow.subflowId });
  return { flowId, name: "Offline read probe" };
}
