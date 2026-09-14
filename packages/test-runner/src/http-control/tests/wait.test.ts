import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { httpTransportFailureDetails, topologyReadinessFailureDetails, waitForHttp, type TopologyReadinessStage } from "../index.js";

const RAW = "raw-topology-target-must-not-persist";

for (const operationStage of ["scenario.health", "core.health"] as const satisfies readonly TopologyReadinessStage[]) {
  test(`the ${operationStage} timeout has one closed durable projection`, async (t) => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error(RAW, { cause: { port: 49_321, body: RAW } }); };
    t.after(() => { globalThis.fetch = originalFetch; });

    await assert.rejects(
      () => waitForHttp(`http://${RAW}.example.test/private`, { operationStage, timeoutMs: 1, intervalMs: 1 }),
      (error: unknown) => {
        assert.ok(error instanceof RunnerFailure);
        assert.equal(error.category, "process.startup");
        assert.equal(error.message, "Topology startup wait timed out");
        assert.deepEqual(error.details, { bounded: "timeout", operationStage, timeoutMs: 1 });
        assert.deepEqual(topologyReadinessFailureDetails(error), { bounded: "timeout", operationStage, timeoutMs: 1 });
        assert.equal(JSON.stringify({ message: error.message, details: topologyReadinessFailureDetails(error) }).includes(RAW), false);
        assert.equal(httpTransportFailureDetails(error), undefined);
        return true;
      },
    );
  });
}

test("the topology readiness projector rejects every open or foreign dimension", () => {
  const details = { bounded: "timeout", operationStage: "core.health", timeoutMs: 60_000 };
  const failure = (category: ConstructorParameters<typeof RunnerFailure>[0], message: string, overrides: Record<string, unknown> = {}) =>
    new RunnerFailure(category, message, { cause: new Error(RAW), details: { ...details, target: RAW, url: RAW, port: 49_321, path: RAW, body: RAW, message: RAW, cause: RAW, ...overrides } });

  assert.deepEqual(topologyReadinessFailureDetails(failure("process.startup", "Topology startup wait timed out")), details);
  assert.equal(JSON.stringify(topologyReadinessFailureDetails(failure("process.startup", "Topology startup wait timed out"))).includes(RAW), false);
  assert.equal(topologyReadinessFailureDetails(failure("gateway.connection", "Topology startup wait timed out")), undefined);
  assert.equal(topologyReadinessFailureDetails(failure("process.startup", RAW)), undefined);
  assert.equal(topologyReadinessFailureDetails(failure("process.startup", "Topology startup wait timed out", { bounded: "abort" })), undefined);
  assert.equal(topologyReadinessFailureDetails(failure("process.startup", "Topology startup wait timed out", { operationStage: "gateway.tcp" })), undefined);
  for (const timeoutMs of [undefined, 0, 300_001, 1.5, Number.NaN]) {
    assert.equal(topologyReadinessFailureDetails(failure("process.startup", "Topology startup wait timed out", { timeoutMs })), undefined);
  }
});

test("topology readiness and HTTP transport projections remain disjoint", () => {
  const transport = new RunnerFailure("process.startup", "FluxIQ HTTP transport failed", { details: { operationStage: "project.select", transportCategory: "network", transportCode: "ECONNRESET" } });
  assert.deepEqual(httpTransportFailureDetails(transport), { operationStage: "project.select", transportCategory: "network", transportCode: "ECONNRESET" });
  assert.equal(topologyReadinessFailureDetails(transport), undefined);
});
