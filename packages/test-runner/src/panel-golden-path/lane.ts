import type { DemoLlmExplorationRequest } from "../demo-llm-exploration-request.js";
import { loadDemoLlmExplorationRequestBinding } from "../demo-llm-exploration-request.js";
import type { DemoWorkspaceConfiguration, DemoWorkspaceState } from "../demo-workspace/index.js";
import {
  recordDemoWorkspace,
  prepareDemoLlmBlankWorkspace,
  runBoundDemoLlmExplorationApplyCheckpoint,
  runBoundDemoLlmExplorationFlow,
  runDemoLlmExplorationAdaptationApply,
  runDemoLlmExplorationAdaptationProposal,
  runDemoLlmExplorationAdaptationValidation,
  runDemoLlmExplorationCheckpoint,
  runDemoWorkspaceFlow,
} from "../demo-workspace/index.js";
import { RunnerFailure } from "../failure.js";
import {
  assertPanelGoldenIdentity,
  assertPanelGoldenStages,
  type PanelGoldenPathIdentity,
  type PanelGoldenPathStageResult,
  unverifiedPanelGoldenStages,
} from "./assertions.js";

type CreationProposal = Awaited<ReturnType<typeof runDemoLlmExplorationCheckpoint>>;
type CreationApply = Awaited<ReturnType<typeof runBoundDemoLlmExplorationApplyCheckpoint>>;
type BoundRun = Awaited<ReturnType<typeof runBoundDemoLlmExplorationFlow>>;
type RepairProposal = Awaited<ReturnType<typeof runDemoLlmExplorationAdaptationProposal>>;
type RepairApply = Awaited<ReturnType<typeof runDemoLlmExplorationAdaptationApply>>;
type RepairValidation = Awaited<ReturnType<typeof runDemoLlmExplorationAdaptationValidation>>;

export type PanelGoldenPathDrivers = Readonly<{
  prepareWorkspace: (config: DemoWorkspaceConfiguration) => Promise<unknown>;
  proposeCreation: (config: DemoWorkspaceConfiguration, request?: DemoLlmExplorationRequest) => Promise<CreationProposal>;
  applyCreation: (config: DemoWorkspaceConfiguration) => Promise<CreationApply>;
  runCreatedFlow: (config: DemoWorkspaceConfiguration) => Promise<BoundRun>;
  proposeRepair: (config: DemoWorkspaceConfiguration) => Promise<RepairProposal>;
  applyRepair: (config: DemoWorkspaceConfiguration) => Promise<RepairApply>;
  validateRepair: (config: DemoWorkspaceConfiguration) => Promise<RepairValidation>;
  recordFlow: (config: DemoWorkspaceConfiguration) => Promise<DemoWorkspaceState>;
  runRecordedFlow: (config: DemoWorkspaceConfiguration) => Promise<DemoWorkspaceState>;
}>;

const productionDrivers: PanelGoldenPathDrivers = Object.freeze({
  prepareWorkspace: prepareDemoLlmBlankWorkspace,
  proposeCreation: runDemoLlmExplorationCheckpoint,
  applyCreation: runBoundDemoLlmExplorationApplyCheckpoint,
  runCreatedFlow: runBoundDemoLlmExplorationFlow,
  proposeRepair: runDemoLlmExplorationAdaptationProposal,
  applyRepair: runDemoLlmExplorationAdaptationApply,
  validateRepair: runDemoLlmExplorationAdaptationValidation,
  recordFlow: recordDemoWorkspace,
  runRecordedFlow: runDemoWorkspaceFlow,
});

export type PanelGoldenPathResult = Readonly<{
  status: "passed" | "incomplete";
  identity: PanelGoldenPathIdentity;
  creationRunId: string;
  failedRunId: string;
  repairedRunId: string;
  reuseRunId: string;
  repairAdaptationId: string;
  recordingProjectId: string;
  recordingFlowId: string;
  recordingRunId: string;
  providerCallCount: number;
  stages: readonly PanelGoldenPathStageResult[];
  unverifiedStages: readonly string[];
}>;

/**
 * Runs the complete production-driver campaign. Every high-level driver owns
 * and closes its Core/browser process, so the later validation is a real
 * restart/reuse checkpoint rather than another action in one browser session.
 */
export async function runPanelGoldenPath(
  config: DemoWorkspaceConfiguration,
  request?: DemoLlmExplorationRequest,
  drivers: PanelGoldenPathDrivers = productionDrivers,
): Promise<PanelGoldenPathResult> {
  await drivers.prepareWorkspace(config);
  const creation = await drivers.proposeCreation(config, request);
  const binding = await loadDemoLlmExplorationRequestBinding(config.workspaceDirectory);
  if (!binding || binding.adaptationId !== creation.adaptationId) {
    throw new RunnerFailure("runtime.behavior", "Panel golden path creation binding is unavailable", {
      details: { reasonCode: "panel_golden_path.creation_binding_invalid" },
    });
  }
  const identity: PanelGoldenPathIdentity = Object.freeze({
    projectId: binding.projectId,
    flowId: binding.flowId,
    creationAdaptationId: binding.adaptationId,
  });

  const applied = await drivers.applyCreation(config);
  assertPanelGoldenIdentity(identity, applied, "creation_apply");
  const createdRun = await drivers.runCreatedFlow(config);
  assertPanelGoldenIdentity(identity, createdRun, "created_run");
  const repair = await drivers.proposeRepair(config);
  assertPanelGoldenIdentity(identity, { projectId: repair.projectId, flowId: repair.flowId }, "repair_proposal");
  const repaired = await drivers.applyRepair(config);
  assertPanelGoldenIdentity(identity, { projectId: repaired.projectId, flowId: repaired.flowId }, "repair_apply");
  if (repaired.adaptationId !== repair.adaptationId || repaired.sourceRunId !== repair.runId) {
    throw new RunnerFailure("runtime.behavior", "Panel golden path repair identity changed during apply", {
      details: { reasonCode: "panel_golden_path.repair_identity_mismatch" },
    });
  }
  const reused = await drivers.validateRepair(config);
  assertPanelGoldenIdentity(identity, { projectId: reused.projectId, flowId: reused.flowId }, "restart_reuse");
  if (reused.adaptationId !== repair.adaptationId || reused.sourceRunId !== repair.runId) {
    throw new RunnerFailure("runtime.behavior", "Panel golden path restart did not reuse the repaired Flow", {
      details: { reasonCode: "panel_golden_path.reuse_identity_mismatch" },
    });
  }

  const recorded = await drivers.recordFlow(config);
  const recordingReplay = await drivers.runRecordedFlow(config);
  if (recordingReplay.projectId !== recorded.projectId || recordingReplay.flowId !== recorded.flowId
    || !recordingReplay.latestRuntimeRunId) {
    throw new RunnerFailure("runtime.behavior", "Panel golden path recording replay changed Flow identity", {
      details: { reasonCode: "panel_golden_path.recording_identity_mismatch" },
    });
  }

  const stages: readonly PanelGoldenPathStageResult[] = Object.freeze([
    { stage: "instruction_entry", status: "verified", evidence: "creation proposal production UI driver" },
    { stage: "exploration_progress", status: "unverified", evidence: "ordered progress presentation is not asserted by the existing driver" },
    { stage: "creation_proposal_review", status: "verified", evidence: "bound Audit review driver" },
    { stage: "creation_approval", status: "verified", evidence: "bound PIN approval driver" },
    { stage: "creation_application", status: "verified", evidence: "applied bound topology and digest" },
    { stage: "normal_run", status: "verified", evidence: "bound panel run plus registered scenario oracle" },
    { stage: "normal_run_presentation", status: "unverified", evidence: "run row and Action Log identity are not asserted by the existing driver" },
    { stage: "failure_presentation", status: "unverified", evidence: "failed attempt and terminal reason presentation are not asserted before repair" },
    { stage: "repair_review_apply", status: "unverified", evidence: "review/apply is driven, but a human-readable structural diff is not implemented" },
    { stage: "repaired_rerun", status: "verified", evidence: "provider-free repaired validation and oracle" },
    { stage: "restart_saved_reuse", status: "verified", evidence: "new owned Core/browser invocation reused exact Flow and repair identities" },
    { stage: "recording_path", status: "unverified", evidence: "recording and replay are driven, but generation has no separate proposal review stage" },
  ]);
  assertPanelGoldenStages(stages);
  const unverifiedStages = Object.freeze(unverifiedPanelGoldenStages(stages));
  return Object.freeze({
    status: unverifiedStages.length ? "incomplete" as const : "passed" as const,
    identity,
    creationRunId: createdRun.runId,
    failedRunId: repair.runId,
    repairedRunId: repaired.validationRunId,
    reuseRunId: reused.validationRunId,
    repairAdaptationId: repair.adaptationId,
    recordingProjectId: recorded.projectId,
    recordingFlowId: recorded.flowId,
    recordingRunId: recordingReplay.latestRuntimeRunId,
    providerCallCount: creation.providerCallCount + repair.providerCallCount,
    stages,
    unverifiedStages,
  });
}
