// The gate in front of the one paid Flow bootstrap call, and the driver that
// has to pass through it. Three rows, one premise: nothing reaches the
// provider until a GET on the live readiness endpoint returns the exact
// certified contract. The parser row fixes what "exact" means, the driver row
// pins the order the seams run in, and the last row is the negative control --
// an incompatible readiness must leave the production UI, auth and generation
// path untouched, so it asserts the request count and that the UI was never
// reached at all.

import assert from "node:assert/strict";
import test from "node:test";
import { FIRST_LIVE_CREATION_LIMITS, buildApproveApplyCreationViaUi, readProviderFreeGenerationReadiness } from "../index.js";
import { readCreateUiBuildOutput } from "./module-source.js";
import { TESTING_LAB_DEEPSEEK_KEY_NAME } from "../../secret-keys-ui.js";
import { AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS } from "fluxiq/automation-studio";

test("Phase 3 UI driver pins exact one-call limits and explicit review actions", async () => {
  assert.deepEqual(FIRST_LIVE_CREATION_LIMITS, { provider: "deepseek", model: "deepseek-chat", maxInputTokens: 4000, maxOutputTokens: 1000, maxTotalTokens: 5000, maxCalls: 1, timeoutSeconds: 20, maxEstimatedCostUsd: 0.25, providerRetries: 0 });
  const source = await readCreateUiBuildOutput();
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
