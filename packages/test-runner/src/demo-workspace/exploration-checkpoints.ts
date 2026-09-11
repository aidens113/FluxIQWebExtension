// The evidence-guided exploration checkpoints: the provider-free baseline
// probe, the proposal checkpoint, the apply checkpoint, and the Flow name each
// exploration request resolves to.
import { createHash, randomBytes } from "node:crypto";
import { type ExistingFlowSummary, ExistingFluxIQControlClient } from "../existing-fluxiq-control.js";
import { RunnerFailure } from "../failure.js";
import { loadScenarioManifest } from "../scenarios.js";
import { assertGenuinelyBlankFlow, assertRecordingSetUnchanged, BLANK_LLM_SCENARIO_PATH, isGenuinelyBlankFlowMismatch, loadBlankLlmPreparationState, prepareBlankLlmFlowViaUi } from "../demo-llm-blank-workspace.js";
import { approveApplyExistingEvidenceGuidedCreationViaUi, configureEvidenceGuidedCreationViaUi, type EvidenceGuidedCreationCheckpoint, inspectAppliedCreation, proposeEvidenceGuidedCreationViaUi } from "../demo-llm-create-ui.js";
import { findPendingEvidenceGuidedCreationForFlow, locateExactPendingEvidenceGuidedCreation, locateLatestAppliedEvidenceGuidedCreation } from "../demo-llm-exploration-apply.js";
import { locateExactAppliedEvidenceGuidedCreation, requireExplorationBaselineDriftExplanation } from "../demo-llm-exploration-adaptation-readiness.js";
import { createDemoLlmExplorationRequestBinding, DEFAULT_DEMO_LLM_EXPLORATION_SCENARIO_ID, type DemoLlmExplorationRequest, resolveDemoLlmExplorationRequest, saveDemoLlmExplorationRequestBinding } from "../demo-llm-exploration-request.js";
import { assertDemoBlankStateSecrets } from "./blank-preparation.js";
import { connectExtension, extensionStatus, withDemoBrowser, withDemoPanelBrowser } from "./browser-session.js";
import { type DemoWorkspaceConfiguration, credentialLiterals } from "./configuration.js";
import { recordingIds, waitForRoutedRunDetail } from "./control-waits.js";
import { authenticatedControl, withPersistentDemoCore } from "./core-process.js";
import { openProjectInPanel, selectFlowInCurrentProject } from "./panel-navigation.js";
import { runDemoFlowFromPanel } from "./panel-run.js";
import { type DemoWorkspaceState, SCHEMA_VERSION, withWorkspaceLock } from "./workspace-state.js";

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
