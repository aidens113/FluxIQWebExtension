import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
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
