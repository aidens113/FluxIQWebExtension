// What the Testing Lab does to an adaptation through the control client, with
// no provider and no UI: clear the one stale proposal an earlier run may have
// left, and read back what applying a proposal actually built. The inspector
// is the negative half -- it refuses an applied creation whose graph is empty,
// unregistered, overlapping, or still carrying recording provenance.

import { ExistingFluxIQControlClient } from "../existing-fluxiq-control.js";
import type { LiveCreationTopology } from "./creation-outcomes.js";
import { identifier, integer, record } from "./json-shapes.js";
import { fail, inspectionFail } from "./runner-fail.js";

export async function rejectStalePendingCreationAdaptation(
  control: Pick<ExistingFluxIQControlClient, "listFlowAdaptations" | "getFlowAdaptation" | "rejectFlowAdaptation">,
  projectId: string,
  flowId: string,
  pin: string,
): Promise<number> {
  const proposed = await control.listFlowAdaptations(projectId, flowId, "proposed");
  if (proposed.length === 0) return 0;
  if (proposed.length !== 1) fail("Expected at most one pending adaptation on the isolated creation Flow");
  const candidate = await control.getFlowAdaptation(projectId, flowId, proposed[0]!.adaptationId);
  if (candidate.status !== "proposed" || candidate.adaptationKind !== "flow_bootstrap") {
    fail("The isolated creation Flow has a pending adaptation that is not a Flow bootstrap proposal");
  }
  const rejected = await control.rejectFlowAdaptation({
    projectId,
    flowId,
    adaptationId: candidate.adaptationId,
    authorizationPin: pin,
    reason: "Testing Lab stale pending creation cleanup",
  });
  if (rejected.adaptationKind !== "flow_bootstrap") fail("FluxIQ rejected an unexpected adaptation kind");
  return 1;
}

export async function inspectAppliedCreation(control: ExistingFluxIQControlClient, projectId: string, flowId: string, baseDigest: string, canonicalResultingDigest: string): Promise<LiveCreationTopology> {
  const subflows = await control.listFlowSubflows(projectId, flowId);
  if (subflows.length !== 1 || !subflows[0]!.graphFlowId) inspectionFail("Applied creation must own exactly one graph-backed Subflow", "exploration_apply.subflow_topology_invalid");
  const owned = subflows[0]!;
  const graphFlowId = owned.graphFlowId;
  if (!graphFlowId) inspectionFail("Applied creation Subflow omitted its graph Flow identity", "exploration_apply.graph_identity_missing");
  const router = await control.getFlowRouter(projectId, flowId);
  if (!router) inspectionFail("Applied creation did not create a Router", "exploration_apply.router_missing");
  const routed = [router.fallback, ...router.rules.map(rule => rule.target)].filter(target => target?.kind === "subflow" && target.subflowId === owned.subflowId);
  if (routed.length !== 1) inspectionFail("Applied creation must route exactly once to its owned Subflow", "exploration_apply.route_invalid");
  const graph = await control.getExactFlow(projectId, graphFlowId);
  const viewport = await control.getFlowGraphViewport(projectId, graphFlowId);
  const nodes = Array.isArray(graph.document.nodes) ? graph.document.nodes as Record<string, unknown>[] : [];
  const edges = Array.isArray(graph.document.edges) ? graph.document.edges : [];
  if (!nodes.length || edges.length < Math.max(0, nodes.length - 1) || viewport.nodeCount !== nodes.length || viewport.edgeCount !== edges.length) inspectionFail("Applied creation graph is empty, disconnected, or inconsistent", "exploration_apply.graph_invalid");
  const definitions = new Map((await control.listNativeNodeDefinitions(projectId)).map(item => [item.id, item]));
  const resolved = nodes.filter(node => typeof node.definitionId === "string" && (
    definitions.has(node.definitionId)
    || node.definitionId === "builtin.control.start"
    || node.definitionId === "builtin.control.end"
  )).length;
  if (resolved !== nodes.length) inspectionFail("Applied creation contains an unsupported node definition", "exploration_apply.node_definition_missing");
  const executable = nodes.filter(node => typeof node.definitionId === "string" && definitions.get(node.definitionId)?.executable).length;
  if (executable < 1) inspectionFail("Applied creation contains no executable output node", "exploration_apply.node_not_executable");
  let overlaps = 0;
  for (let i = 0; i < viewport.nodes.length; i++) for (let j = i + 1; j < viewport.nodes.length; j++) {
    const a = viewport.nodes[i]!, b = viewport.nodes[j]!;
    if (Math.abs(a.x - b.x) < 220 && Math.abs(a.y - b.y) < 96) overlaps += 1;
  }
  if (overlaps) inspectionFail("Applied creation graph positions overlap", "exploration_apply.positions_overlap");
  const serialized = JSON.stringify([await control.getExactFlow(projectId, flowId), graph, router, subflows]);
  if (/lastRecordingId|sourceRecordingIds|recordingProvenance|recordingId/iu.test(serialized)) inspectionFail("Applied creation contains recording provenance", "exploration_apply.recording_provenance_present");
  const resultingExecutionDigest = identifier(canonicalResultingDigest);
  if (resultingExecutionDigest === baseDigest) inspectionFail("Applied creation did not change the canonical Core execution digest", "exploration_apply.digest_unchanged");
  return Object.freeze({ resultingExecutionDigest, routerId: router.routerId, routerSubflowId: owned.subflowId, ownedSubflowId: owned.subflowId, graphFlowId, nodeCount: nodes.length, edgeCount: edges.length, executableNodeCount: executable, overlappingPositionCount: 0 as const, recordingProvenanceAbsent: true as const });
}

export function parseAppliedExecutionDigest(body: unknown, ok: boolean, expectedBaseDigest: string): string {
  const root = record(body); if (!ok || root.ok !== true) fail("Adaptation apply response failed");
  const adaptation = record(record(root.payload).adaptation);
  const metadata = record(adaptation.metadata);
  if (metadata.adaptationKind !== "flow_bootstrap") fail("Adaptation apply response was not a Flow bootstrap");
  const bootstrap = record(metadata.bootstrap);
  const application = record(bootstrap.application);
  const baseSettingsRevision = integer(bootstrap.baseSettingsRevision);
  const currentSettingsRevision = integer(bootstrap.currentSettingsRevision);
  if (currentSettingsRevision <= baseSettingsRevision) fail("Adaptation apply response did not advance the Core settings revision");
  const base = identifier(bootstrap.baseExecutionDigest);
  const current = identifier(bootstrap.currentExecutionDigest);
  const applied = identifier(application.appliedExecutionDigest);
  if (base !== expectedBaseDigest || current !== applied || applied === base) fail("Adaptation apply response did not prove an exact changed canonical Core execution binding");
  return applied;
}
