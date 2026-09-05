import assert from "node:assert/strict";
import test from "node:test";
import {
  ContractValidationError,
  assertClonePackage,
  canonicalClonePackageJson,
  parseClonePackageJson,
  sanitizeCloneFlowDocument,
  validateClonePackage,
} from "../dist/index.js";

const SHA = "a".repeat(64);
const flow = () => ({
  schemaVersion: "0.1", flowId: "flow.source", projectId: "project.source", name: "Clone source",
  scope: { kind: "domain", domainId: "web-automation" }, visibility: "private", origin: "manual",
  source: { mode: "visual" }, interface: { inputs: [], outputs: [] }, errors: [], variables: [],
  nodes: [{ id: "node.one", definitionId: "web.output.dom-type", parameterValues: { text: "synthetic value" } }],
  edges: [], publication: { status: "draft" }, createdAt: 1, updatedAt: 2,
  metadata: { maxTokensPerRun: 12_000 },
});
const packageValue = () => ({
  schemaVersion: "0.1",
  source: { origin: "https://fluxiq.invalid", projectId: "project.source", flowId: "flow.source", contentHash: SHA, updatedAt: 2 },
  flowDocument: flow(),
  dependencies: [{ dependencyId: "node:node.one", kind: "domain-node", referenceId: "web.output.dom-type", decision: "allow", reason: "Registered domain node." }],
  compatibility: { verdict: "compatible", reasons: [] },
  idMap: [
    { kind: "project", sourceId: "project.source", destinationId: "project.clone" },
    { kind: "flow", sourceId: "flow.source", destinationId: "flow.clone" },
    { kind: "node", sourceId: "node.one", destinationId: "clone.node.one" },
  ],
});

test("clone packages validate, parse, and serialize canonically", () => {
  const value = packageValue();
  assert.doesNotThrow(() => assertClonePackage(value));
  assert.deepEqual(parseClonePackageJson(JSON.stringify(value)), value);
  const reordered = { ...value, source: { ...value.source } };
  assert.equal(canonicalClonePackageJson(value), canonicalClonePackageJson(reordered));
});

test("clone package rejects unknown, credential-bearing, runtime, and opaque secret data", () => {
  for (const unsafe of [
    { ...packageValue(), cookie: "no" },
    { ...packageValue(), flowDocument: { ...flow(), credentials: { username: "user" } } },
    { ...packageValue(), flowDocument: { ...flow(), metadata: { runtimeHistory: [] } } },
    { ...packageValue(), flowDocument: { ...flow(), metadata: { note: "Bearer abcdefghijklmnopqrstuvwxyz" } } },
  ]) assert.throws(() => assertClonePackage(unsafe), ContractValidationError);
});

test("clone package enforces dependency verdicts, named doubles, unique maps, and source identity", () => {
  const rejected = packageValue();
  rejected.dependencies = [{ dependencyId: "node:node.one", kind: "external-side-effect", referenceId: "external.mail", decision: "reject", reason: "No double." }];
  assert.equal(validateClonePackage(rejected).valid, false);
  rejected.compatibility = { verdict: "incompatible", reasons: ["External mail is unsupported."] };
  assert.doesNotThrow(() => assertClonePackage(rejected));
  const unnamedDouble = packageValue();
  unnamedDouble.dependencies = [{ dependencyId: "node:node.one", kind: "external-side-effect", referenceId: "external.mail", decision: "test-double", reason: "Double." }];
  assert.throws(() => assertClonePackage(unnamedDouble), ContractValidationError);
  const wrongSource = packageValue(); wrongSource.flowDocument.flowId = "flow.other";
  assert.throws(() => assertClonePackage(wrongSource), ContractValidationError);
});

test("sanitization strips publication/history state but rejects secrets and unknown Flow fields", () => {
  const source = { ...flow(), publication: { status: "published", version: "1.0.0" }, publicationHistory: [{ publicationId: "pub.one" }], evidenceReferences: [{ id: "evidence" }] };
  const sanitized = sanitizeCloneFlowDocument(source);
  assert.deepEqual(sanitized.publication, { status: "draft" });
  assert.equal("publicationHistory" in sanitized, false);
  assert.equal("evidenceReferences" in sanitized, false);
  assert.throws(() => sanitizeCloneFlowDocument({ ...flow(), metadata: { apiKey: "not-copied" } }), ContractValidationError);
  assert.throws(() => sanitizeCloneFlowDocument({ ...flow(), futureUnsafeField: true }), ContractValidationError);
});
