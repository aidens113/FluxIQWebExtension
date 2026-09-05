import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadTestEnvironment, parseEnvironmentFile, resolveAuthScopeConfiguration, resolveCloneCacheScopeConfiguration, resolveTargetConfiguration } from "./target-config.js";

const existingEnvironment: NodeJS.ProcessEnv = {
  FLUXIQ_TEST_TARGET: "existing",
  FLUXIQ_TEST_BASE_URL: "http://127.0.0.1:3000/",
  FLUXIQ_TEST_GATEWAY_URL: "ws://127.0.0.1:3100/client",
  FLUXIQ_TEST_USERNAME: "runner",
  FLUXIQ_TEST_PASSWORD: "secret",
  FLUXIQ_TEST_PIN: "123456",
  FLUXIQ_TEST_PROJECT_ID: "project-1",
  FLUXIQ_TEST_FLOW_ID: "flow-1",
};

test("isolated is the default and supports optional bootstrap credentials", () => {
  assert.deepEqual(resolveTargetConfiguration({ env: {} }), { mode: "isolated" });
  assert.deepEqual(resolveTargetConfiguration({ env: { FLUXIQ_TEST_USERNAME: "runner", FLUXIQ_TEST_PASSWORD: "secret" } }), {
    mode: "isolated", credentials: { username: "runner", password: "secret" },
  });
});

test("resolves persistent isolation from CLI or environment with optional bootstrap credentials", () => {
  assert.deepEqual(resolveTargetConfiguration({ cliTarget: "persistent-isolated", cliWorkspace: "browser-dev.1", env: {} }), {
    mode: "persistent-isolated", workspace: "browser-dev.1",
  });
  assert.deepEqual(resolveTargetConfiguration({ env: {
    FLUXIQ_TEST_TARGET: "persistent-isolated",
    FLUXIQ_TEST_PERSISTENT_WORKSPACE: "browser_dev",
    FLUXIQ_TEST_USERNAME: "runner",
    FLUXIQ_TEST_PASSWORD: "secret",
  } }), {
    mode: "persistent-isolated", workspace: "browser_dev", credentials: { username: "runner", password: "secret" },
  });
});

test("persistent isolation requires one safe, non-conflicting workspace name", () => {
  assert.throws(() => resolveTargetConfiguration({ cliTarget: "persistent-isolated", env: {} }), /required for a persistent-isolated target/);
  assert.throws(() => resolveTargetConfiguration({ cliTarget: "persistent-isolated", cliWorkspace: "one", env: { FLUXIQ_TEST_PERSISTENT_WORKSPACE: "two" } }), /conflicts/);
  for (const workspace of ["../escape", "nested/path", "nested\\path", ".", "..", "CON", "nul.txt", "sessions", "persistent-isolated", "has space", "Uppercase", "trailing-", "a".repeat(65)]) {
    assert.throws(() => resolveTargetConfiguration({ cliTarget: "persistent-isolated", cliWorkspace: workspace, env: {} }), /workspace|portable|reserved|64 characters/i, workspace);
  }
});

test("persistent isolation rejects existing-install and execution-source options", () => {
  assert.throws(() => resolveTargetConfiguration({ cliTarget: "persistent-isolated", cliWorkspace: "dev", cliFlowId: "flow-1", env: {} }), /--flow/);
  assert.throws(() => resolveTargetConfiguration({ cliTarget: "persistent-isolated", cliWorkspace: "dev", cliFreshLogin: true, env: {} }), /--fresh-login/);
  assert.throws(() => resolveTargetConfiguration({ cliTarget: "persistent-isolated", cliWorkspace: "dev", env: { FLUXIQ_TEST_BASE_URL: "http://127.0.0.1:3000" } }), /FLUXIQ_TEST_BASE_URL/);
  assert.throws(() => resolveTargetConfiguration({ cliTarget: "existing", cliWorkspace: "dev", env: existingEnvironment }), /persistent-isolated/);
  assert.throws(() => resolveTargetConfiguration({ env: { FLUXIQ_TEST_PERSISTENT_WORKSPACE: "dev" } }), /persistent-isolated/);
});

test("resolves an explicit existing installation and lets CLI flow override the environment", () => {
  assert.deepEqual(resolveTargetConfiguration({ cliTarget: "existing", cliFlowId: "flow-cli", env: existingEnvironment }), {
    mode: "existing",
    baseUrl: "http://127.0.0.1:3000",
    gatewayUrl: "ws://127.0.0.1:3100/client",
    projectId: "project-1",
    flowId: "flow-cli",
    credentials: { username: "runner", password: "secret", authorizationPin: "123456" },
  });
});

test("fresh login is existing-only and is retained in the typed target", () => {
  const target = resolveTargetConfiguration({ cliFreshLogin: true, env: existingEnvironment });
  assert.equal(target.mode, "existing");
  if (target.mode === "existing") assert.equal(target.freshLogin, true);
  assert.throws(() => resolveTargetConfiguration({ cliFreshLogin: true, env: {} }), /--fresh-login/);
});

test("resolves a clone source without requiring an authorization PIN", () => {
  const target = resolveTargetConfiguration({
    cliTarget: "clone",
    cliFlowId: "flow.clone",
    cliFreshLogin: true,
    env: { ...existingEnvironment, FLUXIQ_TEST_TARGET: "clone", FLUXIQ_TEST_PIN: undefined },
  });
  assert.deepEqual(target, {
    mode: "clone",
    source: {
      baseUrl: "http://127.0.0.1:3000",
      projectId: "project-1",
      flowId: "flow.clone",
      credentials: { username: "runner", password: "secret" },
    },
    freshLogin: true,
  });
});

test("resolves auth cache scope without requiring execution credentials or Flow configuration", () => {
  assert.deepEqual(resolveAuthScopeConfiguration({ FLUXIQ_TEST_TARGET: "existing", FLUXIQ_TEST_BASE_URL: "https://panel.example.test/", FLUXIQ_TEST_USERNAME: "runner" }), {
    mode: "existing", origin: "https://panel.example.test", username: "runner",
  });
  assert.throws(() => resolveAuthScopeConfiguration({ FLUXIQ_TEST_BASE_URL: "http://127.0.0.1:3000", FLUXIQ_TEST_USERNAME: "runner" }), /TARGET=existing/);
  assert.throws(() => resolveAuthScopeConfiguration({ FLUXIQ_TEST_TARGET: "existing", FLUXIQ_TEST_USERNAME: "runner" }), /BASE_URL is required/);
});

test("auth cache controls scope clone authentication to the read-only source", () => {
  assert.deepEqual(resolveAuthScopeConfiguration({ FLUXIQ_TEST_TARGET: "clone", FLUXIQ_TEST_BASE_URL: "https://source.example.test", FLUXIQ_TEST_USERNAME: "runner" }), {
    mode: "clone", origin: "https://source.example.test", username: "runner",
  });
});

test("clone cache controls require the complete exact clone source scope", () => {
  assert.deepEqual(resolveCloneCacheScopeConfiguration({ ...existingEnvironment, FLUXIQ_TEST_TARGET: "clone" }), {
    origin: "http://127.0.0.1:3000", username: "runner", projectId: "project-1", flowId: "flow-1",
  });
  assert.throws(() => resolveCloneCacheScopeConfiguration(existingEnvironment), /TARGET=clone/);
});

test("fails fast for mixed targets and incomplete existing configuration", () => {
  assert.throws(() => resolveTargetConfiguration({ cliTarget: "isolated", env: existingEnvironment }), /conflicts/);
  assert.throws(() => resolveTargetConfiguration({ env: { FLUXIQ_TEST_BASE_URL: "http:\/\/127.0.0.1:3000" } }), /isolated target/);
  assert.throws(() => resolveTargetConfiguration({ cliTarget: "existing", env: { FLUXIQ_TEST_TARGET: "existing" } }), /BASE_URL is required/);
  assert.throws(() => resolveTargetConfiguration({ cliTarget: "existing", env: { ...existingEnvironment, FLUXIQ_TEST_BASE_URL: "file:\/\/unsafe" } }), /must use http/);
  assert.throws(() => resolveTargetConfiguration({ cliTarget: "existing", env: { ...existingEnvironment, FLUXIQ_TEST_BASE_URL: "https:\/\/panel.example.test\/nested" } }), /exact origin/);
  assert.throws(() => resolveAuthScopeConfiguration({ FLUXIQ_TEST_TARGET: "existing", FLUXIQ_TEST_BASE_URL: "https://panel.example.test/nested", FLUXIQ_TEST_USERNAME: "runner" }), /exact origin/);
  assert.throws(() => resolveTargetConfiguration({ cliTarget: "existing", env: { ...existingEnvironment, FLUXIQ_TEST_GATEWAY_URL: "ws:\/\/gateway.example.test\/client" } }), /must use wss/);
  assert.equal(resolveTargetConfiguration({ cliTarget: "existing", env: { ...existingEnvironment, FLUXIQ_TEST_GATEWAY_URL: "wss:\/\/gateway.example.test\/client" } }).mode, "existing");
  assert.equal(resolveTargetConfiguration({ cliTarget: "existing", env: { ...existingEnvironment, FLUXIQ_TEST_GATEWAY_URL: "ws:\/\/[::1]:3100\/client" } }).mode, "existing");
  assert.throws(() => resolveTargetConfiguration({ cliTarget: "isolated", cliFlowId: "flow-1", env: {} }), /isolated target/);
});

test("loads .env then .env.local with process environment taking precedence", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-target-config-"));
  try {
    await writeFile(path.join(root, ".env"), "FLUXIQ_TEST_TARGET=existing\nFLUXIQ_TEST_FLOW_ID=from-env\n", "utf8");
    await writeFile(path.join(root, ".env.local"), "FLUXIQ_TEST_FLOW_ID='from-local'\nFLUXIQ_TEST_PROJECT_ID=local-project # comment\n", "utf8");
    const result = await loadTestEnvironment(root, { FLUXIQ_TEST_FLOW_ID: "from-process" });
    assert.equal(result.FLUXIQ_TEST_TARGET, "existing");
    assert.equal(result.FLUXIQ_TEST_PROJECT_ID, "local-project");
    assert.equal(result.FLUXIQ_TEST_FLOW_ID, "from-process");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("dotenv parser rejects malformed assignments and supports quoted values", () => {
  assert.deepEqual(parseEnvironmentFile("export A=plain # comment\nB=\"two words\"\nC='literal'\n"), { A: "plain", B: "two words", C: "literal" });
  assert.throws(() => parseEnvironmentFile("not an assignment"), /line 1/);
  assert.throws(() => parseEnvironmentFile("A=\"unterminated"), /Unterminated/);
});
