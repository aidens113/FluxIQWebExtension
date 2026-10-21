// What the lead needs before the gate experiment runs, provider-free, in one
// report of identifiers, digests, counts and codes:
//
// 1. every `test` trace and the candidate its trial ran (`traced`);
// 2. every accepted submission rebuilt through Core's own path, and whether
//    Core's subflow and whole digests equal the recorded ones (`rebuilds`; the
//    harvest that proves the recorded resolutions comes first, `harvest`);
// 3. each traced trial's stored rows judged by the task's own oracle
//    (`oracle`), beside the live verdict for comparison;
// 4. whether a Core-side post-processing change alone could make the source
//    revision's rows the oracle's answer (`tier1`).
//
// No candidate plan, script or row is carried out.

import type { ExperimentSession } from "./experiment-session.js";
import { judgeTrialDatasets, readTrialDatasets, tier1Derivability } from "./oracle/index.js";
import { scriptExtractNodes } from "./rebuild/index.js";
import type { CandidateRebuild, OracleVerdict, Tier1Derivability, TracedRevision } from "./types.js";

export type RebuildSummary = Readonly<Omit<CandidateRebuild, "candidate"> & { subflowRevision: number; tracedBy: readonly string[] }>;

export type ExperimentSurvey = Readonly<{
  build: ExperimentSession["build"];
  traced: readonly TracedRevision[];
  harvest: Readonly<{ resolutions: number; verified: boolean; rebuild: Omit<CandidateRebuild, "candidate"> }>;
  rebuilds: readonly RebuildSummary[];
  oracle: readonly Readonly<OracleVerdict & { traceId: string; live: TracedRevision["test"] }>[];
  tier1: Readonly<{ source: Readonly<{ traceId: string; trialRunId: string; briefId: string; subflowRevision: number }>; derivability: Tier1Derivability }> | null;
}>;

export async function surveyExperiment(session: ExperimentSession, correction: { briefId: string; fromRevision: number }): Promise<ExperimentSurvey> {
  const { candidate: _harvested, ...harvestRebuild } = session.harvest.rebuild;
  const rebuilds: RebuildSummary[] = [];
  const latest = new Map<string, (typeof session.steps.submissions)[number]>();
  for (const submission of session.steps.submissions) latest.set(`${submission.briefId}\n${submission.revision}\n${submission.digest}`, submission);
  for (const submission of latest.values()) {
    const tracing = session.traced.filter((revision) => revision.subflow?.digest === submission.digest && revision.subflow.briefId === submission.briefId);
    const rebuild = await session.rebuild(submission, { subflow: { revision: submission.revision, digest: submission.digest }, whole: tracing[0]?.whole ?? null });
    const { candidate: _candidate, ...summary } = rebuild;
    rebuilds.push(Object.freeze({ ...summary, subflowRevision: submission.revision, tracedBy: Object.freeze(tracing.map((revision) => revision.traceId)) }));
  }
  const oracle: ExperimentSurvey["oracle"][number][] = [];
  const rowsByRun = new Map<string, Awaited<ReturnType<typeof readTrialDatasets>>>();
  for (const revision of session.traced) {
    const datasets = await readTrialDatasets({ automationDataDir: session.automationDataDir, projectId: session.input.projectId, runId: revision.trialRunId });
    rowsByRun.set(revision.trialRunId, datasets);
    const script = session.steps.submissions.find((submission) => submission.step === revision.subflow?.submitStep)?.script;
    const reads = script === undefined ? null : scriptExtractNodes(script, session.context.surroundings);
    oracle.push(Object.freeze({ ...judgeTrialDatasets({ scenarioOrigin: session.build.scenarioOrigin }, session.oracle, revision.trialRunId, datasets, reads), traceId: revision.traceId, live: revision.test }));
  }
  const source = session.traced.find((revision) => revision.subflow?.briefId === correction.briefId && revision.subflow.revision === correction.fromRevision);
  const tier1 = source?.subflow ? Object.freeze({
    source: Object.freeze({ traceId: source.traceId, trialRunId: source.trialRunId, briefId: correction.briefId, subflowRevision: correction.fromRevision }),
    derivability: tier1Derivability((rowsByRun.get(source.trialRunId) ?? []).flatMap((dataset) => dataset.records), session.oracle.entry, { scenarioOrigin: session.build.scenarioOrigin }),
  }) : null;
  return Object.freeze({
    build: session.build,
    traced: session.traced,
    harvest: Object.freeze({ resolutions: session.harvest.resolutions.length, verified: session.harvest.verified, rebuild: harvestRebuild }),
    rebuilds: Object.freeze(rebuilds),
    oracle: Object.freeze(oracle),
    tier1,
  });
}
