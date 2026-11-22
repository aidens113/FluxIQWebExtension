import type { ExistingFluxIQControlClient } from "../../existing-fluxiq-control.js";
import { offlinePreflightProbeGraph } from "./probe-graph.js";

/** Uses the same public create/subflow/save routes as an ordinary saved Flow. */
export async function saveOfflinePreflightProbe(control: ExistingFluxIQControlClient, input: { projectId: string; authorizationPin: string }) {
  const call = (endpoint: string, payload: Record<string, unknown>) => control.automationStudioCall(endpoint, { ...input, ...payload }, {}, "web-automation") as Promise<Record<string, any>>;
  const created = await call("create-flow", { name: "Offline read probe", description: "Confirm, then read this isolated fixture page." });
  const flowId = created.flow?.flowId;
  if (typeof flowId !== "string") throw new Error("preflight_probe_flow_missing");
  const { subflow } = await call("create-flow-subflow", { flowId, name: "Primary", role: "primary" });
  if (typeof subflow?.graphFlowId !== "string" || typeof subflow?.subflowId !== "string") throw new Error("preflight_probe_subflow_missing");
  const { flow } = await call("get-flow", { flowId: subflow.graphFlowId });
  if (!flow) throw new Error("preflight_probe_graph_missing");
  await call("save-flow", { flow: { ...flow, ...offlinePreflightProbeGraph() } });
  await call("save-flow-map-fallback", { flowId, kind: "subflow", targetSubflowId: subflow.subflowId });
  return { flowId, name: "Offline read probe" };
}
