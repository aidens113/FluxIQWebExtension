import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import type { RunAllocation } from "./allocation.js";
import { buildFluxIQEnvironment, buildScenarioEnvironment } from "./environment.js";

const allocation: RunAllocation = {
  runId: "run-a", runRoot: path.resolve("runs/run-a"), fluxiqRoot: path.resolve("runs/run-a/fluxiq-root"),
  storageDir: path.resolve("runs/run-a/fluxiq-root/.fluxiq"), browserProfileDir: path.resolve("runs/run-a/profile"),
  coreWorkspaceDir: path.resolve("runs/run-a/core-workspace"), webWorkspaceDir: path.resolve("runs/run-a/core-workspace/apps/web"),
  logsDir: path.resolve("runs/run-a/logs"),
  scenarioPort: 31001, webPort: 31002, gatewayPort: 31003, controllerToken: "controller_token_1234567890",
};

test("constructs isolated scenario and FluxIQ environments", () => {
  const scenario = buildScenarioEnvironment(allocation, 42, { INHERITED: "yes" });
  assert.deepEqual({ token: scenario.SCENARIO_LAB_RUN_TOKEN, port: scenario.SCENARIO_LAB_PORT, seed: scenario.SCENARIO_LAB_SEED }, {
    token: allocation.controllerToken, port: "31001", seed: "42",
  });
  const fluxiq = buildFluxIQEnvironment(allocation, { repositoryRoot: "C:/extension", fluxiqRepositoryRoot: "C:/core" }, { INHERITED: "yes" });
  assert.equal(fluxiq.FLUXIQ_ROOT, allocation.fluxiqRoot);
  assert.equal(fluxiq.FLUXIQ_DATA_DIR, allocation.storageDir);
  assert.equal(fluxiq.FLUXIQ_DATABASES_DIR, allocation.storageDir);
  assert.equal(fluxiq.PORT, "31002");
  assert.equal(fluxiq.FLUXIQ_CLIENT_GATEWAY_PORT, "31003");
  assert.equal(fluxiq.FLUXIQ_CLIENT_GATEWAY_HOST, "127.0.0.1");
  assert.equal(fluxiq.FLUXIQ_PUBLIC_CLIENT_WS_URL, "ws://127.0.0.1:31003/client");
  assert.equal(fluxiq.INHERITED, "yes");
});
