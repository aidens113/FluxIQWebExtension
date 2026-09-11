import { createHash, randomBytes } from "node:crypto";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { chromium, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { removeRunOwnedTopologyState, startTopology, type RunningTopology } from "./coordinator.js";
import { withoutProviderSecrets } from "./environment.js";
import { ExistingFluxIQControlClient } from "./existing-fluxiq-control.js";
import { WebPanelAuthSessionCache } from "./auth-session.js";
import { installDeterministicNetworkGuard, scenarioNetworkOrigins } from "./network-guard.js";
import { fluxIQSessionCookieDescriptor } from "./panel-verification.js";
import { loadScenarioManifest } from "./scenarios.js";
import type { FluxIQTargetConfiguration } from "./target-config.js";
import { selectOptionByKeyboard } from "./trusted-input/index.js";
import { scenarioLabOriginProof } from "./lab-control/index.js";

const MAX_ACTIONS = 500;
const MAX_LINE_BYTES = 16_384;
const MAX_SELECTOR_LENGTH = 500;
const MAX_WAIT_MS = 10_000;
const SENSITIVE_CONTROL_SELECTOR = [
  'input[type="password"]',
  'input[autocomplete="current-password"]',
  'input[autocomplete="new-password"]',
  'input[autocomplete="one-time-code"]',
  'input[autocomplete^="cc-"]',
  '[data-sensitive="true"]',
].join(",");

export type InteractiveSurface = "scenario" | "panel" | "extension";
export type InteractiveSecretEnvironmentName = "FLUXIQ_TEST_PASSWORD" | "FLUXIQ_TEST_PIN" | "FLUXIQ_TEST_TOTP" | "DEEPSEEK_API_KEY";
export type InteractiveAction =
  | { id?: string; action: "extension-action"; actionType: InteractiveExtensionActionType; selector?: string; text?: string; value?: string; key?: string; timeoutMs?: number }
  | { id?: string; action: "navigate"; surface: InteractiveSurface; path: string }
  | { id?: string; action: "click"; surface: InteractiveSurface; selector: string }
  | { id?: string; action: "fill"; surface: InteractiveSurface; selector: string; value: string; secretEnv?: never }
  | { id?: string; action: "fill"; surface: InteractiveSurface; selector: string; secretEnv: InteractiveSecretEnvironmentName; value?: never }
  | { id?: string; action: "select"; surface: InteractiveSurface; selector: string; value: string }
  | { id?: string; action: "check"; surface: InteractiveSurface; selector: string; checked: boolean }
  | { id?: string; action: "wait"; surface: InteractiveSurface; milliseconds?: number; selector?: string; state?: "attached" | "detached" | "visible" | "hidden" }
  | { id?: string; action: "inspect"; surface: InteractiveSurface }
  | { id?: string; action: "screenshot"; surface: InteractiveSurface }
  | { id?: string; action: "stop" };

export type InteractiveExtensionActionType = "web.dom.click" | "web.dom.type" | "web.dom.clear" | "web.dom.select" | "web.dom.scroll" | "web.dom.keypress" | "web.dom.wait_for_selector" | "web.dom.wait_for_text" | "web.dom.extract" | "web.dom.capture_snapshot";
const INTERACTIVE_EXTENSION_ACTION_TYPES = new Set<InteractiveExtensionActionType>(["web.dom.click", "web.dom.type", "web.dom.clear", "web.dom.select", "web.dom.scroll", "web.dom.keypress", "web.dom.wait_for_selector", "web.dom.wait_for_text", "web.dom.extract", "web.dom.capture_snapshot"]);

export type InteractiveSessionOptions = {
  repositoryRoot: string;
  fluxiqRepositoryRoot: string;
  runsDirectory: string;
  scenarioId: string;
  target: Exclude<FluxIQTargetConfiguration, { mode: "clone" }>;
  seed?: number;
  environment?: NodeJS.ProcessEnv;
  input?: Readable;
  output?: Writable;
};

type InteractivePages = Partial<Record<InteractiveSurface, Page>>;

export function parseInteractiveAction(input: unknown): InteractiveAction {
  const value = object(input);
  const action = text(value.action, "action", 32);
  const id = value.id === undefined ? {} : { id: text(value.id, "id", 100) };
  if (action === "stop") { exactKeys(value, ["id", "action"]); return { ...id, action }; }
  if (action === "extension-action") {
    exactKeys(value, ["id", "action", "actionType", "selector", "text", "value", "key", "timeoutMs"]);
    const actionType = extensionActionType(value.actionType);
    const timeoutMs = value.timeoutMs === undefined ? undefined : boundedInteger(value.timeoutMs, "timeoutMs", 1, MAX_WAIT_MS);
    return { ...id, action, actionType, ...(value.selector === undefined ? {} : { selector: selector(value.selector) }), ...(value.text === undefined ? {} : { text: text(value.text, "text", 8_000, true) }), ...(value.value === undefined ? {} : { value: text(value.value, "value", 8_000, true) }), ...(value.key === undefined ? {} : { key: text(value.key, "key", 100) }), ...(timeoutMs === undefined ? {} : { timeoutMs }) };
  }
  const surface = value.surface;
  if (surface !== "scenario" && surface !== "panel" && surface !== "extension") throw new Error("surface must be scenario, panel, or extension");
  if (action === "navigate") { exactKeys(value, ["id", "action", "surface", "path"]); return { ...id, action, surface, path: text(value.path, "path", 2_000) }; }
  if (action === "click") { exactKeys(value, ["id", "action", "surface", "selector"]); return { ...id, action, surface, selector: selector(value.selector) }; }
  if (action === "fill") {
    exactKeys(value, ["id", "action", "surface", "selector", "value", "secretEnv"]);
    if ((value.value === undefined) === (value.secretEnv === undefined)) throw new Error("fill requires exactly one of value or secretEnv");
    if (value.secretEnv !== undefined) return { ...id, action, surface, selector: selector(value.selector), secretEnv: secretEnvironmentName(value.secretEnv) };
    return { ...id, action, surface, selector: selector(value.selector), value: text(value.value, "value", 8_000, true) };
  }
  if (action === "select") {
    exactKeys(value, ["id", "action", "surface", "selector", "value"]);
    return { ...id, action, surface, selector: selector(value.selector), value: text(value.value, "value", 8_000, true) };
  }
  if (action === "check") {
    exactKeys(value, ["id", "action", "surface", "selector", "checked"]);
    if (typeof value.checked !== "boolean") throw new Error("checked must be boolean");
    return { ...id, action, surface, selector: selector(value.selector), checked: value.checked };
  }
  if (action === "wait") {
    exactKeys(value, ["id", "action", "surface", "milliseconds", "selector", "state"]);
    const milliseconds = value.milliseconds;
    const waitSelector = value.selector;
    if ((milliseconds === undefined) === (waitSelector === undefined)) throw new Error("wait requires exactly one of milliseconds or selector");
    if (milliseconds !== undefined) {
      if (!Number.isSafeInteger(milliseconds) || Number(milliseconds) < 0 || Number(milliseconds) > MAX_WAIT_MS) throw new Error(`milliseconds must be an integer from 0 to ${MAX_WAIT_MS}`);
      return { ...id, action, surface, milliseconds: Number(milliseconds) };
    }
    const state = value.state ?? "visible";
    if (!(["attached", "detached", "visible", "hidden"] as unknown[]).includes(state)) throw new Error("state must be attached, detached, visible, or hidden");
    return { ...id, action, surface, selector: selector(waitSelector), state: state as "attached" | "detached" | "visible" | "hidden" };
  }
  if (action === "inspect" || action === "screenshot") {
    exactKeys(value, ["id", "action", "surface"]);
    return { ...id, action, surface };
  }
  throw new Error("action is not allowlisted");
}

export async function executeInteractiveAction(action: Exclude<InteractiveAction, { action: "stop" }>, pages: InteractivePages, origins: Partial<Record<InteractiveSurface, string>>, artifactsDirectory: string, sequence: number, secretEnvironment: NodeJS.ProcessEnv = {}): Promise<Record<string, unknown>> {
  if (action.action === "extension-action") return executeExtensionAction(action, pages, sequence);
  const page = pages[action.surface];
  const origin = origins[action.surface];
  if (!page || !origin) throw new Error("selected interactive surface is unavailable");
  if (action.action === "navigate") {
    const destination = new URL(action.path, `${origin}/`);
    if (destination.origin !== origin || destination.username || destination.password) throw new Error("navigate path must stay on the selected surface origin");
    await page.goto(destination.href, { waitUntil: "domcontentloaded", timeout: MAX_WAIT_MS });
  } else if (action.action === "click") {
    await page.locator(action.selector).click({ timeout: MAX_WAIT_MS });
  } else if (action.action === "fill") {
    const target = page.locator(action.selector);
    if (action.secretEnv !== undefined) {
      await assertSensitive(target);
      const secret = secretEnvironment[action.secretEnv];
      if (!secret || secret.length > 8_000 || /[\r\n\0]/u.test(secret)) throw new Error("configured sensitive value is unavailable or invalid");
      await target.fill(secret, { timeout: MAX_WAIT_MS });
      return { action: action.action, surface: action.surface, url: page.url(), sensitive: true };
    }
    await assertNotSensitive(target);
    await target.fill(action.value, { timeout: MAX_WAIT_MS });
  } else if (action.action === "select") {
    const target = page.locator(action.selector);
    await assertNotSensitive(target);
    await selectOptionByKeyboard(target, action.value, { timeoutMs: MAX_WAIT_MS });
  } else if (action.action === "check") {
    const target = page.locator(action.selector);
    await assertNotSensitive(target);
    if (action.checked) await target.check({ timeout: MAX_WAIT_MS });
    else await target.uncheck({ timeout: MAX_WAIT_MS });
  } else if (action.action === "wait") {
    if (action.milliseconds !== undefined) await page.waitForTimeout(action.milliseconds);
    else await page.locator(action.selector!).waitFor({ state: action.state ?? "visible", timeout: MAX_WAIT_MS });
  } else if (action.action === "inspect") {
    return { action: action.action, surface: action.surface, url: page.url(), title: await page.title(), structure: await inspectStructure(page) };
  } else {
    if (await page.locator(SENSITIVE_CONTROL_SELECTOR).evaluateAll(elements => elements.some(element => "value" in element && typeof element.value === "string" && element.value.length > 0))) {
      throw new Error("screenshot is blocked while a sensitive control contains a value");
    }
    await mkdir(artifactsDirectory, { recursive: true });
    const fileName = `interactive-${String(sequence).padStart(4, "0")}.png`;
    const bytes = await page.screenshot({ path: path.join(artifactsDirectory, fileName), type: "png", animations: "disabled" });
    return { action: action.action, surface: action.surface, url: page.url(), artifact: fileName, sha256: createHash("sha256").update(bytes).digest("hex") };
  }
  return { action: action.action, surface: action.surface, url: page.url() };
}

async function executeExtensionAction(action: Extract<InteractiveAction, { action: "extension-action" }>, pages: InteractivePages, sequence: number): Promise<Record<string, unknown>> {
  const extension = pages.extension, scenario = pages.scenario;
  if (!extension || !scenario) throw new Error("extension action surfaces are unavailable");
  const result = await extension.evaluate(async ({ targetUrl, command }) => {
    const browser = (globalThis as unknown as { chrome: { tabs: { query(query: Record<string, never>): Promise<Array<{ id?: number; url?: string }>>; sendMessage(id: number, message: unknown): Promise<unknown> } } }).chrome;
    const tabs = await browser.tabs.query({});
    const tab = tabs.find(candidate => candidate.url === targetUrl);
    if (typeof tab?.id !== "number") throw new Error("scenario tab unavailable");
    return browser.tabs.sendMessage(tab.id, { type: "executeAction", topFrameOnly: true, action: command });
  }, { targetUrl: scenario.url(), command: { commandId: `interactive-${sequence}`, actionType: action.actionType, ...(action.selector === undefined ? {} : { selector: action.selector }), ...(action.text === undefined ? {} : { text: action.text }), ...(action.value === undefined ? {} : { value: action.value }), ...(action.key === undefined ? {} : { key: action.key }), ...(action.timeoutMs === undefined ? {} : { timeoutMs: action.timeoutMs }) } }) as unknown;
  const record = object(result);
  const status = record.status;
  if (status !== "succeeded" && status !== "failed" && status !== "timed_out" && status !== "cancelled") throw new Error("extension action returned an invalid status");
  return { action: action.action, actionType: action.actionType, status, surface: "scenario", url: scenario.url() };
}

export async function runInteractiveSession(options: InteractiveSessionOptions): Promise<void> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const environment = options.environment ?? process.env;
  const scenario = await loadScenarioManifest(options.repositoryRoot, options.scenarioId);
  const extensionPath = path.join(options.repositoryRoot, "apps", "extension", "dist", "e2e-chromium");
  await access(extensionPath);
  const runId = `interactive-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  const artifactsDirectory = path.join(options.runsDirectory, "interactive-sessions", runId);
  const topologyRunsDirectory = options.target.mode === "persistent-isolated" ? options.runsDirectory : path.join(options.runsDirectory, ".interactive-work");
  let topology: RunningTopology | undefined;
  let context: BrowserContext | undefined;
  try {
    topology = await startTopology({
      repositoryRoot: options.repositoryRoot,
      fluxiqRepositoryRoot: options.fluxiqRepositoryRoot,
      runsDirectory: topologyRunsDirectory,
      runId,
      seed: options.seed ?? scenario.seed,
      target: options.target,
      ...(options.target.mode === "existing" ? {} : {
        prepareHost: false,
        bootstrapIdentity: true,
        ...(options.target.credentials ? { credentials: { username: options.target.credentials.username, password: options.target.credentials.password, ...(options.target.credentials.authorizationPin ? { pin: options.target.credentials.authorizationPin } : {}), ...(options.target.credentials.totp ? { totp: options.target.credentials.totp } : {}) } } : {}),
      }),
    });
    let control = topology.control;
    if (options.target.mode === "existing") {
      control = new ExistingFluxIQControlClient(options.target.baseUrl);
      await control.login({ username: options.target.credentials.username, password: options.target.credentials.password, pin: options.target.credentials.authorizationPin, ...(options.target.credentials.totp ? { totp: options.target.credentials.totp } : {}) }, { sessionCache: new WebPanelAuthSessionCache(options.runsDirectory), ...(options.target.freshLogin ? { freshLogin: true } : {}) });
    }
    context = await chromium.launchPersistentContext(topology.allocation.browserProfileDir, {
      headless: false,
      env: withoutProviderSecrets(environment),
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1280, height: 720 },
      colorScheme: "light",
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, "--no-first-run", "--disable-default-apps"],
    });
    const guard = await installDeterministicNetworkGuard(context, {
      scenarioOrigins: scenarioNetworkOrigins(topology.scenarioOrigin),
      fluxiqOrigins: [topology.fluxiqOrigin],
      ...(topology.gatewayUrl ? { gatewayOrigins: [topology.gatewayUrl] } : {}),
      // The same second-origin proof the recording lane uses, so a fixture's
      // cross-origin frame (iframe-checkout) is allowed here too.
      verifyScenarioOrigin: scenarioLabOriginProof(topology.scenarioOrigin, topology.allocation.controllerToken),
    });
    if (control) await context.addCookies([fluxIQSessionCookieDescriptor(topology.fluxiqOrigin, control.sessionCookieValue())]);
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: MAX_WAIT_MS });
    const extensionOrigin = `chrome-extension://${new URL(worker.url()).hostname}`;
    const extensionPage = await context.newPage();
    await extensionPage.goto(`${extensionOrigin}/sidepanel/index.html`, { waitUntil: "domcontentloaded" });
    const scenarioPage = await context.newPage();
    await scenarioPage.goto(`${topology.scenarioOrigin}${scenario.startPath}`, { waitUntil: "domcontentloaded" });
    const panelPage = await context.newPage();
    await panelPage.goto(topology.fluxiqOrigin, { waitUntil: "domcontentloaded" });
    await scenarioPage.bringToFront();
    writeLine(output, { status: "ready", runId, scenarioId: scenario.id, surfaces: { scenario: scenarioPage.url(), panel: panelPage.url(), extension: extensionPage.url() }, actionLimit: MAX_ACTIONS });
    const lines = createInterface({ input, crlfDelay: Infinity });
    let sequence = 0;
    for await (const line of lines) {
      if (!line.trim()) continue;
      sequence += 1;
      if (sequence > MAX_ACTIONS) throw new Error(`interactive session is limited to ${MAX_ACTIONS} actions`);
      let requestId: string | undefined;
      try {
        if (Buffer.byteLength(line, "utf8") > MAX_LINE_BYTES) throw new Error(`interactive request exceeds ${MAX_LINE_BYTES} bytes`);
        const action = parseInteractiveAction(JSON.parse(line));
        requestId = action.id;
        if (action.action === "stop") { writeLine(output, { status: "stopped", ...(requestId ? { id: requestId } : {}) }); break; }
        const result = await executeInteractiveAction(action, { scenario: scenarioPage, panel: panelPage, extension: extensionPage }, { scenario: topology.scenarioOrigin, panel: topology.fluxiqOrigin, extension: extensionOrigin }, artifactsDirectory, sequence, environment);
        guard.assertNoViolations();
        writeLine(output, { status: "ok", ...(requestId ? { id: requestId } : {}), ...result });
      } catch (error) {
        writeLine(output, { status: "failed", ...(requestId ? { id: requestId } : {}), error: "interactive action failed", code: interactiveFailureCode(error) });
      }
    }
    lines.close();
    input.pause();
  } finally {
    await context?.close().catch(() => undefined);
    await topology?.close().catch(() => undefined);
    if (topology) await removeRunOwnedTopologyState(topology).catch(() => undefined);
  }
}

function interactiveFailureCode(error: unknown): "timeout" | "surface_unavailable" | "network_policy" | "sensitive_control" | "invalid_action" | "action_failed" {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (/timeout|timed out/u.test(message)) return "timeout";
  if (/closed|crash|unavailable|destroyed/u.test(message)) return "surface_unavailable";
  if (/network|origin|egress/u.test(message)) return "network_policy";
  if (/sensitive|secret/u.test(message)) return "sensitive_control";
  if (/selector|allowlisted|unsupported field|requires exactly/u.test(message)) return "invalid_action";
  return "action_failed";
}

async function assertNotSensitive(locator: Locator): Promise<void> {
  if (await isSensitive(locator)) throw new Error("interactive actions cannot enter sensitive values");
}

async function assertSensitive(locator: Locator): Promise<void> {
  if (!await isSensitive(locator)) throw new Error("secretEnv may only fill a sensitive control");
}

async function isSensitive(locator: Locator): Promise<boolean> {
  return locator.evaluate(element => {
    const input = element as HTMLInputElement;
    const autocomplete = input.autocomplete?.toLowerCase() ?? "";
    return input.type?.toLowerCase() === "password" || autocomplete === "current-password" || autocomplete === "new-password" || autocomplete === "one-time-code" || autocomplete.startsWith("cc-") || element.getAttribute("data-sensitive") === "true";
  });
}

async function inspectStructure(page: Page): Promise<unknown[]> {
  return page.evaluate(() => Array.from(document.querySelectorAll("[data-testid],button,a,input,select,textarea,[role]")).slice(0, 100).map(element => {
    const input = element as HTMLInputElement;
    return {
      tag: element.tagName.toLowerCase(),
      ...(element.getAttribute("role") ? { role: element.getAttribute("role") } : {}),
      ...(element.getAttribute("data-testid") ? { testId: element.getAttribute("data-testid") } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(element.hasAttribute("disabled") ? { disabled: true } : {}),
      ...(typeof input.checked === "boolean" && (input.type === "checkbox" || input.type === "radio") ? { checked: input.checked } : {}),
    };
  }));
}

function object(input: unknown): Record<string, unknown> { if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("interactive request must be an object"); return input as Record<string, unknown>; }
function text(input: unknown, name: string, maximum: number, allowEmpty = false): string { if (typeof input !== "string" || (!allowEmpty && !input.trim()) || input.length > maximum || /[\r\n\0]/u.test(input)) throw new Error(`${name} must be a bounded single-line string`); return input; }
function selector(input: unknown): string { return text(input, "selector", MAX_SELECTOR_LENGTH); }
function secretEnvironmentName(input: unknown): InteractiveSecretEnvironmentName { if (input !== "FLUXIQ_TEST_PASSWORD" && input !== "FLUXIQ_TEST_PIN" && input !== "FLUXIQ_TEST_TOTP" && input !== "DEEPSEEK_API_KEY") throw new Error("secretEnv is not allowlisted"); return input; }
function extensionActionType(input: unknown): InteractiveExtensionActionType { if (typeof input !== "string" || !INTERACTIVE_EXTENSION_ACTION_TYPES.has(input as InteractiveExtensionActionType)) throw new Error("extension actionType is not allowlisted"); return input as InteractiveExtensionActionType; }
function boundedInteger(input: unknown, name: string, minimum: number, maximum: number): number { if (!Number.isSafeInteger(input) || Number(input) < minimum || Number(input) > maximum) throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`); return Number(input); }
function exactKeys(input: Record<string, unknown>, keys: readonly string[]): void { const allowed = new Set(keys); if (Object.keys(input).some(key => !allowed.has(key))) throw new Error("interactive request contains an unsupported field"); }
function writeLine(output: Writable, value: unknown): void { output.write(`${JSON.stringify(value)}\n`); }
