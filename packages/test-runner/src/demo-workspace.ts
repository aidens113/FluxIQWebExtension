import { createHash, randomBytes } from "node:crypto";
import type { ChildProcess } from "node:child_process";
import { access, cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { allocateLoopbackPort } from "./allocation.js";
import { WebPanelAuthSessionCache } from "./auth-session.js";
import { BrowserEvidenceRecorder, type BrowserEvidenceSurface } from "./browser-evidence.js";
import { ExistingFluxIQControlClient, type ExistingFlowAdaptation, type ExistingFlowSummary, type ExistingRunDetail, type ExistingRunEvent, type ExistingRunIntervention, type RuntimeStatus } from "./existing-fluxiq-control.js";
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
import { loadScenarioManifest } from "./scenarios.js";
import { assertExpectedFacts, playwrightScenarioFactProbe } from "./scenario-assertions.js";
import { assertGenuinelyBlankFlow, assertRecordingSetUnchanged, BLANK_LLM_FLOW_NAME, BLANK_LLM_INSTRUCTION_BODY, BLANK_LLM_SCENARIO_PATH, isGenuinelyBlankFlowMismatch, loadBlankLlmPreparationState, prepareBlankLlmFlowViaUi, saveBlankLlmPreparationState, type BlankLlmPreparationState } from "./demo-llm-blank-workspace.js";
import { approveApplyExistingEvidenceGuidedCreationViaUi, assertProviderFreeGenerationReadiness, buildApproveApplyCreationViaUi, configureEvidenceGuidedCreationViaUi, configureFirstLiveCreationViaUi, exactVirtualizedHierarchyObject, inspectAppliedCreation, proposeEvidenceGuidedCreationViaUi, rejectStalePendingCreationAdaptation, type EvidenceGuidedCreationCheckpoint, type ProviderFreeGenerationReadiness } from "./demo-llm-create-ui.js";
import { findPendingEvidenceGuidedCreationForFlow, locateBoundAppliedEvidenceGuidedCreation, locateBoundPendingEvidenceGuidedCreation, locateExactPendingEvidenceGuidedCreation, locateLatestAppliedEvidenceGuidedCreation } from "./demo-llm-exploration-apply.js";
import { evaluateDemoLlmCreation, persistDemoLlmCreationResult, type DemoLlmCreationResult } from "./demo-llm-creation.js";
import { inspectDemoLlmAdaptationReadiness, type DemoLlmAdaptationReadiness } from "./demo-llm-adaptation-readiness.js";
import { inspectExactExplorationAdaptationReadiness, locateExactAppliedEvidenceGuidedCreation, requireExplorationBaselineDriftExplanation } from "./demo-llm-exploration-adaptation-readiness.js";
import { evaluateExplorationAdaptationApply, evaluateExplorationAdaptationProposal, evaluateExplorationAdaptationValidation, type ExplorationAdaptationApplyCheckpoint, type ExplorationAdaptationProposalCheckpoint, type ExplorationAdaptationValidationCheckpoint } from "./demo-llm-exploration-adaptation.js";
import { explorationAdaptationRunIsComplete, requireExactExplorationProposalIdentity } from "./demo-llm-exploration-adaptation-wait.js";
import { assertDemoLlmExplorationBindingScenario, createDemoLlmExplorationRequestBinding, DEFAULT_DEMO_LLM_EXPLORATION_SCENARIO_ID, loadDemoLlmExplorationRequestBinding, resolveDemoLlmExplorationRequest, saveDemoLlmExplorationRequestBinding, validateBoundExplorationRun, type DemoLlmExplorationRequest } from "./demo-llm-exploration-request.js";
import { rejectExactPendingExplorationTargetAdaptation, revertExactAppliedExplorationTargetAdaptation, type ExplorationAdaptationRejectResult, type ExplorationAdaptationRevertResult } from "./demo-llm-exploration-adaptation-revert.js";
import { evaluateDemoLlmAdaptation, FIRST_LIVE_ADAPTATION_PROFILE, persistDemoLlmAdaptationResult, type DemoLlmAdaptationResult } from "./demo-llm-adaptation.js";
import { controlExistingLlmTargetAdaptation, type ExistingTargetAdaptationAction, type ExistingTargetAdaptationControlResult, type ExistingTargetAdaptationSelector } from "./demo-llm-adaptation-control.js";
import { isActiveRuntimeAdaptationStatus, resolveAuthoritativeAdaptationStatus } from "./authoritative-adaptation-status.js";

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
export async function runDemoLlmPendingCreationProbe(config: DemoWorkspaceConfiguration): Promise<Readonly<{
  proposedCount: number;
  bootstrap: boolean;
  providerMatches: boolean;
  modelMatches: boolean;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
}>> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "Run pnpm demo:llm:prepare before the pending creation probe");
    assertDemoBlankStateSecrets(prepared, config);
    await assertGenuinelyBlankFlow(control, prepared);
    const proposed = await control.listFlowAdaptations(prepared.projectId, prepared.flowId, "proposed");
    if (proposed.length !== 1) {
      return Object.freeze({
        proposedCount: proposed.length,
        bootstrap: false,
        providerMatches: false,
        modelMatches: false,
      });
    }
    const adaptation = await control.getFlowAdaptation(prepared.projectId, prepared.flowId, proposed[0]!.adaptationId);
    return Object.freeze({
      proposedCount: 1,
      bootstrap: adaptation.adaptationKind === "flow_bootstrap",
      providerMatches: adaptation.accounting?.provider === "deepseek",
      modelMatches: adaptation.accounting?.model === "deepseek-chat",
      ...(adaptation.accounting?.inputTokens === undefined ? {} : { inputTokens: adaptation.accounting.inputTokens }),
      ...(adaptation.accounting?.outputTokens === undefined ? {} : { outputTokens: adaptation.accounting.outputTokens }),
      ...(adaptation.accounting?.totalTokens === undefined ? {} : { totalTokens: adaptation.accounting.totalTokens }),
      ...(adaptation.accounting?.estimatedCostUsd === undefined ? {} : { estimatedCostUsd: adaptation.accounting.estimatedCostUsd }),
    });
  }));
}
export async function runDemoLlmAppliedCreationProbe(config: DemoWorkspaceConfiguration): Promise<Readonly<{
  adaptationCount: number;
  appliedBootstrapCount: number;
  bindingChanged: boolean;
  currentMatchesApplied: boolean;
  settingsRevisionMatches: boolean;
  settingsRevisionAdvanced: boolean;
  subflowCount: number;
  graphBackedSubflowCount: number;
  routerPresent: boolean;
  ownedRouteCount: number;
  nodeCount?: number;
  edgeCount?: number;
  latestRunStatus?: RuntimeStatus;
  latestRunActionAttemptCount?: number;
  latestRunFailedActionCount?: number;
  graphDefinitionIds?: string[];
  latestActionDefinitions?: string[];
  latestActionStatuses?: string[];
  latestSubflowStatuses?: string[];
  graphEdges?: Array<{ sourcePortId?: string; targetPortId?: string }>;
  graphParameterKeys?: string[][];
  latestFailedActionCategory?: "target" | "parameters" | "gateway" | "timeout" | "action";
  adaptationStates?: Array<{ status: string; adaptationKind?: string; patchKinds: string[] }>;
}>> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "Run pnpm demo:llm:prepare before the applied creation probe");
    assertDemoBlankStateSecrets(prepared, config);
    const summaries = await control.listFlowAdaptations(prepared.projectId, prepared.flowId);
    const adaptationDetails = await Promise.all(summaries.map(item => control.getFlowAdaptation(prepared.projectId, prepared.flowId, item.adaptationId)));
    const applied = [];
    for (const summary of summaries.filter(item => item.status === "applied")) {
      const detail = await control.getFlowAdaptation(prepared.projectId, prepared.flowId, summary.adaptationId);
      if (detail.adaptationKind === "flow_bootstrap") applied.push(detail);
    }
    if (applied.length !== 1) return Object.freeze({ adaptationCount: summaries.length, appliedBootstrapCount: applied.length, bindingChanged: false, currentMatchesApplied: false, settingsRevisionMatches: false, settingsRevisionAdvanced: false, subflowCount: 0, graphBackedSubflowCount: 0, routerPresent: false, ownedRouteCount: 0 });
    const detail = applied[0]!;
    const binding = detail.bootstrapBinding;
    const subflows = await control.listFlowSubflows(prepared.projectId, prepared.flowId);
    const graphBacked = subflows.filter(item => Boolean(item.graphFlowId));
    const router = await control.getFlowRouter(prepared.projectId, prepared.flowId);
    const ownedIds = new Set(subflows.map(item => item.subflowId));
    const ownedRouteCount = router ? [router.fallback, ...router.rules.map(rule => rule.target)].filter(target => target?.kind === "subflow" && target.subflowId && ownedIds.has(target.subflowId)).length : 0;
    const graph = graphBacked.length === 1 ? await control.getExactFlow(prepared.projectId, graphBacked[0]!.graphFlowId!) : undefined;
    const latestRun = (await control.listFlowRuns(prepared.projectId, prepared.flowId)).sort((left, right) => right.updatedAt - left.updatedAt)[0];
    const latestDetail = latestRun ? await control.getRunDetail(prepared.projectId, latestRun.runId) : undefined;
    return Object.freeze({
      adaptationCount: summaries.length,
      adaptationStates: adaptationDetails.map(item => ({ status: item.status, ...(item.adaptationKind ? { adaptationKind: item.adaptationKind } : {}), patchKinds: [...(item.patchKinds ?? [])] })),
      appliedBootstrapCount: 1,
      bindingChanged: Boolean(binding?.baseExecutionDigest && binding?.appliedExecutionDigest && binding.baseExecutionDigest !== binding.appliedExecutionDigest),
      currentMatchesApplied: Boolean(binding?.currentExecutionDigest && binding?.currentExecutionDigest === binding?.appliedExecutionDigest),
      settingsRevisionMatches: binding?.baseSettingsRevision !== undefined && binding.baseSettingsRevision === binding.currentSettingsRevision,
      settingsRevisionAdvanced: binding?.baseSettingsRevision !== undefined && binding?.currentSettingsRevision !== undefined && binding.currentSettingsRevision > binding.baseSettingsRevision,
      subflowCount: subflows.length,
      graphBackedSubflowCount: graphBacked.length,
      routerPresent: Boolean(router),
      ownedRouteCount,
      ...(graph ? { nodeCount: Array.isArray(graph.document.nodes) ? graph.document.nodes.length : 0, edgeCount: Array.isArray(graph.document.edges) ? graph.document.edges.length : 0 } : {}),
      ...(latestRun ? { latestRunStatus: latestRun.status, latestRunActionAttemptCount: latestRun.actionAttemptCount } : {}),
      ...(latestDetail ? { latestRunFailedActionCount: latestDetail.actionAttempts.filter(item => item.status === "failed").length } : {}),
      ...(graph ? { graphDefinitionIds: (graph.document.nodes as Array<Record<string, unknown>>).flatMap(node => typeof node.definitionId === "string" ? [node.definitionId] : []) } : {}),
      ...(graph ? { graphEdges: (graph.document.edges as Array<Record<string, unknown>>).map(edge => ({ ...(typeof edge.sourcePortId === "string" ? { sourcePortId: edge.sourcePortId } : {}), ...(typeof edge.targetPortId === "string" ? { targetPortId: edge.targetPortId } : {}) })) } : {}),
      ...(graph ? { graphParameterKeys: (graph.document.nodes as Array<Record<string, unknown>>).map(node => node.parameterValues && typeof node.parameterValues === "object" && !Array.isArray(node.parameterValues) ? Object.keys(node.parameterValues as Record<string, unknown>).sort() : []) } : {}),
      ...(latestDetail ? {
        latestActionDefinitions: latestDetail.actionAttempts.map(item => item.definitionId),
        latestActionStatuses: latestDetail.actionAttempts.map(item => item.status),
        latestSubflowStatuses: latestDetail.subflows.map(item => item.status),
      } : {}),
      ...(latestDetail?.actionAttempts.find(item => item.status === "failed") ? { latestFailedActionCategory: categorizeActionFailure(latestDetail.actionAttempts.find(item => item.status === "failed")!.message) } : {}),
    });
  }));
}

export async function runDemoLlmAdaptationReadinessProbe(config: DemoWorkspaceConfiguration): Promise<DemoLlmAdaptationReadiness> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "Run pnpm demo:llm:prepare before the adaptation readiness probe", { details: { reasonCode: "adaptation_readiness.preparation_missing" } });
    assertDemoBlankStateSecrets(prepared, config);
    return inspectDemoLlmAdaptationReadiness(control, prepared);
  }));
}

export async function runDemoLlmExplorationAdaptationReadinessProbe(config: DemoWorkspaceConfiguration) {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "Run pnpm demo:llm:prepare before the exploration adaptation readiness probe");
    assertDemoBlankStateSecrets(prepared, config);
    return inspectExactExplorationAdaptationReadiness(control, prepared.projectId);
  }));
}

/** Provider-free rollback of the exact latest evidence-guided exploration target edit. */
export async function runDemoLlmExplorationAdaptationRevert(
  config: DemoWorkspaceConfiguration,
): Promise<ExplorationAdaptationRevertResult> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control } = await authenticatedControl(config);
    const projects = await control.listProjects("web-automation");
    const matches = config.projectId
      ? projects.filter(project => project.id === config.projectId)
      : projects.filter(project => project.name === config.projectName);
    if (matches.length !== 1) {
      throw new RunnerFailure("environment.missing", "Exact exploration target revert requires one configured web-automation project");
    }
    return revertExactAppliedExplorationTargetAdaptation(control, matches[0]!.id, config.pin);
  }));
}

/** Provider-free rejection of the exact newest evidence-guided exploration target proposal. */
export async function runDemoLlmExplorationAdaptationReject(
  config: DemoWorkspaceConfiguration,
): Promise<ExplorationAdaptationRejectResult> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control } = await authenticatedControl(config);
    const projects = await control.listProjects("web-automation");
    const matches = config.projectId
      ? projects.filter(project => project.id === config.projectId)
      : projects.filter(project => project.name === config.projectName);
    if (matches.length !== 1) {
      throw new RunnerFailure("environment.missing", "Exact exploration target reject requires one configured web-automation project");
    }
    return rejectExactPendingExplorationTargetAdaptation(control, matches[0]!.id, config.pin);
  }));
}

/**
 * Runs only the provider-backed proposal checkpoint against the exact latest
 * applied exploration Flow. Creation, baseline replay, approval, apply, and
 * post-apply replay are intentionally outside this command.
 */
export async function runDemoLlmExplorationAdaptationProposal(config: DemoWorkspaceConfiguration): Promise<ExplorationAdaptationProposalCheckpoint> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control, gatewayUrl, panelCookie } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "Run pnpm demo:llm:prepare before the exploration adaptation proposal checkpoint");
    assertDemoBlankStateSecrets(prepared, config);
    const authoritativeStatuses = new Map((await control.listFlowAdaptations(prepared.projectId, prepared.flowId))
      .map(item => [item.adaptationId, item.status] as const));
    const { target, readiness } = await inspectExactExplorationAdaptationReadiness(control, prepared.projectId, { allowCurrentExecutionDrift: true });
    const project = await control.requireProject(readiness.projectId, "web-automation");
    const summariesBefore = await control.listFlowAdaptations(readiness.projectId, readiness.flowId);
    const detailsBefore = await Promise.all(summariesBefore.map(item => control.getFlowAdaptation(readiness.projectId, readiness.flowId, item.adaptationId)));
    const statusFor = (item: ExistingFlowAdaptation, index: number) => resolveAuthoritativeAdaptationStatus(
      item.adaptationId, authoritativeStatuses, summariesBefore[index]?.status, item.status
    );
    const activeRuntimeAdaptations = detailsBefore.filter((item, index) => item.adaptationKind !== "flow_bootstrap"
      && isActiveRuntimeAdaptationStatus(statusFor(item, index)));
    if (activeRuntimeAdaptations.length) {
      throw new RunnerFailure("runtime.behavior", "Exploration adaptation proposal requires no pre-existing active runtime adaptation", { details: {
        reasonCode: "exploration_adaptation_run.preexisting_adaptation",
        activeAdaptationStates: activeRuntimeAdaptations.map(item => ({ status: item.status, adaptationKind: item.adaptationKind ?? "ordinary", patchKinds: item.patchKinds ?? [] })),
      } });
    }
    if (target.currentExecutionDigest !== target.appliedExecutionDigest) {
      const revertedTargets = detailsBefore.filter((item, index) => item.adaptationKind !== "flow_bootstrap"
        && statusFor(item, index) === "reverted"
        && item.patchKinds?.length === 1
        && item.patchKinds[0] === "edit_action_target"
        && item.sourceRunId
        && item.subflowId === readiness.subflowId);
      if (revertedTargets.length !== 1) {
        throw new RunnerFailure("runtime.behavior", "Exploration adaptation retry requires one exact reverted target adaptation to explain execution drift", { details: { reasonCode: "exploration_adaptation_run.binding_invalid" } });
      }
    }
    const existingAdaptationIds = new Set(summariesBefore.map(item => item.adaptationId));
    const recordingsBefore = recordingIds(await control.listRecordings(readiness.projectId));
    const state: DemoWorkspaceState = {
      schemaVersion: SCHEMA_VERSION,
      origin: config.origin,
      username: config.username,
      projectId: readiness.projectId,
      flowId: readiness.flowId,
      subflowId: readiness.subflowId,
      graphFlowId: readiness.graphFlowId,
      routerId: readiness.routerId,
      projectName: project.name,
      flowName: target.flowName,
      updatedAt: new Date().toISOString(),
    };
    return withDemoBrowser(config, panelCookie, "demo-llm-exploration-adaptation", async ({ extensionPage, panelPage, scenarioPage, scenarioUrl, evidence }) => {
      await openProjectInPanel(panelPage, config.origin, state.projectName, evidence);
      let flowTreeItemId = await selectFlowInCurrentProject(panelPage, state.flowName, evidence);
      await configureFirstLiveDiagnosisViaUi(panelPage, flowTreeItemId, config.pin, evidence, "2");
      await connectExtension(extensionPage, panelPage, control, gatewayUrl, config.origin, state.projectId, state.flowId, scenarioUrl, evidence);
      await evidence.step("scenario", "exploration-adaptation-introduce-drift", "Introduce one semantic target drift", () => scenarioPage.getByTestId("instruction-introduce-target-drift").click());
      await scenarioPage.getByTestId("instruction-target-drift-status").filter({ hasText: "Target mode: drifted" }).waitFor({ timeout: 10_000 });
      flowTreeItemId = await selectFlowInCurrentProject(panelPage, state.flowName, evidence);
      const started = await runAdaptationFromPanel(panelPage, flowTreeItemId, evidence);
      const run = await waitForAdaptationRun(control, state.projectId, started.runId);
      const adaptationId = requireExactExplorationProposalIdentity(run);
      const proposal = await control.getFlowAdaptation(state.projectId, state.flowId, adaptationId);
      const result = evaluateExplorationAdaptationProposal({ readiness, existingAdaptationIds, run, proposal });
      const review = panelPage.getByRole("button", { name: `Review ${proposal.adaptationId}`, exact: true });
      await review.waitFor({ state: "visible", timeout: 30_000 });
      if (await panelPage.getByRole("dialog").count() !== 0) throw new RunnerFailure("runtime.behavior", "Authenticated adaptation request unexpectedly left an authorization dialog open", { details: { reasonCode: "exploration_adaptation_run.authorization_prompt" } });
      assertRecordingSetUnchanged(recordingsBefore, await control.listRecordings(state.projectId));
      await assertAdaptationFlowsRemainRecordingFree(control, state);
      if ((await extensionStatus(extensionPage)).recordingState !== "idle") throw new RunnerFailure("recording.persistence", "Exploration adaptation activated the recorder");
      return result;
    }, credentialLiterals(config), BLANK_LLM_SCENARIO_PATH);
  }));
}

/** Applies the exact pending exploration runtime patch, then validates it once without LLM assistance. */
export async function runDemoLlmExplorationAdaptationApply(config: DemoWorkspaceConfiguration): Promise<ExplorationAdaptationApplyCheckpoint> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control, gatewayUrl, panelCookie } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "Run the exploration adaptation proposal checkpoint before apply");
    assertDemoBlankStateSecrets(prepared, config);
    const target = await locateExactAppliedEvidenceGuidedCreation(control, prepared.projectId, { allowCurrentExecutionDrift: true });
    const summaries = await control.listFlowAdaptations(target.projectId, target.flowId);
    const details = await Promise.all(summaries.map(item => control.getFlowAdaptation(target.projectId, target.flowId, item.adaptationId)));
    const pending = details.filter(item => item.adaptationKind !== "flow_bootstrap" && item.status === "proposed");
    if (pending.length !== 1 || details.some(item => item.adaptationKind !== "flow_bootstrap" && item !== pending[0] && ["proposed", "validated", "applied"].includes(item.status))) {
      throw new RunnerFailure("runtime.behavior", "Exploration adaptation apply requires exactly one pending target proposal", { details: { reasonCode: "exploration_adaptation_apply.pending_invalid" } });
    }
    const proposal = pending[0]!;
    const readiness = await inspectDemoLlmAdaptationReadiness(control, target, { allowPendingAdaptationId: proposal.adaptationId });
    if (!proposal.sourceRunId) throw new RunnerFailure("runtime.behavior", "Pending exploration adaptation has no source run", { details: { reasonCode: "exploration_adaptation_apply.source_invalid" } });
    const sourceRun = await control.getRunDetail(target.projectId, proposal.sourceRunId);
    const source = evaluateExplorationAdaptationProposal({
      readiness,
      existingAdaptationIds: new Set(summaries.map(item => item.adaptationId).filter(id => id !== proposal.adaptationId)),
      run: sourceRun,
      proposal,
    });
    const expectedAdaptationIds = new Set(summaries.map(item => item.adaptationId));
    const recordingsBefore = recordingIds(await control.listRecordings(target.projectId));
    const project = await control.requireProject(target.projectId, "web-automation");
    const state: DemoWorkspaceState = {
      schemaVersion: SCHEMA_VERSION, origin: config.origin, username: config.username,
      projectId: target.projectId, flowId: target.flowId, subflowId: readiness.subflowId,
      graphFlowId: readiness.graphFlowId, routerId: readiness.routerId, projectName: project.name,
      flowName: target.flowName, updatedAt: new Date().toISOString(),
    };
    return withDemoBrowser(config, panelCookie, "demo-llm-exploration-adaptation-apply", async ({ extensionPage, panelPage, scenarioPage, scenarioUrl, evidence }) => {
      const forbiddenEndpoints = ["generate-flow-bootstrap-adaptation", "preflight-llm-execution", "issue-llm-execution-grant"] as const;
      const forbiddenRequests: string[] = [];
      const context = panelPage.context();
      const routes = forbiddenEndpoints.map(endpoint => `**/api/programs/automation-studio/${endpoint}`);
      for (const [index, routePattern] of routes.entries()) {
        await context.route(routePattern, route => { forbiddenRequests.push(forbiddenEndpoints[index]!); return route.abort("blockedbyclient"); });
      }
      try {
        await openProjectInPanel(panelPage, config.origin, state.projectName, evidence);
        await connectExtension(extensionPage, panelPage, control, gatewayUrl, config.origin, state.projectId, state.flowId, scenarioUrl, evidence);
        await evidence.step("scenario", "exploration-adaptation-apply-drift", "Restore the semantic target drift for reviewed apply", () => scenarioPage.getByTestId("instruction-introduce-target-drift").click());
        await scenarioPage.getByTestId("instruction-target-drift-status").filter({ hasText: "Target mode: drifted" }).waitFor({ timeout: 10_000 });
        const flowTreeItemId = await selectFlowInCurrentProject(panelPage, state.flowName, evidence);
        await openAdaptationFromPanel(panelPage, flowTreeItemId, proposal.adaptationId, evidence);
        const applied = await reviewAndApplyAdaptationViaUi(panelPage, control, state, proposal.adaptationId, config.pin, evidence, true, "proposed");
        if (applied.appliedMutationCount !== 1) throw new RunnerFailure("runtime.behavior", "Exploration adaptation apply did not persist exactly one mutation", { details: { reasonCode: "exploration_adaptation_apply.mutation_invalid" } });
        const bootstrap = await control.getFlowAdaptation(state.projectId, state.flowId, readiness.bootstrapAdaptationId);
        const resultingExecutionDigest = bootstrap.bootstrapBinding?.currentExecutionDigest;
        if (!resultingExecutionDigest || resultingExecutionDigest === readiness.currentExecutionDigest) throw new RunnerFailure("runtime.behavior", "Exploration adaptation apply did not change the execution digest", { details: { reasonCode: "exploration_adaptation_apply.digest_unchanged" } });
        const validation = await runZeroLlmAdaptationValidation({ control, panelPage, scenarioPage, scenarioUrl, state, evidence, step: "exploration-apply" });
        await evidence.step("scenario", "exploration-adaptation-apply-reset", "Reset semantic target drift after validation", () => scenarioPage.getByTestId("instruction-reset-target-drift").click());
        await scenarioPage.getByTestId("instruction-target-drift-status").filter({ hasText: "Target mode: baseline" }).waitFor({ timeout: 10_000 });
        if (forbiddenRequests.length) throw new RunnerFailure("runtime.behavior", "Provider-free apply attempted a forbidden generation or LLM endpoint", { details: { reasonCode: "exploration_adaptation_apply.provider_endpoint_attempted" } });
        assertRecordingSetUnchanged(recordingsBefore, await control.listRecordings(state.projectId));
        await assertAdaptationFlowsRemainRecordingFree(control, state);
        if ((await extensionStatus(extensionPage)).recordingState !== "idle") throw new RunnerFailure("recording.persistence", "Exploration adaptation apply activated the recorder");
        const adaptationIdsAfter = new Set((await control.listFlowAdaptations(state.projectId, state.flowId)).map(item => item.adaptationId));
        return evaluateExplorationAdaptationApply({ readiness, source, applied, resultingExecutionDigest, validation, adaptationIdsAfter, expectedAdaptationIds });
      } finally {
        for (const routePattern of routes) await context.unroute(routePattern);
      }
    }, credentialLiterals(config), BLANK_LLM_SCENARIO_PATH);
  }));
}

/** Runs one provider-free deterministic validation of the already-applied exploration target adaptation. */
export async function runDemoLlmExplorationAdaptationValidation(config: DemoWorkspaceConfiguration): Promise<ExplorationAdaptationValidationCheckpoint> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control, gatewayUrl, panelCookie } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "Run the exploration adaptation apply checkpoint before validation");
    assertDemoBlankStateSecrets(prepared, config);
    const target = await locateExactAppliedEvidenceGuidedCreation(control, prepared.projectId, { allowCurrentExecutionDrift: true });
    const readiness = await inspectDemoLlmAdaptationReadiness(control, target);
    const summaries = await control.listFlowAdaptations(target.projectId, target.flowId);
    const details = await Promise.all(summaries.map(item => control.getFlowAdaptation(target.projectId, target.flowId, item.adaptationId)));
    const appliedTargets = details.filter(item => item.adaptationKind !== "flow_bootstrap" && item.status === "applied");
    if (appliedTargets.length !== 1 || appliedTargets[0]!.patchKinds?.length !== 1 || appliedTargets[0]!.patchKinds?.[0] !== "edit_action_target") {
      throw new RunnerFailure("runtime.behavior", "Exploration adaptation validation requires exactly one applied target adaptation", { details: { reasonCode: "exploration_adaptation_validation.target_invalid" } });
    }
    const applied = appliedTargets[0]!;
    if (!applied.sourceRunId) throw new RunnerFailure("runtime.behavior", "Applied exploration adaptation has no source run", { details: { reasonCode: "exploration_adaptation_validation.source_invalid" } });
    const sourceRun = await control.getRunDetail(target.projectId, applied.sourceRunId);
    if (sourceRun.providerCallCount !== 2) throw new RunnerFailure("runtime.behavior", "Applied exploration adaptation was not produced by the exact two-call source run", { details: { reasonCode: "exploration_adaptation_validation.source_invalid" } });
    const adaptationIdsBefore = new Set(summaries.map(item => item.adaptationId));
    const recordingsBefore = recordingIds(await control.listRecordings(target.projectId));
    const project = await control.requireProject(target.projectId, "web-automation");
    const state: DemoWorkspaceState = {
      schemaVersion: SCHEMA_VERSION, origin: config.origin, username: config.username,
      projectId: target.projectId, flowId: target.flowId, subflowId: readiness.subflowId,
      graphFlowId: readiness.graphFlowId, routerId: readiness.routerId, projectName: project.name,
      flowName: target.flowName, updatedAt: new Date().toISOString(),
    };
    return withDemoBrowser(config, panelCookie, "demo-llm-exploration-adaptation-validation", async ({ extensionPage, panelPage, scenarioPage, scenarioUrl, evidence }) => {
      const forbiddenEndpoints = ["generate-flow-bootstrap-adaptation", "preflight-llm-execution", "issue-llm-execution-grant"] as const;
      const forbiddenRequests: string[] = [];
      const context = panelPage.context();
      const routes = forbiddenEndpoints.map(endpoint => `**/api/programs/automation-studio/${endpoint}`);
      for (const [index, routePattern] of routes.entries()) {
        await context.route(routePattern, route => { forbiddenRequests.push(forbiddenEndpoints[index]!); return route.abort("blockedbyclient"); });
      }
      try {
        await openProjectInPanel(panelPage, config.origin, state.projectName, evidence);
        await connectExtension(extensionPage, panelPage, control, gatewayUrl, config.origin, state.projectId, state.flowId, scenarioUrl, evidence);
        await evidence.step("scenario", "exploration-adaptation-validation-drift", "Ensure the semantic target fixture is drifted", () => scenarioPage.getByTestId("instruction-introduce-target-drift").click());
        await scenarioPage.getByTestId("instruction-target-drift-status").filter({ hasText: "Target mode: drifted" }).waitFor({ timeout: 10_000 });
        const validation = await runZeroLlmAdaptationValidation({ control, panelPage, scenarioPage, scenarioUrl, state, evidence, step: "exploration-validation" });
        if (forbiddenRequests.length) throw new RunnerFailure("runtime.behavior", "Provider-free validation attempted a forbidden generation or LLM endpoint", { details: { reasonCode: "exploration_adaptation_validation.provider_endpoint_attempted" } });
        assertRecordingSetUnchanged(recordingsBefore, await control.listRecordings(state.projectId));
        await assertAdaptationFlowsRemainRecordingFree(control, state);
        if ((await extensionStatus(extensionPage)).recordingState !== "idle") throw new RunnerFailure("recording.persistence", "Exploration adaptation validation activated the recorder");
        const adaptationIdsAfter = new Set((await control.listFlowAdaptations(state.projectId, state.flowId)).map(item => item.adaptationId));
        return evaluateExplorationAdaptationValidation({ readiness, applied, sourceRun, validation, adaptationIdsBefore, adaptationIdsAfter });
      } finally {
        if (!scenarioPage.isClosed()) {
          await scenarioPage.getByTestId("instruction-reset-target-drift").click({ timeout: 3_000 }).catch(() => undefined);
          await scenarioPage.getByTestId("instruction-target-drift-status").filter({ hasText: "Target mode: baseline" }).waitFor({ timeout: 3_000 }).catch(() => undefined);
        }
        for (const routePattern of routes) await context.unroute(routePattern);
      }
    }, credentialLiterals(config), BLANK_LLM_SCENARIO_PATH);
  }));
}

export async function runDemoLlmExplorationBaselineProbe(config: DemoWorkspaceConfiguration): Promise<Readonly<{
  status: "passed";
  providerCallCount: 0;
  projectId: string;
  flowId: string;
  subflowId: string;
  graphFlowId: string;
  routerId: string;
  runId: string;
  nodeCount: number;
  actionAttemptCount: number;
}>> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control, gatewayUrl, panelCookie } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "Run pnpm demo:llm:prepare before the exploration baseline probe");
    assertDemoBlankStateSecrets(prepared, config);
    const target = await locateExactAppliedEvidenceGuidedCreation(control, prepared.projectId, { allowCurrentExecutionDrift: true });
    const project = await control.requireProject(target.projectId, "web-automation");
    const subflows = await control.listFlowSubflows(target.projectId, target.flowId);
    if (subflows.length !== 1 || !subflows[0]!.graphFlowId) throw new RunnerFailure("runtime.behavior", "Exploration baseline requires one graph-backed owned Subflow");
    const subflow = subflows[0]!;
    await requireExplorationBaselineDriftExplanation(control, target, subflow.subflowId);
    const graphFlowId = subflow.graphFlowId!;
    const router = await control.getFlowRouter(target.projectId, target.flowId);
    if (!router) throw new RunnerFailure("runtime.behavior", "Exploration baseline requires one exact Flow Router");
    const ownedRouteCount = [router.fallback, ...router.rules.map(rule => rule.target)]
      .filter(route => route?.kind === "subflow" && route.subflowId === subflow.subflowId).length;
    if (ownedRouteCount !== 1) throw new RunnerFailure("runtime.behavior", "Exploration baseline requires exactly one route to its owned Subflow");
    const graph = await control.getExactFlow(target.projectId, graphFlowId);
    const nodeCount = Array.isArray(graph.document.nodes) ? graph.document.nodes.length : 0;
    if (!nodeCount) throw new RunnerFailure("runtime.behavior", "Exploration baseline requires a nonempty generated graph");
    const state: DemoWorkspaceState = {
      schemaVersion: SCHEMA_VERSION,
      origin: config.origin,
      username: config.username,
      projectId: target.projectId,
      flowId: target.flowId,
      projectName: project.name,
      flowName: target.flowName,
      subflowId: subflow.subflowId,
      graphFlowId,
      routerId: router.routerId,
      updatedAt: new Date().toISOString(),
    };
    const recordingsBefore = recordingIds(await control.listRecordings(target.projectId));
    const adaptationsBefore = new Set((await control.listFlowAdaptations(target.projectId, target.flowId)).map(item => item.adaptationId));
    return withDemoBrowser(config, panelCookie, "demo-llm-exploration-baseline", async ({ extensionPage, panelPage, scenarioPage, scenarioUrl, evidence }) => {
      await openProjectInPanel(panelPage, config.origin, project.name, evidence);
      await connectExtension(extensionPage, panelPage, control, gatewayUrl, config.origin, target.projectId, target.flowId, scenarioUrl, evidence);
      await selectFlowInCurrentProject(panelPage, target.flowName, evidence);
      const run = await runDemoFlowFromPanel(panelPage, state, evidence);
      const detail = await waitForRoutedRunDetail(control, state, run.runId, nodeCount);
      if (detail.summary.status !== "succeeded" || detail.actionAttempts.length < 1
        || detail.actionAttempts.some(item => item.status !== "succeeded") || (detail.providerCallCount ?? 0) !== 0
        || (detail.interventions?.length ?? 0) !== 0 || (detail.adaptationIds?.length ?? 0) !== 0
        || (detail.changeProposalIds?.length ?? 0) !== 0 || (detail.summary.adaptationCount ?? 0) !== 0) {
        throw new RunnerFailure("runtime.behavior", "Exploration baseline was not a successful deterministic zero-LLM run");
      }
      await scenarioPage.getByTestId("result").filter({ hasText: "Submitted: Ada / team" }).waitFor({ timeout: 30_000 });
      assertRecordingSetUnchanged(recordingsBefore, await control.listRecordings(target.projectId));
      const adaptationsAfter = new Set((await control.listFlowAdaptations(target.projectId, target.flowId)).map(item => item.adaptationId));
      if (adaptationsAfter.size !== adaptationsBefore.size || [...adaptationsBefore].some(id => !adaptationsAfter.has(id))) {
        throw new RunnerFailure("runtime.behavior", "Exploration baseline changed the Flow adaptation set");
      }
      if ((await extensionStatus(extensionPage)).recordingState !== "idle") throw new RunnerFailure("recording.persistence", "Exploration baseline activated the recorder");
      return Object.freeze({
        status: "passed" as const,
        providerCallCount: 0 as const,
        projectId: target.projectId,
        flowId: target.flowId,
        subflowId: subflow.subflowId,
        graphFlowId,
        routerId: router.routerId,
        runId: detail.summary.runId,
        nodeCount,
        actionAttemptCount: detail.actionAttempts.length,
      });
    }, credentialLiterals(config), BLANK_LLM_SCENARIO_PATH);
  }));
}

export async function runDemoLlmAppliedCreationRevertProbe(config: DemoWorkspaceConfiguration): Promise<Readonly<{
  status: "passed";
  providerCallCount: 0;
  revertedBootstrapCount: 1;
  nodeCount: 0;
  edgeCount: 0;
  subflowCount: 0;
  routerPresent: false;
}>> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "Run pnpm demo:llm:prepare before the applied creation revert probe");
    assertDemoBlankStateSecrets(prepared, config);
    const summaries = await control.listFlowAdaptations(prepared.projectId, prepared.flowId, "applied");
    const applied = [];
    for (const summary of summaries) {
      const detail = await control.getFlowAdaptation(prepared.projectId, prepared.flowId, summary.adaptationId);
      if (detail.adaptationKind === "flow_bootstrap") applied.push(detail);
    }
    if (applied.length !== 1) throw new RunnerFailure("runtime.behavior", "Applied creation revert requires exactly one applied Flow bootstrap adaptation");
    await control.revertFlowAdaptation({
      projectId: prepared.projectId,
      flowId: prepared.flowId,
      adaptationId: applied[0]!.adaptationId,
      authorizationPin: config.pin,
      reason: "Provider-free deterministic test repair after failed replay validation",
    });
    const flow = await control.getExactFlow(prepared.projectId, prepared.flowId);
    const nodeCount = Array.isArray(flow.document.nodes) ? flow.document.nodes.length : -1;
    const edgeCount = Array.isArray(flow.document.edges) ? flow.document.edges.length : -1;
    const subflowCount = (await control.listFlowSubflows(prepared.projectId, prepared.flowId)).length;
    const routerPresent = Boolean(await control.getFlowRouter(prepared.projectId, prepared.flowId));
    if (nodeCount !== 0 || edgeCount !== 0 || subflowCount !== 0 || routerPresent) throw new RunnerFailure("runtime.behavior", "Flow Bootstrap revert did not restore the certified blank topology");
    return Object.freeze({ status: "passed" as const, providerCallCount: 0 as const, revertedBootstrapCount: 1 as const, nodeCount: 0 as const, edgeCount: 0 as const, subflowCount: 0 as const, routerPresent: false as const });
  }));
}

function categorizeActionFailure(message: string | undefined): "target" | "parameters" | "gateway" | "timeout" | "action" {
  const value = message?.toLowerCase() ?? "";
  if (/target|not found|locator|selector/u.test(value)) return "target";
  if (/parameter|required|invalid|payload/u.test(value)) return "parameters";
  if (/gateway|client|session|transport/u.test(value)) return "gateway";
  if (/timeout|timed out/u.test(value)) return "timeout";
  return "action";
}
export async function runDemoLlmAppliedCreationReplayProbe(config: DemoWorkspaceConfiguration): Promise<Readonly<{
  status: "passed";
  providerCallCount: 0;
  runCount: 2;
  nodeCount: number;
  actionAttemptCount: number;
}>> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control, gatewayUrl, panelCookie } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "Run pnpm demo:llm:prepare before the applied creation replay probe");
    assertDemoBlankStateSecrets(prepared, config);
    const project = await control.requireProject(prepared.projectId, "web-automation");
    const subflows = await control.listFlowSubflows(prepared.projectId, prepared.flowId);
    if (subflows.length !== 1 || !subflows[0]!.graphFlowId) throw new RunnerFailure("runtime.behavior", "Applied creation replay requires one graph-backed Subflow");
    const router = await control.getFlowRouter(prepared.projectId, prepared.flowId);
    if (!router) throw new RunnerFailure("runtime.behavior", "Applied creation replay requires a Router");
    const owned = subflows[0]!;
    const graph = await control.getExactFlow(prepared.projectId, owned.graphFlowId!);
    const nodeCount = Array.isArray(graph.document.nodes) ? graph.document.nodes.length : 0;
    if (!nodeCount) throw new RunnerFailure("runtime.behavior", "Applied creation replay requires executable graph nodes");
    const state: DemoWorkspaceState = {
      schemaVersion: SCHEMA_VERSION, origin: config.origin, username: config.username,
      projectId: prepared.projectId, flowId: prepared.flowId, projectName: project.name, flowName: BLANK_LLM_FLOW_NAME,
      subflowId: owned.subflowId, graphFlowId: owned.graphFlowId!, routerId: router.routerId,
      updatedAt: new Date().toISOString(),
    };
    const beforeRecordings = recordingIds(await control.listRecordings(prepared.projectId));
    return withDemoBrowser(config, panelCookie, "demo-llm-create-replay", async ({ extensionPage, panelPage, scenarioPage, scenarioUrl, evidence }) => {
      await openProjectInPanel(panelPage, config.origin, project.name, evidence);
      await connectExtension(extensionPage, panelPage, control, gatewayUrl, config.origin, state.projectId, state.flowId, scenarioUrl, evidence);
      let actionAttemptCount = 0;
      for (let index = 0; index < 2; index += 1) {
        if (index) await evidence.step("scenario", "applied-replay-reset", "Reload the applied-creation scenario before replay", () => scenarioPage.goto(scenarioUrl).then(() => undefined));
        await openFlowInCurrentProject(panelPage, BLANK_LLM_FLOW_NAME, evidence);
        const run = await runDemoFlowFromPanel(panelPage, state, evidence);
        const detail = await waitForRoutedRunDetail(control, state, run.runId, nodeCount);
        if (detail.summary.status !== "succeeded" || detail.actionAttempts.some(item => item.status !== "succeeded") || (detail.providerCallCount ?? 0) !== 0 || (detail.interventions?.length ?? 0) !== 0) {
          throw new RunnerFailure("runtime.behavior", "Applied creation deterministic replay failed or invoked the LLM");
        }
        actionAttemptCount += detail.actionAttempts.length;
        await scenarioPage.getByTestId("result").filter({ hasText: "Submitted: Ada / team" }).waitFor({ timeout: 30_000 });
      }
      assertRecordingSetUnchanged(beforeRecordings, await control.listRecordings(prepared.projectId));
      if ((await extensionStatus(extensionPage)).recordingState !== "idle") throw new RunnerFailure("recording.persistence", "Applied creation replay activated the recorder");
      return Object.freeze({ status: "passed" as const, providerCallCount: 0 as const, runCount: 2 as const, nodeCount, actionAttemptCount });
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
      const rejectedPendingCount = await evidence.step("panel", "create-pending-cleanup", "Reject a stale pending Flow bootstrap proposal", () => rejectStalePendingCreationAdaptation(control, prepared.projectId, prepared.flowId, config.pin), { sensitive: true });
      await evidence.diagnostic("panel", "pending-creation-cleanup", "pending-creation-cleanup.v1", { rejectedPendingCount });
      await configureFirstLiveCreationViaUi(panelPage, flowTreeItemId, config.pin, evidence);
      await connectExtension(extensionPage, panelPage, control, gatewayUrl, config.origin, prepared.projectId, prepared.flowId, scenarioUrl, evidence);
      const recorderStatus = await extensionStatus(extensionPage);
      if (recorderStatus.recordingState !== "idle") throw new RunnerFailure("recording.persistence", "Live creation requires an idle recorder");
      await assertGenuinelyBlankFlow(control, prepared);
      assertRecordingSetUnchanged(beforeRecordings, await control.listRecordings(prepared.projectId));

      flowTreeItemId = await openFlowInCurrentProject(panelPage, BLANK_LLM_FLOW_NAME, evidence);
      const created = await buildApproveApplyCreationViaUi({
        page: panelPage, flowTreeItemId, projectId: prepared.projectId, flowId: prepared.flowId,
        pin: config.pin, evidence, control, blankContentHash: blankFlow.contentHash,
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

export async function runDemoLlmExplorationCheckpoint(config: DemoWorkspaceConfiguration, requested?: DemoLlmExplorationRequest): Promise<EvidenceGuidedCreationCheckpoint> {
  const request = requested ?? await resolveDemoLlmExplorationRequest(config.repositoryRoot, {});
  const scenario = await loadScenarioManifest(config.repositoryRoot, request.scenarioId);
  if (request.scenarioPath !== scenario.startPath) throw new RunnerFailure("fixture.invalid", "Exploration request does not match the registered scenario path");
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control, gatewayUrl, panelCookie } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "Run pnpm demo:llm:prepare before the exploration checkpoint");
    const project = await control.requireProject(prepared.projectId, "web-automation");
    const flowName = await resolveExplorationFlowNameForRecovery(control, project.id, request);
    if (request.scenarioId !== DEFAULT_DEMO_LLM_EXPLORATION_SCENARIO_ID) {
      const exact = (await control.listFlowSummaries(project.id)).find(item => item.name === flowName);
      if (exact) {
        const recovered = await findPendingEvidenceGuidedCreationForFlow(control, project.id, exact);
        if (recovered) {
          await saveDemoLlmExplorationRequestBinding(config.workspaceDirectory, createDemoLlmExplorationRequestBinding(request, {
            projectId: recovered.projectId, flowId: recovered.flowId, adaptationId: recovered.adaptationId,
          }), credentialLiterals(config));
          return recovered.checkpoint;
        }
      }
    }
    return withDemoBrowser(config, panelCookie, "demo-llm-explore", async ({ extensionPage, panelPage, scenarioPage, scenarioUrl, evidence }) => {
      const fixture = await prepareBlankLlmFlowViaUi({
        control,
        config: { workspaceDirectory: config.workspaceDirectory, origin: config.origin, projectId: prepared.projectId, projectName: project.name, pin: config.pin },
        page: panelPage,
        evidence,
        flowName,
        ensureInstruction: false,
      });
      await configureEvidenceGuidedCreationViaUi(panelPage, fixture.flowTreeItemId, flowName, config.pin, evidence);
      await connectExtension(extensionPage, panelPage, control, gatewayUrl, config.origin, fixture.state.projectId, fixture.state.flowId, scenarioUrl, evidence);
      if ((await extensionStatus(extensionPage)).recordingState !== "idle") throw new RunnerFailure("recording.persistence", "Exploration checkpoint requires an idle recorder");
      const blankFlow = await control.getExactFlow(fixture.state.projectId, fixture.state.flowId);
      const result = await proposeEvidenceGuidedCreationViaUi({
        page: panelPage,
        flowTreeItemId: fixture.flowTreeItemId,
        flowName,
        projectId: fixture.state.projectId,
        flowId: fixture.state.flowId,
        evidence,
        control,
        blankContentHash: blankFlow.contentHash,
        instruction: request.instruction,
        targetPage: scenarioPage,
      });
      assertRecordingSetUnchanged(fixture.recordingIdsBefore, await control.listRecordings(fixture.state.projectId));
      if ((await extensionStatus(extensionPage)).recordingState !== "idle") throw new RunnerFailure("recording.persistence", "Exploration checkpoint activated the recorder");
      await saveDemoLlmExplorationRequestBinding(config.workspaceDirectory, createDemoLlmExplorationRequestBinding(request, {
        projectId: fixture.state.projectId,
        flowId: fixture.state.flowId,
        adaptationId: result.adaptationId,
      }), credentialLiterals(config));
      return result;
    }, credentialLiterals(config), request.scenarioPath);
  }));
}

export function explorationFlowName(request: DemoLlmExplorationRequest): string {
  if (request.scenarioId === DEFAULT_DEMO_LLM_EXPLORATION_SCENARIO_ID) {
    return `Website Exploration Checkpoint ${randomBytes(5).toString("hex")}`;
  }
  const requestDigest = createHash("sha256")
    .update(request.scenarioId, "utf8")
    .update("\0", "utf8")
    .update(request.scenarioPath, "utf8")
    .update("\0", "utf8")
    .update(request.instruction, "utf8")
    .digest("hex")
    .slice(0, 10);
  return `Website Exploration ${request.scenarioId} ${requestDigest}`;
}

export async function resolveExplorationFlowNameForRecovery(
  control: ExistingFluxIQControlClient,
  projectId: string,
  request: DemoLlmExplorationRequest,
): Promise<string> {
  const expectedName = explorationFlowName(request);
  if (request.scenarioId === DEFAULT_DEMO_LLM_EXPLORATION_SCENARIO_ID) return expectedName;
  const summaries = await control.listFlowSummaries(projectId);
  if (summaries.some(item => item.name === expectedName)) return expectedName;
  const legacyPrefix = `Website Exploration ${request.scenarioId} `;
  const recoverable: ExistingFlowSummary[] = [];
  for (const candidate of summaries.filter(item => item.name.startsWith(legacyPrefix))) {
    try {
      await assertGenuinelyBlankFlow(control, { schemaVersion: "0.1", projectId, flowId: candidate.flowId });
      recoverable.push(candidate);
    } catch (error) {
      if (!isGenuinelyBlankFlowMismatch(error)) throw error;
      // Applied, proposed, or otherwise nonblank prior attempts are not
      // eligible for crash recovery.
    }
  }
  if (recoverable.length > 1) throw new RunnerFailure("environment.missing", "More than one recoverable blank exploration Flow exists for this scenario");
  return recoverable[0]?.name ?? expectedName;
}

export type BoundExplorationApplyCheckpoint = Readonly<{
  providerCallCount: 0;
  scenarioId: string;
  projectId: string;
  flowId: string;
  adaptationId: string;
  graphFlowId: string;
  nodeCount: number;
  executableNodeCount: number;
}>;

export async function runBoundDemoLlmExplorationApplyCheckpoint(config: DemoWorkspaceConfiguration): Promise<BoundExplorationApplyCheckpoint> {
  const binding = await loadDemoLlmExplorationRequestBinding(config.workspaceDirectory);
  if (!binding) throw new RunnerFailure("environment.missing", "Run pnpm demo:llm:explore before its bound apply continuation");
  const scenario = await loadScenarioManifest(config.repositoryRoot, binding.scenarioId);
  assertDemoLlmExplorationBindingScenario(binding, scenario);
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control, panelCookie } = await authenticatedControl(config);
    const target = await locateBoundPendingEvidenceGuidedCreation(control, binding);
    const project = await control.requireProject(binding.projectId, "web-automation");
    const beforeRecordings = recordingIds(await control.listRecordings(binding.projectId));
    return withDemoPanelBrowser(config, panelCookie, "demo-llm-exploration-request-apply", async ({ panelPage, evidence }) => {
      await openProjectInPanel(panelPage, config.origin, project.name, evidence);
      const flowTreeItemId = await openFlowInCurrentProject(panelPage, target.flowName, evidence);
      let providerCallCount = 0;
      const observeRequest = (request: import("@playwright/test").Request) => {
        if (request.method() === "POST" && request.url().includes("/api/programs/automation-studio/generate-flow-bootstrap-adaptation")) providerCallCount += 1;
      };
      panelPage.context().on("request", observeRequest);
      try {
        const topology = await approveApplyExistingEvidenceGuidedCreationViaUi({
          page: panelPage, flowTreeItemId, projectId: target.projectId, flowId: target.flowId,
          adaptationId: target.adaptationId, pin: config.pin, evidence, control,
          blankContentHash: target.blankContentHash, baseExecutionDigest: target.baseExecutionDigest,
        });
        if (providerCallCount !== 0) throw new RunnerFailure("runtime.behavior", "Bound proposal apply invoked Flow generation");
        assertRecordingSetUnchanged(beforeRecordings, await control.listRecordings(binding.projectId));
        return Object.freeze({
          providerCallCount: 0 as const, scenarioId: binding.scenarioId, projectId: binding.projectId,
          flowId: binding.flowId, adaptationId: binding.adaptationId, graphFlowId: topology.graphFlowId,
          nodeCount: topology.nodeCount, executableNodeCount: topology.executableNodeCount,
        });
      } finally { panelPage.context().off("request", observeRequest); }
    }, credentialLiterals(config));
  }));
}

export type BoundExplorationRunCheckpoint = Readonly<{
  providerCallCount: 0;
  interventionCount: 0;
  scenarioId: string;
  projectId: string;
  flowId: string;
  adaptationId: string;
  runId: string;
  actionAttemptCount: number;
  succeededActionCount: number;
  routedOwnedSubflow: true;
  manifestFinalStateChecked: boolean;
  recordingCount: number;
}>;

export const boundExplorationRunStages = [
  "pre_browser_identity",
  "pre_browser_topology",
  "browser_execution",
  "manifest_oracle",
  "final_validation",
] as const;
export type BoundExplorationRunStage = typeof boundExplorationRunStages[number];

function boundExplorationRunFailure(stage: BoundExplorationRunStage, reasonCode: string, cause: unknown): RunnerFailure {
  return new RunnerFailure("runtime.behavior", `Bound exploration run failed during ${stage.replaceAll("_", " ")}`, {
    cause,
    details: { stage, reasonCode },
  });
}

function isBoundExplorationRunFailure(error: unknown): error is RunnerFailure {
  return error instanceof RunnerFailure && boundExplorationRunStages.includes(error.details?.stage as BoundExplorationRunStage);
}

export async function runBoundDemoLlmExplorationFlow(config: DemoWorkspaceConfiguration): Promise<BoundExplorationRunCheckpoint> {
  let binding;
  let manifest;
  try {
    binding = await loadDemoLlmExplorationRequestBinding(config.workspaceDirectory);
    if (!binding) throw new Error("Bound request identity is unavailable");
    manifest = await loadScenarioManifest(config.repositoryRoot, binding.scenarioId);
    assertDemoLlmExplorationBindingScenario(binding, manifest);
  } catch (cause) {
    throw boundExplorationRunFailure("pre_browser_identity", "exploration_request_run.identity_invalid", cause);
  }
  try {
    return await withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    let authenticated;
    try {
      authenticated = await authenticatedControl(config);
    } catch (cause) {
      throw boundExplorationRunFailure("pre_browser_identity", "exploration_request_run.identity_invalid", cause);
    }
    const { control, gatewayUrl, panelCookie } = authenticated;
    let applied;
    let topology;
    let project;
    let beforeRecordings;
    try {
      // Running from the UI can persist launch-policy settings without changing
      // the applied graph. Keep the exact bound adaptation/topology identity, but
      // permit that non-topology execution digest drift on repeat runs.
      applied = await locateBoundAppliedEvidenceGuidedCreation(control, binding, { allowCurrentExecutionDrift: true });
      topology = await inspectAppliedCreation(control, applied.projectId, applied.flowId, applied.baseExecutionDigest, applied.appliedExecutionDigest);
      project = await control.requireProject(binding.projectId, "web-automation");
      beforeRecordings = recordingIds(await control.listRecordings(binding.projectId));
    } catch (cause) {
      throw boundExplorationRunFailure("pre_browser_topology", "exploration_request_run.topology_invalid", cause);
    }
    try {
      return await withDemoBrowser(config, panelCookie, "demo-llm-exploration-request-run", async ({ extensionPage, panelPage, scenarioPage, scenarioUrl, evidence }) => {
      let detail;
      let execution;
      try {
        await openProjectInPanel(panelPage, config.origin, project.name, evidence);
        await openFlowInCurrentProject(panelPage, applied.flowName, evidence);
        await connectExtension(extensionPage, panelPage, control, gatewayUrl, config.origin, binding.projectId, binding.flowId, scenarioUrl, evidence);
        if ((await extensionStatus(extensionPage)).recordingState !== "idle") throw new Error("Recorder is not idle before execution");
        const state: DemoWorkspaceState = {
          schemaVersion: SCHEMA_VERSION, origin: config.origin, username: config.username, projectId: binding.projectId,
          flowId: binding.flowId, projectName: project.name, flowName: applied.flowName, subflowId: topology.ownedSubflowId,
          graphFlowId: topology.graphFlowId, routerId: topology.routerId, updatedAt: new Date().toISOString(),
        };
        execution = await runDemoFlowFromPanel(panelPage, state, evidence);
        detail = await waitForRoutedRunDetail(control, state, execution.runId, topology.nodeCount);
      } catch (cause) {
        throw boundExplorationRunFailure("browser_execution", "exploration_request_run.browser_execution_failed", cause);
      }
      const interventions = detail.interventions ?? [];
      const finalFacts = manifest.expected.finalState ?? [];
      try {
        if (finalFacts.length) await assertExpectedFacts(finalFacts, playwrightScenarioFactProbe(scenarioPage));
      } catch (cause) {
        throw boundExplorationRunFailure("manifest_oracle", "exploration_request_run.manifest_oracle_failed", cause);
      }
      let validated;
      try {
        const afterRecordings = recordingIds(await control.listRecordings(binding.projectId));
        validated = validateBoundExplorationRun({
          runId: execution.runId, dispatchStatus: execution.status, detailStatus: detail.summary.status,
          ...(detail.providerCallCount === undefined ? {} : { providerCallCount: detail.providerCallCount }), interventionCount: interventions.length,
          actionStatuses: detail.actionAttempts.map(attempt => attempt.status),
          selectedSubflowIds: detail.routeDecisions.map(decision => decision.selectedSubflowId), subflows: detail.subflows,
          ownedSubflowId: topology.ownedSubflowId, graphFlowId: topology.graphFlowId,
          recordingIdsBefore: [...beforeRecordings], recordingIdsAfter: [...afterRecordings],
        });
        if ((await extensionStatus(extensionPage)).recordingState !== "idle") throw new Error("Recorder is not idle after execution");
      } catch (cause) {
        throw boundExplorationRunFailure("final_validation", "exploration_request_run.final_validation_failed", cause);
      }
      return Object.freeze({
        providerCallCount: 0 as const, interventionCount: 0 as const, scenarioId: binding.scenarioId,
        projectId: binding.projectId, flowId: binding.flowId, adaptationId: binding.adaptationId,
        runId: validated.runId, actionAttemptCount: validated.actionAttemptCount,
        succeededActionCount: validated.succeededActionCount, routedOwnedSubflow: validated.routedOwnedSubflow,
        manifestFinalStateChecked: finalFacts.length > 0, recordingCount: validated.recordingCount,
      });
      }, credentialLiterals(config), binding.scenarioPath);
    } catch (cause) {
      if (isBoundExplorationRunFailure(cause)) throw cause;
      throw boundExplorationRunFailure("browser_execution", "exploration_request_run.browser_execution_failed", cause);
    }
    }));
  } catch (cause) {
    if (isBoundExplorationRunFailure(cause)) throw cause;
    throw boundExplorationRunFailure("pre_browser_identity", "exploration_request_run.identity_invalid", cause);
  }
}

export type EvidenceGuidedCreationApplyCheckpoint = Readonly<{
  providerCallCount: 0;
  subflowCount: 1;
  routerCount: 1;
  ownedRouteCount: 1;
  nodeCount: number;
  edgeCount: number;
  executableNodeCount: number;
  definitionIds: string[];
  parameterKeys: string[][];
}>;

export async function runDemoLlmExplorationApplyCheckpoint(config: DemoWorkspaceConfiguration): Promise<EvidenceGuidedCreationApplyCheckpoint> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control, panelCookie } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "Run pnpm demo:llm:prepare before applying an exploration proposal");
    assertDemoBlankStateSecrets(prepared, config);
    const project = await control.requireProject(prepared.projectId, "web-automation");
    let target: Awaited<ReturnType<typeof locateExactPendingEvidenceGuidedCreation>>;
    try {
      target = await locateExactPendingEvidenceGuidedCreation(control, prepared.projectId);
    } catch (error) {
      if (!(error instanceof RunnerFailure) || error.details?.reasonCode !== "exploration_apply.pending_candidate_count") throw error;
      const applied = await locateLatestAppliedEvidenceGuidedCreation(control, prepared.projectId);
      const topology = await inspectAppliedCreation(control, applied.projectId, applied.flowId, applied.baseExecutionDigest, applied.appliedExecutionDigest);
      const graph = await control.getExactFlow(applied.projectId, topology.graphFlowId);
      const nodes = graph.document.nodes as Array<Record<string, unknown>>;
      return Object.freeze({
        providerCallCount: 0 as const,
        subflowCount: 1 as const,
        routerCount: 1 as const,
        ownedRouteCount: 1 as const,
        nodeCount: topology.nodeCount,
        edgeCount: topology.edgeCount,
        executableNodeCount: topology.executableNodeCount,
        definitionIds: nodes.map(node => String(node.definitionId)),
        parameterKeys: nodes.map(node => node.parameterValues && typeof node.parameterValues === "object" && !Array.isArray(node.parameterValues)
          ? Object.keys(node.parameterValues as Record<string, unknown>).sort()
          : []),
      });
    }
    return withDemoPanelBrowser(config, panelCookie, "demo-llm-exploration-apply", async ({ panelPage, evidence }) => {
      await openProjectInPanel(panelPage, config.origin, project.name, evidence);
      const hierarchy = panelPage.getByRole("complementary", { name: "Project hierarchy" });
      const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
      await evidence.step("panel", "exploration-apply-flow-search", "Locate the exact blank checkpoint Flow", () => search.fill(target.flowName));
      const flows = hierarchy.locator(".automation-tree-item").filter({
        has: panelPage.locator(".tree-row-main.type-flow .tree-row-label > strong").getByText(target.flowName, { exact: true }),
      });
      await flows.first().waitFor({ timeout: 10_000 });
      if (await flows.count() !== 1) throw new RunnerFailure("runtime.behavior", "Checkpoint Flow hierarchy identity is ambiguous");
      const flowItem = flows.first();
      await evidence.step("panel", "exploration-apply-flow-open", "Restore the exact blank checkpoint Flow selection", () => flowItem.locator(".tree-row-main.type-flow").click());
      if (await flowItem.getAttribute("aria-expanded") === "false") {
        await evidence.step("panel", "exploration-apply-flow-expand", "Expand the exact blank checkpoint Flow", () => flowItem.getByRole("button", { name: `Expand ${target.flowName}` }).click());
      }
      const flowTreeItemId = await flowItem.getAttribute("data-tree-item-id");
      if (!flowTreeItemId) throw new RunnerFailure("runtime.behavior", "Checkpoint Flow hierarchy identity is unavailable");
      let providerCallCount = 0;
      const observeRequest = (request: import("@playwright/test").Request) => {
        if (request.method() === "POST" && request.url().includes("/api/programs/automation-studio/generate-flow-bootstrap-adaptation")) providerCallCount += 1;
      };
      panelPage.context().on("request", observeRequest);
      try {
        const topology = await approveApplyExistingEvidenceGuidedCreationViaUi({
          page: panelPage,
          flowTreeItemId,
          projectId: target.projectId,
          flowId: target.flowId,
          adaptationId: target.adaptationId,
          pin: config.pin,
          evidence,
          control,
          blankContentHash: target.blankContentHash,
          baseExecutionDigest: target.baseExecutionDigest,
        });
        if (providerCallCount !== 0) throw new RunnerFailure("runtime.behavior", "Proposal apply unexpectedly requested Flow bootstrap generation");
        const graph = await control.getExactFlow(target.projectId, topology.graphFlowId);
        const nodes = graph.document.nodes as Array<Record<string, unknown>>;
        return Object.freeze({
          providerCallCount: 0 as const,
          subflowCount: 1 as const,
          routerCount: 1 as const,
          ownedRouteCount: 1 as const,
          nodeCount: topology.nodeCount,
          edgeCount: topology.edgeCount,
          executableNodeCount: topology.executableNodeCount,
          definitionIds: nodes.map(node => String(node.definitionId)),
          parameterKeys: nodes.map(node => node.parameterValues && typeof node.parameterValues === "object" && !Array.isArray(node.parameterValues)
            ? Object.keys(node.parameterValues as Record<string, unknown>).sort()
            : []),
        });
      } finally {
        panelPage.context().off("request", observeRequest);
      }
    }, credentialLiterals(config));
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

export async function runDemoLlmAdaptation(config: DemoWorkspaceConfiguration): Promise<DemoLlmAdaptationResult> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control, gatewayUrl, panelCookie } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "Run pnpm demo:llm:create and accept/apply its generated Flow before live adaptation");
    const activeDetails = await Promise.all((await control.listFlowAdaptations(prepared.projectId, prepared.flowId))
      .filter(item => item.status === "proposed" || item.status === "validated" || item.status === "applied")
      .map(item => control.getFlowAdaptation(prepared.projectId, prepared.flowId, item.adaptationId)));
    const resumable = activeDetails.filter(item => item.adaptationKind !== "flow_bootstrap" && item.sourceRunId
      && item.patchKinds?.length === 1 && item.patchKinds[0] === "edit_action_target");
    if (resumable.length > 1 || activeDetails.some(item => item.status === "proposed" && item !== resumable[0])) {
      throw new RunnerFailure("runtime.behavior", "Adaptation continuation requires at most one exact pending target proposal");
    }
    const resumableAdaptation = resumable[0];
    const readiness = await inspectDemoLlmAdaptationReadiness(control, prepared, resumableAdaptation?.status === "proposed" ? { allowPendingAdaptationId: resumableAdaptation.adaptationId } : {});
    const startingExecutionDigest = resumableAdaptation?.status === "applied"
      ? (await control.getFlowAdaptation(prepared.projectId, prepared.flowId, readiness.bootstrapAdaptationId)).bootstrapBinding?.appliedExecutionDigest
      : readiness.currentExecutionDigest;
    if (!startingExecutionDigest) throw new RunnerFailure("runtime.behavior", "Adaptation continuation could not recover the exact pre-apply execution binding");
    const project = await control.requireProject(readiness.projectId, "web-automation");
    const state: DemoWorkspaceState = {
      schemaVersion: SCHEMA_VERSION,
      origin: config.origin,
      username: config.username,
      projectId: readiness.projectId,
      flowId: readiness.flowId,
      subflowId: readiness.subflowId,
      graphFlowId: readiness.graphFlowId,
      routerId: readiness.routerId,
      projectName: project.name,
      flowName: BLANK_LLM_FLOW_NAME,
      updatedAt: new Date().toISOString(),
    };
    const recordingsBeforeResponse = await control.listRecordings(state.projectId);
    const recordingsBefore = recordingIds(recordingsBeforeResponse);
    const adaptationsBefore = new Set((await control.listFlowAdaptations(state.projectId, state.flowId)).map(item => item.adaptationId));

    return withDemoBrowser(config, panelCookie, "demo-llm-adaptation", async ({ extensionPage, panelPage, scenarioPage, scenarioUrl, evidence }) => {
      await openProjectInPanel(panelPage, config.origin, state.projectName, evidence);
      const flowTreeItemId = await openFlowInCurrentProject(panelPage, state.flowName, evidence);
      if (!resumableAdaptation) await configureFirstLiveDiagnosisViaUi(panelPage, flowTreeItemId, config.pin, evidence, "2");
      await connectExtension(extensionPage, panelPage, control, gatewayUrl, config.origin, state.projectId, state.flowId, scenarioUrl, evidence);
      await evidence.step("scenario", "adaptation-introduce-drift", "Introduce semantic target drift", () => scenarioPage.getByTestId("instruction-introduce-target-drift").click());
      await scenarioPage.getByTestId("instruction-target-drift-status").filter({ hasText: "Target mode: drifted" }).waitFor({ timeout: 10_000 });

      const adaptationFlowTreeItemId = await openFlowInCurrentProject(panelPage, state.flowName, evidence);
      const started = resumableAdaptation
        ? { runId: resumableAdaptation.sourceRunId!, status: "failed" }
        : await runAdaptationFromPanel(panelPage, adaptationFlowTreeItemId, evidence);
      const failedRun = resumableAdaptation
        ? await control.getRunDetail(state.projectId, started.runId)
        : await waitForAdaptationRun(control, state.projectId, started.runId);
      const events = await control.listRunEvents(state.projectId, started.runId, { limit: 100 });
      const failedActions = failedRun.actionAttempts.filter(item => item.status === "failed");
      const interventions = failedRun.interventions ?? [];
      const adaptationIds = [...new Set(failedRun.adaptationIds ?? [])];
      const proposalIds = [...new Set(failedRun.changeProposalIds ?? [])];
      if (failedActions.length !== 1) throw new RunnerFailure("runtime.behavior", "Adaptation run did not persist exactly one failed action before intervention");
      if (interventions.length !== 2 || interventions[0]?.kind !== "diagnosis" || interventions[1]?.kind !== "runtime_patch" || (failedRun.providerCallCount ?? 0) !== 2) {
        throw new RunnerFailure("runtime.behavior", "Adaptation run did not persist exactly diagnosis then runtime_patch with two provider calls");
      }
      if (adaptationIds.length !== 1 || proposalIds.length !== 1 || (!resumableAdaptation && adaptationsBefore.has(adaptationIds[0]!))) {
        throw new RunnerFailure("runtime.behavior", "Adaptation run did not create exactly one new manual-review proposal in the exact Flow scope");
      }
      const proposal = await control.getFlowAdaptation(state.projectId, state.flowId, adaptationIds[0]!);
      if (!(["proposed", "validated", "applied"] as string[]).includes(proposal.status) || proposal.sourceRunId !== started.runId || proposal.subflowId !== state.subflowId
        || proposal.patchKinds?.length !== 1 || proposal.patchKinds[0] !== "edit_action_target"
        || proposal.validationSucceededCount !== 1 || proposal.validationFailedCount !== 0) {
        throw new RunnerFailure("runtime.behavior", "The generated manual adaptation was not one validated action-target change scoped to the failed run and owned Subflow");
      }
      if (proposal.status !== "applied" && resumableAdaptation) {
        await openAdaptationFromPanel(panelPage, adaptationFlowTreeItemId, proposal.adaptationId, evidence);
      } else if (proposal.status !== "applied") {
        const reviewAction = panelPage.getByRole("button", { name: `Review ${proposal.adaptationId}`, exact: true });
        await reviewAction.waitFor({ state: "visible", timeout: 30_000 });
        await evidence.diagnostic("panel", "adaptation-review-action-ready", "adaptation.manual-review", { visible: true, exactAdaptation: true });
      }
      const [diagnosis, runtimePatch] = interventions as [ExistingRunIntervention, ExistingRunIntervention];
      for (const item of interventions) requireCompleteAdaptationIntervention(item);
      const failedSequence = requireRunEventSequence(events, "action_attempt", failedActions[0]!.attemptId);
      const diagnosisSequence = requireRunEventSequence(events, "intervention", diagnosis.interventionId);
      const patchSequence = requireRunEventSequence(events, "intervention", runtimePatch.interventionId);
      if (!(failedSequence < diagnosisSequence && diagnosisSequence < patchSequence)) throw new RunnerFailure("runtime.behavior", "Failed action and adaptation intervention ordering was not durable");

      const applied = proposal.status === "applied"
        ? proposal
        : await reviewAndApplyAdaptationViaUi(panelPage, control, state, proposal.adaptationId, config.pin, evidence, Boolean(resumableAdaptation), proposal.status);
      if (applied.appliedMutationCount !== 1) throw new RunnerFailure("runtime.behavior", "Manual adaptation apply did not persist exactly one target mutation");
      const bootstrapAfterApply = await control.getFlowAdaptation(state.projectId, state.flowId, readiness.bootstrapAdaptationId);
      const resultingExecutionDigest = bootstrapAfterApply.bootstrapBinding?.currentExecutionDigest;
      if (!resultingExecutionDigest || resultingExecutionDigest === startingExecutionDigest) throw new RunnerFailure("runtime.behavior", "Applied adaptation did not change the generated Flow execution digest");

      const postApply = await runZeroLlmAdaptationValidation({ control, panelPage, scenarioPage, scenarioUrl, state, evidence, step: "post-apply" });
      const replay = await runZeroLlmAdaptationValidation({ control, panelPage, scenarioPage, scenarioUrl, state, evidence, step: "replay" });
      await evidence.step("scenario", "adaptation-reset-drift", "Reset semantic target drift after validation", () => scenarioPage.getByTestId("instruction-reset-target-drift").click());
      await scenarioPage.getByTestId("instruction-target-drift-status").filter({ hasText: "Target mode: baseline" }).waitFor({ timeout: 10_000 });

      const recordingsAfterResponse = await control.listRecordings(state.projectId);
      assertRecordingSetUnchanged(recordingsBefore, recordingsAfterResponse);
      await assertAdaptationFlowsRemainRecordingFree(control, state);
      const applySequence = patchSequence + 1;
      const evaluated = evaluateDemoLlmAdaptation({
        schemaVersion: "0.1",
        operationId: `adaptation.${randomBytes(12).toString("hex")}`,
        startingGraph: { creationCertified: true, projectId: state.projectId, flowId: state.flowId, startingExecutionDigest, ownedSubflowCount: 1, routerSubflowRouteCount: 1, nodeCount: readiness.nodeCount, executableNodeCount: readiness.nodeCount, recordingCount: recordingsBefore.size, recordingProvenanceAbsent: true },
        drift: { kind: "semantic-target", scenarioId: "instruction-only-form", beforeTargetFingerprint: "instruction-target-set.baseline.v1", afterTargetFingerprint: "instruction-target-set.drifted.v1", introducedBeforeRun: true, observed: true },
        failedAction: { runId: started.runId, attemptId: failedActions[0]!.attemptId, sequence: failedSequence, status: "failed", providerCallCountBeforeFailure: 0 },
        invocations: [adaptationInvocation(diagnosis, "runtime_diagnosis", diagnosisSequence), adaptationInvocation(runtimePatch, "runtime_patch", patchSequence)],
        adaptation: { adaptationId: applied.adaptationId, requestId: runtimePatch.requestId!, baseExecutionDigest: startingExecutionDigest, resultingExecutionDigest, validationOk: true, stale: false, concurrentMutationDetected: false, reviewOutcome: "approved", approvalChannel: "human-ui", mutationObservedBeforeApproval: false, outcome: "applied", applySequence, structuralChange: false, externalSideEffectEscalation: false, authorizationExpansion: false, unsupportedOutputCount: 0, recordingCount: recordingIds(recordingsAfterResponse).size, recordingProvenanceAbsent: true },
        postApplyValidation: { runId: postApply.summary.runId, status: "succeeded", completionSequence: applySequence + 1, executionDigest: resultingExecutionDigest, providerCallCount: 0, interventionCount: 0, diagnosisCount: 0, adaptationCount: 0, actionAttemptCount: postApply.actionAttempts.length, succeededActionCount: postApply.actionAttempts.filter(item => item.status === "succeeded").length },
        finalReplay: { runId: replay.summary.runId, status: "succeeded", executionDigest: resultingExecutionDigest, providerCallCount: 0, interventionCount: 0, adaptationCount: 0, actionAttemptCount: replay.actionAttempts.length, succeededActionCount: replay.actionAttempts.filter(item => item.status === "succeeded").length },
      });
      return persistDemoLlmAdaptationResult(config.workspaceDirectory, evaluated, credentialLiterals(config));
    }, credentialLiterals(config), BLANK_LLM_SCENARIO_PATH);
  }));
}

export async function inspectLatestDemoLlmAdaptationRun(config: DemoWorkspaceConfiguration): Promise<Readonly<Record<string, unknown>>> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "The prepared instruction-only Flow is unavailable");
    const latest = (await control.listFlowRuns(prepared.projectId, prepared.flowId)).sort((left, right) => right.updatedAt - left.updatedAt)[0];
    if (!latest) throw new RunnerFailure("runtime.behavior", "No runtime adaptation attempt is available");
    const detail = await control.getRunDetail(prepared.projectId, latest.runId);
    const adaptationStates = await Promise.all((detail.adaptationIds ?? []).map(async adaptationId => {
      const adaptation = await control.getFlowAdaptation(prepared.projectId, prepared.flowId, adaptationId);
      return Object.freeze({ status: adaptation.status, patchKinds: Object.freeze(adaptation.patchKinds ?? []), appliedMutationCount: adaptation.appliedMutationCount ?? null });
    }));
    return Object.freeze({
      status: detail.summary.status,
      runId: detail.summary.runId,
      actionStatuses: Object.freeze(detail.actionAttempts.map(item => item.status)),
      interventionKinds: Object.freeze((detail.interventions ?? []).map(item => item.kind)),
      interventionValidation: Object.freeze((detail.interventions ?? []).map(item => item.validationOk ?? null)),
      interventionCodes: Object.freeze((detail.interventions ?? []).map(item => Object.freeze(item.validationCodes ?? []))),
      runtimePatchAttempts: Object.freeze((detail.runtimePatchAttempts ?? []).map(item => Object.freeze(item))),
      adaptationStates: Object.freeze(adaptationStates),
      providerCallCount: detail.providerCallCount ?? 0,
      adaptationCount: detail.adaptationIds?.length ?? 0,
      changeProposalCount: detail.changeProposalIds?.length ?? 0,
    });
  }));
}

export async function controlPreparedDemoLlmTargetAdaptation(
  config: DemoWorkspaceConfiguration,
  action: ExistingTargetAdaptationAction,
  selector: ExistingTargetAdaptationSelector = {},
): Promise<ExistingTargetAdaptationControlResult> {
  return withWorkspaceLock(config, async () => withPersistentDemoCore(config, async () => {
    const { control } = await authenticatedControl(config);
    const prepared = await loadBlankLlmPreparationState(config.workspaceDirectory);
    if (!prepared) throw new RunnerFailure("environment.missing", "The prepared instruction-only Flow is unavailable");
    const subflows = await control.listFlowSubflows(prepared.projectId, prepared.flowId);
    if (subflows.length !== 1 || !subflows[0]?.graphFlowId) {
      throw new RunnerFailure("runtime.behavior", "Target adaptation control requires exactly one graph-backed owned Subflow");
    }
    return controlExistingLlmTargetAdaptation(control, {
      projectId: prepared.projectId,
      flowId: prepared.flowId,
      subflowId: subflows[0].subflowId,
    }, config.pin, action, selector);
  }));
}

async function reviewAndApplyAdaptationViaUi(
  page: Page,
  control: ExistingFluxIQControlClient,
  state: DemoWorkspaceState,
  adaptationId: string,
  pin: string,
  evidence: BrowserEvidenceRecorder,
  alreadyOpen = false,
  initialStatus = "proposed",
): Promise<ExistingFlowAdaptation> {
  if (!alreadyOpen) {
    await evidence.step("panel", "adaptation-review-open", "Open the exact generated adaptation for manual review", () => (
      page.getByRole("button", { name: `Review ${adaptationId}`, exact: true }).click()
    ));
  }
  const detailViews = page.getByRole("navigation", { name: "Adaptation detail views", exact: true });
  await detailViews.waitFor({ state: "visible", timeout: 30_000 });
  await evidence.step("panel", "adaptation-review-audit", "Open the adaptation audit and review actions", () => (
    detailViews.getByRole("button", { name: "Audit", exact: true }).click()
  ));

  if (initialStatus === "proposed") {
    await evidence.step("panel", "adaptation-review-approve", "Approve the generated adaptation for application", () => (
      page.getByRole("button", { name: "Approve", exact: true }).click()
    ));
    const approveDialog = page.getByRole("dialog", { name: "Approve Adaptation", exact: true });
    await evidence.step("panel", "adaptation-review-approve-pin", "Authorize adaptation approval with the current PIN", () => (
      approveDialog.getByLabel(/^PIN/u).fill(pin)
    ), { sensitive: true });
    const approveResponse = await evidence.step("panel", "adaptation-review-approve-submit", "Confirm manual adaptation approval", () => (
      waitForPanelMutationResponse(page, "/api/programs/automation-studio/review-flow-adaptation", () => approveDialog.getByRole("button", { name: "Approve", exact: true }).click())
    ), { sensitive: true });
    if (!approveResponse.ok()) throw new RunnerFailure("runtime.behavior", "The manual UI adaptation approval was rejected");
    await approveDialog.waitFor({ state: "hidden", timeout: 30_000 });
    const approved = await control.getFlowAdaptation(state.projectId, state.flowId, adaptationId);
    if (approved.status !== "validated") throw new RunnerFailure("runtime.behavior", "The manual UI approval did not validate the exact adaptation");
  }

  await evidence.step("panel", "adaptation-review-apply", "Request durable application of the approved adaptation", () => (
    page.getByRole("button", { name: "Apply Changes", exact: true }).click()
  ));
  const applyDialog = page.getByRole("dialog", { name: "Apply Adaptation", exact: true });
  await evidence.step("panel", "adaptation-review-apply-pin", "Authorize adaptation application with the current PIN", () => (
    applyDialog.getByLabel(/^PIN/u).fill(pin)
  ), { sensitive: true });
  const applyResponse = await evidence.step("panel", "adaptation-review-apply-submit", "Apply the reviewed adaptation", () => (
    waitForPanelMutationResponse(page, "/api/programs/automation-studio/review-flow-adaptation", () => applyDialog.getByRole("button", { name: "Apply Changes", exact: true }).click())
  ), { sensitive: true });
  if (!applyResponse.ok()) throw new RunnerFailure("runtime.behavior", "The manual UI adaptation apply was rejected");
  await applyDialog.waitFor({ state: "hidden", timeout: 30_000 });
  const applied = await control.getFlowAdaptation(state.projectId, state.flowId, adaptationId);
  if (applied.status !== "applied") throw new RunnerFailure("runtime.behavior", "The manual UI apply did not persist the exact adaptation");
  return applied;
}

async function openAdaptationFromPanel(page: Page, flowTreeItemId: string, adaptationId: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "adaptation-resume-search", "Search the exact Flow hierarchy for Adaptations", () => search.fill("Adaptations"));
  const rows = await exactVirtualizedHierarchyObject(
    page,
    hierarchy,
    `${flowTreeItemId}-adaptations`,
    "the exact Flow Adaptations row",
    ".tree-row-main.type-folder",
  );
  await evidence.step("panel", "adaptation-resume-open", "Open the exact Flow Adaptations workspace", () => rows.click());
  await evidence.step("panel", "adaptation-resume-search-clear", "Clear hierarchy search after Adaptations opens", () => search.fill(""));
  const table = page.getByRole("table", { name: "Adaptations", exact: true });
  await table.waitFor({ state: "visible", timeout: 30_000 });
  await page.getByText("Loading adaptations...", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
  const row = table.getByRole("row").filter({ hasText: adaptationId });
  if (await row.count() !== 1) throw new RunnerFailure("runtime.behavior", "The exact pending adaptation is unavailable in the UI inbox");
  await evidence.step("panel", "adaptation-resume-select", "Select the exact pending target proposal", () => row.click());
  await page.getByRole("navigation", { name: "Adaptation detail views", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
}

async function runAdaptationFromPanel(page: Page, flowTreeItemId: string, evidence: BrowserEvidenceRecorder): Promise<{ runId: string; status: string }> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "adaptation-runtime-search", "Search the exact Flow hierarchy for Runtime Debug", () => search.fill("Runtime Debug"));
  const runtimeRows = await exactVirtualizedHierarchyObject(page, hierarchy, `${flowTreeItemId}-runtime-debug`, "the exact Flow Runtime Debug row for adaptation");
  await evidence.step("panel", "adaptation-runtime-open", "Open Runtime Debug for the generated Flow", () => runtimeRows.click());
  const runCommand = page.locator(".automation-runtime-run-command");
  await runCommand.waitFor({ timeout: 30_000 });
  await evidence.step("panel", "adaptation-runtime-search-clear", "Clear hierarchy search after Runtime Debug opens", () => search.fill(""));
  await page.getByText("Checking Flow readiness...", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
  await evidence.step("panel", "adaptation-runtime-mode", "Select Diagnose and propose adaptation", () => runCommand.getByRole("button", { name: "Diagnose and propose adaptation", exact: true }).click());
  const runButton = runCommand.getByRole("button", { name: "Run", exact: true });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && await runButton.isDisabled()) await page.waitForTimeout(100);
  if (await runButton.isDisabled()) throw new RunnerFailure("runtime.behavior", "Diagnose and propose adaptation mode was not ready to run");
  const response = await evidence.step("panel", "adaptation-runtime-run", "Run one bounded diagnosis and adaptation proposal", () => waitForPanelRunResponse(page, () => runButton.click()));
  const body = await response.json() as any;
  if (!response.ok()) throw new RunnerFailure("runtime.behavior", "The authenticated adaptation run request was rejected", { details: { reasonCode: adaptationRunRejectionCode(body?.error) } });
  const runId = body?.payload?.runtimeSession?.runId;
  if (typeof runId !== "string") throw new RunnerFailure("runtime.behavior", "The authenticated adaptation run failed to return a bounded run identity");
  return { runId, status: String(body?.payload?.runtimeSession?.status ?? "unknown") };
}

function adaptationRunRejectionCode(value: unknown): string {
  const message = typeof value === "string" ? value.toLowerCase() : "";
  if (/settings revision/u.test(message)) return "adaptation_run.settings_revision_mismatch";
  if (/execution digest/u.test(message)) return "adaptation_run.execution_digest_mismatch";
  if (/execution grant|grant/u.test(message)) return "adaptation_run.grant_invalid";
  if (/provider resolution/u.test(message)) return "adaptation_run.provider_resolution_failed";
  if (/secret|api key|key unavailable/u.test(message)) return "adaptation_run.secret_unavailable";
  if (/budget|token|cost|call limit/u.test(message)) return "adaptation_run.budget_rejected";
  return "adaptation_run.request_rejected";
}

async function waitForAdaptationRun(control: ExistingFluxIQControlClient, projectId: string, runId: string): Promise<ExistingRunDetail> {
  const deadline = Date.now() + 60_000;
  let detail = await control.getRunDetail(projectId, runId);
  // A terminal diagnosis+patch run may intentionally create no adaptation
  // when deterministic evidence validation rejects the model's target. Do not
  // spend the remainder of the timeout waiting for an ID that cannot appear.
  while (Date.now() < deadline && !explorationAdaptationRunIsComplete(detail)) {
    await new Promise(resolve => setTimeout(resolve, 100));
    detail = await control.getRunDetail(projectId, runId);
  }
  if (!isTerminalRuntimeStatus(detail.summary.status)) throw new RunnerFailure("runtime.behavior", "Adaptation run did not reach a terminal state");
  return detail;
}

function requireCompleteAdaptationIntervention(item: ExistingRunIntervention): void {
  const expectedPromptVersion = item.kind === "diagnosis"
    ? "automation-studio.runtime-diagnosis.v1"
    : item.kind === "runtime_patch"
      ? "automation-studio.runtime-patch.v1"
      : undefined;
  if (!item.requestId || !item.promptVersion || item.provider !== "deepseek" || item.model !== "deepseek-chat" || item.validationOk !== true
    || item.promptVersion !== expectedPromptVersion
    || !Number.isSafeInteger(item.inputTokens) || !Number.isSafeInteger(item.outputTokens) || !Number.isSafeInteger(item.totalTokens)
    || typeof item.estimatedCostUsd !== "number" || !Number.isFinite(item.estimatedCostUsd)) {
    throw new RunnerFailure("runtime.behavior", "Adaptation intervention omitted sanitized provider provenance or accounting");
  }
}

function requireRunEventSequence(events: ExistingRunEvent[], kind: ExistingRunEvent["eventKind"], entityId: string): number {
  const matching = events.filter(item => item.eventKind === kind && item.entityId === entityId);
  if (matching.length !== 1) throw new RunnerFailure("runtime.behavior", "Adaptation run did not expose one exact durable event for a required phase");
  return matching[0]!.sequence;
}

function adaptationInvocation(item: ExistingRunIntervention, purpose: "runtime_diagnosis" | "runtime_patch", sequence: number) {
  return {
    requestId: item.requestId!, purpose, provider: "deepseek" as const, model: "deepseek-chat" as const,
    promptSchemaVersion: item.promptVersion!, sequence, attempt: 1 as const, retryCount: 0 as const, providerCallCount: 1 as const,
    inputTokens: item.inputTokens!, outputTokens: item.outputTokens!, totalTokens: item.totalTokens!, estimatedCostUsd: item.estimatedCostUsd!, latencyMs: 0,
  };
}

async function runZeroLlmAdaptationValidation(input: { control: ExistingFluxIQControlClient; panelPage: Page; scenarioPage: Page; scenarioUrl: string; state: DemoWorkspaceState; evidence: BrowserEvidenceRecorder; step: string }): Promise<ExistingRunDetail> {
  await input.evidence.step("scenario", `adaptation-${input.step}-reload`, "Reload the drifted semantic target fixture", () => input.scenarioPage.goto(input.scenarioUrl).then(() => undefined));
  await input.scenarioPage.getByTestId("instruction-target-drift-status").filter({ hasText: "Target mode: drifted" }).waitFor({ timeout: 10_000 });
  await selectFlowInCurrentProject(input.panelPage, input.state.flowName, input.evidence);
  const started = await runDemoFlowFromPanel(input.panelPage, input.state, input.evidence);
  const detail = await waitForRoutedRunDetail(input.control, input.state, started.runId, input.state.flowId ? 1 : 1);
  if (detail.summary.status !== "succeeded" || detail.actionAttempts.length < 1 || detail.actionAttempts.some(item => item.status !== "succeeded")
    || (detail.providerCallCount ?? 0) !== 0 || (detail.interventions?.length ?? 0) !== 0 || (detail.adaptationIds?.length ?? 0) !== 0
    || (detail.changeProposalIds?.length ?? 0) !== 0 || (detail.summary.adaptationCount ?? 0) !== 0) {
    throw new RunnerFailure("runtime.behavior", "Post-apply deterministic validation used LLM assistance, created adaptations, or failed actions");
  }
  await input.scenarioPage.getByTestId("result").filter({ hasText: "Submitted: Ada / team" }).waitFor({ timeout: 30_000 });
  return detail;
}

async function assertAdaptationFlowsRemainRecordingFree(control: ExistingFluxIQControlClient, state: DemoWorkspaceState): Promise<void> {
  for (const flowId of [state.flowId, state.graphFlowId]) {
    const flow = await control.getExactFlow(state.projectId, flowId);
    const serialized = JSON.stringify(flow.document.metadata ?? {});
    if (/"(?:lastRecordingId|recordingId|recordingProvenance)"\s*:/u.test(serialized)) throw new RunnerFailure("recording.persistence", "Runtime adaptation introduced recording provenance into a generated Flow");
  }
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

async function configureFirstLiveDiagnosisViaUi(page: Page, flowTreeItemId: string, pin: string, evidence: BrowserEvidenceRecorder, maxCalls = "1"): Promise<void> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "llm-settings-search", "Search the exact Flow hierarchy for Settings", () => search.fill("Settings"));
  const settingsRows = await exactVirtualizedHierarchyObject(page, hierarchy, `${flowTreeItemId}-settings`, "the exact Flow Settings row");
  await evidence.step("panel", "llm-settings-open", "Open Settings for the exact prepared Flow", () => settingsRows.click());
  const workspace = page.locator(".automation-flow-settings-workspace");
  await workspace.waitFor({ timeout: 30_000 });
  await evidence.step("panel", "llm-settings-search-clear", "Clear the hierarchy search after Settings opens", () => search.fill(""));
  await workspace.getByText("Loading saved Flow settings...", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
  const settingsNavigation = workspace.getByRole("navigation", { name: "Flow settings sections", exact: true });
  const runtimeSectionButton = settingsNavigation.locator('button[aria-controls="flow-settings-runtime"]');
  await runtimeSectionButton.waitFor({ state: "visible", timeout: 10_000 });
  await evidence.step("panel", "adaptation-settings-section", "Open the Runtime Mode settings section", () => runtimeSectionButton.click());
  const manualApproval = workspace.locator("#flow-settings-runtime").getByRole("button", { name: /Manual approval/u });
  await manualApproval.waitFor({ state: "visible", timeout: 10_000 });
  if (await manualApproval.getAttribute("aria-pressed") !== "true") {
    await evidence.step("panel", "adaptation-settings-manual", "Enable manual-review adaptation proposals", () => manualApproval.click());
  }
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
  const tokenValues = maxCalls === "2"
    ? [String(FIRST_LIVE_ADAPTATION_PROFILE.budget.maxInputTokens), String(FIRST_LIVE_ADAPTATION_PROFILE.budget.maxOutputTokens), String(FIRST_LIVE_ADAPTATION_PROFILE.budget.maxTotalTokensPerRequest)] as const
    : ["2000", "512", "3000"] as const;
  for (const [label, value] of [["Input tokens", tokenValues[0]], ["Output tokens", tokenValues[1]], ["Total tokens", tokenValues[2]], ["Max calls", maxCalls], ["Timeout (seconds)", "20"], ["Max cost (USD)", "0.25"], ["Provider retries", "0"]] as const) {
    const input = llmSection.getByLabel(label, { exact: true });
    if (await input.count() !== 1) throw new RunnerFailure("runtime.behavior", "An exact bounded LLM setting field is unavailable");
    await evidence.step("panel", "llm-settings-" + label.toLowerCase().replace(/[^a-z]+/gu, "-"), `Set ${label} to its first-live bound`, () => input.fill(value));
  }
  const save = workspace.getByRole("button", { name: "Save Settings", exact: true });
  if (await save.isEnabled()) {
    await evidence.step("panel", "llm-settings-save", "Request the bounded Flow Settings save", () => save.click());
    const dialog = page.getByRole("dialog", { name: "Authorize Flow Settings Save" });
    await evidence.step("panel", "llm-settings-pin", "Authorize the bounded Flow Settings save", () => dialog.getByLabel("Security PIN", { exact: true }).fill(pin), { sensitive: true });
    const response = await evidence.step("panel", "llm-settings-authorize", "Save the bounded Flow Settings", () => (
      waitForPanelMutationResponse(page, "/api/programs/automation-studio/update-flow-settings", () => dialog.getByRole("button", { name: "Authorize and Save" }).click())
    ), { sensitive: true });
    if (!response.ok()) throw new RunnerFailure("runtime.behavior", "The bounded Flow Settings save was rejected");
    await dialog.waitFor({ state: "hidden", timeout: 30_000 });
  }
  await workspace.getByText("All Flow settings saved", { exact: true }).waitFor({ timeout: 30_000 });
}

async function runDiagnosisFromPanel(page: Page, flowTreeItemId: string, evidence: BrowserEvidenceRecorder): Promise<{ runId: string; status: string }> {
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
  const response = await evidence.step("panel", "llm-runtime-run-request", "Start exactly one diagnosis-only run with the authenticated session", () => waitForPanelRunResponse(page, () => runButton.click()));
  const body = await response.json() as any;
  const runId = body?.payload?.runtimeSession?.runId;
  if (!response.ok() || typeof runId !== "string") throw new RunnerFailure("runtime.behavior", "The authenticated diagnosis-only run failed to return a bounded run identity");
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
    // Each managed demo Core process has a fresh in-memory secret-key unlock.
    // A durable cookie can outlive that process, so establish one fresh login
    // after startup before any LLM grant is requested.
    { sessionCache, freshLogin: true },
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
    // Persistent profiles may restore tabs from an earlier run. Remove only
    // disposable Scenario Lab tabs so the extension cannot target stale state.
    for (const restoredPage of context.pages()) {
      let restoredOrigin = "";
      try { restoredOrigin = new URL(restoredPage.url()).origin; } catch { /* non-URL startup page */ }
      if (restoredOrigin === scenarioOrigin) await restoredPage.close();
    }
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

async function withDemoPanelBrowser<T>(
  config: DemoWorkspaceConfiguration,
  panelCookie: string,
  evidenceScenarioId: string,
  operation: (input: { panelPage: Page; evidence: BrowserEvidenceRecorder }) => Promise<T>,
  redactionSecrets: readonly string[] = [],
): Promise<T> {
  let context: BrowserContext | undefined;
  let evidence: BrowserEvidenceRecorder | undefined;
  try {
    context = await chromium.launchPersistentContext(path.join(config.workspaceDirectory, "panel-browser-profile-isolated-v2"), {
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
    await context.addCookies([{ name: cookieName, value: cookieValue, url: config.origin }]);
    const panelPage = await context.newPage();
    evidence = new BrowserEvidenceRecorder({
      workspaceDirectory: config.workspaceDirectory,
      scenarioId: evidenceScenarioId,
      pages: { panel: panelPage, extension: panelPage, scenario: panelPage },
      sampleFps: 0,
      redactionSecrets,
    });
    await evidence.start();
    await evidence.step("panel", "open-panel", "Open the FluxIQ web panel", () => panelPage.goto(config.origin, { waitUntil: "domcontentloaded" }).then(() => undefined));
    await panelPage.getByRole("heading", { name: "Programs", exact: true }).waitFor();
    try {
      const result = await operation({ panelPage, evidence });
      const evidencePath = await evidence.finalize("passed");
      await writeFile(path.join(config.workspaceDirectory, "latest-evidence.json"), JSON.stringify({ runId: evidence.runId, path: evidencePath }, null, 2) + "\n", "utf8");
      return result;
    } catch (error) {
      const evidencePath = await evidence.finalize("failed").catch(() => undefined);
      if (evidencePath) await writeFile(path.join(config.workspaceDirectory, "latest-evidence.json"), JSON.stringify({ runId: evidence!.runId, path: evidencePath }, null, 2) + "\n", "utf8").catch(() => undefined);
      throw error;
    }
  } finally {
    await context?.close().catch(() => undefined);
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
      const candidates = tabs.filter((candidate: any) => typeof candidate.id === "number");
      if (candidates.length !== 1) throw new Error("Demo scenario tab selection is ambiguous");
      const tab = candidates[0];
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
  await page.getByText("Loading projects...", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
  const search = page.getByLabel("Search projects");
  await evidence.step("panel", "project-search", "Search for the demo project", () => search.fill(projectName));
  const row = page.locator(".automation-project-row").filter({ hasText: projectName }).first();
  if (!await row.waitFor({ state: "visible", timeout: 5_000 }).then(() => true).catch(() => false)) {
    const retry = page.getByRole("button", { name: /^(?:Retry|Refresh)$/u });
    if (!await retry.isVisible().catch(() => false)) throw new RunnerFailure("runtime.behavior", "The demo project is unavailable in the project list");
    await evidence.step("panel", "project-list-retry", "Retry loading the project list", () => retry.click());
    await page.getByText("Loading projects...", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
    await evidence.step("panel", "project-search-retry", "Search the reloaded project list", () => search.fill(projectName));
    await row.waitFor({ state: "visible", timeout: 10_000 });
  }
  await evidence.step("panel", "project-open", "Open the demo project", () => row.locator(".automation-project-row-main").click());
  await page.locator(".automation-studio-sidebar-heading").getByText(projectName, { exact: true }).waitFor();
}

function hierarchyRow(page: Page, label: string): Locator {
  return page.locator(".tree-row-main").filter({ hasText: new RegExp("^" + escapeRegExp(label)) }).first();
}

async function selectFlowInCurrentProject(page: Page, flowName: string, evidence: BrowserEvidenceRecorder): Promise<string> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  const typeFilter = hierarchy.getByRole("combobox", { name: "Filter project object type" });
  if (await typeFilter.inputValue({ timeout: 2_000 }) !== "all") {
    await evidence.step("panel", "flow-select-type-reset", "Show all hierarchy object types", () => typeFilter.selectOption("all"));
  }
  await evidence.step("panel", "flow-select-search", "Locate the exact Flow", () => search.fill(flowName));
  const items = hierarchy.getByRole("treeitem", { name: flowName, exact: true });
  await items.first().waitFor({ timeout: 10_000 });
  if (await items.count() !== 1) throw new RunnerFailure("runtime.behavior", "The exact Flow hierarchy identity is ambiguous");
  const item = items.first();
  await evidence.step("panel", "flow-select", "Select the exact Flow", () => item.locator(".tree-row-main.type-flow").click());
  if (await item.getAttribute("aria-expanded") === "false") {
    await evidence.step("panel", "flow-select-expand", "Expand the exact Flow", () => item.getByRole("button", { name: `Expand ${flowName}` }).click());
  }
  const itemId = await item.getAttribute("data-tree-item-id");
  if (!itemId) throw new RunnerFailure("runtime.behavior", "The exact Flow hierarchy identity is unavailable");
  return itemId;
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

    stage = "router-child";
    const routerTreeItems = page.locator(`.automation-tree-item[data-tree-item-id="${escapeCssAttribute(`${flowTreeItemId}-router`)}"]`);
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
      await evidence.step("panel", "flow-open-pane", "Open the exact Flow-owned Router in a dedicated workspace pane", () => routerTreeItem.locator(".tree-row-main.type-flow-object").dblclick());
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
  const flowTreeItemId = `flow-${stableHierarchyNodeId(state.flowId)}`;
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "runtime-search", "Search the selected Flow hierarchy for Runtime Debug", () => search.fill("Runtime Debug"));
  const runtimeRow = await exactVirtualizedHierarchyObject(page, hierarchy, `${flowTreeItemId}-runtime-debug`, "the exact Flow Runtime Debug row");
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
  let rejectResponse!: (error: Error) => void;
  const rejectedResponsePromise = new Promise<never>((_resolve, reject) => { rejectResponse = reject; });
  const handler = (response: import("@playwright/test").Response) => {
    if (response.request().method() !== "POST") return;
    if (response.url().includes("/api/programs/automation-studio/run-runtime-session")) {
      resolveResponse(response);
      return;
    }
    const isLlmPreparation = response.url().includes("/api/programs/automation-studio/preflight-llm-execution")
      || response.url().includes("/api/programs/automation-studio/issue-llm-execution-grant");
    if (isLlmPreparation && !response.ok()) rejectResponse(new Error("The panel rejected LLM run preparation before runtime dispatch"));
  };
  page.on("response", handler);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await dispatch();
    return await Promise.race([
      responsePromise,
      rejectedResponsePromise,
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

function stableHierarchyNodeId(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash.toString(36);
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
