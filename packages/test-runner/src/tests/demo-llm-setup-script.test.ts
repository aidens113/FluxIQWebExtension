import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PROVIDER_SECRET_ENVIRONMENT_VARIABLES } from "../environment.js";

const repositoryFile = (relative: string) => new URL(`../../../../${relative}`, import.meta.url);

test("exposes a persistent UI-only DeepSeek setup command with sanitized output", async () => {
  const packageJson = JSON.parse(await readFile(repositoryFile("package.json"), "utf8")) as { scripts?: Record<string, string> };
  const command = packageJson.scripts?.["demo:llm:setup"] ?? "";
  assert.equal(command, "node scripts/setup-demo-llm-key.mjs");

  const wrapper = await readFile(repositoryFile("scripts/setup-demo-llm-key.mjs"), "utf8");
  assert.match(wrapper, /@fluxiq-web-extension\/scenario-lab/u);
  assert.match(wrapper, /@fluxiq-web-extension\/extension/u);
  assert.match(wrapper, /@fluxiq-web-extension\/test-runner\.\.\./u);
  assert.match(wrapper, /withoutProviderSecrets\(process\.env\)/u);
  assert.match(wrapper, /setupDemoWorkspaceDeepSeekKey/u);
  assert.match(wrapper, /certifyDemoLlmSetupArtifacts/u);
  assert.match(wrapper, /status: "configured", keyName: key\.name, attestation/u);
  assert.doesNotMatch(wrapper, /keyId|key\.id/u);
  assert.match(wrapper, /DeepSeek Secret Keys UI setup failed/u);
  assert.doesNotMatch(wrapper, /error\.message|String\(error\)|runDemoWorkspaceFlow|adaptive/u);
});

test("persistent setup composes the existing lock, Core, auth, browser evidence, and in-memory redaction seams", async () => {
  const source = await readFile(repositoryFile("packages/test-runner/src/demo-workspace.ts"), "utf8");
  const start = source.indexOf("export async function setupDemoWorkspaceDeepSeekKey");
  const end = source.indexOf("export async function recordDemoWorkspace", start);
  assert.ok(start >= 0 && end > start);
  const setup = source.slice(start, end);
  for (const seam of ["deepSeekSecretFromDriverEnvironment", "withWorkspaceLock", "withPersistentDemoCore", "authenticatedControl", "withDemoBrowser", "ensureDeepSeekKeyViaUi"]) assert.match(setup, new RegExp(seam, "u"));
  assert.match(setup, /\[secretValue, config\.password, config\.pin/u);
  assert.doesNotMatch(setup, /saveWorkspaceState|runDemo|adaptive|provider request/iu);
});
