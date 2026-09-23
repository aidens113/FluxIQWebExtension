import { randomUUID } from "node:crypto";
import { parseAutomationStudioFailureRecord, type AutomationStudioFailureRecord, type RunActionTiming, type RunHarnessRecovery } from "@fluxiq-web-extension/test-contracts";
import { AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_RUN_MS } from "fluxiq/automation-studio";
import type { AutomationNodeTargetResolution } from "fluxiq/automation-studio/nodes";
import { RunnerFailure } from "../failure.js";
import { attemptNodeId, hostTargetResolutionOf, readinessOf, retryOf, type PersistedFlowActionReadiness, type PersistedFlowActionRetry, type PersistedHostTargetResolution } from "./persisted-attempt.js";
import { FLUXIQ_HTTP_MAX_TIMEOUT_MS, isBoundedHttpFailure, type FluxIQHttpOptions } from "../http-control/index.js";
import { runActionStatus } from "../run-manifest/index.js";
import { readHarnessRecovery, type HarnessRecoveryControl } from "./harness-recovery.js";
import { LAB_PROJECT_DOMAIN_ID } from "./lab-project-domain.js";
import { readRunDatasets, runDatasetSummaries, type FlowRunDataset, type RunDatasetSummary } from "./run-datasets.js";
import { readFlowRunRoute, type FlowRunRoute } from "./taken-route.js";

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

/**
 * How long a granted run is read back for after its request timed out: Core's
 * own lease on a claimed grant, the backstop Core uses to end a granted run
 * that never said it had finished. It is the only whole-run deadline Core
 * defines, so it is the run's own deadline rather than a guess at one. The poll
 * ends as soon as the run settles; this bounds only a run that never does.
 *
 * Why a granted run needs more than the 90 seconds above: since t012, a created
 * Flow's playback carries a `verify_result` grant, so the single request that
 * runs it also waits for the model to judge the result. On 2026-09-18 that
 * outlasted the 30-second request bound in four units, and because the run's id
 * arrived only in the reply, nothing could be read back and every one of them
 * failed as `environment.missing`.
 */
const GRANTED_RUN_WAIT_MS = AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_RUN_MS;
const GRANTED_RUN_POLL_MS = 1_000;

/**
 * The HTTP bound on the one request that runs a granted Flow.
 *
 * Core answers that request only once the run, its recovery and its verdict
 * are all written, and a recovery that diagnoses and explores takes longer
 * than the control client's 30-second default. Under that default the request
 * ended mid-recovery, the read-back took the first `failed` it saw for the
 * finished run, and the Lab tore Core down while it was still recovering:
 * every `--flow` repair run on 2026-09-21 reported no provider call and no
 * recovery at all (`run-mubnt40m-21b3b65f`, `run-mubosmk0-57653b21`). So the
 * request is held for the grant's own run lease, as far as the control client
 * allows one request to be held, and the read-back covers the rest.
 */
const GRANTED_RUN_REQUEST_MS = Math.min(GRANTED_RUN_WAIT_MS, FLUXIQ_HTTP_MAX_TIMEOUT_MS);

/**
 * The closed code for a granted run Core was still finishing when the wait
 * for it ran out. It is the facility's finding -- the run never settled
 * inside its own deadline -- and never the run's failure, which Core had not
 * finished deciding.
 */
const GRANTED_RUN_UNSETTLED_CODE = "flow_lane.granted_run_unsettled";

export type PersistedFlowTerminalWait = {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  intervalMs?: number;
  /**
   * Whether a `succeeded` run is only finished once Core has recorded the
   * verdict on its result. True for a granted run: Core publishes the status
   * its steps earned first and judges the result afterwards, so a read in
   * between sees a pass the verdict may still overturn.
   */
  awaitVerdict?: boolean;
  /**
   * Whether a `failed` run is only finished once Core's recovery has recorded
   * how it ended. True for a granted run whose grant recovers. Core writes the
   * failed status with the run's first save, before the recovery starts, and
   * the recovery's record -- `metadata.llmGate` and `metadata.recoveryTrace`,
   * which every way out of Core's recovery writes -- only with its last. The
   * recovery ladder's diagnosis placeholder is in the first save too, so an
   * intervention alone says nothing about whether the recovery finished.
   */
  awaitRecovery?: boolean;
};

/** The Core calls a Flow run makes; `ExistingFluxIQControlClient` satisfies it. */
/**
 * The execution grant a live provider run carries. Core refuses such a run any
 * of the flags a deterministic run uses -- a pre-started run id, an authorized
 * domain, an idempotency key -- so a run holding one takes a different path
 * through `executeRecordedFlowRun` rather than adding a flag to the usual one.
 *
 * `verify_result` is the purpose a run carries when the model is to judge its
 * result and nothing else: Core runs it with `invokeLlm` off, so the run stays
 * deterministic and the grant buys exactly the one call that asks whether what
 * came back answers what was asked. Giving up the three flags costs such a run
 * nothing that it used: the authorized domain gates only cross-scope Flow
 * calls, and the pre-started run id and idempotency key exist for a two-step
 * start the grant path does not take.
 */
export type PersistedFlowLlmExecution = { grantId: string; purpose: "diagnosis_only" | "diagnose_and_adapt" | "explore_and_adapt" | "verify_result" };

export type PersistedFlowRunControl = HarnessRecoveryControl & {
  selectExistingContext(projectId: string, clientId?: string, bounds?: FluxIQHttpOptions, flowId?: string): Promise<void>;
  startPersistedFlow(input: { projectId: string; flowId: string; inputs?: Record<string, unknown>; authorizedDomainIds?: string[] } & FluxIQHttpOptions): Promise<{ runId: string }>;
  runPersistedFlow(input: { projectId: string; flowId: string; runId?: string; inputs?: Record<string, unknown>; authorizedDomainIds?: string[]; idempotencyKey?: string; llmExecution?: PersistedFlowLlmExecution } & FluxIQHttpOptions): Promise<{ session: { runId: string; status: string } }>;
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: FluxIQHttpOptions, domainId?: string): Promise<unknown>;
};

/** One action attempt, carrying Core's own structured failure rather than a message. */
export type PersistedFlowAction = {
  actionType: string;
  /**
   * The Flow node this attempt ran, as Core names it, or `null` when Core
   * named none.
   *
   * It was deliberately left out until the recovery ladder existed: an action
   * carried no node id so that one could never reach a judgement, a failure's
   * details or the bundle. What changed is that a node is now attempted more
   * than once. Without the id, a node the ladder retried twice and a Flow that
   * authored the same action twice produce exactly the same list of actions,
   * so no rung can be attributed to anything and the whole measurement is
   * unreadable. The id is a Core-generated node identifier and is admitted
   * only when it has that shape (`NODE_ID`), so a value carrying page text is
   * treated as absent rather than published.
   */
  nodeId: string | null;
  /** This attempt's position in Core's attempt order for the run, from 0. */
  attemptIndex: number;
  status: RunActionTiming["status"];
  startedAt: string;
  durationMs?: number;
  /**
   * Which attempt of this node this is and which ladder rung asked for it,
   * from Core's `metadata.retry`. Present from the second attempt onwards, so
   * its absence says the Flow, not the ladder, put this node on the page.
   */
  retry?: PersistedFlowActionRetry;
  /**
   * What the run did about the state the node expected to find before it ran
   * (Core's `metadata.readiness`). `satisfied: false` is a mark, not a
   * failure: the recording is evidence the action was possible, so the node is
   * attempted at the deadline anyway.
   */
  readiness?: PersistedFlowActionReadiness;
  /**
   * How the *browser* found the element once the command arrived, from Core's
   * `metadata.hostTargetResolution`. This is the other target resolution, and
   * the two answer different questions: `targetResolution` below is Core's
   * pre-dispatch choice of candidate, and this is what the host actually did.
   *
   * It is the only evidence of the recovery that has no ladder rung. The
   * executor deliberately implements no re-resolve-the-target rung, because
   * the host has already re-resolved before Core is told anything failed, so a
   * `strategy` of `fingerprint` or `scored-candidate` on a **succeeded**
   * attempt is the record that a renamed control was recovered from.
   */
  hostTargetResolution?: PersistedHostTargetResolution;
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

/**
 * Where Core left the run's result: its own `resultVerification.status`
 * (`runtime/result-verification/verification-status.ts`).
 *
 * `confirmed` and `refuted` are judgements. `unverified` is the one that had
 * to become visible: there was a result, and nobody judged it, because the run
 * reached no model. Core leaves such a run's status as its steps earned it --
 * failing every deterministic replay for the absence of a judgement would
 * break working automations -- so the word is the only thing that separates a
 * result that was checked from one that merely did not fail. `no_result` is a
 * run that stored no record set and therefore had nothing to judge.
 *
 * `null` where Core recorded no verification at all, which is a different fact
 * again: not "nobody judged it" but "nothing says whether anyone did".
 */
export type PersistedResultVerification = "confirmed" | "refuted" | "unverified" | "no_result" | null;

export type PersistedFlowRunOutcome = {
  runId: string;
  status: "succeeded" | "failed" | "cancelled" | "unknown";
  actions: PersistedFlowAction[];
  /** Core's own account of whether the result was judged, and how it came out. */
  resultVerification: PersistedResultVerification;
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
  /** Which route the run's Router took and each rule's reason; `null` for a run no Router decided. */
  route: FlowRunRoute | null;
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
  // Every run's id is known before it executes, so a request cut short can
  // still be read back. A deterministic run is started first and runs under
  // that session. A live provider run must create its own session -- Core
  // revokes the grant and refuses the run when it is handed a session it did
  // not create, an authorized domain, or an idempotency key -- so it names the
  // session it is about to create instead (Core
  // `runtime/service/runtime-session/requested-run-id.ts`).
  const started = input.llmExecution ? undefined : await control.startPersistedFlow({ projectId: input.projectId, flowId: input.flowId, inputs, authorizedDomainIds: [domainId], ...bounds });
  const runId = input.llmExecution ? randomUUID() : started?.runId;
  if (!runId) throw new RunnerFailure("runtime.behavior", "Core did not return a run id for the approved Flow");
  input.onRunIdentified?.(runId);
  let sessionStatus = "unknown";
  const settlement = grantedSettlement(input.llmExecution);
  try {
    const session = input.llmExecution
      ? await runGrantedFlow(control, { projectId: input.projectId, flowId: input.flowId, inputs, llmExecution: input.llmExecution, newRunId: runId }, { ...bounds, timeoutMs: bounds.timeoutMs ?? GRANTED_RUN_REQUEST_MS })
      : (await control.runPersistedFlow({ projectId: input.projectId, flowId: input.flowId, runId, inputs, authorizedDomainIds: [domainId], idempotencyKey: `fluxiq-lab:${input.facilityRunId}:${randomUUID()}`, ...bounds })).session;
    sessionStatus = session.status;
    if (session.runId !== runId) throw new RunnerFailure("runtime.behavior", "Core ran a different run than the one it was asked to");
  } catch (error) {
    // Only a bounded request can have left Core executing after the client went
    // away. An arbitrary runner failure is not evidence that a run completed.
    if (!isBoundedHttpFailure(error)) throw error;
    // A granted run that outlasted its request is read back for as long as
    // Core would let it keep running, and is finished only once its result's
    // verdict, and a failed run's recovery, are recorded. A caller's own abort
    // keeps the short window: it is somebody stopping the run, not the run
    // taking long.
    const granted = input.llmExecution !== undefined;
    const timedOut = granted && error instanceof RunnerFailure && error.details?.bounded === "timeout";
    const wait: PersistedFlowTerminalWait = { ...(timedOut ? { timeoutMs: GRANTED_RUN_WAIT_MS, intervalMs: GRANTED_RUN_POLL_MS } : {}), ...settlement, ...terminalWait };
    const detail = await awaitTerminalRunDetail(control, input.projectId, runId, input.actionTypes ?? new Map(), error, wait);
    return outcomeFromDetail(runId, detail, await terminalReadsOf(control, { projectId: input.projectId, runId, domainId }, detail, bounds), sessionStatus, input.actionTypes, input.candidateOrder);
  }
  let detail = await readRunDetail(control, input.projectId, runId, bounds, input.actionTypes ?? new Map());
  // Core answers a granted run only once it is written whole, recovery
  // included, so this should already be the finished run. Should a failed run
  // come back without its recovery record, it is read until the record is in,
  // rather than taken as finished while Core is still repairing it.
  if (input.llmExecution && pendingWork(detail, { awaitRecovery: settlement.awaitRecovery === true }) === "recovery") {
    const early = new RunnerFailure("runtime.behavior", "Core answered the granted run before its detail was terminal");
    detail = await awaitTerminalRunDetail(control, input.projectId, runId, input.actionTypes ?? new Map(), early, { timeoutMs: GRANTED_RUN_WAIT_MS, intervalMs: GRANTED_RUN_POLL_MS, ...settlement, ...terminalWait });
  }
  return outcomeFromDetail(runId, detail, await terminalReadsOf(control, { projectId: input.projectId, runId, domainId }, detail, bounds), sessionStatus, input.actionTypes, input.candidateOrder);
}

/**
 * Runs a Flow under an LLM grant, as a new session with the id the caller chose.
 *
 * This goes through `automationStudioCall` rather than the control client's
 * `runPersistedFlow` only because that client builds its payload from a fixed
 * list of fields and `existing-fluxiq-control.ts` belongs to another unit of
 * work while this one is open. The payload is the one that method sends for a
 * granted run, plus `newRunId`; once that file is free, `newRunId` belongs in
 * its `runPersistedFlow` and this function should go.
 */
async function runGrantedFlow(
  control: PersistedFlowRunControl,
  input: { projectId: string; flowId: string; inputs: Record<string, unknown>; llmExecution: PersistedFlowLlmExecution; newRunId: string },
  bounds: FluxIQHttpOptions,
): Promise<{ runId: string; status: string }> {
  const payload = asRecord(await control.automationStudioCall("run-runtime-session", {
    projectId: input.projectId, flowId: input.flowId, newRunId: input.newRunId, inputs: input.inputs,
    adaptiveMode: "manual_approval", authorizedExternalSideEffects: false,
    runIntent: input.llmExecution.purpose, llmExecutionGrantId: input.llmExecution.grantId,
  }, bounds), "run runtime payload");
  const session = asRecord(payload.runtimeSession, "runtimeSession");
  if (typeof session.runId !== "string" || typeof session.status !== "string") throw new RunnerFailure("runtime.behavior", "FluxIQ returned a runtime session without a run id or a status");
  if (session.flowId !== input.flowId) throw new RunnerFailure("runtime.behavior", "FluxIQ ran a different Flow than the one requested");
  return { runId: session.runId, status: session.status };
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
    resultVerification: detail.resultVerification,
    failure,
    harnessActivations: detail.harnessActivations,
    harnessRecovery,
    extracted: datasets,
    extractedNonStringValues: datasets.reduce((sum, dataset) => sum + dataset.nonStringValues, 0),
    extractionDurationsByNode: detail.durationsByNode,
    route: readFlowRunRoute(detail.runDetail),
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
  // What Core was still doing at the last terminal read, if anything: the
  // difference between a run that never finished and one Core was finishing.
  let pending: PendingWork | undefined;
  while (now() < deadline) {
    const remaining = deadline - now();
    try {
      const detail = await readRunDetail(control, projectId, runId, { timeoutMs: Math.min(30_000, remaining) }, actionTypes);
      if (terminalRunStatus(detail.summaryStatus) && detail.actions.length > 0) {
        pending = pendingWork(detail, wait);
        if (!pending) return detail;
      }
    } catch {
      // The original timeout/abort remains authoritative until exact terminal
      // evidence arrives; a diagnostic read must never replace it.
    }
    const delay = Math.min(intervalMs, Math.max(0, deadline - now()));
    if (delay > 0) await sleep(delay);
  }
  if (pending) {
    throw new RunnerFailure("performance.budget", `Core was still finishing the granted run's ${pending} when the wait for it ran out`, { details: { code: GRANTED_RUN_UNSETTLED_CODE, pending, waitedMs: timeoutMs } });
  }
  throw originalFailure;
}

/**
 * What a granted run is waited for. Every granted run's pass waits for its
 * verdict. A grant that recovers -- every purpose but `verify_result`, which
 * buys the verdict alone -- also waits for its recovery, so a failed run is not
 * read as finished, and Core is not torn down, while Core is still repairing it.
 */
function grantedSettlement(execution: PersistedFlowLlmExecution | undefined): Pick<PersistedFlowTerminalWait, "awaitVerdict" | "awaitRecovery"> {
  if (!execution) return {};
  return { awaitVerdict: true, awaitRecovery: execution.purpose !== "verify_result" };
}

function terminalRunStatus(status: string | undefined): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}

type PendingWork = "verdict" | "recovery";

/**
 * What Core still has to write about a terminal run, or `undefined` when it
 * has written everything the wait asked for.
 *
 * The verdict: Core writes a finished run's status as its steps earned it,
 * then judges the result and may rewrite a `succeeded` to `failed`; the
 * verdict and the final status are saved together (Core
 * `result-verification/run-outcome.ts`). So a `succeeded` run with no verdict
 * recorded yet is not finished, and one read at that moment would report a
 * pass the verdict was about to take away. A run that failed is never judged.
 *
 * The recovery: a `failed` run is saved as soon as its steps fail, and Core's
 * recovery then diagnoses, explores and repairs it before writing its record.
 * Until that record is in, the run is not finished either (`awaitRecovery`).
 */
function pendingWork(
  detail: { summaryStatus: string | undefined; resultVerification: PersistedResultVerification; runDetail: Readonly<Record<string, unknown>> },
  wait: Pick<PersistedFlowTerminalWait, "awaitVerdict" | "awaitRecovery">,
): PendingWork | undefined {
  if (wait.awaitVerdict && detail.summaryStatus === "succeeded" && detail.resultVerification === null) return "verdict";
  if (wait.awaitRecovery && detail.summaryStatus === "failed" && !recoveryRecordWritten(detail.runDetail)) return "recovery";
  return undefined;
}

/** Whether Core's recovery wrote its record: the gate that decided it, or the trace of its stages. */
function recoveryRecordWritten(runDetail: Readonly<Record<string, unknown>>): boolean {
  const metadata = optionalRecord(runDetail.metadata);
  return optionalRecord(metadata?.llmGate) !== undefined || optionalRecord(metadata?.recoveryTrace) !== undefined;
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
): Promise<{ summaryStatus: string | undefined; actions: PersistedFlowAction[]; attemptNodeIds: readonly string[]; harnessActivations: number; datasets: RunDatasetSummary[]; durationsByNode: Map<string, number>; resultVerification: PersistedResultVerification; runDetail: Readonly<Record<string, unknown>> }> {
  const payload = asRecord(await control.automationStudioCall("get-flow-run-detail", { projectId, runId }, bounds), "run detail payload");
  const detail = asRecord(payload.runDetail, "runDetail");
  const summary = asRecord(detail.summary, "runDetail.summary");
  if (summary.runId !== runId) throw new RunnerFailure("runtime.behavior", "Core returned a run detail for a different run");
  const attempts = (Array.isArray(detail.actionAttempts) ? detail.actionAttempts : [])
    .map((value, index) => asRecord(value, `runDetail.actionAttempts[${index}]`))
    .sort((left, right) => numberOf(left.order) - numberOf(right.order));
  const interventions = Array.isArray(detail.interventions) ? detail.interventions : [];
  const actions = attempts.map((attempt, index) => flowAction(attempt, actionTypes, index));
  // In attempt order, one entry per attempt that names a node, so a retried node appears once per attempt.
  const attemptNodeIds = attempts.flatMap((attempt) => (typeof attempt.nodeId === "string" ? [attempt.nodeId] : []));
  return { summaryStatus: typeof summary.status === "string" ? summary.status : undefined, actions, attemptNodeIds, harnessActivations: interventions.length, datasets: runDatasetSummaries(detail), durationsByNode: attemptDurationsByNode(attempts), resultVerification: resultVerificationOf(detail), runDetail: detail };
}

/**
 * Core's `metadata.resultVerification.status`, or `null` when the run detail
 * carries none.
 *
 * Only the four words Core writes are read. An unknown one is `null` rather
 * than passed through, because this value decides whether a run reads as
 * confirmed, and a word this runner does not understand is not a confirmation.
 */
function resultVerificationOf(detail: Record<string, unknown>): PersistedResultVerification {
  const metadata = detail.metadata;
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return null;
  const verification = (metadata as Record<string, unknown>).resultVerification;
  if (typeof verification !== "object" || verification === null || Array.isArray(verification)) return null;
  const status = (verification as Record<string, unknown>).status;
  return status === "confirmed" || status === "refuted" || status === "unverified" || status === "no_result" ? status : null;
}

/**
 * Every recorded action runs through the same `builtin.policy.action` node
 * definition, so `definitionId` cannot identify one; the node id resolved
 * through the Flow's own nodes can. The definition id remains the fallback,
 * which is what a node outside the recorded set reports.
 */
function flowAction(attempt: Record<string, unknown>, actionTypes: ReadonlyMap<string, string>, attemptIndex: number): PersistedFlowAction {
  const startedAt = numberOf(attempt.startedAt);
  const finishedAt = typeof attempt.finishedAt === "number" && Number.isFinite(attempt.finishedAt) ? attempt.finishedAt : undefined;
  const nodeId = typeof attempt.nodeId === "string" ? attempt.nodeId : "";
  const recordCount = optionalRecord(attempt.metadata)?.recordCount;
  const targetResolution = targetResolutionOf(attempt);
  const hostTargetResolution = hostTargetResolutionOf(attempt);
  const retry = retryOf(attempt);
  const readiness = readinessOf(attempt);
  const evidencePackets = evidencePacketsOf(attempt);
  const comparisonStatus = comparisonStatusOf(attempt);
  return {
    actionType: actionTypes.get(nodeId) ?? (typeof attempt.definitionId === "string" ? attempt.definitionId : "unknown"),
    nodeId: attemptNodeId(nodeId),
    attemptIndex,
    status: runActionStatus(attempt.status),
    startedAt: new Date(startedAt).toISOString(),
    ...(finishedAt === undefined ? {} : { durationMs: Math.max(0, Math.round(finishedAt - startedAt)) }),
    // Core's own record, parsed by Core's parser. A record Core would reject is treated as absent.
    failure: parseAutomationStudioFailureRecord(attempt.failure) ?? null,
    ...(isFiniteNumber(recordCount) ? { recordCount } : {}),
    ...(comparisonStatus ? { comparisonStatus } : {}),
    ...(retry ? { retry } : {}),
    ...(readiness ? { readiness } : {}),
    ...(targetResolution ? { targetResolution } : {}),
    ...(hostTargetResolution ? { hostTargetResolution } : {}),
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
 * lane's actions. It predates the action's own `nodeId` and is kept because it
 * answers a different question: this is the node's *total* time across every
 * attempt the ladder made, which is what a dataset's step is paired with,
 * while the action carries one attempt's own duration. An attempt with no
 * finish time contributes nothing, as it does to every other latency the lane
 * reports.
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
