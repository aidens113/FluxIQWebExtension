// One offline trial of the gate experiment, run and measured: the prepared
// request (`../offline-trial-request.ts`) run through Core's offline runner on
// a fresh copy (`./run-offline-experiment-trial.ts`), then compared with the
// live trials it relates to and judged by the task's own oracle:
//
// - the source trial (the live trial whose trace it ran on) and, where one
//   ran, the live twin (the live trial of the same candidate): the judge's
//   view of each (`./trial-observation.ts`) and its stored rows record by
//   record (`./stored-rows-comparison.ts`), all read from the same copy;
// - the oracle's verdict on the offline trial's stored rows
//   (`../oracle/oracle-verdict.ts`), with the candidate's read count from its
//   script.
//
// With a reevaluator (tier 2) Core's matcher may answer a changed read from the
// trace's recorded page snapshot; the report lists those operations.
//
// The request's revision is the recorded whole revision where the candidate
// is a recorded one; a hand correction has none and runs under the source
// trial's whole revision with its own digest.

import type { ClientGatewayTraceReevaluator } from "fluxiq/client-gateway";
import path from "node:path";
import type { ExperimentSession } from "../experiment-session.js";
import type { OfflineTrialRequest } from "../offline-trial-request.js";
import { judgeTrialDatasets, readTrialDatasets } from "../oracle/index.js";
import { scriptExtractNodes } from "../rebuild/index.js";
import type { OracleVerdict, TracedRevision } from "../types.js";
import { readLiveTrialFeedback } from "./live-trial-feedback.js";
import { offlineTrialReport, type OfflineTrialReport } from "./offline-trial/index.js";
import { runOfflineExperimentTrial, type CapturedTrace, type OfflineExperimentSessionView, type OfflineExperimentTrialRun } from "./run-offline-experiment-trial.js";
import { compareStoredRows, type StoredRowsComparison } from "./stored-rows-comparison.js";
import { compareTrialObservations, trialObservation, type TrialObservation, type TrialObservationComparison } from "./trial-observation.js";

export type LiveComparison = Readonly<{
  traceId: string;
  trialRunId: string;
  verdict: string | null;
  code: string | null;
  observation: TrialObservation;
  judgeView: TrialObservationComparison;
  storedRows: StoredRowsComparison;
}>;

export type ExperimentTrialResult = Readonly<{
  request: Readonly<{ candidateId: string; revision: number; digest: string }>;
  wallMs: number;
  judgeAsked: number;
  sessionView: OfflineExperimentTrialRun["sessionView"];
  captured: readonly CapturedTrace[];
  offline: OfflineTrialReport;
  observation: TrialObservation | null;
  vsSourceTrial: LiveComparison | null;
  vsLiveTwin: LiveComparison | null;
  oracle: OracleVerdict | null;
}>;

export async function runExperimentTrial(input: {
  session: ExperimentSession;
  stepsDir: string;
  /** The fresh copy's workspace root, which `session` was opened on. */
  rootDir: string;
  request: OfflineTrialRequest;
  /** The candidate's script as Core compiled it, for its read count. */
  script: string;
  sessionView: OfflineExperimentSessionView;
  /** Tier 2: the reevaluator handed to Core's runner (`../tier2/`); absent for tier 1. */
  reevaluator?: ClientGatewayTraceReevaluator | undefined;
}): Promise<ExperimentTrialResult> {
  const { session, request } = input;
  const projectId = request.store.projectId;
  const revision = request.candidate.recorded?.whole?.revision ?? request.source.whole.revision;
  const sourceInstructionIds = Array.isArray(session.context.draft.sourceInstructionIds) ? session.context.draft.sourceInstructionIds.filter((id): id is string => typeof id === "string") : [];
  const run = await runOfflineExperimentTrial({
    rootDir: input.rootDir, projectId, flowId: request.store.flowId, startLocation: session.build.startLocation, sourceInstructionIds,
    sourceTraceId: request.source.traceId,
    // The rebuilt candidate carries its fresh controller's revision (1); it runs under the recorded one, as live,
    // because the detached runner requires the two equal (`flow-bootstrap/verification/detached-execution.ts`).
    // Core's digest does not cover the revision: the rebuilt digest equals the recorded one (`../rebuild/`).
    candidate: { candidateId: request.candidate.candidateId, revision, digest: request.candidate.wholeDigest, candidate: { ...request.candidate.candidate, revision } },
    sessionView: input.sessionView,
    ...(input.reevaluator === undefined ? {} : { reevaluator: input.reevaluator }),
  });
  const automationDataDir = path.join(input.rootDir, ".fluxiq", "artifacts", "automation-studio");
  const offline = offlineTrialReport(run.outcome);
  const ran = run.outcome.status === "ran" ? run.outcome : null;
  const runId = ran?.trial.record.trialRunId ?? null;
  const observation = ran ? trialObservation(ran.trial.result.feedback) : null;
  const offlineRows = runId === null ? [] : await readTrialDatasets({ automationDataDir, projectId, runId });
  const compare = async (live: TracedRevision | undefined): Promise<LiveComparison | null> => {
    if (!live || !observation) return null;
    const test = session.steps.tests.find((candidate) => candidate.trialRunId === live.trialRunId);
    if (!test) return null;
    const liveObservation = trialObservation(await readLiveTrialFeedback(input.stepsDir, test.folder));
    return Object.freeze({
      traceId: live.traceId, trialRunId: live.trialRunId, verdict: test.verdict, code: test.code, observation: liveObservation,
      judgeView: compareTrialObservations(liveObservation, observation),
      storedRows: compareStoredRows(await readTrialDatasets({ automationDataDir, projectId, runId: live.trialRunId }), offlineRows),
    });
  };
  const source = session.traced.find((candidate) => candidate.traceId === request.source.traceId);
  const twin = request.liveTwin ? session.traced.find((candidate) => candidate.traceId === request.liveTwin!.traceId) : undefined;
  const oracle = runId === null ? null : judgeTrialDatasets({ scenarioOrigin: session.build.scenarioOrigin }, session.oracle, runId, offlineRows, scriptExtractNodes(input.script, session.context.surroundings));
  return Object.freeze({
    request: Object.freeze({ candidateId: request.candidate.candidateId, revision, digest: request.candidate.wholeDigest }),
    wallMs: run.wallMs, judgeAsked: run.judgeAsked, sessionView: run.sessionView, captured: run.captured, offline, observation,
    vsSourceTrial: await compare(source),
    vsLiveTwin: twin && twin.traceId !== source?.traceId ? await compare(twin) : null,
    oracle,
  });
}
