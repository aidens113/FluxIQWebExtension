import { randomUUID } from "node:crypto";
import { parseAutomationStudioFailureRecord, type AutomationStudioFailureRecord, type RunActionTiming } from "@fluxiq-web-extension/test-contracts";
import type { AutomationNodeTargetResolution } from "fluxiq/automation-studio/nodes";
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
  /**
   * Core's comparison of what the attempt did against the transition its node
   * expected, by Core's name for it (`matched`, `blocked`, ...; Core
   * `runtime/executor/contracts.ts`, `AutomationStudioTransitionComparisonStatus`).
   * The run detail carries it on the attempt itself (Core
   * `service/summaries/conversions.ts`, and `storage/project/runtime-stream-store.ts`
   * for a stored run). Absent when Core compared nothing.
   */
  comparisonStatus?: string;
  /** How Core resolved the attempt's element target before dispatching it; absent when the node dispatched none. */
  targetResolution?: PersistedTargetResolution;
  /** The sanitized evidence packets Core captured around the attempt, measured; absent when it captured none. */
  evidencePackets?: PersistedEvidencePacket[];
};

/**
 * One sanitized page-evidence packet, measured rather than kept: its size and
 * whether the domain had to trim it. Nothing of the packet's content travels.
 *
 * The packet is the `web-llm-evidence.v1` summary the domain's host runtime
 * builds from the client's snapshot (`sanitizeWebLlmSnapshot`,
 * `domain/src/runtime/host-runtime.ts`). Core captures one before and one after
 * each web action attempt and stores them at `stateRefs.beforeAction` and
 * `stateRefs.afterAction` (Core `executor/host-state.ts`), and the run detail
 * copies `stateRefs` into the attempt's `metadata` (Core
 * `service/summaries/conversions.ts`). It is the one packet a passing run
 * produces as well as a failing one, which is what makes it the measure of
 * evidence size.
 *
 * `bytes` is the UTF-8 length of the packet's JSON, the way the domain's own
 * budget counts it (`serializedBytes`, `domain/src/runtime/llm-evidence/limits.ts`).
 */
export type PersistedEvidencePacket = { point: (typeof EVIDENCE_PACKET_POINTS)[number]; bytes: number; truncated: boolean };

const EVIDENCE_PACKET_POINTS = ["beforeAction", "afterAction"] as const;

/**
 * Core's own record of how it resolved an action's element target before
 * dispatch: `AutomationNodeTargetResolution`, imported from Core's public
 * `fluxiq/automation-studio/nodes` export. `nodeAttemptFromResult` puts it on
 * the attempt and the run detail carries it at `metadata.targetResolution`
 * (Core `service/summaries/conversions.ts`). The run bundle kept none of it,
 * and Core's store is deleted when the run ends, so a finished run could not
 * say how any target was resolved.
 *
 * Each variant of Core's union, narrowed to the fields that cannot carry page
 * content: the closed `status` and its numbers. A no-candidates record keeps
 * only its count, because Core applied no confidence floor to it and records
 * none. A scored record keeps its floor, and its confidence and normalized
 * score when Core wrote them. `candidateId` is left behind because Core takes
 * it from a candidate's own `id` or `testId` attribute, and the two signal
 * lists because they name the fingerprint's paths; neither is a value, but
 * neither is needed to read the resolution, and a bundle has no redaction rule
 * for them.
 *
 * This is Core's resolution, not the browser's. The browser's
 * `WebAutomationTargetResolution` reaches Core inside the dispatched result,
 * which Core stores on the attempt's `outputs`; the run detail drops `outputs`,
 * so no endpoint this lane reads can return it.
 */
export type PersistedTargetResolution = PersistedFieldsOf<AutomationNodeTargetResolution>;

/** The fields that may travel. A field Core adds to its union stays behind until it is named here. */
type PersistedTargetResolutionField = "status" | "candidateCount" | "minimumConfidence" | "confidence" | "normalizedScore";

/** Narrows each variant separately, so a variant keeps only the fields it defines. */
type PersistedFieldsOf<Variant> = Variant extends unknown ? Pick<Variant, Extract<keyof Variant, PersistedTargetResolutionField>> : never;

type ScoredTargetResolutionStatus = Exclude<AutomationNodeTargetResolution["status"], "unresolved_no_candidates">;

/**
 * Every status Core scores a candidate under, keyed by Core's own statuses, so
 * the type check fails when Core's union gains a status this reader does not
 * handle, or loses one it does.
 */
const SCORED_TARGET_RESOLUTION_STATUSES: { readonly [Status in ScoredTargetResolutionStatus]: true } = { matched: true, no_match: true, below_confidence: true };

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
  const targetResolution = targetResolutionOf(attempt);
  const evidencePackets = evidencePacketsOf(attempt);
  const comparisonStatus = comparisonStatusOf(attempt);
  return {
    actionType: actionTypes.get(nodeId) ?? (typeof attempt.definitionId === "string" ? attempt.definitionId : "unknown"),
    status: runActionStatus(attempt.status),
    startedAt: new Date(startedAt).toISOString(),
    ...(finishedAt === undefined ? {} : { durationMs: Math.max(0, Math.round(finishedAt - startedAt)) }),
    // Core's own record, parsed by Core's parser. A record Core would reject is treated as absent.
    failure: parseAutomationStudioFailureRecord(attempt.failure) ?? null,
    ...(extracted ? { extracted } : {}),
    ...(comparisonStatus ? { comparisonStatus } : {}),
    ...(targetResolution ? { targetResolution } : {}),
    ...(evidencePackets.length ? { evidencePackets } : {}),
  };
}

/** The shape of Core's comparison status names: lowercase words joined by underscores. */
const COMPARISON_STATUS_NAME = /^[a-z]+(?:_[a-z]+)*$/u;

/**
 * Core's `comparisonStatus`, kept only when it has the shape of one of Core's
 * names, at most 64 characters. The run detail types it as any string (Core
 * `model/flow-adaptation.ts`) and Core's union is not a public export, so the
 * shape is what keeps a value that is not a name, which could carry page text,
 * out of the bundle.
 */
function comparisonStatusOf(attempt: Record<string, unknown>): string | undefined {
  const status = attempt.comparisonStatus;
  return typeof status === "string" && status.length <= 64 && COMPARISON_STATUS_NAME.test(status) ? status : undefined;
}

/**
 * Each packet under the attempt's `metadata.stateRefs`, measured in capture
 * order. A summary without a boolean `truncated` is not a packet the domain
 * writes, and is left unmeasured rather than counted as untrimmed.
 */
function evidencePacketsOf(attempt: Record<string, unknown>): PersistedEvidencePacket[] {
  const stateRefs = optionalRecord(optionalRecord(attempt.metadata)?.stateRefs);
  return EVIDENCE_PACKET_POINTS.flatMap((point) => {
    const summary = optionalRecord(optionalRecord(stateRefs?.[point])?.summary);
    return summary && typeof summary.truncated === "boolean" ? [{ point, bytes: serializedBytes(summary), truncated: summary.truncated }] : [];
  });
}

function serializedBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

/**
 * Core's `metadata.targetResolution`, rebuilt field by field for its variant
 * rather than copied, so a field Core adds later is not carried into the
 * bundle unexamined. A record with an unknown status, or without the fields
 * its variant requires, is not one Core writes, and is treated as absent
 * rather than half-read.
 */
function targetResolutionOf(attempt: Record<string, unknown>): PersistedTargetResolution | undefined {
  const record = optionalRecord(optionalRecord(attempt.metadata)?.targetResolution);
  if (!record) return undefined;
  if (record.status === "unresolved_no_candidates") return record.candidateCount === 0 ? { status: "unresolved_no_candidates", candidateCount: 0 } : undefined;
  const { status, candidateCount, minimumConfidence, confidence, normalizedScore } = record;
  if (!isScoredStatus(status) || !isFiniteNumber(candidateCount) || !isFiniteNumber(minimumConfidence)) return undefined;
  return {
    status,
    candidateCount,
    minimumConfidence,
    ...(isFiniteNumber(confidence) ? { confidence } : {}),
    ...(isFiniteNumber(normalizedScore) ? { normalizedScore } : {}),
  };
}

function isScoredStatus(value: unknown): value is ScoredTargetResolutionStatus {
  return typeof value === "string" && Object.hasOwn(SCORED_TARGET_RESOLUTION_STATUSES, value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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
