import { isDeepStrictEqual } from "node:util";
import { cp, writeFile } from "node:fs/promises";
import { createWebAutomationLlmEvidenceRuntime } from "@fluxiq-web-extension/domain";
import type { AutomationStudioLlmProvider } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { expect, test } from "../../../../fixtures/extension-context";
import { bindScriptedProvider, startInstalledBuild, trialCode, type BuilderTurn } from "../../../index";
import { feedbackCodes, observeCompanyLink } from "../index";

const TASK = "Open Our team using the link in the main navigation.";
const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
const safeCode = (value: unknown): string | null => typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,100}$/u.test(value) ? value : null;

/** Select by the region the real page view prints; duplicate words never select by position. */
function navigationHandle(shown: string): string {
  let navigation = false;
  const matches: string[] = [];
  for (const line of shown.split("\n")) {
    if (/^\[.*\]$/u.test(line)) navigation = /^\[(?:frame \d+ )?navigation\]$/u.test(line);
    if (navigation && /^t\d+ link "Our team"(?: |$)/u.test(line)) matches.push(line.split(" ")[0]!);
  }
  if (matches.length !== 1) throw new Error("completion_fingerprint.navigation_handle_not_unique");
  return matches[0]!;
}

test("installed completion preserves the original click fingerprint across history, restyle and a fresh document, and refuses the missing original", async ({ extensionSession }, testInfo) => {
  test.setTimeout(360_000);
  const installed = await startInstalledBuild(extensionSession);
  const { page, service, fluxiq } = installed;
  const observer = await observeCompanyLink(page, installed.origin);
  const home = new URL("/scenarios/company-website/", installed.origin).href;
  const team = new URL("team", home).href;
  let projectId = "", flowId = "", instructionId = "";
  let original: JsonObject | undefined;
  let originalSelector = "", originalHandle = "";
  let historyVisits = 0, submissionCalls = 0, originalCaptures = 0, absoluteCalls = 0, preservedAbsoluteCalls = 0;
  let retainedSourceGateProbes = 0;
  let providerCallbacks = 0, checkedJudges = 0, trialClickBaseline = 0;
  let builderTurns = 0, executedHistoryCalls = 0;
  let lastTool: { tool: string | null; code: string | null; ok: boolean | null } | undefined;
  let repeated: { code: string | null; tool: string | null; outcome: string | null; inARow: number | null } | undefined;
  let trialSummary: JsonObject | undefined, builderFailure: JsonObject | undefined;
  let trialDiagnostics: JsonObject | undefined;
  let phase: "observe" | "history" | "submit" | "test" | "review" | "replay" | "missing" | "complete" = "observe";
  let candidate: { revision: number; digest: string } | undefined;
  const documents = new Set<number>();
  const matchingSourceDocuments = new Set<number>();
  const historyLocations: string[] = [];
  let newsletterLocation = "";
  const bindProvider = service.bindLlmExecutionProvider;
  try {
    await page.goto(home);
    await page.locator('div[title="Close"]').click();
    await page.getByRole("button", { name: "Accept all", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Newsletter", exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByText("No thanks, I will pay full price", { exact: true }).click();
    const headerLink = page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: "Our team", exact: true });
    const footerLink = page.locator("footer").getByRole("link", { name: "Our team", exact: true });
    await expect(headerLink).toHaveCount(1);
    await expect(footerLink).toHaveCount(1);
    expect(await headerLink.getAttribute("href") === await footerLink.getAttribute("href")).toBe(true);
    await installed.pair();

    const runtime = createWebAutomationLlmEvidenceRuntime({
      eligibleSessionIds: () => fluxiq.programs.clientGateway.snapshot().sessions.filter((session) => session.status === "ready").map((session) => session.sessionId),
      executeAction: (session, command) => fluxiq.programs.automationStudioClientGateway.executeAction(session, command)
    });
    type ToolScope = Pick<Parameters<typeof runtime.executeTool>[0], "projectId" | "flowId" | "permission">;
    let currentScope: ToolScope | undefined;
    const execute = runtime.executeTool.bind(runtime);
    runtime.executeTool = async (input) => {
      const answer = await execute(input);
      const evidence = record(answer.evidence);
      lastTool = { tool: safeCode(input.toolId), code: safeCode(evidence.code), ok: typeof evidence.ok === "boolean" ? evidence.ok : null };
      if (/(?:^|\.)history\.\d+$/u.test(input.callId)) executedHistoryCalls++;
      currentScope = { projectId: input.projectId, flowId: input.flowId };
      if (input.permission !== undefined) currentScope.permission = input.permission;
      return answer;
    };
    const resolve = runtime.resolvePlanNodeParameters.bind(runtime);
    runtime.resolvePlanNodeParameters = async (input) => {
      const parameters = record(input.parameters);
      const absolute = input.nodeDefinitionId === "web.output.dom-click" && typeof parameters.selector === "string" && Object.keys(record(parameters.element)).length > 0;
      const originalObservedHandle = phase === "observe" && original === undefined && originalHandle !== ""
        && input.nodeDefinitionId === "web.output.dom-click" && record(parameters.target).handle === originalHandle;
      const before = JSON.stringify(input.parameters);
      // This is an observer: invoke and return the real public resolver. With
      // an absolute click and no handles, resolve-plan-node.ts calls
      // targets.absoluteIntent before any browser dispatch can be admitted.
      const answer = await resolve(input);
      if (originalObservedHandle && answer.status === "resolved") {
        originalCaptures++;
        original = structuredClone(record(answer.parameters.element));
        originalSelector = typeof answer.parameters.selector === "string" ? answer.parameters.selector : "";
      }
      if (absolute && historyVisits === 10 && phase !== "observe" && phase !== "history") {
        absoluteCalls++;
        if (answer.status === "resolved" && JSON.stringify(answer.parameters) === before
          && JSON.stringify(record(parameters.element)) === JSON.stringify(original)) preservedAbsoluteCalls++;
      }
      return answer;
    };
    service.bindLlmEvidenceRuntime(runtime);

    const assertObservedTrial = async () => {
      const state = await observer.snapshot();
      const clicks = state.clicks.slice(trialClickBaseline);
      expect(state.setupFailures).toBe(0);
      expect(clicks.length).toBeGreaterThan(0);
      expect(clicks.every((click) => click.landmark === "navigation" && click.restyled && click.originalAddressMissing)).toBe(true);
      expect(new URL(page.url()).pathname === new URL(team).pathname).toBe(true);
    };
    // A scripted yes is returned only after the independent browser observer
    // proves the correct actual element received every trial click.
    const watch = (provider: AutomationStudioLlmProvider): AutomationStudioLlmProvider => ({
      ...provider,
      runTask: async (request, execution) => {
        providerCallbacks++;
        if (request.taskKind === "loop_verification") {
          await assertObservedTrial();
          checkedJudges++;
        }
        return provider.runTask(request, execution);
      }
    });
    service.bindLlmExecutionProvider = function (resolver) {
      return bindProvider.call(this, async (...args) => {
        const binding = await resolver(...args);
        if (!binding) return binding;
        return "runTask" in binding ? watch(binding) : { ...binding, provider: watch(binding.provider) };
      });
    };

    projectId = (await service.createProject({ name: "Installed completion fingerprint proof", domainId: "web-automation" })).id;
    flowId = (await service.createFlow({ projectId, flowId: "flow.completion.fingerprint", name: "Main navigation" })).flowId;
    instructionId = (await service.saveFlowGenerationInstruction({ projectId, flowId, instruction: TASK })).instructionId;
    const flow = () => [
      "flow: Main navigation", "step open: open the home page", "  node: web.browser-navigate", `  url: ${JSON.stringify(home)}`,
      "step team: open Our team in the main navigation", "  node: web.dom.click", `  target: ${originalHandle}`, "  consequences: none"
    ].join("\n");
    const builder = async (turn: BuilderTurn) => {
      builderTurns++;
      const refused = turn.last("core.repeat_check");
      if (refused !== undefined) {
        repeated = { code: safeCode(refused.code), tool: safeCode(refused.toolId), outcome: safeCode(record(refused.then).outcome),
          inARow: typeof refused.refusedInARow === "number" ? refused.refusedInARow : null };
        console.log(JSON.stringify({ completionFingerprintStage: "repeat_feedback", phase, builderTurns, requestedHistoryCalls: historyVisits,
          executedHistoryCalls, observedDocuments: documents.size, lastTool, repeated }));
        throw new Error("completion_fingerprint.unexpected_repeat_refusal");
      }
      const snapshot = installed.latestRawSnapshot();
      const document = record(record(snapshot?.evidence).navigation).timeOrigin;
      if (typeof document === "number") documents.add(document);
      if (phase === "observe") {
        if (!snapshot) throw new Error("completion_fingerprint.real_snapshot_missing");
        originalHandle = navigationHandle(turn.shownPage());
        if (!currentScope) throw new Error("completion_fingerprint.real_tool_scope_missing");
        // The run-node implementation resolves inside its closure. Ask its
        // public resolver with that actual tool scope before the original act
        // to observe the authentic complete host-computed target. Its normal
        // permission callback and result are kept, and the call dispatches no act.
        const observed = await runtime.resolvePlanNodeParameters({ ...currentScope, nodeDefinitionId: "web.output.dom-click",
          parameters: { target: { handle: originalHandle } }, declaredConsequences: [], onPage: page.url() });
        expect(observed.status).toBe("resolved");
        if (!original || originalSelector === "") throw new Error("completion_fingerprint.real_identity_missing");
        expect(originalCaptures).toBe(1);
        expect(original.tagName === "a").toBe(true);
        expect(original.id === "company-main-team").toBe(true);
        expect(Array.isArray(original.classNames) && original.classNames.length > 0).toBe(true);
        expect(original.selector === originalSelector).toBe(true);
        expect(record(original.context).landmark === "navigation").toBe(true);
        if (typeof document === "number") matchingSourceDocuments.add(document);
        const links = await page.locator('nav[aria-label="Main"] a, footer a').evaluateAll((elements) => elements.flatMap((element) => element instanceof HTMLAnchorElement
          ? [{ landmark: element.closest('nav[aria-label="Main"]') ? "navigation" : "contentinfo", label: element.textContent?.trim(), href: element.href }] : []));
        const destination = (landmark: string, label: string) => {
          const matches = links.filter((link) => link.landmark === landmark && link.label === label);
          if (matches.length !== 1) throw new Error("completion_fingerprint.shown_destination_not_unique");
          return matches[0]!.href;
        };
        expect(destination("navigation", "Our team") === team).toBe(true);
        historyLocations.push(home, destination("navigation", "Services & prices"), destination("navigation", "Branches"));
        newsletterLocation = destination("contentinfo", "Offers & reminders");
        phase = "history";
        return turn.node("original.click", "web.output.dom-click", { target: { handle: originalHandle } }, []);
      }
      if (phase === "history") {
        expect(turn.last("core.run_node")?.ok).toBe(true);
        if (!currentScope) throw new Error("completion_fingerprint.real_tool_scope_missing");
        const current = await runtime.resolvePlanNodeParameters({ ...currentScope, nodeDefinitionId: "web.output.dom-click",
          parameters: { target: { handle: navigationHandle(turn.shownPage()) } }, declaredConsequences: [], onPage: page.url() });
        expect(current.status).toBe("resolved");
        if (current.status === "resolved" && typeof document === "number" && current.parameters.selector === originalSelector
          && JSON.stringify(current.parameters.element) === JSON.stringify(original)) matchingSourceDocuments.add(document);
        if (historyVisits === 3 && historyLocations.length === 3) {
          const directions = await page.locator("main").getByRole("link", { name: "Get directions", exact: true })
            .evaluateAll((elements) => elements.flatMap((element) => element instanceof HTMLAnchorElement ? [element.href] : []));
          expect(directions.length).toBe(5);
          expect(new Set(directions).size).toBe(5);
          expect(turn.shownPage().split("\n").filter((line) => /^t\d+ link "Get directions"(?: |$)/u.test(line)).length).toBe(5);
          historyLocations.push(...directions, newsletterLocation, team);
          expect(historyLocations.length).toBe(10);
          expect(new Set(historyLocations).size).toBe(10);
        }
        if (historyVisits < 10) {
          const location = historyLocations[historyVisits++];
          if (!location) throw new Error("completion_fingerprint.observed_history_destination_missing");
          return turn.node(`history.${historyVisits}`, "web.output.browser-navigate", { url: location }, []);
        }
        expect(documents.size).toBeGreaterThanOrEqual(11);
        expect(matchingSourceDocuments.size).toBeGreaterThanOrEqual(10);
        const prior = await observer.snapshot();
        expect(prior.clicks.length).toBe(1);
        expect(prior.clicks[0]?.landmark).toBe("navigation");
        trialClickBaseline = prior.clicks.length;
        await observer.mode("restyled", originalSelector);
        phase = "submit";
        if (!original) throw new Error("completion_fingerprint.original_identity_missing");
        // The project path reuses host-resolved parameters. Exercise the
        // retained-source gate explicitly through its public read-only API;
        // this neither authors absolute literals nor changes the real plan.
        const held = { selector: originalSelector, element: structuredClone(original) };
        const gatewayBeforeGate = installed.siteCommands().length;
        const providerBeforeGate = providerCallbacks;
        const retained = await runtime.resolvePlanNodeParameters({ ...currentScope, nodeDefinitionId: "web.output.dom-click",
          parameters: held, declaredConsequences: [], handleReach: "view_history" });
        expect(retained.status).toBe("resolved");
        if (retained.status !== "resolved") throw new Error("completion_fingerprint.retained_source_refused");
        expect(JSON.stringify(retained.parameters) === JSON.stringify(held)).toBe(true);
        expect(retained.controlIntent?.intent).toBe("navigate");
        expect(installed.siteCommands().length).toBe(gatewayBeforeGate);
        expect(providerCallbacks).toBe(providerBeforeGate);
        retainedSourceGateProbes++;
        submissionCalls++;
        return turn.call("submit.original", "core.submit_subflow", { flow: flow() });
      }
      if (phase === "submit") {
        const submitted = turn.last("core.submit_subflow");
        if (typeof submitted?.revision !== "number" || typeof submitted.digest !== "string") throw new Error("completion_fingerprint.submission_refused");
        candidate = { revision: submitted.revision, digest: submitted.digest };
        phase = "test";
        return turn.call("trial.original", "core.test_subflow", candidate);
      }
      if (phase === "test") {
        const tested = turn.last("core.test_subflow");
        const feedback = record(tested?.feedback);
        const steps = Array.isArray(feedback.steps) ? feedback.steps.map((value) => {
          const step = record(value), failure = record(step.failure);
          return { step: typeof step.step === "number" ? step.step : null, definitionId: safeCode(step.definitionId), status: safeCode(step.status),
            failureCode: safeCode(step.failureCode), code: safeCode(failure.code), stage: safeCode(failure.stage), effect: safeCode(failure.effect),
            retryable: typeof failure.retryable === "boolean" ? failure.retryable : null };
        }) : [];
        const trialId = typeof tested?.trialRunId === "string" ? tested.trialRunId : undefined;
        const detail = trialId ? await service.getFlowRunDetail(projectId, trialId) : null;
        const session = trialId ? await service.getRuntimeSession(projectId, trialId) : null;
        const attempts = (detail?.actionAttempts ?? []).map((attempt, index) => ({
          index, definitionId: safeCode(attempt.definitionId), status: safeCode(attempt.status), code: safeCode(attempt.failure?.code),
          stage: safeCode(attempt.failure?.stage), effect: safeCode(attempt.failure?.effect),
          retryable: typeof attempt.failure?.retryable === "boolean" ? attempt.failure.retryable : null
        }));
        trialDiagnostics = { steps, attempts, sessionStatus: safeCode(session?.status), traceStatus: safeCode(record(session?.trace).status),
          traceFailure: safeCode(record(record(session?.trace).failure).code), hasRunDetail: detail !== null };
        await writeFile(testInfo.outputPath("installed-private-trial-diagnostic.json"), JSON.stringify({
          trialAnswer: tested ?? null, runDetail: detail, runtimeSession: session
        }), "utf8");
        trialSummary = { present: tested !== undefined, ok: typeof tested?.ok === "boolean" ? tested.ok : null,
          verdict: safeCode(tested?.verdict), code: safeCode(tested?.code), codes: feedbackCodes(tested, safeCode),
          entryPrepared: typeof tested?.entryPrepared === "boolean" ? tested.entryPrepared : null,
          hasTrialRun: typeof tested?.trialRunId === "string" };
        console.log(JSON.stringify({ completionFingerprintStage: "trial_answer", phase, builderTurns, trial: trialSummary, trialDiagnostics,
          failedGatewayResults: installed.actionResultSummaries().filter((result) => result.status !== "succeeded") }));
        expect(trialCode(tested)).toBe("yes");
        phase = "complete";
      }
      return turn.complete({ subflowKey: "main", ...candidate });
    };
    bindScriptedProvider(installed, { task: TASK, permitted: [], instructionSourceId: () => instructionId, maxIterations: 26, maxCallsPerRun: 48,
      builder: async (turn) => {
        try {
          return await builder(turn);
        } catch (error) {
          builderFailure ??= { phase, builderTurns, kind: safeCode(record(error).name), code: safeCode(record(error).code),
            marker: "completion_fingerprint.builder_exception" };
          throw error;
        }
      } });
    const generated = await service.generateFlowBootstrapAdaptation({ projectId, flowId, evidenceGuided: true, authoringMode: "project",
      caller: { actorUserId: "diagnostic", actorSessionId: "diagnostic" }, startLocation: home });
    expect(generated.status).toBe("proposed");
    if (generated.status !== "proposed") throw new Error("completion_fingerprint.build_not_proposed");
    expect(generated.candidate?.trial.verdict).toBe("yes");
    expect(submissionCalls).toBe(1);
    expect(retainedSourceGateProbes).toBe(1);
    expect(absoluteCalls).toBeGreaterThan(0);
    expect(preservedAbsoluteCalls).toBe(absoluteCalls);
    expect(checkedJudges).toBeGreaterThan(0);
    await assertObservedTrial();

    phase = "review";
    const review = { projectId, flowId, adaptationId: generated.adaptationId, actorId: "diagnostic" };
    await service.reviewFlowBootstrapAdaptation({ ...review, action: "approve" });
    await service.reviewFlowBootstrapAdaptation({ ...review, action: "apply" });
    const summaries = await service.listFlowSubflowSummaries({ projectId, flowId, limit: 50, offset: 0 });
    const savedClicks: JsonObject[] = [];
    for (const summary of summaries.subflows) {
      const subflow = await service.getFlowSubflow(projectId, flowId, summary.subflowId);
      if (!subflow?.graphFlowId) throw new Error("completion_fingerprint.saved_graph_missing");
      const graph = await service.getFlow(projectId, subflow.graphFlowId);
      for (const node of graph.nodes) if (node.definitionId === "web.output.dom-click") savedClicks.push(record(node.parameterValues));
    }
    expect(savedClicks.length).toBe(1);
    expect(savedClicks[0]?.selector === originalSelector).toBe(true);
    expect(isDeepStrictEqual(savedClicks[0]?.element, original)).toBe(true);

    phase = "replay";
    const callbacksBefore = providerCallbacks;
    const beforeReplay = await observer.snapshot();
    const commandsBeforeReplay = installed.siteCommands().length, resultsBeforeReplay = installed.actionResultSummaries().length;
    const distinctBeforeReplay = installed.distinctActionCommands();
    // The product's saved-native-Flow path, also used by Lab playback. Required
    // command mode is a different contract for canonical builtin command graphs.
    const replay = await service.runRuntimeSession({ projectId, flowId, inputs: {}, adaptiveMode: "no_llm_intervention", authorizedDomainIds: ["web-automation"],
      permittedConsequences: [], authorizedExternalSideEffects: false });
    expect(replay.status).toBe("succeeded");
    const afterReplay = await observer.snapshot();
    const replayClicks = afterReplay.clicks.slice(beforeReplay.clicks.length);
    expect(replayClicks).toHaveLength(1);
    expect(replayClicks.every((click) => click.landmark === "navigation" && click.restyled && click.originalAddressMissing && click.document > beforeReplay.documents)).toBe(true);
    const replayDetail = await service.getFlowRunDetail(projectId, replay.runId);
    const resolved = (replayDetail?.actionAttempts ?? []).filter((attempt) => attempt.definitionId === "web.output.dom-click" && attempt.status === "succeeded")
      .map((attempt) => record(record(attempt.metadata).hostTargetResolution));
    expect(resolved.length).toBe(1);
    expect(resolved.every((resolution) => resolution.strategy === "fingerprint" || resolution.strategy === "scored-candidate")).toBe(true);
    const replayCommands = installed.siteCommands().slice(commandsBeforeReplay);
    const replayResults = installed.actionResultSummaries().slice(resultsBeforeReplay);
    expect(replayCommands.filter((action) => action === "web.dom.click").length).toBe(1);
    expect(replayResults.length).toBe(replayCommands.length);
    expect(replayResults.every((result) => result.status === "succeeded")).toBe(true);
    expect(installed.distinctActionCommands() - distinctBeforeReplay).toBe(replayCommands.length);
    expect(providerCallbacks).toBe(callbacksBefore);

    // The recorded navigation target is actually absent. Its footer twin has
    // the same words and destination, but belongs to another landmark.
    phase = "missing";
    await observer.mode("missing", originalSelector);
    const clicksBeforeFailure = afterReplay.clicks.length;
    const resultsBeforeFailure = installed.actionResultSummaries().length;
    const negative = await service.runRuntimeSession({ projectId, flowId, inputs: {}, adaptiveMode: "no_llm_intervention", authorizedDomainIds: ["web-automation"],
      permittedConsequences: [], authorizedExternalSideEffects: false });
    expect(negative.status).toBe("failed");
    const afterFailure = await observer.snapshot();
    expect(afterFailure.clicks.length).toBe(clicksBeforeFailure);
    expect(afterFailure.setupFailures).toBe(0);
    await expect(page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: "Our team", exact: true })).toHaveCount(0);
    await expect(page.locator("footer").getByRole("link", { name: "Our team", exact: true })).toHaveCount(1);
    const negativeDetail = await service.getFlowRunDetail(projectId, negative.runId);
    const failed = negativeDetail?.actionAttempts?.filter((attempt) => attempt.failure?.stage === "target_resolution") ?? [];
    expect(failed.length).toBe(4);
    expect(failed.every((attempt) => attempt.failure?.effect === "unacted")).toBe(true);
    const failedClicks = installed.actionResultSummaries().slice(resultsBeforeFailure).filter((result) => result.actionType === "web.dom.click");
    expect(failedClicks.length).toBe(4);
    expect(failedClicks.every((result) => result.status === "failed" && result.effect === "unacted")).toBe(true);
    expect(providerCallbacks).toBe(callbacksBefore);
    expect(installed.gatewayErrors.length).toBe(0);
    console.log(JSON.stringify({ completionFingerprintProof: "installed_full_path", historicalDocuments: documents.size, matchingSourceDocuments: matchingSourceDocuments.size,
      originalCaptures, retainedSourceGateProbes, absoluteCalls, preservedAbsoluteCalls,
      checkedJudges, replayClicks: replayClicks.length, wrongClicks: afterFailure.clicks.length - clicksBeforeFailure,
      replayGatewayResults: replayResults.length, negativeAttempts: failed.length, replayMode: "product_native_default",
      replayProviderCallbacks: providerCallbacks - callbacksBefore, providerNetworkCalls: 0 }));
  } catch (error) {
    const diagnostic = record(record(error).diagnostic);
    const issueCodes = Array.isArray(diagnostic.issueCodes) ? diagnostic.issueCodes.slice(0, 8).map(safeCode).filter((code) => code !== null) : [];
    const successfulGatewayTypes: Record<string, number> = {};
    for (const result of installed.actionResultSummaries()) {
      const type = safeCode(result.actionType);
      if (result.status === "succeeded" && type !== null) successfulGatewayTypes[type] = (successfulGatewayTypes[type] ?? 0) + 1;
    }
    await cp(installed.rootDir, testInfo.outputPath("installed-private-diagnostic-storage"), { recursive: true, force: false, errorOnExist: true });
    const gatewayOutcomes = projectId ? await installed.gatewayOutcomeSummaries(projectId) : [];
    console.log(JSON.stringify({ completionFingerprintStage: "failed", phase, builderTurns, requestedHistoryCalls: historyVisits,
      executedHistoryCalls, observedDocuments: documents.size, matchingSourceDocuments: matchingSourceDocuments.size,
      originalCaptures, submissionCalls, absoluteCalls, preservedAbsoluteCalls,
      checkedJudges, providerCallbacks, gatewayCommands: installed.siteCommands().length, gatewayResults: installed.actionResultSummaries().length,
      lastTool, repeated, trial: trialSummary, trialDiagnostics, builderFailure, successfulGatewayTypes,
      failedGatewayResults: installed.actionResultSummaries().filter((result) => result.status !== "succeeded"), gatewayOutcomes,
      privateDiagnosticStoragePreserved: true,
      failure: { code: safeCode(diagnostic.code), stage: safeCode(diagnostic.stage), issueCodes } }));
    throw error;
  } finally {
    service.bindLlmExecutionProvider = bindProvider;
    if (projectId && flowId) service.buildCancellation.cancel(projectId, flowId);
    await installed.close();
  }
});
