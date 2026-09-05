import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { assertDemoFlowDocument, createDemoFlowDocument, demoGraphReconciliationOperations, resolveDemoWorkspaceConfiguration } from "./demo-workspace.js";

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
