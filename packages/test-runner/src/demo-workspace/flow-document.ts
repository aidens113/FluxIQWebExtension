// The demo Flow's document shape: how one is created, how it is reconciled
// with the graph, and the assertions that say a document is the demo fixture,
// recording-derived, or correctly owned.
import { RunnerFailure } from "../failure.js";
import { LLM_DIAGNOSIS_SCENARIO_PATH } from "./diagnosis-ui.js";

export function createDemoFlowDocument(created: Record<string, unknown>, projectId: string, flowId: string, name: string): Record<string, unknown> {
  const nodes = [
    { id: "start", definitionId: "builtin.control.start", label: "Start", parameterValues: {} },
    { id: "name", definitionId: "web.output.dom-type", label: "Enter name", parameterValues: { selector: "[data-testid=\"name\"]", text: "Ada" } },
    { id: "plan", definitionId: "web.output.dom-select", label: "Choose team plan", parameterValues: { selector: "[data-testid=\"plan\"]", value: "team" } },
    { id: "notes", definitionId: "web.output.dom-type", label: "Enter notes", parameterValues: { selector: "[data-testid=\"notes\"]", text: "Executed by the reusable FluxIQ demo flow" } },
    { id: "submit", definitionId: "web.output.dom-click", label: "Submit", parameterValues: { selector: "[data-testid=\"submit\"]" } },
    { id: "end", definitionId: "builtin.control.end", label: "End", parameterValues: { status: "success" } },
  ].map((node, index) => ({ ...node, definitionVersion: "1.0.0", position: { x: index * 360, y: 0 }, metadata: {} }));
  const order = nodes.map(item => item.id);
  return {
    ...created,
    schemaVersion: "0.1",
    projectId,
    flowId,
    name,
    scope: { kind: "domain", domainId: "web-automation" },
    nodes,
    edges: order.slice(0, -1).map((source, index) => ({
      id: "edge." + source + "." + order[index + 1],
      sourceNodeId: source,
      sourcePortId: "success",
      targetNodeId: order[index + 1],
      targetPortId: "in",
      metadata: {},
    })),
    dependencies: [
      { kind: "node", id: "web.output.dom-type", version: "1.0.0" },
      { kind: "node", id: "web.output.dom-select", version: "1.0.0" },
      { kind: "node", id: "web.output.dom-click", version: "1.0.0" },
    ],
    metadata: { ...((created.metadata as Record<string, unknown> | undefined) ?? {}), createdBy: "fluxiq-web-extension-demo-workspace" },
  };
}

export function isEmptyDemoFlow(document: Record<string, unknown>, projectId: string, flowId: string, name: string): boolean {
  return document.projectId === projectId
    && document.flowId === flowId
    && document.name === name
    && Array.isArray(document.nodes)
    && document.nodes.length === 0
    && Array.isArray(document.edges)
    && document.edges.length === 0;
}

export function assertDemoParentDocument(document: Record<string, unknown>, projectId: string, flowId: string, name: string): void {
  const metadata = document.metadata as Record<string, unknown> | undefined;
  if (document.projectId !== projectId || document.flowId !== flowId || document.name !== name || !Array.isArray(document.nodes) || document.nodes.length || !Array.isArray(document.edges) || document.edges.length || metadata?.flowRepresentationVersion !== 1 || metadata?.flowRepresentationKind !== "orchestration" || metadata?.subflowGraph !== undefined || metadata?.parentFlowId !== undefined || metadata?.parentSubflowId !== undefined) {
    const state = { nodes: Array.isArray(document.nodes) ? document.nodes.length : "invalid", edges: Array.isArray(document.edges) ? document.edges.length : "invalid", representationVersion: metadata?.flowRepresentationVersion ?? null, representationKind: metadata?.flowRepresentationKind ?? null, hasOwnershipMetadata: metadata?.subflowGraph !== undefined || metadata?.parentFlowId !== undefined || metadata?.parentSubflowId !== undefined };
    throw new RunnerFailure("environment.missing", `Demo parent Flow must be an empty orchestration graph (${JSON.stringify(state)})`);
  }
}

export function assertDemoRecordingDerivedFlow(document: Record<string, unknown>, recordingId?: string): void {
  const nodes = Array.isArray(document.nodes) ? document.nodes as Array<Record<string, any>> : [];
  const edges = Array.isArray(document.edges) ? document.edges as Array<Record<string, any>> : [];
  const outputIds = nodes.map(node => node.parameterValues?.outputId).sort();
  const requiredOutputIds = ["web.dom.click", "web.dom.select", "web.dom.type", "web.dom.type"].sort();
  const selfContainedOutputIds = ["web.browser.navigate", ...requiredOutputIds].sort();
  const validOutputIds = stableJson(outputIds) === stableJson(requiredOutputIds) || stableJson(outputIds) === stableJson(selfContainedOutputIds);
  const validNodes = (nodes.length === 4 || nodes.length === 5) && nodes.every(node => node.definitionId === "builtin.policy.action"
    && typeof node.metadata?.recordingProposalId === "string"
    && typeof node.metadata?.actionEntryId === "string"
    && (!recordingId || Array.isArray(node.metadata?.evidence) && node.metadata.evidence.some((item: any) => item?.artifactId === recordingId)));
  const validEdges = edges.length === nodes.length - 1 && edges.every(edge => typeof edge.metadata?.recordingProposalId === "string");
  const positions = new Set(nodes.map(node => String(node.position?.x) + ":" + String(node.position?.y)));
  const navigationKinds = nodes.filter(node => node.parameterValues?.outputId === "web.browser.navigate").map(node => {
    const url = String(node.parameterValues?.parameters?.url ?? "");
    if (url.includes("fluxiqRecording=1")) return "recorded-demo";
    if (url.includes("/scenarios/basic-form/")) return "setup-demo";
    return "other";
  });
  if (!validNodes || !validEdges || positions.size !== nodes.length || !validOutputIds) {
    throw new RunnerFailure("environment.missing", `Demo Subflow is not the deterministic unedited graph generated from the expected recording (${JSON.stringify({ nodeCount: nodes.length, edgeCount: edges.length, outputIds, navigationKinds, distinctPositions: positions.size, validNodes, validEdges })})`);
  }
}

export function assertLlmDiagnosisRecordingDerivedFlow(document: Record<string, unknown>, recordingId?: string): void {
  const nodes = Array.isArray(document.nodes) ? document.nodes as Array<Record<string, any>> : [];
  const edges = Array.isArray(document.edges) ? document.edges as Array<Record<string, any>> : [];
  const outputIds = nodes.map(node => node.parameterValues?.outputId);
  const validOutputIds = outputIds.length === 1
    ? outputIds[0] === "web.dom.click"
    : outputIds.length === 2 && outputIds[0] === "web.browser.navigate" && outputIds[1] === "web.dom.click";
  const validNodes = (nodes.length === 1 || nodes.length === 2) && nodes.every(node => node.definitionId === "builtin.policy.action"
    && typeof node.metadata?.recordingProposalId === "string"
    && typeof node.metadata?.actionEntryId === "string"
    && (!recordingId || Array.isArray(node.metadata?.evidence) && node.metadata.evidence.some((item: any) => item?.artifactId === recordingId)));
  const click = nodes.find(node => node.parameterValues?.outputId === "web.dom.click");
  const selector = click?.parameterValues?.parameters?.selector;
  const validSelector = selector === '[data-testid="diagnosis-target"]' || selector === "[data-testid='diagnosis-target']";
  const navigation = nodes.find(node => node.parameterValues?.outputId === "web.browser.navigate");
  const validNavigation = !navigation || String(navigation.parameterValues?.parameters?.url ?? "").includes(LLM_DIAGNOSIS_SCENARIO_PATH);
  const validEdges = edges.length === Math.max(0, nodes.length - 1) && edges.every(edge => typeof edge.metadata?.recordingProposalId === "string");
  const positions = new Set(nodes.map(node => String(node.position?.x) + ":" + String(node.position?.y)));
  if (!validNodes || !validEdges || positions.size !== nodes.length || !validOutputIds || !validSelector || !validNavigation) {
    throw new RunnerFailure("environment.missing", `Diagnosis Subflow is not the deterministic unedited stable-target recording (${JSON.stringify({ nodeCount: nodes.length, edgeCount: edges.length, outputIds, distinctPositions: positions.size, validNodes, validEdges, validSelector, validNavigation })})`);
  }
}

export function assertDemoSubflowOwnership(document: Record<string, unknown>, projectId: string, parentFlowId: string, subflowId: string, graphFlowId: string): void {
  const metadata = document.metadata as Record<string, unknown> | undefined;
  if (document.projectId !== projectId || document.flowId !== graphFlowId || metadata?.subflowGraph !== true || metadata.parentFlowId !== parentFlowId || metadata.parentSubflowId !== subflowId || metadata.flowRepresentationVersion !== 1 || metadata.flowRepresentationKind !== "subflow_graph") {
    throw new RunnerFailure("environment.missing", "Demo graph is not owned by the expected Subflow boundary");
  }
}

export function assertDemoFlowDocument(document: Record<string, unknown>, projectId: string, flowId: string, name: string): void {
  const expected = createDemoFlowDocument({}, projectId, flowId, name);
  const keys = ["projectId", "flowId", "name", "scope", "nodes", "edges", "dependencies"] as const;
  const select = (value: Record<string, unknown>) => Object.fromEntries(keys.map(key => [key, normalizeDemoArray(key, value[key])]));
  if (stableJson(select(document)) !== stableJson(select(expected))) {
    throw new RunnerFailure("environment.missing", "Existing demo Flow does not match the deterministic web-extension fixture; choose another FLUXIQ_DEMO_FLOW_ID");
  }
}

export function isDemoFixtureDocument(document: Record<string, unknown>, projectId: string, flowId: string, name: string): boolean {
  try { assertDemoFlowDocument(document, projectId, flowId, name); return true; }
  catch { return false; }
}

export function demoGraphPatchOperations(document: Record<string, unknown>, flowId: string): unknown[] {
  const nodes = document.nodes as Array<Record<string, any>>;
  const edges = document.edges as Array<Record<string, any>>;
  return [
    ...nodes.map(node => ({
      op: "add_node",
      node: {
        nodeId: node.id,
        flowId,
        definitionId: node.definitionId,
        definitionVersion: node.definitionVersion ?? "1.0.0",
        label: node.label ?? "",
        description: node.description ?? "",
        x: node.position?.x ?? 0,
        y: node.position?.y ?? 0,
        width: 220,
        height: 120,
        zIndex: 0,
        disabled: false,
        parameterValues: node.parameterValues ?? {},
        metadata: node.metadata ?? {},
      },
    })),
    ...edges.map(edge => ({
      op: "add_edge",
      edge: {
        edgeId: edge.id,
        flowId,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        sourcePortId: edge.sourcePortId ?? null,
        targetPortId: edge.targetPortId ?? null,
        label: edge.label ?? "",
        metadata: edge.metadata ?? {},
      },
    })),
  ];
}

export function demoGraphReconciliationOperations(
  document: Record<string, unknown>,
  flowId: string,
  viewport: { nodes: Array<{ nodeId: string; x: number; y: number }>; edgeIds: string[]; nodeCount: number; edgeCount: number },
): unknown[] {
  if (viewport.nodeCount === 0 && viewport.edgeCount === 0) return demoGraphPatchOperations(document, flowId);
  const nodes = document.nodes as Array<Record<string, any>>;
  const edges = document.edges as Array<Record<string, any>>;
  const expectedNodeIds = new Set(nodes.map(node => String(node.id)));
  const expectedEdgeIds = new Set(edges.map(edge => String(edge.id)));
  if (viewport.nodeCount !== viewport.nodes.length
    || viewport.edgeCount !== viewport.edgeIds.length
    || viewport.nodeCount > expectedNodeIds.size
    || viewport.edgeCount > expectedEdgeIds.size
    || viewport.nodes.some(node => !expectedNodeIds.has(node.nodeId))
    || viewport.edgeIds.some(edgeId => !expectedEdgeIds.has(edgeId))) {
    throw new RunnerFailure("environment.missing", "The persistent demo graph index does not match its fixture-owned Flow document");
  }
  const current = new Map(viewport.nodes.map(node => [node.nodeId, node]));
  const currentEdgeIds = new Set(viewport.edgeIds);
  const missing = {
    ...document,
    nodes: nodes.filter(node => !current.has(String(node.id))),
    edges: edges.filter(edge => !currentEdgeIds.has(String(edge.id))),
  };
  return [...demoGraphPatchOperations(missing, flowId), ...nodes.flatMap(node => {
    const saved = current.get(String(node.id));
    const x = Number(node.position?.x ?? 0);
    const y = Number(node.position?.y ?? 0);
    return saved && (saved.x !== x || saved.y !== y) ? [{ op: "move_node", nodeId: node.id, x, y }] : [];
  })];
}

export function normalizeDemoArray(key: string, value: unknown): unknown {
  if (!Array.isArray(value) || !["nodes", "edges", "dependencies"].includes(key)) return value;
  return [...value].sort((left, right) => stableJson(left).localeCompare(stableJson(right)));
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  const record = value as Record<string, unknown>;
  return "{" + Object.keys(record).sort().map(key => JSON.stringify(key) + ":" + stableJson(record[key])).join(",") + "}";
}
