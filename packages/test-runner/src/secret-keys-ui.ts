import type { Page, Response } from "@playwright/test";
import type { BrowserEvidenceRecorder } from "./browser-evidence.js";
import { RunnerFailure } from "./failure.js";

export const TESTING_LAB_DEEPSEEK_KEY_NAME = "FluxIQ Testing Lab DeepSeek";
const SECRET_KEYS_PATH = "/programs/secret-keys";
const SNAPSHOT_PATH = "/api/programs/secret-keys/snapshot";
const CREATE_PATH = "/api/programs/secret-keys/create-key";
const MAX_RESPONSE_BYTES = 1024 * 1024;

type SecretKeyMetadata = {
  id: string;
  name: string;
  kind: "llm" | "custom";
  provider?: string;
  scope: "global" | "domain" | "flow" | "custom";
  scopeRef?: string;
  enabled: boolean;
  model?: string;
};

export type OpaqueSecretKeyReference = Readonly<{ id: string; name: string }>;

export type EnsureDeepSeekKeyInput = {
  page: Page;
  evidence: BrowserEvidenceRecorder;
  origin: string;
  secretValue: string;
  authorizationPassword: string;
  authorizationPin?: string;
  keyName?: string;
};

export function deepSeekSecretFromDriverEnvironment(environment: NodeJS.ProcessEnv): string {
  return sensitiveValue(environment.DEEPSEEK_API_KEY, "DeepSeek API key");
}

/**
 * Creates or reuses the Testing Lab's global DeepSeek key through the real
 * Programs UI. Secret values never become part of the returned result.
 */
export async function ensureDeepSeekKeyViaUi(input: EnsureDeepSeekKeyInput): Promise<OpaqueSecretKeyReference> {
  const origin = exactOrigin(input.origin);
  const secretValue = sensitiveValue(input.secretValue, "DeepSeek API key");
  const authorizationPassword = sensitiveValue(input.authorizationPassword, "authorization password");
  const authorizationPin = input.authorizationPin === undefined ? undefined : boundedPin(input.authorizationPin);
  const redactionLiterals = [secretValue, authorizationPassword, ...(authorizationPin ? [authorizationPin] : [])];
  const keyName = safeMetadataText(input.keyName ?? TESTING_LAB_DEEPSEEK_KEY_NAME, "key name", 128, redactionLiterals);
  const page = input.page;
  const evidence = input.evidence;

  try {
    const snapshotResponse = await evidence.step("panel", "secret-keys-open", "Open the FluxIQ Secret Keys program", async () => {
      const response = page.waitForResponse(candidate => endpoint(candidate, origin, SNAPSHOT_PATH), { timeout: 30_000 });
      await page.goto(origin + SECRET_KEYS_PATH, { waitUntil: "domcontentloaded" });
      return response;
    });
    await page.getByText("Secret Keys", { exact: true }).first().waitFor({ timeout: 30_000 });
    const keys = parseSnapshot(await responseJson(snapshotResponse), redactionLiterals);
    const named = keys.filter(key => key.name === keyName);
    if (named.length > 1) throw new Error("duplicate key metadata");
    if (named.length === 1) {
      const reusable = named[0]!;
      assertReusableDeepSeekKey(reusable);
      await evidence.step("panel", "secret-keys-reuse-search", "Verify the saved DeepSeek key in the Secret Keys UI", async () => {
        await page.getByRole("searchbox", { name: "Search secret keys" }).fill(keyName);
        await page.getByText(keyName, { exact: true }).first().waitFor({ timeout: 10_000 });
      });
      return opaqueReference(reusable);
    }

    return await createDeepSeekKey(page, evidence, origin, keyName, secretValue, authorizationPassword, authorizationPin, redactionLiterals);
  } catch {
    throw new RunnerFailure("environment.missing", "The DeepSeek key could not be safely created or reused through the FluxIQ Secret Keys UI");
  }
}

async function createDeepSeekKey(
  page: Page,
  evidence: BrowserEvidenceRecorder,
  origin: string,
  keyName: string,
  secretValue: string,
  authorizationPassword: string,
  authorizationPin: string | undefined,
  redactionLiterals: readonly string[],
): Promise<OpaqueSecretKeyReference> {
  try {
    await evidence.step("panel", "secret-key-add-open", "Open the Add Secret Key dialog", () => page.getByRole("button", { name: "Add Key" }).click());
    const form = page.getByRole("dialog", { name: "Add Secret Key" });
    await evidence.step("panel", "secret-key-name", "Name the Testing Lab DeepSeek key", () => form.getByLabel("Name").fill(keyName));
    await evidence.step("panel", "secret-key-type", "Choose the LLM key type", () => form.getByLabel("Type").selectOption("llm"));
    await evidence.step("panel", "secret-key-provider", "Choose the DeepSeek provider", () => form.getByLabel("Provider").selectOption("DeepSeek"));
    await evidence.step("panel", "secret-key-model", "Scope the key to the DeepSeek chat model", () => form.getByLabel("Model").fill("deepseek-chat"));
    await evidence.step("panel", "secret-key-scope", "Use global runtime scope for the Testing Lab key", () => form.getByLabel("Scope").selectOption("global"));
    await evidence.step("panel", "secret-key-description", "Describe the Testing Lab key", () => form.getByLabel("Description").fill("Testing Lab live-provider certification"));
    await evidence.step("panel", "secret-key-value", "Enter the DeepSeek secret value", () => form.getByLabel("Secret value").fill(secretValue), { sensitive: true });
    await evidence.step("panel", "secret-key-continue", "Continue to Secret Key authorization", () => form.getByRole("button", { name: "Continue" }).click(), { sensitive: true });

    const authorization = page.getByRole("dialog", { name: "Authorize New Key" });
    await evidence.step("panel", "secret-key-password", "Enter Secret Key authorization password", () => authorization.getByLabel("Your password").fill(authorizationPassword), { sensitive: true });
    if (authorizationPin !== undefined) {
      await evidence.step("panel", "secret-key-pin", "Enter Secret Key authorization PIN", () => authorization.getByLabel("Your PIN").fill(authorizationPin), { sensitive: true });
    }
    const createResponse = await evidence.step("panel", "secret-key-save", "Save the encrypted DeepSeek key", async () => {
      const response = page.waitForResponse(candidate => endpoint(candidate, origin, CREATE_PATH), { timeout: 30_000 });
      await authorization.getByRole("button", { name: "Save Key" }).click();
      return response;
    }, { sensitive: true });
    if (!createResponse.ok()) throw new Error("key creation response failed");
    const created = parseMutation(await responseJson(createResponse), redactionLiterals);
    assertReusableDeepSeekKey(created);
    if (created.name !== keyName) throw new Error("created key identity mismatch");
    await authorization.waitFor({ state: "hidden", timeout: 30_000 });
    return opaqueReference(created);
  } finally {
    await evidence.step("panel", "secret-key-sensitive-clear", "Clear Secret Keys credential fields from the page", async () => {
      await page.evaluate(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('input[type="password"], input[inputmode="numeric"]');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        for (const input of inputs) {
          if (setter) setter.call(input, ""); else input.value = "";
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      await page.goto(origin + SECRET_KEYS_PATH, { waitUntil: "domcontentloaded" });
    }, { sensitive: true });
  }
}

function endpoint(response: Response, origin: string, pathname: string): boolean {
  try {
    const url = new URL(response.url());
    return url.origin === origin && url.pathname === pathname;
  } catch { return false; }
}

async function responseJson(response: Response): Promise<unknown> {
  const bytes = await response.body();
  if (bytes.byteLength > MAX_RESPONSE_BYTES) throw new Error("program response exceeded the metadata limit");
  return JSON.parse(bytes.toString("utf8"));
}

function parseSnapshot(input: unknown, redactionLiterals: readonly string[]): SecretKeyMetadata[] {
  const payload = envelopePayload(input);
  if (!record(payload) || !Array.isArray(payload.keys) || payload.keys.length > 10_000) throw new Error("invalid Secret Keys snapshot");
  return payload.keys.map(value => parseKey(value, redactionLiterals));
}

function parseMutation(input: unknown, redactionLiterals: readonly string[]): SecretKeyMetadata {
  return parseKey(envelopePayload(input), redactionLiterals);
}

function envelopePayload(input: unknown): unknown {
  if (!record(input) || input.ok !== true || !("payload" in input)) throw new Error("invalid Programs response");
  return input.payload;
}

function parseKey(input: unknown, redactionLiterals: readonly string[]): SecretKeyMetadata {
  if (!record(input)) throw new Error("invalid Secret Key metadata");
  const id = safeMetadataId(input.id, redactionLiterals);
  const name = safeMetadataText(input.name, "key name", 128, redactionLiterals);
  if (input.kind !== "llm" && input.kind !== "custom") throw new Error("invalid key kind");
  if (!(["global", "domain", "flow", "custom"] as unknown[]).includes(input.scope)) throw new Error("invalid key scope");
  if (typeof input.enabled !== "boolean") throw new Error("invalid key status");
  const provider = input.provider === undefined ? undefined : boundedText(input.provider, "provider", 128);
  const scopeRef = input.scopeRef === undefined ? undefined : boundedText(input.scopeRef, "scope reference", 256);
  const modelValue = record(input.metadata) ? input.metadata.model : undefined;
  const model = modelValue === undefined ? undefined : boundedText(modelValue, "model", 128);
  return { id, name, kind: input.kind, scope: input.scope as SecretKeyMetadata["scope"], enabled: input.enabled, ...(provider ? { provider } : {}), ...(scopeRef ? { scopeRef } : {}), ...(model ? { model } : {}) };
}

function assertReusableDeepSeekKey(key: SecretKeyMetadata): void {
  if (key.kind !== "llm" || key.provider !== "DeepSeek" || key.scope !== "global" || key.scopeRef !== undefined || key.enabled !== true || (key.model !== undefined && key.model !== "deepseek-chat")) {
    throw new Error("the named Secret Key is incompatible");
  }
}

function opaqueReference(key: SecretKeyMetadata): OpaqueSecretKeyReference {
  return Object.freeze({ id: key.id, name: key.name });
}

function exactOrigin(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("invalid panel origin"); }
  if (!(["http:", "https:"] as string[]).includes(url.protocol) || url.origin !== value || url.username || url.password) throw new Error("invalid panel origin");
  return url.origin;
}

function sensitiveValue(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 16_384) throw new Error(`${label} is unavailable`);
  return value;
}

function boundedPin(value: string): string {
  if (!/^\d{4,32}$/u.test(value)) throw new Error("authorization PIN is unavailable");
  return value;
}

function boundedText(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error(`invalid ${label}`);
  return value;
}

function safeMetadataId(value: unknown, redactionLiterals: readonly string[]): string {
  const id = safeMetadataText(value, "key ID", 256, redactionLiterals);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(id)) throw new Error("invalid key ID");
  return id;
}

function safeMetadataText(value: unknown, label: string, maximum: number, redactionLiterals: readonly string[]): string {
  const result = boundedText(value, label, maximum);
  if (redactionLiterals.some(secret => result.includes(secret))) throw new Error(`invalid ${label}`);
  return result;
}

function record(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
