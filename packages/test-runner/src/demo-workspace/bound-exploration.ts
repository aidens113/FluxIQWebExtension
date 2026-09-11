// The bound exploration run: a single flow that carries one saved request
// binding through every stage, and the stage-tagged failures it reports.
import { RunnerFailure } from "../failure.js";
import { loadScenarioManifest } from "../scenarios.js";
import { assertExpectedFacts, playwrightScenarioFactProbe } from "../scenario-assertions.js";
import { assertRecordingSetUnchanged } from "../demo-llm-blank-workspace.js";
import { approveApplyExistingEvidenceGuidedCreationViaUi, inspectAppliedCreation } from "../demo-llm-create-ui.js";
import { locateBoundAppliedEvidenceGuidedCreation, locateBoundPendingEvidenceGuidedCreation } from "../demo-llm-exploration-apply.js";
import { assertDemoLlmExplorationBindingScenario, loadDemoLlmExplorationRequestBinding, validateBoundExplorationRun } from "../demo-llm-exploration-request.js";
import { connectExtension, extensionStatus, withDemoBrowser, withDemoPanelBrowser } from "./browser-session.js";
import { type DemoWorkspaceConfiguration, credentialLiterals } from "./configuration.js";
import { recordingIds, waitForRoutedRunDetail } from "./control-waits.js";
import { authenticatedControl, withPersistentDemoCore } from "./core-process.js";
import { openFlowInCurrentProject, openProjectInPanel } from "./panel-navigation.js";
import { runDemoFlowFromPanel } from "./panel-run.js";
import { type DemoWorkspaceState, SCHEMA_VERSION, withWorkspaceLock } from "./workspace-state.js";

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

export function boundExplorationRunFailure(stage: BoundExplorationRunStage, reasonCode: string, cause: unknown): RunnerFailure {
  return new RunnerFailure("runtime.behavior", `Bound exploration run failed during ${stage.replaceAll("_", " ")}`, {
    cause,
    details: { stage, reasonCode },
  });
}

export function isBoundExplorationRunFailure(error: unknown): error is RunnerFailure {
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
