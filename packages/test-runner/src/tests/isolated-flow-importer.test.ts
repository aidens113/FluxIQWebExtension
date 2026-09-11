import assert from "node:assert/strict";
import test from "node:test";
import type { CloneJsonObject, ClonePackage } from "@fluxiq-web-extension/test-contracts";
import { createDeterministicCloneIdMap, hashCanonicalJson, remapCloneDocument } from "../clone-policy.js";
import { createRunOwnedCloneFlowId, createRunOwnedCloneProject, importClonePackageIntoIsolatedDestination, type IsolatedDestinationControl } from "../isolated-flow-importer.js";

const sourceFlow: CloneJsonObject = {
  schemaVersion: "0.1", flowId: "flow.source", projectId: "project.source", name: "Source Flow",
  scope: { kind: "domain", domainId: "web-automation" }, visibility: "private", origin: "manual", source: { mode: "visual" },
  interface: { inputs: [], outputs: [] }, errors: [], variables: [],
  nodes: [{ id: "start", definitionId: "builtin.control.start" }, { id: "action", definitionId: "web.dom.click" }],
  edges: [{ id: "start-action", sourceNodeId: "start", sourcePortId: "success", targetNodeId: "action", targetPortId: "in" }],
  publication: { status: "draft" }, createdAt: 10, updatedAt: 20,
};

function clonePackage(projectId = "project.destination", flowId = "flow.clone.destination"): ClonePackage {
  return {
    schemaVersion: "0.1",
    source: { origin: "https://source.example.test", projectId: "project.source", flowId: "flow.source", contentHash: hashCanonicalJson(sourceFlow), updatedAt: 20 },
    flowDocument: structuredClone(sourceFlow),
    dependencies: [
      { dependencyId: "node:start", kind: "native-node", referenceId: "builtin.control.start", decision: "allow", reason: "Registered native definition." },
      { dependencyId: "node:action", kind: "domain-node", referenceId: "web.dom.click", decision: "allow", reason: "Registered domain definition." },
    ],
    compatibility: { verdict: "compatible", reasons: [] },
    idMap: createDeterministicCloneIdMap(sourceFlow, { projectId, flowId }),
  };
}

test("creates a deterministic, run-owned project using the public destination seam", async () => {
  const calls: unknown[] = [];
  const control = { createProject: async (...args: unknown[]) => { calls.push(args); return "project.created"; } } as unknown as IsolatedDestinationControl;
  const result = await createRunOwnedCloneProject(control, { runId: "run.one", sourceContentHash: "a".repeat(64), authorizationPin: "123456", domainId: "web-automation", timeoutMs: 5000 });
  assert.equal(result.projectId, "project.created");
  assert.match(result.name, /^Clone test [a-f0-9]{20}$/);
  const [request, bounds] = calls[0] as [{ name: string; authorizationPin: string; domainId: string }, { timeoutMs: number }];
  assert.equal(request.name, result.name);
  assert.equal(request.authorizationPin, "123456");
  assert.equal(request.domainId, "web-automation");
  assert.deepEqual(bounds, { timeoutMs: 5000 });
});

test("derives a bounded Flow ID from the complete run and source identity", () => {
  const input = { runId: "run.one", sourceProjectId: "project.source", sourceFlowId: "flow.source", sourceContentHash: "a".repeat(64) };
  const first = createRunOwnedCloneFlowId(input);
  assert.match(first, /^flow\.clone\.[a-f0-9]{24}$/);
  assert.equal(createRunOwnedCloneFlowId(input), first);
  assert.notEqual(createRunOwnedCloneFlowId({ ...input, runId: "run.two" }), first);
});

test("creates, saves, reads back, and attests an imported Flow with only declared ID changes", async () => {
  const pkg = clonePackage();
  const calls: string[] = [];
  let persisted: CloneJsonObject | undefined;
  const created = { ...sourceFlow, projectId: "project.destination", flowId: "flow.clone.destination", nodes: [], edges: [], createdAt: 100, updatedAt: 100 };
  const control: IsolatedDestinationControl = {
    createProject: async () => { throw new Error("project creation is a separate ownership step"); },
    createFlow: async input => { calls.push("create-flow"); assert.equal(input.authorizationPin, "123456"); return envelope(created); },
    saveFlow: async input => { calls.push("save-flow"); assert.equal(input.expectedUpdatedAt, 100); persisted = { ...(input.flow as CloneJsonObject), updatedAt: 110 }; return envelope(persisted); },
    getFlow: async (projectId, flowId) => { calls.push("get-flow"); assert.equal(projectId, "project.destination"); assert.equal(flowId, "flow.clone.destination"); return envelope(persisted); },
  };
  const result = await importClonePackageIntoIsolatedDestination(control, { clonePackage: pkg, destinationProjectId: "project.destination", authorizationPin: "123456" });
  assert.deepEqual(calls, ["create-flow", "save-flow", "get-flow"]);
  assert.equal(result.attested, true);
  assert.equal(result.projectId, "project.destination");
  assert.equal(result.flowId, "flow.clone.destination");
  assert.notEqual((result.document.nodes as CloneJsonObject[])[0]!.id, "start");
  assert.equal((result.document.edges as CloneJsonObject[])[0]!.sourceNodeId, (result.document.nodes as CloneJsonObject[])[0]!.id);
});

test("fails before mutation for incompatible or wrong-destination packages", async () => {
  let mutations = 0;
  const control = { createFlow: async () => { mutations += 1; }, saveFlow: async () => { mutations += 1; }, getFlow: async () => undefined, createProject: async () => "unused" } as unknown as IsolatedDestinationControl;
  await assert.rejects(() => importClonePackageIntoIsolatedDestination(control, { clonePackage: clonePackage(), destinationProjectId: "project.other", authorizationPin: "123456" }), /destination project/i);
  const incompatible = clonePackage();
  incompatible.dependencies[0] = { ...incompatible.dependencies[0]!, decision: "reject", reason: "Unavailable." };
  incompatible.compatibility = { verdict: "incompatible", reasons: ["Unavailable."] };
  await assert.rejects(() => importClonePackageIntoIsolatedDestination(control, { clonePackage: incompatible, destinationProjectId: "project.destination", authorizationPin: "123456" }), /Incompatible/);
  assert.equal(mutations, 0);
});

test("fails closed on scope mismatch and on altered read-back content", async () => {
  const pkg = clonePackage();
  let saveCalls = 0;
  const wrongScope: IsolatedDestinationControl = {
    createProject: async () => "unused",
    createFlow: async () => envelope({ ...sourceFlow, projectId: "project.destination", flowId: "flow.clone.destination", scope: { kind: "global" }, createdAt: 100, updatedAt: 100 }),
    saveFlow: async () => { saveCalls += 1; return envelope({}); },
    getFlow: async () => envelope({}),
  };
  await assert.rejects(() => importClonePackageIntoIsolatedDestination(wrongScope, { clonePackage: pkg, destinationProjectId: "project.destination", authorizationPin: "123456" }), /scope is incompatible/i);
  assert.equal(saveCalls, 0);

  let persisted: CloneJsonObject | undefined;
  const altered: IsolatedDestinationControl = {
    createProject: async () => "unused",
    createFlow: async () => envelope({ ...sourceFlow, projectId: "project.destination", flowId: "flow.clone.destination", createdAt: 100, updatedAt: 100 }),
    saveFlow: async input => { persisted = { ...(input.flow as CloneJsonObject), updatedAt: 110 }; return envelope(persisted); },
    getFlow: async () => envelope({ ...persisted!, name: "Altered after save" }),
  };
  await assert.rejects(() => importClonePackageIntoIsolatedDestination(altered, { clonePackage: pkg, destinationProjectId: "project.destination", authorizationPin: "123456" }), /read-back content/i);
});

test("deterministic remapping yields the same document for the same destination", () => {
  const pkg = clonePackage();
  const left = remapCloneDocument(pkg.flowDocument, pkg.idMap, { timestamp: 100, dependencies: pkg.dependencies });
  const right = remapCloneDocument(pkg.flowDocument, pkg.idMap, { timestamp: 100, dependencies: pkg.dependencies });
  assert.equal(hashCanonicalJson(left), hashCanonicalJson(right));
});

function envelope(flow: unknown): unknown { return { ok: true, payload: { flow } }; }
