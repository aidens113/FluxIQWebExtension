import assert from "node:assert/strict";
import test from "node:test";
import type { CloneJsonObject } from "@fluxiq-web-extension/test-contracts";
import { attestCloneEquivalence, hashCanonicalJson } from "../clone-policy.js";
import { exportClonePackage, type ReadOnlyCloneSourceClient } from "../clone-source-exporter.js";
import { createRunOwnedCloneFlowId, createRunOwnedCloneProject, importClonePackageIntoIsolatedDestination, type IsolatedDestinationControl } from "../isolated-flow-importer.js";
import type { CloneTargetConfiguration } from "../target-config.js";

test("exports, classifies, remaps, imports, and attests a source Flow without mutating the source", async () => {
  const sourceCalls: string[] = [];
  const destinationCalls: string[] = [];
  const sourceDocument: CloneJsonObject = {
    schemaVersion: "0.1", projectId: "project.source", flowId: "flow.source", name: "Synthetic pipeline",
    description: "Source remains immutable", scope: { kind: "domain", domainId: "web-automation" }, visibility: "private",
    origin: "manual", source: { mode: "visual" }, interface: { inputs: [], outputs: [] }, errors: [], variables: [],
    nodes: [{ id: "start", definitionId: "builtin.control.start" }, { id: "type", definitionId: "web.dom.type" }],
    edges: [{ id: "start-type", sourceNodeId: "start", sourcePortId: "success", targetNodeId: "type", targetPortId: "in" }],
    publication: { status: "draft" }, createdAt: 10, updatedAt: 20,
  };
  const sourceHashBefore = hashCanonicalJson(sourceDocument);
  const sourceBytesBefore = JSON.stringify(sourceDocument);
  const source: ReadOnlyCloneSourceClient = {
    async login() { sourceCalls.push("auth.login"); return "login"; },
    async validateCurrentSession() { sourceCalls.push("auth.session"); return { identityEndpointAvailable: true, username: "runner" }; },
    async requireProject() { sourceCalls.push("projects"); return { id: "project.source", name: "Source", description: "", domainId: "web-automation", createdAt: 1, updatedAt: 2 }; },
    async listFlowSummaries() { sourceCalls.push("list-flow-summaries"); return [{ flowId: "flow.source", name: "Synthetic pipeline", sourceMode: "visual", nodeCount: 2, edgeCount: 1, updatedAt: 20 }]; },
    async getExactFlow() { sourceCalls.push("get-flow"); return { flowId: "flow.source", projectId: "project.source", name: "Synthetic pipeline", updatedAt: 20, contentHash: sourceHashBefore, document: sourceDocument as Record<string, unknown> }; },
    async inspectFlowDependencies() { sourceCalls.push("inspect-flow-dependencies"); return { dependencies: [], usedBy: [], availableUpgrades: [] }; },
    async listNativeNodeDefinitions() { sourceCalls.push("list-native-node-definitions"); return [
      { id: "builtin.control.start", version: "1.0.0", sourceKind: "builtin", executable: true, externalSideEffect: false },
      { id: "web.dom.type", version: "1.0.0", sourceKind: "importer", sourceDomainId: "web-automation", executable: true, externalSideEffect: false },
    ]; },
  };

  let persisted: CloneJsonObject | undefined;
  const destination: IsolatedDestinationControl = {
    async createProject() { destinationCalls.push("create-project"); return "project.destination"; },
    async createFlow(input) {
      destinationCalls.push("create-flow");
      return envelope({ ...sourceDocument, projectId: input.projectId, flowId: input.flowId, name: input.name, nodes: [], edges: [], createdAt: 100, updatedAt: 100 });
    },
    async saveFlow(input) {
      destinationCalls.push("save-flow");
      persisted = { ...(input.flow as CloneJsonObject), updatedAt: 110 };
      return envelope(persisted);
    },
    async getFlow() { destinationCalls.push("get-flow"); return envelope(persisted); },
  };
  const project = await createRunOwnedCloneProject(destination, { runId: "run.synthetic", sourceContentHash: sourceHashBefore, authorizationPin: "123456" });
  const destinationFlowId = createRunOwnedCloneFlowId({ runId: "run.synthetic", sourceProjectId: "project.source", sourceFlowId: "flow.source", sourceContentHash: sourceHashBefore });
  const target: CloneTargetConfiguration = { mode: "clone", source: { baseUrl: "https://source.example.test", projectId: "project.source", flowId: "flow.source", credentials: { username: "runner", password: "source-password" } } };
  const clonePackage = await exportClonePackage(target, { destination: { projectId: project.projectId, flowId: destinationFlowId }, createClient: () => source });
  const imported = await importClonePackageIntoIsolatedDestination(destination, { clonePackage, destinationProjectId: project.projectId, authorizationPin: "123456" });

  assert.deepEqual(sourceCalls, ["auth.login", "auth.session", "projects", "list-flow-summaries", "get-flow", "inspect-flow-dependencies", "list-native-node-definitions"]);
  assert.deepEqual(destinationCalls, ["create-project", "create-flow", "save-flow", "get-flow"]);
  assert.equal(hashCanonicalJson(sourceDocument), sourceHashBefore);
  assert.equal(JSON.stringify(sourceDocument), sourceBytesBefore);
  assert.notEqual(imported.projectId, "project.source");
  assert.notEqual(imported.flowId, "flow.source");
  const sourceNodeIds = new Set((sourceDocument.nodes as CloneJsonObject[]).map(node => node.id));
  const destinationNodes = imported.document.nodes as CloneJsonObject[];
  assert.equal(destinationNodes.every(node => typeof node.id === "string" && !sourceNodeIds.has(node.id)), true);
  const destinationEdge = (imported.document.edges as CloneJsonObject[])[0]!;
  assert.equal(destinationEdge.sourceNodeId, destinationNodes[0]!.id);
  assert.equal(destinationEdge.targetNodeId, destinationNodes[1]!.id);
  const attestation = attestCloneEquivalence(clonePackage.flowDocument, imported.document, clonePackage.idMap, clonePackage.dependencies);
  assert.equal(imported.attested, true);
  assert.equal(attestation.equivalent, true);
  assert.deepEqual(attestation.differences, []);
});

function envelope(flow: unknown): unknown { return { ok: true, payload: { flow } }; }
