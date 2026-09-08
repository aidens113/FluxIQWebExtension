import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import type { RunAllocation } from "./allocation.js";
import { PROVIDER_SECRET_ENVIRONMENT_VARIABLES, buildFluxIQEnvironment, buildScenarioEnvironment, withoutProviderSecrets } from "./environment.js";

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

test("removes provider credentials case-insensitively without mutating the driver environment", () => {
  const source: NodeJS.ProcessEnv = { SAFE_VALUE: "retained", DEEPSEEK_API_KEY: "deepseek-fixture", openai_api_key: "openai-fixture" };
  const sanitized = withoutProviderSecrets(source);
  assert.deepEqual(sanitized, { SAFE_VALUE: "retained" });
  assert.equal(source.DEEPSEEK_API_KEY, "deepseek-fixture");
  assert.ok(PROVIDER_SECRET_ENVIRONMENT_VARIABLES.includes("DEEPSEEK_API_KEY"));

  const providerEnvironment = Object.fromEntries(PROVIDER_SECRET_ENVIRONMENT_VARIABLES.map(key => [key, `fixture-${key}`]));
  const scenario = buildScenarioEnvironment(allocation, 42, { ...providerEnvironment, SAFE_VALUE: "retained" });
  const fluxiq = buildFluxIQEnvironment(allocation, { repositoryRoot: "C:/extension", fluxiqRepositoryRoot: "C:/core" }, { ...providerEnvironment, SAFE_VALUE: "retained" });
  for (const key of PROVIDER_SECRET_ENVIRONMENT_VARIABLES) {
    assert.equal(scenario[key], undefined, `${key} leaked to Scenario Lab`);
    assert.equal(fluxiq[key], undefined, `${key} leaked to FluxIQ Core`);
  }
  assert.equal(scenario.SAFE_VALUE, "retained");
  assert.equal(fluxiq.SAFE_VALUE, "retained");
});