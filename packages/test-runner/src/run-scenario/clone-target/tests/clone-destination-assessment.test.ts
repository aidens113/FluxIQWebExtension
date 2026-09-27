import assert from "node:assert/strict";
import test from "node:test";
import type { ClonePackage } from "@fluxiq-web-extension/test-contracts";
import type { ExistingNodeDefinition } from "../../../existing-fluxiq-control.js";
import { cloneDestinationAssessment } from "../clone-destination-assessment.js";

const flowDocument = {
  schemaVersion: "0.1",
  flowId: "flow.source",
  projectId: "project.source",
  nodes: [
    { id: "node.native", definitionId: "builtin.start" },
    { id: "node.domain", definitionId: "web.output.dom-type" },
    { id: "node.external", definitionId: "external.mail.send" },
  ],
  edges: [{ id: "edge.one", sourceNodeId: "node.native", targetNodeId: "node.domain" }],
};

/** The source export's own decisions, which is where a registered test double comes from. */
const doubled = [{ dependencyId: "node:node.external", kind: "external-side-effect", referenceId: "external.mail.send", decision: "test-double", replacementId: "test-double.mail.capture", reason: "registered" }];

const clonePackage = (dependencies: unknown[] = []) => ({ flowDocument, dependencies }) as unknown as ClonePackage;

const definition = (id: string, overrides: Record<string, unknown> = {}): ExistingNodeDefinition =>
  ({ id, sourceKind: "builtin", externalSideEffect: false, ...overrides }) as unknown as ExistingNodeDefinition;

const domainNode = (id: string) => definition(id, { sourceKind: "importer", sourceDomainId: "web-automation" });

const DESTINATION = [definition("builtin.start"), domainNode("web.output.dom-type"), domainNode("external.mail.send"), definition("test-double.mail.capture")];
const withSideEffect = DESTINATION.map(item => (item.id === "external.mail.send" ? definition(item.id, { sourceKind: "importer", sourceDomainId: "web-automation", externalSideEffect: true }) : item));

test("a destination providing every dependency, with the source's double registered, is compatible", () => {
  const assessment = cloneDestinationAssessment(clonePackage(doubled), withSideEffect);
  assert.equal(assessment.compatibility.verdict, "compatible");
  assert.equal(assessment.dependencies.find(item => item.kind === "external-side-effect")?.replacementId, "test-double.mail.capture");
});

/**
 * The sorting rule *is* the safety rule. A definition that declares an external
 * side effect goes into the set the clone policy refuses to run unless the source
 * registered a double for it -- so an isolated replay cannot reach the outside
 * world through a node that merely happens to exist in both Cores.
 */
test("a side-effecting node the source registered no double for is not safe to run in isolation", () => {
  const assessment = cloneDestinationAssessment(clonePackage(), withSideEffect);
  assert.equal(assessment.compatibility.verdict, "incompatible");
  assert.deepEqual(assessment.dependencies.filter(item => item.decision === "reject").map(item => item.referenceId), ["external.mail.send"]);
});

test("a code-sourced definition is external even when it declares no side effect", () => {
  const codeSourced = DESTINATION.map(item => (item.id === "external.mail.send" ? definition(item.id, { sourceKind: "code" }) : item));
  assert.equal(cloneDestinationAssessment(clonePackage(), codeSourced).compatibility.verdict, "incompatible");
  assert.equal(cloneDestinationAssessment(clonePackage(doubled), codeSourced).compatibility.verdict, "compatible", "a code-sourced node with a registered double is replaced like any other side effect");
});

test("an importer from another domain is not this domain's node, so the Flow's dependency is unmet", () => {
  const otherDomain = withSideEffect.map(item => (item.id === "web.output.dom-type" ? definition(item.id, { sourceKind: "importer", sourceDomainId: "documents" }) : item));
  const assessment = cloneDestinationAssessment(clonePackage(doubled), otherDomain);
  assert.equal(assessment.compatibility.verdict, "incompatible");
  assert.deepEqual(assessment.dependencies.filter(item => item.decision === "reject").map(item => item.referenceId), ["web.output.dom-type"]);
});

test("a destination missing a definition the Flow needs is not compatible", () => {
  assert.equal(cloneDestinationAssessment(clonePackage(doubled), [definition("builtin.start")]).compatibility.verdict, "incompatible");
});
