import { createHash } from "node:crypto";
import { RunnerFailure } from "./failure.js";
import { FluxIQControlClient, type FluxIQHttpOptions } from "./http-control.js";

type JsonRecord = Record<string, unknown>;
export type ExistingProject = { id: string; name: string; description: string; domainId?: string | null; createdAt: number; updatedAt: number };
export type ExistingFlowSummary = { flowId: string; name: string; description?: string; sourceMode: "visual" | "code"; nodeCount: number; edgeCount: number; updatedAt: number; version?: string };
export type ExistingFlow = { flowId: string; projectId: string; name: string; updatedAt: number; contentHash: string; document: JsonRecord };
export type ExistingRuntimeSession = { runId: string; projectId: string | null; flowId: string; targetKind: "task" | "routine" | "flow"; targetId: string; status: RuntimeStatus };
export type RuntimeStatus = "queued" | "running" | "waiting" | "succeeded" | "failed" | "cancelled";
export type ExistingRunSummary = { runId: string; projectId: string; flowId: string; status: RuntimeStatus; actionAttemptCount: number; updatedAt: number; startedAt?: number; finishedAt?: number };
export type ExistingRunDetail = { summary: ExistingRunSummary; actionAttempts: ExistingRunAction[]; rawMetadata?: JsonRecord };
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

export class ExistingFluxIQControlClient extends FluxIQControlClient {
  async automationStudioCall(endpoint: string, payload: JsonRecord = {}, bounds: FluxIQHttpOptions = {}): Promise<unknown> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(endpoint)) throw new Error("Automation Studio endpoint is malformed");
    const envelope = record(await this.request(`/api/programs/automation-studio/${endpoint}`, payload, "environment.missing", "POST", bounds), `${endpoint} response`);
    if (envelope.ok !== true) throw new RunnerFailure("environment.missing", `Automation Studio call failed: ${endpoint}`);
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

  async listProjects(): Promise<ExistingProject[]> {
    const payload = record(await this.automationStudioCall("projects"), "projects payload");
    return array(payload.projects, "projects").map((value, index) => project(value, `projects[${index}]`));
  }

  async requireProject(projectId: string): Promise<ExistingProject> {
    const matches = (await this.listProjects()).filter(item => item.id === projectId);
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

  async selectExistingContext(projectId: string, clientId?: string, bounds: FluxIQHttpOptions = {}): Promise<void> { await this.selectProject(projectId, clientId, bounds); }

  async startPersistedFlow(input: { projectId: string; flowId: string; inputs?: JsonRecord; authorizedDomainIds?: string[] } & FluxIQHttpOptions): Promise<ExistingRuntimeSession> {
    const payload = record(await this.automationStudioCall("start-runtime-session", { projectId: input.projectId, flowId: input.flowId, targetKind: "flow", targetId: input.flowId, ...(input.inputs ? { inputs: input.inputs } : {}), ...(input.authorizedDomainIds ? { authorizedDomainIds: input.authorizedDomainIds } : {}) }, input), "start runtime payload");
    return runtimeSession(payload.runtimeSession, "runtimeSession", input.projectId, input.flowId);
  }

  async runPersistedFlow(input: { projectId: string; flowId: string; runId?: string; inputs?: JsonRecord; maxSteps?: number; authorizedDomainIds?: string[]; idempotencyKey?: string } & FluxIQHttpOptions): Promise<{ session: ExistingRuntimeSession; summary?: ExistingRunSummary }> {
    const payload = record(await this.automationStudioCall("run-runtime-session", {
      projectId: input.projectId, flowId: input.flowId, ...(input.runId ? { runId: input.runId } : {}), ...(input.inputs ? { inputs: input.inputs } : {}),
      ...(input.maxSteps === undefined ? {} : { maxSteps: positiveInteger(input.maxSteps, "maxSteps") }), ...(input.authorizedDomainIds ? { authorizedDomainIds: input.authorizedDomainIds } : {}),
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}), adaptiveMode: "deterministic", dryRunLlm: true, authorizedExternalSideEffects: false,
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
    return { summary, actionAttempts: actions, ...(detail.metadata === undefined ? {} : { rawMetadata: record(detail.metadata, "runDetail.metadata") }) };
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
function runSummary(value: unknown, at: string): ExistingRunSummary { const item = record(value, at); return { runId: text(item.runId, `${at}.runId`), projectId: text(item.projectId, `${at}.projectId`), flowId: text(item.flowId, `${at}.flowId`), status: status(item.status, `${at}.status`), actionAttemptCount: integer(item.actionAttemptCount, `${at}.actionAttemptCount`), updatedAt: finite(item.updatedAt, `${at}.updatedAt`), ...(item.startedAt === undefined ? {} : { startedAt: finite(item.startedAt, `${at}.startedAt`) }), ...(item.finishedAt === undefined ? {} : { finishedAt: finite(item.finishedAt, `${at}.finishedAt`) }) }; }
function runAction(value: unknown, at: string): ExistingRunAction { const item = record(value, at); return { attemptId: text(item.attemptId, `${at}.attemptId`), nodeId: text(item.nodeId, `${at}.nodeId`), definitionId: text(item.definitionId, `${at}.definitionId`), order: integer(item.order, `${at}.order`), status: enumeration(item.status, ["queued", "running", "waiting", "succeeded", "failed", "cancelled", "unknown"] as const, `${at}.status`), startedAt: finite(item.startedAt, `${at}.startedAt`), ...(item.finishedAt === undefined ? {} : { finishedAt: finite(item.finishedAt, `${at}.finishedAt`) }), ...(typeof item.message === "string" ? { message: item.message } : {}) }; }
function runEvent(value: unknown, at: string): ExistingRunEvent { const item = record(value, at); return { sequence: integer(item.sequence, `${at}.sequence`), eventId: text(item.eventId, `${at}.eventId`), eventKind: enumeration(item.eventKind, ["run_summary", "route_decision", "subflow_execution", "action_attempt", "recovery_attempt", "intervention"] as const, `${at}.eventKind`), timestampMs: finite(item.timestampMs, `${at}.timestampMs`), title: text(item.title, `${at}.title`), ...(typeof item.status === "string" ? { status: item.status } : {}), ...(typeof item.entityId === "string" ? { entityId: item.entityId } : {}) }; }
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
function safeId(value: string): string { return /^[A-Za-z0-9._:-]+$/.test(value) ? value : "[invalid-id]"; }
function hashJson(value: unknown): string { return createHash("sha256").update(stableJson(value)).digest("hex"); }
function stableJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as JsonRecord).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`; return JSON.stringify(value); }
