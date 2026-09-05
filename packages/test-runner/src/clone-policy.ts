import { createHash } from "node:crypto";
import type { CloneDependency, CloneIdMapping, CloneJsonObject, ClonePackage } from "@fluxiq-web-extension/test-contracts";

type JsonRecord = Record<string, unknown>;

export type CloneDependencyPolicy = {
  domainNodeDefinitionIds: readonly string[];
  nativeNodeDefinitionIds: readonly string[];
  externalSideEffectNodeDefinitionIds?: readonly string[];
  testDoubles?: Readonly<Record<string, string>>;
  /** Published/cross-Flow dependencies are inventoried but cannot be copied. */
  declaredFlowDependencies?: readonly { flowId: string; publicationId?: string; version?: string }[];
};

export type CloneDependencyAssessment = {
  dependencies: CloneDependency[];
  compatibility: ClonePackage["compatibility"];
};

export type CloneEquivalenceAttestation = {
  equivalent: boolean;
  sourceHash: string;
  destinationNormalizedHash: string;
  differences: string[];
};

/** Every executable definition is explicitly admitted; prefixes never imply trust. */
export function classifyCloneDependencies(flowDocument: CloneJsonObject, policy: CloneDependencyPolicy): CloneDependencyAssessment {
  const nodes = requireRecordArray(flowDocument.nodes, "flow.nodes");
  const domain = checkedSet(policy.domainNodeDefinitionIds, "domain node definition");
  const native = checkedSet(policy.nativeNodeDefinitionIds, "native node definition");
  const external = checkedSet(policy.externalSideEffectNodeDefinitionIds ?? [], "external side-effect definition");
  const doubles = checkedDoubles(policy.testDoubles ?? {});
  ensureDisjoint(domain, native, external);

  const dependencies: CloneDependency[] = flowLocalDependencies(flowDocument);
  for (const [index, node] of nodes.entries()) {
    const nodeId = identifier(node.id, `flow.nodes[${index}].id`);
    const definitionId = identifier(node.definitionId, `flow.nodes[${index}].definitionId`);
    const dependencyId = `node:${nodeId}`;
    if (external.has(definitionId)) {
      const replacementId = doubles.get(definitionId);
      dependencies.push(replacementId
        ? { dependencyId, kind: "external-side-effect", referenceId: definitionId, decision: "test-double", replacementId, reason: "External side effect is replaced by an explicitly registered test double." }
        : { dependencyId, kind: "external-side-effect", referenceId: definitionId, decision: "reject", reason: "External side effect has no explicitly registered test double." });
    } else if (domain.has(definitionId)) {
      dependencies.push({ dependencyId, kind: "domain-node", referenceId: definitionId, decision: "allow", reason: "Definition is present in the destination domain registry." });
    } else if (native.has(definitionId)) {
      dependencies.push({ dependencyId, kind: "native-node", referenceId: definitionId, decision: "allow", reason: "Definition is present in the destination native registry." });
    } else {
      dependencies.push({ dependencyId, kind: "native-node", referenceId: definitionId, decision: "reject", reason: "Definition is not explicitly registered for the isolated destination." });
    }
  }
  for (const [index, dependency] of (policy.declaredFlowDependencies ?? []).entries()) {
    const flowId = identifier(dependency.flowId, `declaredFlowDependencies[${index}].flowId`);
    dependencies.push({
      dependencyId: `flow-reference:${index}`,
      kind: "flow-reference",
      referenceId: flowId,
      decision: "reject",
      reason: "Cross-Flow and published Flow dependencies are not copied into an isolated clone.",
    });
  }
  const rejected = dependencies.filter(item => item.decision === "reject");
  return {
    dependencies,
    compatibility: rejected.length === 0
      ? { verdict: "compatible", reasons: [] }
      : { verdict: "incompatible", reasons: rejected.map(item => `${item.dependencyId}: ${item.reason}`) },
  };
}

function flowLocalDependencies(flowDocument: CloneJsonObject): CloneDependency[] {
  const projectId = identifier(flowDocument.projectId, "flow.projectId");
  const flowId = identifier(flowDocument.flowId, "flow.flowId");
  const nodes = requireRecordArray(flowDocument.nodes, "flow.nodes");
  const edges = requireRecordArray(flowDocument.edges, "flow.edges");
  return [
    { dependencyId: "local:project", kind: "flow-local-reference", referenceId: projectId, decision: "remap", reason: "Source project identity is remapped to run-owned destination identity." },
    { dependencyId: "local:flow", kind: "flow-local-reference", referenceId: flowId, decision: "remap", reason: "Source Flow identity is remapped to run-owned destination identity." },
    ...nodes.map((node, index): CloneDependency => ({ dependencyId: `local:node:${index}`, kind: "flow-local-reference", referenceId: identifier(node.id, `flow.nodes[${index}].id`), decision: "remap", reason: "Flow-local node identity is deterministically remapped." })),
    ...edges.map((edge, index): CloneDependency => ({ dependencyId: `local:edge:${index}`, kind: "flow-local-reference", referenceId: identifier(edge.id, `flow.edges[${index}].id`), decision: "remap", reason: "Flow-local edge identity and endpoints are deterministically remapped." })),
  ];
}

export function createDeterministicCloneIdMap(
  flowDocument: CloneJsonObject,
  destination: { projectId: string; flowId: string },
): CloneIdMapping[] {
  const sourceProjectId = identifier(flowDocument.projectId, "flow.projectId");
  const sourceFlowId = identifier(flowDocument.flowId, "flow.flowId");
  const destinationProjectId = identifier(destination.projectId, "destination.projectId");
  const destinationFlowId = identifier(destination.flowId, "destination.flowId");
  if (sourceProjectId === destinationProjectId || sourceFlowId === destinationFlowId) throw new Error("Clone destination project and Flow IDs must differ from source IDs");
  const nodeIds = requireRecordArray(flowDocument.nodes, "flow.nodes").map((node, index) => identifier(node.id, `flow.nodes[${index}].id`));
  const edgeIds = requireRecordArray(flowDocument.edges, "flow.edges").map((edge, index) => identifier(edge.id, `flow.edges[${index}].id`));
  requireUnique(nodeIds, "Flow node IDs");
  requireUnique(edgeIds, "Flow edge IDs");
  const mappings: CloneIdMapping[] = [
    { kind: "project", sourceId: sourceProjectId, destinationId: destinationProjectId },
    { kind: "flow", sourceId: sourceFlowId, destinationId: destinationFlowId },
    ...nodeIds.sort().map(sourceId => ({ kind: "node" as const, sourceId, destinationId: deterministicId("node", destinationFlowId, sourceId) })),
    ...edgeIds.sort().map(sourceId => ({ kind: "edge" as const, sourceId, destinationId: deterministicId("edge", destinationFlowId, sourceId) })),
  ];
  return mappings;
}

export function remapCloneDocument(
  source: CloneJsonObject,
  idMap: readonly CloneIdMapping[],
  options: { timestamp: number; dependencies?: readonly CloneDependency[] },
): CloneJsonObject {
  if (!Number.isSafeInteger(options.timestamp) || options.timestamp < 0) throw new Error("Clone destination timestamp must be a non-negative integer");
  const output = structuredClone(source) as JsonRecord;
  const project = requireSingleMapping(idMap, "project");
  const flow = requireSingleMapping(idMap, "flow");
  const nodes = mappingBySource(idMap, "node");
  const edges = mappingBySource(idMap, "edge");
  const replacements = new Map((options.dependencies ?? []).filter(item => item.decision === "test-double").map(item => [item.referenceId, item.replacementId!]));
  output.projectId = project.destinationId;
  output.flowId = flow.destinationId;
  output.origin = "imported";
  output.publication = { status: "draft" };
  output.createdAt = options.timestamp;
  output.updatedAt = options.timestamp;
  output.nodes = requireRecordArray(output.nodes, "flow.nodes").map((node, index) => {
    const sourceId = identifier(node.id, `flow.nodes[${index}].id`);
    const definitionId = identifier(node.definitionId, `flow.nodes[${index}].definitionId`);
    const destinationId = nodes.get(sourceId);
    if (!destinationId) throw new Error(`Clone ID map is missing node ${safeReference(sourceId)}`);
    return { ...node, id: destinationId, definitionId: replacements.get(definitionId) ?? definitionId };
  });
  output.edges = requireRecordArray(output.edges, "flow.edges").map((edge, index) => {
    const sourceId = identifier(edge.id, `flow.edges[${index}].id`);
    const sourceNodeId = identifier(edge.sourceNodeId, `flow.edges[${index}].sourceNodeId`);
    const targetNodeId = identifier(edge.targetNodeId, `flow.edges[${index}].targetNodeId`);
    const destinationId = edges.get(sourceId);
    const destinationSource = nodes.get(sourceNodeId);
    const destinationTarget = nodes.get(targetNodeId);
    if (!destinationId || !destinationSource || !destinationTarget) throw new Error(`Clone ID map does not cover edge ${safeReference(sourceId)} and both endpoints`);
    return { ...edge, id: destinationId, sourceNodeId: destinationSource, targetNodeId: destinationTarget };
  });
  return output as CloneJsonObject;
}

export function attestCloneEquivalence(
  source: CloneJsonObject,
  destination: CloneJsonObject,
  idMap: readonly CloneIdMapping[],
  dependencies: readonly CloneDependency[] = [],
): CloneEquivalenceAttestation {
  const expected = normalizeEquivalence(source);
  const restored = structuredClone(destination) as JsonRecord;
  const reverseProject = reverseMapping(idMap, "project");
  const reverseFlow = reverseMapping(idMap, "flow");
  const reverseNodes = reverseMappingMap(idMap, "node");
  const reverseEdges = reverseMappingMap(idMap, "edge");
  const reverseDefinitions = new Map(dependencies.filter(item => item.decision === "test-double").map(item => [item.replacementId!, item.referenceId]));
  restored.projectId = reverseProject.sourceId;
  restored.flowId = reverseFlow.sourceId;
  restored.nodes = requireRecordArray(restored.nodes, "destination.nodes").map((node, index) => {
    const id = identifier(node.id, `destination.nodes[${index}].id`);
    const definitionId = identifier(node.definitionId, `destination.nodes[${index}].definitionId`);
    return { ...node, id: requireReverse(reverseNodes, id, "node"), definitionId: reverseDefinitions.get(definitionId) ?? definitionId };
  });
  restored.edges = requireRecordArray(restored.edges, "destination.edges").map((edge, index) => {
    const id = identifier(edge.id, `destination.edges[${index}].id`);
    const sourceNodeId = identifier(edge.sourceNodeId, `destination.edges[${index}].sourceNodeId`);
    const targetNodeId = identifier(edge.targetNodeId, `destination.edges[${index}].targetNodeId`);
    return { ...edge, id: requireReverse(reverseEdges, id, "edge"), sourceNodeId: requireReverse(reverseNodes, sourceNodeId, "node"), targetNodeId: requireReverse(reverseNodes, targetNodeId, "node") };
  });
  const actual = normalizeEquivalence(restored as CloneJsonObject);
  const sourceJson = stableJson(expected);
  const destinationJson = stableJson(actual);
  return {
    equivalent: sourceJson === destinationJson,
    sourceHash: hashCanonicalJson(expected),
    destinationNormalizedHash: hashCanonicalJson(actual),
    differences: sourceJson === destinationJson ? [] : topLevelDifferences(expected, actual),
  };
}

export function hashCanonicalJson(value: unknown): string { return createHash("sha256").update(stableJson(value)).digest("hex"); }

function normalizeEquivalence(input: CloneJsonObject): CloneJsonObject {
  const output = structuredClone(input) as JsonRecord;
  delete output.createdAt;
  delete output.updatedAt;
  delete output.origin;
  output.publication = { status: "draft" };
  return output as CloneJsonObject;
}

function requireSingleMapping(items: readonly CloneIdMapping[], kind: CloneIdMapping["kind"]): CloneIdMapping {
  const matches = items.filter(item => item.kind === kind);
  if (matches.length !== 1) throw new Error(`Clone ID map must contain exactly one ${kind} mapping`);
  return matches[0]!;
}

function reverseMapping(items: readonly CloneIdMapping[], kind: CloneIdMapping["kind"]): CloneIdMapping { return requireSingleMapping(items, kind); }
function mappingBySource(items: readonly CloneIdMapping[], kind: CloneIdMapping["kind"]): Map<string, string> { return new Map(items.filter(item => item.kind === kind).map(item => [item.sourceId, item.destinationId])); }
function reverseMappingMap(items: readonly CloneIdMapping[], kind: CloneIdMapping["kind"]): Map<string, string> { return new Map(items.filter(item => item.kind === kind).map(item => [item.destinationId, item.sourceId])); }
function requireReverse(map: Map<string, string>, value: string, kind: string): string { const result = map.get(value); if (!result) throw new Error(`Destination ${kind} ID is outside the declared clone map`); return result; }
function deterministicId(kind: "node" | "edge", destinationFlowId: string, sourceId: string): string { return `clone.${kind}.${hashCanonicalJson({ destinationFlowId, sourceId }).slice(0, 20)}`; }

function checkedSet(values: readonly string[], label: string): Set<string> { const result = new Set(values.map(value => identifier(value, label))); if (result.size !== values.length) throw new Error(`${label} IDs must be unique`); return result; }
function checkedDoubles(values: Readonly<Record<string, string>>): Map<string, string> { return new Map(Object.entries(values).map(([key, value]) => [identifier(key, "test-double source definition"), identifier(value, "test-double destination definition")])); }
function ensureDisjoint(...sets: Set<string>[]): void { const all = sets.flatMap(set => [...set]); if (new Set(all).size !== all.length) throw new Error("Clone dependency policy categories must not overlap"); }
function requireUnique(values: string[], label: string): void { if (new Set(values).size !== values.length) throw new Error(`${label} must be unique`); }
function requireRecordArray(value: unknown, path: string): JsonRecord[] { if (!Array.isArray(value) || value.some(item => !isRecord(item))) throw new Error(`${path} must be an array of objects`); return value as JsonRecord[]; }
function identifier(value: unknown, path: string): string { if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(value)) throw new Error(`${path} must be a bounded safe identifier`); return value; }
function safeReference(value: string): string { return /^[A-Za-z0-9._:/-]{1,256}$/u.test(value) ? value : "[invalid-reference]"; }
function isRecord(value: unknown): value is JsonRecord { return typeof value === "object" && value !== null && !Array.isArray(value); }
function stableJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`; if (isRecord(value)) return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`; return JSON.stringify(value); }
function topLevelDifferences(left: CloneJsonObject, right: CloneJsonObject): string[] { return [...new Set([...Object.keys(left), ...Object.keys(right)])].sort().filter(key => stableJson(left[key]) !== stableJson(right[key])).map(key => `$.${key}`); }
