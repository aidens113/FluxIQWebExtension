// The runtime adaptation lanes: the full first-live adaptation run, the
// inspection of its latest run, and the control surface over a prepared
// target's pending or applied adaptation.
import { randomBytes } from "node:crypto";
import type { ExistingRunDetail, ExistingRunIntervention } from "../existing-fluxiq-control.js";
import { RunnerFailure } from "../failure.js";
import { assertRecordingSetUnchanged, BLANK_LLM_FLOW_NAME, BLANK_LLM_SCENARIO_PATH, loadBlankLlmPreparationState } from "../demo-llm-blank-workspace.js";
import { inspectDemoLlmAdaptationReadiness } from "../demo-llm-adaptation-readiness.js";
import { unexecutedTargetProposalIsSound } from "../demo-llm-exploration-adaptation.js";
import { type DemoLlmAdaptationInvocation, type DemoLlmAdaptationInvocations, type DemoLlmAdaptationResult, evaluateDemoLlmAdaptation, persistDemoLlmAdaptationResult } from "../demo-llm-adaptation.js";
import { adaptationCallCountWithinGrant, controlExistingLlmTargetAdaptation, type ExistingTargetAdaptationAction, type ExistingTargetAdaptationControlResult, type ExistingTargetAdaptationSelector } from "../demo-llm-adaptation-control.js";
import { assertAdaptationFlowsRemainRecordingFree, openAdaptationFromPanel, requireRunEventSequence, reviewAndApplyAdaptationViaUi, runAdaptationFromPanel, runZeroLlmAdaptationValidation, waitForAdaptationRun } from "./adaptation-ui.js";
import { connectExtension, withDemoBrowser } from "./browser-session.js";
import { type DemoWorkspaceConfiguration, credentialLiterals } from "./configuration.js";
import { recordingIds } from "./control-waits.js";
import { authenticatedControl, withPersistentDemoCore } from "./core-process.js";
import { configureFirstLiveDiagnosisViaUi } from "./diagnosis-ui.js";
import { openFlowInCurrentProject, openProjectInPanel } from "./panel-navigation.js";
import { readTargetProposalStructure } from "./adapting-run/index.js";
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
      if (!resumableAdaptation) await configureFirstLiveDiagnosisViaUi(panelPage, flowTreeItemId, config.pin, evidence, "adaptation");
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
      if (interventions.length !== 2 || interventions[0]?.kind !== "diagnosis" || interventions[1]?.kind !== "runtime_patch") {
        throw new RunnerFailure("runtime.behavior", "Adaptation run did not persist exactly diagnosis then runtime_patch");
      }
      if (!adaptationCallCountWithinGrant(failedRun)) {
        throw new RunnerFailure("runtime.behavior", "Adaptation run made a provider call count its grant could not have produced");
      }
      // The certificate (`demo-llm-adaptation.ts`) needs one record for every
      // provider call, and takes them from Core's per-call lines. Refuse here,
      // before review and apply, rather than have the certificate refuse after
      // the Flow has changed.
      if (failedRun.providerCallCount !== failedRun.providerCalls?.length || failedRun.providerCallsOmitted !== 0) {
        throw new RunnerFailure("runtime.behavior", `Adaptation run made ${failedRun.providerCallCount ?? "an unreported number of"} provider calls, but its run detail itemizes ${failedRun.providerCalls?.length ?? "none"} of them${failedRun.providerCallsOmitted ? ` and omits ${failedRun.providerCallsOmitted}` : ""}; the certificate needs a record for every call`);
      }
      const [diagnosis, runtimePatch] = interventions as [ExistingRunIntervention, ExistingRunIntervention];
      const failedSequence = requireRunEventSequence(events, "action_attempt", failedActions[0]!.attemptId);
      const diagnosisSequence = requireRunEventSequence(events, "intervention", diagnosis.interventionId);
      const patchSequence = requireRunEventSequence(events, "intervention", runtimePatch.interventionId);
      if (!(failedSequence < diagnosisSequence && diagnosisSequence < patchSequence)) throw new RunnerFailure("runtime.behavior", "Failed action and adaptation intervention ordering was not durable");
      // Built before the proposal is opened, reviewed or applied, so a call the
      // certificate could not record refuses the run while the Flow is unchanged.
      const calls = adaptationCertificateCalls(failedRun, { diagnosis, patch: runtimePatch }, { failed: failedSequence, diagnosis: diagnosisSequence, patch: patchSequence });
      if (adaptationIds.length !== 1 || proposalIds.length !== 1 || (!resumableAdaptation && adaptationsBefore.has(adaptationIds[0]!))) {
        throw new RunnerFailure("runtime.behavior", "Adaptation run did not create exactly one new manual-review proposal in the exact Flow scope");
      }
      const proposal = await control.getFlowAdaptation(state.projectId, state.flowId, adaptationIds[0]!);
      const structure = await readTargetProposalStructure(control, state.projectId, state.flowId, proposal.adaptationId);
      if (!(["proposed", "validated", "applied"] as string[]).includes(proposal.status) || proposal.sourceRunId !== started.runId || proposal.subflowId !== state.subflowId
        || proposal.patchKinds?.length !== 1 || proposal.patchKinds[0] !== "edit_action_target"
        || !unexecutedTargetProposalIsSound(proposal, structure)) {
        throw new RunnerFailure("runtime.behavior", "The generated manual adaptation was not one validated action-target change scoped to the failed run and owned Subflow");
      }
      if (proposal.status !== "applied" && resumableAdaptation) {
        await openAdaptationFromPanel(panelPage, adaptationFlowTreeItemId, proposal.adaptationId, evidence);
      } else if (proposal.status !== "applied") {
        const reviewAction = panelPage.getByRole("button", { name: `Review ${proposal.adaptationId}`, exact: true });
        await reviewAction.waitFor({ state: "visible", timeout: 30_000 });
        await evidence.diagnostic("panel", "adaptation-review-action-ready", "adaptation.manual-review", { visible: true, exactAdaptation: true });
      }

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
      const evaluated = evaluateDemoLlmAdaptation({
        schemaVersion: "0.1",
        operationId: `adaptation.${randomBytes(12).toString("hex")}`,
        startingGraph: { creationCertified: true, projectId: state.projectId, flowId: state.flowId, startingExecutionDigest, ownedSubflowCount: 1, routerSubflowRouteCount: 1, nodeCount: readiness.nodeCount, executableNodeCount: readiness.nodeCount, recordingCount: recordingsBefore.size, recordingProvenanceAbsent: true },
        drift: { kind: "semantic-target", scenarioId: "instruction-only-form", beforeTargetFingerprint: "instruction-target-set.baseline.v1", afterTargetFingerprint: "instruction-target-set.drifted.v1", introducedBeforeRun: true, observed: true },
        failedAction: { runId: started.runId, attemptId: failedActions[0]!.attemptId, sequence: calls.failedSequence, status: "failed", providerCallCountBeforeFailure: 0 },
        providerCallCount: calls.providerCallCount,
        invocations: calls.invocations,
        adaptation: { adaptationId: applied.adaptationId, requestId: calls.patchRequestId, baseExecutionDigest: startingExecutionDigest, resultingExecutionDigest, validationOk: true, stale: false, concurrentMutationDetected: false, reviewOutcome: "approved", approvalChannel: "human-ui", mutationObservedBeforeApproval: false, outcome: "applied", applySequence: calls.applySequence, structuralChange: false, externalSideEffectEscalation: false, authorizationExpansion: false, unsupportedOutputCount: 0, recordingCount: recordingIds(recordingsAfterResponse).size, recordingProvenanceAbsent: true },
        postApplyValidation: { runId: postApply.summary.runId, status: "succeeded", completionSequence: calls.completionSequence, executionDigest: resultingExecutionDigest, providerCallCount: 0, interventionCount: 0, diagnosisCount: 0, adaptationCount: 0, actionAttemptCount: postApply.actionAttempts.length, succeededActionCount: postApply.actionAttempts.filter(item => item.status === "succeeded").length },
        finalReplay: { runId: replay.summary.runId, status: "succeeded", executionDigest: resultingExecutionDigest, providerCallCount: 0, interventionCount: 0, adaptationCount: 0, actionAttemptCount: replay.actionAttempts.length, succeededActionCount: replay.actionAttempts.filter(item => item.status === "succeeded").length },
      });
      return persistDemoLlmAdaptationResult(config.workspaceDirectory, evaluated, credentialLiterals(config));
    }, credentialLiterals(config), BLANK_LLM_SCENARIO_PATH);
  }));
}

/**
 * Spacing between two durable run events on the certificate's ordering scale.
 * It is larger than Core's per-call record limit (250), so every evidence call
 * Core itemized fits strictly between the diagnosis and the patch events.
 */
const CERTIFICATE_ORDER_SCALE = 1_024;

/** The adapting run's provider calls and event positions, as the certificate takes them. */
export type AdaptationCertificateCalls = Readonly<{
  providerCallCount: number;
  invocations: DemoLlmAdaptationInvocations;
  patchRequestId: string;
  failedSequence: number;
  applySequence: number;
  completionSequence: number;
}>;

/**
 * One certificate invocation for every provider call Core itemized on the run,
 * in Core's order: the diagnosis, each evidence-gathering call, then the patch.
 *
 * Core's run events place the failure, the diagnosis and the patch; its
 * per-call lines place every call, the evidence calls included, which leave no
 * event of their own. The two are joined by request: the first line must be
 * the diagnosis intervention's request and the last the patch's. On the
 * certificate's scale each event sits at its sequence times
 * `CERTIFICATE_ORDER_SCALE`, an evidence call at the diagnosis plus its offset
 * in Core's order, and the apply and the first validation at the next two
 * steps after the patch -- so the certificate's ordering check reads the order
 * Core recorded, and nothing else.
 *
 * A call the certificate could not honestly record -- unitemized, without
 * reported usage, invalid, or from another provider -- refuses the run by name.
 */
export function adaptationCertificateCalls(
  run: Pick<ExistingRunDetail, "providerCallCount" | "providerCalls" | "providerCallsOmitted">,
  interventions: Readonly<{ diagnosis: ExistingRunIntervention; patch: ExistingRunIntervention }>,
  events: Readonly<{ failed: number; diagnosis: number; patch: number }>,
): AdaptationCertificateCalls {
  const refuse = (message: string): never => { throw new RunnerFailure("runtime.behavior", `Adaptation certificate cannot record this run: ${message}`); };
  const lines = run.providerCalls ?? refuse("its run detail has no per-call records");
  if (run.providerCallCount !== lines.length || run.providerCallsOmitted !== 0) refuse(`the run made ${run.providerCallCount ?? "an unreported number of"} provider calls and its run detail itemizes ${lines.length}, omitting ${run.providerCallsOmitted ?? "an unknown number"}`);
  if (lines.length < 2 || lines.length - 2 >= CERTIFICATE_ORDER_SCALE) refuse(`${lines.length} provider calls cannot be one diagnosis, the evidence calls, and one patch`);
  if (!(events.failed < events.diagnosis && events.diagnosis < events.patch)) refuse("its failure, diagnosis and patch events are out of order");
  const last = lines.length - 1;
  if (lines[0]!.requestId !== interventions.diagnosis.requestId || lines[last]!.requestId !== interventions.patch.requestId) refuse("its first and last calls are not the diagnosis and patch interventions");
  const invocation = <Purpose extends DemoLlmAdaptationInvocation["purpose"]>(index: number, purpose: Purpose, taskKind: string, sequence: number): DemoLlmAdaptationInvocation<Purpose> => {
    const line = lines[index]!;
    const name = `call ${index + 1}`;
    if (line.taskKind !== taskKind) refuse(`${name} is ${line.taskKind ?? "an unnamed task"}, not ${taskKind}`);
    if (line.provider !== "deepseek" || line.model !== "deepseek-chat") refuse(`${name} was not a deepseek-chat call`);
    if (line.validationOk !== true) refuse(`${name} did not validate`);
    const { inputTokens, outputTokens, totalTokens, estimatedCostUsd, promptVersion } = line;
    if (inputTokens === null || outputTokens === null || totalTokens === null || estimatedCostUsd === null) return refuse(`${name} has no provider-reported usage`);
    if (promptVersion === null) return refuse(`${name} has no prompt version`);
    return {
      requestId: line.requestId, purpose, provider: "deepseek", model: "deepseek-chat", promptSchemaVersion: promptVersion, sequence,
      attempt: 1, retryCount: 0, providerCallCount: 1, inputTokens, outputTokens, totalTokens, estimatedCostUsd, latencyMs: 0,
    };
  };
  const at = (sequence: number, offset = 0) => sequence * CERTIFICATE_ORDER_SCALE + offset;
  const evidence = lines.slice(1, last).map((_, offset) => invocation(offset + 1, "runtime_evidence", "evidence_tool_decision", at(events.diagnosis, offset + 1)));
  return {
    providerCallCount: lines.length,
    invocations: [invocation(0, "runtime_diagnosis", "runtime_diagnosis", at(events.diagnosis)), ...evidence, invocation(last, "runtime_patch", "runtime_patch", at(events.patch))],
    patchRequestId: lines[last]!.requestId,
    failedSequence: at(events.failed),
    applySequence: at(events.patch + 1),
    completionSequence: at(events.patch + 2),
  };
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
