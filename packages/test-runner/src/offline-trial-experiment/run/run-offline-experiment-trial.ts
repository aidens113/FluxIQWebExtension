// One offline trial of the gate experiment through Core's exported runner,
// `runAutomationStudioOfflineCandidateTrial` (trace plan P4c): a host over a
// fresh copy of the workspace (`./offline-trial/host.ts`), the trial ports a
// live build's whole-candidate trial gets (`./offline-trial/ports.ts`) with a
// judge that calls no model, the source trace read through the host's own
// trace store, and phase `test`. The candidate is run as the trial request
// Core's trial runner takes, exactly as a live trial is.
//
// What comes back is the runner's answer -- refused, or the trial's outcome,
// the U5 evidence result and the matcher's report -- plus the wall time, how
// often the judge was asked, the session view asked for and the one Core used,
// and the traces the run captured, read back after the host closed: an offline
// trial's own episode must be derived from its source (T24).
//
// `sessionView: "declared"` hands Core's runner the extension's declared view
// as its `sessionView` argument (`./declared-session-view.ts`), which Core uses
// only where the trace recorded none and reports as `supplied`; `none` hands it
// nothing, so a trace with no recorded view is refused.

import { runAutomationStudioOfflineCandidateTrial, type AutomationStudioFlowCandidate, type AutomationStudioOfflineCandidateTrialOutcome } from "fluxiq/automation-studio";
import { isClientGatewayTraceLive } from "fluxiq/client-gateway";
import path from "node:path";
import { readStoreTraceManifests } from "../store-trace-manifests.js";
import type { CoreTrialSeams } from "./core-trial-seams.js";
import { DECLARED_EXTENSION_SESSION_VIEW } from "./declared-session-view.js";
import { notJudgedJudge } from "./not-judged-judge.js";
import { offlineTrialPorts, openOfflineTrialHost } from "./offline-trial/index.js";

export type OfflineExperimentTrialInput = Readonly<{
  /** The fresh copy's workspace root (`./fresh-store-copy.ts`). */
  rootDir: string;
  projectId: string;
  flowId: string;
  startLocation: string;
  sourceInstructionIds: readonly string[];
  /** The live trial's trace the offline trial runs on. */
  sourceTraceId: string;
  /** The trial request's candidate: the candidate id, the revision and digest it is run under, and the whole candidate. */
  candidate: Readonly<{ candidateId: string; revision: number; digest: string; candidate: AutomationStudioFlowCandidate }>;
  seams: CoreTrialSeams;
  /** `declared`: the extension's declared view is supplied to the runner (`./declared-session-view.ts`); `none`: no view is supplied. */
  sessionView: OfflineExperimentSessionView;
}>;

/** Which session view the experiment supplies to Core's runner. */
export type OfflineExperimentSessionView = "declared" | "none";

export type CapturedTrace = Readonly<{ traceId: string; activity: string; episodeId: string; live: boolean; derivation: string | null; sourceTraceIds: readonly string[]; events: number }>;

export type OfflineExperimentTrialRun = Readonly<{
  outcome: AutomationStudioOfflineCandidateTrialOutcome;
  /** Milliseconds of wall time the runner took, host building and copying excluded. */
  wallMs: number;
  judgeAsked: number;
  /** The view the experiment supplied (`supplied`), and the one Core's runner used (`used`: `null` when it refused). */
  sessionView: Readonly<{ supplied: OfflineExperimentSessionView; used: "recorded" | "supplied" | null }>;
  /** Every trace in the copy that the source store did not hold before the run. */
  captured: readonly CapturedTrace[];
}>;

export async function runOfflineExperimentTrial(input: OfflineExperimentTrialInput): Promise<OfflineExperimentTrialRun> {
  const automationDataDir = path.join(input.rootDir, ".fluxiq", "artifacts", "automation-studio");
  const before = new Set((await readStoreTraceManifests({ automationDataDir, projectId: input.projectId })).map((trace) => trace.manifest.traceId));
  const host = openOfflineTrialHost({ rootDir: input.rootDir, seams: input.seams });
  const judge = notJudgedJudge();
  let outcome: AutomationStudioOfflineCandidateTrialOutcome;
  let wallMs: number;
  try {
    const ports = await offlineTrialPorts({
      service: host.service, seams: input.seams, projectId: input.projectId, flowId: input.flowId,
      sourceInstructionIds: input.sourceInstructionIds, startLocation: input.startLocation, judge: judge.judge,
    });
    const started = performance.now();
    outcome = await runAutomationStudioOfflineCandidateTrial({
      request: { candidateId: input.candidate.candidateId, revision: input.candidate.revision, digest: input.candidate.digest, signal: new AbortController().signal, candidate: structuredClone(input.candidate.candidate) },
      ports,
      source: { store: host.traceStore(input.projectId), traceId: input.sourceTraceId },
      gateway: host.gateway,
      phase: "test",
      ...(input.sessionView === "declared" ? { sessionView: structuredClone(DECLARED_EXTENSION_SESSION_VIEW) } : {}),
    });
    wallMs = Math.round(performance.now() - started);
  } finally {
    await host.close();
  }
  const captured = (await readStoreTraceManifests({ automationDataDir, projectId: input.projectId }))
    .filter((trace) => !before.has(trace.manifest.traceId))
    .map(({ manifest, events }): CapturedTrace => Object.freeze({
      traceId: manifest.traceId, activity: manifest.activity, episodeId: manifest.episodeId, live: isClientGatewayTraceLive(manifest),
      derivation: manifest.origin.kind === "derived" ? manifest.origin.derivation : null,
      sourceTraceIds: manifest.origin.kind === "derived" ? [...manifest.origin.sourceTraceIds] : [],
      events,
    }));
  return Object.freeze({ outcome, wallMs, judgeAsked: judge.asked(), sessionView: Object.freeze({ supplied: input.sessionView, used: outcome.status === "ran" ? outcome.sessionView : null }), captured: Object.freeze(captured) });
}
