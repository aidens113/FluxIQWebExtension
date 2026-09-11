// The deterministic diagnosis lanes: preparing the drift-diagnosis workspace
// from a real recording, and running the diagnosis itself.
import { DemoLlmPreparationPhaseTracker, writeDemoLlmPreparationStatus } from "../demo-operation-status.js";
import { type DemoLlmLiveResult, evaluateDemoLlmDiagnosis, persistDemoLlmLiveResult } from "../demo-llm-live.js";
import { RunnerFailure } from "../failure.js";
import { connectExtension, extensionStatus, pollStatus, withDemoBrowser } from "./browser-session.js";
import type { DemoWorkspaceConfiguration } from "./configuration.js";
import { assertConnectedSession, isTerminalRuntimeStatus, recordingIds, waitForNewRecording, waitForRoutedRunDetail } from "./control-waits.js";
import { authenticatedControl, withPersistentDemoCore } from "./core-process.js";
import { LLM_DIAGNOSIS_FLOW_ID, LLM_DIAGNOSIS_FLOW_NAME, LLM_DIAGNOSIS_FLOW_PROFILE, LLM_DIAGNOSIS_SCENARIO_PATH, LLM_DIAGNOSIS_SUBFLOW_NAME, configureFirstLiveDiagnosisViaUi, ensureLlmDiagnosisInstructionViaUi, restoreDiagnosisScenario, runDiagnosisFromPanel } from "./diagnosis-ui.js";
import { openFlowInCurrentProject, openProjectInPanel, openSubflowInCurrentProject } from "./panel-navigation.js";
import { assertDemoFlowRenderedLayout, runDemoFlowFromPanel } from "./panel-run.js";
import { type DemoLlmPreparationState, assertDemoLlmPreparationStateDoesNotContainSecrets, assertPreparedDiagnosisGraph, existingDiagnosisRecordingId, loadLlmPreparationState, preparationIdentity, requirePreparedLlmDiagnosis, saveLlmPreparationState } from "./preparation-state.js";
import { generateDemoSubflowFromRecording, provisionDemoFlow } from "./provisioning.js";
import { loadWorkspaceState, withWorkspaceLock } from "./workspace-state.js";

export async function prepareDemoLlmWorkspace(config: DemoWorkspaceConfiguration): Promise<DemoLlmPreparationState> {
  const phaseTracker = new DemoLlmPreparationPhaseTracker();
  return withWorkspaceLock(config, async () => {
    phaseTracker.set("workspace-locked");
    try {
      const result = await withPersistentDemoCore(config, async () => {
      phaseTracker.set("core-ready");
      phaseTracker.set("auth-call");
      const { control, gatewayUrl, panelCookie } = await authenticatedControl(config);
      phaseTracker.set("auth-returned");
      const savedPreparation = await loadLlmPreparationState(config);
      if (savedPreparation) assertDemoLlmPreparationStateDoesNotContainSecrets(savedPreparation, [config.password, config.pin, ...(config.totp ? [config.totp] : [])]);
      const savedDemo = await loadWorkspaceState(config);
      const selectedProjectId = savedPreparation?.projectId ?? savedDemo?.projectId ?? config.projectId;
      const { projectId: _configuredProjectId, ...configWithoutProjectId } = config;
      const diagnosisConfig: DemoWorkspaceConfiguration = {
        ...configWithoutProjectId,
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
        flowId: LLM_DIAGNOSIS_FLOW_ID,
        flowName: LLM_DIAGNOSIS_FLOW_NAME,
      };
      phaseTracker.set("browser-call");
      return withDemoBrowser(config, panelCookie, "demo-llm-prepare", async ({ extensionPage, panelPage, scenarioPage, scenarioUrl, evidence }) => {
        phaseTracker.set("operation-entered");
        let state = savedPreparation
          ? await requirePreparedLlmDiagnosis(control, diagnosisConfig, savedPreparation)
          : await provisionDemoFlow(control, diagnosisConfig, panelPage, evidence, LLM_DIAGNOSIS_FLOW_PROFILE);
        await openProjectInPanel(panelPage, config.origin, state.projectName, evidence);
        phaseTracker.set("flow-open-call");
        const preparationFlowTreeItemId = await openFlowInCurrentProject(panelPage, state.flowName, evidence);
        phaseTracker.set("flow-open-returned");
        phaseTracker.set("instruction-ensure-call");
        await ensureLlmDiagnosisInstructionViaUi(panelPage, preparationFlowTreeItemId, config.pin, evidence);
        phaseTracker.set("instruction-ensure-returned");
        await openFlowInCurrentProject(panelPage, state.flowName, evidence);
        phaseTracker.set("connect-diagnostic-call");
        await evidence.diagnostic("extension", "connect-call", "connect.call", { flowOpened: true, scenarioUrlReady: true });
        phaseTracker.set("connect-diagnostic-returned");
        phaseTracker.set("connect-extension-call");
        await connectExtension(extensionPage, panelPage, control, gatewayUrl, config.origin, state.projectId, state.flowId, scenarioUrl, evidence);
        phaseTracker.set("connect-extension-returned");

        let recordingId = savedPreparation?.recordingId ?? await existingDiagnosisRecordingId(control, state);
        if (!recordingId) {
          await restoreDiagnosisScenario(scenarioPage, evidence, "recording");
          const before = recordingIds(await control.listRecordings(state.projectId));
          let recording = false;
          try {
            await evidence.step("extension", "llm-record-start", "Start the deterministic diagnosis recording", async () => {
              await extensionPage.getByRole("button", { name: "Start recording" }).click();
              await pollStatus(extensionPage, value => value.recordingState === "recording" && value.projectId === state.projectId, "diagnosis recording acceptance");
            });
            recording = true;
            await evidence.step("scenario", "llm-activate-stable-target", "Activate the stable diagnosis target", () => scenarioPage.getByTestId("diagnosis-target").click());
            await scenarioPage.getByTestId("result").filter({ hasText: "Completed: 1" }).waitFor();
            await evidence.step("extension", "llm-record-stop", "Stop the deterministic diagnosis recording", async () => {
              await extensionPage.getByRole("button", { name: "Stop recording" }).click();
              await pollStatus(extensionPage, value => value.recordingState === "idle", "diagnosis recording stop");
            });
            recording = false;
            recordingId = await waitForNewRecording(control, state.projectId, before);
            state = await generateDemoSubflowFromRecording(panelPage, control, diagnosisConfig, state, recordingId, evidence, LLM_DIAGNOSIS_FLOW_PROFILE);
          } finally {
            if (recording) {
              await evidence.step("extension", "llm-record-stop-recovery", "Stop diagnosis recording after failure", () => extensionPage.getByRole("button", { name: "Stop recording" }).click()).catch(() => undefined);
            }
          }
        } else {
          await assertPreparedDiagnosisGraph(control, state, recordingId);
          await openFlowInCurrentProject(panelPage, state.flowName, evidence);
          await openSubflowInCurrentProject(panelPage, LLM_DIAGNOSIS_SUBFLOW_NAME, evidence);
          await assertDemoFlowRenderedLayout(panelPage, evidence, LLM_DIAGNOSIS_FLOW_PROFILE.renderedNodeCounts);
        }

        const prepared = preparationIdentity(state, recordingId);
        await saveLlmPreparationState(config, prepared, [config.password, config.pin, ...(config.totp ? [config.totp] : [])]);
        await restoreDiagnosisScenario(scenarioPage, evidence, "playback");
        await openFlowInCurrentProject(panelPage, state.flowName, evidence);
        const execution = await runDemoFlowFromPanel(panelPage, state, evidence);
        if (execution.status !== "succeeded") throw new RunnerFailure("runtime.behavior", `Prepared deterministic diagnosis baseline failed: ${JSON.stringify(execution.diagnostic)}`);
        await scenarioPage.getByTestId("result").filter({ hasText: "Completed: 1" }).waitFor({ timeout: 30_000 });
        const graph = await control.getExactFlow(state.projectId, state.graphFlowId);
        const expectedActionCount = Array.isArray(graph.document.nodes) ? graph.document.nodes.length : 0;
        await waitForRoutedRunDetail(control, state, execution.runId, expectedActionCount);
        await assertConnectedSession(control, (await extensionStatus(extensionPage)).sessionId);
        return prepared;
      }, [], LLM_DIAGNOSIS_SCENARIO_PATH, phaseTracker);
      });
      await writeDemoLlmPreparationStatus(config.workspaceDirectory, phaseTracker.status("passed"));
      return result;
    } catch (error) {
      phaseTracker.captureFailure(error);
      await writeDemoLlmPreparationStatus(config.workspaceDirectory, phaseTracker.status("failed")).catch(() => undefined);
      throw error;
    }
  });
}

export async function runDemoLlmDiagnosis(config: DemoWorkspaceConfiguration): Promise<DemoLlmLiveResult> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control, gatewayUrl, panelCookie } = await authenticatedControl(config);
    const prepared = await loadLlmPreparationState(config);
    if (!prepared) throw new RunnerFailure("environment.missing", "Run pnpm demo:llm:prepare before the live diagnosis");
    const { projectId: _projectId, ...withoutProjectId } = config;
    const diagnosisConfig: DemoWorkspaceConfiguration = {
      ...withoutProjectId,
      projectId: prepared.projectId,
      flowId: LLM_DIAGNOSIS_FLOW_ID,
      flowName: LLM_DIAGNOSIS_FLOW_NAME,
    };
    const state = await requirePreparedLlmDiagnosis(control, diagnosisConfig, prepared);
    return withDemoBrowser(config, panelCookie, "demo-llm-diagnosis", async ({ extensionPage, panelPage, scenarioPage, scenarioUrl, evidence }) => {
      await openProjectInPanel(panelPage, config.origin, state.projectName, evidence);
      const flowTreeItemId = await openFlowInCurrentProject(panelPage, state.flowName, evidence);
      await configureFirstLiveDiagnosisViaUi(panelPage, flowTreeItemId, config.pin, evidence);
      await connectExtension(extensionPage, panelPage, control, gatewayUrl, config.origin, state.projectId, state.flowId, scenarioUrl, evidence);
      await evidence.step("scenario", "llm-arm-missing-target", "Remove the recorded target before diagnosis", () => scenarioPage.getByTestId("introduce-missing-target").click());
      await scenarioPage.getByTestId("drift-mode").filter({ hasText: "Mode: missing" }).waitFor({ timeout: 10_000 });

      const diagnosisFlowTreeItemId = await openFlowInCurrentProject(panelPage, state.flowName, evidence);
      const diagnosis = await runDiagnosisFromPanel(panelPage, diagnosisFlowTreeItemId, evidence);
      let diagnosisDetail = await control.getRunDetail(state.projectId, diagnosis.runId);
      const diagnosisDeadline = Date.now() + 30_000;
      while (Date.now() < diagnosisDeadline && (!isTerminalRuntimeStatus(diagnosisDetail.summary.status) || (diagnosisDetail.interventions?.length ?? 0) < 1)) {
        await new Promise(resolve => setTimeout(resolve, 100));
        diagnosisDetail = await control.getRunDetail(state.projectId, diagnosis.runId);
      }
      if (!isTerminalRuntimeStatus(diagnosisDetail.summary.status)) throw new RunnerFailure("runtime.behavior", "Diagnosis-only run did not reach a terminal state");
      const diagnosisEvents = await control.listRunEvents(state.projectId, diagnosis.runId, { limit: 100 });

      await restoreDiagnosisScenario(scenarioPage, evidence, "no-llm-replay");
      await openFlowInCurrentProject(panelPage, state.flowName, evidence);
      const replay = await runDemoFlowFromPanel(panelPage, state, evidence);
      let replayDetail = await control.getRunDetail(state.projectId, replay.runId);
      const replayDeadline = Date.now() + 30_000;
      while (Date.now() < replayDeadline && !isTerminalRuntimeStatus(replayDetail.summary.status)) {
        await new Promise(resolve => setTimeout(resolve, 100));
        replayDetail = await control.getRunDetail(state.projectId, replay.runId);
      }
      if (!isTerminalRuntimeStatus(replayDetail.summary.status)) throw new RunnerFailure("runtime.behavior", "No-LLM replay did not reach a terminal state");
      await scenarioPage.getByTestId("result").filter({ hasText: "Completed: 1" }).waitFor({ timeout: 30_000 });
      const evaluated = evaluateDemoLlmDiagnosis({ diagnosis: diagnosisDetail, diagnosisEvents, replay: replayDetail });
      return persistDemoLlmLiveResult(config.workspaceDirectory, evaluated, [config.password, config.pin, ...(config.totp ? [config.totp] : [])]);
    }, [config.password, config.pin, ...(config.totp ? [config.totp] : [])], LLM_DIAGNOSIS_SCENARIO_PATH);
  }));
}
