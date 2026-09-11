// The exploration adaptation lanes: readiness, proposal, apply, validation,
// and the revert and reject paths for an exact proposal.
import type { ExistingFlowAdaptation } from "../existing-fluxiq-control.js";
import { RunnerFailure } from "../failure.js";
import { assertRecordingSetUnchanged, BLANK_LLM_SCENARIO_PATH, loadBlankLlmPreparationState } from "../demo-llm-blank-workspace.js";
import { type DemoLlmAdaptationReadiness, inspectDemoLlmAdaptationReadiness } from "../demo-llm-adaptation-readiness.js";
import { inspectExactExplorationAdaptationReadiness, locateExactAppliedEvidenceGuidedCreation } from "../demo-llm-exploration-adaptation-readiness.js";
import { evaluateExplorationAdaptationApply, evaluateExplorationAdaptationProposal, evaluateExplorationAdaptationValidation, type ExplorationAdaptationApplyCheckpoint, type ExplorationAdaptationProposalCheckpoint, type ExplorationAdaptationValidationCheckpoint } from "../demo-llm-exploration-adaptation.js";
import { requireExactExplorationProposalIdentity } from "../demo-llm-exploration-adaptation-wait.js";
import { type ExplorationAdaptationRejectResult, type ExplorationAdaptationRevertResult, rejectExactPendingExplorationTargetAdaptation, revertExactAppliedExplorationTargetAdaptation } from "../demo-llm-exploration-adaptation-revert.js";
import { isActiveRuntimeAdaptationStatus, resolveAuthoritativeAdaptationStatus } from "../authoritative-adaptation-status.js";
import { assertAdaptationFlowsRemainRecordingFree, openAdaptationFromPanel, reviewAndApplyAdaptationViaUi, runAdaptationFromPanel, runZeroLlmAdaptationValidation, waitForAdaptationRun } from "./adaptation-ui.js";
import { assertDemoBlankStateSecrets } from "./blank-preparation.js";
import { connectExtension, extensionStatus, withDemoBrowser } from "./browser-session.js";
import { type DemoWorkspaceConfiguration, credentialLiterals } from "./configuration.js";
import { recordingIds } from "./control-waits.js";
import { authenticatedControl, withPersistentDemoCore } from "./core-process.js";
import { configureFirstLiveDiagnosisViaUi } from "./diagnosis-ui.js";
import { openProjectInPanel, selectFlowInCurrentProject } from "./panel-navigation.js";
import { type DemoWorkspaceState, SCHEMA_VERSION, withWorkspaceLock } from "./workspace-state.js";

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
