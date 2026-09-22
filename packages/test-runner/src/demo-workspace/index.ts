// The demo workspace's public surface. `demo-workspace.ts` beside this
// directory re-exports it, so every importer keeps the specifier it had.

export { runDemoLlmAdaptation, inspectLatestDemoLlmAdaptationRun, controlPreparedDemoLlmTargetAdaptation } from "./adaptation-lane.js";
export { prepareDemoLlmBlankWorkspace } from "./blank-preparation.js";
export { type BoundExplorationApplyCheckpoint, runBoundDemoLlmExplorationApplyCheckpoint, type BoundExplorationRunCheckpoint, boundExplorationRunStages, type BoundExplorationRunStage, runBoundDemoLlmExplorationFlow } from "./bound-exploration.js";
export { type DemoWorkspaceConfiguration, type DemoWorkspaceTopologyOverrides, resolveDemoWorkspaceConfiguration } from "./configuration.js";
export { authenticatedControl, type DemoCoreStartOptions, type RunningDemoCore, startPersistentDemoCore, withPersistentDemoCore } from "./core-process.js";
export { runDemoLlmCreationSettingsProbe, runDemoLlmCreationReadinessProbe, runDemoLlmPendingCreationProbe, runDemoLlmAppliedCreationProbe, runDemoLlmAppliedCreationRevertProbe, runDemoLlmAppliedCreationReplayProbe, runDemoLlmCreation } from "./creation-lanes.js";
export { prepareDemoLlmWorkspace, runDemoLlmDiagnosis } from "./diagnosis-lanes.js";
export { runDemoLlmAdaptationReadinessProbe, runDemoLlmExplorationAdaptationReadinessProbe, runDemoLlmExplorationAdaptationRevert, runDemoLlmExplorationAdaptationReject, runDemoLlmExplorationAdaptationProposal, runDemoLlmExplorationAdaptationApply, runDemoLlmExplorationAdaptationValidation } from "./exploration-adaptation.js";
export { runDemoLlmExplorationBaselineProbe, runDemoLlmExplorationCheckpoint, explorationFlowName, resolveExplorationFlowNameForRecovery, type EvidenceGuidedCreationApplyCheckpoint, runDemoLlmExplorationApplyCheckpoint } from "./exploration-checkpoints.js";
export { ADAPTING_RUN_TIMEOUT_MS, type TargetProposalStructure, readTargetProposalStructure } from "./adapting-run/index.js";
export { type DemoLauncherFailure, describeDemoLauncherFailure } from "./launcher/index.js";
export { createDemoFlowDocument, assertDemoParentDocument, assertDemoRecordingDerivedFlow, assertLlmDiagnosisRecordingDerivedFlow, assertDemoSubflowOwnership, assertDemoFlowDocument, demoGraphReconciliationOperations } from "./flow-document.js";
export { type DemoLlmPreparationState, parseDemoLlmPreparationState, assertDemoLlmPreparationStateDoesNotContainSecrets } from "./preparation-state.js";
export { startPersistentScenarioLabWithRecovery, requireDemoScenarioUrl } from "./scenario-lab.js";
export { setupDemoWorkspaceDeepSeekKey, recordDemoWorkspace, runDemoWorkspaceFlow } from "./workspace-lanes.js";
export { type DemoWorkspaceState } from "./workspace-state.js";

// The building blocks the UI end-to-end journeys compose (`ui-e2e/journeys`):
// the persistent Core and its signed-in control client, the extension, panel
// and scenario pages, and the panel steps a journey drives. They are exported
// here because a consumer outside this directory may reach them only through
// its barrel.
export { credentialLiterals, explicitPort } from "./configuration.js";
export { connectExtension, extensionStatus, pollStatus, withDemoBrowser } from "./browser-session.js";
export { assertConnectedSession, recordingIds, waitForNewRecording, waitForRoutedRunDetail } from "./control-waits.js";
export { openFlowInCurrentProject, openProjectInPanel, selectFlowInCurrentProject } from "./panel-navigation.js";
export { runDemoFlowFromPanel } from "./panel-run.js";
export { type DemoFlowProfile, generateDemoSubflowFromRecording, provisionDemoFlow } from "./provisioning.js";
export { stableHierarchyNodeId } from "./selectors.js";
export { withWorkspaceLock } from "./workspace-state.js";
