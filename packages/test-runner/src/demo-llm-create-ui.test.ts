import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { EVIDENCE_GUIDED_CREATION_COMMAND_TIMEOUT_MS, EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS, EVIDENCE_GUIDED_CREATION_LIMITS, FIRST_LIVE_CREATION_LIMITS, LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD, buildApproveApplyCreationViaUi, classifyExplorationUiTerminal, creationSettingsFields, inspectAppliedCreation, parseAppliedExecutionDigest, parseEvidenceGuidedCreationProposal, proposeEvidenceGuidedCreationViaUi, readProviderFreeGenerationReadiness, readSanitizedGenerationFailure, readSanitizedSettingsSaveFailure, rejectStalePendingCreationAdaptation } from "./demo-llm-create-ui.js";
import { TESTING_LAB_DEEPSEEK_KEY_NAME } from "./secret-keys-ui.js";
import { AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS } from "fluxiq/automation-studio";

const root = path.resolve(import.meta.dirname, "..", "..", "..");

test("evidence-guided proposal parser retains only bounded proposal accounting", () => {
  const response = { ok: true, payload: { adaptation: { projectId: "project.one", flowId: "flow.one", adaptationId: "adaptation.one", status: "proposed", accounting: { provider: "deepseek", model: "deepseek-chat", inputTokens: 30_000, outputTokens: 4_000, totalTokens: 34_000, estimatedCostUsd: 0.4, raw: "discard-me" }, topology: { raw: "discard-me" } } } };
  assert.deepEqual(parseEvidenceGuidedCreationProposal(response, "project.one", "flow.one"), { adaptationId: "adaptation.one", status: "proposed", provider: "deepseek", model: "deepseek-chat", inputTokens: 30_000, outputTokens: 4_000, totalTokens: 34_000, estimatedCostUsd: 0.4 });
  assert.equal(EVIDENCE_GUIDED_CREATION_LIMITS.maxCalls, 4);
  assert.throws(() => parseEvidenceGuidedCreationProposal({ ...response, payload: { adaptation: { ...response.payload.adaptation, status: "applied" } } }, "project.one", "flow.one"), /escaped its checkpoint scope/u);
  assert.throws(() => parseEvidenceGuidedCreationProposal({ ...response, payload: { adaptation: { ...response.payload.adaptation, accounting: { ...response.payload.adaptation.accounting, inputTokens: 48_000, outputTokens: 1, totalTokens: 48_001 } } } }, "project.one", "flow.one"), /aggregate bounds/u);
});

test("proposal-only exploration launcher and UI driver stop before review mutation", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  assert.equal(manifest.scripts?.["demo:llm:explore"], "node scripts/run-demo-llm-exploration.mjs");
  const launcher = await readFile(path.join(root, "scripts", "run-demo-llm-exploration.mjs"), "utf8");
  assert.match(launcher, /runDemoLlmExplorationCheckpoint/u);
  assert.match(launcher, /reviewOutcome: "pending"/u);
  assert.match(launcher, /applyOutcome: "not_attempted"/u);
  assert.match(launcher, /replayOutcome: "not_attempted"/u);
  assert.doesNotMatch(launcher, /DEEPSEEK_API_KEY|approveFlowAdaptation|applyFlowAdaptation|runPersistedFlow/u);
  const driver = proposeEvidenceGuidedCreationViaUi.toString();
  assert.match(driver, /Website task/u);
  assert.match(driver, /Explore and create proposal/u);
  assert.match(driver, /targetPage\.bringToFront/u);
  assert.ok(driver.indexOf("targetPage.bringToFront") < driver.indexOf("waitForExplorationTerminal"));
  assert.match(driver, /listFlowAdaptations/u);
  assert.doesNotMatch(driver, /Approve Adaptation|Apply Adaptation|authorizationPin/u);
  assert.deepEqual(EVIDENCE_GUIDED_CREATION_LIMITS, { provider: "deepseek", model: "deepseek-chat", maxInputTokens: 8_000, maxOutputTokens: 4_000, maxTotalTokens: 12_000, maxCalls: 4, maxUses: 4, timeoutSeconds: 45, maxEstimatedCostUsd: 0.25, maxTotalEstimatedCostUsd: 1, providerRetries: 0 });
  assert.deepEqual(EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS, { provider: "deepseek", model: "deepseek-chat", maxInputTokens: 8_000, maxOutputTokens: 4_000, maxTotalTokens: 12_000, maxCalls: 4, timeoutSeconds: 25, maxEstimatedCostUsd: 0.25, providerRetries: 0 });
  assert.deepEqual(creationSettingsFields(EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS).find(([label]) => label === "Timeout (seconds)"), ["Timeout (seconds)", "25"]);
  assert.equal(EVIDENCE_GUIDED_CREATION_LIMITS.timeoutSeconds, 45);
  assert.equal(EVIDENCE_GUIDED_CREATION_COMMAND_TIMEOUT_MS, 195_000);
  assert.equal(EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalTokens * EVIDENCE_GUIDED_CREATION_LIMITS.maxCalls, 48_000);
  assert.equal(LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD, 100_000);
  const workspace = await readFile(path.join(root, "packages", "test-runner", "src", "demo-workspace.ts"), "utf8");
  assert.match(workspace, /configureEvidenceGuidedCreationViaUi\(panelPage, fixture\.flowTreeItemId, flowName/u);
  assert.match(workspace, /targetPage: scenarioPage/u);
  const uiSource = await readFile(path.join(root, "packages", "test-runner", "src", "demo-llm-create-ui.ts"), "utf8");
  assert.match(uiSource, /configureCreationLimitsViaUi\(page, flowTreeItemId, pin, evidence, EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS, flowName\)/u);
  assert.match(uiSource, /name: "Explore and create proposal", exact: true/u);
  assert.match(uiSource, /create-settings-flow-search/u);
  assert.match(uiSource, /getByText\(exactFlowName, \{ exact: true \}\)/u);
  assert.match(uiSource, /`\$\{exactFlowName\} actions`/u);
  assert.match(uiSource, /getByRole\("menuitem", \{ name: "Open settings", exact: true \}\)/u);
  const exactBranch = uiSource.slice(uiSource.indexOf("if (exactFlowName)"), uiSource.indexOf("} else {", uiSource.indexOf("if (exactFlowName)")));
  assert.doesNotMatch(exactBranch, /search\.fill\("Settings"\)|data-tree-parent-id/u);
  assert.match(uiSource, /exactVirtualizedHierarchyObject\(page, hierarchy, `\$\{flowTreeItemId\}-runtime-debug`/u);
  assert.match(uiSource, /data-tree-item-id/u);
  assert.match(uiSource, /element\.scrollTop = next/u);
  assert.match(uiSource, /waitForExplorationTerminal/u);
  assert.match(uiSource, /authoring\.getByRole\("alert"\)/u);
  assert.match(uiSource, /Confirm high-token Flow Build/u);
  assert.match(uiSource, /confirmationAttempted: false/u);
  assert.doesNotMatch(driver, /Continue high-token build/u);
  assert.match(uiSource, /control\.listFlowAdaptations\(projectId, flowId, "proposed"\)/u);
  assert.match(uiSource, /Date\.now\(\) \+ EVIDENCE_GUIDED_CREATION_COMMAND_TIMEOUT_MS/u);
  assert.match(uiSource, /context\.on\("request", observeRequest\)/u);
  assert.match(uiSource, /context\.on\("response", observe\)/u);
  assert.match(uiSource, /context\.on\("requestfinished", observeFinished\)/u);
  assert.match(uiSource, /request\.response\(\)/u);
  assert.match(uiSource, /context\.off\("requestfinished", observeFinished\)/u);
  assert.match(uiSource, /apiRequestObserved: terminal\.requestObserved/u);
  assert.match(uiSource, /generationBody as Record<string, unknown>\)\.ok !== true/u);
  assert.doesNotMatch(uiSource, /waitForEndpoint\(page, "generate-flow-bootstrap-adaptation", \(\) => explore\.click\(\), 190_000\)/u);
});

test("exploration UI terminal classifier stops at high-token confirmation without treating it as an alert", () => {
  assert.deepEqual(classifyExplorationUiTerminal({ highTokenConfirmationVisible: true, alertVisible: false, requestObserved: false }), {
    kind: "high_token_confirmation",
    requestObserved: false,
  });
  assert.deepEqual(classifyExplorationUiTerminal({ highTokenConfirmationVisible: true, alertVisible: true, requestObserved: true }), {
    kind: "high_token_confirmation",
    requestObserved: true,
  });
  assert.deepEqual(classifyExplorationUiTerminal({ highTokenConfirmationVisible: false, alertVisible: true, requestObserved: true }), {
    kind: "ui_failure",
    requestObserved: true,
  });
  assert.equal(classifyExplorationUiTerminal({ highTokenConfirmationVisible: false, alertVisible: false, requestObserved: false }), undefined);
  assert.equal(EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalTokens * EVIDENCE_GUIDED_CREATION_LIMITS.maxCalls > LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD, false);
});

test("Phase 3 launcher strips provider secrets and never loads a provider key", async () => {
  const source = await readFile(path.join(root, "scripts", "run-demo-llm-creation.mjs"), "utf8");
  assert.match(source, /withoutProviderSecrets\(process\.env\)/u);
  assert.match(source, /runDemoLlmCreation/u);
  assert.match(source, /skipPrerequisiteBuilds/u);
  assert.match(source, /--no-build/u);
  assert.doesNotMatch(source, /DEEPSEEK_API_KEY|recordDemoWorkspace|latestRecordingId/u);
});

test("settings-only probe cannot load provider secrets or reach generation", async () => {
  const source = await readFile(path.join(root, "scripts", "run-demo-llm-creation-settings.mjs"), "utf8");
  assert.match(source, /withoutProviderSecrets\(process\.env\)/u);
  assert.match(source, /runDemoLlmCreationSettingsProbe/u);
  assert.match(source, /providerCallCount: 0/u);
  assert.doesNotMatch(source, /DEEPSEEK_API_KEY|runDemoLlmCreation\(|generate-flow-bootstrap-adaptation/u);
});
test("readiness-only command strips provider secrets and stops at the exact GET gate", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  assert.equal(packageJson.scripts?.["demo:llm:readiness"], "node scripts/run-demo-llm-creation-readiness.mjs");
  const source = await readFile(path.join(root, "scripts", "run-demo-llm-creation-readiness.mjs"), "utf8");
  assert.match(source, /withoutProviderSecrets\(process\.env\)/u);
  assert.match(source, /runDemoLlmCreationReadinessProbe/u);
  assert.match(source, /providerCallCount: 0/u);
  assert.doesNotMatch(source, /DEEPSEEK_API_KEY|generate-flow-bootstrap-adaptation|buildApproveApplyCreationViaUi|configureFirstLiveCreationViaUi/u);
});
test("pending-proposal inspection is provider-free and uses the exact scoped control path", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  assert.equal(packageJson.scripts?.["demo:llm:pending"], "node scripts/inspect-demo-llm-pending-creation.mjs");
  const source = await readFile(path.join(root, "scripts", "inspect-demo-llm-pending-creation.mjs"), "utf8");
  assert.match(source, /withoutProviderSecrets\(process\.env\)/u);
  assert.match(source, /runDemoLlmPendingCreationProbe/u);
  assert.match(source, /providerCallCount: 0/u);
  assert.doesNotMatch(source, /DEEPSEEK_API_KEY|generate-flow-bootstrap-adaptation|rejectFlowAdaptation/u);
});
test("applied bootstrap revert is an explicit provider-free repair command", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  assert.equal(packageJson.scripts?.["demo:llm:revert"], "node scripts/revert-demo-llm-applied-creation.mjs");
  const source = await readFile(path.join(root, "scripts", "revert-demo-llm-applied-creation.mjs"), "utf8");
  assert.match(source, /withoutProviderSecrets\(process\.env\)/u);
  assert.match(source, /runDemoLlmAppliedCreationRevertProbe/u);
  assert.match(source, /providerCallCount: 0/u);
  assert.doesNotMatch(source, /DEEPSEEK_API_KEY|generate-flow-bootstrap-adaptation/u);
});
test("Phase 3 UI driver pins exact one-call limits and explicit review actions", async () => {
  assert.deepEqual(FIRST_LIVE_CREATION_LIMITS, { provider: "deepseek", model: "deepseek-chat", maxInputTokens: 4000, maxOutputTokens: 1000, maxTotalTokens: 5000, maxCalls: 1, timeoutSeconds: 20, maxEstimatedCostUsd: 0.25, providerRetries: 0 });
  const source = await readFile(new URL("./demo-llm-create-ui.js", import.meta.url), "utf8");
  for (const seam of ["Build Flow from instructions", "authenticated session", "the generated Flow's Adaptations table", "Select the exact generated Flow bootstrap proposal", "Approve Adaptation", "Apply Adaptation", "Apply Changes", "Flow mutated before explicit human approval"]) assert.match(source, new RegExp(seam));
  assert.equal(TESTING_LAB_DEEPSEEK_KEY_NAME, "FluxIQ Testing Lab DeepSeek");
  assert.match(source, /if \(await key\.inputValue\(\) !== TESTING_LAB_DEEPSEEK_KEY_NAME\)/u);
  assert.match(source, /key\.fill\(TESTING_LAB_DEEPSEEK_KEY_NAME\)/u);
  assert.match(source, /escapeRegExp\(TESTING_LAB_DEEPSEEK_KEY_NAME\)/u);
  assert.match(source, /exact stored Testing Lab DeepSeek key was not selected/u);
  assert.doesNotMatch(source, /key\.fill\("Testing Lab DeepSeek"\)/u);
  assert.doesNotMatch(source, /rawPrompt|rawResponse|DEEPSEEK_API_KEY|recordDemoWorkspace/u);
  assert.match(source, /configureCreationLimitsViaUi\(page, flowTreeItemId, pin, evidence, FIRST_LIVE_CREATION_LIMITS\)/u);
  for (const limit of ["maxInputTokens", "maxOutputTokens", "maxTotalTokens", "maxCalls", "timeoutSeconds", "maxEstimatedCostUsd", "providerRetries"]) assert.match(source, new RegExp(`limits\\.${limit}`, "u"));
  assert.doesNotMatch(source, /\["Output tokens", "512"\]|outputTokens > 512|totalTokens > 3000/u);
  const readinessGate = source.indexOf("assertProviderFreeGenerationReadiness(input.page, input.evidence)");
  const sessionSync = source.indexOf("generation-session-sync");
  const runtimeOpen = source.indexOf("create-runtime-search");
  const paidBuild = source.indexOf("Build with the authenticated session using exactly one bounded Flow bootstrap call");
  assert.equal(sessionSync >= 0 && readinessGate > sessionSync && runtimeOpen > readinessGate && paidBuild > runtimeOpen, true);
  assert.match(source, /input\.control\.sessionCookieValue\(\)/u);
  assert.match(source, /AUTOMATION_STUDIO_ENDPOINTS\.getFlowBootstrapGenerationReadiness/u);
  assert.match(source, /parseAutomationStudioFlowBootstrapGenerationReadiness/u);
  assert.match(source, /page\.request\.get\(endpoint/u);
  assert.doesNotMatch(source, /page\.request\.post\(endpoint/u);
});

test("provider-free readiness parser accepts only the exact live dynamic contract", async () => {
  const response = (status: number, body: string) => ({ ok: () => status >= 200 && status <= 299, status: () => status, text: async () => body });
  const body = (readiness: unknown, extra: Record<string, unknown> = {}) => JSON.stringify({ ok: true, payload: { readiness }, ...extra });
  const ready = structuredClone(AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS);
  assert.equal((await readProviderFreeGenerationReadiness(response(200, body(ready)))).compatible, true);
  for (const runtimeKey of ["llmExecutionGrantsConfigured", "providerResolverConfigured", "nativeNodeRegistryConfigured"] as const) {
    const unwired = structuredClone(ready);
    unwired.supported = false;
    unwired.runtime[runtimeKey] = false;
    assert.equal((await readProviderFreeGenerationReadiness(response(200, body(unwired)))).compatible, false);
  }
  const stale = structuredClone(ready) as unknown as Record<string, unknown>;
  stale.contractVersion = "automation-studio.flow-bootstrap-generation-readiness.v0";
  assert.equal((await readProviderFreeGenerationReadiness(response(200, body(stale)))).compatible, false);
  const wrongEndpoint = structuredClone(ready) as unknown as Record<string, unknown>;
  wrongEndpoint.generationEndpoint = "generate-flow-bootstrap-adaptation-v2";
  assert.equal((await readProviderFreeGenerationReadiness(response(200, body(wrongEndpoint)))).compatible, false);
  assert.equal((await readProviderFreeGenerationReadiness(response(200, body({ ...ready, extra: true })))).compatible, false);
  assert.equal((await readProviderFreeGenerationReadiness(response(503, body(ready)))).compatible, false);
  assert.equal((await readProviderFreeGenerationReadiness(response(200, "{"))).compatible, false);
  assert.equal((await readProviderFreeGenerationReadiness(response(200, "x".repeat(5000)))).compatible, false);
});

test("stale creation cleanup rejects only one exact pending Flow bootstrap proposal", async () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const control = {
    listFlowAdaptations: async (...args: unknown[]) => { calls.push({ method: "list", args }); return [{ adaptationId: "adaptation.pending", projectId: "project.one", flowId: "flow.one", status: "proposed" }]; },
    getFlowAdaptation: async (...args: unknown[]) => { calls.push({ method: "get", args }); return { adaptationId: "adaptation.pending", projectId: "project.one", flowId: "flow.one", status: "proposed", adaptationKind: "flow_bootstrap" }; },
    rejectFlowAdaptation: async (...args: unknown[]) => { calls.push({ method: "reject", args }); return { adaptationId: "adaptation.pending", projectId: "project.one", flowId: "flow.one", status: "rejected", adaptationKind: "flow_bootstrap" }; },
  };
  assert.equal(await rejectStalePendingCreationAdaptation(control as never, "project.one", "flow.one", "test-pin"), 1);
  assert.deepEqual(calls, [
    { method: "list", args: ["project.one", "flow.one", "proposed"] },
    { method: "get", args: ["project.one", "flow.one", "adaptation.pending"] },
    { method: "reject", args: [{ projectId: "project.one", flowId: "flow.one", adaptationId: "adaptation.pending", authorizationPin: "test-pin", reason: "Testing Lab stale pending creation cleanup" }] },
  ]);
});

test("stale creation cleanup is a no-op when clear and fails closed on ambiguity or another adaptation kind", async () => {
  const clear = { listFlowAdaptations: async () => [], getFlowAdaptation: async () => { throw new Error("unreachable"); }, rejectFlowAdaptation: async () => { throw new Error("unreachable"); } };
  assert.equal(await rejectStalePendingCreationAdaptation(clear as never, "project.one", "flow.one", "test-pin"), 0);
  const ambiguous = { ...clear, listFlowAdaptations: async () => [{}, {}] };
  await assert.rejects(() => rejectStalePendingCreationAdaptation(ambiguous as never, "project.one", "flow.one", "test-pin"), /at most one/);
  const wrongKind = {
    ...clear,
    listFlowAdaptations: async () => [{ adaptationId: "adaptation.pending" }],
    getFlowAdaptation: async () => ({ adaptationId: "adaptation.pending", status: "proposed", adaptationKind: "runtime_patch" }),
  };
  await assert.rejects(() => rejectStalePendingCreationAdaptation(wrongKind as never, "project.one", "flow.one", "test-pin"), /not a Flow bootstrap/);
});

test("readiness GET is the sole request and blocks the production UI/auth/generation path", async () => {
  const calls: Array<{ method: "GET"; url: string; options: unknown }> = [];
  const cookies: unknown[] = [];
  let uiCalls = 0;
  const diagnostics: unknown[][] = [];
  const incompatible = structuredClone(AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS);
  incompatible.supported = false;
  incompatible.runtime.providerResolverConfigured = false;
  const page = {
    url: () => "http://127.0.0.1:4310/programs/automation-studio",
    context: () => ({ addCookies: async (values: unknown[]) => { cookies.push(...values); } }),
    getByRole: () => { uiCalls += 1; throw new Error("Runtime Debug UI must remain unreachable"); },
    request: {
      get: async (url: string, options: unknown) => {
        calls.push({ method: "GET", url, options });
        return { ok: () => true, status: () => 200, text: async () => JSON.stringify({ ok: true, payload: { readiness: incompatible } }) };
      },
      post: async () => { throw new Error("Readiness must never use session-mutating POST transport"); },
    },
  };
  const evidence = {
    step: async (_surface: string, _id: string, _description: string, action: () => Promise<unknown>) => action(),
    diagnostic: async (...args: unknown[]) => { diagnostics.push(args); },
  };
  await assert.rejects(() => buildApproveApplyCreationViaUi({
    page: page as never,
    flowTreeItemId: "flow-tree.one",
    projectId: "project.one",
    flowId: "flow.one",
    pin: "unused",
    evidence: evidence as never,
    control: { sessionCookieValue: () => "current-session" } as never,
    blankContentHash: "blank.digest",
  }), /does not expose certified provider-free generation readiness/u);
  assert.equal(uiCalls, 0);
  assert.equal(diagnostics.length, 1);
  const diagnosticFacts = diagnostics[0]?.[3] as { responseBytes?: unknown } | undefined;
  assert.equal(typeof diagnosticFacts?.responseBytes, "number");
  assert.deepEqual(diagnostics[0], ["panel", "generation-readiness-rejected", "readiness.runtime-unavailable", {
    httpStatus: 200,
    responseBytes: diagnosticFacts?.responseBytes,
    responseParsed: true,
    supported: false,
    llmExecutionGrantsConfigured: true,
    providerResolverConfigured: false,
    nativeNodeRegistryConfigured: true,
  }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "GET");
  assert.deepEqual(cookies, [{ name: "fluxiq_session", value: "current-session", url: "http://127.0.0.1:4310" }]);
  assert.match(calls[0]!.url, /get-flow-bootstrap-generation-readiness\?domainId=web-automation$/u);
  assert.doesNotMatch(calls[0]!.url, /preflight-llm-execution|issue-llm-execution-grant|generate-flow-bootstrap-adaptation/u);
  assert.deepEqual(calls[0]!.options, { failOnStatusCode: false, timeout: 10_000 });
});
test("settings save failures retain only bounded stable diagnostics", async () => {
  const response = (status: number, body: string) => ({ status: () => status, headers: () => ({}), text: async () => body });
  const tokenFailure = await readSanitizedSettingsSaveFailure(response(400, JSON.stringify({ error: "LLM input and output limits exceed the total-token limit." })));
  assert.equal(tokenFailure.code, "settings-save.token-total");
  assert.equal(tokenFailure.parsed, true);
  assert.equal(tokenFailure.responseBytes <= 4096, true);
  assert.deepEqual({ both: tokenFailure.revisionBothParsed, relation: tokenFailure.revisionRelation, delta: tokenFailure.revisionAbsoluteDelta }, { both: false, relation: "unknown", delta: null });
  assert.equal((await readSanitizedSettingsSaveFailure(response(403, JSON.stringify({ error: "Security PIN rejected" })))).code, "settings-save.authorization");
  const conflict = await readSanitizedSettingsSaveFailure(response(409, JSON.stringify({ error: "FLOW_SAVE_CONFLICT: expected 1700000000000, current 1700000000007" })));
  assert.deepEqual(conflict, { status: 409, code: "settings-save.conflict", responseBytes: conflict.responseBytes, parsed: true, revisionBothParsed: true, revisionRelation: "expected_lt", revisionAbsoluteDelta: 7 });
  const reverseConflict = await readSanitizedSettingsSaveFailure(response(409, JSON.stringify({ error: "FLOW_SAVE_CONFLICT expected 9000000000000, current 1" })));
  assert.equal(reverseConflict.revisionRelation, "expected_gt");
  assert.equal(reverseConflict.revisionAbsoluteDelta, 1_000_000);
  const equalConflict = await readSanitizedSettingsSaveFailure(response(409, JSON.stringify({ error: "FLOW_SAVE_CONFLICT expected 42, current 42" })));
  assert.equal(equalConflict.revisionRelation, "expected_eq");
  assert.equal(equalConflict.revisionAbsoluteDelta, 0);
  const unknown = await readSanitizedSettingsSaveFailure(response(400, JSON.stringify({ error: "sensitive-opaque-value" })));
  assert.equal(unknown.code, "settings-save.http-400");
  assert.equal(JSON.stringify(unknown).includes("sensitive-opaque-value"), false);
  assert.deepEqual({ both: unknown.revisionBothParsed, relation: unknown.revisionRelation, delta: unknown.revisionAbsoluteDelta }, { both: false, relation: "unknown", delta: null });
  const malformedConflict = await readSanitizedSettingsSaveFailure(response(409, JSON.stringify({ error: "FLOW_SAVE_CONFLICT expected secret, current hidden" })));
  assert.equal(JSON.stringify(malformedConflict).includes("secret"), false);
  assert.deepEqual({ both: malformedConflict.revisionBothParsed, relation: malformedConflict.revisionRelation, delta: malformedConflict.revisionAbsoluteDelta }, { both: false, relation: "unknown", delta: null });
  const unreadable = await readSanitizedSettingsSaveFailure({ status: () => 503, headers: () => ({}), text: async () => { throw new Error("credential-shaped-sensitive-value"); } });
  assert.equal(JSON.stringify(unreadable).includes("credential-shaped-sensitive-value"), false);
  assert.equal(unreadable.revisionBothParsed, false);
  const oversized = await readSanitizedSettingsSaveFailure(response(500, "x".repeat(5000)));
  assert.deepEqual(oversized, { status: 500, code: "settings-save.http-500", responseBytes: 5000, parsed: false, revisionBothParsed: false, revisionRelation: "unknown", revisionAbsoluteDelta: null });
});
test("generation failures retain only Core-validated bounded diagnostics", async () => {
  const response = (status: number, body: string) => ({ status: () => status, headers: () => ({}), text: async () => body });
  const diagnostic = {
    code: "flow_bootstrap.provider_response_malformed",
    stage: "provider_output_validation",
    retryable: false,
    providerInvocation: "attempted",
    providerResponse: "received",
    accounting: {
      requestId: "request.one",
      estimatedInputTokens: 1200,
      provider: "deepseek",
      model: "deepseek-chat",
      providerStatus: 400,
      inputTokens: 900,
      outputTokens: 100,
      totalTokens: 1000,
      estimatedCostUsd: 0.001,
    },
  };
  const readiness = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.invalid_input).",
    payload: { diagnostic: {
      code: "flow_bootstrap.invalid_input",
      stage: "pre_provider_validation",
      retryable: false,
      providerInvocation: "not_attempted",
      providerResponse: "not_received",
    } },
  })));
  assert.deepEqual(readiness, {
    status: 400,
    code: "generation.pre-provider-validation",
    reasonCode: "flow_bootstrap.invalid_input",
    responseBytes: readiness.responseBytes,
    parsed: true,
    providerCallKnown: true,
    providerCallCount: 0,
    accountingKnown: true,
    accountingAvailable: false,
  });

  const known = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.provider_response_malformed).",
    payload: { diagnostic },
  })));
  assert.deepEqual(known, {
    status: 400,
    code: "generation.provider-output-validation",
    reasonCode: "flow_bootstrap.provider_response_malformed",
    responseBytes: known.responseBytes,
    parsed: true,
    providerCallKnown: true,
    providerCallCount: 1,
    accountingKnown: true,
    accountingAvailable: true,
    estimatedInputTokens: 1200,
    inputTokens: 900,
    outputTokens: 100,
    totalTokens: 1000,
  });

  const truncated = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.provider_output_truncated).",
    payload: { diagnostic: {
      ...diagnostic,
      code: "flow_bootstrap.provider_output_truncated",
    } },
  })));
  assert.deepEqual(truncated, {
    status: 400,
    code: "generation.provider-output-validation",
    reasonCode: "flow_bootstrap.provider_output_truncated",
    responseBytes: truncated.responseBytes,
    parsed: true,
    providerCallKnown: true,
    providerCallCount: 1,
    accountingKnown: true,
    accountingAvailable: true,
    estimatedInputTokens: 1200,
    inputTokens: 900,
    outputTokens: 100,
    totalTokens: 1000,
  });
  const paddingTruncated = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.provider_output_padding_truncated).",
    payload: { diagnostic: {
      ...diagnostic,
      code: "flow_bootstrap.provider_output_padding_truncated",
    } },
  })));
  assert.equal(paddingTruncated.code, "generation.provider-output-validation");
  assert.equal(paddingTruncated.reasonCode, "flow_bootstrap.provider_output_padding_truncated");
  assert.equal(paddingTruncated.parsed, true);
  assert.equal(paddingTruncated.providerCallCount, 1);
  assert.equal(paddingTruncated.estimatedInputTokens, 1200);
  assert.equal(paddingTruncated.inputTokens, 900);
  assert.equal(paddingTruncated.outputTokens, 100);
  assert.equal(paddingTruncated.totalTokens, 1000);

  const liveProviderRequestShape = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.provider_http_error).",
    payload: { diagnostic: {
      ...diagnostic,
      code: "flow_bootstrap.provider_http_error",
      stage: "provider_request",
      providerResponse: "received",
    } },
  })));
  assert.deepEqual(liveProviderRequestShape, {
    status: 400,
    code: "generation.provider-request",
    reasonCode: "flow_bootstrap.provider_http_error",
    responseBytes: liveProviderRequestShape.responseBytes,
    parsed: true,
    providerCallKnown: true,
    providerCallCount: 1,
    accountingKnown: true,
    accountingAvailable: true,
    estimatedInputTokens: 1200,
    inputTokens: 900,
    outputTokens: 100,
    totalTokens: 1000,
  });
  assert.equal(JSON.stringify(liveProviderRequestShape).includes("flow_bootstrap.provider_http_error"), true);
  const evidenceToolFailure = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.evidence_tool_failed).",
    payload: { diagnostic: {
      code: "flow_bootstrap.evidence_tool_failed",
      stage: "provider_output_validation",
      retryable: false,
      providerInvocation: "attempted",
      providerResponse: "received",
      evidenceLoop: { iterationCount: 2, decisionCount: 1, toolCallCount: 1, evidenceBytes: 1450, steps: [{ toolId: "web.inspect_current_page", effectApplied: false, resultCode: "web.inspect.succeeded" }] },
    } },
  })));
  assert.deepEqual(evidenceToolFailure.evidenceLoop, { iterationCount: 2, decisionCount: 1, toolCallCount: 1, evidenceBytes: 1450 });
  assert.deepEqual(evidenceToolFailure.evidenceSteps, [{ toolId: "web.inspect_current_page", effectApplied: false, resultCode: "web.inspect.succeeded" }]);
  assert.equal(JSON.stringify(evidenceToolFailure).includes("selector"), false);
  const unsafeEvidenceStep = await readSanitizedGenerationFailure(response(200, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.evidence_tool_failed).",
    payload: { diagnostic: {
      code: "flow_bootstrap.evidence_tool_failed", stage: "provider_output_validation", retryable: false,
      providerInvocation: "attempted", providerResponse: "received",
      evidenceLoop: { iterationCount: 2, decisionCount: 1, toolCallCount: 1, evidenceBytes: 1450, steps: [{ toolId: "web.inspect_current_page", input: { selector: "private-selector" } }] },
    } },
  })));
  assert.equal(unsafeEvidenceStep.parsed, false);
  assert.equal(JSON.stringify(unsafeEvidenceStep).includes("private-selector"), false);
  const preProviderDiagnostic = {
    code: "flow_bootstrap.pre_provider_validation_failed",
    stage: "pre_provider_validation",
    retryable: false,
    providerInvocation: "not_attempted",
    providerResponse: "not_received",
  };
  const preProvider = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.pre_provider_validation_failed).",
    payload: { diagnostic: preProviderDiagnostic },
  })));
  assert.equal(preProvider.code, "generation.pre-provider-validation");
  assert.equal(preProvider.providerCallKnown, true);
  assert.equal(preProvider.providerCallCount, 0);
  assert.equal(preProvider.accountingKnown, true);
  assert.equal(preProvider.accountingAvailable, false);
  assert.equal(preProvider.reasonCode, "flow_bootstrap.pre_provider_validation_failed");

  const stableReason = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (flow_bootstrap.active_instructions_required).",
    payload: { diagnostic: { ...preProviderDiagnostic, code: "flow_bootstrap.active_instructions_required" } },
  })));
  assert.equal(stableReason.code, "generation.pre-provider-validation");
  assert.equal(stableReason.reasonCode, "flow_bootstrap.active_instructions_required");

  const arbitraryCode = "flow_bootstrap.private_value";
  const unknownReason = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: `Flow Bootstrap generation failed (${arbitraryCode}).`,
    payload: { diagnostic: { ...preProviderDiagnostic, code: arbitraryCode } },
  })));
  assert.equal(unknownReason.parsed, false);
  assert.equal(unknownReason.code, "generation.http-400");
  assert.equal(unknownReason.reasonCode, null);
  assert.equal(JSON.stringify(unknownReason).includes(arbitraryCode), false);

  const wrongStageCode = "flow_bootstrap.provider_resolution_invalid";
  const wrongStage = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: `Flow Bootstrap generation failed (${wrongStageCode}).`,
    payload: { diagnostic: { ...preProviderDiagnostic, code: wrongStageCode } },
  })));
  assert.equal(wrongStage.parsed, false);
  assert.equal(wrongStage.code, "generation.http-400");
  assert.equal(wrongStage.reasonCode, null);
  assert.equal(JSON.stringify(wrongStage).includes(wrongStageCode), false);
  for (const unsafe of [
    { ok: false, error: "Flow Bootstrap generation failed (flow_bootstrap.provider_response_malformed).", payload: { diagnostic: { ...diagnostic, rawResponse: "private-response-value" } } },
    { ok: false, error: "private-prompt-value", payload: { diagnostic } },
    { ok: false, error: "Flow Bootstrap generation failed (flow_bootstrap.provider_response_malformed).", payload: { diagnostic }, rawPrompt: "private-prompt-value" },
    { ok: false, error: "Flow Bootstrap generation failed (flow_bootstrap.provider_response_malformed).", payload: { diagnostic: { ...diagnostic, accounting: { ...diagnostic.accounting, totalTokens: 50001 } } } },
  ]) {
    const rejected = await readSanitizedGenerationFailure(response(400, JSON.stringify(unsafe)));
    assert.equal(rejected.code, "generation.http-400");
    assert.equal(rejected.parsed, false);
    assert.equal(rejected.providerCallKnown, false);
    assert.equal(rejected.providerCallCount, 0);
    assert.equal(rejected.accountingKnown, false);
    assert.equal(JSON.stringify(rejected).includes("private"), false);
  }

  const unreadable = await readSanitizedGenerationFailure({ status: () => 503, headers: () => ({}), text: async () => { throw new Error("credential-shaped-sensitive-value"); } });
  assert.equal(unreadable.code, "generation.http-503");
  assert.equal(unreadable.parsed, false);
  assert.equal(JSON.stringify(unreadable).includes("credential-shaped-sensitive-value"), false);
  const oversized = await readSanitizedGenerationFailure(response(500, "x".repeat(5000)));
  assert.deepEqual(oversized, {
    status: 500,
    code: "generation.http-500",
    reasonCode: null,
    responseBytes: 5000,
    parsed: false,
    providerCallKnown: false,
    providerCallCount: 0,
    accountingKnown: false,
    accountingAvailable: false,
  });
});
test("applied topology inspector accepts registered structural nodes around executable actions", async () => {
  const flow = (flowId: string, nodes: unknown[] = [], edges: unknown[] = []) => ({ flowId, projectId: "project.one", name: flowId, updatedAt: 1, contentHash: "hash." + flowId, document: { nodes, edges, metadata: { flowRepresentationKind: flowId === "flow.one" ? "orchestration" : "subflow" } } });
  const control = {
    listFlowSubflows: async () => [{ projectId: "project.one", flowId: "flow.one", subflowId: "subflow.one", graphFlowId: "graph.one", name: "Generated", status: "active", role: "primary" }],
    getFlowRouter: async () => ({ routerId: "router.one", projectId: "project.one", flowId: "flow.one", fallback: { kind: "subflow", subflowId: "subflow.one" }, rules: [] }),
    getExactFlow: async (_projectId: string, flowId: string) => flowId === "graph.one" ? flow(flowId, [{ nodeId: "node.start", definitionId: "builtin.control.start" }, { nodeId: "node.one", definitionId: "web.fill" }, { nodeId: "node.end", definitionId: "builtin.control.end" }], [{ edgeId: "edge.one" }, { edgeId: "edge.two" }]) : flow(flowId),
    getFlowGraphViewport: async () => ({ graphRevision: 1, nodes: [{ nodeId: "node.start", x: 0, y: 0 }, { nodeId: "node.one", x: 300, y: 0 }, { nodeId: "node.end", x: 600, y: 0 }], edgeIds: ["edge.one", "edge.two"], nodeCount: 3, edgeCount: 2 }),
    listNativeNodeDefinitions: async () => [{ id: "web.fill", version: "1", sourceKind: "importer", executable: true, externalSideEffect: false }],
  };
  const result = await inspectAppliedCreation(control as never, "project.one", "flow.one", "base.digest", "result.digest");
  assert.equal(result.ownedSubflowId, "subflow.one");
  assert.equal(result.executableNodeCount, 1);
  assert.equal(result.overlappingPositionCount, 0);
});

test("applied topology inspector rejects overlapping generated nodes", async () => {
  const control = {
    listFlowSubflows: async () => [{ projectId: "project.one", flowId: "flow.one", subflowId: "subflow.one", graphFlowId: "graph.one", name: "Generated", status: "active", role: "primary" }],
    getFlowRouter: async () => ({ routerId: "router.one", projectId: "project.one", flowId: "flow.one", fallback: { kind: "subflow", subflowId: "subflow.one" }, rules: [] }),
    getExactFlow: async (_projectId: string, flowId: string) => ({ flowId, projectId: "project.one", name: flowId, updatedAt: 1, contentHash: "hash." + flowId, document: { nodes: flowId === "graph.one" ? [{ nodeId: "one", definitionId: "web.click" }, { nodeId: "two", definitionId: "web.click" }] : [], edges: flowId === "graph.one" ? [{ edgeId: "edge" }] : [], metadata: {} } }),
    getFlowGraphViewport: async () => ({ graphRevision: 1, nodes: [{ nodeId: "one", x: 0, y: 0 }, { nodeId: "two", x: 10, y: 10 }], edgeIds: ["edge"], nodeCount: 2, edgeCount: 1 }),
    listNativeNodeDefinitions: async () => [{ id: "web.click", version: "1", sourceKind: "importer", executable: true, externalSideEffect: false }],
  };
  await assert.rejects(() => inspectAppliedCreation(control as never, "project.one", "flow.one", "base.digest", "result.digest"), /positions overlap/u);
});
test("canonical apply digest requires exact sanitized Core bootstrap binding", () => {
  const body = { ok: true, payload: { adaptation: { metadata: { adaptationKind: "flow_bootstrap", bootstrap: { baseExecutionDigest: "base.digest", currentExecutionDigest: "result.digest", baseSettingsRevision: 1, currentSettingsRevision: 2, application: { appliedExecutionDigest: "result.digest" } } } } } };
  assert.equal(parseAppliedExecutionDigest(body, true, "base.digest"), "result.digest");
  assert.throws(() => parseAppliedExecutionDigest({ ...body, payload: { adaptation: { metadata: { adaptationKind: "flow_bootstrap", bootstrap: { ...body.payload.adaptation.metadata.bootstrap, currentSettingsRevision: 1 } } } } }, true, "base.digest"), /advance the Core settings revision/u);
  assert.throws(() => parseAppliedExecutionDigest({ ...body, payload: { adaptation: { metadata: { adaptationKind: "flow_bootstrap", bootstrap: { ...body.payload.adaptation.metadata.bootstrap, currentExecutionDigest: "other.digest" } } } } }, true, "base.digest"), /exact changed canonical Core execution binding/u);
  assert.throws(() => parseAppliedExecutionDigest({ ok: true, payload: { adaptation: { metadata: { adaptationKind: "flow_bootstrap", bootstrap: { baseExecutionDigest: "base.digest", currentExecutionDigest: "result.digest" } } } } }, true, "base.digest"), /malformed/u);
});
