import assert from "node:assert/strict";
import test from "node:test";
import type { CloneJsonObject } from "@fluxiq-web-extension/test-contracts";
import { attestCloneEquivalence, classifyCloneDependencies, createDeterministicCloneIdMap, remapCloneDocument } from "../clone-policy.js";

function flow(): CloneJsonObject {
  return {
    schemaVersion: "0.1", flowId: "flow.source", projectId: "project.source", name: "Clone source",
    scope: { kind: "domain", domainId: "web-automation" }, visibility: "private", origin: "manual",
    source: { mode: "visual" }, interface: { inputs: [], outputs: [] }, errors: [], variables: [],
    nodes: [
      { id: "node.native", definitionId: "builtin.start" },
      { id: "node.domain", definitionId: "web.output.dom-type" },
      { id: "node.external", definitionId: "external.mail.send" },
    ],
    edges: [
      { id: "edge.one", sourceNodeId: "node.native", targetNodeId: "node.domain" },
      { id: "edge.two", sourceNodeId: "node.domain", targetNodeId: "node.external" },
    ],
    publication: { status: "draft" }, createdAt: 1, updatedAt: 2,
  };
}

test("dependency classification allows only explicit registries and named external doubles", () => {
  const assessment = classifyCloneDependencies(flow(), {
    nativeNodeDefinitionIds: ["builtin.start"],
    domainNodeDefinitionIds: ["web.output.dom-type"],
    externalSideEffectNodeDefinitionIds: ["external.mail.send"],
    testDoubles: { "external.mail.send": "test-double.mail.capture" },
  });
  assert.equal(assessment.compatibility.verdict, "compatible");
  assert.deepEqual(assessment.dependencies.filter(item => item.kind !== "flow-local-reference").map(item => item.decision), ["allow", "allow", "test-double"]);
  assert.equal(assessment.dependencies.find(item => item.kind === "external-side-effect")?.replacementId, "test-double.mail.capture");
});

test("unknown and undoubled external definitions fail closed with bounded findings", () => {
  const assessment = classifyCloneDependencies(flow(), {
    nativeNodeDefinitionIds: ["builtin.start"], domainNodeDefinitionIds: [], externalSideEffectNodeDefinitionIds: ["external.mail.send"],
  });
  assert.equal(assessment.compatibility.verdict, "incompatible");
  assert.equal(assessment.dependencies.filter(item => item.decision === "reject").length, 2);
  assert.ok(assessment.compatibility.reasons.every(reason => reason.length < 600));
  assert.throws(() => classifyCloneDependencies(flow(), { nativeNodeDefinitionIds: ["builtin.start"], domainNodeDefinitionIds: ["builtin.start"] }), /must not overlap/);
});

test("published and cross-Flow dependencies are inventoried and rejected before destination startup", () => {
  const assessment = classifyCloneDependencies(flow(), {
    nativeNodeDefinitionIds: ["builtin.start"], domainNodeDefinitionIds: ["web.output.dom-type"],
    externalSideEffectNodeDefinitionIds: ["external.mail.send"], testDoubles: { "external.mail.send": "test-double.mail.capture" },
    declaredFlowDependencies: [{ flowId: "flow.shared", publicationId: "publication.shared", version: "1.0.0" }],
  });
  assert.equal(assessment.compatibility.verdict, "incompatible");
  assert.deepEqual(assessment.dependencies.filter(item => item.kind === "flow-reference").map(item => item.referenceId), ["flow.shared"]);
});

test("ID maps and remapped documents are deterministic and cover graph identities", () => {
  const first = createDeterministicCloneIdMap(flow(), { projectId: "project.clone", flowId: "flow.clone" });
  const second = createDeterministicCloneIdMap(flow(), { projectId: "project.clone", flowId: "flow.clone" });
  assert.deepEqual(first, second);
  assert.equal(first.filter(item => item.kind === "node").length, 3);
  assert.equal(first.filter(item => item.kind === "edge").length, 2);
  assert.equal(new Set(first.map(item => item.destinationId)).size, first.length);
});

test("read-back equivalence permits only declared identity, timestamp, origin, and test-double changes", () => {
  const source = flow();
  const assessment = classifyCloneDependencies(source, {
    nativeNodeDefinitionIds: ["builtin.start"], domainNodeDefinitionIds: ["web.output.dom-type"],
    externalSideEffectNodeDefinitionIds: ["external.mail.send"], testDoubles: { "external.mail.send": "test-double.mail.capture" },
  });
  const map = createDeterministicCloneIdMap(source, { projectId: "project.clone", flowId: "flow.clone" });
  const destination = remapCloneDocument(source, map, { timestamp: 100, dependencies: assessment.dependencies });
  const pass = attestCloneEquivalence(source, destination, map, assessment.dependencies);
  assert.equal(pass.equivalent, true);
  const tampered = structuredClone(destination);
  (tampered.nodes as CloneJsonObject[])[1]!.definitionId = "web.output.dom-click";
  const fail = attestCloneEquivalence(source, tampered, map, assessment.dependencies);
  assert.equal(fail.equivalent, false);
  assert.deepEqual(fail.differences, ["$.nodes"]);
});

test("remapping fails when an edge references an undeclared node", () => {
  const source = flow();
  (source.edges as CloneJsonObject[])[0]!.targetNodeId = "node.missing";
  const map = createDeterministicCloneIdMap(source, { projectId: "project.clone", flowId: "flow.clone" });
  assert.throws(() => remapCloneDocument(source, map, { timestamp: 1 }), /both endpoints/);
});
