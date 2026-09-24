import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_MODEL, LLM_LAB_MAX_CALLS_PER_RUN } from "@fluxiq-web-extension/test-contracts";
import { ExistingFluxIQControlClient } from "../existing-fluxiq-control.js";
import type { PersistedFlowLlmExecution } from "../flow-lane/index.js";

const origin = "https://panel.example.test";
const credentials = { username: "runner", password: "password-value", totp: "123456", pin: "654321" };

function json(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json", ...headers } });
}

async function mockedClient(t: test.TestContext, handler: (url: URL, init: RequestInit) => Response | Promise<Response>): Promise<ExistingFluxIQControlClient> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/auth/login") return json({ ok: true }, 200, { "set-cookie": "fluxiq_session=opaque; Max-Age=3600" });
    return handler(url, init);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const client = new ExistingFluxIQControlClient(origin);
  await client.login(credentials);
  return client;
}

const endpoint = (url: URL): string => url.pathname.split("/").at(-1)!;
const project = { id: "project.web", name: "Web", description: "Existing project", domainId: "web-automation", createdAt: 1, updatedAt: 2 };
const flowSummary = { flowId: "flow.main", name: "Main", sourceMode: "visual", nodeCount: 2, edgeCount: 1, updatedAt: 4, version: "3" };
const flow = { schemaVersion: "0.1", flowId: "flow.main", projectId: "project.web", name: "Main", scope: { kind: "project" }, nodes: [{ id: "one" }, { id: "two" }], edges: [{ id: "edge" }], createdAt: 3, updatedAt: 4 };
const session = { schemaVersion: "0.1", runId: "run.one", projectId: "project.web", targetKind: "flow", targetId: "flow.main", flowId: "flow.main", status: "succeeded", queuedAt: 10 };
const summary = { schemaVersion: "0.1", runId: "run.one", projectId: "project.web", flowId: "flow.main", status: "succeeded", updatedAt: 20, actionAttemptCount: 1, routeDecisionCount: 0, subflowEntryCount: 0, interventionCount: 0, adaptationCount: 0 };
const action = { attemptId: "attempt.one", nodeId: "node.one", definitionId: "web.dom.type", order: 0, status: "succeeded", startedAt: 11, finishedAt: 12, message: "done" };
const event = { sequence: 1, eventId: "event.one", eventKind: "action_attempt", timestampMs: 12, title: "Action settled", status: "succeeded", entityId: "attempt.one", payload: { secret: "must-not-be-returned" } };

test("validates the current account when the session endpoint exists and fails closed on mismatch", async (t) => {
  const client = await mockedClient(t, url => url.pathname === "/api/auth/session"
    ? json({ ok: true, payload: { user: { id: "user.one", username: "runner" } } })
    : json({ ok: true, payload: { categories: [], projects: [] } }));
  assert.deepEqual(await client.validateCurrentSession("runner"), { identityEndpointAvailable: true, username: "runner" });
  await assert.rejects(() => client.validateCurrentSession("another-user"), /does not match/);
});

test("falls back to an authenticated projects preflight only when the session endpoint is unavailable", async (t) => {
  const paths: string[] = [];
  const client = await mockedClient(t, url => {
    paths.push(url.pathname);
    if (url.pathname === "/api/auth/session") return json({ ok: false }, 404);
    return json({ ok: true, payload: { categories: [], projects: [project] } });
  });
  assert.deepEqual(await client.validateCurrentSession("runner"), { identityEndpointAvailable: false });
  assert.deepEqual(paths, ["/api/auth/session", "/api/programs/automation-studio/projects"]);
});

test("requires exact project and Flow identity and returns a stable content hash", async (t) => {
  const projectQueries: Array<string | null> = [];
  const client = await mockedClient(t, url => {
    if (endpoint(url) === "projects") { projectQueries.push(url.searchParams.get("domainId")); return json({ ok: true, payload: { categories: [], projects: [project] } }); }
    if (endpoint(url) === "list-flow-summaries") return json({ ok: true, payload: { flows: [flowSummary] } });
    if (endpoint(url) === "get-flow") return json({ ok: true, payload: { flow } });
    throw new Error(`unexpected ${url.pathname}`);
  });
  assert.equal((await client.requireProject("project.web", "web-automation")).domainId, "web-automation");
  assert.deepEqual(projectQueries, ["web-automation"]);
  assert.equal((await client.listFlowSummaries("project.web"))[0]?.flowId, "flow.main");
  const exact = await client.getExactFlow("project.web", "flow.main");
  assert.match(exact.contentHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(exact.document, flow);
  await assert.rejects(() => client.requireProject("missing"), /exactly one/);
  await assert.rejects(() => client.getExactFlow("project.web", "different"), /outside the requested/);
});

test("reads graph counts and applies a bounded graph patch through public Automation Studio endpoints", async (t) => {
  const requests: Array<{ endpoint: string; body: Record<string, unknown> }> = [];
  const client = await mockedClient(t, (url, init) => {
    const body = JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>;
    requests.push({ endpoint: endpoint(url), body });
    if (endpoint(url) === "get-graph-viewport") {
      return json({ ok: true, payload: { page: { graphRevision: 7, nodes: [{ nodeId: "one", x: 0, y: 10 }, { nodeId: "two", x: 360, y: 10 }], edges: [{ edgeId: "edge" }], internal: "discard-me" } } });
    }
    if (endpoint(url) === "apply-graph-patch") return json({ ok: true, payload: { graphRevision: 8, internal: "discard-me" } });
    throw new Error(`unexpected ${url.pathname}`);
  });

  assert.deepEqual(await client.getFlowGraphViewport("project.web", "flow.main"), {
    graphRevision: 7,
    nodes: [{ nodeId: "one", x: 0, y: 10 }, { nodeId: "two", x: 360, y: 10 }],
    edgeIds: ["edge"],
    nodeCount: 2,
    edgeCount: 1,
  });
  await client.applyFlowGraphPatch({
    projectId: "project.web",
    flowId: "flow.main",
    baseRevision: 7,
    mutationId: "demo-fixture-sync",
    operations: [{ kind: "add-node", node: { id: "one" } }],
    authorizationPin: "test-pin",
  });

  assert.equal(requests[0]?.endpoint, "get-graph-viewport");
  assert.deepEqual(requests[1], {
    endpoint: "apply-graph-patch",
    body: {
      projectId: "project.web",
      flowId: "flow.main",
      baseRevision: 7,
      mutationId: "demo-fixture-sync",
      operations: [{ kind: "add-node", node: { id: "one" } }],
      authorizationPin: "test-pin",
    },
  });
});

test("reads the persisted parent, Subflow graph, and Router ownership boundary", async (t) => {
  const client = await mockedClient(t, url => {
    if (endpoint(url) === "list-flow-subflows") return json({ ok: true, payload: { subflows: [{ projectId: "project.web", flowId: "flow.main", subflowId: "subflow.primary", graphFlowId: "flow.graph", name: "Primary", status: "active", role: "primary" }] } });
    if (endpoint(url) === "get-flow-router") return json({ ok: true, payload: { router: { routerId: "router.main", projectId: "project.web", flowId: "flow.main", rules: [], fallback: { kind: "subflow", subflowId: "subflow.primary" } } } });
    throw new Error(`unexpected ${url.pathname}`);
  });
  assert.equal((await client.listFlowSubflows("project.web", "flow.main"))[0]?.graphFlowId, "flow.graph");
  assert.deepEqual((await client.getFlowRouter("project.web", "flow.main"))?.fallback, { kind: "subflow", subflowId: "subflow.primary" });
});

test("lists, inspects, and rejects one exactly scoped Flow adaptation", async (t) => {
  const requests: Array<{ endpoint: string; body: Record<string, unknown> }> = [];
  const adaptation = { adaptationId: "adaptation.pending", projectId: "project.web", flowId: "flow.main", subflowId: "subflow.primary", sourceRunId: "run.failed", status: "proposed", riskLevel: "low", patch: [{ kind: "edit_action_target", value: "discard-me" }], validationResults: [{ runId: "run.failed", status: "succeeded", detail: "discard-me" }], appliedTo: [{ kind: "action_target", id: "discard-me" }], metadata: { adaptationKind: "flow_bootstrap", privateValue: "discard-me", bootstrap: { accounting: { provider: "deepseek", model: DEFAULT_LLM_MODEL, inputTokens: 10, outputTokens: 5, totalTokens: 15, estimatedCostUsd: 0.001, raw: "discard-me" } }, phase9: { auditEvents: [{ eventType: "created", detail: { evidenceGuided: true, iterationCount: 3, traceStepCount: 3, providerCallCount: 2, decisionCount: 2, toolCallCount: 2, evidenceBytes: 1200, toolIds: ["web.capture_snapshot"], raw: "discard-me" } }] } } };
  const client = await mockedClient(t, (url, init) => {
    const body = JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>;
    requests.push({ endpoint: endpoint(url), body });
    if (endpoint(url) === "list-flow-adaptations") return json({ ok: true, payload: { adaptations: [adaptation], page: { adaptations: [adaptation], total: 1, limit: 100, offset: 0 } } });
    if (endpoint(url) === "get-flow-adaptation") return json({ ok: true, payload: { adaptation } });
    if (endpoint(url) === "review-flow-adaptation") return json({ ok: true, payload: { adaptation: { ...adaptation, status: body.action === "revert" ? "reverted" : body.action === "approve" ? "validated" : body.action === "apply" ? "applied" : "rejected" } } });
    throw new Error(`unexpected ${url.pathname}`);
  });

  assert.deepEqual(await client.listFlowAdaptations("project.web", "flow.main", "proposed"), [{ adaptationId: "adaptation.pending", projectId: "project.web", flowId: "flow.main", status: "proposed" }]);
  assert.deepEqual(await client.getFlowAdaptation("project.web", "flow.main", "adaptation.pending"), { adaptationId: "adaptation.pending", projectId: "project.web", flowId: "flow.main", status: "proposed", adaptationKind: "flow_bootstrap", subflowId: "subflow.primary", sourceRunId: "run.failed", riskLevel: "low", patchKinds: ["edit_action_target"], validationSucceededCount: 1, validationFailedCount: 0, appliedMutationCount: 1, accounting: { provider: "deepseek", model: DEFAULT_LLM_MODEL, inputTokens: 10, outputTokens: 5, totalTokens: 15, estimatedCostUsd: 0.001 }, evidenceLoop: { providerCallCount: 2, decisionCount: 2, traceStepCount: 3, iterationCount: 3, toolCallCount: 2, evidenceBytes: 1200, toolIds: ["web.capture_snapshot"] } });
  assert.equal((await client.rejectFlowAdaptation({ projectId: "project.web", flowId: "flow.main", adaptationId: "adaptation.pending", authorizationPin: "test-pin", reason: "Testing Lab cleanup" })).status, "rejected");
  assert.equal((await client.approveFlowAdaptation({ projectId: "project.web", flowId: "flow.main", adaptationId: "adaptation.pending", authorizationPin: "test-pin" })).status, "validated");
  assert.equal((await client.applyFlowAdaptation({ projectId: "project.web", flowId: "flow.main", adaptationId: "adaptation.pending", authorizationPin: "test-pin" })).status, "applied");
  assert.equal((await client.revertFlowAdaptation({ projectId: "project.web", flowId: "flow.main", adaptationId: "adaptation.pending", authorizationPin: "test-pin", reason: "Testing Lab repair" })).status, "reverted");
  assert.deepEqual(requests.map(item => item.endpoint), ["list-flow-adaptations", "get-flow-adaptation", "review-flow-adaptation", "review-flow-adaptation", "review-flow-adaptation", "review-flow-adaptation"]);
  assert.deepEqual(requests[2]?.body, { projectId: "project.web", flowId: "flow.main", adaptationId: "adaptation.pending", authorizationPin: "test-pin", reason: "Testing Lab cleanup", action: "reject" });
  assert.deepEqual(requests[3]?.body, { projectId: "project.web", flowId: "flow.main", adaptationId: "adaptation.pending", authorizationPin: "test-pin", action: "approve" });
  assert.deepEqual(requests[4]?.body, { projectId: "project.web", flowId: "flow.main", adaptationId: "adaptation.pending", authorizationPin: "test-pin", action: "apply" });
  assert.deepEqual(requests[5]?.body, { projectId: "project.web", flowId: "flow.main", adaptationId: "adaptation.pending", authorizationPin: "test-pin", reason: "Testing Lab repair", action: "revert" });
});

test("keeps a legacy evidence audit reviewable without inferring provider calls from trace length", async (t) => {
  const adaptation = {
    adaptationId: "adaptation.pending",
    projectId: "project.web",
    flowId: "flow.main",
    status: "proposed",
    metadata: {
      adaptationKind: "flow_bootstrap",
      phase9: { auditEvents: [{ eventType: "created", detail: { evidenceGuided: true, iterationCount: 2, toolCallCount: 1, evidenceBytes: 100, toolIds: ["web.inspect_current_page"] } }] }
    }
  };
  const client = await mockedClient(t, url => endpoint(url) === "get-flow-adaptation"
    ? json({ ok: true, payload: { adaptation } })
    : (() => { throw new Error(`unexpected ${url.pathname}`); })());

  const parsed = await client.getFlowAdaptation("project.web", "flow.main", "adaptation.pending");
  assert.deepEqual(parsed.evidenceLoop, {
    iterationCount: 2,
    toolCallCount: 1,
    evidenceBytes: 100,
    toolIds: ["web.inspect_current_page"]
  });
  assert.equal(parsed.evidenceLoop?.providerCallCount, undefined);
});

test("Flow adaptation controls fail closed on cross-scope and non-rejected responses", async (t) => {
  const client = await mockedClient(t, url => {
    if (endpoint(url) === "list-flow-adaptations") return json({ ok: true, payload: { adaptations: [{ adaptationId: "adaptation.foreign", projectId: "project.other", flowId: "flow.main", status: "proposed" }], page: { total: 1 } } });
    if (endpoint(url) === "review-flow-adaptation") return json({ ok: true, payload: { adaptation: { adaptationId: "adaptation.pending", projectId: "project.web", flowId: "flow.main", status: "proposed", metadata: { adaptationKind: "flow_bootstrap" } } } });
    throw new Error(`unexpected ${url.pathname}`);
  });
  await assert.rejects(() => client.listFlowAdaptations("project.web", "flow.main", "proposed"), /escaped the requested parent Flow/);
  await assert.rejects(() => client.rejectFlowAdaptation({ projectId: "project.web", flowId: "flow.main", adaptationId: "adaptation.pending", authorizationPin: "test-pin", reason: "cleanup" }), /did not reject/);
});

test("Flow adaptation listing rejects a truncated bounded page", async (t) => {
  const client = await mockedClient(t, url => endpoint(url) === "list-flow-adaptations"
    ? json({ ok: true, payload: { adaptations: [{ adaptationId: "adaptation.pending", projectId: "project.web", flowId: "flow.main", status: "proposed" }], page: { total: 2 } } })
    : (() => { throw new Error(`unexpected ${url.pathname}`); })());
  await assert.rejects(() => client.listFlowAdaptations("project.web", "flow.main", "proposed"), /not a complete bounded page/);
});

test("uses only the explicit authorized Core seam for legacy representation migration", async (t) => {
  let request: { endpoint: string; body: Record<string, unknown> } | undefined;
  const client = await mockedClient(t, (url, init) => {
    request = { endpoint: endpoint(url), body: JSON.parse(String(init.body ?? "{}")) as Record<string, unknown> };
    return json({ ok: true, payload: { parentFlow: { flowId: "flow.main" }, subflow: { subflowId: "subflow.primary" }, graphFlow: { flowId: "flow.graph" } } });
  });
  await client.migrateLegacyFlowRepresentation({ projectId: "project.web", flowId: "flow.main", subflowId: "subflow.primary", authorizationPin: "test-pin" });
  assert.deepEqual(request, { endpoint: "migrate-legacy-flow-representation", body: { projectId: "project.web", flowId: "flow.main", subflowId: "subflow.primary", authorizationPin: "test-pin" } });
});
test("reads a sanitized dependency and node-definition inventory", async (t) => {
  const client = await mockedClient(t, url => {
    if (endpoint(url) === "inspect-flow-dependencies") return json({ ok: true, payload: {
      dependencies: [{ publicationId: "pub.one", projectId: "project.web", flowId: "flow.child", version: "1.0.0", status: "published", snapshot: { flowDigest: "a".repeat(64), requiredRuntimeCapabilities: ["web.browser"] }, secret: "discard-me" }],
      usedBy: [{ projectId: "project.web", flowId: "flow.parent", flowName: "Parent", version: "1.0.0", nodeId: "call.one" }],
      availableUpgrades: [{ nodeId: "call.child", flowId: "flow.child", currentVersion: "1.0.0", versions: ["1.1.0"] }],
    } });
    if (endpoint(url) === "list-native-node-definitions") return json({ ok: true, payload: { nodes: [
      { id: "builtin.control.start", version: "1.0.0", source: { kind: "builtin", implementationKey: "start" }, capabilities: { executable: true } },
      { id: "web.dom.type", version: "1.0.0", source: { kind: "importer", domainId: "web-automation", implementationKey: "web.dom.type", privateState: "discard-me" }, capabilities: { executable: true }, parameters: [{ secret: "discard-me" }] },
      { id: "custom.network", version: "1.0.0", source: { kind: "code", moduleId: "./local.ts", implementationKey: "network", trust: "trusted-local" }, capabilities: { executable: true }, safety: { runtime: { networkDestinations: ["https://api.example.test"], secretHandles: ["secret-ref"] } } },
      { id: "flow.child", version: "1.0.0", source: { kind: "composite", flowId: "flow.child", version: "1.0.0" }, capabilities: { executable: true } },
      { id: "recording.action", version: "1.0.0", source: { kind: "recording", proposalId: "proposal.one" }, capabilities: { executable: true } },
    ] } });
    throw new Error(`unexpected ${url.pathname}`);
  });
  const inventory = await client.inspectFlowDependencies("project.web", "flow.main");
  assert.equal(inventory.dependencies[0]?.flowId, "flow.child");
  assert.equal(inventory.availableUpgrades[0]?.versions[0], "1.1.0");
  assert.equal(JSON.stringify(inventory).includes("discard-me"), false);
  const definitions = await client.listNativeNodeDefinitions("project.web");
  assert.deepEqual(definitions, [
    { id: "builtin.control.start", version: "1.0.0", sourceKind: "builtin", executable: true, externalSideEffect: false },
    { id: "web.dom.type", version: "1.0.0", sourceKind: "importer", sourceDomainId: "web-automation", executable: true, externalSideEffect: false },
    { id: "custom.network", version: "1.0.0", sourceKind: "code", executable: true, externalSideEffect: true },
    { id: "flow.child", version: "1.0.0", sourceKind: "composite", executable: true, externalSideEffect: false },
    { id: "recording.action", version: "1.0.0", sourceKind: "recording", executable: true, externalSideEffect: false },
  ]);
  assert.equal(JSON.stringify(definitions).includes("discard-me"), false);
});

test("discovers only sanitized gateway metadata and selects existing context", async (t) => {
  const requests: Array<{ endpoint: string; body: unknown }> = [];
  const client = await mockedClient(t, async (url, init) => {
    requests.push({ endpoint: endpoint(url), body: init.body ? JSON.parse(String(init.body)) : undefined });
    if (url.pathname === "/api/client-gateway/automation-studio-context") return json({ ok: true });
    return json({ ok: true, payload: { enabled: true, counts: { sessions: 1, pairings: 2, trustedClients: 3 }, sessions: [{ cookie: "raw-secret" }], pairings: [{ pairingCode: "raw-code" }], webRuntime: { runtimeId: "web.one", clientGatewayPublicUrl: "wss://gateway.example.test/client", clientGatewayListening: true } } });
  });
  const discovery = await client.gatewayDiscovery();
  assert.deepEqual(discovery, { enabled: true, sessionCount: 1, pairingCount: 2, trustedClientCount: 3, publicUrl: "wss://gateway.example.test/client", listening: true, runtimeId: "web.one" });
  assert.equal(JSON.stringify(discovery).includes("raw-secret"), false);
  assert.equal(JSON.stringify(discovery).includes("raw-code"), false);
  await client.selectExistingContext("project.web", "client.one", {}, "flow.one");
  assert.deepEqual(requests.at(-1)?.body, { activeProjectId: "project.web", activeFlowId: "flow.one", clientId: "client.one" });
});

test("starts and runs the exact persisted Flow with deterministic non-adaptive controls", async (t) => {
  const requests: Array<{ endpoint: string; body: Record<string, unknown> }> = [];
  const client = await mockedClient(t, async (url, init) => {
    const body = JSON.parse(String(init.body ?? "{}"));
    requests.push({ endpoint: endpoint(url), body });
    if (endpoint(url) === "start-runtime-session") return json({ ok: true, payload: { runtimeSession: { ...session, status: "queued" } } });
    if (endpoint(url) === "run-runtime-session") return json({ ok: true, payload: { runtimeSession: session, runSummary: summary } });
    throw new Error(`unexpected ${url.pathname}`);
  });
  const started = await client.startPersistedFlow({ projectId: "project.web", flowId: "flow.main" });
  assert.equal(started.status, "queued");
  const ran = await client.runPersistedFlow({ projectId: "project.web", flowId: "flow.main", runId: started.runId, maxSteps: 20, idempotencyKey: "test-one" });
  assert.equal(ran.summary?.status, "succeeded");
  assert.deepEqual(requests[0]?.body, { projectId: "project.web", flowId: "flow.main", targetKind: "flow", targetId: "flow.main" });
  assert.deepEqual(requests[1]?.body, { projectId: "project.web", flowId: "flow.main", runId: "run.one", maxSteps: 20, idempotencyKey: "test-one", adaptiveMode: "deterministic", authorizedExternalSideEffects: false });
  const serialized = JSON.stringify(requests);
  assert.equal(serialized.includes(credentials.pin), false);
  assert.equal(serialized.includes(credentials.password), false);
  assert.equal(serialized.includes(credentials.totp), false);
});

test("forwards every live purpose, explore_and_adapt included, as Core's run intent", async (t) => {
  const bodies: Array<Record<string, unknown>> = [];
  const client = await mockedClient(t, async (url, init) => {
    if (endpoint(url) !== "run-runtime-session") throw new Error(`unexpected ${url.pathname}`);
    bodies.push(JSON.parse(String(init.body ?? "{}")));
    return json({ ok: true, payload: { runtimeSession: session, runSummary: summary } });
  });
  // Typed through the lane's own execution shape, so the client's parameter can
  // never again be narrower than the purposes the lane hands it.
  const purposes: Array<PersistedFlowLlmExecution["purpose"]> = ["diagnosis_only", "diagnose_and_adapt", "explore_and_adapt"];
  for (const purpose of purposes) {
    await client.runPersistedFlow({ projectId: "project.web", flowId: "flow.main", llmExecution: { grantId: "grant.one", purpose } });
  }
  assert.deepEqual(bodies.map(body => body.runIntent), purposes);
  for (const body of bodies) {
    assert.equal(body.adaptiveMode, "manual_approval");
    assert.equal(body.llmExecutionGrantId, "grant.one");
  }
});

test("holds an evidence-guided creation's provider calls to Core's backstop, not a small fixed count", async (t) => {
  const withCalls = (calls: number) => ({
    adaptationId: "adaptation.pending", projectId: "project.web", flowId: "flow.main", status: "proposed",
    metadata: { adaptationKind: "flow_bootstrap", phase9: { auditEvents: [{ eventType: "created", detail: {
      evidenceGuided: true, providerCallCount: calls, decisionCount: calls, iterationCount: calls, traceStepCount: calls,
      toolCallCount: 1, evidenceBytes: 100, toolIds: ["web.inspect_current_page"],
    } }] } },
  });
  let calls = 0;
  const client = await mockedClient(t, url => endpoint(url) === "get-flow-adaptation"
    ? json({ ok: true, payload: { adaptation: withCalls(calls) } })
    : (() => { throw new Error(`unexpected ${url.pathname}`); })());
  for (const accepted of [17, LLM_LAB_MAX_CALLS_PER_RUN]) {
    calls = accepted;
    assert.equal((await client.getFlowAdaptation("project.web", "flow.main", "adaptation.pending")).evidenceLoop?.providerCallCount, accepted);
  }
  for (const refused of [0, LLM_LAB_MAX_CALLS_PER_RUN + 1]) {
    calls = refused;
    await assert.rejects(() => client.getFlowAdaptation("project.web", "flow.main", "adaptation.pending"), /bounded contract/u);
  }
});

/**
 * A build that explores by running the node library's nodes makes one tool
 * call per step it tries, not a handful before writing a script. The reader's
 * own ceiling of 16 was measured cutting off a live build that had already
 * produced a Flow, so the only ceiling a record is held to is Core's own on
 * its loop -- and a record claiming more calls than it had decisions is still
 * refused.
 */
test("a build's tool calls are held to Core's own loop ceiling, not to a number of the reader's", async (t) => {
  const withTools = (toolCallCount: number, toolIds: string[]) => ({
    adaptationId: "adaptation.pending", projectId: "project.web", flowId: "flow.main", status: "proposed",
    metadata: { adaptationKind: "flow_bootstrap", phase9: { auditEvents: [{ eventType: "created", detail: {
      evidenceGuided: true, providerCallCount: 40, decisionCount: 40, iterationCount: 41, traceStepCount: 41,
      toolCallCount, evidenceBytes: 100, toolIds,
    } }] } },
  });
  let detail = withTools(1, ["web.inspect_current_page"]);
  const client = await mockedClient(t, url => endpoint(url) === "get-flow-adaptation"
    ? json({ ok: true, payload: { adaptation: detail } })
    : (() => { throw new Error(`unexpected ${url.pathname}`); })());

  // Forty tool calls and twenty distinct nodes: ordinary for a build that runs
  // the library, and refused before this change.
  detail = withTools(40, Array.from({ length: 20 }, (_, index) => `web.node.${index}`));
  const read = await client.getFlowAdaptation("project.web", "flow.main", "adaptation.pending");
  assert.equal(read.evidenceLoop?.toolCallCount, 40);
  assert.equal(read.evidenceLoop?.toolIds.length, 20);

  // More tool calls than the loop had decisions is still not a record Core writes.
  detail = withTools(42, ["web.inspect_current_page"]);
  await assert.rejects(() => client.getFlowAdaptation("project.web", "flow.main", "adaptation.pending"), /bounded contract/u);
});

test("a Flow build answers with Core's whole envelope, so a refusal's diagnostic survives the HTTP status", async (t) => {
  const requests: Array<{ path: string; body: unknown }> = [];
  const diagnostic = { code: "flow_bootstrap.evidence_iteration_limit", stage: "provider_output_validation" };
  let answer: Response = json({ ok: true, payload: { adaptation: { adaptationId: "adaptation.new", status: "proposed" } } });
  const client = await mockedClient(t, (url, init) => {
    requests.push({ path: url.pathname, body: JSON.parse(String(init.body)) });
    return answer;
  });
  const input = { projectId: "project.web", flowId: "flow.blank", llmExecutionGrantId: "llm-grant:build", evidenceGuided: true as const };
  assert.deepEqual(await client.generateFlowBootstrapAdaptation(input), { status: 200, ok: true, payload: { adaptation: { adaptationId: "adaptation.new", status: "proposed" } } });
  answer = json({ ok: false, error: "Flow Bootstrap generation failed (flow_bootstrap.evidence_iteration_limit).", payload: { diagnostic } }, 400);
  assert.deepEqual(await client.generateFlowBootstrapAdaptation(input), { status: 400, ok: false, payload: { diagnostic } });
  // An envelope that says ok on a failed status is not a success, and a body that is not JSON is an empty refusal.
  answer = json({ ok: true, payload: {} }, 500);
  assert.equal((await client.generateFlowBootstrapAdaptation(input)).ok, false);
  answer = new Response("<html>gateway error</html>", { status: 502 });
  assert.deepEqual(await client.generateFlowBootstrapAdaptation(input), { status: 502, ok: false, payload: undefined });
  assert.deepEqual(requests[0], { path: "/api/programs/automation-studio/generate-flow-bootstrap-adaptation", body: input });
});

test("parses cancellation, run detail, action, and event DTOs without returning raw event payloads", async (t) => {
  const client = await mockedClient(t, url => {
    if (endpoint(url) === "cancel-runtime-session") return json({ ok: true, payload: { runtimeSession: { ...session, status: "cancelled" } } });
    if (endpoint(url) === "get-flow-run-detail") return json({ ok: true, payload: { runDetail: { summary: { ...summary, interventionCount: 1 }, routeDecisions: [{ decisionId: "decision.one", routerId: "router.one", selectedSubflowId: "subflow.one", fallbackUsed: true }], subflows: [{ entryId: "entry.one", subflowId: "subflow.one", status: "succeeded", metadata: { graphFlowId: "flow.graph", routeDecisionId: "decision.one", private: "discard-me" } }], actionAttempts: [action], interventions: [{ interventionId: "intervention.one", kind: "diagnosis", promptVersion: "automation-studio.runtime-diagnosis.v1+stage.gather", provider: "deepseek", model: DEFAULT_LLM_MODEL, validation: { ok: true }, tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, estimatedCostUsd: 0.01 }, createdAt: 21, metadata: { requestId: "llm.request.one", private: "discard-me" }, reason: "discard-me" }], adaptationIds: [], changeProposalIds: [], metadata: { correlationId: "discard-me", runtimePatchAttempts: [{ kind: "temporary_target_override", proposalOnly: true, executed: false, preflightOk: false, issues: ["Unknown target node private-node-name"], private: "discard-me" }], llmGate: { costAccounting: { calls: 1, arbitrary: "discard-me" } } } } } });
    if (endpoint(url) === "list-flow-run-actions") return json({ ok: true, payload: { actions: [action], page: {} } });
    if (endpoint(url) === "list-flow-run-events") return json({ ok: true, payload: { events: [event], page: {} } });
    throw new Error(`unexpected ${url.pathname}`);
  });
  assert.equal((await client.cancelRun("project.web", "run.one"))?.status, "cancelled");
  const detail = await client.getRunDetail("project.web", "run.one");
  assert.equal(detail.actionAttempts[0]?.attemptId, "attempt.one");
  assert.deepEqual(detail.routeDecisions[0], { decisionId: "decision.one", routerId: "router.one", selectedSubflowId: "subflow.one", fallbackUsed: true });
  assert.deepEqual(detail.subflows[0], { entryId: "entry.one", subflowId: "subflow.one", status: "succeeded", graphFlowId: "flow.graph", routeDecisionId: "decision.one" });
  assert.equal(JSON.stringify(detail.subflows).includes("discard-me"), false);
  assert.equal(detail.providerCallCount, 1);
  assert.deepEqual(detail.interventions?.[0], { interventionId: "intervention.one", kind: "diagnosis", requestId: "llm.request.one", promptVersion: "automation-studio.runtime-diagnosis.v1+stage.gather", provider: "deepseek", model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 10, outputTokens: 5, totalTokens: 15, estimatedCostUsd: 0.01, createdAt: 21 });
  assert.deepEqual(detail.runtimePatchAttempts, [{ kind: "temporary_target_override", proposalOnly: true, executed: false, preflightOk: false, issueCodes: ["runtime_patch.target_node_invalid"], adaptationCreated: false, changeProposalCreated: false }]);
  assert.equal(JSON.stringify(detail).includes("discard-me"), false);
  assert.equal((await client.listRunActions("project.web", "run.one"))[0]?.definitionId, "web.dom.type");
  const parsedEvent = (await client.listRunEvents("project.web", "run.one"))[0];
  assert.equal(parsedEvent?.eventId, "event.one");
  assert.equal("payload" in parsedEvent!, false);
});

// Core's per-call lines: every call itemized, evidence calls included, parsed strictly or not at all.
test("reads Core's per-call lines exactly, and refuses a malformed one rather than skip it", async (t) => {
  const reported = { inputTokens: 10, outputTokens: 5, totalTokens: 15, estimatedCostUsd: 0.01 };
  const line = (sequence: number, taskKind: string, extra: Record<string, unknown> = {}) => ({ sequence, requestId: `llm.${taskKind}.${sequence}`, taskKind, stage: "gather", allowance: "run", promptVersion: `automation-studio.${taskKind}.v1+stage.gather`, provider: "deepseek", model: DEFAULT_LLM_MODEL, validation: { ok: true, issueCodes: [] }, reported, charged: { ...reported, tokens: "reported", cost: "reported" }, budgetBreach: false, ...extra });
  const unreported = { reported: { inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null }, charged: { inputTokens: 8_000, outputTokens: 2_000, totalTokens: 10_000, estimatedCostUsd: 0.08, tokens: "reserved", cost: "reserved" }, validation: null, allowance: "exploration", stage: null };
  let gate: Record<string, unknown> = {};
  const client = await mockedClient(t, () => json({ ok: true, payload: { runDetail: { summary, routeDecisions: [], subflows: [], interventions: [], metadata: { llmGate: { invoked: true, ...gate } } } } }));
  gate = { providerCalls: [line(1, "runtime_diagnosis"), line(2, "evidence_tool_decision", unreported), line(3, "runtime_patch")], providerCallsOmitted: 0 };
  const detail = await client.getRunDetail("project.web", "run.one");
  assert.equal(detail.providerCallsOmitted, 0);
  assert.deepEqual(detail.providerCalls?.map(call => [call.sequence, call.taskKind, call.allowance, call.validationOk, call.totalTokens, call.charged.tokens]), [[1, "runtime_diagnosis", "run", true, 15, "reported"], [2, "evidence_tool_decision", "exploration", null, null, "reserved"], [3, "runtime_patch", "run", true, 15, "reported"]]);
  assert.deepEqual(detail.providerCalls?.[1], { sequence: 2, requestId: "llm.evidence_tool_decision.2", taskKind: "evidence_tool_decision", stage: null, allowance: "exploration", promptVersion: "automation-studio.evidence_tool_decision.v1+stage.gather", provider: "deepseek", model: DEFAULT_LLM_MODEL, validationOk: null, validationCodes: [], inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null, charged: { inputTokens: 8_000, outputTokens: 2_000, totalTokens: 10_000, estimatedCostUsd: 0.08, tokens: "reserved", cost: "reserved" }, budgetBreach: false });
  gate = { patchSkipped: "No repair was requested.", structuredDiagnosis: { patchNeeded: false } };
  const preserved = await client.getRunDetail("project.web", "run.one");
  assert.equal(preserved.llmGate?.patchSkippedCode, "llm.runtime_patch_not_requested");
  gate = { patchSkippedCode: "llm.runtime_patch_grant_scope_refused" };
  const published = await client.getRunDetail("project.web", "run.one");
  assert.equal(published.llmGate?.patchSkippedCode, "llm.runtime_patch_grant_scope_refused");
  // The rung Core names beside the code (`recovery/annotation/annotate.ts`).
  // A word Core does not own is dropped rather than carried into a bundle, and
  // a Core that names none leaves the field absent.
  gate = { patchSkippedCode: "llm.runtime_patch_goal_unachievable", patchSkippedRung: "plan", patchHeldCode: "llm.runtime_patch_permission_required", patchHeldRung: "resolution" };
  const attributed = await client.getRunDetail("project.web", "run.one");
  assert.deepEqual([attributed.llmGate?.patchSkippedRung, attributed.llmGate?.patchHeldRung], ["plan", "resolution"]);
  gate = { patchSkippedCode: "llm.runtime_patch_goal_unachievable", patchSkippedRung: "somewhere in the loop" };
  const unattributed = await client.getRunDetail("project.web", "run.one");
  assert.equal("patchSkippedRung" in (unattributed.llmGate ?? {}), false);
  gate = {};
  const older = await client.getRunDetail("project.web", "run.one");
  assert.equal("providerCalls" in older || "providerCallsOmitted" in older, false, "a Core without per-call lines is reported as having none, not as zero calls");
  for (const [name, bad] of Object.entries({
    outOfOrder: { providerCalls: [line(2, "runtime_diagnosis")], providerCallsOmitted: 0 },
    omittedMissing: { providerCalls: [line(1, "runtime_diagnosis")] },
    linesMissing: { providerCallsOmitted: 0 },
    repeatedRequest: { providerCalls: [line(1, "runtime_diagnosis"), { ...line(2, "runtime_patch"), requestId: "llm.runtime_diagnosis.1" }], providerCallsOmitted: 0 },
    messageAsCode: { providerCalls: [line(1, "runtime_diagnosis", { validation: { ok: false, issueCodes: ["The provider said: private"] } })], providerCallsOmitted: 0 },
    negativeTokens: { providerCalls: [line(1, "runtime_diagnosis", { reported: { ...reported, inputTokens: -1 } })], providerCallsOmitted: 0 },
    unknownBasis: { providerCalls: [line(1, "runtime_diagnosis", { charged: { ...reported, tokens: "guessed", cost: "reported" } })], providerCallsOmitted: 0 },
    unsafeProvider: { providerCalls: [line(1, "runtime_diagnosis", { provider: "deep seek" })], providerCallsOmitted: 0 },
    tooMany: { providerCalls: Array.from({ length: 251 }, (_, index) => line(index + 1, "evidence_tool_decision")), providerCallsOmitted: 0 },
  })) {
    gate = bad;
    await assert.rejects(() => client.getRunDetail("project.web", "run.one"), /Malformed FluxIQ API response/u, name);
  }
});

test("strict DTO parsing rejects malformed responses before orchestration", async (t) => {
  const client = await mockedClient(t, url => endpoint(url) === "projects"
    ? json({ ok: true, payload: { projects: [{ ...project, updatedAt: "now" }] } })
    : json({ ok: true, payload: { events: [{ ...event, sequence: "one" }] } }));
  await assert.rejects(() => client.listProjects(), /Malformed FluxIQ API response/);
  await assert.rejects(() => client.listRunEvents("project.web", "run.one"), /Malformed FluxIQ API response/);
  await assert.rejects(() => client.automationStudioCall("../snapshot"), /endpoint is malformed/);
});

test("bounds Flow HTTP calls by timeout without leaking authentication material", async (t) => {
  const client = await mockedClient(t, (_url, init) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  }));
  await assert.rejects(() => client.startPersistedFlow({ projectId: "project.web", flowId: "flow.main", timeoutMs: 10 }), error => {
    const rendered = String(error) + JSON.stringify(error);
    return /timed out/.test(rendered) && !rendered.includes(credentials.password) && !rendered.includes(credentials.pin) && !rendered.includes(credentials.totp) && !rendered.includes("session=opaque");
  });
});

test("propagates bounded caller interruption to an in-flight Flow request", async (t) => {
  const client = await mockedClient(t, (_url, init) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  }));
  const controller = new AbortController();
  const pending = client.runPersistedFlow({ projectId: "project.web", flowId: "flow.main", signal: controller.signal, timeoutMs: 5_000 });
  controller.abort(new Error("caller detail must not be propagated"));
  await assert.rejects(() => pending, error => /was interrupted/.test(String(error)) && !String(error).includes("caller detail"));
});
