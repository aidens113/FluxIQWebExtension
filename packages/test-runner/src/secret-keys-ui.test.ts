import assert from "node:assert/strict";
import test from "node:test";
import type { Page, Response } from "@playwright/test";
import type { BrowserEvidenceRecorder } from "./browser-evidence.js";
import { TESTING_LAB_DEEPSEEK_KEY_NAME, deepSeekSecretFromDriverEnvironment, ensureDeepSeekKeyViaUi } from "./secret-keys-ui.js";

type RecordedStep = { id: string; summary: string; sensitive: boolean };

class FakeResponse {
  constructor(private readonly endpointUrl: string, private readonly value: unknown, private readonly successful = true) {}
  url() { return this.endpointUrl; }
  ok() { return this.successful; }
  async body() { return Buffer.from(JSON.stringify(this.value)); }
}

class FakeLocator {
  constructor(private readonly page: FakePage, private readonly identity: string) { this.page.locators.push(identity); }
  getByLabel(name: string) { return new FakeLocator(this.page, `${this.identity} label:${name}`); }
  getByRole(role: string, options?: { name?: string }) { return new FakeLocator(this.page, `${this.identity} role:${role}:${options?.name ?? ""}`); }
  first() { return this; }
  async fill(_value: string) { this.page.operations.push(`fill:${this.identity}`); }
  async selectOption(value: string) { this.page.operations.push(`select:${this.identity}:${value}`); }
  async click() { this.page.operations.push(`click:${this.identity}`); }
  async waitFor() { this.page.operations.push(`wait:${this.identity}`); }
}

class FakePage {
  readonly operations: string[] = [];
  readonly locators: string[] = [];
  cleanupEvaluated = false;
  constructor(private readonly responses: FakeResponse[]) {}
  async waitForResponse(predicate: (response: Response) => boolean) {
    const response = this.responses.shift();
    if (!response || !predicate(response as unknown as Response)) throw new Error("unexpected response wait");
    return response as unknown as Response;
  }
  async goto(url: string) { this.operations.push(`goto:${url}`); return null; }
  getByRole(role: string, options?: { name?: string }) { return new FakeLocator(this, `page role:${role}:${options?.name ?? ""}`); }
  getByText(text: string) { return new FakeLocator(this, `page text:${text}`); }
  async evaluate() { this.cleanupEvaluated = true; this.operations.push("evaluate:clear-credential-fields"); }
}

class FakeEvidence {
  readonly steps: RecordedStep[] = [];
  async step<T>(_surface: string, id: string, summary: string, action: () => Promise<T>, options: { sensitive?: boolean } = {}): Promise<T> {
    this.steps.push({ id, summary, sensitive: options.sensitive === true });
    return action();
  }
}

const metadata = {
  id: "secret.deepseek.testing-lab",
  name: TESTING_LAB_DEEPSEEK_KEY_NAME,
  kind: "llm",
  provider: "DeepSeek",
  scope: "global",
  enabled: true,
  metadata: { model: "deepseek-chat" },
};
const envelope = (payload: unknown) => ({ ok: true, payload });
const origin = "http://127.0.0.1:3210";

function pageWith(...values: Array<{ path: string; payload: unknown }>) {
  return new FakePage(values.map(value => new FakeResponse(origin + value.path, envelope(value.payload))));
}

test("creates a DeepSeek key through sensitive UI boundaries and returns only opaque metadata", async () => {
  const secret = "deepseek-synthetic-sentinel";
  const password = "password-synthetic-sentinel";
  const pin = "654321";
  const page = pageWith(
    { path: "/api/programs/secret-keys/snapshot", payload: { keys: [] } },
    { path: "/api/programs/secret-keys/create-key", payload: metadata },
  );
  const evidence = new FakeEvidence();
  const result = await ensureDeepSeekKeyViaUi({
    page: page as unknown as Page,
    evidence: evidence as unknown as BrowserEvidenceRecorder,
    origin,
    secretValue: secret,
    authorizationPassword: password,
    authorizationPin: pin,
  });

  assert.deepEqual(result, { id: metadata.id, name: metadata.name });
  const serializedOutput = JSON.stringify({ result, steps: evidence.steps, operations: page.operations });
  for (const sensitive of [secret, password, pin]) assert.equal(serializedOutput.includes(sensitive), false);
  for (const id of ["secret-key-value", "secret-key-continue", "secret-key-password", "secret-key-pin", "secret-key-save", "secret-key-sensitive-clear"]) {
    assert.equal(evidence.steps.find(step => step.id === id)?.sensitive, true, `${id} was not screenshot-suppressed`);
  }
  assert.equal(page.cleanupEvaluated, true);
  assert.equal(page.locators.some(locator => /Reveal/u.test(locator)), false);
});

test("reuses the same compatible key idempotently without opening creation or Reveal", async () => {
  const page = pageWith(
    { path: "/api/programs/secret-keys/snapshot", payload: { keys: [metadata] } },
    { path: "/api/programs/secret-keys/snapshot", payload: { keys: [metadata] } },
  );
  const evidence = new FakeEvidence();
  const input = {
    page: page as unknown as Page,
    evidence: evidence as unknown as BrowserEvidenceRecorder,
    origin,
    secretValue: "unused-synthetic-sentinel",
    authorizationPassword: "unused-password-sentinel",
    authorizationPin: "654321",
  };
  const first = await ensureDeepSeekKeyViaUi(input);
  const second = await ensureDeepSeekKeyViaUi(input);
  assert.deepEqual(second, first);
  assert.equal(page.operations.some(operation => operation.includes("Add Key")), false);
  assert.equal(page.locators.some(locator => /Reveal/u.test(locator)), false);
  assert.equal(evidence.steps.filter(step => step.id === "secret-keys-reuse-search").length, 2);
});

test("reads the provider value only from the supplied driver environment and sanitizes failures", async () => {
  assert.equal(deepSeekSecretFromDriverEnvironment({ DEEPSEEK_API_KEY: "driver-only-sentinel" }), "driver-only-sentinel");
  const page = pageWith({ path: "/api/programs/secret-keys/snapshot", payload: { keys: [{ ...metadata, provider: "OpenAI" }] } });
  const evidence = new FakeEvidence();
  await assert.rejects(
    () => ensureDeepSeekKeyViaUi({ page: page as unknown as Page, evidence: evidence as unknown as BrowserEvidenceRecorder, origin, secretValue: "error-secret-sentinel", authorizationPassword: "error-password-sentinel", authorizationPin: "654321" }),
    (error: unknown) => error instanceof Error && !error.message.includes("error-secret-sentinel") && !error.message.includes("error-password-sentinel") && !error.message.includes("654321") && /safely created or reused/u.test(error.message),
  );
});

test("rejects secret-bearing or unsafe response metadata without echoing it", async () => {
  const secret = "metadata-secret-synthetic-sentinel";
  for (const unsafeMetadata of [
    { ...metadata, id: `prefix.${secret}.suffix` },
    { ...metadata, id: "unsafe id with spaces" },
    { ...metadata, name: `prefix ${secret} suffix` },
  ]) {
    const page = pageWith({ path: "/api/programs/secret-keys/snapshot", payload: { keys: [unsafeMetadata] } });
    await assert.rejects(
      ensureDeepSeekKeyViaUi({
        page: page as unknown as Page,
        evidence: new FakeEvidence() as unknown as BrowserEvidenceRecorder,
        origin,
        secretValue: secret,
        authorizationPassword: "metadata-password-sentinel",
        authorizationPin: "654321",
      }),
      error => error instanceof Error
        && error.message === "The DeepSeek key could not be safely created or reused through the FluxIQ Secret Keys UI"
        && !error.message.includes(secret),
    );
  }
});
