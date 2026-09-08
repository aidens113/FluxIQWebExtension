import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { FIRST_LIVE_CREATION_LIMITS, buildApproveApplyCreationViaUi, inspectAppliedCreation, parseAppliedExecutionDigest, readProviderFreeGenerationReadiness, readSanitizedGenerationFailure, readSanitizedSettingsSaveFailure } from "./demo-llm-create-ui.js";
import { TESTING_LAB_DEEPSEEK_KEY_NAME } from "./secret-keys-ui.js";
import { AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS } from "fluxiq/automation-studio";

const root = path.resolve(import.meta.dirname, "..", "..", "..");

test("Phase 3 launcher strips provider secrets and never loads a provider key", async () => {
  const source = await readFile(path.join(root, "scripts", "run-demo-llm-creation.mjs"), "utf8");
  assert.match(source, /withoutProviderSecrets\(process\.env\)/u);
  assert.match(source, /runDemoLlmCreation/u);
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
test("Phase 3 UI driver pins exact one-call limits and explicit review actions", async () => {
  assert.deepEqual(FIRST_LIVE_CREATION_LIMITS, { provider: "deepseek", model: "deepseek-chat", maxInputTokens: 2000, maxOutputTokens: 512, maxTotalTokens: 3000, maxCalls: 1, timeoutSeconds: 20, maxEstimatedCostUsd: 0.25, providerRetries: 0 });
  const source = await readFile(new URL("./demo-llm-create-ui.js", import.meta.url), "utf8");
  for (const seam of ["Build Flow from instructions", "Authorize Flow Build", "Authorize One Build", "Approve Adaptation", "Apply Adaptation", "Apply Changes", "Flow mutated before explicit human approval"]) assert.match(source, new RegExp(seam));
  assert.equal(TESTING_LAB_DEEPSEEK_KEY_NAME, "FluxIQ Testing Lab DeepSeek");
  assert.match(source, /if \(await key\.inputValue\(\) !== TESTING_LAB_DEEPSEEK_KEY_NAME\)/u);
  assert.match(source, /key\.fill\(TESTING_LAB_DEEPSEEK_KEY_NAME\)/u);
  assert.match(source, /escapeRegExp\(TESTING_LAB_DEEPSEEK_KEY_NAME\)/u);
  assert.match(source, /exact stored Testing Lab DeepSeek key was not selected/u);
  assert.doesNotMatch(source, /key\.fill\("Testing Lab DeepSeek"\)/u);
  assert.doesNotMatch(source, /rawPrompt|rawResponse|DEEPSEEK_API_KEY|recordDemoWorkspace/u);
  const readinessGate = source.indexOf("assertProviderFreeGenerationReadiness(input.page, input.evidence)");
  const runtimeOpen = source.indexOf("create-runtime-search");
  const paidAuthorization = source.indexOf("Authorize exactly one bounded Flow bootstrap call");
  assert.equal(readinessGate >= 0 && runtimeOpen > readinessGate && paidAuthorization > runtimeOpen, true);
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

test("readiness GET is the sole request and blocks the production UI/auth/generation path", async () => {
  const calls: Array<{ method: "GET"; url: string; options: unknown }> = [];
  let uiCalls = 0;
  const diagnostics: unknown[][] = [];
  const incompatible = structuredClone(AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS);
  incompatible.supported = false;
  incompatible.runtime.providerResolverConfigured = false;
  const page = {
    url: () => "http://127.0.0.1:4310/programs/automation-studio",
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
    password: "unused",
    pin: "unused",
    evidence: evidence as never,
    control: {} as never,
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
    code: "llm.provider_malformed_response",
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
    error: "Flow bootstrap generation request contains unsupported fields.",
    payload: { diagnostic: {
      code: "flow_bootstrap.unsupported_request_field",
      stage: "pre_provider_validation",
      retryable: false,
      providerInvocation: "not_attempted",
      providerResponse: "not_received",
    } },
  })));
  assert.deepEqual(readiness, {
    status: 400,
    code: "generation.pre-provider-validation",
    reasonCode: null,
    responseBytes: readiness.responseBytes,
    parsed: true,
    providerCallKnown: true,
    providerCallCount: 0,
    accountingKnown: true,
    accountingAvailable: false,
  });

  const known = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (llm.provider_malformed_response).",
    payload: { diagnostic },
  })));
  assert.deepEqual(known, {
    status: 400,
    code: "generation.provider-output-validation",
    reasonCode: null,
    responseBytes: known.responseBytes,
    parsed: true,
    providerCallKnown: true,
    providerCallCount: 1,
    accountingKnown: true,
    accountingAvailable: true,
  });

  const liveProviderRequestShape = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (llm.provider_http_error).",
    payload: { diagnostic: {
      ...diagnostic,
      code: "llm.provider_http_error",
      stage: "provider_request",
      providerResponse: "received",
    } },
  })));
  assert.deepEqual(liveProviderRequestShape, {
    status: 400,
    code: "generation.provider-request",
    reasonCode: null,
    responseBytes: liveProviderRequestShape.responseBytes,
    parsed: true,
    providerCallKnown: true,
    providerCallCount: 1,
    accountingKnown: true,
    accountingAvailable: true,
  });
  assert.equal(JSON.stringify(liveProviderRequestShape).includes("llm.provider_http_error"), false);
  const preProviderDiagnostic = {
    code: "bootstrap.active_instruction_required",
    stage: "pre_provider_validation",
    retryable: false,
    providerInvocation: "not_attempted",
    providerResponse: "not_received",
  };
  const preProvider = await readSanitizedGenerationFailure(response(400, JSON.stringify({
    ok: false,
    error: "Flow Bootstrap generation failed (bootstrap.active_instruction_required).",
    payload: { diagnostic: preProviderDiagnostic },
  })));
  assert.equal(preProvider.code, "generation.pre-provider-validation");
  assert.equal(preProvider.providerCallKnown, true);
  assert.equal(preProvider.providerCallCount, 0);
  assert.equal(preProvider.accountingKnown, true);
  assert.equal(preProvider.accountingAvailable, false);

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
  assert.equal(unknownReason.parsed, true);
  assert.equal(unknownReason.code, "generation.pre-provider-validation");
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
    { ok: false, error: "Flow Bootstrap generation failed (llm.provider_malformed_response).", payload: { diagnostic: { ...diagnostic, rawResponse: "private-response-value" } } },
    { ok: false, error: "private-prompt-value", payload: { diagnostic } },
    { ok: false, error: "Flow Bootstrap generation failed (llm.provider_malformed_response).", payload: { diagnostic }, rawPrompt: "private-prompt-value" },
    { ok: false, error: "Flow Bootstrap generation failed (llm.provider_malformed_response).", payload: { diagnostic: { ...diagnostic, accounting: { ...diagnostic.accounting, totalTokens: 50001 } } } },
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
test("applied topology inspector accepts one executable non-overlapping owned route", async () => {
  const flow = (flowId: string, nodes: unknown[] = [], edges: unknown[] = []) => ({ flowId, projectId: "project.one", name: flowId, updatedAt: 1, contentHash: "hash." + flowId, document: { nodes, edges, metadata: { flowRepresentationKind: flowId === "flow.one" ? "orchestration" : "subflow" } } });
  const control = {
    listFlowSubflows: async () => [{ projectId: "project.one", flowId: "flow.one", subflowId: "subflow.one", graphFlowId: "graph.one", name: "Generated", status: "active", role: "primary" }],
    getFlowRouter: async () => ({ routerId: "router.one", projectId: "project.one", flowId: "flow.one", fallback: { kind: "subflow", subflowId: "subflow.one" }, rules: [] }),
    getExactFlow: async (_projectId: string, flowId: string) => flowId === "graph.one" ? flow(flowId, [{ nodeId: "node.one", definitionId: "web.fill" }, { nodeId: "node.two", definitionId: "web.click" }], [{ edgeId: "edge.one" }]) : flow(flowId),
    getFlowGraphViewport: async () => ({ graphRevision: 1, nodes: [{ nodeId: "node.one", x: 0, y: 0 }, { nodeId: "node.two", x: 300, y: 0 }], edgeIds: ["edge.one"], nodeCount: 2, edgeCount: 1 }),
    listNativeNodeDefinitions: async () => [{ id: "web.fill", version: "1", sourceKind: "importer", executable: true, externalSideEffect: false }, { id: "web.click", version: "1", sourceKind: "importer", executable: true, externalSideEffect: false }],
  };
  const result = await inspectAppliedCreation(control as never, "project.one", "flow.one", "base.digest", "result.digest");
  assert.equal(result.ownedSubflowId, "subflow.one");
  assert.equal(result.executableNodeCount, 2);
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
  const body = { ok: true, payload: { adaptation: { metadata: { adaptationKind: "flow_bootstrap", bootstrap: { baseExecutionDigest: "base.digest", currentExecutionDigest: "result.digest", baseSettingsRevision: 1, currentSettingsRevision: 1, application: { appliedExecutionDigest: "result.digest" } } } } } };
  assert.equal(parseAppliedExecutionDigest(body, true, "base.digest"), "result.digest");
  assert.throws(() => parseAppliedExecutionDigest({ ...body, payload: { adaptation: { metadata: { adaptationKind: "flow_bootstrap", bootstrap: { ...body.payload.adaptation.metadata.bootstrap, currentExecutionDigest: "other.digest" } } } } }, true, "base.digest"), /exact changed canonical Core execution binding/u);
  assert.throws(() => parseAppliedExecutionDigest({ ok: true, payload: { adaptation: { metadata: { adaptationKind: "flow_bootstrap", bootstrap: { baseExecutionDigest: "base.digest", currentExecutionDigest: "result.digest" } } } } }, true, "base.digest"), /malformed/u);
});
