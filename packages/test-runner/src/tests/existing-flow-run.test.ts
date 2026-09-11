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
const action = { attemptId: "attempt.one", nodeId: "node.one", definitionId: "web.dom.type", order: 0, status: "succeeded" as const, startedAt: 2, finishedAt: 3 };

function client(overrides: Record<string, unknown> = {}) {
  return {
    validateCurrentSession: async () => ({ identityEndpointAvailable: false }),
    requireProject: async () => project,
    listFlowSummaries: async () => [{ flowId: "flow.main" }],
    getExactFlow: async () => flow,
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
