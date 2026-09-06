import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { assertDemoFlowDocument, assertDemoParentDocument, assertDemoSubflowOwnership, createDemoFlowDocument, demoGraphReconciliationOperations, resolveDemoWorkspaceConfiguration } from "./demo-workspace.js";

const root = path.resolve("fixture-repository");
const required = {
  FLUXIQ_TEST_USERNAME: "runner",
  FLUXIQ_TEST_PASSWORD: "secret",
  FLUXIQ_TEST_PIN: "123456",
};

test("resolves one reusable demo directory below the configured runs root", () => {
  const runs = path.join(root, "custom-runs");
  const workspace = path.join(runs, "persistent-demo");
  const config = resolveDemoWorkspaceConfiguration(root, {
    ...required,
    FLUXIQ_TEST_RUNS_DIR: runs,
    FLUXIQ_DEMO_RUN_DIR: workspace,
  });
  assert.equal(config.workspaceDirectory, workspace);
  assert.equal(config.fluxiqRoot, path.join(workspace, "fluxiq-root"));
  assert.equal(config.storageDirectory, path.join(workspace, "fluxiq-root", ".fluxiq"));
  assert.equal(config.origin, "http://127.0.0.1:3300");
  assert.equal(config.gatewayUrl, "ws://127.0.0.1:4877/client");
  assert.equal(config.flowId, "flow.web-extension-demo");
  assert.equal(config.projectName, "FluxIQ Web Extension Test");
  assert.equal(config.headless, true);
});

test("accepts configurable loopback ports and rejects remote self-managed endpoints", () => {
  const config = resolveDemoWorkspaceConfiguration(root, {
    ...required,
    FLUXIQ_DEMO_BASE_URL: "http://localhost:3310",
    FLUXIQ_DEMO_GATEWAY_URL: "ws://localhost:4887/client",
  });
  assert.equal(config.origin, "http://localhost:3310");
  assert.equal(config.gatewayUrl, "ws://localhost:4887/client");
  assert.throws(() => resolveDemoWorkspaceConfiguration(root, {
    ...required,
    FLUXIQ_DEMO_BASE_URL: "https://panel.example.test:443",
  }), /must use a loopback host/);
});

test("allows visible browser debugging to be enabled explicitly", () => {
  assert.equal(resolveDemoWorkspaceConfiguration(root, { ...required, FLUXIQ_DEMO_HEADLESS: "false" }).headless, false);
  assert.throws(
    () => resolveDemoWorkspaceConfiguration(root, { ...required, FLUXIQ_DEMO_HEADLESS: "sometimes" }),
    /FLUXIQ_DEMO_HEADLESS must be true or false/,
  );
});

test("rejects a demo directory outside the configured runs root", () => {
  assert.throws(() => resolveDemoWorkspaceConfiguration(root, {
    ...required,
    FLUXIQ_TEST_RUNS_DIR: path.join(root, "runs"),
    FLUXIQ_DEMO_RUN_DIR: path.join(root, "outside"),
  }), /below FLUXIQ_TEST_RUNS_DIR/);
});

test("creates a deterministic web-automation Flow for the recorded demo", () => {
  const flow = createDemoFlowDocument({ createdAt: 10, updatedAt: 10 }, "project.web", "flow.demo", "Demo");
  assert.deepEqual(flow.scope, { kind: "domain", domainId: "web-automation" });
  assert.deepEqual((flow.nodes as Array<{ definitionId: string }>).map(node => node.definitionId), [
    "builtin.control.start",
    "web.output.dom-type",
    "web.output.dom-select",
    "web.output.dom-type",
    "web.output.dom-click",
    "builtin.control.end",
  ]);
  assert.equal((flow.edges as unknown[]).length, 5);
  assert.deepEqual((flow.nodes as Array<{ position: { x: number; y: number } }>).map(node => node.position), [
    { x: 0, y: 0 },
    { x: 360, y: 0 },
    { x: 720, y: 0 },
    { x: 1080, y: 0 },
    { x: 1440, y: 0 },
    { x: 1800, y: 0 },
  ]);
  assert.equal(flow.executionDefaults, undefined);
  assert.doesNotThrow(() => assertDemoFlowDocument(flow, "project.web", "flow.demo", "Demo"));
  assert.throws(
    () => assertDemoFlowDocument({ ...flow, nodes: [] }, "project.web", "flow.demo", "Demo"),
    /does not match the deterministic web-extension fixture/,
  );
});

test("requires the top-level demo Flow to remain graph-empty and explicitly orchestration-owned", () => {
  const parent = { projectId: "project.web", flowId: "flow.parent", name: "Demo", nodes: [], edges: [], metadata: { flowRepresentationVersion: 1, flowRepresentationKind: "orchestration" } };
  assert.doesNotThrow(() => assertDemoParentDocument(parent, "project.web", "flow.parent", "Demo"));
  assert.throws(
    () => assertDemoParentDocument({ ...parent, nodes: [{ id: "escaped" }] }, "project.web", "flow.parent", "Demo"),
    /empty orchestration graph/,
  );
  for (const metadata of [
    { flowRepresentationKind: "orchestration" },
    { flowRepresentationVersion: 2, flowRepresentationKind: "orchestration" },
    { flowRepresentationVersion: 1, flowRepresentationKind: "subflow_graph" },
    { flowRepresentationVersion: 1, flowRepresentationKind: "orchestration", subflowGraph: true },
    { flowRepresentationVersion: 1, flowRepresentationKind: "orchestration", parentFlowId: "flow.other" },
    { flowRepresentationVersion: 1, flowRepresentationKind: "orchestration", parentSubflowId: "subflow.other" },
  ]) assert.throws(() => assertDemoParentDocument({ ...parent, metadata }, "project.web", "flow.parent", "Demo"), /empty orchestration graph/);
});

test("preserves and requires Core Subflow graph ownership metadata", () => {
  const flow = createDemoFlowDocument({ metadata: { subflowGraph: true, parentFlowId: "flow.parent", parentSubflowId: "subflow.primary", flowRepresentationVersion: 1, flowRepresentationKind: "subflow_graph" } }, "project.web", "flow.graph", "Primary");
  const validMetadata = flow.metadata as Record<string, unknown>;
  assert.doesNotThrow(() => assertDemoSubflowOwnership(flow, "project.web", "flow.parent", "subflow.primary", "flow.graph"));
  assert.throws(() => assertDemoSubflowOwnership({ ...flow, metadata: { subflowGraph: true } }, "project.web", "flow.parent", "subflow.primary", "flow.graph"), /not owned by the expected Subflow boundary/);
  for (const metadata of [
    { ...validMetadata, flowRepresentationVersion: undefined },
    { ...validMetadata, flowRepresentationVersion: 2 },
    { ...validMetadata, flowRepresentationKind: "orchestration" },
  ]) assert.throws(() => assertDemoSubflowOwnership({ ...flow, metadata }, "project.web", "flow.parent", "subflow.primary", "flow.graph"), /not owned by the expected Subflow boundary/);
});

test("migrates an existing fixture graph from overlapping legacy spacing", () => {
  const flow = createDemoFlowDocument({}, "project.web", "flow.demo", "Demo");
  const nodeIds = (flow.nodes as Array<{ id: string }>).map(node => node.id);
  const edgeIds = (flow.edges as Array<{ id: string }>).map(edge => edge.id);
  const operations = demoGraphReconciliationOperations(flow, "flow.demo", {
    nodes: nodeIds.map((nodeId, index) => ({ nodeId, x: index * 240, y: 0 })),
    edgeIds,
    nodeCount: nodeIds.length,
    edgeCount: edgeIds.length,
  });
  assert.deepEqual(operations, nodeIds.slice(1).map((nodeId, index) => ({ op: "move_node", nodeId, x: (index + 1) * 360, y: 0 })));
});

test("repairs missing edges after an interrupted fixture graph migration", () => {
  const flow = createDemoFlowDocument({}, "project.web", "flow.demo", "Demo");
  const nodes = flow.nodes as Array<{ id: string; position: { x: number; y: number } }>;
  const edges = flow.edges as Array<{ id: string }>;
  const operations = demoGraphReconciliationOperations(flow, "flow.demo", {
    nodes: nodes.map(node => ({ nodeId: node.id, x: node.position.x, y: node.position.y })),
    edgeIds: [],
    nodeCount: nodes.length,
    edgeCount: 0,
  });
  assert.deepEqual(operations.map((operation: any) => [operation.op, operation.edge?.edgeId]), edges.map(edge => ["add_edge", edge.id]));
});