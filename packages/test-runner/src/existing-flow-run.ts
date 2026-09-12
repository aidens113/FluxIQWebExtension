import { randomUUID } from "node:crypto";
import { RunnerFailure } from "./failure.js";
import { isBoundedHttpFailure, type FluxIQHttpOptions } from "./http-control.js";
import type { ExpectedAction } from "@fluxiq-web-extension/test-contracts";
import type {
  ExistingFlow,
  ExistingFluxIQControlClient,
  ExistingGatewayDiscovery,
  ExistingProject,
  ExistingRunAction,
  ExistingRunDetail,
  ExistingRunEvent,
} from "./existing-fluxiq-control.js";
import { readFlowActionTypes } from "./flow-lane/index.js";
import { requireSecureGatewayUrl, type ExistingTargetConfiguration } from "./target-config.js";

export type PersistedFlowSelection = Pick<ExistingTargetConfiguration, "projectId" | "flowId">;

export type ExistingFluxIQPreflight = {
  project: ExistingProject;
  flow: ExistingFlow;
  gateway: ExistingGatewayDiscovery;
  gatewayUrl: string;
  sessionIdentityVerified: boolean;
};

export type ExistingFlowExecution = {
  runId: string;
  status: "succeeded";
  detail: ExistingRunDetail;
  actions: ExistingRunAction[];
  events: ExistingRunEvent[];
  /** Attempt node id to the output its Flow node dispatches; empty when no expectation made it worth reading. */
  actionTypes: ReadonlyMap<string, string>;
};
export type ExistingFlowExecutionBounds = FluxIQHttpOptions & { cancelTimeoutMs?: number };
export type ExistingFlowCancellationReport = {
  failure: "timeout" | "abort";
  runId?: string;
  cancellation: "not-attempted" | "confirmed" | "unconfirmed" | "unsupported" | "failed";
};
const cancellationReports = new WeakMap<object, ExistingFlowCancellationReport>();

export function existingFlowCancellationReport(error: unknown): ExistingFlowCancellationReport | undefined {
  return typeof error === "object" && error !== null ? cancellationReports.get(error) : undefined;
}

export async function preflightExistingFluxIQ(
  control: ExistingFluxIQControlClient,
  target: ExistingTargetConfiguration,
): Promise<ExistingFluxIQPreflight> {
  const identity = await control.validateCurrentSession(target.credentials.username);
  const project = await control.requireProject(target.projectId, "web-automation");
  if (project.domainId !== undefined && project.domainId !== null && project.domainId !== "web-automation") {
    throw new RunnerFailure("environment.missing", "Existing FluxIQ project is not bound to the web-automation domain");
  }
  const summaries = await control.listFlowSummaries(target.projectId);
  if (summaries.filter(item => item.flowId === target.flowId).length !== 1) {
    throw new RunnerFailure("environment.missing", "Configured persisted Flow is not uniquely accessible in the selected project");
  }
  const flow = await control.getExactFlow(target.projectId, target.flowId);
  const gateway = await control.gatewayDiscovery();
  const discoveredGatewayUrl = target.gatewayUrl ?? gateway.publicUrl;
  if (!gateway.enabled || !gateway.listening || !discoveredGatewayUrl) {
    throw new RunnerFailure("gateway.connection", "Existing FluxIQ client gateway is not enabled, listening, and discoverable");
  }
  let gatewayUrl: string;
  try { gatewayUrl = requireSecureGatewayUrl(discoveredGatewayUrl); }
  catch (cause) { throw new RunnerFailure("gateway.connection", "Existing FluxIQ gateway URL violates transport policy", { cause }); }
  return { project, flow, gateway, gatewayUrl, sessionIdentityVerified: identity.identityEndpointAvailable };
}

export async function executeExistingPersistedFlow(
  control: ExistingFluxIQControlClient,
  target: PersistedFlowSelection,
  facilityRunId: string,
  inputs: Record<string, unknown> = {},
  expectedActions: ExpectedAction[] = [],
  bounds: ExistingFlowExecutionBounds = {},
): Promise<ExistingFlowExecution> {
  let runId: string | undefined;
  const httpBounds: FluxIQHttpOptions = { ...(bounds.signal ? { signal: bounds.signal } : {}), ...(bounds.timeoutMs === undefined ? {} : { timeoutMs: bounds.timeoutMs }) };
  try {
    await control.selectExistingContext(target.projectId, undefined, httpBounds);
    const started = await control.startPersistedFlow({ projectId: target.projectId, flowId: target.flowId, inputs, authorizedDomainIds: ["web-automation"], ...httpBounds });
    runId = started.runId;
    const result = await control.runPersistedFlow({ projectId: target.projectId, flowId: target.flowId, runId, inputs, authorizedDomainIds: ["web-automation"], idempotencyKey: `fluxiq-lab:${facilityRunId}:${randomUUID()}`, ...httpBounds });
    if (result.session.runId !== runId || result.session.status !== "succeeded") throw new RunnerFailure("runtime.behavior", `Persisted FluxIQ Flow finished with status ${result.session.status}`);
    const [detail, actions, events] = await Promise.all([
      control.getRunDetail(target.projectId, runId, httpBounds),
      control.listRunActions(target.projectId, runId, { limit: 100, ...httpBounds }),
      control.listRunEvents(target.projectId, runId, { limit: 100, ...httpBounds }),
    ]);
    if (detail.summary.flowId !== target.flowId || detail.summary.status !== "succeeded") throw new RunnerFailure("runtime.behavior", "Persisted FluxIQ Flow detail did not confirm a successful matching run");
    if (!actions.length) throw new RunnerFailure("action.dispatch", "Persisted FluxIQ Flow produced no durable action attempts");
    const failed = actions.find(action => action.status !== "succeeded");
    if (failed) throw new RunnerFailure("action.dispatch", `Persisted FluxIQ Flow action ${safeId(failed.attemptId)} finished with status ${failed.status}`);
    let actionTypes: ReadonlyMap<string, string> = new Map();
    if (expectedActions.length) {
      // Core records every recorded action as one `builtin.policy.action` node
      // and drops the node's inputs, so `definitionId` reads the same for all
      // of them and could only match an expectation by accident. The attempt's
      // `nodeId` is the surviving link, and the Flow's own nodes carry the
      // output each dispatches -- the join the Flow lane makes.
      actionTypes = await readFlowActionTypes(control, target, httpBounds);
      for (const expected of expectedActions) {
        const expectedStatus = expected.outcome ?? "succeeded";
        const matched = actions.some(action => actionTypeOf(action, actionTypes) === expected.action && action.status === expectedStatus);
        if (!matched) {
          const observed = actions.map(action => `${safeId(actionTypeOf(action, actionTypes))}:${action.status}`).join(", ") || "no attempts";
          throw new RunnerFailure("action.dispatch", `Persisted FluxIQ Flow did not produce expected ${safeId(expected.action)} action outcome ${expectedStatus}; it produced ${observed}`);
        }
      }
    }
    return { runId, status: "succeeded", detail, actions, events, actionTypes };
  } catch (error) {
    if (!isBoundedHttpFailure(error)) throw error;
    const failure = error instanceof RunnerFailure && error.details?.bounded === "timeout" ? "timeout" : "abort";
    const report: ExistingFlowCancellationReport = { failure, ...(runId ? { runId } : {}), cancellation: runId ? await attemptCancellation(control, target.projectId, runId, bounds.cancelTimeoutMs) : "not-attempted" };
    if (typeof error === "object" && error !== null) cancellationReports.set(error, report);
    throw error;
  }
}

function safeId(value: string): string { return /^[A-Za-z0-9._:-]+$/.test(value) ? value : "[invalid-id]"; }

/**
 * What an attempt actually ran: the output its Flow node dispatches, falling
 * back to the definition id for a node the Flow does not declare -- a native
 * node whose definition id is its action.
 */
function actionTypeOf(action: ExistingRunAction, actionTypes: ReadonlyMap<string, string>): string {
  return actionTypes.get(action.nodeId) ?? action.definitionId;
}
async function attemptCancellation(control: ExistingFluxIQControlClient, projectId: string, runId: string, timeoutMs = 5_000): Promise<ExistingFlowCancellationReport["cancellation"]> {
  try {
    const cancelled = await control.cancelRun(projectId, runId, "Test facility timeout or interruption", { timeoutMs });
    return cancelled?.status === "cancelled" ? "confirmed" : "unconfirmed";
  } catch (error) {
    if (error instanceof RunnerFailure && error.details?.status === 404) return "unsupported";
    return "failed";
  }
}
