import {
  assertClonePackage,
  sanitizeCloneFlowDocument,
  type CloneDependency,
  type CloneIdMapping,
  type ClonePackage,
} from "@fluxiq-web-extension/test-contracts";
import type { WebPanelAuthSessionCache } from "./auth-session.js";
import {
  ExistingFluxIQControlClient,
  type ExistingFlow,
  type ExistingFlowDependencyInventory,
  type ExistingNodeDefinition,
  type ExistingProject,
} from "./existing-fluxiq-control.js";
import { RunnerFailure } from "./failure.js";
import type { CloneTargetConfiguration } from "./target-config.js";
import { classifyCloneDependencies, createDeterministicCloneIdMap, hashCanonicalJson } from "./clone-policy.js";
import { ClonePackageCache, type CloneCacheScope, type CloneSourceRevision } from "./clone-cache.js";

/** The complete API surface available to source export. It intentionally has no mutation methods. */
export type ReadOnlyCloneSourceClient = Pick<ExistingFluxIQControlClient,
  "login" | "validateCurrentSession" | "requireProject" | "listFlowSummaries" | "getExactFlow" | "inspectFlowDependencies" | "listNativeNodeDefinitions"
>;

export type CloneSourceExport = {
  source: ClonePackage["source"];
  flowDocument: ClonePackage["flowDocument"];
  project: Pick<ExistingProject, "id" | "name" | "domainId">;
  dependencyInventory: ExistingFlowDependencyInventory;
  nodeDefinitions: ExistingNodeDefinition[];
  sessionIdentityVerified: boolean;
};

export type CloneSourceExporterOptions = {
  sessionCache?: WebPanelAuthSessionCache;
  createClient?: (origin: string) => ReadOnlyCloneSourceClient;
};

export type ClonePackageExportOptions = CloneSourceExporterOptions & {
  destination: { projectId: string; flowId: string };
  cache?: ClonePackageCache;
  externalSideEffectNodeDefinitionIds?: readonly string[];
  testDoubles?: Readonly<Record<string, string>>;
};

/**
 * Authenticates to the configured source and performs read-only export. The
 * returned value contains neither the client nor any authentication material.
 */
export async function exportCloneSource(target: CloneTargetConfiguration, options: CloneSourceExporterOptions = {}): Promise<CloneSourceExport> {
  const connected = await connectCloneSource(target, options);
  return finishCloneSourceExport(target, connected);
}

async function connectCloneSource(target: CloneTargetConfiguration, options: CloneSourceExporterOptions): Promise<{ client: ReadOnlyCloneSourceClient; project: ExistingProject; summary: Awaited<ReturnType<ReadOnlyCloneSourceClient["listFlowSummaries"]>>[number]; sessionIdentityVerified: boolean }> {
  const client = options.createClient?.(target.source.baseUrl) ?? new ExistingFluxIQControlClient(target.source.baseUrl);
  await client.login({
    username: target.source.credentials.username,
    password: target.source.credentials.password,
    ...(target.source.credentials.totp ? { totp: target.source.credentials.totp } : {}),
  }, {
    ...(options.sessionCache ? { sessionCache: options.sessionCache } : {}),
    ...(target.freshLogin ? { freshLogin: true } : {}),
  });

  const session = await client.validateCurrentSession(target.source.credentials.username);
  const project = await client.requireProject(target.source.projectId, "web-automation");
  if (project.domainId !== "web-automation") throw new RunnerFailure("environment.missing", "Clone source project is not a web-automation project");
  const summaries = (await client.listFlowSummaries(project.id)).filter(summary => summary.flowId === target.source.flowId);
  if (summaries.length !== 1) throw new RunnerFailure("environment.missing", `Expected exactly one source Flow with ID ${safeId(target.source.flowId)}, found ${summaries.length}`);
  return { client, project, summary: summaries[0]!, sessionIdentityVerified: session.identityEndpointAvailable };
}

async function finishCloneSourceExport(target: CloneTargetConfiguration, connected: Awaited<ReturnType<typeof connectCloneSource>>): Promise<CloneSourceExport> {
  const flow = await connected.client.getExactFlow(connected.project.id, target.source.flowId);
  const [dependencyInventory, nodeDefinitions] = await Promise.all([
    connected.client.inspectFlowDependencies(connected.project.id, flow.flowId),
    connected.client.listNativeNodeDefinitions(connected.project.id),
  ]);
  return sourceExport(target.source.baseUrl, connected.project, flow, dependencyInventory, nodeDefinitions, connected.sessionIdentityVerified);
}

/** Read, classify, and package the source without granting source write APIs. */
export async function exportClonePackage(target: CloneTargetConfiguration, options: ClonePackageExportOptions): Promise<ClonePackage> {
  const connected = await connectCloneSource(target, options);
  const scope: CloneCacheScope = { origin: target.source.baseUrl, username: target.source.credentials.username, projectId: target.source.projectId, flowId: target.source.flowId };
  const revision: CloneSourceRevision = {
    updatedAt: connected.summary.updatedAt,
    ...(connected.summary.version ? { version: connected.summary.version } : {}),
    fingerprint: hashCanonicalJson({ summary: connected.summary, externalSideEffectNodeDefinitionIds: [...(options.externalSideEffectNodeDefinitionIds ?? [])].sort(), testDoubles: options.testDoubles ?? {} }),
  };
  const cached = options.cache ? await options.cache.load(scope, revision) : undefined;
  const exported = cached?.clonePackage
    ? await currentPolicyExportFromCache(target, connected, cached.clonePackage)
    : await finishCloneSourceExport(target, connected);
  const assessment = classifyCloneDependencies(exported.flowDocument, {
    domainNodeDefinitionIds: exported.nodeDefinitions.filter(item => item.sourceKind === "importer" && item.sourceDomainId === "web-automation" && !item.externalSideEffect).map(item => item.id),
    nativeNodeDefinitionIds: exported.nodeDefinitions.filter(item => item.sourceKind === "builtin" && !item.externalSideEffect).map(item => item.id),
    declaredFlowDependencies: exported.dependencyInventory.dependencies.map(item => ({ flowId: item.flowId, publicationId: item.publicationId, version: item.version })),
    externalSideEffectNodeDefinitionIds: [...new Set([
      ...exported.nodeDefinitions.filter(item => item.externalSideEffect || item.sourceKind === "code").map(item => item.id),
      ...(options.externalSideEffectNodeDefinitionIds ?? []),
    ])],
    ...(options.testDoubles ? { testDoubles: options.testDoubles } : {}),
  });
  const clonePackage = buildClonePackage(exported, assessment.dependencies, createDeterministicCloneIdMap(exported.flowDocument, options.destination));
  if (options.cache) await options.cache.save(scope, revision, clonePackage);
  return clonePackage;
}

async function currentPolicyExportFromCache(target: CloneTargetConfiguration, connected: Awaited<ReturnType<typeof connectCloneSource>>, cached: ClonePackage): Promise<CloneSourceExport> {
  // A cached Flow document is reusable, but registry and published-Flow
  // dependencies can drift without changing the Flow summary. Always read
  // those lightweight policy inputs again before trusting compatibility.
  const [dependencyInventory, nodeDefinitions] = await Promise.all([
    connected.client.inspectFlowDependencies(connected.project.id, target.source.flowId),
    connected.client.listNativeNodeDefinitions(connected.project.id),
  ]);
  return {
    source: cached.source,
    flowDocument: cached.flowDocument,
    project: { id: connected.project.id, name: connected.project.name, ...(connected.project.domainId !== undefined ? { domainId: connected.project.domainId } : {}) },
    dependencyInventory,
    nodeDefinitions,
    sessionIdentityVerified: connected.sessionIdentityVerified,
  };
}

/** Completes the versioned package after the separate policy/remapping step. */
export function buildClonePackage(sourceExport: CloneSourceExport, dependencies: CloneDependency[], idMap: CloneIdMapping[]): ClonePackage {
  const rejected = dependencies.filter(dependency => dependency.decision === "reject");
  const clonePackage: ClonePackage = {
    schemaVersion: "0.1",
    source: sourceExport.source,
    flowDocument: sourceExport.flowDocument,
    dependencies,
    compatibility: rejected.length
      ? { verdict: "incompatible", reasons: rejected.map(dependency => dependency.reason) }
      : { verdict: "compatible", reasons: [] },
    idMap,
  };
  assertClonePackage(clonePackage);
  return clonePackage;
}

function sourceExport(origin: string, project: ExistingProject, flow: ExistingFlow, dependencyInventory: ExistingFlowDependencyInventory, nodeDefinitions: ExistingNodeDefinition[], sessionIdentityVerified: boolean): CloneSourceExport {
  return {
    source: { origin: new URL(origin).origin, projectId: project.id, flowId: flow.flowId, contentHash: flow.contentHash, updatedAt: flow.updatedAt },
    flowDocument: sanitizeCloneFlowDocument(flow.document),
    project: { id: project.id, name: project.name, ...(project.domainId !== undefined ? { domainId: project.domainId } : {}) },
    dependencyInventory,
    nodeDefinitions,
    sessionIdentityVerified,
  };
}

function safeId(value: string): string { return /^[A-Za-z0-9._:-]+$/u.test(value) ? value : "[invalid-id]"; }
