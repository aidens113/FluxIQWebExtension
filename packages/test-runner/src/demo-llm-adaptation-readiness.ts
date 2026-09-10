import type {
  ExistingFlow,
  ExistingFlowAdaptation,
  ExistingFlowAdaptationSummary,
  ExistingFlowRouter,
  ExistingFlowSubflow,
  ExistingNodeDefinition,
  ExistingRunDetail,
  ExistingRunSummary,
} from "./existing-fluxiq-control.js";
import { RunnerFailure } from "./failure.js";

export const demoLlmAdaptationReadinessFailureCodes = [
  "adaptation_readiness.scope_invalid",
  "adaptation_readiness.pending_adaptation",
  "adaptation_readiness.bootstrap_invalid",
  "adaptation_readiness.recordings_present",
  "adaptation_readiness.topology_invalid",
  "adaptation_readiness.registry_builtin_missing",
  "adaptation_readiness.registry_web_node_missing",
  "adaptation_readiness.registry_node_not_executable",
  "adaptation_readiness.registry_recording_node",
  "adaptation_readiness.registry_external_side_effect",
  "adaptation_readiness.registry_domain_mismatch",
  "adaptation_readiness.target_missing",
  "adaptation_readiness.baseline_missing",
  "adaptation_readiness.baseline_not_deterministic",
  "adaptation_readiness.control_unavailable",
  "adaptation_readiness.unknown",
] as const;
export type DemoLlmAdaptationReadinessFailureCode = typeof demoLlmAdaptationReadinessFailureCodes[number];

type AdaptationReadinessControl = Readonly<{
  requireProject(projectId: string, domainId?: string): Promise<unknown>;
  getExactFlow(projectId: string, flowId: string): Promise<ExistingFlow>;
  listFlowAdaptations(projectId: string, flowId: string, status?: string): Promise<ExistingFlowAdaptationSummary[]>;
  getFlowAdaptation(projectId: string, flowId: string, adaptationId: string): Promise<ExistingFlowAdaptation>;
  listFlowSubflows(projectId: string, flowId: string): Promise<ExistingFlowSubflow[]>;
  getFlowRouter(projectId: string, flowId: string): Promise<ExistingFlowRouter | null>;
  listNativeNodeDefinitions(projectId: string): Promise<ExistingNodeDefinition[]>;
  listFlowRuns(projectId: string, flowId: string): Promise<ExistingRunSummary[]>;
  getRunDetail(projectId: string, runId: string): Promise<ExistingRunDetail>;
}>;

export type DemoLlmAdaptationReadiness = Readonly<{
  status: "passed";
  providerCallCount: 0;
  projectId: string;
  flowId: string;
  graphFlowId: string;
  subflowId: string;
  routerId: string;
  bootstrapAdaptationId: string;
  currentExecutionDigest: string;
  baselineRunId: string;
  recordingCount: 0;
  nodeCount: number;
  edgeCount: number;
  actionAttemptCount: number;
  adaptableTargetCount: number;
  adaptableTargets: ReadonlyArray<Readonly<{
    nodeId: string;
    definitionId: string;
    parameterKeys: readonly string[];
  }>>;
}>;

/**
 * Provider-free, read-only readiness inspection for the first runtime
 * adaptation. All calls use public Automation Studio endpoints through the
 * supplied control client. Parameter values, page content, and run messages
 * are intentionally discarded.
 */
export async function inspectDemoLlmAdaptationReadiness(
  control: AdaptationReadinessControl,
  scope: Readonly<{ projectId: string; flowId: string }>,
  options: Readonly<{ allowPendingAdaptationId?: string }> = {},
): Promise<DemoLlmAdaptationReadiness> {
  await control.requireProject(scope.projectId, "web-automation");
  const parent = await control.getExactFlow(scope.projectId, scope.flowId);
  assertNoRecordingMetadata(parent.document, "parent Flow");

  const summaries = await control.listFlowAdaptations(scope.projectId, scope.flowId);
  if (summaries.some(item => item.status === "proposed" && item.adaptationId !== options.allowPendingAdaptationId)) fail("adaptation_readiness.pending_adaptation", "Adaptation readiness requires no unrelated pending Flow adaptation");
  const applied: ExistingFlowAdaptation[] = [];
  for (const summary of summaries.filter(item => item.status === "applied")) {
    const detail = await control.getFlowAdaptation(scope.projectId, scope.flowId, summary.adaptationId);
    if (detail.adaptationKind === "flow_bootstrap") applied.push(detail);
  }
  if (applied.length !== 1) fail("adaptation_readiness.bootstrap_invalid", "Adaptation readiness requires exactly one applied Flow Bootstrap adaptation");
  const bootstrap = applied[0]!;
  const binding = bootstrap.bootstrapBinding;
  if (!binding?.baseExecutionDigest || !binding.appliedExecutionDigest || !binding.currentExecutionDigest
    || binding.baseExecutionDigest === binding.appliedExecutionDigest
    || binding.baseSettingsRevision === undefined || binding.currentSettingsRevision === undefined
    || binding.currentSettingsRevision <= binding.baseSettingsRevision) {
    fail("adaptation_readiness.bootstrap_invalid", "Applied Flow Bootstrap is not bound to the current generated execution state");
  }

  const subflows = await control.listFlowSubflows(scope.projectId, scope.flowId);
  if (subflows.length !== 1 || !subflows[0]?.graphFlowId) fail("adaptation_readiness.topology_invalid", "Adaptation readiness requires one graph-backed owned Subflow");
  const subflow = subflows[0];
  const graphFlowId = nonEmpty(subflow.graphFlowId, "generated graph Flow identity");
  const router = await control.getFlowRouter(scope.projectId, scope.flowId);
  if (!router) fail("adaptation_readiness.topology_invalid", "Adaptation readiness requires the generated Flow Router");
  const ownedRouteCount = [router.fallback, ...router.rules.map(rule => rule.target)]
    .filter(target => target?.kind === "subflow" && target.subflowId === subflow.subflowId).length;
  if (ownedRouteCount !== 1) fail("adaptation_readiness.topology_invalid", "Adaptation readiness requires exactly one route to the generated Subflow");

  const graph = await control.getExactFlow(scope.projectId, graphFlowId);
  assertNoRecordingMetadata(graph.document, "generated graph Flow");
  const nodes = parseGraphNodes(graph.document.nodes);
  const edgeCount = Array.isArray(graph.document.edges) ? graph.document.edges.length : fail("adaptation_readiness.topology_invalid", "Generated graph edges are malformed");
  if (nodes.length < 1 || edgeCount < 1) fail("adaptation_readiness.topology_invalid", "Adaptation readiness requires a nonempty generated graph");
  const definitions = new Map((await control.listNativeNodeDefinitions(scope.projectId)).map(item => [item.id, item]));
  for (const node of nodes) {
    const definition = definitions.get(node.definitionId);
    if (!definition && (node.definitionId === "builtin.control.start" || node.definitionId === "builtin.control.end")) continue;
    if (!definition) fail(node.definitionId.startsWith("web.output.") ? "adaptation_readiness.registry_web_node_missing" : "adaptation_readiness.registry_builtin_missing", "Generated graph contains a node absent from the current runtime registry");
    if (!definition.executable) fail("adaptation_readiness.registry_node_not_executable", "Generated graph contains a non-executable node");
    if (definition.sourceKind === "recording") fail("adaptation_readiness.registry_recording_node", "Generated graph contains a recording-backed node");
    if (definition.externalSideEffect) fail("adaptation_readiness.registry_external_side_effect", "Generated graph contains an external-side-effect node");
    if (node.definitionId.startsWith("web.output.") && (definition.sourceKind !== "importer" || definition.sourceDomainId !== "web-automation")) {
      fail("adaptation_readiness.registry_domain_mismatch", "Generated web node escaped the web-automation domain registry");
    }
  }
  const adaptableTargets = nodes
    .filter(node => node.definitionId.startsWith("web.output.dom-") && node.parameterKeys.includes("selector"))
    .map(node => Object.freeze({ nodeId: node.nodeId, definitionId: node.definitionId, parameterKeys: Object.freeze([...node.parameterKeys]) }));
  if (adaptableTargets.length < 1) fail("adaptation_readiness.target_missing", "Generated graph has no selector-bound web action for the semantic-drift adaptation lane");

  let run: ExistingRunDetail | undefined;
  for (const candidate of (await control.listFlowRuns(scope.projectId, scope.flowId)).sort((left, right) => right.updatedAt - left.updatedAt)) {
    if (candidate.status !== "succeeded") continue;
    const detail = await control.getRunDetail(scope.projectId, candidate.runId);
    if (detail.summary.projectId === scope.projectId && detail.summary.flowId === scope.flowId
      && detail.actionAttempts.length > 0 && detail.actionAttempts.every(item => item.status === "succeeded")
      && (detail.providerCallCount ?? 0) === 0 && (detail.interventions?.length ?? 0) === 0
      && (detail.adaptationIds?.length ?? 0) === 0 && (detail.changeProposalIds?.length ?? 0) === 0
      && (detail.summary.adaptationCount ?? 0) === 0) {
      run = detail;
      break;
    }
  }
  if (!run) fail("adaptation_readiness.baseline_not_deterministic", "No successful zero-LLM deterministic baseline exists in the bounded Flow run history");

  return Object.freeze({
    status: "passed" as const,
    providerCallCount: 0 as const,
    projectId: scope.projectId,
    flowId: scope.flowId,
    graphFlowId,
    subflowId: subflow.subflowId,
    routerId: router.routerId,
    bootstrapAdaptationId: bootstrap.adaptationId,
    currentExecutionDigest: binding.currentExecutionDigest,
    baselineRunId: run.summary.runId,
    recordingCount: 0 as const,
    nodeCount: nodes.length,
    edgeCount,
    actionAttemptCount: run.actionAttempts.length,
    adaptableTargetCount: adaptableTargets.length,
    adaptableTargets: Object.freeze(adaptableTargets),
  });
}

function parseGraphNodes(value: unknown): Array<{ nodeId: string; definitionId: string; parameterKeys: string[] }> {
  if (!Array.isArray(value)) fail("adaptation_readiness.topology_invalid", "Generated graph nodes are malformed");
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) fail("adaptation_readiness.topology_invalid", `Generated graph node ${index} is malformed`);
    const node = item as Record<string, unknown>;
    const nodeId = nonEmpty(node.id, `generated graph node ${index} ID`);
    const definitionId = nonEmpty(node.definitionId, `generated graph node ${index} definition`);
    if (node.parameterValues !== undefined && (!node.parameterValues || typeof node.parameterValues !== "object" || Array.isArray(node.parameterValues))) fail("adaptation_readiness.topology_invalid", `Generated graph node ${index} parameters are malformed`);
    const parameterKeys = Object.keys((node.parameterValues as Record<string, unknown> | undefined) ?? {}).sort();
    return { nodeId, definitionId, parameterKeys };
  });
}

function assertNoRecordingMetadata(document: Record<string, unknown>, label: string): void {
  const metadata = document.metadata;
  if (metadata === undefined) return;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) fail("adaptation_readiness.topology_invalid", `${label} metadata is malformed`);
  const record = metadata as Record<string, unknown>;
  if (record.lastRecordingId !== undefined || record.recordingId !== undefined || record.recordingProvenance !== undefined) fail("adaptation_readiness.recordings_present", `${label} contains recording provenance`);
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) fail("adaptation_readiness.topology_invalid", `${label} is unavailable`);
  return value;
}

function fail(reasonCode: DemoLlmAdaptationReadinessFailureCode, message: string): never {
  throw new RunnerFailure("runtime.behavior", message, { details: { reasonCode } });
}

export function demoLlmAdaptationReadinessFailureCode(error: unknown): DemoLlmAdaptationReadinessFailureCode {
  if (error instanceof RunnerFailure && typeof error.details?.reasonCode === "string"
    && demoLlmAdaptationReadinessFailureCodes.includes(error.details.reasonCode as DemoLlmAdaptationReadinessFailureCode)) {
    return error.details.reasonCode as DemoLlmAdaptationReadinessFailureCode;
  }
  if (error instanceof RunnerFailure && error.category === "environment.missing") return "adaptation_readiness.control_unavailable";
  return "adaptation_readiness.unknown";
}
