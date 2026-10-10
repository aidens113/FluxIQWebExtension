import assert from "node:assert/strict";
import test from "node:test";
import type { CloneJsonObject } from "@fluxiq-web-extension/test-contracts";
import { hashCanonicalJson } from "../../../clone-policy.js";
import { exportClonePackage, type ReadOnlyCloneSourceClient } from "../../../clone-source-exporter.js";
import type { ExistingNodeDefinition } from "../../../existing-fluxiq-control.js";
import type { CloneRunState } from "../../../run-manifest/index.js";
import type { CloneTargetConfiguration } from "../../../target-config.js";
import { importCloneDestination, type CloneDestinationControl } from "../import-clone-destination.js";

const DEFINITIONS: ExistingNodeDefinition[] = [
  { id: "builtin.control.start", version: "1.0.0", sourceKind: "builtin", executable: true, externalSideEffect: false },
  { id: "web.dom.type", version: "1.0.0", sourceKind: "importer", sourceDomainId: "web-automation", executable: true, externalSideEffect: false },
] as ExistingNodeDefinition[];

const sourceDocument: CloneJsonObject = {
  schemaVersion: "0.1", projectId: "project.source", flowId: "flow.source", name: "Synthetic import",
  description: "", scope: { kind: "domain", domainId: "web-automation" }, visibility: "private",
  origin: "manual", source: { mode: "visual" }, interface: { inputs: [], outputs: [] }, errors: [], variables: [],
  nodes: [{ id: "start", definitionId: "builtin.control.start" }, { id: "type", definitionId: "web.dom.type" }],
  edges: [{ id: "start-type", sourceNodeId: "start", sourcePortId: "success", targetNodeId: "type", targetPortId: "in" }],
  publication: { status: "draft" }, createdAt: 10, updatedAt: 20,
};

/** A package exported from a fake source, exactly as the clone target exports one before the destination exists. */
async function exportedPackage() {
  const contentHash = hashCanonicalJson(sourceDocument);
  const source: ReadOnlyCloneSourceClient = {
    async login() { return "login"; },
    async validateCurrentSession() { return { identityEndpointAvailable: true, username: "runner" }; },
    async requireProject() { return { id: "project.source", name: "Source", description: "", domainId: "web-automation", createdAt: 1, updatedAt: 2 }; },
    async listFlowSummaries() { return [{ flowId: "flow.source", name: "Synthetic import", sourceMode: "visual", nodeCount: 2, edgeCount: 1, updatedAt: 20 }]; },
    async getExactFlow() { return { flowId: "flow.source", projectId: "project.source", name: "Synthetic import", updatedAt: 20, contentHash, document: sourceDocument as Record<string, unknown> }; },
    async inspectFlowDependencies() { return { dependencies: [], usedBy: [], availableUpgrades: [] }; },
    async listNativeNodeDefinitions() { return DEFINITIONS; },
  };
  const target: CloneTargetConfiguration = { mode: "clone", source: { baseUrl: "https://source.example.test", projectId: "project.source", flowId: "flow.source", credentials: { username: "runner", password: "source-password" } } };
  return exportClonePackage(target, { destination: { projectId: "pending", flowId: "pending" }, createClient: () => source });
}

function destination(definitions: ExistingNodeDefinition[], calls: string[]): CloneDestinationControl {
  let persisted: CloneJsonObject | undefined;
  const envelope = (flow: unknown) => ({ ok: true, payload: { flow } });
  return {
    async listNativeNodeDefinitions() {
      calls.push("list-definitions");
      return definitions;
    },
    async createProject() {
      calls.push("create-project");
      return "project.destination";
    },
    async createFlow(input) {
      calls.push("create-flow");
      return envelope({ ...sourceDocument, projectId: input.projectId, flowId: input.flowId, name: input.name, nodes: [], edges: [], createdAt: 100, updatedAt: 100 });
    },
    async saveFlow(input) {
      calls.push("save-flow");
      persisted = { ...(input.flow as CloneJsonObject), updatedAt: 110 };
      return envelope(persisted);
    },
    async getFlow() {
      calls.push("get-flow");
      return envelope(persisted);
    },
    async selectExistingContext(projectId: string) { calls.push(`select:${projectId}`); },
  } as CloneDestinationControl;
}

test("the package is remapped, imported and attested, the run gets the destination project before it is selected, and both records are written", async () => {
  const clonePackage = await exportedPackage();
  const calls: string[] = [];
  const written = new Map<string, unknown>();
  const cloneState: CloneRunState = { clonePackage, sourceSessionIdentityVerified: false, sourceHashVerifiedAfterRun: false, cleanupOutcome: "pending" };
  await importCloneDestination({
    control: destination(DEFINITIONS, calls), projectId: "project.isolated", authorizationPin: "123456", runId: "run.synthetic", cloneState, clonePackage,
    bundle: { writeStructured: async (relativePath, value) => { written.set(relativePath, value); } },
    useDestinationProject: projectId => calls.push(`use:${projectId}`),
  });
  assert.deepEqual(calls, ["list-definitions", "create-project", "create-flow", "save-flow", "get-flow", "use:project.destination", "select:project.destination"]);
  assert.notEqual(cloneState.clonePackage, clonePackage, "the run keeps the remapped package");
  assert.equal(cloneState.destination?.projectId, "project.destination");
  assert.equal(cloneState.destination?.attested, true);
  assert.match(cloneState.clonePackageHash ?? "", /^[0-9a-f]{64}$/u);
  assert.equal(written.get("snapshots/clone-package.json"), cloneState.clonePackage);
  assert.deepEqual(written.get("snapshots/clone-import.json"), { projectId: "project.destination", flowId: cloneState.destination?.flowId, contentHash: cloneState.destination?.contentHash, clonePackageHash: cloneState.clonePackageHash, attested: true });
});

test("a destination without a safe definition the Flow needs is refused before anything is created", async () => {
  const clonePackage = await exportedPackage();
  const calls: string[] = [];
  const cloneState: CloneRunState = { clonePackage, sourceSessionIdentityVerified: false, sourceHashVerifiedAfterRun: false, cleanupOutcome: "pending" };
  await assert.rejects(importCloneDestination({
    control: destination(DEFINITIONS.slice(0, 1), calls), projectId: "project.isolated", authorizationPin: "123456", runId: "run.synthetic", cloneState, clonePackage,
    bundle: { writeStructured: async () => undefined },
    useDestinationProject: () => calls.push("use"),
  }), /every safe node definition/u);
  assert.deepEqual(calls, ["list-definitions"]);
});
