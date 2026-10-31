import type { JsonObject } from "fluxiq/core";
import { expect, test } from "../../fixtures/extension-context";
import { canonicalJson, ensureStatesIn } from "../change-proof";
import { bindScriptedProvider, keepDiagnostic, startInstalledBuild, trialCode } from "../index";
import { bindDetectingRuntime } from "../photo-build";
import { countPhotoProviderCallbacks, groundedPhotoBuilder, photoToggleScenario } from "./photo-first-row-toggle";

const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

/** The first matching post already satisfies the task. Only the model's copied observed choice supplies polarity. */
test("installed newest-likes build requires an observed state choice, preserves the initially liked post and replays with zero provider callbacks", async ({ extensionSession }, testInfo) => {
  test.setTimeout(600_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page, service } = installed;
  let projectId = "", flowId = "";
  const counter = countPhotoProviderCallbacks(service, () => photoToggleScenario.assertFinal(page));
  const actions: Array<{ action: string; skipped?: unknown; toggle?: unknown; toggleBefore?: unknown }> = [];
  const execute = installed.fluxiq.programs.automationStudioClientGateway.executeAction.bind(installed.fluxiq.programs.automationStudioClientGateway);
  installed.fluxiq.programs.automationStudioClientGateway.executeAction = async (...args) => {
    const result = await execute(...args);
    const payload = record(result.payload);
    actions.push({ action: String(record(args[1]).actionType ?? ""), ...(payload.skipped ? { skipped: payload.skipped } : {}),
      ...(payload.toggle ? { toggle: payload.toggle } : {}), ...(payload.toggleBefore ? { toggleBefore: payload.toggleBefore } : {}) });
    return result;
  };
  try {
    const initial = await photoToggleScenario.prepare(page, installed.origin);
    expect(initial.map(entry => entry.state)).toEqual(["Unlike", "Like", "Like"]);
    await installed.pair();
    const observed = bindDetectingRuntime(installed);
    const script = groundedPhotoBuilder(installed);
    const project = await service.createProject({ name: "Installed grounded photo states", domainId: "web-automation" });
    projectId = project.id;
    const flow = await service.createFlow({ projectId, flowId: "flow.photo.grounded-toggle", name: "Newest likes" });
    flowId = flow.flowId;
    const instruction = await service.saveFlowGenerationInstruction({ projectId, flowId, instruction: photoToggleScenario.task });
    const provider = bindScriptedProvider(installed, { task: photoToggleScenario.task, permitted: ["modify_existing"], instructionSourceId: () => instruction.instructionId,
      maxIterations: 24, maxCallsPerRun: 36, builder: script.builder, verify: script.judge.verify });
    counter.restore();
    const result = await service.generateFlowBootstrapAdaptation({ projectId, flowId, evidenceGuided: true, authoringMode: "project",
      caller: { actorUserId: "diagnostic", actorSessionId: "diagnostic" }, startLocation: page.url() }).catch(async error => {
      await keepDiagnostic(testInfo, "grounded-toggle-failed-build.json", { answers: script.answers, pages: script.pages,
        selected: script.selected(), opposite: script.opposite(), refusal: script.refusalState(), actions, outcomes: observed.outcomes,
        receipts: provider.receipts, providerCallbacks: counter.calls(), gatewayErrors: installed.gatewayErrors });
      throw error;
    });
    await keepDiagnostic(testInfo, "grounded-toggle-build.json", { result, initial, answers: script.answers, pages: script.pages,
      selected: script.selected(), opposite: script.opposite(), refusal: script.refusalState(), script: script.script(),
      judge: script.judge.requests, actions, outcomes: observed.outcomes, receipts: provider.receipts, providerCallbacks: counter.calls(), gatewayErrors: installed.gatewayErrors });
    expect(result.status).toBe("proposed");
    if (result.status !== "proposed") throw new Error("diagnostic.grounded_build_not_proposed");
    expect(trialCode(script.answers.trial)).toBe("yes");
    expect(script.answers.trial?.trialRunId).toBeTruthy();
    expect(script.judge.requests).toHaveLength(2);
    for (const request of script.judge.requests) expect(ensureStatesIn(request)).toContain(canonicalJson(script.selected()));
    await photoToggleScenario.assertFinal(page);
    const trialRunId = result.candidate!.trial.runId;
    const table = await service.runDatasets.getRunDatasetPage({ projectId, runId: trialRunId, datasetId: photoToggleScenario.expected.step });
    expect(table?.rows).toEqual(photoToggleScenario.expected.records);
    expect(table?.rows).toHaveLength(photoToggleScenario.expected.count);
    const review = { projectId, flowId, adaptationId: result.adaptationId, actorId: "diagnostic" };
    await service.reviewFlowBootstrapAdaptation({ ...review, action: "approve" });
    await service.reviewFlowBootstrapAdaptation({ ...review, action: "apply" });
    const subflows = await service.listFlowSubflowSummaries({ projectId, flowId, limit: 50, offset: 0 });
    const saved = await Promise.all(subflows.subflows.map(async summary => {
      const subflow = await service.getFlowSubflow(projectId, flowId, summary.subflowId);
      if (!subflow?.graphFlowId) throw new Error("diagnostic.saved_subflow_graph_missing");
      return service.getFlow(projectId, subflow.graphFlowId);
    }));
    const savedStates = saved.flatMap(graph => graph.nodes.flatMap(node => node.parameterValues?.ensureState ? [node.parameterValues.ensureState] : []));
    expect(savedStates).toEqual([script.selected()]);
    const callbacksBefore = counter.calls(), actionsBefore = actions.length;
    const replay = await service.runRuntimeSession({ projectId, flowId, inputs: {}, permittedConsequences: ["modify_existing"], authorizedExternalSideEffects: true });
    const callbacksAfter = counter.calls();
    const replayActions = actions.slice(actionsBefore);
    const replayTable = await service.runDatasets.getRunDatasetPage({ projectId, runId: replay.runId, datasetId: photoToggleScenario.expected.step });
    await keepDiagnostic(testInfo, "grounded-toggle-replay.json", { status: replay.status, trace: replay.trace, savedStates,
      callbacksBefore, callbacksAfter, replayActions, table: replayTable, gatewayErrors: installed.gatewayErrors });
    expect(replay.status).toBe("succeeded");
    expect(callbacksAfter).toBe(callbacksBefore);
    expect(replayActions.filter(action => action.skipped === "already_in_state")).toHaveLength(3);
    expect(replayActions.filter(action => action.toggle !== undefined)).toEqual([]);
    expect(replayTable?.rows).toEqual(photoToggleScenario.expected.records);
    await photoToggleScenario.assertFinal(page);
  } finally {
    counter.restore();
    if (projectId && flowId) service.buildCancellation.cancel(projectId, flowId);
    await installed.close();
  }
});
