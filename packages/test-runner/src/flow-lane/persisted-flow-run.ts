import { randomUUID } from "node:crypto";
import { parseAutomationStudioFailureRecord, type AutomationStudioFailureRecord, type RunActionTiming, type RunHarnessRecovery } from "@fluxiq-web-extension/test-contracts";
import type { AutomationNodeTargetResolution } from "fluxiq/automation-studio/nodes";
import { RunnerFailure } from "../failure.js";
import { isBoundedHttpFailure, type FluxIQHttpOptions } from "../http-control/index.js";
import { runActionStatus } from "../run-manifest/index.js";
import { readHarnessRecovery, type HarnessRecoveryControl } from "./harness-recovery.js";
import { LAB_PROJECT_DOMAIN_ID } from "./lab-project-domain.js";
import { readRunDatasets, runDatasetSummaries, type FlowRunDataset, type RunDatasetSummary } from "./run-datasets.js";

/**
 * A timed-out synchronous Core run can keep executing after its HTTP client has
 * gone away. Under the final two-bench load, the first W02 Flow crossed the
 * request's 30-second bound in both campaigns and completed its runner cleanup
 * 42.9-46.5 seconds after Flow-lane dispatch. Give that exact run the same
 * load-proven 90-second window used for recording finalization to publish a
 * terminal detail with durable attempts.
 */
const TERMINAL_DETAIL_WAIT_MS = 90_000;
const TERMINAL_DETAIL_POLL_MS = 250;

export type PersistedFlowTerminalWait = {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  intervalMs?: number;
};

/** The Core calls a Flow run makes; `ExistingFluxIQControlClient` satisfies it. */
/**
 * The execution grant a live provider run carries. Core refuses such a run any
 * of the flags a deterministic run uses -- a pre-started run id, an authorized
 * domain, an idempotency key -- so a run holding one takes a different path
 * through `executeRecordedFlowRun` rather than adding a flag to the usual one.
 */
export type PersistedFlowLlmExecution = { grantId: string; purpose: "diagnosis_only" | "diagnose_and_adapt" | "explore_and_adapt" };

export type PersistedFlowRunControl = HarnessRecoveryControl & {
  selectExistingContext(projectId: string, clientId?: string, bounds?: FluxIQHttpOptions, flowId?: string): Promise<void>;
  startPersistedFlow(input: { projectId: string; flowId: string; inputs?: Record<string, unknown>; authorizedDomainIds?: string[] } & FluxIQHttpOptions): Promise<{ runId: string }>;
  runPersistedFlow(input: { projectId: string; flowId: string; runId?: string; inputs?: Record<string, unknown>; authorizedDomainIds?: string[]; idempotencyKey?: string; llmExecution?: PersistedFlowLlmExecution } & FluxIQHttpOptions): Promise<{ session: { runId: string; status: string } }>;
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: FluxIQHttpOptions, domainId?: string): Promise<unknown>;
};

/** One action attempt, carrying Core's own structured failure rather than a message. */
export type PersistedFlowAction = {
  actionType: string;
  status: RunActionTiming["status"];
  startedAt: string;
  durationMs?: number;
  failure: AutomationStudioFailureRecord | null;
  /**
   * Rows the attempt captured, from Core's `metadata.recordCount` (K5). Core
   * replaces a stored attempt's captured rows with a `$dataset` marker holding
   * this count, so it is the only thing an attempt says about an extraction —
   * the rows themselves are in the run's datasets. Absent when the attempt
   * captured none.
   */
  recordCount?: number;
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
  /**
   * What Core's recovery harness did during the run: each intervention, each
   * runtime patch attempt, and the adaptations and change proposals the run
   * created (`readHarnessRecovery`); `attempted: false` when it did nothing.
   * Core deletes an isolated run's workspace afterwards, so this is the only
   * record of whether a patch was preflighted, executed or only proposed.
   */
  harnessRecovery: RunHarnessRecovery;
  /**
   * The datasets the run stored, read whole from Core (K5, K8). This is where
   * a Flow run's extracted records are: an attempt carries a record count and
   * a `$dataset` marker, never the rows.
   */
  extracted: FlowRunDataset[];
  /** Every dataset's `nonStringValues`, summed: the values its records leave out. Counts only (D6). */
  extractedNonStringValues: number;
  /**
   * How long each node's attempts took, summed per node, so an extraction's
   * duration can be attributed to the dataset its node wrote.
   */
  extractionDurationsByNode: Map<string, number>;
  /**
   * Set only when Core failed the run, every attempt succeeded, and at least one
   * of the Flow's action nodes was never attempted: the run stopped early rather
   * than failing an action. Absent otherwise, and absent when no action map was
   * given, because then the Flow's action nodes are unknown.
   */
  stoppedWithoutFailedAttempt?: FlowStopWithoutFailedAttempt;
  /**
   * Where the run started, as a position in the recording's candidate order:
   * the position `candidateOrder` gives the node of the run's first attempt, in
   * Core's attempt order, that the order names. 0 is the recording's first
   * action, and an attempt on a node the order does not name is passed over. A
   * position, never a node id. Absent when no order was given, or when no
   * attempt landed on a node it names.
   */
  startCandidateIndex?: number;
};

/**
 * A run Core failed with no failed attempt, counted over the Flow's action
 * nodes. W28's shape in `i-w15-w28-flow-order`: the run started at the chain's
 * last scroll, which succeeded and had no outgoing edge, and Core failed the run
 * with three nodes unvisited. No attempt failed, so the run had no failure
 * record. Counts only: node ids and Core's message stay behind.
 */
export type FlowStopWithoutFailedAttempt = { attemptedActions: number; unvisitedActions: number };

/**
 * Runs a persisted Flow and reports what happened, including failure.
 * `executeExistingPersistedFlow` throws on a failed action, which suits a
 * lane asserting success but destroys the evidence a negative workflow needs:
 * its expected failure is exactly what the run must report. This keeps the
 * run detail either way and reads Core's structured `failure` field, so a
 * category is never recovered by parsing a message.
 *
 * `domainId` is the domain the project is bound to. One value answers two
 * questions that must agree: which domains the run is authorized to act in,
 * and which domain scope its datasets are read under. They were separate
 * literals, and the dataset read had none at all, which is how a run that
 * finally stored rows died on a 400 the moment it tried to read them back.
 */
export async function executeRecordedFlowRun(
  control: PersistedFlowRunControl,
  input: {
    projectId: string; flowId: string; facilityRunId: string; domainId?: string; inputs?: Record<string, unknown>; actionTypes?: ReadonlyMap<string, string>; candidateOrder?: ReadonlyMap<string, number>; llmExecution?: PersistedFlowLlmExecution;
    /**
     * Told Core's run id as soon as Core names one, before anything that can
     * throw reads the run back. A live run's provider calls are accounted from
     * that run, so a caller that only learned the id from a returned outcome
     * lost the accounting of every run this function then failed.
     */
    onRunIdentified?: (runId: string) => void;
  },
  bounds: FluxIQHttpOptions = {},
  terminalWait: PersistedFlowTerminalWait = {},
): Promise<PersistedFlowRunOutcome> {
  const domainId = input.domainId ?? LAB_PROJECT_DOMAIN_ID;
  await control.selectExistingContext(input.projectId, undefined, bounds, input.flowId);
  const inputs = input.inputs ?? {};
  // A live provider run must create its own session: Core revokes the grant and
  // refuses the run outright when it is handed a run id it did not start, an
  // authorized domain, or an idempotency key. So the two-step start-then-run
  // the deterministic lane uses collapses into one call here, and the run id
  // comes back from the run rather than going into it.
  const started = input.llmExecution ? undefined : await control.startPersistedFlow({ projectId: input.projectId, flowId: input.flowId, inputs, authorizedDomainIds: [domainId], ...bounds });
  const runId = started?.runId;
  if (!input.llmExecution && !runId) throw new RunnerFailure("runtime.behavior", "Core did not return a run id for the approved Flow");
  if (runId) input.onRunIdentified?.(runId);
  let sessionStatus = "unknown";
  let executedRunId = runId;
  try {
    const result = await control.runPersistedFlow(input.llmExecution
      ? { projectId: input.projectId, flowId: input.flowId, inputs, llmExecution: input.llmExecution, ...bounds }
      : { projectId: input.projectId, flowId: input.flowId, runId: runId!, inputs, authorizedDomainIds: [domainId], idempotencyKey: `fluxiq-lab:${input.facilityRunId}:${randomUUID()}`, ...bounds });
    sessionStatus = result.session.status;
    executedRunId = result.session.runId;
    if (executedRunId && executedRunId !== runId) input.onRunIdentified?.(executedRunId);
    if (runId !== undefined && result.session.runId !== runId) throw new RunnerFailure("runtime.behavior", "Core ran a different run than the one it started");
    if (!executedRunId) throw new RunnerFailure("runtime.behavior", "Core did not return a run id for the approved Flow");
  } catch (error) {
    // Only a bounded request can have left Core executing after the client went
    // away. An arbitrary runner failure is not evidence that a run completed.
    // A run whose id Core never returned left nothing to read back, so the
    // bounded-failure recovery below has nothing to recover and the original
    // failure stands.
    if (!isBoundedHttpFailure(error) || !executedRunId) throw error;
    const detail = await awaitTerminalRunDetail(control, input.projectId, executedRunId, input.actionTypes ?? new Map(), error, terminalWait);
    return outcomeFromDetail(executedRunId, detail, await terminalReadsOf(control, { projectId: input.projectId, runId: executedRunId, domainId }, detail, bounds), sessionStatus, input.actionTypes, input.candidateOrder);
  }
  const detail = await readRunDetail(control, input.projectId, executedRunId!, bounds, input.actionTypes ?? new Map());
  return outcomeFromDetail(executedRunId!, detail, await terminalReadsOf(control, { projectId: input.projectId, runId: executedRunId!, domainId }, detail, bounds), sessionStatus, input.actionTypes, input.candidateOrder);
}

type TerminalReads = { datasets: FlowRunDataset[]; harnessRecovery: RunHarnessRecovery };

/**
 * What is read once the detail is terminal: the run's datasets, then what its
 * recovery did. The recovery read comes second, so a run whose datasets cannot
 * be read fails exactly as it did before recovery was recorded.
 */
async function terminalReadsOf(
  control: PersistedFlowRunControl,
  scope: { projectId: string; runId: string; domainId: string },
  detail: Awaited<ReturnType<typeof readRunDetail>>,
  bounds: FluxIQHttpOptions,
): Promise<TerminalReads> {
  const datasets = await datasetsOf(control, scope, detail, bounds);
  const harnessRecovery = await readHarnessRecovery(control, { projectId: scope.projectId, runId: scope.runId }, detail.runDetail, bounds);
  return { datasets, harnessRecovery };
}

/**
 * The run's datasets, read once the detail is terminal. Reading them from the
 * detail's summaries keeps the two consistent: a dataset the run detail does
 * not list is one this run did not store, whoever else's rows are in the
 * project.
 */
async function datasetsOf(
  control: PersistedFlowRunControl,
  scope: { projectId: string; runId: string; domainId: string },
  detail: Awaited<ReturnType<typeof readRunDetail>>,
  bounds: FluxIQHttpOptions,
): Promise<FlowRunDataset[]> {
  return detail.datasets.length === 0 ? [] : await readRunDatasets(control, { ...scope, summaries: detail.datasets }, bounds);
}

function outcomeFromDetail(
  runId: string,
  detail: Awaited<ReturnType<typeof readRunDetail>>,
  { datasets, harnessRecovery }: TerminalReads,
  sessionStatus: string,
  actionTypes: ReadonlyMap<string, string> | undefined,
  candidateOrder: ReadonlyMap<string, number> | undefined,
): PersistedFlowRunOutcome {
  const actions = detail.actions;
  if (!actions.length) throw new RunnerFailure("action.dispatch", "The approved Flow produced no durable action attempt");
  const failure = actions.map((action) => action.failure).find((record): record is AutomationStudioFailureRecord => record !== null) ?? null;
  const status = runStatus(detail.summaryStatus ?? sessionStatus);
  const stop = stopWithoutFailedAttempt(status, actions, new Set(detail.attemptNodeIds), actionTypes);
  // The attempts are in Core's `order`, so the first one on a node the recording's order names is where the run started.
  const startNodeId = detail.attemptNodeIds.find((nodeId) => candidateOrder?.has(nodeId) === true);
  const startCandidateIndex = startNodeId === undefined ? undefined : candidateOrder?.get(startNodeId);
  return {
    runId,
    status,
    actions,
    failure,
    harnessActivations: detail.harnessActivations,
    harnessRecovery,
    extracted: datasets,
    extractedNonStringValues: datasets.reduce((sum, dataset) => sum + dataset.nonStringValues, 0),
    extractionDurationsByNode: detail.durationsByNode,
    ...(stop ? { stoppedWithoutFailedAttempt: stop } : {}),
    ...(startCandidateIndex === undefined ? {} : { startCandidateIndex }),
  };
}

async function awaitTerminalRunDetail(
  control: PersistedFlowRunControl,
  projectId: string,
  runId: string,
  actionTypes: ReadonlyMap<string, string>,
  originalFailure: unknown,
  wait: PersistedFlowTerminalWait,
): Promise<Awaited<ReturnType<typeof readRunDetail>>> {
  const now = wait.now ?? Date.now;
  const sleep = wait.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const timeoutMs = wait.timeoutMs ?? TERMINAL_DETAIL_WAIT_MS;
  const intervalMs = wait.intervalMs ?? TERMINAL_DETAIL_POLL_MS;
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const remaining = deadline - now();
    try {
      const detail = await readRunDetail(control, projectId, runId, { timeoutMs: Math.min(30_000, remaining) }, actionTypes);
      if (terminalRunStatus(detail.summaryStatus) && detail.actions.length > 0) return detail;
    } catch {
      // The original timeout/abort remains authoritative until exact terminal
      // evidence arrives; a diagnostic read must never replace it.
    }
    const delay = Math.min(intervalMs, Math.max(0, deadline - now()));
    if (delay > 0) await sleep(delay);
  }
  throw originalFailure;
}

function terminalRunStatus(status: string | undefined): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}

/**
 * `FlowStopWithoutFailedAttempt` for a failed run whose every attempt
 * succeeded, over the action nodes `actionTypes` names. An attempt in any other
 * status, `cancelled` or `unknown` included, is not a clean stop, so this
 * claims nothing for it.
 */
function stopWithoutFailedAttempt(
  status: PersistedFlowRunOutcome["status"],
  actions: readonly PersistedFlowAction[],
  attemptedNodeIds: ReadonlySet<string>,
  actionTypes: ReadonlyMap<string, string> | undefined,
): FlowStopWithoutFailedAttempt | undefined {
  if (status !== "failed" || !actionTypes?.size || !actions.every((action) => action.status === "succeeded")) return undefined;
  const actionNodeIds = [...actionTypes.keys()];
  const attemptedActions = actionNodeIds.filter((nodeId) => attemptedNodeIds.has(nodeId)).length;
  const unvisitedActions = actionNodeIds.length - attemptedActions;
  return unvisitedActions > 0 ? { attemptedActions, unvisitedActions } : undefined;
}

async function readRunDetail(
  control: PersistedFlowRunControl,
  projectId: string,
  runId: string,
  bounds: FluxIQHttpOptions,
  actionTypes: ReadonlyMap<string, string>,
): Promise<{ summaryStatus: string | undefined; actions: PersistedFlowAction[]; attemptNodeIds: readonly string[]; harnessActivations: number; datasets: RunDatasetSummary[]; durationsByNode: Map<string, number>; runDetail: Readonly<Record<string, unknown>> }> {
  const payload = asRecord(await control.automationStudioCall("get-flow-run-detail", { projectId, runId }, bounds), "run detail payload");
  const detail = asRecord(payload.runDetail, "runDetail");
  const summary = asRecord(detail.summary, "runDetail.summary");
  if (summary.runId !== runId) throw new RunnerFailure("runtime.behavior", "Core returned a run detail for a different run");
  const attempts = (Array.isArray(detail.actionAttempts) ? detail.actionAttempts : [])
    .map((value, index) => asRecord(value, `runDetail.actionAttempts[${index}]`))
    .sort((left, right) => numberOf(left.order) - numberOf(right.order));
  const interventions = Array.isArray(detail.interventions) ? detail.interventions : [];
  const actions = attempts.map((attempt) => flowAction(attempt, actionTypes));
  // In attempt order, one entry per attempt that names a node, so a retried node appears once per attempt.
  const attemptNodeIds = attempts.flatMap((attempt) => (typeof attempt.nodeId === "string" ? [attempt.nodeId] : []));
  return { summaryStatus: typeof summary.status === "string" ? summary.status : undefined, actions, attemptNodeIds, harnessActivations: interventions.length, datasets: runDatasetSummaries(detail), durationsByNode: attemptDurationsByNode(attempts), runDetail: detail };
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
  const nodeId = typeof attempt.nodeId === "string" ? attempt.nodeId : "";
  const recordCount = optionalRecord(attempt.metadata)?.recordCount;
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
    ...(isFiniteNumber(recordCount) ? { recordCount } : {}),
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

/**
 * Each node's attempts summed, from Core's raw attempts rather than from the
 * lane's actions: an action carries no node id, so that a node id cannot reach
 * a judgement, a failure's details, or the bundle. A `Map` keyed by node id is
 * how the id stays available to pair a dataset with its step and still leaves
 * nothing in what the lane serializes. An attempt with no finish time
 * contributes nothing, as it does to every other latency the lane reports.
 */
function attemptDurationsByNode(attempts: readonly Record<string, unknown>[]): Map<string, number> {
  const durations = new Map<string, number>();
  for (const attempt of attempts) {
    const nodeId = attempt.nodeId;
    const startedAt = numberOf(attempt.startedAt);
    const finishedAt = attempt.finishedAt;
    if (typeof nodeId !== "string" || !nodeId || typeof finishedAt !== "number" || !Number.isFinite(finishedAt)) continue;
    durations.set(nodeId, (durations.get(nodeId) ?? 0) + Math.max(0, Math.round(finishedAt - startedAt)));
  }
  return durations;
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
