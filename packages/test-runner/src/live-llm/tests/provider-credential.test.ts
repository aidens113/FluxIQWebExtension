import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { RunnerFailure } from "../../failure.js";
import { loadTestEnvironment } from "../../target-config.js";
import { resolveLiveLlmProviderCredential } from "../provider-credential.js";

/**
 * The trap this reader exists for: `FLUXIQ_TEST_ENV_FILES=none` is how an
 * isolated run refuses a machine's saved existing-install configuration, and it
 * took the provider key out with it. These pin that the key still arrives under
 * `none`, that nothing else in the file does, and that an absent key is a
 * refusal naming what is missing rather than a quiet fall back.
 */

function repository(context: TestContext, contents: string): string {
  const root = mkdtempSync(path.join(tmpdir(), "fluxiq-live-llm-credential-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(path.join(root, ".env.local"), contents, "utf8");
  return root;
}

test("Claude reads only its credential from the isolated checkout and never falls back to DeepSeek", async (context: TestContext) => {
  const root = repository(context, "CLAUDE_API_KEY=fixture-claude-0123456789\nDEEPSEEK_API_KEY=fixture-deepseek-0123456789\nFLUXIQ_TEST_TARGET=existing\n");
  const found = await resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: { FLUXIQ_TEST_ENV_FILES: "none" }, provider: "anthropic" });
  assert.deepEqual(found, { name: "CLAUDE_API_KEY", source: ".env.local", value: "fixture-claude-0123456789" });
  writeFileSync(path.join(root, ".env.local"), "DEEPSEEK_API_KEY=fixture-deepseek-0123456789\n");
  await assert.rejects(resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: {}, provider: "anthropic" }), /CLAUDE_API_KEY/u);
});

test("Claude's standard alias works while the requested name has priority", async (context: TestContext) => {
  const root = repository(context, "ANTHROPIC_API_KEY=fixture-alias-0123456789\n");
  assert.equal((await resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: {}, provider: "anthropic" })).name, "ANTHROPIC_API_KEY");
  const found = await resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: { CLAUDE_API_KEY: "fixture-primary-0123456789", ANTHROPIC_API_KEY: "fixture-other-0123456789" }, provider: "anthropic" });
  assert.equal(found.name, "CLAUDE_API_KEY");
  assert.equal(found.value, "fixture-primary-0123456789");
  writeFileSync(path.join(root, ".env"), "ANTHROPIC_API_KEY=fixture-old-alias-0123456789\n");
  writeFileSync(path.join(root, ".env.local"), "CLAUDE_API_KEY=fixture-local-primary-0123456789\n");
  assert.equal((await resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: {}, provider: "anthropic" })).name, "CLAUDE_API_KEY");
  const explicit = await resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: { ANTHROPIC_API_KEY: "fixture-process-alias-0123456789" }, provider: "anthropic" });
  assert.equal(explicit.value, "fixture-process-alias-0123456789");
});

test("the key is read from .env.local even when env files are switched off for isolation", async (context: TestContext) => {
  const root = repository(context, "FLUXIQ_TEST_TARGET=existing\nFLUXIQ_TEST_BASE_URL=http://127.0.0.1:3300\nDEEPSEEK_API_KEY=sk-from-file-0123456789\n");
  const credential = await resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: { FLUXIQ_TEST_ENV_FILES: "none" }, provider: "deepseek" });
  assert.equal(credential.value, "sk-from-file-0123456789");
  assert.equal(credential.name, "DEEPSEEK_API_KEY");
  assert.equal(credential.source, ".env.local");
});

test("nothing but the credential leaves the file", async (context: TestContext) => {
  const root = repository(context, "FLUXIQ_TEST_TARGET=existing\nDEEPSEEK_API_KEY=sk-from-file-0123456789\n");
  const credential = await resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: { FLUXIQ_TEST_ENV_FILES: "none" }, provider: "deepseek" });
  assert.deepEqual(Object.keys(credential).sort(), ["name", "source", "value"]);
});

test("the process environment wins over the file", async (context: TestContext) => {
  const root = repository(context, "DEEPSEEK_API_KEY=sk-from-file-0123456789\n");
  const credential = await resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: { DEEPSEEK_API_KEY: "sk-from-process-0123456789" }, provider: "deepseek" });
  assert.equal(credential.value, "sk-from-process-0123456789");
  assert.equal(credential.source, "the process environment");
});

test("an absent key is a refusal naming the variable and where it was looked for", async (context: TestContext) => {
  const root = repository(context, "FLUXIQ_TEST_TARGET=existing\n");
  await assert.rejects(
    () => resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: {}, provider: "deepseek" }),
    /DEEPSEEK_API_KEY is not set in the environment and no \.env or \.env\.local in .* declares it/u,
  );
});

test("an empty key is refused rather than sent to a provider", async (context: TestContext) => {
  const root = repository(context, "DEEPSEEK_API_KEY=\n");
  await assert.rejects(() => resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: {}, provider: "deepseek" }), /is set but empty/u);
  await assert.rejects(() => resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: { DEEPSEEK_API_KEY: "   " }, provider: "deepseek" }), /is set but empty/u);
});

/**
 * `FLUXIQ_TEST_ENV_FILES=none` keeps the key, on purpose (above). These pin the
 * explicit way to say otherwise, `FLUXIQ_PROVIDER_KEY_FILES=none`, and the
 * fence that keeps any real key out of a test whatever the switches say.
 */
test("FLUXIQ_PROVIDER_KEY_FILES=none reads no key from any env file, and names itself in the refusal", async (context: TestContext) => {
  const root = repository(context, "DEEPSEEK_API_KEY=sk-from-file-0123456789\n");
  writeFileSync(path.join(root, ".env"), "DEEPSEEK_API_KEY=sk-from-dotenv-0123456789\n", "utf8");
  await assert.rejects(
    () => resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: { FLUXIQ_TEST_ENV_FILES: "none", FLUXIQ_PROVIDER_KEY_FILES: "none" }, provider: "deepseek" }),
    (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing"
      && /DEEPSEEK_API_KEY is not set in the environment, and FLUXIQ_PROVIDER_KEY_FILES=none keeps it from being read from \.env or \.env\.local/u.test(error.message)
      && !error.message.includes("sk-from"),
  );
  const fromProcess = await resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: { FLUXIQ_PROVIDER_KEY_FILES: "none", DEEPSEEK_API_KEY: "sk-from-process-0123456789" }, provider: "deepseek" });
  assert.equal(fromProcess.source, "the process environment");
});

test("a key loadTestEnvironment folded in from a file is named by that file, and dropped under FLUXIQ_PROVIDER_KEY_FILES=none", async (context: TestContext) => {
  const root = repository(context, "DEEPSEEK_API_KEY=sk-from-file-0123456789\n");
  const folded = await loadTestEnvironment(root, {});
  const credential = await resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: folded, provider: "deepseek" });
  assert.equal(credential.source, ".env.local", "the file, never \"the process environment\"");
  const switchedOff = await loadTestEnvironment(root, { FLUXIQ_PROVIDER_KEY_FILES: "none" });
  assert.equal(switchedOff.DEEPSEEK_API_KEY, "sk-from-file-0123456789", "the target configuration reader still folds it in");
  await assert.rejects(() => resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: switchedOff, provider: "deepseek" }), /FLUXIQ_PROVIDER_KEY_FILES=none keeps it from being read/u);
});

test("FLUXIQ_PROVIDER_KEY_FILES takes only none", async (context: TestContext) => {
  const root = repository(context, "DEEPSEEK_API_KEY=sk-from-file-0123456789\n");
  await assert.rejects(() => resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: { FLUXIQ_PROVIDER_KEY_FILES: "local" }, provider: "deepseek" }), /FLUXIQ_PROVIDER_KEY_FILES must be none when set/u);
});

test("a test cannot read the key from a checkout's env files, even with every switch left on", async () => {
  // This package's own directory: a real checkout, never a temporary one. Refused before any file is opened.
  const checkout = path.resolve(import.meta.dirname, "..", "..", "..");
  await assert.rejects(
    () => resolveLiveLlmProviderCredential({ repositoryRoot: checkout, environment: {}, provider: "deepseek" }),
    /A test may read \.env only from a temporary directory it made/u,
  );
});

test("a test cannot use a key it inherited from the shell that started it", async (context: TestContext) => {
  const root = repository(context, "");
  const previous = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "sk-inherited-0123456789";
  context.after(() => { if (previous === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = previous; });
  await assert.rejects(
    () => resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: { ...process.env }, provider: "deepseek" }),
    /came from the environment of the process running the tests/u,
  );
  const standIn = await resolveLiveLlmProviderCredential({ repositoryRoot: root, environment: { DEEPSEEK_API_KEY: "sk-stand-in-0123456789" }, provider: "deepseek" });
  assert.equal(standIn.value, "sk-stand-in-0123456789");
});
