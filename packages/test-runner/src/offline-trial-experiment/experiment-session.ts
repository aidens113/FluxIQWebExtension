// One copied round's store opened for the offline-trial experiment: its
// traces mapped to their candidates, its build's record and draft, Core's
// authoring path, the step resolutions the build gave (harvested off the
// persisted candidate and proven by its digests), and the task's oracle.
// Everything a survey or a trial preparation reads comes from here, so the two
// never disagree on what a revision is.
//
// The store must be a copy (`test-runs/`): opening it applies Core's
// migrations. No model is called and no browser is reached.

import path from "node:path";
import { automationStudioCandidateFingerprint } from "fluxiq/automation-studio";
import { jsonRecord } from "./json-record.js";
import { readLabSubflowSteps } from "./lab-subflow-steps.js";
import { loadOracleExpectation, type OracleExpectation, type OracleTask } from "./oracle/index.js";
import { readProjectBuildState } from "./project-build-state.js";
import { harvestRecordedResolutions, loadCoreAuthoring, rebuildSubflowCandidate, recordedResolutionBinding, webAuthoringSurroundings, type RebuildContext, type RecordedResolutionHarvest } from "./rebuild/index.js";
import { readStoreTraceManifests, type StoreTraceManifest } from "./store-trace-manifests.js";
import { tracedRevisions } from "./traced-revisions.js";
import type { CandidateRebuild, LabSubflowSteps, LabSubflowSubmission, TracedRevision } from "./types.js";

export type ExperimentInput = Readonly<{
  /** The copied workspace's `.fluxiq` directory (`global.sqlite`, `artifacts/automation-studio/`). */
  fluxiqDir: string;
  projectId: string;
  /** The Lab run's `steps/` directory. */
  stepsDir: string;
  /** The live task whose oracle judges the rows; its scenario origin is the build's own. */
  oracle: Omit<OracleTask, "scenarioOrigin">;
}>;

export type ExperimentSession = Readonly<{
  input: ExperimentInput;
  automationDataDir: string;
  build: Readonly<{ buildId: string; flowId: string; startLocation: string; scenarioOrigin: string; explorationTraceId: string }>;
  traces: readonly StoreTraceManifest[];
  steps: LabSubflowSteps;
  traced: readonly TracedRevision[];
  context: RebuildContext;
  harvest: RecordedResolutionHarvest;
  oracle: OracleExpectation;
  canonical(value: unknown): string;
  /**
   * A script rebuilt through Core with the recorded resolutions. `recorded`
   * names the digests to check: the submission's own, and the whole
   * candidate's where a trial names the one it made; null for a correction,
   * which no recorded digest describes.
   */
  rebuild(written: Pick<LabSubflowSubmission, "briefId" | "script"> & { step: number | null }, recorded: RecordedDigests | null): Promise<CandidateRebuild>;
}>;

export type RecordedDigests = Readonly<{ subflow: Readonly<{ revision: number; digest: string }> | null; whole: Readonly<{ revision: number; digest: string }> | null }>;

const BUILD_CONTEXT = "automation-studio.build-context";

export async function openExperimentSession(input: ExperimentInput): Promise<ExperimentSession> {
  const automationDataDir = path.join(input.fluxiqDir, "artifacts", "automation-studio");
  const traces = await readStoreTraceManifests({ automationDataDir, projectId: input.projectId });
  const steps = await readLabSubflowSteps(input.stepsDir);
  const traced = tracedRevisions(traces, steps);
  const build = buildOf(traces);
  const state = readProjectBuildState({ globalDatabase: path.join(input.fluxiqDir, "global.sqlite"), projectId: input.projectId, flowId: build.flowId, buildId: build.buildId });
  if (!state.draft) throw new Error("The store keeps no candidate draft for the build's Flow, so no step resolution can be read");
  const canonical = (value: unknown): string => JSON.stringify(automationStudioCandidateFingerprint.snapshot(value));
  const context: RebuildContext = Object.freeze({ authoring: await loadCoreAuthoring(), surroundings: webAuthoringSurroundings(), record: state.record, draft: state.draft, startLocation: build.startLocation });
  const persistedDigest = jsonRecord(state.draft.candidate)?.digest;
  const persisted = traced.find((revision) => revision.whole.digest === persistedDigest && revision.subflow !== null);
  const submission = persisted?.subflow ? steps.submissions.find((candidate) => candidate.step === persisted.subflow!.submitStep) : undefined;
  if (!persisted?.subflow || !submission) throw new Error("No traced trial ran the persisted candidate, so its script cannot be found in the step files");
  const harvest = await harvestRecordedResolutions(context, { briefId: submission.briefId ?? "", script: submission.script, submitStep: submission.step, recordedSubflow: { revision: submission.revision, digest: submission.digest }, canonical });
  const oracle = await loadOracleExpectation({ ...input.oracle, scenarioOrigin: build.scenarioOrigin });
  const rebuild: ExperimentSession["rebuild"] = async (written, recorded) => {
    const seam = recordedResolutionBinding({ resolutions: harvest.resolutions, runsNodes: context.surroundings.runsNodes, conditions: context.authoring.extractionConditions, canonical });
    return await rebuildSubflowCandidate(context, {
      briefId: written.briefId ?? "", script: written.script, submitStep: written.step,
      recordedSubflow: recorded?.subflow ?? null, recordedWhole: recorded?.whole ?? null,
      binding: seam.binding, unresolved: seam.unresolved,
    });
  };
  return Object.freeze({ input, automationDataDir, build, traces, steps, traced, context, harvest, oracle, canonical, rebuild });
}

/** The build the store's exploration trace names: its id, Flow and start location (manifest `build-context`). */
function buildOf(traces: readonly StoreTraceManifest[]): ExperimentSession["build"] {
  for (const { manifest } of traces) {
    const context = jsonRecord(manifest.context);
    const value = jsonRecord(context?.value);
    if (jsonRecord(context?.schema)?.name !== BUILD_CONTEXT || value?.kind !== "build") continue;
    if (typeof value.buildId !== "string" || typeof value.flowId !== "string" || typeof value.startLocation !== "string") continue;
    return Object.freeze({ buildId: value.buildId, flowId: value.flowId, startLocation: value.startLocation, scenarioOrigin: new URL(value.startLocation).origin, explorationTraceId: manifest.traceId });
  }
  throw new Error("The store holds no exploration trace naming its build");
}
