import { createHash } from "node:crypto";
import { harnessPatchPermissionOutcomes, LLM_LAB_MAX_CALLS_PER_RUN, type HarnessPatchPermissionOutcome } from "@fluxiq-web-extension/test-contracts";
import { parseAutomationStudioActionPermissionRequest, type AutomationStudioActionPermissionRequest } from "fluxiq/automation-studio/action-permissions";
import { RunnerFailure } from "./failure.js";
import type { PersistedFlowLlmExecution } from "./flow-lane/index.js";
import { FluxIQControlClient, type FluxIQHttpOptions } from "./http-control/index.js";

type JsonRecord = Record<string, unknown>;
export type ExistingProject = { id: string; name: string; description: string; domainId?: string | null; createdAt: number; updatedAt: number };
export type ExistingFlowSummary = { flowId: string; name: string; description?: string; sourceMode: "visual" | "code"; nodeCount: number; edgeCount: number; updatedAt: number; version?: string };
export type ExistingFlow = { flowId: string; projectId: string; name: string; updatedAt: number; contentHash: string; document: JsonRecord };
export type ExistingRuntimeSession = { runId: string; projectId: string | null; flowId: string; targetKind: "task" | "routine" | "flow"; targetId: string; status: RuntimeStatus };
export type RuntimeStatus = "queued" | "running" | "waiting" | "succeeded" | "failed" | "cancelled";
export type ExistingRunSummary = { runId: string; projectId: string; flowId: string; status: RuntimeStatus; routeDecisionCount: number; subflowEntryCount: number; actionAttemptCount: number; interventionCount?: number; adaptationCount?: number; updatedAt: number; startedAt?: number; finishedAt?: number };
export type ExistingRouteDecision = { decisionId: string; routerId: string; selectedRuleId?: string; selectedSubflowId?: string; fallbackUsed?: boolean };
export type ExistingSubflowExecution = { entryId: string; subflowId: string; status: RuntimeStatus; graphFlowId?: string; routeDecisionId?: string };
export type ExistingRunIntervention = { interventionId: string; kind: "diagnosis" | "runtime_patch" | "router_patch" | "subflow_patch" | "expectation_patch" | "instruction_suggestion" | "change_proposal"; requestId?: string; promptVersion?: string; provider?: string; model?: string; validationOk?: boolean; validationCodes?: string[]; inputTokens?: number; outputTokens?: number; totalTokens?: number; estimatedCostUsd?: number; createdAt?: number };
/**
 * One runtime patch Core recorded. `permissionOutcome` is what the recovery's
 * permission gate said about a patch that would lastingly act, and
 * `permissionRequired` is `true` exactly when the patch was held back as the
 * request a person answers; both are absent when Core asked no gate.
 */
export type ExistingRuntimePatchAttempt = { kind?: string; proposalOnly?: boolean; executed?: boolean; preflightOk?: boolean; issueCodes: string[]; adaptationCreated: boolean; changeProposalCreated: boolean; permissionOutcome?: HarnessPatchPermissionOutcome; permissionRequired?: boolean };
/**
 * Why Core did or did not reach the provider on this run, read from the run
 * detail's `metadata.llmGate`. Counts and Core's own fixed sentence only: it is
 * what tells a live run that never called the provider apart from one that did,
 * so a run cannot report a green result on an unreached model.
 */
export type ExistingRunLlmGate = {
  invoked: boolean;
  reason?: string;
  code?: string;
  patchSkippedCode?: string;
  /** Why a patch the model wrote did not run although the patch call was made: `llm.runtime_patch_permission_required`. */
  patchHeldCode?: string;
  /** What the recovery's permission gate held, as Core's classes only: granted, instructed, and lapsed. */
  permissions?: { granted: string[]; instructed: string[]; lapsed: string[] };
};
/**
 * Core's own per-run provider accounting (`metadata.llmGate.costAccounting`).
 * Counts and totals only, and the numbers a budget is actually held to: an
 * intervention record can omit its token usage, this does not.
 */
export type ExistingRunLlmAccounting = { calls: number; inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number; budgetBreaches: number; pendingCalls: number };
/**
 * One provider call, as Core itemizes it on the run
 * (`metadata.llmGate.providerCalls`), in the order Core counted the calls.
 * Identifiers, codes and numbers only. `inputTokens` through
 * `estimatedCostUsd` are what the provider reported, `null` wherever it
 * reported nothing; `charged` is what Core put on the run's account, which is
 * the call's reservation wherever `charged.tokens` or `charged.cost` says
 * `reserved`. The `charged` figures add up to `ExistingRunLlmAccounting`.
 */
export type ExistingRunProviderCall = {
  sequence: number;
  requestId: string;
  taskKind: string | null;
  stage: string | null;
  allowance: "run" | "exploration";
  promptVersion: string | null;
  provider: string | null;
  model: string | null;
  validationOk: boolean | null;
  validationCodes: string[];
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  charged: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number; tokens: "reported" | "reserved"; cost: "reported" | "reserved" };
  budgetBreach: boolean;
};
/**
 * `providerCalls` is absent when Core itemized no calls -- a run that never
 * reached the model, or a Core older than per-call records -- and then nothing
 * here says what each call was. `providerCallsOmitted` is present exactly when
 * `providerCalls` is: the calls Core counted past its own record limit.
 */
/**
 * `permissionRequest` is the question the run carries out to a person
 * (`metadata.permissionRequest`), read through Core's own strict parser, so it
 * holds exactly what Core built: the action, the classes it lacked, and a
 * control name only where Core's gate found it in evidence the model was shown.
 */
export type ExistingRunDetail = { summary: ExistingRunSummary; routeDecisions: ExistingRouteDecision[]; subflows: ExistingSubflowExecution[]; actionAttempts: ExistingRunAction[]; interventions?: ExistingRunIntervention[]; runtimePatchAttempts?: ExistingRuntimePatchAttempt[]; adaptationIds?: string[]; changeProposalIds?: string[]; providerCallCount?: number; llmGate?: ExistingRunLlmGate; llmAccounting?: ExistingRunLlmAccounting; providerCalls?: ExistingRunProviderCall[]; providerCallsOmitted?: number; permissionRequest?: AutomationStudioActionPermissionRequest };
export type ExistingFlowSubflow = { subflowId: string; flowId: string; projectId: string; graphFlowId?: string; name: string; status: string; role: string };
export type ExistingFlowRouter = { routerId: string; flowId: string; projectId: string; fallback?: { kind: string; subflowId?: string }; rules: Array<{ ruleId: string; target?: { kind?: string; subflowId?: string } }> };
export type ExistingFlowAdaptationSummary = { adaptationId: string; flowId: string; projectId: string; status: string };
export type ExistingFlowAdaptation = ExistingFlowAdaptationSummary & {
  adaptationKind?: string;
  subflowId?: string;
  sourceRunId?: string;
  riskLevel?: "low" | "medium" | "high" | "destructive";
  patchKinds?: string[];
  validationSucceededCount?: number;
  validationFailedCount?: number;
  appliedMutationCount?: number;
  bootstrapBinding?: { baseExecutionDigest?: string; currentExecutionDigest?: string; appliedExecutionDigest?: string; baseSettingsRevision?: number; currentSettingsRevision?: number };
  accounting?: { provider?: string; model?: string; inputTokens?: number; outputTokens?: number; totalTokens?: number; estimatedCostUsd?: number };
  evidenceLoop?: {
    providerCallCount?: number;
    decisionCount?: number;
    traceStepCount?: number;
    iterationCount: number;
    toolCallCount: number;
    evidenceBytes: number;
    toolIds: string[];
    /**
     * Every decision of the build, in order, where Core published them. A
     * refused build carries them on its failure diagnostic; a proposed one
     * carries them here or not at all, and Core does not publish them on a
     * proposal yet -- see `fa-lab-measurement.md`. Read as optional so the
     * Lab records the trail the moment Core does, rather than having to be
     * changed again afterwards.
     */
    steps?: Array<{ toolId: string; effectApplied?: boolean; resultCode?: string }>;
  };
};
export type ExistingRunAction = { attemptId: string; nodeId: string; definitionId: string; order: number; status: RuntimeStatus | "unknown"; startedAt: number; finishedAt?: number; message?: string };
export type ExistingRunEvent = { sequence: number; eventId: string; eventKind: "run_summary" | "route_decision" | "subflow_execution" | "action_attempt" | "recovery_attempt" | "intervention"; timestampMs: number; title: string; status?: string; entityId?: string };
export type ExistingGatewayDiscovery = { enabled: boolean; sessionCount: number; pairingCount: number; trustedClientCount: number; publicUrl: string | null; listening: boolean; runtimeId?: string };
export type ExistingFlowDependency = { publicationId: string; projectId: string; flowId: string; version: string; status: "published" | "deprecated"; flowDigest: string; requiredRuntimeCapabilities: string[] };
export type ExistingFlowDependencyInventory = {
  dependencies: ExistingFlowDependency[];
  usedBy: Array<{ projectId: string; flowId: string; flowName: string; version: string; nodeId: string }>;
  availableUpgrades: Array<{ nodeId: string; flowId: string; currentVersion: string; versions: string[] }>;
};
export type ExistingNodeDefinition = {
  id: string;
  version: string;
  sourceKind: "builtin" | "importer" | "code" | "composite" | "recording" | "unknown";
  sourceDomainId?: string;
  executable: boolean;
  /** Sanitized policy fact; raw destinations and secret handles are discarded. */
  externalSideEffect: boolean;
};

/** Core's answer to a Flow bootstrap generation, kept whole on failure because Core's diagnostic travels in `payload`. */
export type FlowBootstrapGenerationEnvelope = { status: number; ok: boolean; payload: unknown };

export class ExistingFluxIQControlClient extends FluxIQControlClient {
  async automationStudioCall(endpoint: string, payload: JsonRecord = {}, bounds: FluxIQHttpOptions = {}, domainId?: string): Promise<unknown> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(endpoint)) throw new Error("Automation Studio endpoint is malformed");
    const suffix = domainId ? `?domainId=${encodeURIComponent(domainId)}` : "";
    const envelope = record(await this.request(`/api/programs/automation-studio/${endpoint}${suffix}`, payload, "environment.missing", "POST", bounds), `${endpoint} response`);
    if (envelope.ok !== true) throw new RunnerFailure("environment.missing", `Automation Studio call failed: ${endpoint}`);
    return envelope.payload;
  }

  /**
   * One Secret Keys program call. The Secret Keys program is session-bound, so
   * Core's route adds the caller's `authSessionId`; only the password and PIN
   * travel in the payload, and no secret value is ever returned by the calls
   * this client makes.
   */
  async secretKeysCall(endpoint: string, payload: JsonRecord = {}, bounds: FluxIQHttpOptions = {}): Promise<unknown> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(endpoint)) throw new Error("Secret Keys endpoint is malformed");
    const envelope = record(await this.request(`/api/programs/secret-keys/${endpoint}`, payload, "environment.missing", "POST", bounds), `${endpoint} response`);
    if (envelope.ok !== true) throw new RunnerFailure("environment.missing", `Secret Keys call failed: ${endpoint}`);
    return envelope.payload;
  }

  async validateCurrentSession(expectedUsername: string): Promise<{ identityEndpointAvailable: boolean; username?: string }> {
    const response = await this.authenticatedResponse("/api/auth/session", undefined, "GET");
    if (response.status === 404) {
      await this.listProjects();
      return { identityEndpointAvailable: false };
    }
    const envelope = record(await response.json().catch(() => undefined), "auth session response");
    if (!response.ok || envelope.ok !== true) throw new RunnerFailure("environment.missing", `FluxIQ session validation failed (${response.status})`);
    const payload = record(envelope.payload, "auth session payload");
    const user = record(payload.user, "auth session user");
    const username = text(user.username, "auth session username");
    if (username !== expectedUsername) throw new RunnerFailure("environment.missing", "Authenticated FluxIQ account does not match the configured username");
    return { identityEndpointAvailable: true, username };
  }

  async listProjects(domainId?: string): Promise<ExistingProject[]> {
    const payload = record(await this.automationStudioCall("projects", {}, {}, domainId), "projects payload");
    return array(payload.projects, "projects").map((value, index) => project(value, `projects[${index}]`));
  }

  async requireProject(projectId: string, domainId?: string): Promise<ExistingProject> {
    const matches = (await this.listProjects(domainId)).filter(item => item.id === projectId);
    if (matches.length !== 1) throw new RunnerFailure("environment.missing", `Expected exactly one accessible FluxIQ project with ID ${safeId(projectId)}, found ${matches.length}`);
    return matches[0]!;
  }

  async listFlowSummaries(projectId: string): Promise<ExistingFlowSummary[]> {
    const payload = record(await this.automationStudioCall("list-flow-summaries", { projectId }), "flow summaries payload");
    return array(payload.flows, "flow summaries").map((value, index) => flowSummary(value, `flows[${index}]`));
  }

  async getExactFlow(projectId: string, flowId: string): Promise<ExistingFlow> {
    const payload = record(await this.automationStudioCall("get-flow", { projectId, flowId }), "flow payload");
    const document = record(payload.flow, "flow");
    const actualFlowId = text(document.flowId, "flow.flowId");
    const actualProjectId = text(document.projectId, "flow.projectId");
    if (actualFlowId !== flowId || actualProjectId !== projectId) throw new RunnerFailure("environment.missing", "FluxIQ returned a Flow outside the requested project/Flow scope");
    array(document.nodes, "flow.nodes"); array(document.edges, "flow.edges");
    return { flowId: actualFlowId, projectId: actualProjectId, name: text(document.name, "flow.name"), updatedAt: finite(document.updatedAt, "flow.updatedAt"), contentHash: hashJson(document), document };
  }

  async getFlowGraphViewport(projectId: string, flowId: string): Promise<{
    graphRevision: number;
    nodes: Array<{ nodeId: string; x: number; y: number }>;
    edgeIds: string[];
    nodeCount: number;
    edgeCount: number;
  }> {
    const bounds = { minX: -9_000_000_000_000_000, minY: -9_000_000_000_000_000, maxX: 9_000_000_000_000_000, maxY: 9_000_000_000_000_000 };
    const payload = record(await this.automationStudioCall("get-graph-viewport", { projectId, flowId, bounds, limit: 500 }), "graph viewport payload");
    const page = record(payload.page, "graph viewport page");
    const nodes = array(page.nodes, "graph viewport nodes").map((value, index) => {
      const node = record(value, `graph viewport nodes[${index}]`);
      return { nodeId: text(node.nodeId, `graph viewport nodes[${index}].nodeId`), x: finite(node.x, `graph viewport nodes[${index}].x`), y: finite(node.y, `graph viewport nodes[${index}].y`) };
    });
    const edgeIds = array(page.edges, "graph viewport edges").map((value, index) => text(record(value, `graph viewport edges[${index}]`).edgeId, `graph viewport edges[${index}].edgeId`));
    return {
      graphRevision: finite(page.graphRevision, "graph viewport revision"),
      nodes,
      edgeIds,
      nodeCount: nodes.length,
      edgeCount: edgeIds.length,
    };
  }

  async listFlowSubflows(projectId: string, flowId: string): Promise<ExistingFlowSubflow[]> {
    const payload = record(await this.automationStudioCall("list-flow-subflows", { projectId, flowId, limit: 100, offset: 0 }), "subflows payload");
    const page = optionalRecord(payload.page, "subflows page");
    return array(payload.subflows ?? page?.subflows, "subflows").map((value, index) => flowSubflow(value, `subflows[${index}]`, projectId, flowId));
  }

  async getFlowRouter(projectId: string, flowId: string): Promise<ExistingFlowRouter | null> {
    const payload = record(await this.automationStudioCall("get-flow-router", { projectId, flowId }), "router payload");
    if (payload.router == null) return null;
    const router = record(payload.router, "router");
    if (text(router.projectId, "router.projectId") !== projectId || text(router.flowId, "router.flowId") !== flowId) {
      throw new RunnerFailure("environment.missing", "FluxIQ returned a Router outside the requested project/Flow scope");
    }
    const fallback = optionalRecord(router.fallback, "router.fallback");
    return {
      routerId: text(router.routerId, "router.routerId"), projectId, flowId,
      ...(fallback ? { fallback: { kind: text(fallback.kind, "router.fallback.kind"), ...(typeof fallback.subflowId === "string" ? { subflowId: fallback.subflowId } : {}) } } : {}),
      rules: array(router.rules, "router.rules").map((value, index) => {
        const rule = record(value, `router.rules[${index}]`);
        const target = optionalRecord(rule.target, `router.rules[${index}].target`);
        return { ruleId: text(rule.ruleId, `router.rules[${index}].ruleId`), ...(target ? { target: { ...(typeof target.kind === "string" ? { kind: target.kind } : {}), ...(typeof target.subflowId === "string" ? { subflowId: target.subflowId } : {}) } } : {}) };
      }),
    };
  }

  async listFlowAdaptations(projectId: string, flowId: string, status?: string): Promise<ExistingFlowAdaptationSummary[]> {
    const payload = record(await this.automationStudioCall("list-flow-adaptations", {
      projectId, flowId, ...(status ? { status } : {}), limit: 100, offset: 0,
    }), "flow adaptations payload");
    const adaptations = array(payload.adaptations, "flow adaptations").map((value, index) => flowAdaptationSummary(value, `adaptations[${index}]`, projectId, flowId));
    const page = record(payload.page, "flow adaptations page");
    if (integer(page.total, "flow adaptations page.total") !== adaptations.length) invalid("flow adaptations response was not a complete bounded page");
    return adaptations;
  }

  async getFlowAdaptation(projectId: string, flowId: string, adaptationId: string): Promise<ExistingFlowAdaptation> {
    const payload = record(await this.automationStudioCall("get-flow-adaptation", { projectId, flowId, adaptationId }), "flow adaptation payload");
    return flowAdaptation(payload.adaptation, "adaptation", projectId, flowId, adaptationId);
  }

  async rejectFlowAdaptation(input: { projectId: string; flowId: string; adaptationId: string; authorizationPin: string; reason: string }): Promise<ExistingFlowAdaptation> {
    const payload = record(await this.automationStudioCall("review-flow-adaptation", { ...input, action: "reject" }), "review adaptation payload");
    const adaptation = flowAdaptation(payload.adaptation, "adaptation", input.projectId, input.flowId, input.adaptationId);
    if (adaptation.status !== "rejected") throw new RunnerFailure("runtime.behavior", "FluxIQ did not reject the requested Flow adaptation");
    return adaptation;
  }

  async approveFlowAdaptation(input: { projectId: string; flowId: string; adaptationId: string; authorizationPin: string }): Promise<ExistingFlowAdaptation> {
    const payload = record(await this.automationStudioCall("review-flow-adaptation", { ...input, action: "approve" }), "approve adaptation payload");
    const adaptation = flowAdaptation(payload.adaptation, "adaptation", input.projectId, input.flowId, input.adaptationId);
    if (adaptation.status !== "validated") throw new RunnerFailure("runtime.behavior", "FluxIQ did not validate the approved Flow adaptation");
    return adaptation;
  }

  async applyFlowAdaptation(input: { projectId: string; flowId: string; adaptationId: string; authorizationPin: string }): Promise<ExistingFlowAdaptation> {
    const payload = record(await this.automationStudioCall("review-flow-adaptation", { ...input, action: "apply" }), "apply adaptation payload");
    const adaptation = flowAdaptation(payload.adaptation, "adaptation", input.projectId, input.flowId, input.adaptationId);
    if (adaptation.status !== "applied") throw new RunnerFailure("runtime.behavior", "FluxIQ did not apply the validated Flow adaptation");
    return adaptation;
  }

  /**
   * One Flow bootstrap generation, answered with Core's envelope whether or not
   * it succeeded. A refused generation carries Core's structured diagnostic in
   * `payload` -- the stage, whether a provider was attempted, the evidence
   * loop's counts -- which `automationStudioCall` would throw away with the
   * response. The payload is returned unread: the caller parses it with Core's
   * own parser and keeps only what that parser admits.
   */
  async generateFlowBootstrapAdaptation(input: { projectId: string; flowId: string; llmExecutionGrantId: string; evidenceGuided: true }, bounds: FluxIQHttpOptions = {}): Promise<FlowBootstrapGenerationEnvelope> {
    const response = await this.authenticatedResponse("/api/programs/automation-studio/generate-flow-bootstrap-adaptation", input, "POST", bounds, "runtime.behavior");
    const body: unknown = await response.json().catch(() => undefined);
    const envelope = body && typeof body === "object" && !Array.isArray(body) ? body as JsonRecord : {};
    return { status: response.status, ok: response.ok && envelope.ok === true, payload: envelope.payload };
  }

  async revertFlowAdaptation(input: { projectId: string; flowId: string; adaptationId: string; authorizationPin: string; reason: string }): Promise<ExistingFlowAdaptation> {
    const payload = record(await this.automationStudioCall("review-flow-adaptation", { ...input, action: "revert" }), "review adaptation payload");
    const adaptation = flowAdaptation(payload.adaptation, "adaptation", input.projectId, input.flowId, input.adaptationId);
    if (adaptation.status !== "reverted") throw new RunnerFailure("runtime.behavior", "FluxIQ did not revert the requested Flow adaptation");
    return adaptation;
  }

  async migrateLegacyFlowRepresentation(input: { projectId: string; flowId: string; subflowId: string; authorizationPin: string }): Promise<void> {
    await this.automationStudioCall("migrate-legacy-flow-representation", input);
  }

  async applyFlowGraphPatch(input: { projectId: string; flowId: string; baseRevision: number; mutationId: string; operations: unknown[]; authorizationPin: string }): Promise<void> {
    await this.automationStudioCall("apply-graph-patch", input);
  }

  async inspectFlowDependencies(projectId: string, flowId: string): Promise<ExistingFlowDependencyInventory> {
    const payload = record(await this.automationStudioCall("inspect-flow-dependencies", { projectId, flowId }), "flow dependency payload");
    return {
      dependencies: array(payload.dependencies, "flow dependencies").map((value, index) => flowDependency(value, `dependencies[${index}]`)),
      usedBy: array(payload.usedBy, "flow dependents").map((value, index) => flowDependent(value, `usedBy[${index}]`)),
      availableUpgrades: array(payload.availableUpgrades, "flow dependency upgrades").map((value, index) => flowUpgrade(value, `availableUpgrades[${index}]`)),
    };
  }

  async listNativeNodeDefinitions(projectId: string): Promise<ExistingNodeDefinition[]> {
    const payload = record(await this.automationStudioCall("list-native-node-definitions", { projectId }), "native node definitions payload");
    return array(payload.nodes, "native node definitions").map((value, index) => nodeDefinition(value, `nodes[${index}]`));
  }

  async gatewayDiscovery(): Promise<ExistingGatewayDiscovery> {
    const payload = record(await this.automationStudioCall("client-gateway-snapshot"), "gateway payload");
    const counts = record(payload.counts, "gateway.counts");
    const webRuntime = optionalRecord(payload.webRuntime, "gateway.webRuntime");
    return {
      enabled: boolean(payload.enabled, "gateway.enabled"),
      sessionCount: integer(counts.sessions, "gateway.counts.sessions"),
      pairingCount: integer(counts.pairings, "gateway.counts.pairings"),
      trustedClientCount: integer(counts.trustedClients, "gateway.counts.trustedClients"),
      publicUrl: nullableUrl(webRuntime?.clientGatewayPublicUrl, "gateway public URL"),
      listening: webRuntime ? boolean(webRuntime.clientGatewayListening, "gateway listening") : false,
      ...(webRuntime && typeof webRuntime.runtimeId === "string" && webRuntime.runtimeId ? { runtimeId: webRuntime.runtimeId } : {}),
    };
  }

  async selectExistingContext(projectId: string, clientId?: string, bounds: FluxIQHttpOptions = {}, flowId?: string): Promise<void> { await this.selectProject(projectId, clientId, bounds, flowId); }

  async startPersistedFlow(input: { projectId: string; flowId: string; inputs?: JsonRecord; authorizedDomainIds?: string[] } & FluxIQHttpOptions): Promise<ExistingRuntimeSession> {
    const payload = record(await this.automationStudioCall("start-runtime-session", { projectId: input.projectId, flowId: input.flowId, targetKind: "flow", targetId: input.flowId, ...(input.inputs ? { inputs: input.inputs } : {}), ...(input.authorizedDomainIds ? { authorizedDomainIds: input.authorizedDomainIds } : {}) }, input), "start runtime payload");
    return runtimeSession(payload.runtimeSession, "runtimeSession", input.projectId, input.flowId);
  }

  /**
   * `llmExecution` turns this into an explicit live-provider run. Core refuses
   * such a run a pre-started run id, an authorized domain, an idempotency key or
   * any adaptive mode but `manual_approval`, and revokes the grant when it sees
   * one, so those fields are omitted here rather than left to a caller.
   */
  async runPersistedFlow(input: { projectId: string; flowId: string; runId?: string; inputs?: JsonRecord; maxSteps?: number; authorizedDomainIds?: string[]; idempotencyKey?: string; llmExecution?: PersistedFlowLlmExecution } & FluxIQHttpOptions): Promise<{ session: ExistingRuntimeSession; summary?: ExistingRunSummary }> {
    if (input.llmExecution && (input.runId || input.idempotencyKey || input.authorizedDomainIds?.length)) {
      throw new RunnerFailure("runtime.behavior", "A live LLM run cannot carry a pre-started run id, an idempotency key, or an authorized domain");
    }
    const payload = record(await this.automationStudioCall("run-runtime-session", {
      projectId: input.projectId, flowId: input.flowId, ...(input.runId ? { runId: input.runId } : {}), ...(input.inputs ? { inputs: input.inputs } : {}),
      ...(input.maxSteps === undefined ? {} : { maxSteps: positiveInteger(input.maxSteps, "maxSteps") }), ...(input.authorizedDomainIds ? { authorizedDomainIds: input.authorizedDomainIds } : {}),
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
      adaptiveMode: input.llmExecution ? "manual_approval" : "deterministic", authorizedExternalSideEffects: false,
      ...(input.llmExecution ? { runIntent: input.llmExecution.purpose, llmExecutionGrantId: input.llmExecution.grantId } : {}),
    }, input), "run runtime payload");
    const session = runtimeSession(payload.runtimeSession, "runtimeSession", input.projectId, input.flowId);
    const summary = payload.runSummary == null ? undefined : runSummary(payload.runSummary, "runSummary");
    if (summary && (summary.runId !== session.runId || summary.projectId !== input.projectId || summary.flowId !== input.flowId)) throw new RunnerFailure("runtime.behavior", "FluxIQ run summary did not match the requested persisted Flow");
    return { session, ...(summary ? { summary } : {}) };
  }

  async cancelRun(projectId: string, runId: string, reason = "Cancelled by test facility", bounds: FluxIQHttpOptions = {}): Promise<ExistingRuntimeSession | null> {
    const payload = record(await this.automationStudioCall("cancel-runtime-session", { projectId, runId, reason }, bounds), "cancel runtime payload");
    const value = payload.runtimeSession ?? payload.session;
    return value == null ? null : runtimeSession(value, "cancelled runtimeSession", projectId);
  }

  async getRunDetail(projectId: string, runId: string, bounds: FluxIQHttpOptions = {}): Promise<ExistingRunDetail> {
    const payload = record(await this.automationStudioCall("get-flow-run-detail", { projectId, runId }, bounds), "run detail payload");
    const detail = record(payload.runDetail, "runDetail");
    const summary = runSummary(detail.summary, "runDetail.summary");
    if (summary.projectId !== projectId || summary.runId !== runId) throw new RunnerFailure("runtime.behavior", "FluxIQ run detail did not match the requested run");
    const actions = detail.actionAttempts === undefined ? [] : array(detail.actionAttempts, "runDetail.actionAttempts").map((value, index) => runAction(value, `actionAttempts[${index}]`));
    const routeDecisions = array(detail.routeDecisions ?? [], "runDetail.routeDecisions").map((value, index) => routeDecision(value, `routeDecisions[${index}]`));
    const subflows = array(detail.subflows ?? [], "runDetail.subflows").map((value, index) => subflowExecution(value, `subflows[${index}]`));
    const interventions = array(detail.interventions ?? [], "runDetail.interventions").map((value, index) => runIntervention(value, `interventions[${index}]`));
    const adaptationIds = stringArray(detail.adaptationIds ?? [], "runDetail.adaptationIds");
    const changeProposalIds = stringArray(detail.changeProposalIds ?? [], "runDetail.changeProposalIds");
    const metadata = optionalRecord(detail.metadata, "runDetail.metadata");
    const llmGate = optionalRecord(metadata?.llmGate, "runDetail.metadata.llmGate");
    const costAccounting = optionalRecord(llmGate?.costAccounting, "runDetail.metadata.llmGate.costAccounting");
    const providerCallCount = costAccounting?.calls === undefined ? undefined : integer(costAccounting.calls, "runDetail.metadata.llmGate.costAccounting.calls");
    const gate = llmGate === undefined ? undefined : runLlmGate(llmGate);
    const accounting = costAccounting === undefined ? undefined : runLlmAccounting(costAccounting);
    const callRecords = llmGate === undefined ? undefined : runProviderCalls(llmGate);
    const runtimePatchAttempts = array(metadata?.runtimePatchAttempts ?? [], "runDetail.metadata.runtimePatchAttempts").map((value, index) => runtimePatchAttempt(value, `runDetail.metadata.runtimePatchAttempts[${index}]`));
    const permissionRequest = runPermissionRequest(metadata?.permissionRequest);
    return { summary, routeDecisions, subflows, actionAttempts: actions, interventions, runtimePatchAttempts, adaptationIds, changeProposalIds, ...(permissionRequest ? { permissionRequest } : {}), ...(providerCallCount === undefined ? {} : { providerCallCount }), ...(gate === undefined ? {} : { llmGate: gate }), ...(accounting === undefined ? {} : { llmAccounting: accounting }), ...(callRecords === undefined ? {} : { providerCalls: callRecords.calls, providerCallsOmitted: callRecords.omitted }) };
  }

  async listFlowRuns(projectId: string, flowId: string): Promise<ExistingRunSummary[]> {
    const payload = record(await this.automationStudioCall("list-flow-runs", { projectId, flowId, limit: 25, offset: 0 }), "flow runs payload");
    const page = optionalRecord(payload.page, "flow runs page");
    return array(payload.runs ?? page?.runs, "flow runs").map((value, index) => runSummary(value, `flow runs[${index}]`));
  }

  async listRunActions(projectId: string, runId: string, options: { limit?: number; cursor?: string } & FluxIQHttpOptions = {}): Promise<ExistingRunAction[]> {
    const { signal, timeoutMs, ...query } = options;
    const payload = record(await this.automationStudioCall("list-flow-run-actions", { projectId, runId, ...query }, { ...(signal ? { signal } : {}), ...(timeoutMs === undefined ? {} : { timeoutMs }) }), "run actions payload");
    return array(payload.actions, "run actions").map((value, index) => runAction(value, `actions[${index}]`));
  }

  async listRunEvents(projectId: string, runId: string, options: { afterSequence?: number; limit?: number; cursor?: string } & FluxIQHttpOptions = {}): Promise<ExistingRunEvent[]> {
    const { signal, timeoutMs, ...query } = options;
    const payload = record(await this.automationStudioCall("list-flow-run-events", { projectId, runId, ...query }, { ...(signal ? { signal } : {}), ...(timeoutMs === undefined ? {} : { timeoutMs }) }), "run events payload");
    return array(payload.events, "run events").map((value, index) => runEvent(value, `events[${index}]`));
  }
}

function project(value: unknown, at: string): ExistingProject { const item = record(value, at); const domain = item.domainId; if (domain !== undefined && domain !== null && typeof domain !== "string") invalid(`${at}.domainId`); return { id: text(item.id, `${at}.id`), name: text(item.name, `${at}.name`), description: typeof item.description === "string" ? item.description : "", ...(domain === undefined ? {} : { domainId: domain as string | null }), createdAt: finite(item.createdAt, `${at}.createdAt`), updatedAt: finite(item.updatedAt, `${at}.updatedAt`) }; }
function flowSummary(value: unknown, at: string): ExistingFlowSummary { const item = record(value, at); const sourceMode = enumeration(item.sourceMode, ["visual", "code"] as const, `${at}.sourceMode`); return { flowId: text(item.flowId, `${at}.flowId`), name: text(item.name, `${at}.name`), ...(typeof item.description === "string" ? { description: item.description } : {}), sourceMode, nodeCount: integer(item.nodeCount, `${at}.nodeCount`), edgeCount: integer(item.edgeCount, `${at}.edgeCount`), updatedAt: finite(item.updatedAt, `${at}.updatedAt`), ...(typeof item.version === "string" ? { version: item.version } : {}) }; }
function flowSubflow(value: unknown, at: string, projectId: string, flowId: string): ExistingFlowSubflow { const item = record(value, at); if (text(item.projectId, `${at}.projectId`) !== projectId || text(item.flowId, `${at}.flowId`) !== flowId) invalid(`${at} escaped the requested parent Flow`); return { projectId, flowId, subflowId: text(item.subflowId, `${at}.subflowId`), ...(typeof item.graphFlowId === "string" && item.graphFlowId ? { graphFlowId: item.graphFlowId } : {}), name: text(item.name, `${at}.name`), status: text(item.status, `${at}.status`), role: text(item.role, `${at}.role`) }; }
function flowAdaptationSummary(value: unknown, at: string, projectId: string, flowId: string): ExistingFlowAdaptationSummary { const item = record(value, at); const parsed = { adaptationId: text(item.adaptationId, `${at}.adaptationId`), projectId: text(item.projectId, `${at}.projectId`), flowId: text(item.flowId, `${at}.flowId`), status: text(item.status, `${at}.status`) }; if (parsed.projectId !== projectId || parsed.flowId !== flowId) invalid(`${at} escaped the requested parent Flow`); return parsed; }
/** Core's own ceiling on a published trace: one entry per evidence-loop iteration, plus the deterministic iteration 0. */
const MAX_EVIDENCE_LOOP_STEPS = 65;

/**
 * A build's published decisions, in order. Only the tool id, whether its
 * effect was applied, and the code it came to are kept -- the same three
 * fields a refused build's diagnostic carries, so a proposed build and a
 * refused one read alike. Nothing the tool returned and nothing the model
 * wrote is admitted.
 */
function evidenceLoopSteps(value: unknown, at: string): Array<{ toolId: string; effectApplied?: boolean; resultCode?: string }> {
  return array(value, at).map((entry, index) => {
    const step = record(entry, `${at}[${index}]`);
    return {
      toolId: text(step.toolId, `${at}[${index}].toolId`),
      ...(step.effectApplied === undefined ? {} : { effectApplied: Boolean(step.effectApplied) }),
      ...(step.resultCode === undefined ? {} : { resultCode: text(step.resultCode, `${at}[${index}].resultCode`) }),
    };
  });
}

function flowAdaptation(value: unknown, at: string, projectId: string, flowId: string, adaptationId: string): ExistingFlowAdaptation {
  const item = record(value, at);
  const summary = flowAdaptationSummary(item, at, projectId, flowId);
  if (summary.adaptationId !== adaptationId) invalid(`${at} escaped the requested adaptation`);
  const metadata = optionalRecord(item.metadata, `${at}.metadata`);
  const adaptationKind = typeof metadata?.adaptationKind === "string" ? metadata.adaptationKind : undefined;
  const bootstrap = optionalRecord(metadata?.bootstrap, `${at}.metadata.bootstrap`);
  const application = optionalRecord(bootstrap?.application, `${at}.metadata.bootstrap.application`);
  const bootstrapBinding = bootstrap ? {
    ...(typeof bootstrap.baseExecutionDigest === "string" ? { baseExecutionDigest: bootstrap.baseExecutionDigest } : {}),
    ...(typeof bootstrap.currentExecutionDigest === "string" ? { currentExecutionDigest: bootstrap.currentExecutionDigest } : {}),
    ...(typeof application?.appliedExecutionDigest === "string" ? { appliedExecutionDigest: application.appliedExecutionDigest } : {}),
    ...(bootstrap.baseSettingsRevision === undefined ? {} : { baseSettingsRevision: integer(bootstrap.baseSettingsRevision, `${at}.metadata.bootstrap.baseSettingsRevision`) }),
    ...(bootstrap.currentSettingsRevision === undefined ? {} : { currentSettingsRevision: integer(bootstrap.currentSettingsRevision, `${at}.metadata.bootstrap.currentSettingsRevision`) }),
  } : undefined;
  const rawAccounting = optionalRecord(bootstrap?.accounting, `${at}.metadata.bootstrap.accounting`);
  const accounting = rawAccounting ? {
    ...(typeof rawAccounting.provider === "string" ? { provider: rawAccounting.provider } : {}),
    ...(typeof rawAccounting.model === "string" ? { model: rawAccounting.model } : {}),
    ...(rawAccounting.inputTokens === undefined ? {} : { inputTokens: integer(rawAccounting.inputTokens, `${at}.metadata.bootstrap.accounting.inputTokens`) }),
    ...(rawAccounting.outputTokens === undefined ? {} : { outputTokens: integer(rawAccounting.outputTokens, `${at}.metadata.bootstrap.accounting.outputTokens`) }),
    ...(rawAccounting.totalTokens === undefined ? {} : { totalTokens: integer(rawAccounting.totalTokens, `${at}.metadata.bootstrap.accounting.totalTokens`) }),
    ...(rawAccounting.estimatedCostUsd === undefined ? {} : { estimatedCostUsd: finite(rawAccounting.estimatedCostUsd, `${at}.metadata.bootstrap.accounting.estimatedCostUsd`) }),
  } : undefined;
  const phase9 = optionalRecord(metadata?.phase9, `${at}.metadata.phase9`);
  const auditEvents = phase9?.auditEvents === undefined ? [] : array(phase9.auditEvents, `${at}.metadata.phase9.auditEvents`);
  const createdAudit = auditEvents.map((value, index) => record(value, `${at}.metadata.phase9.auditEvents[${index}]`)).find((event) => event.eventType === "created");
  const auditDetail = optionalRecord(createdAudit?.detail, `${at}.metadata.phase9.created.detail`);
  const evidenceLoop = auditDetail?.evidenceGuided === true ? {
    ...(auditDetail.providerCallCount === undefined ? {} : { providerCallCount: integer(auditDetail.providerCallCount, `${at}.metadata.phase9.created.detail.providerCallCount`) }),
    ...(auditDetail.decisionCount === undefined ? {} : { decisionCount: integer(auditDetail.decisionCount, `${at}.metadata.phase9.created.detail.decisionCount`) }),
    ...(auditDetail.traceStepCount === undefined ? {} : { traceStepCount: integer(auditDetail.traceStepCount, `${at}.metadata.phase9.created.detail.traceStepCount`) }),
    iterationCount: integer(auditDetail.iterationCount, `${at}.metadata.phase9.created.detail.iterationCount`),
    toolCallCount: integer(auditDetail.toolCallCount, `${at}.metadata.phase9.created.detail.toolCallCount`),
    evidenceBytes: integer(auditDetail.evidenceBytes, `${at}.metadata.phase9.created.detail.evidenceBytes`),
    toolIds: stringArray(auditDetail.toolIds, `${at}.metadata.phase9.created.detail.toolIds`),
    ...(auditDetail.steps === undefined ? {} : { steps: evidenceLoopSteps(auditDetail.steps, `${at}.metadata.phase9.created.detail.steps`) }),
  } : undefined;
  if (evidenceLoop && (
    (evidenceLoop.providerCallCount === undefined) !== (evidenceLoop.decisionCount === undefined)
    // Evidence-guided creation iterates for as many calls as it needs, so the
    // only call ceiling a record can be held to is Core's runaway backstop.
    || (evidenceLoop.providerCallCount !== undefined && (evidenceLoop.providerCallCount < 1 || evidenceLoop.providerCallCount > LLM_LAB_MAX_CALLS_PER_RUN))
    || (evidenceLoop.providerCallCount !== undefined && evidenceLoop.decisionCount !== evidenceLoop.providerCallCount)
    || (evidenceLoop.traceStepCount !== undefined && evidenceLoop.traceStepCount !== evidenceLoop.iterationCount)
    || (evidenceLoop.providerCallCount !== undefined && (evidenceLoop.iterationCount < evidenceLoop.providerCallCount || evidenceLoop.iterationCount > evidenceLoop.providerCallCount + 1))
    // Core's own ceiling, not a number of our own. A build now explores by
    // running the node library's nodes, so it makes one tool call per step it
    // tries rather than a handful before writing a script: 16 was measured
    // cutting off a live build that had already produced a Flow. The only
    // ceiling a record can honestly be held to is the one Core enforces on
    // its own loop, and `toolCallCount > iterationCount` already refuses a
    // record that claims more calls than decisions.
    || evidenceLoop.toolCallCount > MAX_EVIDENCE_LOOP_STEPS || evidenceLoop.toolCallCount > evidenceLoop.iterationCount
    || evidenceLoop.evidenceBytes > 7_340_032 || evidenceLoop.toolIds.length > MAX_EVIDENCE_LOOP_STEPS
    || (evidenceLoop.steps !== undefined && evidenceLoop.steps.length > MAX_EVIDENCE_LOOP_STEPS)
  )) invalid(`${at}.metadata.phase9 created evidence audit exceeded its bounded contract`);
  const patchKinds = item.patch === undefined ? undefined : array(item.patch, `${at}.patch`).map((value, index) => text(record(value, `${at}.patch[${index}]`).kind, `${at}.patch[${index}].kind`));
  const validationStatuses = item.validationResults === undefined ? [] : array(item.validationResults, `${at}.validationResults`).map((value, index) => enumeration(record(value, `${at}.validationResults[${index}]`).status, ["succeeded", "failed"] as const, `${at}.validationResults[${index}].status`));
  const appliedMutationCount = item.appliedTo === undefined ? undefined : array(item.appliedTo, `${at}.appliedTo`).length;
  return {
    ...summary,
    ...(adaptationKind ? { adaptationKind } : {}),
    ...(typeof item.subflowId === "string" ? { subflowId: item.subflowId } : {}),
    ...(typeof item.sourceRunId === "string" ? { sourceRunId: item.sourceRunId } : {}),
    ...(item.riskLevel === undefined ? {} : { riskLevel: enumeration(item.riskLevel, ["low", "medium", "high", "destructive"] as const, `${at}.riskLevel`) }),
    ...(patchKinds ? { patchKinds } : {}),
    ...(item.validationResults === undefined ? {} : {
      validationSucceededCount: validationStatuses.filter(status => status === "succeeded").length,
      validationFailedCount: validationStatuses.filter(status => status === "failed").length,
    }),
    ...(appliedMutationCount === undefined ? {} : { appliedMutationCount }),
    ...(bootstrapBinding && Object.keys(bootstrapBinding).length ? { bootstrapBinding } : {}),
    ...(accounting ? { accounting } : {}),
    ...(evidenceLoop ? { evidenceLoop } : {}),
  };
}
function flowDependency(value: unknown, at: string): ExistingFlowDependency { const item = record(value, at); const snapshot = record(item.snapshot, `${at}.snapshot`); return { publicationId: text(item.publicationId, `${at}.publicationId`), projectId: text(item.projectId, `${at}.projectId`), flowId: text(item.flowId, `${at}.flowId`), version: text(item.version, `${at}.version`), status: enumeration(item.status, ["published", "deprecated"] as const, `${at}.status`), flowDigest: text(snapshot.flowDigest, `${at}.snapshot.flowDigest`), requiredRuntimeCapabilities: stringArray(snapshot.requiredRuntimeCapabilities ?? [], `${at}.snapshot.requiredRuntimeCapabilities`) }; }
function flowDependent(value: unknown, at: string): ExistingFlowDependencyInventory["usedBy"][number] { const item = record(value, at); return { projectId: text(item.projectId, `${at}.projectId`), flowId: text(item.flowId, `${at}.flowId`), flowName: text(item.flowName, `${at}.flowName`), version: text(item.version, `${at}.version`), nodeId: text(item.nodeId, `${at}.nodeId`) }; }
function flowUpgrade(value: unknown, at: string): ExistingFlowDependencyInventory["availableUpgrades"][number] { const item = record(value, at); return { nodeId: text(item.nodeId, `${at}.nodeId`), flowId: text(item.flowId, `${at}.flowId`), currentVersion: text(item.currentVersion, `${at}.currentVersion`), versions: stringArray(item.versions, `${at}.versions`) }; }
function nodeDefinition(value: unknown, at: string): ExistingNodeDefinition {
  const item = record(value, at);
  const source = optionalRecord(item.source, `${at}.source`);
  const capabilities = record(item.capabilities, `${at}.capabilities`);
  const rawKind = source?.kind;
  const sourceKind = typeof rawKind === "string" && ["builtin", "importer", "code", "composite", "recording"].includes(rawKind)
    ? rawKind as ExistingNodeDefinition["sourceKind"] : "unknown";
  const sourceDomainId = sourceKind === "importer" ? text(source?.domainId, `${at}.source.domainId`) : undefined;
  const safety = optionalRecord(item.safety, `${at}.safety`);
  const runtime = optionalRecord(safety?.runtime, `${at}.safety.runtime`);
  const externalSideEffect = sourceKind === "code" || Boolean(runtime && (
    nonEmptyStringArray(runtime.networkDestinations, `${at}.safety.runtime.networkDestinations`) ||
    nonEmptyStringArray(runtime.secretHandles, `${at}.safety.runtime.secretHandles`) ||
    nonEmptyStringArray(runtime.filesystemRoots, `${at}.safety.runtime.filesystemRoots`) ||
    runtime.process === true || runtime.childProcess === true
  ));
  return {
    id: text(item.id, `${at}.id`), version: text(item.version, `${at}.version`), sourceKind,
    ...(sourceDomainId ? { sourceDomainId } : {}),
    executable: boolean(capabilities.executable, `${at}.capabilities.executable`), externalSideEffect,
  };
}
function nonEmptyStringArray(value: unknown, at: string): boolean { if (value === undefined) return false; return stringArray(value, at).length > 0; }
function runtimeSession(value: unknown, at: string, projectId: string, flowId?: string): ExistingRuntimeSession { const item = record(value, at); const parsed = { runId: text(item.runId, `${at}.runId`), projectId: nullableText(item.projectId, `${at}.projectId`), flowId: text(item.flowId, `${at}.flowId`), targetKind: enumeration(item.targetKind, ["task", "routine", "flow"] as const, `${at}.targetKind`), targetId: text(item.targetId, `${at}.targetId`), status: status(item.status, `${at}.status`) }; if (parsed.projectId !== projectId || (flowId && (parsed.flowId !== flowId || parsed.targetKind !== "flow" || parsed.targetId !== flowId))) throw new RunnerFailure("runtime.behavior", "FluxIQ runtime session did not match the requested persisted Flow"); return parsed; }
function runSummary(value: unknown, at: string): ExistingRunSummary { const item = record(value, at); return { runId: text(item.runId, `${at}.runId`), projectId: text(item.projectId, `${at}.projectId`), flowId: text(item.flowId, `${at}.flowId`), status: status(item.status, `${at}.status`), routeDecisionCount: integer(item.routeDecisionCount, `${at}.routeDecisionCount`), subflowEntryCount: integer(item.subflowEntryCount, `${at}.subflowEntryCount`), actionAttemptCount: integer(item.actionAttemptCount, `${at}.actionAttemptCount`), interventionCount: integer(item.interventionCount ?? 0, `${at}.interventionCount`), adaptationCount: integer(item.adaptationCount ?? 0, `${at}.adaptationCount`), updatedAt: finite(item.updatedAt, `${at}.updatedAt`), ...(item.startedAt === undefined ? {} : { startedAt: finite(item.startedAt, `${at}.startedAt`) }), ...(item.finishedAt === undefined ? {} : { finishedAt: finite(item.finishedAt, `${at}.finishedAt`) }) }; }
function runIntervention(value: unknown, at: string): ExistingRunIntervention {
  const item = record(value, at); const validation = optionalRecord(item.validation, `${at}.validation`); const usage = optionalRecord(item.tokenUsage, `${at}.tokenUsage`);
  const validationCodes = validation?.issues === undefined ? [] : array(validation.issues, `${at}.validation.issues`).flatMap((issue, index) => {
    if (typeof issue !== "string") invalid(`${at}.validation.issues[${index}] must be a string`);
    const match = /^([a-z][a-z0-9_.-]{1,127})(?::|$)/u.exec(issue);
    return match ? [match[1]!] : [];
  });
  const optionalUsage = (key: "inputTokens" | "outputTokens" | "totalTokens" | "estimatedCostUsd") => {
    if (usage?.[key] === undefined) return {};
    const value = finite(usage[key], `${at}.tokenUsage.${key}`);
    if (value < 0) invalid(`${at}.tokenUsage.${key} must be non-negative`);
    return { [key]: value };
  };
  // `+` is allowed because a staged prompt version reads
  // `automation-studio.runtime-diagnosis.v1+stage.gather`. Without it this
  // parser THREW on any run detail carrying a staged intervention - a break no
  // unit test saw, because only a live run produces one.
  const optionalIdentifier = (value: unknown, field: string) => {
    if (value === undefined) return undefined;
    const parsed = text(value, `${at}.${field}`);
    if (parsed.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9._:+-]*$/u.test(parsed)) invalid(`${at}.${field} is invalid`);
    return parsed;
  };
  const metadata = optionalRecord(item.metadata, `${at}.metadata`);
  const requestId = optionalIdentifier(metadata?.requestId, "metadata.requestId");
  const promptVersion = optionalIdentifier(item.promptVersion, "promptVersion");
  const provider = optionalIdentifier(item.provider, "provider");
  const model = optionalIdentifier(item.model, "model");
  return { interventionId: text(item.interventionId, `${at}.interventionId`), kind: enumeration(item.kind, ["diagnosis", "runtime_patch", "router_patch", "subflow_patch", "expectation_patch", "instruction_suggestion", "change_proposal"] as const, `${at}.kind`), ...(requestId ? { requestId } : {}), ...(promptVersion ? { promptVersion } : {}), ...(provider ? { provider } : {}), ...(model ? { model } : {}), ...(typeof validation?.ok === "boolean" ? { validationOk: validation.ok } : {}), ...(validationCodes.length ? { validationCodes } : {}), ...optionalUsage("inputTokens"), ...optionalUsage("outputTokens"), ...optionalUsage("totalTokens"), ...optionalUsage("estimatedCostUsd"), ...(item.createdAt === undefined ? {} : { createdAt: finite(item.createdAt, `${at}.createdAt`) }) };
}
/** Core's own per-run accounting, read as the non-negative numbers it is. */
function runLlmAccounting(value: JsonRecord): ExistingRunLlmAccounting {
  const at = "runDetail.metadata.llmGate.costAccounting";
  const cost = finite(value.estimatedCostUsd ?? 0, `${at}.estimatedCostUsd`);
  if (cost < 0) invalid(`${at}.estimatedCostUsd must be non-negative`);
  return {
    calls: integer(value.calls ?? 0, `${at}.calls`),
    inputTokens: integer(value.inputTokens ?? 0, `${at}.inputTokens`),
    outputTokens: integer(value.outputTokens ?? 0, `${at}.outputTokens`),
    totalTokens: integer(value.totalTokens ?? 0, `${at}.totalTokens`),
    estimatedCostUsd: cost,
    budgetBreaches: integer(value.budgetBreaches ?? 0, `${at}.budgetBreaches`),
    pendingCalls: integer(value.pendingCalls ?? 0, `${at}.pendingCalls`),
  };
}

/**
 * The most per-call lines one run detail may carry: Core's own record limit
 * (`AUTOMATION_STUDIO_LLM_RUN_CALL_RECORD_LIMIT`, equal to its call backstop).
 */
const MAX_RUN_PROVIDER_CALLS = 250;

/**
 * Core's per-call lines, or `undefined` when it published none. A line that
 * is out of order, out of bounds, or carries anything but identifiers, codes
 * and numbers makes the whole response malformed rather than being skipped: a
 * skipped call is exactly the silent gap these lines exist to close.
 */
function runProviderCalls(gate: JsonRecord): { calls: ExistingRunProviderCall[]; omitted: number } | undefined {
  const at = "runDetail.metadata.llmGate.providerCalls";
  if (gate.providerCalls === undefined && gate.providerCallsOmitted === undefined) return undefined;
  const lines = array(gate.providerCalls, at);
  if (lines.length > MAX_RUN_PROVIDER_CALLS) invalid(`${at} exceeds ${MAX_RUN_PROVIDER_CALLS} entries`);
  const omitted = integer(gate.providerCallsOmitted, "runDetail.metadata.llmGate.providerCallsOmitted");
  const identifier = (value: unknown, field: string): string | null => {
    if (value === null) return null;
    const parsed = text(value, field);
    if (parsed.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9._:+-]*$/u.test(parsed)) invalid(`${field} is invalid`);
    return parsed;
  };
  const nullableCount = (value: unknown, field: string): number | null => value === null ? null : integer(value, field);
  const nonNegative = (value: unknown, field: string): number => {
    const parsed = finite(value, field);
    if (parsed < 0) invalid(`${field} must be non-negative`);
    return parsed;
  };
  const basis = (value: unknown, field: string) => enumeration(value, ["reported", "reserved"] as const, field);
  const calls = lines.map((value, index): ExistingRunProviderCall => {
    const path = `${at}[${index}]`;
    const line = record(value, path);
    if (integer(line.sequence, `${path}.sequence`) !== index + 1) invalid(`${path}.sequence is out of order`);
    const requestId = identifier(line.requestId, `${path}.requestId`);
    if (requestId === null) invalid(`${path}.requestId is required`);
    const validation = line.validation === null ? null : record(line.validation, `${path}.validation`);
    const codes = validation === null ? [] : stringArray(validation.issueCodes, `${path}.validation.issueCodes`);
    if (codes.length > 16 || codes.some(code => !/^[a-z][a-z0-9_.-]{0,127}$/u.test(code))) invalid(`${path}.validation.issueCodes is invalid`);
    const reported = record(line.reported, `${path}.reported`);
    const charged = record(line.charged, `${path}.charged`);
    return {
      sequence: index + 1,
      requestId,
      taskKind: identifier(line.taskKind, `${path}.taskKind`),
      stage: identifier(line.stage, `${path}.stage`),
      allowance: enumeration(line.allowance, ["run", "exploration"] as const, `${path}.allowance`),
      promptVersion: identifier(line.promptVersion, `${path}.promptVersion`),
      provider: identifier(line.provider, `${path}.provider`),
      model: identifier(line.model, `${path}.model`),
      validationOk: validation === null ? null : boolean(validation.ok, `${path}.validation.ok`),
      validationCodes: codes,
      inputTokens: nullableCount(reported.inputTokens, `${path}.reported.inputTokens`),
      outputTokens: nullableCount(reported.outputTokens, `${path}.reported.outputTokens`),
      totalTokens: nullableCount(reported.totalTokens, `${path}.reported.totalTokens`),
      estimatedCostUsd: reported.estimatedCostUsd === null ? null : nonNegative(reported.estimatedCostUsd, `${path}.reported.estimatedCostUsd`),
      charged: {
        inputTokens: integer(charged.inputTokens, `${path}.charged.inputTokens`),
        outputTokens: integer(charged.outputTokens, `${path}.charged.outputTokens`),
        totalTokens: integer(charged.totalTokens, `${path}.charged.totalTokens`),
        estimatedCostUsd: nonNegative(charged.estimatedCostUsd, `${path}.charged.estimatedCostUsd`),
        tokens: basis(charged.tokens, `${path}.charged.tokens`),
        cost: basis(charged.cost, `${path}.charged.cost`),
      },
      budgetBreach: boolean(line.budgetBreach, `${path}.budgetBreach`),
    };
  });
  if (new Set(calls.map(call => call.requestId)).size !== calls.length) invalid(`${at} repeats a request`);
  return { calls, omitted };
}

/**
 * Core's own gate record, bounded. `reason` is one of Core's fixed sentences
 * and never carries page data, but it is bounded and stripped of control
 * characters here anyway, because this is a value the runner prints.
 */
function runLlmGate(value: JsonRecord): ExistingRunLlmGate {
  const at = "runDetail.metadata.llmGate";
  const bounded = (input: unknown, field: string, maximum: number): string | undefined => {
    if (input === undefined || input === null) return undefined;
    const parsed = text(input, `${at}.${field}`);
    if (parsed.length > maximum) invalid(`${at}.${field} is too long`);
    return parsed.replace(/[ -]/gu, " ");
  };
  const reason = bounded(value.reason, "reason", 512);
  const code = bounded(value.code, "code", 128);
  const publishedPatchSkippedCode = bounded(value.patchSkippedCode, "patchSkippedCode", 128);
  const diagnosis = optionalRecord(value.structuredDiagnosis, `${at}.structuredDiagnosis`);
  const patchSkippedCode = publishedPatchSkippedCode && /^llm\.runtime_patch_[a-z_]+$/u.test(publishedPatchSkippedCode)
    ? publishedPatchSkippedCode
    : value.patchSkipped !== undefined && diagnosis?.patchNeeded === false
      ? "llm.runtime_patch_not_requested"
      : undefined;
  const publishedPatchHeldCode = bounded(value.patchHeldCode, "patchHeldCode", 128);
  const patchHeldCode = publishedPatchHeldCode && /^llm\.runtime_patch_[a-z_]+$/u.test(publishedPatchHeldCode) ? publishedPatchHeldCode : undefined;
  const permissions = gatePermissions(value.permissions, `${at}.permissions`);
  return { invoked: typeof value.invoked === "boolean" ? value.invoked : false, ...(reason ? { reason } : {}), ...(code ? { code } : {}), ...(patchSkippedCode ? { patchSkippedCode } : {}), ...(patchHeldCode ? { patchHeldCode } : {}), ...(permissions ? { permissions } : {}) };
}

/** Core's classes of lasting consequence, as the gate records them: lowercase words joined by underscores. */
const CONSEQUENCE_CLASS = /^[a-z]+(?:_[a-z]+)*$/u;

/** The gate's authority by class. Anything that is not a list of class words fails the read by its path. */
function gatePermissions(value: unknown, at: string): ExistingRunLlmGate["permissions"] {
  const permissions = optionalRecord(value, at);
  if (!permissions) return undefined;
  const classes = (field: "granted" | "instructed" | "lapsed") => stringArray(permissions[field] ?? [], `${at}.${field}`).map((item, index) => {
    if (item.length > 64 || !CONSEQUENCE_CLASS.test(item)) invalid(`${at}.${field}[${index}] is not a consequence class`);
    return item;
  });
  return { granted: classes("granted"), instructed: classes("instructed"), lapsed: classes("lapsed") };
}

/** The run's permission request as Core's own parser reads it; one it refuses fails the read rather than being carried half-read. */
function runPermissionRequest(value: unknown): AutomationStudioActionPermissionRequest | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = parseAutomationStudioActionPermissionRequest(value);
  if (!parsed) invalid("runDetail.metadata.permissionRequest is not a permission request Core built");
  return parsed;
}
/**
 * Core's receipt for a repair the model declined (`automationStudioDeclinedRepairAttempt`):
 * `kind: "no_repair"` and one of Core's closed reasons as `declinedReason`.
 * Its issue is Core's sentence for the decline, which matches none of the
 * patterns below, so it was read as `runtime_patch.preflight_rejected` -- Core
 * refusing a repair the model proposed, the opposite of what happened. It is
 * read as the decline it is, by the reason's word and never the sentence.
 */
const DECLINED_REPAIR_KIND = "no_repair";
const DECLINED_REASON = /^[a-z]+(?:_[a-z]+)*$/u;
const DECLINED_REASON_MAX_LENGTH = 64;
function declinedRepairCode(reason: unknown): string {
  return typeof reason === "string" && reason.length <= DECLINED_REASON_MAX_LENGTH && DECLINED_REASON.test(reason) ? `runtime_patch.declined.${reason}` : "runtime_patch.declined";
}
function runtimePatchAttempt(value: unknown, at: string): ExistingRuntimePatchAttempt {
  const item = record(value, at);
  const recognizedKinds = ["temporary_action_sequence", "temporary_wait_retry", "temporary_target_override", "temporary_recovery_subflow_call", "temporary_reroute", "runtime_patch_response", DECLINED_REPAIR_KIND];
  const kind = typeof item.kind === "string" && recognizedKinds.includes(item.kind) ? item.kind : undefined;
  const issues = item.issues === undefined ? [] : stringArray(item.issues, `${at}.issues`);
  const permissionOutcome = typeof item.permissionOutcome === "string" && (harnessPatchPermissionOutcomes as readonly string[]).includes(item.permissionOutcome) ? item.permissionOutcome as HarnessPatchPermissionOutcome : undefined;
  const permissionRequired = item.permissionRequired === true ? true : undefined;
  // A patch the gate held back is read by its structured fields, never its
  // sentence: the request is not a preflight refusal, and the sentence names a control.
  const heldCode = permissionRequired ? "runtime_patch.permission_required" : permissionOutcome === "undeclared" ? "runtime_patch.consequences_undeclared" : undefined;
  const issueCodes = heldCode ? [heldCode] : kind === DECLINED_REPAIR_KIND ? [declinedRepairCode(item.declinedReason)] : issues.map(issue => {
    if (/target node|targetNodeId/i.test(issue)) return "runtime_patch.target_node_invalid";
    if (/target override|action target/i.test(issue)) return "runtime_patch.target_override_rejected";
    if (/exactly one runtime patch/i.test(issue)) return "runtime_patch.patch_count_invalid";
    if (/external side effect/i.test(issue)) return "runtime_patch.side_effect_not_authorized";
    if (/policy/i.test(issue)) return "runtime_patch.policy_rejected";
    return "runtime_patch.preflight_rejected";
  });
  return {
    ...(kind ? { kind } : {}),
    ...(typeof item.proposalOnly === "boolean" ? { proposalOnly: item.proposalOnly } : {}),
    ...(typeof item.executed === "boolean" ? { executed: item.executed } : {}),
    ...(typeof item.preflightOk === "boolean" ? { preflightOk: item.preflightOk } : {}),
    issueCodes,
    adaptationCreated: typeof item.adaptationId === "string" && item.adaptationId.length > 0,
    changeProposalCreated: typeof item.changeProposalId === "string" && item.changeProposalId.length > 0,
    ...(permissionOutcome ? { permissionOutcome } : {}),
    ...(permissionRequired ? { permissionRequired } : {}),
  };
}
function runAction(value: unknown, at: string): ExistingRunAction { const item = record(value, at); return { attemptId: text(item.attemptId, `${at}.attemptId`), nodeId: text(item.nodeId, `${at}.nodeId`), definitionId: text(item.definitionId, `${at}.definitionId`), order: integer(item.order, `${at}.order`), status: enumeration(item.status, ["queued", "running", "waiting", "succeeded", "failed", "cancelled", "unknown"] as const, `${at}.status`), startedAt: finite(item.startedAt, `${at}.startedAt`), ...(item.finishedAt === undefined ? {} : { finishedAt: finite(item.finishedAt, `${at}.finishedAt`) }), ...(typeof item.message === "string" ? { message: item.message } : {}) }; }
function runEvent(value: unknown, at: string): ExistingRunEvent { const item = record(value, at); return { sequence: integer(item.sequence, `${at}.sequence`), eventId: text(item.eventId, `${at}.eventId`), eventKind: enumeration(item.eventKind, ["run_summary", "route_decision", "subflow_execution", "action_attempt", "recovery_attempt", "intervention"] as const, `${at}.eventKind`), timestampMs: finite(item.timestampMs, `${at}.timestampMs`), title: text(item.title, `${at}.title`), ...(typeof item.status === "string" ? { status: item.status } : {}), ...(typeof item.entityId === "string" ? { entityId: item.entityId } : {}) }; }
function routeDecision(value: unknown, at: string): ExistingRouteDecision { const item = record(value, at); return { decisionId: text(item.decisionId, `${at}.decisionId`), routerId: text(item.routerId, `${at}.routerId`), ...(typeof item.selectedRuleId === "string" ? { selectedRuleId: item.selectedRuleId } : {}), ...(typeof item.selectedSubflowId === "string" ? { selectedSubflowId: item.selectedSubflowId } : {}), ...(typeof item.fallbackUsed === "boolean" ? { fallbackUsed: item.fallbackUsed } : {}) }; }
function subflowExecution(value: unknown, at: string): ExistingSubflowExecution { const item = record(value, at); const metadata = optionalRecord(item.metadata, `${at}.metadata`); return { entryId: text(item.entryId, `${at}.entryId`), subflowId: text(item.subflowId, `${at}.subflowId`), status: status(item.status, `${at}.status`), ...(typeof metadata?.graphFlowId === "string" ? { graphFlowId: metadata.graphFlowId } : {}), ...(typeof metadata?.routeDecisionId === "string" ? { routeDecisionId: metadata.routeDecisionId } : {}) }; }
function status(value: unknown, at: string): RuntimeStatus { return enumeration(value, ["queued", "running", "waiting", "succeeded", "failed", "cancelled"] as const, at); }
function record(value: unknown, at: string): JsonRecord { if (!value || typeof value !== "object" || Array.isArray(value)) invalid(`${at} must be an object`); return value as JsonRecord; }
function optionalRecord(value: unknown, at: string): JsonRecord | undefined { return value === undefined || value === null ? undefined : record(value, at); }
function array(value: unknown, at: string): unknown[] { if (!Array.isArray(value)) invalid(`${at} must be an array`); return value; }
function stringArray(value: unknown, at: string): string[] { return array(value, at).map((item, index) => text(item, `${at}[${index}]`)); }
function text(value: unknown, at: string): string { if (typeof value !== "string" || !value) invalid(`${at} must be a non-empty string`); return value; }
function nullableText(value: unknown, at: string): string | null { if (value === null || value === undefined) return null; return text(value, at); }
function finite(value: unknown, at: string): number { if (typeof value !== "number" || !Number.isFinite(value)) invalid(`${at} must be finite`); return value; }
function integer(value: unknown, at: string): number { const result = finite(value, at); if (!Number.isSafeInteger(result) || result < 0) invalid(`${at} must be a non-negative integer`); return result; }
function positiveInteger(value: number, at: string): number { if (!Number.isSafeInteger(value) || value < 1) invalid(`${at} must be a positive integer`); return value; }
function boolean(value: unknown, at: string): boolean { if (typeof value !== "boolean") invalid(`${at} must be a boolean`); return value; }
function enumeration<const T extends readonly string[]>(value: unknown, allowed: T, at: string): T[number] { if (typeof value !== "string" || !allowed.includes(value)) invalid(`${at} is invalid`); return value as T[number]; }
function nullableUrl(value: unknown, at: string): string | null { if (value === null || value === undefined) return null; const result = text(value, at); let url: URL; try { url = new URL(result); } catch { invalid(`${at} must be a URL`); } if (url!.protocol !== "ws:" && url!.protocol !== "wss:") invalid(`${at} must use ws or wss`); return url!.toString(); }
function invalid(message: string): never { throw new RunnerFailure("environment.missing", `Malformed FluxIQ API response: ${message}`); }
function safeId(value: string): string { return /^[A-Za-z0-9._:+-]+$/.test(value) ? value : "[invalid-id]"; }
function hashJson(value: unknown): string { return createHash("sha256").update(stableJson(value)).digest("hex"); }
function stableJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as JsonRecord).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`; return JSON.stringify(value); }
