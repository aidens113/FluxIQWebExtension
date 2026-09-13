// Waiting on the control client until the runtime has caught up: a new
// recording, a named Flow or Subflow, a routed run, and a connected session.
import { type ExistingFlowSummary, ExistingFluxIQControlClient } from "../existing-fluxiq-control.js";
import { RunnerFailure } from "../failure.js";
import { awaitFinalizedRecording, type FinalizedRecordingControl, type FinalizedRecordingWait } from "../flow-lane/index.js";
import type { DemoWorkspaceState } from "./workspace-state.js";

/**
 * How long the demo waits, from the extension reporting idle, for Core to list
 * the new recording and stamp its `endedAt`. Under load Core stores a demo
 * recording's entries one append at a time, 0.5 to 1 s each, and was still
 * storing entries made before Stop 20 s after Stop (`i-demo-recording-finalize`).
 * The Flow lane's 30 s is not shown to cover that; 90 s is. A finalized
 * recording returns as soon as Core says so, so the bound costs only a failure.
 */
const DEMO_RECORDING_FINALIZE_TIMEOUT_MS = 90_000;
const DEMO_RECORDING_POLL_INTERVAL_MS = 200;

export function isTerminalRuntimeStatus(status: string): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}

export async function waitForRoutedRunDetail(control: ExistingFluxIQControlClient, state: DemoWorkspaceState, runId: string, expectedActionCount: number) {
  const deadline = Date.now() + 10_000;
  let detail = await control.getRunDetail(state.projectId, runId);
  while (Date.now() < deadline && (detail.routeDecisions.length < 1 || detail.subflows.length < 1 || detail.actionAttempts.length < expectedActionCount)) {
    await new Promise(resolve => setTimeout(resolve, 100));
    detail = await control.getRunDetail(state.projectId, runId);
  }
  const decision = detail.routeDecisions.find(item => item.routerId === state.routerId && item.selectedSubflowId === state.subflowId);
  if (!decision) throw new RunnerFailure("runtime.behavior", "Panel-started run did not persist a Router decision for the expected Subflow");
  const entry = detail.subflows.find(item => item.subflowId === state.subflowId && item.graphFlowId === state.graphFlowId && item.routeDecisionId === decision.decisionId);
  if (!entry) throw new RunnerFailure("runtime.behavior", "Panel-started run did not persist the expected Subflow graph entry");
  if (detail.summary.routeDecisionCount !== detail.routeDecisions.length || detail.summary.subflowEntryCount !== detail.subflows.length || detail.summary.actionAttemptCount !== detail.actionAttempts.length) {
    throw new RunnerFailure("runtime.behavior", "Panel-started run summary counts do not match its durable runtime detail");
  }
  return detail;
}

/**
 * Returns the one recording absent from `baseline`, once Core has finalized it.
 * A recording Core is still writing is never handed on: whatever reads it next
 * would see a short timeline. `wait` injects the bound and clock for tests.
 */
export async function waitForNewRecording(control: FinalizedRecordingControl, projectId: string, baseline: Set<string>, wait: FinalizedRecordingWait = {}): Promise<string> {
  const now = wait.now ?? (() => Date.now());
  const sleep = wait.sleep ?? ((ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); }));
  const timeoutMs = wait.timeoutMs ?? DEMO_RECORDING_FINALIZE_TIMEOUT_MS;
  const intervalMs = wait.intervalMs ?? DEMO_RECORDING_POLL_INTERVAL_MS;
  const startedAt = now();
  const deadline = startedAt + timeoutMs;
  let created = await newRecordingIds(control, projectId, baseline);
  while (created.length === 0) {
    if (now() >= deadline) {
      throw new RunnerFailure("recording.persistence", `FluxIQ did not persist a new demo recording within ${timeoutMs} ms (DEMO_RECORDING_FINALIZE_TIMEOUT_MS)`, { details: { timeoutMs, waitedMs: now() - startedAt } });
    }
    await sleep(intervalMs);
    created = await newRecordingIds(control, projectId, baseline);
  }
  const [recordingId] = created;
  if (created.length > 1 || recordingId === undefined) throw new RunnerFailure("recording.persistence", "Recording operation created more than one recording");
  try {
    // At least one interval, so a recording found at the deadline still gets its confirming read.
    await awaitFinalizedRecording(control, { projectId, recordingId }, {}, { now, sleep, intervalMs, timeoutMs: Math.max(deadline - now(), intervalMs) });
  } catch (error) {
    if (!(error instanceof RunnerFailure) || error.category !== "recording.persistence") throw error;
    throw unfinalizedRecordingFailure(recordingId, error, timeoutMs, now() - startedAt);
  }
  const after = await newRecordingIds(control, projectId, baseline);
  if (after.length !== 1 || after[0] !== recordingId) {
    throw new RunnerFailure("recording.persistence", `Demo recording ${recordingId} finalized, but Core then listed ${after.length} new recordings instead of exactly that one`);
  }
  return recordingId;
}

/** Core's cheap summary list; the full form hydrates every entry on each poll, adding the load being waited out. */
async function newRecordingIds(control: FinalizedRecordingControl, projectId: string, baseline: Set<string>): Promise<string[]> {
  const listed = await control.automationStudioCall("list-recordings", { projectId, summaries: true });
  return recordingItems({ payload: listed }).map(item => item.recordingId).filter(id => !baseline.has(id));
}

/** Ids, counts and times only: the recording's page data never reaches the message. */
function unfinalizedRecordingFailure(recordingId: string, cause: RunnerFailure, timeoutMs: number, waitedMs: number): RunnerFailure {
  const details = cause.details ?? {};
  const entryCount = typeof details.entryCount === "number" ? details.entryCount : "unknown";
  const state = details.recordingSeen === false ? "Core stopped listing it" : details.endedAt === null ? "Core was still writing it" : "its timeline kept growing after endedAt";
  return new RunnerFailure(
    "recording.persistence",
    `FluxIQ persisted demo recording ${recordingId} but did not finalize it within ${timeoutMs} ms (DEMO_RECORDING_FINALIZE_TIMEOUT_MS): ${state}; last observed entry count ${entryCount}`,
    { cause, details: { ...details, recordingId, bound: "DEMO_RECORDING_FINALIZE_TIMEOUT_MS", timeoutMs, waitedMs } },
  );
}

export async function waitForNamedFlow(control: ExistingFluxIQControlClient, projectId: string, flowName: string): Promise<ExistingFlowSummary> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const created = (await control.listFlowSummaries(projectId)).filter(item => item.name === flowName);
    if (created.length === 1) return created[0]!;
    if (created.length > 1) throw new RunnerFailure("environment.missing", "Panel Flow creation produced more than one matching demo Flow");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new RunnerFailure("environment.missing", "Panel Flow creation did not persist the demo Flow");
}

export async function waitForNamedSubflow(control: ExistingFluxIQControlClient, projectId: string, flowId: string, subflowName: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const created = (await control.listFlowSubflows(projectId, flowId)).filter(item => item.name === subflowName);
    if (created.length === 1) return created[0]!;
    if (created.length > 1) throw new RunnerFailure("environment.missing", "Panel Subflow creation produced more than one matching demo Subflow");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new RunnerFailure("environment.missing", "Panel Subflow creation did not persist the demo Subflow");
}

/** Identity only: whether a recording is finished is `awaitFinalizedRecording`'s question, read from Core's `endedAt`. */
export type RecordingListItem = { recordingId: string };

export function recordingItems(response: any): RecordingListItem[] {
  const values = response?.payload?.recordings ?? response?.payload?.items ?? response?.payload;
  return Array.isArray(values)
    ? values.flatMap((item: any) => {
      const recordingId = item?.recordingId ?? item?.id;
      return typeof recordingId === "string" ? [{ recordingId }] : [];
    })
    : [];
}

export function recordingIds(response: any): Set<string> {
  return new Set(recordingItems(response).map(item => item.recordingId));
}

export async function assertConnectedSession(control: ExistingFluxIQControlClient, sessionId: unknown): Promise<void> {
  const response = await control.gatewaySnapshot() as any;
  const sessions = response?.payload?.sessions;
  if (
    typeof sessionId !== "string"
    || !Array.isArray(sessions)
    || !sessions.some((item: any) => item.sessionId === sessionId && ["connected", "ready"].includes(item.status))
  ) {
    throw new RunnerFailure("gateway.connection", "FluxIQ gateway did not retain the demo extension session");
  }
}
