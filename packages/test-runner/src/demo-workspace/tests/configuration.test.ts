// The demo configuration with and without a topology's allocated endpoints.
// Without overrides nothing changes: the environment's values, or the fixed
// demo defaults. With them, the allocated origin, gateway, workspace and
// pinned extension replace the environment's, and pass the same checks.

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { resolveDemoWorkspaceConfiguration } from "../configuration.js";

const repository = path.resolve("repository-root");
const runs = path.join(repository, "test-runs");
const identity = { FLUXIQ_TEST_USERNAME: "runner", FLUXIQ_TEST_PASSWORD: "secret-password", FLUXIQ_TEST_PIN: "123456" };

test("without overrides the environment's endpoints, or the fixed demo defaults, are used", () => {
  const defaults = resolveDemoWorkspaceConfiguration(repository, identity);
  assert.equal(defaults.origin, "http://127.0.0.1:3300");
  assert.equal(defaults.gatewayUrl, "ws://127.0.0.1:4877/client");
  assert.equal(defaults.workspaceDirectory, path.join(runs, "web-extension-demo"));
  const configured = resolveDemoWorkspaceConfiguration(repository, { ...identity, FLUXIQ_DEMO_BASE_URL: "http://127.0.0.1:41000", FLUXIQ_DEMO_GATEWAY_URL: "ws://127.0.0.1:41001/client" });
  assert.equal(configured.origin, "http://127.0.0.1:41000");
  assert.equal(configured.gatewayUrl, "ws://127.0.0.1:41001/client");
});

test("allocated endpoints, workspace and pinned extension replace the environment's", () => {
  const workspace = path.join(runs, "ui-e2e", "r1");
  const extension = path.join(workspace, "extension-under-test");
  const config = resolveDemoWorkspaceConfiguration(repository, { ...identity, FLUXIQ_DEMO_BASE_URL: "http://127.0.0.1:3300", FLUXIQ_DEMO_RUN_DIR: path.join(runs, "elsewhere") }, {
    origin: "http://127.0.0.1:52001",
    gatewayUrl: "ws://127.0.0.1:52002/client",
    workspaceDirectory: workspace,
    extensionSourceDirectory: extension,
  });
  assert.equal(config.origin, "http://127.0.0.1:52001");
  assert.equal(config.gatewayUrl, "ws://127.0.0.1:52002/client");
  assert.equal(config.workspaceDirectory, workspace);
  assert.equal(config.fluxiqRoot, path.join(workspace, "fluxiq-root"));
  assert.equal(config.storageDirectory, path.join(workspace, "fluxiq-root", ".fluxiq"));
  assert.equal(config.extensionSourceDirectory, extension);
});

test("allocated endpoints pass the same checks as the environment's", () => {
  const resolve = (overrides: { origin: string; gatewayUrl: string; workspaceDirectory?: string; extensionSourceDirectory?: string }) => resolveDemoWorkspaceConfiguration(repository, identity, overrides);
  assert.throws(() => resolve({ origin: "http://127.0.0.1:52001", gatewayUrl: "ws://127.0.0.1:52001/client" }), /different ports/u);
  assert.throws(() => resolve({ origin: "http://example.test:52001", gatewayUrl: "ws://127.0.0.1:52002/client" }), /loopback/u);
  assert.throws(() => resolve({ origin: "http://127.0.0.1:52001/panel", gatewayUrl: "ws://127.0.0.1:52002/client" }), /exact HTTP\(S\) origin/u);
  assert.throws(() => resolve({ origin: "http://127.0.0.1", gatewayUrl: "ws://127.0.0.1:52002/client" }), /explicit port/u);
  assert.throws(() => resolve({ origin: "http://127.0.0.1:52001", gatewayUrl: "ws://127.0.0.1:52002/client", workspaceDirectory: path.join(repository, "outside") }), /below FLUXIQ_TEST_RUNS_DIR/u);
  assert.throws(() => resolve({ origin: "http://127.0.0.1:52001", gatewayUrl: "ws://127.0.0.1:52002/client", extensionSourceDirectory: "relative/extension" }), /absolute path/u);
});
