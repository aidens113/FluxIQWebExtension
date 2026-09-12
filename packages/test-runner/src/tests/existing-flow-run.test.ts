import assert from "node:assert/strict";
import test from "node:test";
import { executeExistingPersistedFlow, existingFlowCancellationReport, preflightExistingFluxIQ } from "../existing-flow-run.js";
import { RunnerFailure } from "../failure.js";
import type { ExistingTargetConfiguration } from "../target-config.js";

const target: ExistingTargetConfiguration = {
  mode: "existing", baseUrl: "https://panel.example.test", projectId: "project.web", flowId: "flow.main",
  credentials: { username: "runner", password: "secret", authorizationPin: "123456" },
};
const project = { id: "project.web", name: "Web", description: "", domainId: "web-automation", createdAt: 1, updatedAt: 2 };
const flow = { flowId: "flow.main", projectId: "project.web", name: "Main", updatedAt: 2, contentHash: "a".repeat(64), document: {} };
const summary = { runId: "run.one", projectId: "project.web", flowId: "flow.main", status: "succeeded" as const, actionAttemptCount: 1, updatedAt: 4 };
// Core's real shape: every recorded action shares the `builtin.policy.action`
// node definition and the attempt drops the node's inputs, so the node's
// `parameterValues.outputId` is the only place the action it ran survives.
const action = { attemptId: "attempt.one", nodeId: "node.one", definitionId: "builtin.policy.action", order: 0, status: "succeeded" as const, startedAt: 2, finishedAt: 3 };
const flowNodes = [{ id: "node.one", definitionId: "builtin.policy.action", parameterValues: { outputId: "web.dom.type" } }];

function client(overrides: Record<string, unknown> = {}) {
  return {
    validateCurrentSession: async () => ({ identityEndpointAvailable: false }),
    requireProject: async () => project,
    listFlowSummaries: async () => [{ flowId: "flow.main" }],
    getExactFlow: async () => flow,
    automationStudioCall: async (endpoint: string) => {
      if (endpoint === "get-flow") return { flow: { nodes: flowNodes } };
      if (endpoint === "list-flow-subflows") return { subflows: [] };
      throw new Error(`unexpected Automation Studio endpoint ${endpoint}`);
    },
    gatewayDiscovery: async () => ({ enabled: true, listening: true, publicUrl: "wss://panel.example.test/client", sessionCount: 0, pairingCount: 0, trustedClientCount: 0 }),
    selectExistingContext: async () => undefined,
    startPersistedFlow: async () => ({ runId: "run.one", projectId: "project.web", flowId: "flow.main", targetKind: "flow", targetId: "flow.main", status: "queued" }),
    runPersistedFlow: async () => ({ session: { runId: "run.one", projectId: "project.web", flowId: "flow.main", targetKind: "flow", targetId: "flow.main", status: "succeeded" } }),
    getRunDetail: async () => ({ summary, actionAttempts: [action] }),
    listRunActions: async () => [action],
    listRunEvents: async () => [],
    ...overrides,
  } as any;
}

test("preflights exact project, Flow, and discoverable gateway", async () => {
  const value = await preflightExistingFluxIQ(client(), target);
  assert.equal(value.flow.contentHash, "a".repeat(64));
  assert.equal(value.gatewayUrl, "wss://panel.example.test/client");
  assert.equal(value.sessionIdentityVerified, false);
  await assert.rejects(
    () => preflightExistingFluxIQ(client({ gatewayDiscovery: async () => ({ enabled: true, listening: true, publicUrl: "ws://gateway.example.test/client" }) }), target),
    (error: unknown) => error instanceof RunnerFailure && error.category === "gateway.connection" && /transport policy/.test(error.message),
  );
});

test("runs the stored Flow deterministically and requires successful durable actions", async () => {
  const value = await executeExistingPersistedFlow(client(), target, "facility.one", {}, [{ action: "web.dom.type", outcome: "succeeded" }]);
  assert.equal(value.runId, "run.one");
  assert.equal(value.actions[0]?.status, "succeeded");
  await assert.rejects(() => executeExistingPersistedFlow(client({ listRunActions: async () => [] }), target, "facility.two"), /no durable action/);
  await assert.rejects(() => executeExistingPersistedFlow(client({ runPersistedFlow: async () => ({ session: { runId: "run.one", projectId: "project.web", flowId: "flow.main", targetKind: "flow", targetId: "flow.main", status: "failed" } }) }), target, "facility.three"), /status failed/);
  await assert.rejects(() => executeExistingPersistedFlow(client(), target, "facility.four", {}, [{ action: "web.dom.click", outcome: "succeeded" }]), /did not produce expected/);
});

test("an expected action is matched through the node id, not the shared definition id", async () => {
  // The attempt reports `builtin.policy.action`, so comparing `definitionId` to
  // `web.dom.type` could never match; the join through the Flow's nodes does.
  const value = await executeExistingPersistedFlow(client(), target, "facility.join", {}, [{ action: "web.dom.type", outcome: "succeeded" }]);
  assert.equal(value.actions[0]?.definitionId, "builtin.policy.action");

  // The mirror image: comparing `definitionId` would have matched this, and it
  // must not -- the node dispatches web.dom.type, not the policy definition.
  await assert.rejects(
    () => executeExistingPersistedFlow(client(), target, "facility.join-negative", {}, [{ action: "builtin.policy.action", outcome: "succeeded" }]),
    (error: unknown) => error instanceof RunnerFailure && /did not produce expected/.test(error.message) && /web\.dom\.type:succeeded/.test(error.message),
  );

  // A node the Flow does not declare keeps the definition id as its fallback.
  const native = { ...action, nodeId: "node.native", definitionId: "web.dom.wait" };
  const fallback = await executeExistingPersistedFlow(
    client({ listRunActions: async () => [native], getRunDetail: async () => ({ summary, actionAttempts: [native] }) }),
    target, "facility.fallback", {}, [{ action: "web.dom.wait", outcome: "succeeded" }],
  );
  assert.equal(fallback.status, "succeeded");

  // An action the Flow ran under a subflow's graph Flow is still identified.
  const subflowNode = { id: "node.sub", definitionId: "builtin.policy.action", parameterValues: { outputId: "web.dom.click" } };
  const subflowAttempt = { ...action, nodeId: "node.sub", definitionId: "builtin.policy.action" };
  const viaSubflow = await executeExistingPersistedFlow(
    client({
      listRunActions: async () => [subflowAttempt],
      getRunDetail: async () => ({ summary, actionAttempts: [subflowAttempt] }),
      automationStudioCall: async (endpoint: string, payload: { flowId?: string }) => {
        if (endpoint === "list-flow-subflows") return { subflows: [{ graphFlowId: "flow.graph" }] };
        return { flow: { nodes: payload.flowId === "flow.graph" ? [subflowNode] : [] } };
      },
    }),
    target, "facility.subflow", {}, [{ action: "web.dom.click", outcome: "succeeded" }],
  );
  assert.equal(viaSubflow.status, "succeeded");
});
test("the execution carries the action-type map so the run manifest can label attempts", async () => {
  // The join is only as good as what reaches the manifest: flowActionTimings
  // takes this map, and without it every attempt is labelled
  // builtin.policy.action, which is how the fix stayed inert. The map is read
  // only when an expectation already made that call worth making, so a run
  // without expectations pays nothing and keeps the definition-id fallback.
  const withExpectations = await executeExistingPersistedFlow(client(), target, "facility.map", {}, [{ action: "web.dom.type", outcome: "succeeded" }]);
  assert.equal(withExpectations.actionTypes.get("node.one"), "web.dom.type");

  const withoutExpectations = await executeExistingPersistedFlow(client(), target, "facility.no-map", {});
  assert.equal(withoutExpectations.actionTypes.size, 0);
});

test("preserves a bounded Flow failure and attempts cancellation exactly once", async () => {
  const original = new RunnerFailure("runtime.behavior", "FluxIQ request run-runtime-session timed out after 10ms", { details: { bounded: "timeout", timeoutMs: 10 } });
  let cancellations = 0;
  const control = client({ runPersistedFlow: async () => { throw original; }, cancelRun: async () => { cancellations += 1; return null; } });
  let caught: unknown;
  try { await executeExistingPersistedFlow(control, target, "facility.timeout", {}, [], { timeoutMs: 10 }); } catch (error) { caught = error; }
  assert.equal(caught, original);
  assert.equal(cancellations, 1);
  assert.deepEqual(existingFlowCancellationReport(caught), { failure: "timeout", runId: "run.one", cancellation: "unconfirmed" });
  const rendered = String(caught) + JSON.stringify(existingFlowCancellationReport(caught));
  assert.equal(rendered.includes(target.credentials.password), false);
  assert.equal(rendered.includes(target.credentials.authorizationPin), false);
});

test("reports audited unsupported cancellation without replacing the original interruption", async () => {
  const original = new RunnerFailure("runtime.behavior", "FluxIQ request get-flow-run-detail was interrupted", { details: { bounded: "abort" } });
  let cancellations = 0;
  const control = client({
    getRunDetail: async () => { throw original; },
    cancelRun: async () => { cancellations += 1; throw new RunnerFailure("environment.missing", "FluxIQ control request failed: cancel-runtime-session (404)", { details: { status: 404 } }); },
  });
  let caught: unknown;
  try { await executeExistingPersistedFlow(control, target, "facility.abort"); } catch (error) { caught = error; }
  assert.equal(caught, original);
  assert.equal(cancellations, 1);
  assert.deepEqual(existingFlowCancellationReport(caught), { failure: "abort", runId: "run.one", cancellation: "unsupported" });
});

test("does not attempt cancellation when bounded start fails before a run ID exists", async () => {
  const original = new RunnerFailure("runtime.behavior", "FluxIQ request start-runtime-session timed out after 10ms", { details: { bounded: "timeout" } });
  let cancellations = 0;
  const control = client({ startPersistedFlow: async () => { throw original; }, cancelRun: async () => { cancellations += 1; } });
  await assert.rejects(() => executeExistingPersistedFlow(control, target, "facility.start-timeout"), error => error === original);
  assert.equal(cancellations, 0);
  assert.deepEqual(existingFlowCancellationReport(original), { failure: "timeout", cancellation: "not-attempted" });
});
