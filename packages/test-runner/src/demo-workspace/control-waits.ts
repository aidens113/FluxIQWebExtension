// Waiting on the control client until the runtime has caught up: a new
// recording, a named Flow or Subflow, a routed run, and a connected session.
import { type ExistingFlowSummary, ExistingFluxIQControlClient } from "../existing-fluxiq-control.js";
import { RunnerFailure } from "../failure.js";
import type { DemoWorkspaceState } from "./workspace-state.js";

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

export async function waitForNewRecording(control: ExistingFluxIQControlClient, projectId: string, baseline: Set<string>): Promise<string> {
  const deadline = Date.now() + 10_000;
  let pendingRecordingId: string | undefined;
  while (Date.now() < deadline) {
    const created = recordingItems(await control.listRecordings(projectId)).filter(item => !baseline.has(item.recordingId));
    if (created.length > 1) throw new RunnerFailure("recording.persistence", "Recording operation created more than one recording");
    if (created.length === 1) {
      pendingRecordingId = created[0]!.recordingId;
      if (created[0]!.status === "completed" || created[0]!.endedAt !== undefined) return pendingRecordingId;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (pendingRecordingId) throw new RunnerFailure("recording.persistence", `FluxIQ persisted demo recording ${pendingRecordingId} but did not finalize it`);
  throw new RunnerFailure("recording.persistence", "FluxIQ did not persist a new demo recording");
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

export type RecordingListItem = { recordingId: string; status?: string; endedAt?: unknown };

export function recordingItems(response: any): RecordingListItem[] {
  const values = response?.payload?.recordings ?? response?.payload?.items ?? response?.payload;
  return Array.isArray(values)
    ? values.flatMap((item: any) => {
      const recordingId = item?.recordingId ?? item?.id;
      if (typeof recordingId !== "string") return [];
      return [{ recordingId, ...(typeof item?.status === "string" ? { status: item.status } : {}), ...(item?.endedAt !== undefined && item?.endedAt !== null ? { endedAt: item.endedAt } : {}) }];
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
