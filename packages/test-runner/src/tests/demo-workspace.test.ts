import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assertDemoFlowDocument, assertDemoParentDocument, assertDemoSubflowOwnership, boundExplorationRunStages, createDemoFlowDocument, demoGraphReconciliationOperations, explorationFlowName, requireDemoScenarioUrl, resolveDemoWorkspaceConfiguration, resolveExplorationFlowNameForRecovery, startPersistentScenarioLabWithRecovery } from "../demo-workspace.js";

const root = path.resolve("fixture-repository");
const required = {
  FLUXIQ_TEST_USERNAME: "runner",
  FLUXIQ_TEST_PASSWORD: "secret",
  FLUXIQ_TEST_PIN: "123456",
};

test("non-default exploration request naming and blank crash recovery are deterministic", async () => {
  const request = { scenarioId: "basic-form", scenarioPath: "/scenarios/basic-form/", instruction: "Submit the basic form." } as const;
  const expected = explorationFlowName(request);
  assert.equal(explorationFlowName(request), expected);
  assert.notEqual(explorationFlowName({ ...request, instruction: "Submit a different basic form." }), expected);
  assert.match(expected, /^Website Exploration basic-form [a-f0-9]{10}$/u);

  const legacy = { flowId: "flow.legacy", name: "Website Exploration basic-form abcdef1234", sourceMode: "visual", nodeCount: 0, edgeCount: 0, updatedAt: 1 };
  const blankControl = {
    listFlowSummaries: async () => [legacy],
    getExactFlow: async () => ({ document: { nodes: [], edges: [], metadata: { flowRepresentationKind: "orchestration" } } }),
    listFlowSubflows: async () => [], getFlowRouter: async () => null,
  } as any;
  assert.equal(await resolveExplorationFlowNameForRecovery(blankControl, "project.one", request), legacy.name);

  const nonblankControl = { ...blankControl, getExactFlow: async () => ({ document: { nodes: [{}], edges: [], metadata: { flowRepresentationKind: "orchestration" } } }) } as any;
  assert.equal(await resolveExplorationFlowNameForRecovery(nonblankControl, "project.one", request), expected);

  const transportFailure = new Error("control unavailable");
  await assert.rejects(resolveExplorationFlowNameForRecovery({ ...blankControl, getExactFlow: async () => { throw transportFailure; } } as any, "project.one", request), error => error === transportFailure);
});

test("bound run launcher exposes only allowlisted stage and reason diagnostics", async () => {
  assert.deepEqual(boundExplorationRunStages, ["pre_browser_identity", "pre_browser_topology", "browser_execution", "manifest_oracle", "final_validation"]);
  const source = await readFile(path.resolve("scripts/run-demo-llm-exploration-request-flow.mjs"), "utf8");
  assert.match(source, /stage, reasonCode, providerCallCount: 0/u);
  assert.doesNotMatch(source, /error\.message|error\.stack|JSON\.stringify\(error\)/u);
});

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

test("derives only an exact credential-free loopback scenario URL", () => {
  assert.equal(
    requireDemoScenarioUrl("http://127.0.0.1:4173", "/scenarios/llm-target-drift/"),
    "http://127.0.0.1:4173/scenarios/llm-target-drift/",
  );
  for (const [origin, scenarioPath] of [
    ["http://localhost:4173", "/scenarios/llm-target-drift/"],
    ["http://user:password@127.0.0.1:4173", "/scenarios/llm-target-drift/"],
    ["http://127.0.0.1:4173", "//example.test/scenarios/llm-target-drift/"],
    ["http://127.0.0.1:4173", "/other/"],
    ["http://127.0.0.1:4173", "/scenarios/llm-target-drift/?secret=value"],
  ] as const) assert.throws(() => requireDemoScenarioUrl(origin, scenarioPath), /scenario URL is invalid/u);
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

test("keeps a healthy persisted Scenario Lab port and refreshes an early EACCES port exactly once", async () => {
  const runs = await mkdtemp(path.join(os.tmpdir(), "fluxiq-demo-recovery-"));
  const workspace = path.join(runs, "demo");
  const config = resolveDemoWorkspaceConfiguration(root, {
    ...required,
    FLUXIQ_TEST_RUNS_DIR: runs,
    FLUXIQ_DEMO_RUN_DIR: workspace,
  });
  await mkdir(workspace, { recursive: true });
  await writeFile(path.join(workspace, "scenario-port.json"), JSON.stringify({ schemaVersion: "0.1", port: 56830 }) + "\n");
  try {
    const started: number[] = [];
    const recovered = await startPersistentScenarioLabWithRecovery({
      config,
      start: port => {
        started.push(port);
        return started.length === 1 ? { exitCode: 1, signalCode: null } : { exitCode: null, signalCode: null };
      },
      waitUntilReady: async (_port, child) => {
        if (child.exitCode !== null) throw Object.assign(new Error("bind failed"), { code: "EACCES" });
      },
    });
    assert.equal(started.length, 2);
    assert.equal(started[0], 56830);
    assert.notEqual(recovered.port, 56830);
    assert.equal(JSON.parse(await readFile(path.join(workspace, "scenario-port.json"), "utf8")).port, recovered.port);

    const stableStarts: number[] = [];
    const stable = await startPersistentScenarioLabWithRecovery({
      config,
      start: port => { stableStarts.push(port); return { exitCode: null, signalCode: null }; },
      waitUntilReady: async () => undefined,
    });
    assert.deepEqual(stableStarts, [recovered.port]);
    assert.equal(stable.port, recovered.port);

    const failedStarts: number[] = [];
    await assert.rejects(startPersistentScenarioLabWithRecovery({
      config,
      start: port => { failedStarts.push(port); return { exitCode: 1, signalCode: null }; },
      waitUntilReady: async () => { throw Object.assign(new Error("bind failed"), { code: "EACCES" }); },
    }), /bind failed/u);
    assert.equal(failedStarts.length, 2);
  } finally {
    await rm(runs, { recursive: true, force: true });
  }
});
