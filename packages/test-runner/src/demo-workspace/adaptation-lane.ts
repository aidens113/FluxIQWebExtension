// The runtime adaptation lanes: the full first-live adaptation run, the
// inspection of its latest run, and the control surface over a prepared
// target's pending or applied adaptation.
import { randomBytes } from "node:crypto";
import type { ExistingRunIntervention } from "../existing-fluxiq-control.js";
import { RunnerFailure } from "../failure.js";
import { assertRecordingSetUnchanged, BLANK_LLM_FLOW_NAME, BLANK_LLM_SCENARIO_PATH, loadBlankLlmPreparationState } from "../demo-llm-blank-workspace.js";
import { inspectDemoLlmAdaptationReadiness } from "../demo-llm-adaptation-readiness.js";
import { type DemoLlmAdaptationResult, evaluateDemoLlmAdaptation, persistDemoLlmAdaptationResult } from "../demo-llm-adaptation.js";
import { controlExistingLlmTargetAdaptation, type ExistingTargetAdaptationAction, type ExistingTargetAdaptationControlResult, type ExistingTargetAdaptationSelector } from "../demo-llm-adaptation-control.js";
import { adaptationInvocation, assertAdaptationFlowsRemainRecordingFree, openAdaptationFromPanel, requireCompleteAdaptationIntervention, requireRunEventSequence, reviewAndApplyAdaptationViaUi, runAdaptationFromPanel, runZeroLlmAdaptationValidation, waitForAdaptationRun } from "./adaptation-ui.js";
import { connectExtension, withDemoBrowser } from "./browser-session.js";
import { type DemoWorkspaceConfiguration, credentialLiterals } from "./configuration.js";
import { recordingIds } from "./control-waits.js";
import { authenticatedControl, withPersistentDemoCore } from "./core-process.js";
import { configureFirstLiveDiagnosisViaUi } from "./diagnosis-ui.js";
import { openFlowInCurrentProject, openProjectInPanel } from "./panel-navigation.js";
import { type DemoWorkspaceState, SCHEMA_VERSION, withWorkspaceLock } from "./workspace-state.js";

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
