// The evidence-free creation lanes: the settings, readiness, pending, applied,
// revert and replay probes, and the full first-live creation run.
import { randomBytes } from "node:crypto";
import type { RuntimeStatus } from "../existing-fluxiq-control.js";
import { RunnerFailure } from "../failure.js";
import { assertGenuinelyBlankFlow, assertRecordingSetUnchanged, BLANK_LLM_FLOW_NAME, BLANK_LLM_SCENARIO_PATH, loadBlankLlmPreparationState } from "../demo-llm-blank-workspace.js";
import { assertProviderFreeGenerationReadiness, buildApproveApplyCreationViaUi, configureFirstLiveCreationViaUi, type ProviderFreeGenerationReadiness, rejectStalePendingCreationAdaptation } from "../demo-llm-create-ui.js";
import { type DemoLlmCreationResult, evaluateDemoLlmCreation, persistDemoLlmCreationResult } from "../demo-llm-creation.js";
import { assertDemoBlankStateSecrets } from "./blank-preparation.js";
import { connectExtension, extensionStatus, withDemoBrowser } from "./browser-session.js";
import { type DemoWorkspaceConfiguration, credentialLiterals } from "./configuration.js";
import { recordingIds, waitForRoutedRunDetail } from "./control-waits.js";
import { authenticatedControl, withPersistentDemoCore } from "./core-process.js";
import { openFlowInCurrentProject, openProjectInPanel } from "./panel-navigation.js";
import { runDemoFlowFromPanel } from "./panel-run.js";
import { type DemoWorkspaceState, SCHEMA_VERSION, withWorkspaceLock } from "./workspace-state.js";

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

export function categorizeActionFailure(message: string | undefined): "target" | "parameters" | "gateway" | "timeout" | "action" {
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
