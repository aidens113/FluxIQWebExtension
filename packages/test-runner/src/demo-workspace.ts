import { randomBytes } from "node:crypto";
import type { ChildProcess } from "node:child_process";
import { access, cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { allocateLoopbackPort } from "./allocation.js";
import { WebPanelAuthSessionCache } from "./auth-session.js";
import { BrowserEvidenceRecorder, type BrowserEvidenceSurface } from "./browser-evidence.js";
import { ExistingFluxIQControlClient, type ExistingFlowSummary } from "./existing-fluxiq-control.js";
import { prepareWebWorkspace } from "./coordinator.js";
import { buildFluxIQEnvironment, withoutProviderSecrets } from "./environment.js";
import { DemoLlmPreparationPhaseTracker, writeDemoLlmPreparationStatus } from "./demo-operation-status.js";
import { evaluateDemoLlmDiagnosis, persistDemoLlmLiveResult, type DemoLlmLiveResult } from "./demo-llm-live.js";
import { RunnerFailure } from "./failure.js";
import { waitForHttp } from "./http-control.js";
import { executable, ProcessSupervisor, processLogPath } from "./process-supervisor.js";
import { requireSecureGatewayUrl } from "./target-config.js";
import { TESTING_LAB_DEEPSEEK_KEY_NAME, deepSeekSecretFromDriverEnvironment, ensureDeepSeekKeyViaUi, type OpaqueSecretKeyReference } from "./secret-keys-ui.js";
import { hardenWindowsPrivatePath } from "./windows-acl.js";
import { acquireWorkspaceOperationLock } from "./workspace-lock.js";
import { assertGenuinelyBlankFlow, assertRecordingSetUnchanged, BLANK_LLM_FLOW_NAME, BLANK_LLM_SCENARIO_PATH, loadBlankLlmPreparationState, prepareBlankLlmFlowViaUi, saveBlankLlmPreparationState, type BlankLlmPreparationState } from "./demo-llm-blank-workspace.js";
import { assertProviderFreeGenerationReadiness, buildApproveApplyCreationViaUi, configureFirstLiveCreationViaUi, type ProviderFreeGenerationReadiness } from "./demo-llm-create-ui.js";
import { evaluateDemoLlmCreation, persistDemoLlmCreationResult, type DemoLlmCreationResult } from "./demo-llm-creation.js";

const SCHEMA_VERSION = "0.3" as const;
const DEMO_SUBFLOW_NAME = "Primary browser automation";
const LLM_DIAGNOSIS_FLOW_NAME = "Web Extension LLM Target Drift Diagnosis";
const LLM_DIAGNOSIS_FLOW_ID = "flow.web-extension-llm-target-drift";
const LLM_DIAGNOSIS_SUBFLOW_NAME = "Stable target deterministic baseline";
const LLM_DIAGNOSIS_SCENARIO_PATH = "/scenarios/llm-target-drift/";
const LLM_DIAGNOSIS_INSTRUCTION_TITLE = "Diagnose deterministic target drift";
const LLM_DIAGNOSIS_INSTRUCTION_BODY = "Diagnose why the recorded loopback target could not be activated. Do not patch, retry, adapt, promote, or perform external side effects.";
const LLM_PREPARATION_SCHEMA_VERSION = "0.1" as const;

export type DemoLlmPreparationState = {
  schemaVersion: typeof LLM_PREPARATION_SCHEMA_VERSION;
  projectId: string;
  flowId: string;
  subflowId: string;
  graphFlowId: string;
  routerId: string;
  recordingId: string;
};

type DemoFlowProfile = {
  subflowName: string;
  useSavedWorkspaceState: boolean;
  persistWorkspaceState: boolean;
  assertRecordingDerivedFlow: (document: Record<string, unknown>, recordingId?: string) => void;
  renderedNodeCounts: readonly number[];
};

const STANDARD_DEMO_FLOW_PROFILE: DemoFlowProfile = {
  subflowName: DEMO_SUBFLOW_NAME,
  useSavedWorkspaceState: true,
  persistWorkspaceState: true,
  assertRecordingDerivedFlow: assertDemoRecordingDerivedFlow,
  renderedNodeCounts: [4, 5],
};

const LLM_DIAGNOSIS_FLOW_PROFILE: DemoFlowProfile = {
  subflowName: LLM_DIAGNOSIS_SUBFLOW_NAME,
  useSavedWorkspaceState: false,
  persistWorkspaceState: false,
  assertRecordingDerivedFlow: assertLlmDiagnosisRecordingDerivedFlow,
  renderedNodeCounts: [1, 2],
};

export type DemoWorkspaceConfiguration = {
  repositoryRoot: string;
  runsDirectory: string;
  workspaceDirectory: string;
  fluxiqRepositoryRoot: string;
  fluxiqRoot: string;
  storageDirectory: string;
  origin: string;
  gatewayUrl: string;
  username: string;
  password: string;
  pin: string;
  totp?: string;
  projectId?: string;
  projectName: string;
  flowId: string;
  flowName: string;
  headless: boolean;
};

export type DemoWorkspaceState = {
  schemaVersion: typeof SCHEMA_VERSION;
  origin: string;
  username: string;
  projectId: string;
  flowId: string;
  subflowId: string;
  graphFlowId: string;
  routerId: string;
  projectName: string;
  flowName: string;
  latestRecordingId?: string;
  latestRuntimeRunId?: string;
  updatedAt: string;
};
type LegacyDemoWorkspaceState = Omit<DemoWorkspaceState, "schemaVersion" | "subflowId" | "graphFlowId" | "routerId"> & { schemaVersion: "0.2" };

export function resolveDemoWorkspaceConfiguration(repositoryRoot: string, env: NodeJS.ProcessEnv): DemoWorkspaceConfiguration {
  const root = path.resolve(repositoryRoot);
  const runsDirectory = path.resolve(env.FLUXIQ_TEST_RUNS_DIR ?? path.join(root, "test-runs"));
  const workspaceDirectory = path.resolve(env.FLUXIQ_DEMO_RUN_DIR?.trim() || path.join(runsDirectory, "web-extension-demo"));
  const relative = path.relative(runsDirectory, workspaceDirectory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("FLUXIQ_DEMO_RUN_DIR must resolve below FLUXIQ_TEST_RUNS_DIR");
  }
  const fluxiqRepositoryRoot = path.resolve(env.FLUXIQ_CORE_ROOT?.trim() || path.join(root, "..", "!FluxIQ"));
  const fluxiqRoot = path.join(workspaceDirectory, "fluxiq-root");
  const origin = exactHttpOrigin(env.FLUXIQ_DEMO_BASE_URL?.trim() || "http://127.0.0.1:3300", "FLUXIQ_DEMO_BASE_URL");
  const gatewayUrl = requireSecureGatewayUrl(env.FLUXIQ_DEMO_GATEWAY_URL?.trim() || "ws://127.0.0.1:4877/client", "FLUXIQ_DEMO_GATEWAY_URL");
  requireLoopbackEndpoint(origin, "FLUXIQ_DEMO_BASE_URL");
  requireLoopbackEndpoint(gatewayUrl, "FLUXIQ_DEMO_GATEWAY_URL");
  return {
    repositoryRoot: root,
    runsDirectory,
    workspaceDirectory,
    fluxiqRepositoryRoot,
    fluxiqRoot,
    storageDirectory: path.join(fluxiqRoot, ".fluxiq"),
    origin,
    gatewayUrl,
    username: required(env.FLUXIQ_TEST_USERNAME, "FLUXIQ_TEST_USERNAME"),
    password: required(env.FLUXIQ_TEST_PASSWORD, "FLUXIQ_TEST_PASSWORD"),
    pin: required(env.FLUXIQ_TEST_PIN, "FLUXIQ_TEST_PIN"),
    ...(env.FLUXIQ_TEST_TOTP?.trim() ? { totp: env.FLUXIQ_TEST_TOTP.trim() } : {}),
    ...(env.FLUXIQ_DEMO_PROJECT_ID?.trim()
      ? { projectId: safeId(env.FLUXIQ_DEMO_PROJECT_ID, "FLUXIQ_DEMO_PROJECT_ID") }
      : {}),
    projectName: env.FLUXIQ_DEMO_PROJECT_NAME?.trim() || "FluxIQ Web Extension Test",
    flowId: safeId(env.FLUXIQ_DEMO_FLOW_ID?.trim() || "flow.web-extension-demo", "FLUXIQ_DEMO_FLOW_ID"),
    flowName: env.FLUXIQ_DEMO_FLOW_NAME?.trim() || "Web Extension Demo Flow",
    headless: optionalBoolean(env.FLUXIQ_DEMO_HEADLESS, "FLUXIQ_DEMO_HEADLESS", true),
  };
}

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
        await evidence.step("scenario", "select-plan", "Select the team plan", () => scenarioPage.getByTestId("plan").selectOption("team"));
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

function credentialLiterals(config: DemoWorkspaceConfiguration): string[] {
  return [config.password, config.pin, ...(config.totp ? [config.totp] : [])];
}

function assertDemoBlankStateSecrets(state: BlankLlmPreparationState, config: DemoWorkspaceConfiguration): void {
  const serialized = JSON.stringify(state);
  if (credentialLiterals(config).some(value => value.length > 0 && serialized.includes(value))) throw new RunnerFailure("recording.persistence", "Blank LLM preparation metadata contains credential material");
}
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

export async function runDemoLlmCreationSettingsProbe(config: DemoWorkspaceConfiguration): Promise<Readonly<{ status: "passed" }>> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control, panelCookie } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "Run pnpm demo:llm:prepare before the settings probe");
    assertDemoBlankStateSecrets(prepared, config);
    await assertGenuinelyBlankFlow(control, prepared);
    const beforeRecordings = recordingIds(await control.listRecordings(prepared.projectId));
    const project = await control.requireProject(prepared.projectId, "web-automation");
    return withDemoBrowser(config, panelCookie, "demo-llm-create-settings", async ({ panelPage, evidence }) => {
      await openProjectInPanel(panelPage, config.origin, project.name, evidence);
      const flowTreeItemId = await openFlowInCurrentProject(panelPage, BLANK_LLM_FLOW_NAME, evidence);
      await configureFirstLiveCreationViaUi(panelPage, flowTreeItemId, config.pin, evidence);
      await assertGenuinelyBlankFlow(control, prepared);
      assertRecordingSetUnchanged(beforeRecordings, await control.listRecordings(prepared.projectId));
      return Object.freeze({ status: "passed" as const });
    });
  }));
}
export async function runDemoLlmCreationReadinessProbe(config: DemoWorkspaceConfiguration): Promise<ProviderFreeGenerationReadiness> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control, panelCookie } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "Run pnpm demo:llm:prepare before the readiness probe");
    assertDemoBlankStateSecrets(prepared, config);
    await assertGenuinelyBlankFlow(control, prepared);
    const project = await control.requireProject(prepared.projectId, "web-automation");
    return withDemoBrowser(config, panelCookie, "demo-llm-create-readiness", async ({ panelPage, evidence }) => {
      await openProjectInPanel(panelPage, config.origin, project.name, evidence);
      await openFlowInCurrentProject(panelPage, BLANK_LLM_FLOW_NAME, evidence);
      return assertProviderFreeGenerationReadiness(panelPage, evidence);
    }, credentialLiterals(config), BLANK_LLM_SCENARIO_PATH);
  }));
}
export async function runDemoLlmCreation(config: DemoWorkspaceConfiguration): Promise<DemoLlmCreationResult> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control, gatewayUrl, panelCookie } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "Run pnpm demo:llm:prepare before the live creation test");
    assertDemoBlankStateSecrets(prepared, config);
    await assertGenuinelyBlankFlow(control, prepared);
    const beforeRecordings = recordingIds(await control.listRecordings(prepared.projectId));
    const blankFlow = await control.getExactFlow(prepared.projectId, prepared.flowId);
    const project = await control.requireProject(prepared.projectId, "web-automation");
    return withDemoBrowser(config, panelCookie, "demo-llm-create", async ({ extensionPage, panelPage, scenarioPage, scenarioUrl, evidence }) => {
      await openProjectInPanel(panelPage, config.origin, project.name, evidence);
      let flowTreeItemId = await openFlowInCurrentProject(panelPage, BLANK_LLM_FLOW_NAME, evidence);
      await configureFirstLiveCreationViaUi(panelPage, flowTreeItemId, config.pin, evidence);
      await connectExtension(extensionPage, panelPage, control, gatewayUrl, config.origin, prepared.projectId, prepared.flowId, scenarioUrl, evidence);
      const recorderStatus = await extensionStatus(extensionPage);
      if (recorderStatus.recordingState !== "idle") throw new RunnerFailure("recording.persistence", "Live creation requires an idle recorder");
      await assertGenuinelyBlankFlow(control, prepared);
      assertRecordingSetUnchanged(beforeRecordings, await control.listRecordings(prepared.projectId));

      flowTreeItemId = await openFlowInCurrentProject(panelPage, BLANK_LLM_FLOW_NAME, evidence);
      const created = await buildApproveApplyCreationViaUi({
        page: panelPage, flowTreeItemId, projectId: prepared.projectId, flowId: prepared.flowId,
        password: config.password, pin: config.pin, evidence, control, blankContentHash: blankFlow.contentHash,
      });
      assertRecordingSetUnchanged(beforeRecordings, await control.listRecordings(prepared.projectId));
      if ((await extensionStatus(extensionPage)).recordingState !== "idle") throw new RunnerFailure("recording.persistence", "Live creation activated the recorder");

      const runtimeState: DemoWorkspaceState = {
        schemaVersion: SCHEMA_VERSION, origin: config.origin, username: config.username,
        projectId: prepared.projectId, flowId: prepared.flowId, projectName: project.name, flowName: BLANK_LLM_FLOW_NAME,
        subflowId: created.topology.ownedSubflowId, graphFlowId: created.topology.graphFlowId, routerId: created.topology.routerId,
        updatedAt: new Date().toISOString(),
      };
      await openFlowInCurrentProject(panelPage, BLANK_LLM_FLOW_NAME, evidence);
      const initial = await runDemoFlowFromPanel(panelPage, runtimeState, evidence);
      const initialDetail = await waitForRoutedRunDetail(control, runtimeState, initial.runId, created.topology.nodeCount);
      if (initialDetail.summary.status !== "succeeded" || initialDetail.actionAttempts.some(item => item.status !== "succeeded")) throw new RunnerFailure("runtime.behavior", "The newly applied Flow did not complete successfully through the panel UI");
      await scenarioPage.getByTestId("result").filter({ hasText: "Submitted: Ada / team" }).waitFor({ timeout: 30_000 });

      await evidence.step("scenario", "create-replay-reset", "Reload the instruction-only scenario before deterministic replay", () => scenarioPage.goto(scenarioUrl).then(() => undefined));
      await openFlowInCurrentProject(panelPage, BLANK_LLM_FLOW_NAME, evidence);
      const replay = await runDemoFlowFromPanel(panelPage, runtimeState, evidence);
      const replayDetail = await waitForRoutedRunDetail(control, runtimeState, replay.runId, created.topology.nodeCount);
      if (replayDetail.summary.status !== "succeeded" || (replayDetail.providerCallCount ?? 0) !== 0 || (replayDetail.interventions?.length ?? 0) !== 0) throw new RunnerFailure("runtime.behavior", "Deterministic replay failed or invoked the LLM");
      await scenarioPage.getByTestId("result").filter({ hasText: "Submitted: Ada / team" }).waitFor({ timeout: 30_000 });
      assertRecordingSetUnchanged(beforeRecordings, await control.listRecordings(prepared.projectId));

      const generation = created.generation;
      const evaluated = evaluateDemoLlmCreation({
        schemaVersion: "0.1", operationId: `creation.${randomBytes(12).toString("hex")}`,
        blankBefore: { certified: true, projectId: prepared.projectId, flowId: prepared.flowId, baseExecutionDigest: generation.baseExecutionDigest, nodeCount: 0, edgeCount: 0, ownedSubflowCount: 0, routerSubflowRouteCount: 0, recordingCount: beforeRecordings.size, recordingProvenanceAbsent: true },
        invocations: [{ requestId: generation.requestId, purpose: "flow_bootstrap", provider: generation.provider, model: generation.model, promptSchemaVersion: generation.promptSchemaVersion, attempt: 1, retryCount: 0, providerCallCount: 1, inputTokens: generation.inputTokens, outputTokens: generation.outputTokens, totalTokens: generation.totalTokens, estimatedCostUsd: generation.estimatedCostUsd, latencyMs: generation.latencyMs }],
        proposal: { proposalId: generation.adaptationId, proposalDigest: generation.proposalDigest, baseExecutionDigest: generation.baseExecutionDigest, validationOk: true, stale: false, unsupportedOutputCount: 0 },
        review: { proposalId: generation.adaptationId, outcome: "approved", channel: "human-ui", mutationObservedBeforeApproval: false },
        apply: { proposalId: generation.adaptationId, baseExecutionDigest: generation.baseExecutionDigest, resultingExecutionDigest: created.topology.resultingExecutionDigest, outcome: "applied", routerId: created.topology.routerId, routerSubflowId: created.topology.routerSubflowId, ownedSubflowId: created.topology.ownedSubflowId, graphFlowId: created.topology.graphFlowId, ownedSubflowCount: 1, routerSubflowRouteCount: 1, nodeCount: created.topology.nodeCount, edgeCount: created.topology.edgeCount, executableNodeCount: created.topology.executableNodeCount, overlappingPositionCount: 0, deterministicLayout: true, unsupportedOutputCount: 0, recordingCount: beforeRecordings.size, recordingProvenanceAbsent: true },
        replay: { runId: replay.runId, status: "succeeded", executionDigest: created.topology.resultingExecutionDigest, providerCallCount: 0, interventionCount: 0, actionAttemptCount: replayDetail.actionAttempts.length, succeededActionCount: replayDetail.actionAttempts.filter(item => item.status === "succeeded").length },
      });
      return persistDemoLlmCreationResult(config.workspaceDirectory, evaluated, credentialLiterals(config));
    }, credentialLiterals(config), BLANK_LLM_SCENARIO_PATH);
  }));
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
      const diagnosis = await runDiagnosisFromPanel(panelPage, diagnosisFlowTreeItemId, config.password, config.pin, evidence);
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

function isTerminalRuntimeStatus(status: string): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}

async function waitForInstructionLibraryIdle(page: Page, shell: Locator, timeoutMs = 10_000): Promise<void> {
  const list = shell.locator(".automation-instruction-list");
  await list.waitFor({ state: "visible", timeout: timeoutMs });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await list.getAttribute("aria-busy") === "false") return;
    await page.waitForTimeout(50);
  }
  throw new RunnerFailure("runtime.behavior", "The Flow Instructions library did not become ready");
}

async function ensureLlmDiagnosisInstructionViaUi(page: Page, flowTreeItemId: string, pin: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const hierarchySearch = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "llm-instruction-search", "Search the exact Flow hierarchy for Instructions", () => hierarchySearch.fill("Instructions"));
  const instructionRows = hierarchy.locator(`.automation-tree-item[data-tree-parent-id="${escapeCssAttribute(flowTreeItemId)}"][aria-label="Instructions"] .tree-row-main.type-flow-object`);
  await instructionRows.first().waitFor({ state: "visible", timeout: 10_000 });
  if (await instructionRows.count() !== 1) throw new RunnerFailure("runtime.behavior", "The exact Flow Instructions hierarchy row is unavailable");
  await evidence.step("panel", "llm-instruction-open", "Open Instructions for the exact prepared Flow", () => instructionRows.click());
  const shell = page.locator(".automation-instructions-shell");
  await shell.waitFor({ state: "visible", timeout: 30_000 });
  await evidence.step("panel", "llm-instruction-hierarchy-clear", "Clear the hierarchy search after Instructions opens", () => hierarchySearch.fill(""));

  const libraryTab = shell.getByRole("tab", { name: "Library", exact: true });
  if (await libraryTab.getAttribute("aria-selected") !== "true") {
    await evidence.step("panel", "llm-instruction-library", "Open the Flow Instruction Library", () => libraryTab.click());
  }
  const filters = [
    ["status", shell.getByRole("combobox", { name: "Filter instructions by status", exact: true })],
    ["requirement", shell.getByRole("combobox", { name: "Filter instructions by requirement", exact: true })],
  ] as const;
  for (const [name, filter] of filters) {
    if (await filter.inputValue({ timeout: 2_000 }) !== "") {
      await evidence.step("panel", `llm-instruction-${name}-filter-reset`, `Clear the persisted Instruction ${name} filter`, () => filter.selectOption(""));
    }
  }
  const scopeFilter = shell.getByRole("combobox", { name: "Filter instructions by scope", exact: true });
  if (await scopeFilter.inputValue({ timeout: 2_000 }) !== "flow") {
    await evidence.step("panel", "llm-instruction-scope-filter", "Restrict the Instruction Library to this Flow scope", () => scopeFilter.selectOption("flow"));
  }
  const instructionSearch = shell.getByRole("searchbox", { name: "Search instructions", exact: true });
  await evidence.step("panel", "llm-instruction-title-search", "Search for the bounded diagnosis instruction", () => instructionSearch.fill(LLM_DIAGNOSIS_INSTRUCTION_TITLE));
  await page.waitForTimeout(300);
  await waitForInstructionLibraryIdle(page, shell);
  const titlePattern = new RegExp(`^${escapeRegExp(LLM_DIAGNOSIS_INSTRUCTION_TITLE)}$`);
  const matches = shell.locator(".automation-instruction-list > button").filter({
    has: page.locator(".automation-instruction-title").filter({ hasText: titlePattern }),
  }).filter({
    has: page.locator(".automation-instruction-meta").filter({ hasText: /^Flow \|/u }),
  });
  const matchCount = await matches.count();
  if (matchCount > 1) throw new RunnerFailure("runtime.behavior", "The bounded diagnosis instruction is not unique");

  if (matchCount === 1) {
    await evidence.step("panel", "llm-instruction-edit", "Open the existing bounded diagnosis instruction", () => matches.click());
  } else {
    await evidence.step("panel", "llm-instruction-create", "Create the bounded diagnosis instruction", () => shell.getByRole("button", { name: "New Instruction", exact: true }).click());
  }

  const editor = shell.locator(".automation-instruction-editor-pane:not([hidden])");
  await editor.waitFor({ state: "visible", timeout: 10_000 });
  const editorDeadline = Date.now() + 10_000;
  while (Date.now() < editorDeadline && await editor.getAttribute("aria-busy") !== "false") await page.waitForTimeout(50);
  if (await editor.getAttribute("aria-busy") !== "false") throw new RunnerFailure("runtime.behavior", "The bounded diagnosis instruction editor did not become ready");

  const title = editor.getByPlaceholder("Instruction title", { exact: true });
  if (await title.inputValue() !== LLM_DIAGNOSIS_INSTRUCTION_TITLE) {
    await evidence.step("panel", "llm-instruction-title", "Set the bounded diagnosis instruction title", () => title.fill(LLM_DIAGNOSIS_INSTRUCTION_TITLE));
  }
  const body = editor.getByPlaceholder("Tell FluxIQ what to prefer, avoid, require, or clarify for this Flow.", { exact: true });
  if (await body.inputValue() !== LLM_DIAGNOSIS_INSTRUCTION_BODY) {
    await evidence.step("panel", "llm-instruction-body", "Set the bounded diagnosis-only safety instruction", () => body.fill(LLM_DIAGNOSIS_INSTRUCTION_BODY));
  }
  const scope = editor.locator(".automation-instruction-scope-control select");
  if (await scope.inputValue() !== "flow") {
    await evidence.step("panel", "llm-instruction-scope", "Scope the bounded instruction to this Flow", () => scope.selectOption("flow"));
  }
  const required = editor.getByRole("button", { name: "Required", exact: true });
  if (await required.getAttribute("aria-pressed") !== "true") {
    await evidence.step("panel", "llm-instruction-required", "Mark the diagnosis safety instruction required", () => required.click());
  }
  const active = editor.getByRole("button", { name: "Active", exact: true });
  if (await active.getAttribute("aria-pressed") !== "true") {
    await evidence.step("panel", "llm-instruction-active", "Activate the bounded diagnosis instruction", () => active.click());
  }

  const save = editor.getByRole("button", { name: "Save Instruction", exact: true });
  if (await save.isEnabled()) {
    await evidence.step("panel", "llm-instruction-save", "Request the bounded diagnosis instruction save", () => save.click());
    const dialog = page.getByRole("dialog", { name: "Authorize Instruction Save", exact: true });
    await evidence.step("panel", "llm-instruction-pin", "Authorize the bounded diagnosis instruction save", () => dialog.getByLabel("Security PIN", { exact: true }).fill(pin), { sensitive: true });
    await evidence.step("panel", "llm-instruction-authorize", "Save the bounded diagnosis instruction", () => dialog.getByRole("button", { name: "Authorize and Save", exact: true }).click(), { sensitive: true });
    await dialog.waitFor({ state: "hidden", timeout: 30_000 });
    await editor.getByText("All changes saved", { exact: true }).waitFor({ timeout: 30_000 });
  }

  if (await title.inputValue() !== LLM_DIAGNOSIS_INSTRUCTION_TITLE
    || await body.inputValue() !== LLM_DIAGNOSIS_INSTRUCTION_BODY
    || await scope.inputValue() !== "flow"
    || await required.getAttribute("aria-pressed") !== "true"
    || await active.getAttribute("aria-pressed") !== "true") {
    throw new RunnerFailure("runtime.behavior", "The bounded diagnosis instruction was not saved as an active Flow instruction");
  }
  await evidence.step("panel", "llm-instruction-library-verify", "Return to the Library to verify the saved active Flow instruction", () => libraryTab.click());
  await page.waitForTimeout(300);
  await waitForInstructionLibraryIdle(page, shell);
  const verifiedMatches = shell.locator(".automation-instruction-list > button").filter({
    has: page.locator(".automation-instruction-title").filter({ hasText: titlePattern }),
  }).filter({
    has: page.locator(".automation-instruction-meta").filter({ hasText: /^Flow \|/u }),
  });
  if (await verifiedMatches.count() !== 1
    || await verifiedMatches.locator('.status-badge-pill[title="active"]').count() !== 1
    || await verifiedMatches.getByText("required", { exact: true }).count() !== 1) {
    throw new RunnerFailure("runtime.behavior", "The Instruction Library did not confirm one active required Flow instruction");
  }
  await evidence.diagnostic("panel", "llm-instruction-ready", "llm-instruction.ready", {
    unique: true,
    active: true,
    flowScoped: true,
    required: true,
  });
}

async function configureFirstLiveDiagnosisViaUi(page: Page, flowTreeItemId: string, pin: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "llm-settings-search", "Search the exact Flow hierarchy for Settings", () => search.fill("Settings"));
  const settingsRows = hierarchy.locator(`.automation-tree-item[data-tree-parent-id="${escapeCssAttribute(flowTreeItemId)}"][aria-label="Settings"] .tree-row-main.type-flow-object`);
  await settingsRows.first().waitFor({ timeout: 10_000 });
  if (await settingsRows.count() !== 1) throw new RunnerFailure("runtime.behavior", "The exact Flow Settings hierarchy row is unavailable");
  await evidence.step("panel", "llm-settings-open", "Open Settings for the exact prepared Flow", () => settingsRows.click());
  const workspace = page.locator(".automation-flow-settings-workspace");
  await workspace.waitFor({ timeout: 30_000 });
  await evidence.step("panel", "llm-settings-search-clear", "Clear the hierarchy search after Settings opens", () => search.fill(""));
  await workspace.getByText("Loading saved Flow settings...", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
  const settingsNavigation = workspace.getByRole("navigation", { name: "Flow settings sections", exact: true });
  const sectionButton = settingsNavigation.locator('button[aria-controls="flow-settings-llm"]');
  await sectionButton.waitFor({ state: "visible", timeout: 10_000 });
  if (await sectionButton.count() !== 1) throw new RunnerFailure("runtime.behavior", "The LLM Connection settings section is unavailable");
  await evidence.step("panel", "llm-settings-section", "Open the LLM Connection settings section", () => sectionButton.click());
  const sectionDeadline = Date.now() + 2_000;
  while (Date.now() < sectionDeadline && await sectionButton.getAttribute("aria-current") !== "location") await page.waitForTimeout(50);
  if (await sectionButton.getAttribute("aria-current") !== "location") throw new RunnerFailure("runtime.behavior", "The LLM Connection settings section did not become active");
  const llmSection = workspace.locator("#flow-settings-llm");
  const provider = llmSection.getByLabel("Provider", { exact: true });
  await provider.waitFor({ state: "visible", timeout: 10_000 });
  if (await provider.count() !== 1) throw new RunnerFailure("runtime.behavior", "The exact LLM Provider field is unavailable");
  await evidence.step("panel", "llm-settings-provider", "Select DeepSeek", () => provider.selectOption("deepseek"));
  const model = llmSection.getByLabel("Model", { exact: true });
  if (await model.count() !== 1) throw new RunnerFailure("runtime.behavior", "The exact LLM Model field is unavailable");
  await evidence.step("panel", "llm-settings-model", "Select deepseek-chat", () => model.selectOption("deepseek-chat"));
  await evidence.step("panel", "llm-settings-key", "Select the opaque Testing Lab DeepSeek key summary", async () => {
    const key = workspace.getByRole("combobox", { name: "Encrypted API key", exact: true });
    await key.fill(TESTING_LAB_DEEPSEEK_KEY_NAME);
    await workspace.getByRole("option", { name: new RegExp("^" + escapeRegExp(TESTING_LAB_DEEPSEEK_KEY_NAME)) }).click();
  });
  for (const [label, value] of [["Input tokens", "2000"], ["Output tokens", "512"], ["Total tokens", "3000"], ["Max calls", "1"], ["Timeout (seconds)", "20"], ["Max cost (USD)", "0.25"], ["Provider retries", "0"]] as const) {
    const input = llmSection.getByLabel(label, { exact: true });
    if (await input.count() !== 1) throw new RunnerFailure("runtime.behavior", "An exact bounded LLM setting field is unavailable");
    await evidence.step("panel", "llm-settings-" + label.toLowerCase().replace(/[^a-z]+/gu, "-"), `Set ${label} to its first-live bound`, () => input.fill(value));
  }
  const save = workspace.getByRole("button", { name: "Save Settings", exact: true });
  if (await save.isEnabled()) {
    await evidence.step("panel", "llm-settings-save", "Request the bounded Flow Settings save", () => save.click());
    const dialog = page.getByRole("dialog", { name: "Authorize Flow Settings Save" });
    await evidence.step("panel", "llm-settings-pin", "Authorize the bounded Flow Settings save", () => dialog.getByLabel("Security PIN", { exact: true }).fill(pin), { sensitive: true });
    await evidence.step("panel", "llm-settings-authorize", "Save the bounded Flow Settings", () => dialog.getByRole("button", { name: "Authorize and Save" }).click(), { sensitive: true });
    await dialog.waitFor({ state: "hidden", timeout: 30_000 });
  }
  await workspace.getByText("All Flow settings saved", { exact: true }).waitFor({ timeout: 30_000 });
}

async function runDiagnosisFromPanel(page: Page, flowTreeItemId: string, password: string, pin: string, evidence: BrowserEvidenceRecorder): Promise<{ runId: string; status: string }> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "llm-runtime-search", "Search the exact Flow hierarchy for Runtime Debug", () => search.fill("Runtime Debug"));
  const runtimeRows = hierarchy.locator(`.automation-tree-item[data-tree-parent-id="${escapeCssAttribute(flowTreeItemId)}"][aria-label="Runtime Debug"] .tree-row-main.type-flow-object`);
  await runtimeRows.first().waitFor({ timeout: 10_000 });
  if (await runtimeRows.count() !== 1) throw new RunnerFailure("runtime.behavior", "The exact Flow Runtime Debug row is unavailable");
  await evidence.step("panel", "llm-runtime-open", "Open Runtime Debug for the exact prepared Flow", () => runtimeRows.click());
  const runCommand = page.locator(".automation-runtime-run-command");
  await runCommand.waitFor({ timeout: 30_000 });
  await evidence.step("panel", "llm-runtime-search-clear", "Clear the hierarchy search after Runtime Debug opens", () => search.fill(""));
  await page.getByText("Checking Flow readiness...", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
  const runButton = runCommand.getByRole("button", { name: "Run", exact: true });
  const initialRunEnabled = await runButton.isEnabled({ timeout: 2_000 });
  if (!initialRunEnabled) {
    const missingActiveInstruction = await page.getByText("Add at least one active instruction.", { exact: false }).isVisible({ timeout: 2_000 }).catch(() => false);
    await evidence.diagnostic("panel", "llm-runtime-not-ready", "llm-runtime.readiness", { runEnabled: false, missingActiveInstruction });
    throw new RunnerFailure("runtime.behavior", "The prepared Flow is not ready for an authorized diagnosis-only run");
  }
  await evidence.step("panel", "llm-runtime-mode", "Select diagnosis_only mode", () => runCommand.getByRole("button", { name: "LLM diagnosis", exact: true }).click());
  if (!await runButton.isEnabled({ timeout: 2_000 })) {
    await evidence.diagnostic("panel", "llm-runtime-mode-not-ready", "llm-runtime.mode-readiness", { runEnabled: false, missingActiveInstruction: false });
    throw new RunnerFailure("runtime.behavior", "Diagnosis-only mode did not remain ready to run");
  }
  await evidence.step("panel", "llm-runtime-run-request", "Request exactly one diagnosis-only run", () => runButton.click());
  const dialog = page.getByRole("dialog", { name: "Authorize LLM Diagnosis" });
  await evidence.step("panel", "llm-runtime-password", "Enter the one-use diagnosis password", () => dialog.getByLabel("Account password", { exact: true }).fill(password), { sensitive: true });
  await evidence.step("panel", "llm-runtime-pin", "Enter the one-use diagnosis PIN", () => dialog.getByLabel("Security PIN", { exact: true }).fill(pin), { sensitive: true });
  const response = await evidence.step("panel", "llm-runtime-authorize", "Authorize and start one diagnosis-only run", () => waitForPanelRunResponse(page, () => dialog.getByRole("button", { name: "Authorize One Diagnosis" }).click()), { sensitive: true });
  const body = await response.json() as any;
  const runId = body?.payload?.runtimeSession?.runId;
  if (!response.ok() || typeof runId !== "string") throw new RunnerFailure("runtime.behavior", "The authorized diagnosis-only run failed to return a bounded run identity");
  return { runId, status: String(body?.payload?.runtimeSession?.status ?? "unknown") };
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

async function withPersistentDemoCore<T>(config: DemoWorkspaceConfiguration, operation: () => Promise<T>): Promise<T> {
  const sessionId = `run-${new Date().toISOString().replace(/[:.]/gu, "-")}-${randomBytes(4).toString("hex")}`;
  const sessionsDirectory = path.join(config.workspaceDirectory, process.platform === "win32" ? ".s" : ".sessions");
  const sessionDirectoryName = process.platform === "win32" ? randomBytes(6).toString("hex") : sessionId;
  const sessionDirectory = path.join(sessionsDirectory, sessionDirectoryName);
  const coreWorkspaceDirectory = path.join(sessionDirectory, process.platform === "win32" ? "c" : "core-workspace");
  const webWorkspaceDirectory = process.platform === "win32"
    ? path.join(coreWorkspaceDirectory, "a", "w")
    : path.join(coreWorkspaceDirectory, "apps", "web");
  const logsDirectory = path.join(config.workspaceDirectory, "logs");
  const hostModulePath = path.join(config.repositoryRoot, "domain", "dist", "host", "web-panel-host.cjs");
  const webPort = explicitPort(config.origin, "FLUXIQ_DEMO_BASE_URL");
  const gatewayPort = explicitPort(config.gatewayUrl, "FLUXIQ_DEMO_GATEWAY_URL");
  if (webPort === gatewayPort) throw new Error("FLUXIQ_DEMO_BASE_URL and FLUXIQ_DEMO_GATEWAY_URL must use different ports");

  await requirePaths([
    path.join(config.fluxiqRepositoryRoot, "apps", "web", "package.json"),
    path.join(config.fluxiqRepositoryRoot, "apps", "web", "node_modules"),
  ]);
  await mkdir(config.fluxiqRoot, { recursive: true, mode: 0o700 });
  await mkdir(config.storageDirectory, { recursive: true, mode: 0o700 });
  await mkdir(sessionsDirectory, { recursive: true, mode: 0o700 });
  await mkdir(webWorkspaceDirectory, { recursive: true, mode: 0o700 });
  if (process.platform === "win32") {
    for (const directory of [config.fluxiqRoot, config.storageDirectory, sessionsDirectory]) {
      await hardenWindowsPrivatePath(directory, "directory");
    }
  }

  const supervisor = new ProcessSupervisor();
  try {
    await supervisor.run({
      name: "demo-host-build",
      command: executable("node"),
      args: [path.join(config.repositoryRoot, "domain", "scripts", "build-web-panel-host.mjs")],
      cwd: config.repositoryRoot,
      env: process.env,
      logPath: processLogPath(logsDirectory, `${sessionId}-host-build`),
    });
    await supervisor.run({
      name: "demo-domain-setup",
      command: executable("node"),
      args: [path.join(config.repositoryRoot, "domain", "scripts", "setup-fluxiq.mjs")],
      cwd: config.repositoryRoot,
      env: { ...process.env, FLUXIQ_WEB_AUTOMATION_ROOT: config.fluxiqRoot },
      logPath: processLogPath(logsDirectory, `${sessionId}-domain-setup`),
    });
    await ensureDemoIdentity(config);
    const nextExecutable = await prepareWebWorkspace(config.fluxiqRepositoryRoot, webWorkspaceDirectory);
    const scenarioPort = await allocateLoopbackPort();
    const allocation = {
      runId: sessionId,
      runRoot: sessionDirectory,
      fluxiqRoot: config.fluxiqRoot,
      storageDir: config.storageDirectory,
      browserProfileDir: path.join(config.workspaceDirectory, "browser-profile-isolated"),
      coreWorkspaceDir: coreWorkspaceDirectory,
      webWorkspaceDir: webWorkspaceDirectory,
      logsDir: logsDirectory,
      scenarioPort,
      webPort,
      gatewayPort,
      controllerToken: randomBytes(32).toString("base64url"),
    };
    supervisor.start({
      name: "demo-fluxiq-web",
      command: nextExecutable,
      args: ["dev", "--turbopack", "--hostname", "127.0.0.1", "--port", String(webPort)],
      cwd: webWorkspaceDirectory,
      shell: process.platform === "win32",
      env: buildFluxIQEnvironment(allocation, {
        repositoryRoot: config.repositoryRoot,
        fluxiqRepositoryRoot: config.fluxiqRepositoryRoot,
        hostModulePath,
      }),
      logPath: processLogPath(logsDirectory, `${sessionId}-core`),
    });
    await waitForHttp(config.origin, { timeoutMs: 60_000 });
    await fetch(`${config.origin}/api/client-gateway/snapshot`, { signal: AbortSignal.timeout(30_000) }).catch(() => undefined);
    await waitForTcpGateway(gatewayPort, 60_000);
    return await operation();
  } finally {
    try { await supervisor.cleanup(); }
    finally {
      const expected = path.join(sessionsDirectory, sessionDirectoryName);
      if (path.resolve(sessionDirectory) !== path.resolve(expected) || path.dirname(path.resolve(sessionDirectory)) !== path.resolve(sessionsDirectory)) {
        throw new Error("Refused to remove a demo session outside its workspace");
      }
      await rm(sessionDirectory, { recursive: true, force: true });
    }
  }
}

async function ensureDemoIdentity(config: DemoWorkspaceConfiguration): Promise<void> {
  const { FluxIQ } = await import("fluxiq");
  const fluxiq = FluxIQ.create({ rootDir: config.fluxiqRoot, loadEnv: false });
  await fluxiq.setup();
  const snapshot = await fluxiq.programs.identityAccess.snapshot();
  const id = "web-extension-demo-runner";
  const byId = snapshot.users.find(user => user.id === id);
  const byUsername = snapshot.users.find(user => user.username.toLowerCase() === config.username.toLowerCase());
  if (byId || byUsername) {
    if (byId?.username.toLowerCase() !== config.username.toLowerCase() || (byUsername && byUsername.id !== id)) {
      throw new RunnerFailure("environment.missing", "Persistent demo identity does not match its configured username");
    }
    try {
      await fluxiq.programs.identityAccess.authenticate({
        username: config.username,
        password: config.password,
        ...(config.totp ? { totp: config.totp } : {}),
      });
    } catch (cause) {
      throw new RunnerFailure("environment.missing", "Persistent demo credentials no longer authenticate; rotate them with pnpm demo:setup-local -- --force", { cause });
    }
    return;
  }
  await fluxiq.programs.identityAccess.upsertUser({
    id,
    username: config.username,
    displayName: "Web Extension Demo Runner",
    roleId: "admin",
    enabled: true,
    password: config.password,
    pin: config.pin,
  });
}

async function waitForTcpGateway(port: number, timeoutMs: number): Promise<void> {
  const { connect } = await import("node:net");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await new Promise<boolean>(resolve => {
      const socket = connect({ host: "127.0.0.1", port });
      socket.once("connect", () => { socket.destroy(); resolve(true); });
      socket.once("error", () => resolve(false));
    });
    if (ready) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new RunnerFailure("gateway.connection", `Timed out waiting for demo client gateway on 127.0.0.1:${port}`);
}

async function requirePaths(targets: string[]): Promise<void> {
  for (const target of targets) {
    try { await access(target); }
    catch (cause) { throw new RunnerFailure("environment.missing", `Required demo topology path is missing: ${target}`, { cause }); }
  }
}

async function authenticatedControl(config: DemoWorkspaceConfiguration): Promise<{ control: ExistingFluxIQControlClient; gatewayUrl: string; panelCookie: string }> {
  const control = new ExistingFluxIQControlClient(config.origin);
  const sessionCache = new WebPanelAuthSessionCache(config.runsDirectory);
  await control.login(
    {
      username: config.username,
      password: config.password,
      pin: config.pin,
      ...(config.totp ? { totp: config.totp } : {}),
    },
    { sessionCache },
  );
  await control.validateCurrentSession(config.username);
  const gateway = await control.gatewayDiscovery();
  const gatewayUrl = config.gatewayUrl ?? gateway.publicUrl;
  if (!gateway.enabled || !gateway.listening || !gatewayUrl) {
    throw new RunnerFailure("gateway.connection", "FluxIQ client gateway is not enabled, listening, and discoverable");
  }
  const cached = await sessionCache.load({ origin: config.origin, username: config.username }, () => true);
  if (!cached.session) throw new RunnerFailure("environment.missing", "Authenticated FluxIQ panel session was not cached");
  return { control, gatewayUrl: requireSecureGatewayUrl(gatewayUrl), panelCookie: cached.session.cookie };
}

async function provisionDemoFlow(control: ExistingFluxIQControlClient, config: DemoWorkspaceConfiguration, panelPage: Page, evidence: BrowserEvidenceRecorder, profile: DemoFlowProfile = STANDARD_DEMO_FLOW_PROFILE): Promise<DemoWorkspaceState> {
  const saved = profile.useSavedWorkspaceState ? await loadWorkspaceState(config) : undefined;
  const projects = await control.listProjects("web-automation");
  const requestedId = config.projectId ?? saved?.projectId;
  let project = requestedId ? projects.find(item => item.id === requestedId) : undefined;
  if (requestedId && !project) throw new RunnerFailure("environment.missing", "Configured demo project is not accessible");
  if (!project) {
    const named = projects.filter(item => item.name === config.projectName && item.domainId === "web-automation");
    if (named.length > 1) {
      throw new RunnerFailure("environment.missing", "More than one matching demo project exists; set FLUXIQ_DEMO_PROJECT_ID");
    }
    project = named[0];
  }
  if (!project) {
    await openAutomationStudio(panelPage, config.origin, evidence);
    await evidence.step("panel", "project-create-open", "Open the Create project dialog", () => panelPage.getByRole("button", { name: "Project", exact: true }).click());
    const dialog = panelPage.getByRole("dialog", { name: "Create project" });
    if (!await dialog.isVisible().catch(() => false)) {
      await dialog.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
    }
    if (!await dialog.isVisible().catch(() => false)) {
      await evidence.step("panel", "project-create-open-retry", "Retry opening Create project after panel hydration", () => panelPage.getByRole("button", { name: "Project", exact: true }).click());
      await dialog.waitFor({ state: "visible", timeout: 30_000 });
    }
    await evidence.step("panel", "project-name", "Enter the demo project name", () => dialog.getByLabel("Project name").fill(config.projectName));
    await evidence.step("panel", "project-description", "Enter the demo project description", () => dialog.getByLabel("Description").fill("Persistent self-recording workspace for the FluxIQ web extension"));
    await evidence.step("panel", "project-pin", "Authorize demo project creation", () => dialog.getByLabel("Security PIN").fill(config.pin), { sensitive: true });
    await evidence.step("panel", "project-create-submit", "Create the demo project", () => dialog.getByRole("button", { name: "Create project" }).click(), { sensitive: true });
    await panelPage.locator(".automation-studio-sidebar-heading").getByText(config.projectName, { exact: true }).waitFor();
    const created = (await control.listProjects("web-automation")).filter(item => item.name === config.projectName);
    if (created.length !== 1) throw new RunnerFailure("environment.missing", "Panel project creation did not produce one web-automation project");
    project = created[0]!;
  }
  if (project.domainId !== "web-automation") {
    throw new RunnerFailure("environment.missing", "Demo project must be bound to the web-automation domain");
  }
  await openProjectInPanel(panelPage, config.origin, project.name, evidence);
  const summaries = await control.listFlowSummaries(project.id);
  const requestedFlowId = saved?.flowId ?? config.flowId;
  let summary = summaries.find(item => item.flowId === requestedFlowId) ?? summaries.find(item => item.name === config.flowName);
  if (!summary) {
    await evidence.step("panel", "flow-create-open", "Open the Add Flow dialog", () => panelPage.getByRole("button", { name: "Add Flow" }).click());
    const dialog = panelPage.getByRole("dialog");
    await evidence.step("panel", "flow-create-kind", "Choose a Flow hierarchy item", () => dialog.getByRole("button", { name: /^Flow/u }).click());
    await evidence.step("panel", "flow-create-name", "Enter the demo Flow name", () => dialog.getByLabel("Name").fill(config.flowName));
    await evidence.step("panel", "flow-create-preset", "Choose the deterministic Flow preset", () => dialog.getByLabel("Flow preset").selectOption("deterministic"));
    await evidence.step("panel", "flow-create-pin", "Authorize demo Flow creation", () => dialog.getByLabel("Security PIN").fill(config.pin), { sensitive: true });
    await evidence.step("panel", "flow-create-submit", "Create the demo Flow", () => dialog.getByRole("button", { name: "Create", exact: true }).click(), { sensitive: true });
    const createdSummary = await waitForNamedFlow(control, project.id, config.flowName);
    summary = createdSummary;
    if (!await hierarchyRow(panelPage, config.flowName).isVisible().catch(() => false)) {
      await evidence.step("panel", "flow-create-refresh", "Refresh the panel after Flow creation", () => panelPage.reload({ waitUntil: "domcontentloaded" }).then(() => undefined));
      await panelPage.locator(".automation-studio-sidebar-heading").getByText(project.name, { exact: true }).waitFor();
      await hierarchyRow(panelPage, config.flowName).waitFor();
    }
  }
  let flow = await control.getExactFlow(project.id, summary.flowId);
  const legacyParentFixture = isDemoFixtureDocument(flow.document, project.id, flow.flowId, config.flowName);
  const parentRepresentationKind = (flow.document.metadata as Record<string, unknown> | undefined)?.flowRepresentationKind;
  const recoverableInterruptedParent = isEmptyDemoFlow(flow.document, project.id, flow.flowId, config.flowName)
    && (parentRepresentationKind === undefined || parentRepresentationKind === "legacy_single_graph");
  if (!legacyParentFixture && !recoverableInterruptedParent) assertDemoParentDocument(flow.document, project.id, flow.flowId, config.flowName);
  const subflows = await control.listFlowSubflows(project.id, flow.flowId);
  const namedSubflows = subflows.filter(item => item.name === profile.subflowName);
  if (namedSubflows.length > 1) throw new RunnerFailure("environment.missing", `More than one demo Subflow named ${profile.subflowName} exists`);
  let subflow = namedSubflows[0];
  if (!subflow) {
    await createDemoSubflowInPanel(panelPage, flow.name, config.pin, evidence, profile.subflowName);
    subflow = await waitForNamedSubflow(control, project.id, flow.flowId, profile.subflowName);
  }
  if (!subflow.graphFlowId) throw new RunnerFailure("environment.missing", "The primary demo Subflow does not own a dedicated graph Flow");
  const graphFlowId = subflow.graphFlowId;
  const graphFlow = await control.getExactFlow(project.id, graphFlowId);
  const graphFlowName = typeof graphFlow.document.name === "string" && graphFlow.document.name.trim() ? graphFlow.document.name : `${profile.subflowName} Graph`;
  assertDemoSubflowOwnership(graphFlow.document, project.id, flow.flowId, subflow.subflowId, graphFlowId);
  const graphFixtureOwned = (graphFlow.document.metadata as Record<string, unknown> | undefined)?.createdBy === "fluxiq-web-extension-demo-workspace";
  if (graphFixtureOwned && isDemoFixtureDocument(graphFlow.document, project.id, graphFlow.flowId, graphFlowName)) {
    const metadata = { ...((graphFlow.document.metadata as Record<string, unknown> | undefined) ?? {}) };
    delete metadata.createdBy;
    await evidence.step("panel", "legacy-fixture-retire", "Retire the exact legacy demo fixture before UI recording generation", () => control.saveFlow({
      projectId: project.id,
      expectedUpdatedAt: graphFlow.updatedAt,
      authorizationPin: config.pin,
      flow: { ...graphFlow.document, nodes: [], edges: [], dependencies: [], metadata },
    }).then(() => undefined));
  }
  const persistedGraph = await control.getExactFlow(project.id, graphFlowId);
  assertDemoSubflowOwnership(persistedGraph.document, project.id, flow.flowId, subflow.subflowId, graphFlowId);
  if (!isEmptyDemoFlow(persistedGraph.document, project.id, graphFlowId, graphFlowName)) {
    profile.assertRecordingDerivedFlow(persistedGraph.document);
  }  await openFlowInCurrentProject(panelPage, config.flowName, evidence);
  let router = await control.getFlowRouter(project.id, flow.flowId);
  if (router?.fallback?.kind !== "subflow" || router.fallback.subflowId !== subflow.subflowId) {
    await configureDemoRouterFallbackInPanel(panelPage, config.flowName, profile.subflowName, config.pin, evidence);
    router = await control.getFlowRouter(project.id, flow.flowId);
  }
  if (!router || router.fallback?.kind !== "subflow" || router.fallback.subflowId !== subflow.subflowId) {
    throw new RunnerFailure("environment.missing", "The demo Router does not persist a fallback to its primary Subflow");
  }
  // This is deliberately last: an interrupted migration always retains either
  // the old executable root fixture or the new verified Subflow + Router path.
  if (legacyParentFixture || recoverableInterruptedParent) {
    flow = await control.getExactFlow(project.id, flow.flowId);
    if (legacyParentFixture && !isDemoFixtureDocument(flow.document, project.id, flow.flowId, config.flowName)) throw new RunnerFailure("environment.missing", "Demo parent Flow changed during hierarchy migration");
    if (recoverableInterruptedParent && !isEmptyDemoFlow(flow.document, project.id, flow.flowId, config.flowName)) throw new RunnerFailure("environment.missing", "Interrupted demo parent Flow changed before representation repair");
    await evidence.step("panel", "legacy-parent-graph-migration", "Retire the exact fixture-owned direct parent graph through Core's verified migration boundary", () => control.migrateLegacyFlowRepresentation({
      projectId: project.id,
      flowId: flow.flowId,
      subflowId: subflow.subflowId,
      authorizationPin: config.pin,
    }));
    flow = await control.getExactFlow(project.id, flow.flowId);
  }
  assertDemoParentDocument(flow.document, project.id, flow.flowId, config.flowName);
  const state: DemoWorkspaceState = {
    schemaVersion: SCHEMA_VERSION,
    origin: config.origin,
    username: config.username,
    projectId: project.id,
    flowId: flow.flowId,
    subflowId: subflow.subflowId,
    graphFlowId,
    routerId: router.routerId,
    projectName: project.name,
    flowName: flow.name,
    ...(saved?.latestRecordingId ? { latestRecordingId: saved.latestRecordingId } : {}),
    ...(saved?.latestRuntimeRunId ? { latestRuntimeRunId: saved.latestRuntimeRunId } : {}),
    updatedAt: new Date().toISOString(),
  };
  if (profile.persistWorkspaceState) await saveWorkspaceState(config, state);
  return state;
}

async function generateDemoSubflowFromRecording(
  page: Page,
  control: ExistingFluxIQControlClient,
  config: DemoWorkspaceConfiguration,
  state: DemoWorkspaceState,
  recordingId: string,
  evidence: BrowserEvidenceRecorder,
  profile: DemoFlowProfile = STANDARD_DEMO_FLOW_PROFILE,
): Promise<DemoWorkspaceState> {
  await evidence.step("panel", "recording-generation-refresh", "Refresh the panel to load the persisted recording", () => page.reload({ waitUntil: "domcontentloaded" }).then(() => undefined));
  await page.locator(".automation-studio-sidebar-heading").getByText(state.projectName, { exact: true }).waitFor();
  await openFlowInCurrentProject(page, state.flowName, evidence);
  const search = page.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "recording-generation-search", "Find the newly persisted recording", () => search.fill(recordingId));
  await evidence.step("panel", "recording-generation-open", "Open the newly persisted recording", () => hierarchyRow(page, recordingId).click());
  const generateButton = page.getByRole("button", { name: "Generate Subflow", exact: true });
  await generateButton.waitFor();
  await evidence.step("panel", "recording-generation-dialog", "Open deterministic Subflow generation", () => generateButton.click());
  const dialog = page.getByRole("dialog", { name: "Generate deterministic Subflow" });
  await dialog.getByLabel("Destination Flow").selectOption(state.flowId);
  await evidence.step("panel", "recording-generation-pin", "Authorize recording-derived Subflow generation", () => dialog.getByLabel("Security PIN").fill(config.pin), { sensitive: true });
  const response = await evidence.step("panel", "recording-generation-submit", "Generate the deterministic Subflow from the recording", () => (
    waitForPanelMutationResponse(page, "/api/programs/automation-studio/review-recording-flow-proposal", () => dialog.getByRole("button", { name: "Generate Subflow", exact: true }).click())
  ), { sensitive: true });
  const body = await response.json() as any;
  if (!response.ok() || body?.ok === false) throw new RunnerFailure("runtime.behavior", body?.error ?? "Panel recording generation failed");
  await dialog.waitFor({ state: "hidden" });
  const parent = await control.getExactFlow(state.projectId, state.flowId);
  assertDemoParentDocument(parent.document, state.projectId, state.flowId, state.flowName);
  if ((parent.document.metadata as Record<string, unknown> | undefined)?.lastRecordingId !== recordingId) {
    throw new RunnerFailure("runtime.behavior", "Generated parent Flow does not retain the source recording identity");
  }
  const subflow = (await control.listFlowSubflows(state.projectId, state.flowId)).find(item => item.subflowId === state.subflowId);
  if (!subflow?.graphFlowId || subflow.graphFlowId !== state.graphFlowId) throw new RunnerFailure("runtime.behavior", "Recording generation did not retain the expected primary Subflow ownership");
  const graph = await control.getExactFlow(state.projectId, state.graphFlowId);
  assertDemoSubflowOwnership(graph.document, state.projectId, state.flowId, state.subflowId, state.graphFlowId);
  profile.assertRecordingDerivedFlow(graph.document, recordingId);
  const router = await control.getFlowRouter(state.projectId, state.flowId);
  if (!router || router.routerId !== state.routerId || router.fallback?.subflowId !== state.subflowId) throw new RunnerFailure("runtime.behavior", "Recording generation did not retain the parent Router fallback");
  await evidence.step("panel", "recording-generation-result-refresh", "Reload the panel to render the persisted generated graph", () => page.reload({ waitUntil: "domcontentloaded" }).then(() => undefined));
  await page.locator(".automation-studio-sidebar-heading").getByText(state.projectName, { exact: true }).waitFor();
  await openFlowInCurrentProject(page, state.flowName, evidence);
  await openSubflowInCurrentProject(page, profile.subflowName, evidence);
  await assertDemoFlowRenderedLayout(page, evidence, profile.renderedNodeCounts);
  return state;
}

async function requireDemoFlow(control: ExistingFluxIQControlClient, config: DemoWorkspaceConfiguration): Promise<DemoWorkspaceState> {
  const state = await loadWorkspaceState(config);
  if (!state) throw new RunnerFailure("environment.missing", "Demo workspace is not provisioned; run pnpm demo:record first");
  if (state.schemaVersion !== SCHEMA_VERSION) throw new RunnerFailure("environment.missing", "Demo workspace hierarchy needs migration; run pnpm demo:record first");
  const project = await control.requireProject(state.projectId, "web-automation");
  if (project.domainId !== "web-automation") throw new RunnerFailure("environment.missing", "Saved demo project is not a web-automation project");
  const flow = await control.getExactFlow(state.projectId, state.flowId);
  assertDemoParentDocument(flow.document, state.projectId, state.flowId, state.flowName);
  const subflow = (await control.listFlowSubflows(state.projectId, state.flowId)).find(item => item.subflowId === state.subflowId);
  if (!subflow || subflow.graphFlowId !== state.graphFlowId) throw new RunnerFailure("environment.missing", "Saved demo Subflow identity no longer matches Core");
  const graphFlow = await control.getExactFlow(state.projectId, state.graphFlowId);
  assertDemoSubflowOwnership(graphFlow.document, state.projectId, state.flowId, state.subflowId, state.graphFlowId);
  const graphFlowName = typeof graphFlow.document.name === "string" && graphFlow.document.name.trim() ? graphFlow.document.name : `${DEMO_SUBFLOW_NAME} Graph`;
  if (!state.latestRecordingId) throw new RunnerFailure("environment.missing", "Demo workspace does not identify the recording that generated its Subflow");
  assertDemoRecordingDerivedFlow(graphFlow.document, state.latestRecordingId);
  const router = await control.getFlowRouter(state.projectId, state.flowId);
  if (!router || router.routerId !== state.routerId || router.fallback?.subflowId !== state.subflowId) throw new RunnerFailure("environment.missing", "Saved demo Router no longer targets its primary Subflow");
  await control.selectExistingContext(state.projectId);
  return state;
}

export function createDemoFlowDocument(created: Record<string, unknown>, projectId: string, flowId: string, name: string): Record<string, unknown> {
  const nodes = [
    { id: "start", definitionId: "builtin.control.start", label: "Start", parameterValues: {} },
    { id: "name", definitionId: "web.output.dom-type", label: "Enter name", parameterValues: { selector: "[data-testid=\"name\"]", text: "Ada" } },
    { id: "plan", definitionId: "web.output.dom-select", label: "Choose team plan", parameterValues: { selector: "[data-testid=\"plan\"]", value: "team" } },
    { id: "notes", definitionId: "web.output.dom-type", label: "Enter notes", parameterValues: { selector: "[data-testid=\"notes\"]", text: "Executed by the reusable FluxIQ demo flow" } },
    { id: "submit", definitionId: "web.output.dom-click", label: "Submit", parameterValues: { selector: "[data-testid=\"submit\"]" } },
    { id: "end", definitionId: "builtin.control.end", label: "End", parameterValues: { status: "success" } },
  ].map((node, index) => ({ ...node, definitionVersion: "1.0.0", position: { x: index * 360, y: 0 }, metadata: {} }));
  const order = nodes.map(item => item.id);
  return {
    ...created,
    schemaVersion: "0.1",
    projectId,
    flowId,
    name,
    scope: { kind: "domain", domainId: "web-automation" },
    nodes,
    edges: order.slice(0, -1).map((source, index) => ({
      id: "edge." + source + "." + order[index + 1],
      sourceNodeId: source,
      sourcePortId: "success",
      targetNodeId: order[index + 1],
      targetPortId: "in",
      metadata: {},
    })),
    dependencies: [
      { kind: "node", id: "web.output.dom-type", version: "1.0.0" },
      { kind: "node", id: "web.output.dom-select", version: "1.0.0" },
      { kind: "node", id: "web.output.dom-click", version: "1.0.0" },
    ],
    metadata: { ...((created.metadata as Record<string, unknown> | undefined) ?? {}), createdBy: "fluxiq-web-extension-demo-workspace" },
  };
}

function isEmptyDemoFlow(document: Record<string, unknown>, projectId: string, flowId: string, name: string): boolean {
  return document.projectId === projectId
    && document.flowId === flowId
    && document.name === name
    && Array.isArray(document.nodes)
    && document.nodes.length === 0
    && Array.isArray(document.edges)
    && document.edges.length === 0;
}

export function assertDemoParentDocument(document: Record<string, unknown>, projectId: string, flowId: string, name: string): void {
  const metadata = document.metadata as Record<string, unknown> | undefined;
  if (document.projectId !== projectId || document.flowId !== flowId || document.name !== name || !Array.isArray(document.nodes) || document.nodes.length || !Array.isArray(document.edges) || document.edges.length || metadata?.flowRepresentationVersion !== 1 || metadata?.flowRepresentationKind !== "orchestration" || metadata?.subflowGraph !== undefined || metadata?.parentFlowId !== undefined || metadata?.parentSubflowId !== undefined) {
    const state = { nodes: Array.isArray(document.nodes) ? document.nodes.length : "invalid", edges: Array.isArray(document.edges) ? document.edges.length : "invalid", representationVersion: metadata?.flowRepresentationVersion ?? null, representationKind: metadata?.flowRepresentationKind ?? null, hasOwnershipMetadata: metadata?.subflowGraph !== undefined || metadata?.parentFlowId !== undefined || metadata?.parentSubflowId !== undefined };
    throw new RunnerFailure("environment.missing", `Demo parent Flow must be an empty orchestration graph (${JSON.stringify(state)})`);
  }
}

export function assertDemoRecordingDerivedFlow(document: Record<string, unknown>, recordingId?: string): void {
  const nodes = Array.isArray(document.nodes) ? document.nodes as Array<Record<string, any>> : [];
  const edges = Array.isArray(document.edges) ? document.edges as Array<Record<string, any>> : [];
  const outputIds = nodes.map(node => node.parameterValues?.outputId).sort();
  const requiredOutputIds = ["web.dom.click", "web.dom.select", "web.dom.type", "web.dom.type"].sort();
  const selfContainedOutputIds = ["web.browser.navigate", ...requiredOutputIds].sort();
  const validOutputIds = stableJson(outputIds) === stableJson(requiredOutputIds) || stableJson(outputIds) === stableJson(selfContainedOutputIds);
  const validNodes = (nodes.length === 4 || nodes.length === 5) && nodes.every(node => node.definitionId === "builtin.policy.action"
    && typeof node.metadata?.recordingProposalId === "string"
    && typeof node.metadata?.actionEntryId === "string"
    && (!recordingId || Array.isArray(node.metadata?.evidence) && node.metadata.evidence.some((item: any) => item?.artifactId === recordingId)));
  const validEdges = edges.length === nodes.length - 1 && edges.every(edge => typeof edge.metadata?.recordingProposalId === "string");
  const positions = new Set(nodes.map(node => String(node.position?.x) + ":" + String(node.position?.y)));
  const navigationKinds = nodes.filter(node => node.parameterValues?.outputId === "web.browser.navigate").map(node => {
    const url = String(node.parameterValues?.parameters?.url ?? "");
    if (url.includes("fluxiqRecording=1")) return "recorded-demo";
    if (url.includes("/scenarios/basic-form/")) return "setup-demo";
    return "other";
  });
  if (!validNodes || !validEdges || positions.size !== nodes.length || !validOutputIds) {
    throw new RunnerFailure("environment.missing", `Demo Subflow is not the deterministic unedited graph generated from the expected recording (${JSON.stringify({ nodeCount: nodes.length, edgeCount: edges.length, outputIds, navigationKinds, distinctPositions: positions.size, validNodes, validEdges })})`);
  }
}

export function assertLlmDiagnosisRecordingDerivedFlow(document: Record<string, unknown>, recordingId?: string): void {
  const nodes = Array.isArray(document.nodes) ? document.nodes as Array<Record<string, any>> : [];
  const edges = Array.isArray(document.edges) ? document.edges as Array<Record<string, any>> : [];
  const outputIds = nodes.map(node => node.parameterValues?.outputId);
  const validOutputIds = outputIds.length === 1
    ? outputIds[0] === "web.dom.click"
    : outputIds.length === 2 && outputIds[0] === "web.browser.navigate" && outputIds[1] === "web.dom.click";
  const validNodes = (nodes.length === 1 || nodes.length === 2) && nodes.every(node => node.definitionId === "builtin.policy.action"
    && typeof node.metadata?.recordingProposalId === "string"
    && typeof node.metadata?.actionEntryId === "string"
    && (!recordingId || Array.isArray(node.metadata?.evidence) && node.metadata.evidence.some((item: any) => item?.artifactId === recordingId)));
  const click = nodes.find(node => node.parameterValues?.outputId === "web.dom.click");
  const selector = click?.parameterValues?.parameters?.selector;
  const validSelector = selector === '[data-testid="diagnosis-target"]' || selector === "[data-testid='diagnosis-target']";
  const navigation = nodes.find(node => node.parameterValues?.outputId === "web.browser.navigate");
  const validNavigation = !navigation || String(navigation.parameterValues?.parameters?.url ?? "").includes(LLM_DIAGNOSIS_SCENARIO_PATH);
  const validEdges = edges.length === Math.max(0, nodes.length - 1) && edges.every(edge => typeof edge.metadata?.recordingProposalId === "string");
  const positions = new Set(nodes.map(node => String(node.position?.x) + ":" + String(node.position?.y)));
  if (!validNodes || !validEdges || positions.size !== nodes.length || !validOutputIds || !validSelector || !validNavigation) {
    throw new RunnerFailure("environment.missing", `Diagnosis Subflow is not the deterministic unedited stable-target recording (${JSON.stringify({ nodeCount: nodes.length, edgeCount: edges.length, outputIds, distinctPositions: positions.size, validNodes, validEdges, validSelector, validNavigation })})`);
  }
}
export function assertDemoSubflowOwnership(document: Record<string, unknown>, projectId: string, parentFlowId: string, subflowId: string, graphFlowId: string): void {
  const metadata = document.metadata as Record<string, unknown> | undefined;
  if (document.projectId !== projectId || document.flowId !== graphFlowId || metadata?.subflowGraph !== true || metadata.parentFlowId !== parentFlowId || metadata.parentSubflowId !== subflowId || metadata.flowRepresentationVersion !== 1 || metadata.flowRepresentationKind !== "subflow_graph") {
    throw new RunnerFailure("environment.missing", "Demo graph is not owned by the expected Subflow boundary");
  }
}

export function assertDemoFlowDocument(document: Record<string, unknown>, projectId: string, flowId: string, name: string): void {
  const expected = createDemoFlowDocument({}, projectId, flowId, name);
  const keys = ["projectId", "flowId", "name", "scope", "nodes", "edges", "dependencies"] as const;
  const select = (value: Record<string, unknown>) => Object.fromEntries(keys.map(key => [key, normalizeDemoArray(key, value[key])]));
  if (stableJson(select(document)) !== stableJson(select(expected))) {
    throw new RunnerFailure("environment.missing", "Existing demo Flow does not match the deterministic web-extension fixture; choose another FLUXIQ_DEMO_FLOW_ID");
  }
}

function isDemoFixtureDocument(document: Record<string, unknown>, projectId: string, flowId: string, name: string): boolean {
  try { assertDemoFlowDocument(document, projectId, flowId, name); return true; }
  catch { return false; }
}

function demoGraphPatchOperations(document: Record<string, unknown>, flowId: string): unknown[] {
  const nodes = document.nodes as Array<Record<string, any>>;
  const edges = document.edges as Array<Record<string, any>>;
  return [
    ...nodes.map(node => ({
      op: "add_node",
      node: {
        nodeId: node.id,
        flowId,
        definitionId: node.definitionId,
        definitionVersion: node.definitionVersion ?? "1.0.0",
        label: node.label ?? "",
        description: node.description ?? "",
        x: node.position?.x ?? 0,
        y: node.position?.y ?? 0,
        width: 220,
        height: 120,
        zIndex: 0,
        disabled: false,
        parameterValues: node.parameterValues ?? {},
        metadata: node.metadata ?? {},
      },
    })),
    ...edges.map(edge => ({
      op: "add_edge",
      edge: {
        edgeId: edge.id,
        flowId,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        sourcePortId: edge.sourcePortId ?? null,
        targetPortId: edge.targetPortId ?? null,
        label: edge.label ?? "",
        metadata: edge.metadata ?? {},
      },
    })),
  ];
}

export function demoGraphReconciliationOperations(
  document: Record<string, unknown>,
  flowId: string,
  viewport: { nodes: Array<{ nodeId: string; x: number; y: number }>; edgeIds: string[]; nodeCount: number; edgeCount: number },
): unknown[] {
  if (viewport.nodeCount === 0 && viewport.edgeCount === 0) return demoGraphPatchOperations(document, flowId);
  const nodes = document.nodes as Array<Record<string, any>>;
  const edges = document.edges as Array<Record<string, any>>;
  const expectedNodeIds = new Set(nodes.map(node => String(node.id)));
  const expectedEdgeIds = new Set(edges.map(edge => String(edge.id)));
  if (viewport.nodeCount !== viewport.nodes.length
    || viewport.edgeCount !== viewport.edgeIds.length
    || viewport.nodeCount > expectedNodeIds.size
    || viewport.edgeCount > expectedEdgeIds.size
    || viewport.nodes.some(node => !expectedNodeIds.has(node.nodeId))
    || viewport.edgeIds.some(edgeId => !expectedEdgeIds.has(edgeId))) {
    throw new RunnerFailure("environment.missing", "The persistent demo graph index does not match its fixture-owned Flow document");
  }
  const current = new Map(viewport.nodes.map(node => [node.nodeId, node]));
  const currentEdgeIds = new Set(viewport.edgeIds);
  const missing = {
    ...document,
    nodes: nodes.filter(node => !current.has(String(node.id))),
    edges: edges.filter(edge => !currentEdgeIds.has(String(edge.id))),
  };
  return [...demoGraphPatchOperations(missing, flowId), ...nodes.flatMap(node => {
    const saved = current.get(String(node.id));
    const x = Number(node.position?.x ?? 0);
    const y = Number(node.position?.y ?? 0);
    return saved && (saved.x !== x || saved.y !== y) ? [{ op: "move_node", nodeId: node.id, x, y }] : [];
  })];
}

function normalizeDemoArray(key: string, value: unknown): unknown {
  if (!Array.isArray(value) || !["nodes", "edges", "dependencies"].includes(key)) return value;
  return [...value].sort((left, right) => stableJson(left).localeCompare(stableJson(right)));
}

async function persistentScenarioPort(config: DemoWorkspaceConfiguration): Promise<number> {
  const portPath = path.join(config.workspaceDirectory, "scenario-port.json");
  await mkdir(config.workspaceDirectory, { recursive: true });
  try {
    const parsed = JSON.parse(await readFile(portPath, "utf8")) as { port?: unknown };
    if (!Number.isInteger(parsed.port) || Number(parsed.port) < 1024 || Number(parsed.port) > 65_535) {
      throw new RunnerFailure("environment.missing", "The persistent demo scenario port file is invalid");
    }
    return Number(parsed.port);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") throw error;
  }
  const port = await allocateLoopbackPort();
  await writeFile(portPath, JSON.stringify({ schemaVersion: "0.1", port }, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  await hardenWindowsPrivatePath(portPath, "file");
  return port;
}

async function replacePersistentScenarioPort(config: DemoWorkspaceConfiguration, expectedPort: number): Promise<number> {
  const portPath = path.join(config.workspaceDirectory, "scenario-port.json");
  const current = JSON.parse(await readFile(portPath, "utf8")) as { port?: unknown };
  if (current.port !== expectedPort) {
    throw new RunnerFailure("process.startup", "The persistent demo scenario port changed during recovery");
  }
  const port = await allocateLoopbackPort();
  if (port === expectedPort) throw new RunnerFailure("process.startup", "Scenario Lab recovery could not allocate a replacement port");
  const temporary = portPath + "." + randomBytes(6).toString("hex") + ".tmp";
  try {
    await writeFile(temporary, JSON.stringify({ schemaVersion: "0.1", port }, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
    if (process.platform === "win32") await hardenWindowsPrivatePath(temporary, "file");
    await rename(temporary, portPath);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  return port;
}

type ScenarioLabProcess = Pick<ChildProcess, "exitCode" | "signalCode">;

export async function startPersistentScenarioLabWithRecovery(input: {
  config: DemoWorkspaceConfiguration;
  start: (port: number) => ScenarioLabProcess;
  waitUntilReady: (port: number, child: ScenarioLabProcess) => Promise<void>;
}): Promise<{ port: number; child: ScenarioLabProcess }> {
  const initialPort = await persistentScenarioPort(input.config);
  let child = input.start(initialPort);
  try {
    await input.waitUntilReady(initialPort, child);
    return { port: initialPort, child };
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) throw error;
  }
  const replacementPort = await replacePersistentScenarioPort(input.config, initialPort);
  child = input.start(replacementPort);
  await input.waitUntilReady(replacementPort, child);
  return { port: replacementPort, child };
}
export function requireDemoScenarioUrl(origin: string, scenarioPath: string): string {
  let originUrl: URL;
  let scenarioUrl: URL;
  try {
    originUrl = new URL(origin);
    scenarioUrl = new URL(scenarioPath, originUrl);
  } catch {
    throw new RunnerFailure("environment.missing", "The persistent demo scenario URL is invalid");
  }
  if (
    originUrl.protocol !== "http:"
    || originUrl.hostname !== "127.0.0.1"
    || originUrl.username
    || originUrl.password
    || scenarioUrl.origin !== originUrl.origin
    || !scenarioUrl.pathname.startsWith("/scenarios/")
    || scenarioUrl.search
    || scenarioUrl.hash
  ) throw new RunnerFailure("environment.missing", "The persistent demo scenario URL is invalid");
  return scenarioUrl.href;
}
async function withDemoBrowser<T>(
  config: DemoWorkspaceConfiguration,
  panelCookie: string,
  evidenceScenarioId: string,
  operation: (input: { extensionPage: Page; panelPage: Page; scenarioPage: Page; scenarioUrl: string; evidence: BrowserEvidenceRecorder }) => Promise<T>,
  redactionSecrets: readonly string[] = [],
  scenarioPath: string = "/scenarios/basic-form/",
  phaseTracker?: DemoLlmPreparationPhaseTracker,
): Promise<T> {
  const supervisor = new ProcessSupervisor();
  const token = randomBytes(32).toString("base64url");
  let context: BrowserContext | undefined;
  let panelContext: BrowserContext | undefined;
  try {
    const scenario = await startPersistentScenarioLabWithRecovery({
      config,
      start: scenarioPort => supervisor.start({
        name: "scenario-lab",
        command: executable("node"),
        args: [path.join(config.repositoryRoot, "apps", "scenario-lab", "dist", "server.js")],
        cwd: config.repositoryRoot,
        env: { ...process.env, SCENARIO_LAB_RUN_TOKEN: token, SCENARIO_LAB_PORT: String(scenarioPort), SCENARIO_LAB_SEED: "101" },
        logPath: processLogPath(path.join(config.workspaceDirectory, "logs"), "scenario-lab"),
      }),
      waitUntilReady: (scenarioPort, child) => waitForUrl("http://127.0.0.1:" + scenarioPort + "/__control/health", token, child),
    });
    const scenarioOrigin = "http://127.0.0.1:" + scenario.port;
    const scenarioUrl = requireDemoScenarioUrl(scenarioOrigin, scenarioPath);
    phaseTracker?.set("scenario-ready");
    const extensionSourcePath = path.join(config.repositoryRoot, "apps", "extension", "dist", "chrome");
    const extensionPath = path.join(config.workspaceDirectory, "extension-under-test");
    await rm(extensionPath, { recursive: true, force: true });
    await cp(extensionSourcePath, extensionPath, { recursive: true, force: true });
    context = await chromium.launchPersistentContext(path.join(config.workspaceDirectory, "browser-profile-isolated"), {
      headless: config.headless,
      channel: "chromium",
      env: withoutProviderSecrets(process.env),
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1280, height: 720 },
      args: ["--disable-extensions-except=" + extensionPath, "--load-extension=" + extensionPath, "--no-first-run", "--disable-default-apps"],
    });
    panelContext = await chromium.launchPersistentContext(path.join(config.workspaceDirectory, "panel-browser-profile-isolated-v2"), {
      headless: config.headless,
      channel: "chromium",
      env: withoutProviderSecrets(process.env),
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1280, height: 720 },
      args: ["--no-first-run", "--disable-default-apps"],
    });
    const [cookieName, cookieValue] = panelCookie.split("=", 2);
    if (!cookieName || !cookieValue) throw new RunnerFailure("environment.missing", "FluxIQ panel cookie is malformed");
    await panelContext.addCookies([{ name: cookieName, value: cookieValue, url: config.origin }]);
    const extensionUrl = await extensionControlUrl(context);
    const extensionPage = await context.newPage();
    const panelPage = await panelContext.newPage();
    const scenarioPage = await context.newPage();
    const evidence = new BrowserEvidenceRecorder({
      workspaceDirectory: config.workspaceDirectory,
      scenarioId: evidenceScenarioId,
      pages: { extension: extensionPage, panel: panelPage, scenario: scenarioPage },
      sampleFps: 0,
      redactionSecrets,
    });
    await evidence.start();
    phaseTracker?.set("browser-ready");
    try {
      await evidence.step("extension", "open-extension-controls", "Open the extension recorder controls", () => extensionPage.goto(extensionUrl).then(() => undefined));
      await installRuntimeActionEvidence(extensionPage, evidence);
      await evidence.step("panel", "open-panel", "Open the FluxIQ web panel", () => panelPage.goto(config.origin, { waitUntil: "domcontentloaded" }).then(() => undefined));
      await panelPage.getByRole("heading", { name: "Programs", exact: true }).waitFor();
      await evidence.step("scenario", "open-scenario", "Open the selected loopback scenario", () => scenarioPage.goto(scenarioUrl).then(() => undefined));
      await evidence.step("extension", "close-startup-tabs", "Close blank Chromium startup tabs", () => extensionPage.evaluate(async () => {
        const tabs = await (globalThis as any).chrome.tabs.query({ url: "about:blank" });
        const ids = tabs.flatMap((tab: any) => typeof tab.id === "number" ? [tab.id] : []);
        if (ids.length) await (globalThis as any).chrome.tabs.remove(ids);
      }));
      await scenarioPage.bringToFront();
      phaseTracker?.set("browser-operation-call");
      const result = await operation({ extensionPage, panelPage, scenarioPage, scenarioUrl, evidence });
      phaseTracker?.set("browser-operation-returned");
      phaseTracker?.set("evidence-finalize-call");
      const evidencePath = await evidence.finalize("passed");
      phaseTracker?.set("evidence-finalize-returned");
      await writeFile(path.join(config.workspaceDirectory, "latest-evidence.json"), JSON.stringify({ runId: evidence.runId, path: evidencePath }, null, 2) + "\n", "utf8");
      return result;
    } catch (error) {
      phaseTracker?.captureFailure(error);
      const evidencePath = await evidence.finalize("failed").catch(() => undefined);
      if (evidencePath) await writeFile(path.join(config.workspaceDirectory, "latest-evidence.json"), JSON.stringify({ runId: evidence.runId, path: evidencePath }, null, 2) + "\n", "utf8").catch(() => undefined);
      throw error;
    }
  } finally {
    await panelContext?.close().catch(() => undefined);
    await context?.close().catch(() => undefined);
    await supervisor.cleanup();
  }
}

async function connectExtension(
  page: Page,
  panelPage: Page,
  control: ExistingFluxIQControlClient,
  gatewayUrl: string,
  origin: string,
  projectId: string,
  flowId: string,
  scenarioUrl: string,
  evidence: BrowserEvidenceRecorder,
): Promise<void> {
  let stage = "entry";
  let diagnosticSurface: BrowserEvidenceSurface = "extension";
  const facts = {
    contextSelected: false,
    settingsOpened: false,
    gatewayFilled: false,
    apiFilled: false,
    optionsVerified: 0,
    settingsClosed: false,
    connectionRequested: false,
    connected: false,
    pairingRequired: false,
    scenarioTabSelected: false,
    contextRefreshed: false,
  };
  const checkpoint = async (nextStage: string, surface: BrowserEvidenceSurface): Promise<void> => {
    stage = nextStage;
    diagnosticSurface = surface;
    await evidence.diagnostic(surface, `connect-${stage}`, `connect.${stage}`, facts);
  };
  try {
    await checkpoint("entry", "extension");
    await checkpoint("select-context", "panel");
    await evidence.step("panel", "select-project-context", "Select the Flow as the active FluxIQ recording context", () => control.selectExistingContext(projectId, undefined, {}, flowId));
    facts.contextSelected = true;

    await checkpoint("settings-open", "extension");
    await evidence.step("extension", "settings-open", "Open extension settings", () => page.getByRole("button", { name: "Settings" }).click());
    facts.settingsOpened = true;

    await checkpoint("settings-gateway", "extension");
    await evidence.step("extension", "settings-gateway", "Enter the FluxIQ gateway URL", () => page.getByLabel("Gateway URL").fill(gatewayUrl));
    facts.gatewayFilled = true;

    await checkpoint("settings-api", "extension");
    await evidence.step("extension", "settings-api", "Enter the FluxIQ Core API URL", () => page.getByLabel("Core API URL").fill(origin));
    facts.apiFilled = true;

    await checkpoint("settings-options", "extension");
    for (const label of ["Auto reconnect", "DOM mutations", "Input values", "Snapshots"]) {
      const checkbox = page.getByLabel(label);
      if (!await checkbox.isChecked()) await evidence.step("extension", "settings-" + label.toLowerCase().replaceAll(" ", "-"), "Enable " + label, () => checkbox.check());
      facts.optionsVerified += 1;
    }

    await checkpoint("settings-close", "extension");
    await evidence.step("extension", "settings-close", "Close extension settings", () => page.getByRole("button", { name: "Close" }).click());
    facts.settingsClosed = true;

    await checkpoint("connect-request", "extension");
    await evidence.step("extension", "extension-connect", "Connect the extension", () => page.getByRole("button", { name: "Connect", exact: true }).click());
    facts.connectionRequested = true;

    await checkpoint("connection-status", "extension");
    const initial = await pollStatus(page, value => value.connectionState === "connected" || value.connectionState === "pairing", "initial connection");
    if (initial.connectionState === "pairing") {
      facts.pairingRequired = true;
      await checkpoint("pairing-approval", "panel");
      if (typeof initial.pairingReferenceCode !== "string") throw new RunnerFailure("gateway.pairing", "Extension pairing code is unavailable");
      await approvePairingInPanel(panelPage, initial.pairingReferenceCode, evidence);
      await pollStatus(page, value => value.connectionState === "connected" && typeof value.sessionId === "string", "pairing approval");
    }
    facts.connected = true;

    await checkpoint("scenario-tab", "extension");
    const scenarioOrigin = new URL(scenarioUrl).origin;
    const tabId = await evidence.step("extension", "activate-scenario-tab", "Select the scenario as the extension automation tab", () => page.evaluate(async originValue => {
      const tabs = await (globalThis as any).chrome.tabs.query({ url: originValue + "/*" });
      const tab = tabs.find((candidate: any) => typeof candidate.id === "number");
      if (!tab) throw new Error("Demo scenario tab is unavailable");
      const response = await (globalThis as any).chrome.runtime.sendMessage({ type: "fluxiq.test.setActiveTab", tabId: tab.id });
      if (response?.ok !== true) throw new Error(response?.error ?? "Extension rejected the scenario automation tab");
      return tab.id as number;
    }, scenarioOrigin));
    await pollStatus(page, value => value.activeTabId === tabId, "scenario tab selection");
    facts.scenarioTabSelected = true;

    // The pairing handshake establishes client trust. Project ownership is resolved
    // from the approving operator's fresh Automation Studio context at recording start.
    await checkpoint("refresh-context", "panel");
    await evidence.step("panel", "refresh-project-context", "Refresh the active FluxIQ Flow context", () => control.selectExistingContext(projectId, undefined, {}, flowId));
    facts.contextRefreshed = true;
    await checkpoint("complete", "extension");
  } catch {
    await evidence.diagnostic(diagnosticSurface, "connect-failed", `connect.${stage}`, facts).catch(() => undefined);
    throw new RunnerFailure("runtime.behavior", "FluxIQ extension connection setup failed");
  }
}
async function openAutomationStudio(page: Page, origin: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  await evidence.step("panel", "open-web-automation-studio", "Open Automation Studio in the Web Automation domain", () => page.goto(origin + "/programs/automation-studio?domainId=web-automation", { waitUntil: "domcontentloaded" }).then(() => undefined));
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
}

async function openProjectInPanel(page: Page, origin: string, projectName: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  const current = page.locator(".automation-studio-sidebar-heading").getByText(projectName, { exact: true });
  if (await current.isVisible().catch(() => false)) return;
  await openAutomationStudio(page, origin, evidence);
  await evidence.step("panel", "project-search", "Search for the demo project", () => page.getByLabel("Search projects").fill(projectName));
  const row = page.locator(".automation-project-row").filter({ hasText: projectName }).first();
  await evidence.step("panel", "project-open", "Open the demo project", () => row.locator(".automation-project-row-main").click());
  await page.locator(".automation-studio-sidebar-heading").getByText(projectName, { exact: true }).waitFor();
}

function hierarchyRow(page: Page, label: string): Locator {
  return page.locator(".tree-row-main").filter({ hasText: new RegExp("^" + escapeRegExp(label)) }).first();
}

async function openFlowInCurrentProject(page: Page, flowName: string, evidence: BrowserEvidenceRecorder): Promise<string> {
  let stage = "hierarchy-baseline";
  let typeFilterNormalized = false;
  let searchCleared = false;
  let stableIdCandidateCount = 0;
  let exactFlowCandidateCount = 0;
  let routerSearchApplied = false;
  let filteredAncestorFlowCount = 0;
  let routerActivationRequested = false;
  let routerChildCount = 0;
  let routerTabCount = 0;
  try {
    const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
    const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
    const typeFilter = hierarchy.getByRole("combobox", { name: "Filter project object type" });
    if (await typeFilter.inputValue({ timeout: 2_000 }) !== "all") {
      await evidence.step("panel", "flow-type-filter-reset", "Show all project hierarchy object types before locating a Flow", () => typeFilter.selectOption("all", { timeout: 2_000 }));
    }
    typeFilterNormalized = await typeFilter.inputValue({ timeout: 2_000 }) === "all";
    if (!typeFilterNormalized) throw new RunnerFailure("runtime.behavior", "FluxIQ panel hierarchy object filter could not be normalized");
    stage = "filtered-flow";
    await evidence.step("panel", "flow-search", "Search the project hierarchy for the demo Flow", () => search.fill(flowName));
    const flowTreeItem = hierarchy.getByRole("treeitem", { name: flowName, exact: true });
    const flowRow = flowTreeItem.locator(".tree-row-main.type-flow");
    await flowTreeItem.waitFor({ timeout: 10_000 });
    await evidence.step("panel", "flow-open", "Preview the demo Flow through its hierarchy row", () => flowRow.click());
    const flowTreeItemId = await flowTreeItem.getAttribute("data-tree-item-id");
    if (!flowTreeItemId) throw new RunnerFailure("runtime.behavior", "FluxIQ panel Flow hierarchy identity is unavailable");

    stage = "stable-flow";
    const stableIdCandidates = page.locator(`.automation-tree-item[data-tree-item-id="${escapeCssAttribute(flowTreeItemId)}"]`);
    stableIdCandidateCount = await stableIdCandidates.count();
    const stableFlowTreeItems = stableIdCandidates.filter({
      has: page.locator(".tree-row-main.type-flow .tree-row-label > strong").getByText(flowName, { exact: true }),
    });
    const stableFlowTreeItem = stableFlowTreeItems.first();
    await stableFlowTreeItem.waitFor({ timeout: 10_000 });
    exactFlowCandidateCount = await stableFlowTreeItems.count();
    if (exactFlowCandidateCount !== 1) throw new RunnerFailure("runtime.behavior", "FluxIQ panel Flow hierarchy identity is ambiguous while filtered");
    if (await stableFlowTreeItem.getAttribute("aria-expanded") === "false") {
      await evidence.step("panel", "flow-expand", "Expand the demo Flow hierarchy", () => stableFlowTreeItem.getByRole("button", { name: `Expand ${flowName}` }).click());
    }

    stage = "router-search";
    await evidence.step("panel", "flow-router-search", "Search the real project hierarchy for Router rows", () => search.fill("Router"));
    routerSearchApplied = true;
    const filteredAncestorFlows = page.locator(`.automation-tree-item[data-tree-item-id="${escapeCssAttribute(flowTreeItemId)}"]`).filter({
      has: page.locator(".tree-row-main.type-flow .tree-row-label > strong").getByText(flowName, { exact: true }),
    });
    const filteredAncestorFlow = filteredAncestorFlows.first();
    await filteredAncestorFlow.waitFor({ timeout: 10_000 });
    filteredAncestorFlowCount = await filteredAncestorFlows.count();
    if (filteredAncestorFlowCount !== 1) throw new RunnerFailure("runtime.behavior", "FluxIQ panel filtered Flow ancestor identity is ambiguous");
    const filteredAncestorFlowRow = filteredAncestorFlow.locator(".tree-row-main.type-flow").first();

    stage = "router-child";
    const routerTreeItems = page.locator(`.automation-tree-item[data-tree-parent-id="${escapeCssAttribute(flowTreeItemId)}"][aria-label="Router"]`).filter({
      has: page.locator(".tree-row-main.type-flow-object .tree-row-label > strong").getByText("Router", { exact: true }),
    });
    const routerTreeItem = routerTreeItems.first();
    await routerTreeItem.waitFor({ timeout: 10_000 });
    routerChildCount = await routerTreeItems.count();
    if (routerChildCount !== 1) throw new RunnerFailure("runtime.behavior", "FluxIQ panel Flow Router hierarchy identity is ambiguous");

    stage = "router-view";
    const routerTab = page.getByRole("tab", { name: `Router: ${flowName}`, exact: true });
    await evidence.step("panel", "flow-router-activate", "Activate the exact Flow-owned Router while the hierarchy is filtered", () => routerTreeItem.locator(".tree-row-main.type-flow-object").click());
    routerActivationRequested = true;
    const previewDeadline = Date.now() + 1_500;
    while (Date.now() < previewDeadline && !await exactFlowRouterUiIsActive(routerTreeItem, routerTab)) await page.waitForTimeout(100);
    if (!await exactFlowRouterUiIsActive(routerTreeItem, routerTab)) {
      await evidence.step("panel", "flow-open-pane", "Open the filtered Flow ancestor Router in a dedicated workspace pane", () => filteredAncestorFlowRow.dblclick());
    }
    const selectionDeadline = Date.now() + 10_000;
    while (Date.now() < selectionDeadline && !await exactFlowRouterUiIsActive(routerTreeItem, routerTab)) await page.waitForTimeout(100);
    if (!await exactFlowRouterUiIsActive(routerTreeItem, routerTab)) {
      routerTabCount = await routerTab.count();
      throw new RunnerFailure("runtime.behavior", "FluxIQ panel did not activate the requested Flow Router view");
    }
    stage = "router-search-clear";
    await evidence.step("panel", "flow-search-clear", "Clear the project hierarchy search after Router activation", () => search.fill(""));
    searchCleared = true;
    await evidence.diagnostic("panel", "flow-open-complete", "flow-open.complete", { flowOpened: true });
    return flowTreeItemId;
  } catch {
    await evidence.diagnostic("panel", stage, `flow-open.${stage}`, {
      typeFilterNormalized,
      searchCleared,
      stableIdCandidateCount,
      exactFlowCandidateCount,
      routerSearchApplied,
      filteredAncestorFlowCount,
      routerActivationRequested,
      routerChildCount,
      routerTabCount,
    }).catch(() => undefined);
    throw new RunnerFailure("runtime.behavior", "FluxIQ panel could not activate the requested Flow Router through the hierarchy");
  }
}
async function exactFlowRouterUiIsActive(routerTreeItem: Locator, routerTab: Locator): Promise<boolean> {
  return await routerTreeItem.getAttribute("aria-selected") === "true"
    && await routerTab.count() === 1
    && await routerTab.getAttribute("aria-selected") === "true";
}
type FlowOwnedSubflowsFolderResolution = {
  folder: Locator;
  hierarchyControlsAvailable(timeout?: number): Promise<boolean>;
  restoreHierarchyFilters(timeout?: number): Promise<boolean>;
};

async function requireFlowOwnedSubflowsFolder(page: Page, flowName: string, evidence: BrowserEvidenceRecorder): Promise<FlowOwnedSubflowsFolderResolution> {
  let stage = "flow";
  let flowOpened = false;
  let filtersApplied = false;
  let filterMatchCount = 0;
  let traversalCount = 0;
  let parentScopedCount = 0;
  let exactSubflowsCount = 0;
  let addActionCount = 0;
  let search: Locator | undefined;
  let typeFilter: Locator | undefined;
  let originalSearch = "";
  let originalTypeFilter = "all";
  let filtersRestored = false;
  let hierarchy: Locator | undefined;
  const hierarchyControlsAvailable = async (timeout: number = 1_000): Promise<boolean> => {
    if (!hierarchy || !search || !typeFilter) return false;
    try {
      await hierarchy.waitFor({ state: "visible", timeout });
      await search.waitFor({ state: "visible", timeout });
      await typeFilter.waitFor({ state: "visible", timeout });
      return true;
    } catch {
      return false;
    }
  };
  const restoreHierarchyFilters = async (timeout: number = 1_000): Promise<boolean> => {
    if (!filtersApplied || filtersRestored) return true;
    if (!search || !typeFilter || !await hierarchyControlsAvailable(timeout)) return false;
    if (await search.inputValue({ timeout }) !== originalSearch) {
      await evidence.step("panel", "subflow-folder-search-restore", "Restore the project hierarchy search after locating Subflows", () => search!.fill(originalSearch, { timeout }));
    }
    if (await typeFilter.inputValue({ timeout }) !== originalTypeFilter) {
      await evidence.step("panel", "subflow-folder-type-restore", "Restore the project hierarchy object filter after locating Subflows", () => typeFilter!.selectOption(originalTypeFilter, { timeout }));
    }
    filtersRestored = true;
    return true;
  };
  try {
    const flowTreeItemId = await openFlowInCurrentProject(page, flowName, evidence);
    flowOpened = true;
    hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
    search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
    typeFilter = hierarchy.getByRole("combobox", { name: "Filter project object type" });
    originalSearch = await search.inputValue();
    originalTypeFilter = await typeFilter.inputValue();
    filtersApplied = true;

    stage = "subflows-filter";
    if (originalTypeFilter !== "folder") {
      await evidence.step("panel", "subflow-folder-type-filter", "Filter the real project hierarchy to folders", () => typeFilter!.selectOption("folder"));
    }
    if (originalSearch !== "Subflows") {
      await evidence.step("panel", "subflow-folder-search", "Search the real project hierarchy for Subflows folders", () => search!.fill("Subflows"));
    }
    const matchStatus = hierarchy.locator(".automation-tree-filter-row small");
    await matchStatus.waitFor({ timeout: 10_000 });
    const match = /^(\d+) matches?$/u.exec((await matchStatus.textContent())?.trim() ?? "");
    filterMatchCount = match ? Number.parseInt(match[1]!, 10) : 0;

    stage = "subflows-render";
    const parentScopedItems = page.locator(`.automation-tree-item[data-tree-parent-id="${escapeCssAttribute(flowTreeItemId)}"]`);
    const exactSubflowsItems = parentScopedItems.filter({
      has: page.locator(".tree-row-main.type-folder .tree-row-label > strong").getByText("Subflows", { exact: true }),
    });
    const subflowsFolder = exactSubflowsItems.first();
    await subflowsFolder.waitFor({ timeout: 1_000 }).catch(() => undefined);
    if (!await subflowsFolder.count()) {
      stage = "subflows-traversal";
      const tree = page.getByRole("navigation", { name: "Automation Studio project tree" });
      const mountedTreeItem = tree.getByRole("treeitem").first();
      await mountedTreeItem.waitFor({ timeout: 10_000 });
      await evidence.step("panel", "subflow-folder-traversal-focus", "Focus the filtered project hierarchy", () => mountedTreeItem.focus());
      await evidence.step("panel", "subflow-folder-traversal-home", "Start at the beginning of the filtered hierarchy", () => page.keyboard.press("Home"));
      const traversalLimit = Math.min(256, Math.max(8, filterMatchCount * 2 + 2));
      while (!await subflowsFolder.count() && traversalCount < traversalLimit) {
        traversalCount += 1;
        await evidence.step("panel", `subflow-folder-traversal-${traversalCount}`, "Traverse the filtered hierarchy toward the requested Flow-owned Subflows folder", () => page.keyboard.press("ArrowDown"));
      }
    }
    await subflowsFolder.waitFor({ timeout: 10_000 });
    parentScopedCount = await parentScopedItems.count();
    exactSubflowsCount = await exactSubflowsItems.count();
    stage = "subflows-identity";
    if (exactSubflowsCount !== 1 || await subflowsFolder.getAttribute("aria-label") !== "Subflows") {
      throw new RunnerFailure("runtime.behavior", "FluxIQ panel Flow-owned Subflows hierarchy identity is ambiguous");
    }
    const addAction = subflowsFolder.getByRole("button", { name: "Add inside Subflows", exact: true });
    addActionCount = await addAction.count();
    stage = "add-action";
    if (addActionCount !== 1) throw new RunnerFailure("runtime.behavior", "FluxIQ panel Flow-owned Subflows add action is unavailable");
    return { folder: subflowsFolder, hierarchyControlsAvailable, restoreHierarchyFilters };
  } catch {
    await restoreHierarchyFilters().catch(() => undefined);
    await evidence.diagnostic("panel", `subflow-folder-${stage}`, `subflow-folder.${stage}`, {
      flowOpened,
      filtersApplied,
      filtersRestored,
      filterMatchCount,
      traversalCount,
      parentScopedCount,
      exactSubflowsCount,
      addActionCount,
    }).catch(() => undefined);
    throw new RunnerFailure("runtime.behavior", "FluxIQ panel could not resolve the requested Flow-owned Subflows folder");
  }
}
async function createDemoSubflowInPanel(page: Page, flowName: string, pin: string, evidence: BrowserEvidenceRecorder, subflowName: string = DEMO_SUBFLOW_NAME): Promise<void> {
  const subflows = await requireFlowOwnedSubflowsFolder(page, flowName, evidence);
  const dialog = page.getByRole("dialog", { name: "Add to Subflows" });
  const form = page.getByRole("dialog", { name: "Create Subflow" });
  let stage = "open";
  let modalDismissAttempted = false;
  let dialogClosed = false;
  let hierarchyAvailable = false;
  let filtersRestored = false;
  try {
    await evidence.step("panel", "subflow-create-open", "Open the real panel Subflow creation dialog", () => subflows.folder.getByRole("button", { name: "Add inside Subflows", exact: true }).click());
    await dialog.waitFor({ timeout: 10_000 });
    stage = "kind";
    await evidence.step("panel", "subflow-create-kind", "Choose an executable Subflow", () => dialog.getByRole("button", { name: /^Subflow/u }).click());
    stage = "form";
    await form.waitFor({ timeout: 10_000 });
    await evidence.step("panel", "subflow-create-name", "Name the primary browser automation Subflow", () => form.getByLabel("Name").fill(subflowName));
    await evidence.step("panel", "subflow-create-pin", "Authorize Subflow creation", () => form.getByLabel("Security PIN").fill(pin), { sensitive: true });
    stage = "submit";
    await evidence.step("panel", "subflow-create-submit", "Create the primary Subflow", () => form.getByRole("button", { name: "Create", exact: true }).click(), { sensitive: true });
    await form.waitFor({ state: "hidden", timeout: 30_000 });
    dialogClosed = true;
    stage = "hierarchy";
    hierarchyAvailable = await subflows.hierarchyControlsAvailable(2_000);
    filtersRestored = await subflows.restoreHierarchyFilters(2_000);
    if (!hierarchyAvailable || !filtersRestored) throw new RunnerFailure("runtime.behavior", "FluxIQ panel hierarchy did not return after Subflow creation");
    stage = "created-row";
    await hierarchyRow(page, subflowName).waitFor({ timeout: 30_000 });
    return;
  } catch {
    const visibleForm = await form.isVisible().catch(() => false);
    const visibleChooser = !visibleForm && await dialog.isVisible().catch(() => false);
    const activeDialog = visibleForm ? form : visibleChooser ? dialog : undefined;
    if (activeDialog) {
      const cancel = activeDialog.getByRole("button", { name: "Cancel", exact: true });
      if (await cancel.count() === 1) {
        modalDismissAttempted = true;
        await evidence.step("panel", "subflow-create-cancel", "Close the incomplete Subflow creation workflow before restoring hierarchy filters", () => cancel.click({ timeout: 2_000 }), { sensitive: true }).catch(() => undefined);
        await activeDialog.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => undefined);
      }
      dialogClosed = !await activeDialog.isVisible().catch(() => false);
    }
    hierarchyAvailable = await subflows.hierarchyControlsAvailable(1_000);
    filtersRestored = await subflows.restoreHierarchyFilters(1_000).catch(() => false);
    await evidence.diagnostic("panel", `subflow-create-${stage}`, `subflow-create.${stage}`, {
      modalDismissAttempted,
      dialogClosed,
      hierarchyAvailable,
      filtersRestored,
    }).catch(() => undefined);
    throw new RunnerFailure("runtime.behavior", "FluxIQ panel could not complete the Subflow creation workflow");
  }
}

async function openSubflowInCurrentProject(page: Page, subflowName: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  const search = page.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "subflow-search", "Search for the primary demo Subflow", () => search.fill(subflowName));
  await evidence.step("panel", "subflow-open", "Open the primary Subflow Nodes editor", () => hierarchyRow(page, subflowName).click());
  await ensureNodesEditorVisible(page, evidence, "subflow-nodes");
  await evidence.step("panel", "subflow-search-clear", "Clear the project hierarchy search", () => search.fill(""));
}

async function ensureNodesEditorVisible(page: Page, evidence: BrowserEvidenceRecorder, stepPrefix: string): Promise<Locator> {
  const canvas = page.getByLabel("Nodes whiteboard");
  if (await canvas.isVisible().catch(() => false)) return canvas;
  await canvas.waitFor({ timeout: 3_000 }).catch(() => undefined);
  if (await canvas.isVisible().catch(() => false)) return canvas;

  let nodesTab = page.getByRole("tab", { name: /^Nodes(?::|$)/u }).first();
  if (!await nodesTab.count()) {
    await evidence.step("panel", stepPrefix + "-add-tab", "Open the panel tab picker for Nodes", () => page.getByRole("button", { name: "Add tab" }).first().click());
    const picker = page.locator(".automation-window-adder-panel:visible");
    await evidence.step("panel", stepPrefix + "-search-tab", "Search the tab picker for Nodes", () => picker.getByRole("searchbox").fill("nodes"));
    await evidence.step("panel", stepPrefix + "-select-tab", "Select the Nodes view", () => picker.getByRole("button", { name: /^Nodes/u }).click());
    nodesTab = page.getByRole("tab", { name: /^Nodes(?::|$)/u }).first();
    await nodesTab.waitFor({ timeout: 10_000 });
  }
  if (await nodesTab.getAttribute("aria-selected") !== "true") {
    await evidence.step("panel", stepPrefix + "-activate-tab", "Activate the selected Subflow Nodes view", () => nodesTab.click());
  }
  try {
    await canvas.waitFor({ timeout: 30_000 });
  } catch (cause) {
    const tabs = (await page.getByRole("tab").allTextContents()).map(value => value.replace(/\s+/gu, " ").trim()).filter(Boolean);
    const alerts = (await page.getByRole("alert").allTextContents()).map(value => value.replace(/\s+/gu, " ").trim()).filter(Boolean);
    throw new RunnerFailure("runtime.behavior", "FluxIQ panel did not open the selected Subflow Nodes canvas: " + JSON.stringify({ tabs, alerts }), { cause });
  }
  return canvas;
}

async function ensureRouterEditorVisible(page: Page, flowName: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  let routerTab = page.getByRole("tab", { name: `Router: ${flowName}`, exact: true });
  if (!await routerTab.count()) {
    await evidence.step("panel", "router-add-tab", "Open the panel tab picker for Router", () => page.getByRole("button", { name: "Add tab" }).first().click());
    const picker = page.locator(".automation-window-adder-panel:visible");
    await evidence.step("panel", "router-search-tab", "Search the tab picker for Router", () => picker.getByRole("searchbox").fill("router"));
    await evidence.step("panel", "router-select-tab", "Select the Router view", () => picker.getByRole("button", { name: /^Router/u }).click());
    routerTab = page.getByRole("tab", { name: `Router: ${flowName}`, exact: true });
    await routerTab.waitFor({ timeout: 10_000 });
  }
  if (await routerTab.getAttribute("aria-selected") !== "true") {
    await evidence.step("panel", "router-open", "Open the parent Flow Router", () => routerTab.click());
  }
  try {
    await page.getByRole("button", { name: "Edit fallback behavior" }).waitFor({ timeout: 30_000 });
  } catch (cause) {
    const tabs = (await page.getByRole("tab").allTextContents()).map(value => value.replace(/\s+/gu, " ").trim()).filter(Boolean);
    const alerts = (await page.getByRole("alert").allTextContents()).map(value => value.replace(/\s+/gu, " ").trim()).filter(Boolean);
    throw new RunnerFailure("runtime.behavior", "FluxIQ panel did not open the selected Flow Router editor: " + JSON.stringify({ tabs, alerts }), { cause });
  }
}

async function configureDemoRouterFallbackInPanel(page: Page, flowName: string, subflowName: string, pin: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  await ensureRouterEditorVisible(page, flowName, evidence);
  await evidence.step("panel", "router-fallback-open", "Open Router fallback configuration", () => page.getByRole("button", { name: "Edit fallback behavior" }).click());
  const dialog = page.getByRole("dialog", { name: "Fallback behavior" });
  await evidence.step("panel", "router-fallback-kind", "Route unmatched runs to the primary Subflow", () => dialog.getByRole("radio", { name: /Continue to a subflow/u }).click());
  await evidence.step("panel", "router-fallback-target", "Choose the primary Subflow as Router fallback", async () => {
    const combobox = dialog.getByRole("combobox", { name: "Fallback subflow" });
    if ((await combobox.inputValue()).trim() === subflowName) return;
    await combobox.click();
    await dialog.getByRole("option", { name: new RegExp("^" + escapeRegExp(subflowName)) }).click();
  });
  await evidence.step("panel", "router-fallback-save", "Request saving the Router fallback", () => dialog.getByRole("button", { name: "Save Fallback" }).click());
  const auth = page.getByRole("dialog", { name: "Authorize Router Change" });
  await evidence.step("panel", "router-fallback-pin", "Authorize the Router fallback", () => auth.getByLabel("Security PIN").fill(pin), { sensitive: true });
  await evidence.step("panel", "router-fallback-authorize", "Persist the Router fallback", () => auth.getByRole("button", { name: "Authorize and save" }).click(), { sensitive: true });
  await auth.waitFor({ state: "hidden", timeout: 30_000 });
}

async function openDemoFlowInPanel(page: Page, config: DemoWorkspaceConfiguration, state: DemoWorkspaceState, evidence: BrowserEvidenceRecorder): Promise<void> {
  await openProjectInPanel(page, config.origin, state.projectName, evidence);
  await openFlowInCurrentProject(page, state.flowName, evidence);
}

async function openConnectedClients(page: Page, evidence: BrowserEvidenceRecorder): Promise<void> {
  const tab = page.getByRole("tab", { name: /Connected Clients/u });
  if (await tab.count()) { await evidence.step("panel", "clients-tab-open", "Open Connected Clients", () => tab.click()); return; }
  await evidence.step("panel", "clients-add-tab", "Open the panel tab picker", () => page.getByRole("button", { name: "Add tab" }).first().click());
  const picker = page.locator(".automation-window-adder-panel:visible");
  await evidence.step("panel", "clients-tab-search", "Search for Connected Clients", () => picker.getByRole("searchbox").fill("connected"));
  await evidence.step("panel", "clients-tab-select", "Select Connected Clients", () => picker.getByRole("button", { name: /^Connected Clients/u }).click());
  const selectedTab = page.getByRole("tab", { name: /Connected Clients/u });
  await selectedTab.waitFor();
  if (await selectedTab.getAttribute("aria-selected") !== "true") {
    await evidence.step("panel", "clients-tab-activate", "Activate the Connected Clients tab", () => selectedTab.click());
  }
  await page.getByRole("strong").filter({ hasText: "Connected Clients" }).waitFor();
}

async function approvePairingInPanel(page: Page, referenceCode: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  await page.bringToFront();
  const globalDialog = page.getByRole("dialog", { name: "Client pairing request" });
  await globalDialog.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
  if (await globalDialog.isVisible().catch(() => false)) {
    if (!await globalDialog.getByText(referenceCode, { exact: true }).isVisible().catch(() => false)) {
      throw new RunnerFailure("gateway.pairing", "The global pairing prompt did not match the extension reference code");
    }
    await evidence.step("panel", "pairing-confirm", "Confirm the matching extension pairing request", () => globalDialog.getByRole("button", { name: "Confirm pairing" }).click());
    await globalDialog.waitFor({ state: "hidden" });
    return;
  }
  await openConnectedClients(page, evidence);
  const approvalPanel = page.locator(".automation-client-panel").filter({ hasText: "Approval" }).first();
  const approve = approvalPanel.locator("span").filter({ hasText: referenceCode }).getByRole("button", { name: "Approve" }).first();
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline && !await approve.isVisible().catch(() => false)) {
    await evidence.step("panel", "pairing-refresh", "Refresh Connected Clients pairing requests", () => page.getByRole("button", { name: "Refresh" }).click());
    await page.waitForTimeout(200);
  }
  if (!await approve.isVisible().catch(() => false)) throw new RunnerFailure("gateway.pairing", "Pairing request did not appear in the FluxIQ panel");
  await evidence.step("panel", "pairing-approve", "Approve the extension pairing request", () => approve.click());
}

async function runDemoFlowFromPanel(page: Page, state: DemoWorkspaceState, evidence: BrowserEvidenceRecorder): Promise<{ runId: string; status: string; diagnostic: Record<string, unknown> }> {
  await page.bringToFront();
  const flowTreeItem = page.getByRole("treeitem", { name: state.flowName, exact: true });
  const flowTreeItemId = await flowTreeItem.getAttribute("data-tree-item-id");
  if (!flowTreeItemId) throw new RunnerFailure("runtime.behavior", "The selected demo Flow does not have a hierarchy identity");
  const search = page.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "runtime-search", "Search the selected Flow hierarchy for Runtime Debug", () => search.fill("Runtime Debug"));
  const runtimeRow = page.locator(`.automation-tree-item[data-tree-parent-id="${escapeCssAttribute(flowTreeItemId)}"] .tree-row-main`).filter({ hasText: /^Runtime Debug/u }).first();
  await evidence.step("panel", "runtime-open", "Open Runtime Debug for the selected demo Flow", () => runtimeRow.click());
  const runCommand = page.locator(".automation-runtime-run-command");
  await runCommand.waitFor();
  await evidence.step("panel", "runtime-search-clear", "Clear the project hierarchy search", () => search.fill(""));
  await page.getByText("Checking Flow readiness...", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
  await evidence.step("panel", "runtime-no-llm", "Select No LLM intervention mode", () => runCommand.getByRole("button", { name: "No LLM intervention", exact: true }).click());
  const runButton = runCommand.getByRole("button", { name: "Run", exact: true });
  const readyDeadline = Date.now() + 30_000;
  while (Date.now() < readyDeadline && await runButton.isDisabled()) await page.waitForTimeout(100);
  if (await runButton.isDisabled()) {
    const issue = await page.locator(".automation-runtime-readiness").innerText().catch(() => "Flow readiness did not produce a visible result");
    throw new RunnerFailure("runtime.behavior", "FluxIQ panel reported the demo Flow is not ready: " + issue.replace(/\s+/gu, " ").trim());
  }
  const response = await evidence.step("panel", "runtime-run", "Run the deterministic Flow", async () => {
    return waitForPanelRunResponse(page, () => runButton.click());
  });
  const body = await response.json() as any;
  const runId = body?.payload?.runtimeSession?.runId;
  if (!response.ok() || typeof runId !== "string") throw new RunnerFailure("runtime.behavior", body?.error ?? "Panel Flow run failed");
  const status = String(body?.payload?.runtimeSession?.status ?? "unknown");
  const diagnostic = {
    runId,
    status,
    terminalReason: body?.payload?.terminalReason ?? "",
    message: body?.payload?.runtimeSession?.trace?.message ?? "",
    actionAttemptCount: body?.payload?.runSummary?.actionAttemptCount ?? 0,
  };
  return { runId, status, diagnostic };
}

async function assertDemoFlowRenderedLayout(page: Page, evidence: BrowserEvidenceRecorder, expectedNodeCounts: readonly number[] = [4, 5]): Promise<void> {
  await ensureNodesEditorVisible(page, evidence, "flow-layout");
  await page.locator(".react-flow__node[data-id]").first().waitFor({ timeout: 30_000 });
  const rectangles = await page.locator(".react-flow__node[data-id]").evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { id: element.getAttribute("data-id") ?? "unknown", left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }));
  if (!expectedNodeCounts.includes(rectangles.length)) throw new RunnerFailure("runtime.behavior", `Expected ${expectedNodeCounts.join(" or ")} recording-derived nodes, found ${rectangles.length}`);
  for (let leftIndex = 0; leftIndex < rectangles.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rectangles.length; rightIndex += 1) {
      const left = rectangles[leftIndex]!;
      const right = rectangles[rightIndex]!;
      const overlaps = left.left < right.right - 1 && left.right > right.left + 1 && left.top < right.bottom - 1 && left.bottom > right.top + 1;
      if (overlaps) throw new RunnerFailure("runtime.behavior", `Rendered demo Flow nodes overlap: ${left.id} and ${right.id}`);
    }
  }
}

async function waitForSubmittedDemoPage(seedPage: Page): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    for (const page of seedPage.context().pages()) {
      if (await page.getByTestId("result").filter({ hasText: "Submitted" }).isVisible().catch(() => false)) return;
    }
    await seedPage.waitForTimeout(100);
  }
  throw new RunnerFailure("runtime.behavior", "Recording-generated Flow completed without producing the submitted demo result in any extension-controlled tab");
}


async function waitForRoutedRunDetail(control: ExistingFluxIQControlClient, state: DemoWorkspaceState, runId: string, expectedActionCount: number) {
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

async function waitForPanelRunResponse(page: Page, dispatch: () => Promise<void>): Promise<import("@playwright/test").Response> {
  let resolveResponse!: (response: import("@playwright/test").Response) => void;
  const responsePromise = new Promise<import("@playwright/test").Response>(resolve => { resolveResponse = resolve; });
  const handler = (response: import("@playwright/test").Response) => {
    if (response.url().includes("/api/programs/automation-studio/run-runtime-session") && response.request().method() === "POST") resolveResponse(response);
  };
  page.on("response", handler);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await dispatch();
    return await Promise.race([
      responsePromise,
      new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error("Timed out waiting for the panel Flow run response")), 60_000); }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    page.off("response", handler);
  }
}

async function waitForPanelMutationResponse(page: Page, endpoint: string, dispatch: () => Promise<void>): Promise<import("@playwright/test").Response> {
  let resolveResponse!: (response: import("@playwright/test").Response) => void;
  const responsePromise = new Promise<import("@playwright/test").Response>(resolve => { resolveResponse = resolve; });
  const handler = (response: import("@playwright/test").Response) => {
    if (response.url().includes(endpoint) && response.request().method() === "POST") resolveResponse(response);
  };
  page.on("response", handler);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await dispatch();
    return await Promise.race([
      responsePromise,
      new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error("Timed out waiting for panel mutation " + endpoint)), 60_000); }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    page.off("response", handler);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function escapeCssAttribute(value: string): string {
  return value.replace(/["\\]/gu, character => `\\${character}`);
}

async function extensionControlUrl(context: BrowserContext): Promise<string> {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 15_000 });
  return "chrome-extension://" + new URL(worker.url()).hostname + "/sidepanel/index.html";
}

async function runtimeMessage(page: Page, message: Record<string, unknown>): Promise<any> {
  const response = await page.evaluate(value => (globalThis as any).chrome.runtime.sendMessage(value), message);
  if (!response?.ok) throw new RunnerFailure("extension.worker", response?.error ?? "Extension runtime message failed");
  return response;
}

async function installRuntimeActionEvidence(page: Page, evidence: BrowserEvidenceRecorder): Promise<void> {
  await page.exposeBinding("__fluxiqCaptureActionBoundary", async (_source, boundary: unknown) => {
    const value = boundary as { phase?: unknown; commandId?: unknown; actionType?: unknown; status?: unknown };
    if (
      (value.phase !== "before" && value.phase !== "after")
      || typeof value.commandId !== "string"
      || typeof value.actionType !== "string"
    ) throw new Error("Extension emitted an invalid action-evidence boundary");
    await evidence.runtimeActionBoundary({
      phase: value.phase,
      commandId: value.commandId,
      actionType: value.actionType,
      ...(typeof value.status === "string" ? { status: value.status } : {}),
    });
  });
  await page.evaluate(() => {
    const global = globalThis as typeof globalThis & {
      __fluxiqCaptureActionBoundary(boundary: unknown): Promise<void>;
      __fluxiqActionEvidencePort?: { disconnect(): void };
    };
    global.__fluxiqActionEvidencePort?.disconnect();
    const port = (globalThis as any).chrome.runtime.connect({ name: "fluxiq.test.action-evidence" });
    global.__fluxiqActionEvidencePort = port;
    port.onMessage.addListener((boundary: unknown) => {
      const value = boundary as { boundaryId?: unknown };
      void global.__fluxiqCaptureActionBoundary(boundary).then(
        () => port.postMessage({ boundaryId: value.boundaryId, ok: true }),
        error => port.postMessage({ boundaryId: value.boundaryId, ok: false, error: error instanceof Error ? error.message : "Evidence capture failed" }),
      );
    });
  });
}

async function extensionStatus(page: Page): Promise<any> {
  return (await runtimeMessage(page, { type: "fluxiq.getStatus" })).status;
}

async function pollStatus(page: Page, predicate: (value: any) => boolean, phase: string): Promise<any> {
  const deadline = Date.now() + 20_000;
  let latest: any;
  while (Date.now() < deadline) {
    latest = await extensionStatus(page);
    if (predicate(latest)) return latest;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const diagnostic = {
    connectionState: latest?.connectionState,
    hasSessionId: typeof latest?.sessionId === "string",
    projectId: latest?.projectId,
    activeTabId: latest?.activeTabId,
    gatewayUrl: latest?.gatewayUrl,
    lastError: latest?.lastError,
  };
  throw new RunnerFailure("gateway.connection", `Timed out waiting for extension state during ${phase}: ${JSON.stringify(diagnostic)}`);
}

async function waitForNewRecording(control: ExistingFluxIQControlClient, projectId: string, baseline: Set<string>): Promise<string> {
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

async function waitForNamedFlow(control: ExistingFluxIQControlClient, projectId: string, flowName: string): Promise<ExistingFlowSummary> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const created = (await control.listFlowSummaries(projectId)).filter(item => item.name === flowName);
    if (created.length === 1) return created[0]!;
    if (created.length > 1) throw new RunnerFailure("environment.missing", "Panel Flow creation produced more than one matching demo Flow");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new RunnerFailure("environment.missing", "Panel Flow creation did not persist the demo Flow");
}

async function waitForNamedSubflow(control: ExistingFluxIQControlClient, projectId: string, flowId: string, subflowName: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const created = (await control.listFlowSubflows(projectId, flowId)).filter(item => item.name === subflowName);
    if (created.length === 1) return created[0]!;
    if (created.length > 1) throw new RunnerFailure("environment.missing", "Panel Subflow creation produced more than one matching demo Subflow");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new RunnerFailure("environment.missing", "Panel Subflow creation did not persist the demo Subflow");
}

type RecordingListItem = { recordingId: string; status?: string; endedAt?: unknown };

function recordingItems(response: any): RecordingListItem[] {
  const values = response?.payload?.recordings ?? response?.payload?.items ?? response?.payload;
  return Array.isArray(values)
    ? values.flatMap((item: any) => {
      const recordingId = item?.recordingId ?? item?.id;
      if (typeof recordingId !== "string") return [];
      return [{ recordingId, ...(typeof item?.status === "string" ? { status: item.status } : {}), ...(item?.endedAt !== undefined && item?.endedAt !== null ? { endedAt: item.endedAt } : {}) }];
    })
    : [];
}

function recordingIds(response: any): Set<string> {
  return new Set(recordingItems(response).map(item => item.recordingId));
}

async function assertConnectedSession(control: ExistingFluxIQControlClient, sessionId: unknown): Promise<void> {
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

function llmPreparationStatePath(config: DemoWorkspaceConfiguration): string {
  return path.join(config.workspaceDirectory, "llm-diagnosis-workspace.json");
}

export function parseDemoLlmPreparationState(value: unknown): DemoLlmPreparationState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("LLM diagnosis preparation state must be an object");
  const record = value as Record<string, unknown>;
  const allowed = ["schemaVersion", "projectId", "flowId", "subflowId", "graphFlowId", "routerId", "recordingId"];
  if (record.schemaVersion !== LLM_PREPARATION_SCHEMA_VERSION || Object.keys(record).some(key => !allowed.includes(key))) throw new Error("LLM diagnosis preparation state has an unsupported schema");
  for (const field of allowed.slice(1)) {
    if (typeof record[field] !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(record[field] as string)) throw new Error(`LLM diagnosis preparation state is missing or has an invalid ${field}`);
  }
  return record as DemoLlmPreparationState;
}

export function assertDemoLlmPreparationStateDoesNotContainSecrets(state: DemoLlmPreparationState, secrets: readonly string[]): void {
  const serialized = JSON.stringify(state);
  if (secrets.some(secret => secret.length > 0 && serialized.includes(secret))) throw new Error("LLM diagnosis preparation metadata contains credential material");
}

async function loadLlmPreparationState(config: DemoWorkspaceConfiguration): Promise<DemoLlmPreparationState | undefined> {
  try { return parseDemoLlmPreparationState(JSON.parse(await readFile(llmPreparationStatePath(config), "utf8"))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}

async function saveLlmPreparationState(config: DemoWorkspaceConfiguration, state: DemoLlmPreparationState, secrets: readonly string[]): Promise<void> {
  assertDemoLlmPreparationStateDoesNotContainSecrets(state, secrets);
  const target = llmPreparationStatePath(config);
  const temporary = target + "." + randomBytes(6).toString("hex") + ".tmp";
  await writeFile(temporary, JSON.stringify(state, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
  await rename(temporary, target);
  if (process.platform === "win32") await hardenWindowsPrivatePath(target, "file");
}

function preparationIdentity(state: DemoWorkspaceState, recordingId: string): DemoLlmPreparationState {
  return { schemaVersion: LLM_PREPARATION_SCHEMA_VERSION, projectId: state.projectId, flowId: state.flowId, subflowId: state.subflowId, graphFlowId: state.graphFlowId, routerId: state.routerId, recordingId };
}

async function requirePreparedLlmDiagnosis(control: ExistingFluxIQControlClient, config: DemoWorkspaceConfiguration, identity: DemoLlmPreparationState): Promise<DemoWorkspaceState> {
  const project = await control.requireProject(identity.projectId, "web-automation");
  const state: DemoWorkspaceState = { schemaVersion: SCHEMA_VERSION, origin: config.origin, username: config.username, projectId: identity.projectId, flowId: identity.flowId, subflowId: identity.subflowId, graphFlowId: identity.graphFlowId, routerId: identity.routerId, projectName: project.name, flowName: LLM_DIAGNOSIS_FLOW_NAME, latestRecordingId: identity.recordingId, updatedAt: new Date().toISOString() };
  await assertPreparedDiagnosisGraph(control, state, identity.recordingId);
  await control.selectExistingContext(identity.projectId);
  return state;
}

async function assertPreparedDiagnosisGraph(control: ExistingFluxIQControlClient, state: DemoWorkspaceState, recordingId: string): Promise<void> {
  const parent = await control.getExactFlow(state.projectId, state.flowId);
  assertDemoParentDocument(parent.document, state.projectId, state.flowId, LLM_DIAGNOSIS_FLOW_NAME);
  const subflow = (await control.listFlowSubflows(state.projectId, state.flowId)).find(item => item.subflowId === state.subflowId);
  if (!subflow || subflow.name !== LLM_DIAGNOSIS_SUBFLOW_NAME || subflow.graphFlowId !== state.graphFlowId) throw new RunnerFailure("environment.missing", "Saved LLM diagnosis Subflow identity no longer matches Core");
  const graph = await control.getExactFlow(state.projectId, state.graphFlowId);
  assertDemoSubflowOwnership(graph.document, state.projectId, state.flowId, state.subflowId, state.graphFlowId);
  assertLlmDiagnosisRecordingDerivedFlow(graph.document, recordingId);
  const router = await control.getFlowRouter(state.projectId, state.flowId);
  if (!router || router.routerId !== state.routerId || router.fallback?.kind !== "subflow" || router.fallback.subflowId !== state.subflowId) throw new RunnerFailure("environment.missing", "Saved LLM diagnosis Router no longer targets its owned Subflow");
}

async function existingDiagnosisRecordingId(control: ExistingFluxIQControlClient, state: DemoWorkspaceState): Promise<string | undefined> {
  const parent = await control.getExactFlow(state.projectId, state.flowId);
  const candidate = (parent.document.metadata as Record<string, unknown> | undefined)?.lastRecordingId;
  if (typeof candidate !== "string" || !candidate.trim()) return undefined;
  const recordings = recordingIds(await control.listRecordings(state.projectId));
  if (!recordings.has(candidate)) throw new RunnerFailure("environment.missing", "Diagnosis Flow references a recording that is no longer accessible");
  await assertPreparedDiagnosisGraph(control, state, candidate);
  return candidate;
}

async function restoreDiagnosisScenario(page: Page, evidence: BrowserEvidenceRecorder, purpose: string): Promise<void> {
  await evidence.step("scenario", `llm-restore-${purpose}`, "Restore the target-drift fixture to its deterministic baseline", () => page.getByTestId("restore-target").click());
  await page.getByTestId("drift-mode").filter({ hasText: "Mode: baseline" }).waitFor();
  await page.getByTestId("result").filter({ hasText: "Ready" }).waitFor();
  await page.getByTestId("diagnosis-target").waitFor();
}
async function loadWorkspaceState(config: DemoWorkspaceConfiguration): Promise<DemoWorkspaceState | LegacyDemoWorkspaceState | undefined> {
  try {
    const value = JSON.parse(await readFile(statePath(config), "utf8")) as Partial<DemoWorkspaceState> & { schemaVersion?: string };
    if (value.schemaVersion !== SCHEMA_VERSION && value.schemaVersion !== "0.2") return undefined;
    if (
      value.origin !== config.origin
      || value.username !== config.username
      || !value.projectId
      || !value.flowId
    ) throw new Error("Demo workspace state does not match this FluxIQ origin and user");
    if (value.schemaVersion === SCHEMA_VERSION && (!value.subflowId || !value.graphFlowId || !value.routerId)) throw new Error("Demo workspace hierarchy state is incomplete");
    if (config.projectId && value.projectId !== config.projectId) throw new Error("FLUXIQ_DEMO_PROJECT_ID conflicts with saved state");
    return value as DemoWorkspaceState | LegacyDemoWorkspaceState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function saveWorkspaceState(config: DemoWorkspaceConfiguration, state: DemoWorkspaceState): Promise<void> {
  const target = statePath(config);
  const temporary = target + "." + randomBytes(6).toString("hex") + ".tmp";
  await writeFile(temporary, JSON.stringify(state, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
  await rename(temporary, target);
  if (process.platform === "win32") await hardenWindowsPrivatePath(target, "file");
}

async function withWorkspaceLock<T>(config: DemoWorkspaceConfiguration, operation: () => Promise<T>): Promise<T> {
  await mkdir(config.workspaceDirectory, { recursive: true, mode: 0o700 });
  await mkdir(path.join(config.workspaceDirectory, "logs"), { recursive: true, mode: 0o700 });
  await mkdir(path.join(config.workspaceDirectory, "browser-profile-isolated"), { recursive: true, mode: 0o700 });
  await mkdir(path.join(config.workspaceDirectory, "panel-browser-profile-isolated-v2"), { recursive: true, mode: 0o700 });
  if (process.platform === "win32") await hardenWindowsPrivatePath(config.workspaceDirectory, "directory");
  const lock = await acquireWorkspaceOperationLock(config.workspaceDirectory);
  try {
    return await operation();
  } finally {
    await lock.release();
  }
}

async function waitForUrl(url: string, token: string, child?: ScenarioLabProcess): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child && (child.exitCode !== null || child.signalCode !== null)) {
      throw new RunnerFailure("process.startup", "Scenario Lab exited before its health endpoint became ready");
    }
    try {
      const response = await fetch(url, { headers: { authorization: "Bearer " + token } });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new RunnerFailure("process.startup", "Timed out waiting for " + url);
}

function statePath(config: DemoWorkspaceConfiguration): string {
  return path.join(config.workspaceDirectory, "workspace.json");
}

function required(value: string | undefined, name: string): string {
  const result = value?.trim();
  if (!result || /[\r\n]/u.test(result)) throw new Error(name + " is required and must be a single line");
  return result;
}

function safeId(value: string | undefined, name: string): string {
  const result = required(value, name);
  if (!/^[A-Za-z0-9._:-]{1,160}$/u.test(result)) throw new Error(name + " contains unsupported characters");
  return result;
}

function exactHttpOrigin(value: string, name: string): string {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${name} must be an exact HTTP(S) origin`);
  }
  return url.origin;
}

function requireLoopbackEndpoint(value: string, name: string): void {
  const hostname = new URL(value).hostname.toLowerCase();
  if (hostname !== "127.0.0.1" && hostname !== "localhost" && hostname !== "[::1]") {
    throw new Error(`${name} must use a loopback host for the self-managed demo Core`);
  }
}

function explicitPort(value: string, name: string): number {
  const url = new URL(value);
  if (!url.port) throw new Error(`${name} must include an explicit port`);
  const port = Number(url.port);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error(`${name} has an invalid port`);
  return port;
}

function optionalBoolean(value: string | undefined, name: string, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  if (value.trim().toLowerCase() === "true") return true;
  if (value.trim().toLowerCase() === "false") return false;
  throw new Error(`${name} must be true or false`);
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  const record = value as Record<string, unknown>;
  return "{" + Object.keys(record).sort().map(key => JSON.stringify(key) + ":" + stableJson(record[key])).join(",") + "}";
}
