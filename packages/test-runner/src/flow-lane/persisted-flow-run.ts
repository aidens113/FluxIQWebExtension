import { randomUUID } from "node:crypto";
import { parseAutomationStudioFailureRecord, type AutomationStudioFailureRecord, type RunActionTiming } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import type { FluxIQHttpOptions } from "../http-control.js";
import { runActionStatus } from "../run-manifest/index.js";

/** The Core calls a Flow run makes; `ExistingFluxIQControlClient` satisfies it. */
export type PersistedFlowRunControl = {
  selectExistingContext(projectId: string, clientId?: string, bounds?: FluxIQHttpOptions, flowId?: string): Promise<void>;
  startPersistedFlow(input: { projectId: string; flowId: string; inputs?: Record<string, unknown>; authorizedDomainIds?: string[] } & FluxIQHttpOptions): Promise<{ runId: string }>;
  runPersistedFlow(input: { projectId: string; flowId: string; runId?: string; inputs?: Record<string, unknown>; authorizedDomainIds?: string[]; idempotencyKey?: string } & FluxIQHttpOptions): Promise<{ session: { runId: string; status: string } }>;
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: FluxIQHttpOptions, domainId?: string): Promise<unknown>;
};

/** One action attempt, carrying Core's own structured failure rather than a message. */
export type PersistedFlowAction = {
  actionType: string;
  status: RunActionTiming["status"];
  startedAt: string;
  durationMs?: number;
  failure: AutomationStudioFailureRecord | null;
  extracted?: Array<Record<string, string>>;
};

export type PersistedFlowRunOutcome = {
  runId: string;
  status: "succeeded" | "failed" | "cancelled" | "unknown";
  actions: PersistedFlowAction[];
  /** The first structured failure Core recorded, read from its `failure` field. `null` when none was recorded. */
  failure: AutomationStudioFailureRecord | null;
  /** LLM interventions Core recorded for the run. Week 1 runs provider-free, so this must stay 0. */
  harnessActivations: number;
  /** Records every extract attempt yielded, in attempt order. Proves paginated extraction. */
  extracted: Array<Array<Record<string, string>>>;
};

/**
 * Runs a persisted Flow and reports what happened, including failure.
 * `executeExistingPersistedFlow` throws on a failed action, which suits a
 * lane asserting success but destroys the evidence a negative workflow needs:
 * its expected failure is exactly what the run must report. This keeps the
 * run detail either way and reads Core's structured `failure` field, so a
 * category is never recovered by parsing a message.
 */
export async function executeRecordedFlowRun(
  control: PersistedFlowRunControl,
  input: { projectId: string; flowId: string; facilityRunId: string; inputs?: Record<string, unknown>; actionTypes?: ReadonlyMap<string, string> },
  bounds: FluxIQHttpOptions = {},
): Promise<PersistedFlowRunOutcome> {
  await control.selectExistingContext(input.projectId, undefined, bounds, input.flowId);
  const inputs = input.inputs ?? {};
  const started = await control.startPersistedFlow({ projectId: input.projectId, flowId: input.flowId, inputs, authorizedDomainIds: ["web-automation"], ...bounds });
  const runId = started.runId;
  if (!runId) throw new RunnerFailure("runtime.behavior", "Core did not return a run id for the approved Flow");
  let sessionStatus = "unknown";
  try {
    const result = await control.runPersistedFlow({ projectId: input.projectId, flowId: input.flowId, runId, inputs, authorizedDomainIds: ["web-automation"], idempotencyKey: `fluxiq-lab:${input.facilityRunId}:${randomUUID()}`, ...bounds });
    sessionStatus = result.session.status;
    if (result.session.runId !== runId) throw new RunnerFailure("runtime.behavior", "Core ran a different run than the one it started");
  } catch (error) {
    // A Flow that fails its actions is a result, not a runner fault: read the
    // detail below so the expected failure can still be asserted. A transport
    // fault leaves no detail and is rethrown by `readRunDetail`.
    if (!(error instanceof RunnerFailure)) throw error;
    sessionStatus = "failed";
  }
  const detail = await readRunDetail(control, input.projectId, runId, bounds, input.actionTypes ?? new Map());
  const actions = detail.actions;
  if (!actions.length) throw new RunnerFailure("action.dispatch", "The approved Flow produced no durable action attempt");
  const failure = actions.map((action) => action.failure).find((record): record is AutomationStudioFailureRecord => record !== null) ?? null;
  const status = runStatus(detail.summaryStatus ?? sessionStatus);
  return {
    runId,
    status,
    actions,
    failure,
    harnessActivations: detail.harnessActivations,
    extracted: actions.flatMap((action) => (action.extracted ? [action.extracted] : [])),
  };
}

async function readRunDetail(
  control: PersistedFlowRunControl,
  projectId: string,
  runId: string,
  bounds: FluxIQHttpOptions,
  actionTypes: ReadonlyMap<string, string>,
): Promise<{ summaryStatus: string | undefined; actions: PersistedFlowAction[]; harnessActivations: number }> {
  const payload = asRecord(await control.automationStudioCall("get-flow-run-detail", { projectId, runId }, bounds), "run detail payload");
  const detail = asRecord(payload.runDetail, "runDetail");
  const summary = asRecord(detail.summary, "runDetail.summary");
  if (summary.runId !== runId) throw new RunnerFailure("runtime.behavior", "Core returned a run detail for a different run");
  const attempts = Array.isArray(detail.actionAttempts) ? detail.actionAttempts : [];
  const interventions = Array.isArray(detail.interventions) ? detail.interventions : [];
  const actions = attempts
    .map((value, index) => asRecord(value, `runDetail.actionAttempts[${index}]`))
    .sort((left, right) => numberOf(left.order) - numberOf(right.order))
    .map((attempt) => flowAction(attempt, actionTypes));
  return { summaryStatus: typeof summary.status === "string" ? summary.status : undefined, actions, harnessActivations: interventions.length };
}

/**
 * Every recorded action runs through the same `builtin.policy.action` node
 * definition, so `definitionId` cannot identify one; the node id resolved
 * through the Flow's own nodes can. The definition id remains the fallback,
 * which is what a node outside the recorded set reports.
 */
function flowAction(attempt: Record<string, unknown>, actionTypes: ReadonlyMap<string, string>): PersistedFlowAction {
  const startedAt = numberOf(attempt.startedAt);
  const finishedAt = typeof attempt.finishedAt === "number" && Number.isFinite(attempt.finishedAt) ? attempt.finishedAt : undefined;
  const extracted = extractedRecords(attempt);
  const nodeId = typeof attempt.nodeId === "string" ? attempt.nodeId : "";
  return {
    actionType: actionTypes.get(nodeId) ?? (typeof attempt.definitionId === "string" ? attempt.definitionId : "unknown"),
    status: runActionStatus(attempt.status),
    startedAt: new Date(startedAt).toISOString(),
    ...(finishedAt === undefined ? {} : { durationMs: Math.max(0, Math.round(finishedAt - startedAt)) }),
    // Core's own record, parsed by Core's parser. A record Core would reject is treated as absent.
    failure: parseAutomationStudioFailureRecord(attempt.failure) ?? null,
    ...(extracted ? { extracted } : {}),
  };
}

/** Records an extract action reported, wherever Core carried the action result. */
function extractedRecords(attempt: Record<string, unknown>): Array<Record<string, string>> | undefined {
  const metadata = attempt.metadata && typeof attempt.metadata === "object" ? attempt.metadata as Record<string, unknown> : undefined;
  const candidates = [attempt.structuredResult, metadata?.result, metadata?.structuredResult, metadata]
    .map((value) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>).extracted : undefined))
    .find((value) => Array.isArray(value));
  if (!Array.isArray(candidates)) return undefined;
  const records: Array<Record<string, string>> = [];
  for (const entry of candidates) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    records.push(Object.fromEntries(Object.entries(entry as Record<string, unknown>).flatMap(([key, value]) => (typeof value === "string" ? [[key, value] as const] : []))));
  }
  return records;
}

function runStatus(value: string): PersistedFlowRunOutcome["status"] {
  return value === "succeeded" || value === "failed" || value === "cancelled" ? value : "unknown";
}
function asRecord(value: unknown, at: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RunnerFailure("runtime.behavior", `${at} must be an object`);
  return value as Record<string, unknown>;
}
function numberOf(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
