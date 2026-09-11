// The provider-free instruction-only preparation lane. It creates a blank
// Flow through the real panel UI, confirms the extension recorder stayed idle
// and the project's recordings were untouched, and persists only Flow identity.
import { DemoLlmPreparationPhaseTracker, writeDemoLlmPreparationStatus } from "../demo-operation-status.js";
import { RunnerFailure } from "../failure.js";
import { assertGenuinelyBlankFlow, assertRecordingSetUnchanged, BLANK_LLM_SCENARIO_PATH, type BlankLlmPreparationState, loadBlankLlmPreparationState, prepareBlankLlmFlowViaUi, saveBlankLlmPreparationState } from "../demo-llm-blank-workspace.js";
import { connectExtension, extensionStatus, withDemoBrowser } from "./browser-session.js";
import { type DemoWorkspaceConfiguration, credentialLiterals } from "./configuration.js";
import { authenticatedControl, withPersistentDemoCore } from "./core-process.js";
import { withWorkspaceLock } from "./workspace-state.js";

export async function prepareDemoLlmBlankWorkspace(config: DemoWorkspaceConfiguration): Promise<BlankLlmPreparationState> {
  const phaseTracker = new DemoLlmPreparationPhaseTracker();
  return withWorkspaceLock(config, async () => {
    phaseTracker.set("workspace-locked");
    try {
      const result = await withPersistentDemoCore(config, async () => {
        phaseTracker.set("core-ready");
        phaseTracker.set("auth-call");
        const { control, gatewayUrl, panelCookie } = await authenticatedControl(config);
        phaseTracker.set("auth-returned");
        const saved = await loadBlankLlmPreparationState(config.workspaceDirectory);
        if (saved) assertDemoBlankStateSecrets(saved, config);
        phaseTracker.set("browser-call");
        return withDemoBrowser(config, panelCookie, "demo-llm-blank-prepare", async ({ extensionPage, panelPage, scenarioUrl, evidence }) => {
          phaseTracker.set("operation-entered");
          const prepared = await prepareBlankLlmFlowViaUi({
            control,
            config: {
              workspaceDirectory: config.workspaceDirectory,
              origin: config.origin,
              ...(config.projectId ? { projectId: config.projectId } : {}),
              projectName: config.projectName,
              pin: config.pin,
            },
            page: panelPage,
            evidence,
            ...(saved ? { saved } : {}),
          });
          await connectExtension(extensionPage, panelPage, control, gatewayUrl, config.origin, prepared.state.projectId, prepared.state.flowId, scenarioUrl, evidence);
          const status = await evidence.step("extension", "blank-recorder-status", "Verify the extension recorder remains idle", () => extensionStatus(extensionPage));
          if (status.recordingState !== "idle") throw new RunnerFailure("recording.persistence", "Instruction-only preparation did not keep the extension recorder idle");
          assertRecordingSetUnchanged(prepared.recordingIdsBefore, await control.listRecordings(prepared.state.projectId));
          await assertGenuinelyBlankFlow(control, prepared.state);
          await saveBlankLlmPreparationState(config.workspaceDirectory, prepared.state, credentialLiterals(config));
          return prepared.state;
        }, credentialLiterals(config), BLANK_LLM_SCENARIO_PATH, phaseTracker);
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

export function assertDemoBlankStateSecrets(state: BlankLlmPreparationState, config: DemoWorkspaceConfiguration): void {
  const serialized = JSON.stringify(state);
  if (credentialLiterals(config).some(value => value.length > 0 && serialized.includes(value))) throw new RunnerFailure("recording.persistence", "Blank LLM preparation metadata contains credential material");
}
