// The baseline demo lanes: provisioning the provider key, recording the demo
// workspace, and replaying the recorded Flow.
import { RunnerFailure } from "../failure.js";
import { deepSeekSecretFromDriverEnvironment, ensureDeepSeekKeyViaUi, type OpaqueSecretKeyReference } from "../secret-keys-ui.js";
import { selectOptionByKeyboard } from "../trusted-input/index.js";
import { connectExtension, extensionStatus, pollStatus, withDemoBrowser } from "./browser-session.js";
import type { DemoWorkspaceConfiguration } from "./configuration.js";
import { assertConnectedSession, recordingIds, waitForNewRecording, waitForRoutedRunDetail } from "./control-waits.js";
import { authenticatedControl, withPersistentDemoCore } from "./core-process.js";
import { openDemoFlowInPanel, openFlowInCurrentProject, openSubflowInCurrentProject } from "./panel-navigation.js";
import { assertDemoFlowRenderedLayout, runDemoFlowFromPanel, waitForSubmittedDemoPage } from "./panel-run.js";
import { DEMO_SUBFLOW_NAME, generateDemoSubflowFromRecording, provisionDemoFlow, requireDemoFlow } from "./provisioning.js";
import { type DemoWorkspaceState, saveWorkspaceState, withWorkspaceLock } from "./workspace-state.js";

export async function setupDemoWorkspaceDeepSeekKey(config: DemoWorkspaceConfiguration, environment: NodeJS.ProcessEnv): Promise<OpaqueSecretKeyReference> {
  const secretValue = deepSeekSecretFromDriverEnvironment(environment);
  return withWorkspaceLock(config, async () => {
    return withPersistentDemoCore(config, async () => {
      const { panelCookie } = await authenticatedControl(config);
      return withDemoBrowser(config, panelCookie, "demo-llm-key-setup", async ({ panelPage, evidence }) => {
        return ensureDeepSeekKeyViaUi({
          page: panelPage,
          evidence,
          origin: config.origin,
          secretValue,
          authorizationPassword: config.password,
          authorizationPin: config.pin,
        });
      }, [secretValue, config.password, config.pin, ...(config.totp ? [config.totp] : [])]);
    });
  });
}

export async function recordDemoWorkspace(config: DemoWorkspaceConfiguration): Promise<DemoWorkspaceState> {
  return withWorkspaceLock(config, async () => {
    return withPersistentDemoCore(config, async () => {
      const { control, gatewayUrl, panelCookie } = await authenticatedControl(config);
      return withDemoBrowser(config, panelCookie, "demo-record", async ({ extensionPage, panelPage, scenarioPage, scenarioUrl, evidence }) => {
      const state = await provisionDemoFlow(control, config, panelPage, evidence);
      const before = recordingIds(await control.listRecordings(state.projectId));
      await connectExtension(extensionPage, panelPage, control, gatewayUrl, config.origin, state.projectId, state.flowId, scenarioUrl, evidence);
      await evidence.step("scenario", "focus-recording-scenario", "Focus the settled demo tab before recording", () => scenarioPage.bringToFront());
      await scenarioPage.waitForTimeout(750);
      let recording = false;
      try {
        await evidence.step("extension", "record-start", "Start extension recording", async () => {
          await extensionPage.getByRole("button", { name: "Start recording" }).click();
          await pollStatus(extensionPage, value => value.recordingState === "recording" && value.projectId === state.projectId, "recording acceptance");
        });
        recording = true;
        await evidence.step("scenario", "fill-name", "Type the demo name", () => scenarioPage.getByTestId("name").fill("Ada"));
        await evidence.step("scenario", "select-plan", "Select the team plan", () => selectOptionByKeyboard(scenarioPage.getByTestId("plan"), "team"));
        await evidence.step("scenario", "fill-notes", "Type the demo notes", () => scenarioPage.getByTestId("notes").fill("Recorded by the reusable FluxIQ demo workspace"));
        await evidence.step("scenario", "submit-form", "Submit the demo form", () => scenarioPage.getByTestId("submit").click());
        await scenarioPage.getByTestId("result").filter({ hasText: "Submitted" }).waitFor();
        await evidence.step("extension", "record-stop", "Stop extension recording", async () => {
          await extensionPage.getByRole("button", { name: "Stop recording" }).click();
          await pollStatus(extensionPage, value => value.recordingState === "idle", "recording stop");
        });
        recording = false;
        const recordingId = await waitForNewRecording(control, state.projectId, before);
        const generatedState = await generateDemoSubflowFromRecording(panelPage, control, config, state, recordingId, evidence);
        const next = { ...generatedState, latestRecordingId: recordingId, updatedAt: new Date().toISOString() };
        await saveWorkspaceState(config, next);
        await assertConnectedSession(control, (await extensionStatus(extensionPage)).sessionId);
        return next;
      } finally {
        if (recording) {
          await evidence.step("extension", "record-stop-recovery", "Stop extension recording after a failed recording run", () => (
            extensionPage.getByRole("button", { name: "Stop recording" }).click()
          )).catch(() => undefined);
        }
      }
      });
    });
  });
}

export async function runDemoWorkspaceFlow(config: DemoWorkspaceConfiguration): Promise<DemoWorkspaceState> {
  return withWorkspaceLock(config, async () => {
    return withPersistentDemoCore(config, async () => {
      const { control, gatewayUrl, panelCookie } = await authenticatedControl(config);
      const state = await requireDemoFlow(control, config);
      return withDemoBrowser(config, panelCookie, "demo-playback", async ({ extensionPage, panelPage, scenarioPage, scenarioUrl, evidence }) => {
      await openDemoFlowInPanel(panelPage, config, state, evidence);
      await connectExtension(extensionPage, panelPage, control, gatewayUrl, config.origin, state.projectId, state.flowId, scenarioUrl, evidence);
      // Pairing approval temporarily moves the panel to Connected Clients. Open
      // the Flow again so a fresh panel profile binds Runtime Debug to the full
      // Flow document instead of its summary-only placeholder.
      await openFlowInCurrentProject(panelPage, state.flowName, evidence);
      await openSubflowInCurrentProject(panelPage, DEMO_SUBFLOW_NAME, evidence);
      await assertDemoFlowRenderedLayout(panelPage, evidence);
      await openFlowInCurrentProject(panelPage, state.flowName, evidence);
      const status = await extensionStatus(extensionPage);
      const execution = await runDemoFlowFromPanel(panelPage, state, evidence);
      const runId = execution.runId;
      if (execution.status !== "succeeded") {
        const failedStatus = await evidence.step("extension", "inspect-runtime-failure", "Inspect the extension runtime failure", () => extensionStatus(extensionPage));
        throw new RunnerFailure("runtime.behavior", `Panel Flow run failed: ${JSON.stringify({
          ...execution.diagnostic,
          extensionRuntime: failedStatus.runtime,
          activeTabId: failedStatus.activeTabId,
          activeTabUrl: failedStatus.activeTabUrl,
          unsupportedPage: failedStatus.unsupportedPage,
        })}`);
      }
      await waitForSubmittedDemoPage(scenarioPage);
      await assertConnectedSession(control, status.sessionId);
      const graph = await control.getExactFlow(state.projectId, state.graphFlowId);
      const expectedActionCount = Array.isArray(graph.document.nodes) ? graph.document.nodes.length : 0;
      const detail = await waitForRoutedRunDetail(control, state, runId, expectedActionCount);
      const actions = detail.actionAttempts;
      if (actions.length !== expectedActionCount || actions.some(action => action.definitionId !== "builtin.policy.action" || action.status !== "succeeded")) {
        const diagnostic = actions.map(action => ({ definitionId: action.definitionId, status: action.status, message: action.message ?? "" }));
        throw new RunnerFailure("runtime.behavior", `Panel-started run did not successfully execute every recording-generated action: ${JSON.stringify(diagnostic)}`);
      }
      const next = { ...state, latestRuntimeRunId: runId, updatedAt: new Date().toISOString() };
      await saveWorkspaceState(config, next);
      return next;
      });
    });
  });
}
