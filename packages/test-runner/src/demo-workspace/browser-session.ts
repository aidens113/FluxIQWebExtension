// The browser sessions a lane runs inside: the extension-loaded context, the
// panel-only context, the extension pairing handshake, and the runtime
// messaging used to read and drive the extension's status.
import { randomBytes } from "node:crypto";
import { cp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { type BrowserContext, chromium, type Page } from "@playwright/test";
import { BrowserEvidenceRecorder, type BrowserEvidenceSurface } from "../browser-evidence.js";
import { ExistingFluxIQControlClient } from "../existing-fluxiq-control.js";
import { withoutProviderSecrets } from "../environment.js";
import { DemoLlmPreparationPhaseTracker } from "../demo-operation-status.js";
import { RunnerFailure } from "../failure.js";
import { executable, processLogPath, ProcessSupervisor } from "../process-supervisor.js";
import type { DemoWorkspaceConfiguration } from "./configuration.js";
import { approvePairingInPanel } from "./panel-navigation.js";
import { requireDemoScenarioUrl, startPersistentScenarioLabWithRecovery, waitForUrl } from "./scenario-lab.js";

export async function withDemoBrowser<T>(
  config: DemoWorkspaceConfiguration,
  panelCookie: string,
  evidenceScenarioId: string,
  operation: (input: { extensionPage: Page; panelPage: Page; scenarioPage: Page; scenarioUrl: string; evidence: BrowserEvidenceRecorder }) => Promise<T>,
  redactionSecrets: readonly string[] = [],
  scenarioPath: string = "/scenarios/basic-form/",
  phaseTracker?: DemoLlmPreparationPhaseTracker,
): Promise<T> {
  const supervisor = new ProcessSupervisor();
  const token = randomBytes(32).toString("base64url");
  let context: BrowserContext | undefined;
  let panelContext: BrowserContext | undefined;
  try {
    const scenario = await startPersistentScenarioLabWithRecovery({
      config,
      start: scenarioPort => supervisor.start({
        name: "scenario-lab",
        command: executable("node"),
        args: [path.join(config.repositoryRoot, "apps", "scenario-lab", "dist", "server.js")],
        cwd: config.repositoryRoot,
        env: { ...process.env, SCENARIO_LAB_RUN_TOKEN: token, SCENARIO_LAB_PORT: String(scenarioPort), SCENARIO_LAB_SEED: "101" },
        logPath: processLogPath(path.join(config.workspaceDirectory, "logs"), "scenario-lab"),
      }),
      waitUntilReady: (scenarioPort, child) => waitForUrl("http://127.0.0.1:" + scenarioPort + "/__control/health", token, child),
    });
    const scenarioOrigin = "http://127.0.0.1:" + scenario.port;
    const scenarioUrl = requireDemoScenarioUrl(scenarioOrigin, scenarioPath);
    phaseTracker?.set("scenario-ready");
    const extensionSourcePath = path.join(config.repositoryRoot, "apps", "extension", "dist", "chrome");
    const extensionPath = path.join(config.workspaceDirectory, "extension-under-test");
    await rm(extensionPath, { recursive: true, force: true });
    await cp(extensionSourcePath, extensionPath, { recursive: true, force: true });
    context = await chromium.launchPersistentContext(path.join(config.workspaceDirectory, "browser-profile-isolated"), {
      headless: config.headless,
      channel: "chromium",
      env: withoutProviderSecrets(process.env),
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1280, height: 720 },
      args: ["--disable-extensions-except=" + extensionPath, "--load-extension=" + extensionPath, "--no-first-run", "--disable-default-apps"],
    });
    panelContext = await chromium.launchPersistentContext(path.join(config.workspaceDirectory, "panel-browser-profile-isolated-v2"), {
      headless: config.headless,
      channel: "chromium",
      env: withoutProviderSecrets(process.env),
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1280, height: 720 },
      args: ["--no-first-run", "--disable-default-apps"],
    });
    const [cookieName, cookieValue] = panelCookie.split("=", 2);
    if (!cookieName || !cookieValue) throw new RunnerFailure("environment.missing", "FluxIQ panel cookie is malformed");
    await panelContext.addCookies([{ name: cookieName, value: cookieValue, url: config.origin }]);
    const extensionUrl = await extensionControlUrl(context);
    // Persistent profiles may restore tabs from an earlier run. Remove only
    // disposable Scenario Lab tabs so the extension cannot target stale state.
    for (const restoredPage of context.pages()) {
      let restoredOrigin = "";
      try { restoredOrigin = new URL(restoredPage.url()).origin; } catch { /* non-URL startup page */ }
      if (restoredOrigin === scenarioOrigin) await restoredPage.close();
    }
    const extensionPage = await context.newPage();
    const panelPage = await panelContext.newPage();
    const scenarioPage = await context.newPage();
    const evidence = new BrowserEvidenceRecorder({
      workspaceDirectory: config.workspaceDirectory,
      scenarioId: evidenceScenarioId,
      pages: { extension: extensionPage, panel: panelPage, scenario: scenarioPage },
      sampleFps: 0,
      redactionSecrets,
    });
    await evidence.start();
    phaseTracker?.set("browser-ready");
    try {
      await evidence.step("extension", "open-extension-controls", "Open the extension recorder controls", () => extensionPage.goto(extensionUrl).then(() => undefined));
      await installRuntimeActionEvidence(extensionPage, evidence);
      await evidence.step("panel", "open-panel", "Open the FluxIQ web panel", () => panelPage.goto(config.origin, { waitUntil: "domcontentloaded" }).then(() => undefined));
      await panelPage.getByRole("heading", { name: "Programs", exact: true }).waitFor();
      await evidence.step("scenario", "open-scenario", "Open the selected loopback scenario", () => scenarioPage.goto(scenarioUrl).then(() => undefined));
      await evidence.step("extension", "close-startup-tabs", "Close blank Chromium startup tabs", () => extensionPage.evaluate(async () => {
        const tabs = await (globalThis as any).chrome.tabs.query({ url: "about:blank" });
        const ids = tabs.flatMap((tab: any) => typeof tab.id === "number" ? [tab.id] : []);
        if (ids.length) await (globalThis as any).chrome.tabs.remove(ids);
      }));
      await scenarioPage.bringToFront();
      phaseTracker?.set("browser-operation-call");
      const result = await operation({ extensionPage, panelPage, scenarioPage, scenarioUrl, evidence });
      phaseTracker?.set("browser-operation-returned");
      phaseTracker?.set("evidence-finalize-call");
      const evidencePath = await evidence.finalize("passed");
      phaseTracker?.set("evidence-finalize-returned");
      await writeFile(path.join(config.workspaceDirectory, "latest-evidence.json"), JSON.stringify({ runId: evidence.runId, path: evidencePath }, null, 2) + "\n", "utf8");
      return result;
    } catch (error) {
      phaseTracker?.captureFailure(error);
      const evidencePath = await evidence.finalize("failed").catch(() => undefined);
      if (evidencePath) await writeFile(path.join(config.workspaceDirectory, "latest-evidence.json"), JSON.stringify({ runId: evidence.runId, path: evidencePath }, null, 2) + "\n", "utf8").catch(() => undefined);
      throw error;
    }
  } finally {
    await panelContext?.close().catch(() => undefined);
    await context?.close().catch(() => undefined);
    await supervisor.cleanup();
  }
}

export async function withDemoPanelBrowser<T>(
  config: DemoWorkspaceConfiguration,
  panelCookie: string,
  evidenceScenarioId: string,
  operation: (input: { panelPage: Page; evidence: BrowserEvidenceRecorder }) => Promise<T>,
  redactionSecrets: readonly string[] = [],
): Promise<T> {
  let context: BrowserContext | undefined;
  let evidence: BrowserEvidenceRecorder | undefined;
  try {
    context = await chromium.launchPersistentContext(path.join(config.workspaceDirectory, "panel-browser-profile-isolated-v2"), {
      headless: config.headless,
      channel: "chromium",
      env: withoutProviderSecrets(process.env),
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1280, height: 720 },
      args: ["--no-first-run", "--disable-default-apps"],
    });
    const [cookieName, cookieValue] = panelCookie.split("=", 2);
    if (!cookieName || !cookieValue) throw new RunnerFailure("environment.missing", "FluxIQ panel cookie is malformed");
    await context.addCookies([{ name: cookieName, value: cookieValue, url: config.origin }]);
    const panelPage = await context.newPage();
    evidence = new BrowserEvidenceRecorder({
      workspaceDirectory: config.workspaceDirectory,
      scenarioId: evidenceScenarioId,
      pages: { panel: panelPage, extension: panelPage, scenario: panelPage },
      sampleFps: 0,
      redactionSecrets,
    });
    await evidence.start();
    await evidence.step("panel", "open-panel", "Open the FluxIQ web panel", () => panelPage.goto(config.origin, { waitUntil: "domcontentloaded" }).then(() => undefined));
    await panelPage.getByRole("heading", { name: "Programs", exact: true }).waitFor();
    try {
      const result = await operation({ panelPage, evidence });
      const evidencePath = await evidence.finalize("passed");
      await writeFile(path.join(config.workspaceDirectory, "latest-evidence.json"), JSON.stringify({ runId: evidence.runId, path: evidencePath }, null, 2) + "\n", "utf8");
      return result;
    } catch (error) {
      const evidencePath = await evidence.finalize("failed").catch(() => undefined);
      if (evidencePath) await writeFile(path.join(config.workspaceDirectory, "latest-evidence.json"), JSON.stringify({ runId: evidence!.runId, path: evidencePath }, null, 2) + "\n", "utf8").catch(() => undefined);
      throw error;
    }
  } finally {
    await context?.close().catch(() => undefined);
  }
}

export async function connectExtension(
  page: Page,
  panelPage: Page,
  control: ExistingFluxIQControlClient,
  gatewayUrl: string,
  origin: string,
  projectId: string,
  flowId: string,
  scenarioUrl: string,
  evidence: BrowserEvidenceRecorder,
): Promise<void> {
  let stage = "entry";
  let diagnosticSurface: BrowserEvidenceSurface = "extension";
  const facts = {
    contextSelected: false,
    settingsOpened: false,
    gatewayFilled: false,
    apiFilled: false,
    optionsVerified: 0,
    settingsClosed: false,
    connectionRequested: false,
    connected: false,
    pairingRequired: false,
    scenarioTabSelected: false,
    contextRefreshed: false,
  };
  const checkpoint = async (nextStage: string, surface: BrowserEvidenceSurface): Promise<void> => {
    stage = nextStage;
    diagnosticSurface = surface;
    await evidence.diagnostic(surface, `connect-${stage}`, `connect.${stage}`, facts);
  };
  try {
    await checkpoint("entry", "extension");
    await checkpoint("select-context", "panel");
    await evidence.step("panel", "select-project-context", "Select the Flow as the active FluxIQ recording context", () => control.selectExistingContext(projectId, undefined, {}, flowId));
    facts.contextSelected = true;

    await checkpoint("settings-open", "extension");
    await evidence.step("extension", "settings-open", "Open extension settings", () => page.getByRole("button", { name: "Settings" }).click());
    facts.settingsOpened = true;

    await checkpoint("settings-gateway", "extension");
    await evidence.step("extension", "settings-gateway", "Enter the FluxIQ gateway URL", () => page.getByLabel("Gateway URL").fill(gatewayUrl));
    facts.gatewayFilled = true;

    await checkpoint("settings-api", "extension");
    await evidence.step("extension", "settings-api", "Enter the FluxIQ Core API URL", () => page.getByLabel("Core API URL").fill(origin));
    facts.apiFilled = true;

    await checkpoint("settings-options", "extension");
    for (const label of ["Auto reconnect", "DOM mutations", "Input values", "Snapshots"]) {
      const checkbox = page.getByLabel(label);
      if (!await checkbox.isChecked()) await evidence.step("extension", "settings-" + label.toLowerCase().replaceAll(" ", "-"), "Enable " + label, () => checkbox.check());
      facts.optionsVerified += 1;
    }

    await checkpoint("settings-close", "extension");
    await evidence.step("extension", "settings-close", "Close extension settings", () => page.getByRole("button", { name: "Close" }).click());
    facts.settingsClosed = true;

    await checkpoint("connect-request", "extension");
    await evidence.step("extension", "extension-connect", "Connect the extension", () => page.getByRole("button", { name: "Connect", exact: true }).click());
    facts.connectionRequested = true;

    await checkpoint("connection-status", "extension");
    const initial = await pollStatus(page, value => value.connectionState === "connected" || value.connectionState === "pairing", "initial connection");
    if (initial.connectionState === "pairing") {
      facts.pairingRequired = true;
      await checkpoint("pairing-approval", "panel");
      if (typeof initial.pairingReferenceCode !== "string") throw new RunnerFailure("gateway.pairing", "Extension pairing code is unavailable");
      await approvePairingInPanel(panelPage, initial.pairingReferenceCode, evidence);
      await pollStatus(page, value => value.connectionState === "connected" && typeof value.sessionId === "string", "pairing approval");
    }
    facts.connected = true;

    await checkpoint("scenario-tab", "extension");
    const scenarioOrigin = new URL(scenarioUrl).origin;
    const tabId = await evidence.step("extension", "activate-scenario-tab", "Select the scenario as the extension automation tab", () => page.evaluate(async originValue => {
      const tabs = await (globalThis as any).chrome.tabs.query({ url: originValue + "/*" });
      const candidates = tabs.filter((candidate: any) => typeof candidate.id === "number");
      if (candidates.length !== 1) throw new Error("Demo scenario tab selection is ambiguous");
      const tab = candidates[0];
      const response = await (globalThis as any).chrome.runtime.sendMessage({ type: "fluxiq.test.setActiveTab", tabId: tab.id });
      if (response?.ok !== true) throw new Error(response?.error ?? "Extension rejected the scenario automation tab");
      return tab.id as number;
    }, scenarioOrigin));
    await pollStatus(page, value => value.activeTabId === tabId, "scenario tab selection");
    facts.scenarioTabSelected = true;

    // The pairing handshake establishes client trust. Project ownership is resolved
    // from the approving operator's fresh Automation Studio context at recording start.
    await checkpoint("refresh-context", "panel");
    await evidence.step("panel", "refresh-project-context", "Refresh the active FluxIQ Flow context", () => control.selectExistingContext(projectId, undefined, {}, flowId));
    facts.contextRefreshed = true;
    await checkpoint("complete", "extension");
  } catch {
    await evidence.diagnostic(diagnosticSurface, "connect-failed", `connect.${stage}`, facts).catch(() => undefined);
    throw new RunnerFailure("runtime.behavior", "FluxIQ extension connection setup failed");
  }
}

export async function extensionControlUrl(context: BrowserContext): Promise<string> {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 15_000 });
  return "chrome-extension://" + new URL(worker.url()).hostname + "/sidepanel/index.html";
}

export async function runtimeMessage(page: Page, message: Record<string, unknown>): Promise<any> {
  const response = await page.evaluate(value => (globalThis as any).chrome.runtime.sendMessage(value), message);
  if (!response?.ok) throw new RunnerFailure("extension.worker", response?.error ?? "Extension runtime message failed");
  return response;
}

export async function installRuntimeActionEvidence(page: Page, evidence: BrowserEvidenceRecorder): Promise<void> {
  await page.exposeBinding("__fluxiqCaptureActionBoundary", async (_source, boundary: unknown) => {
    const value = boundary as { phase?: unknown; commandId?: unknown; actionType?: unknown; status?: unknown };
    if (
      (value.phase !== "before" && value.phase !== "after")
      || typeof value.commandId !== "string"
      || typeof value.actionType !== "string"
    ) throw new Error("Extension emitted an invalid action-evidence boundary");
    await evidence.runtimeActionBoundary({
      phase: value.phase,
      commandId: value.commandId,
      actionType: value.actionType,
      ...(typeof value.status === "string" ? { status: value.status } : {}),
    });
  });
  await page.evaluate(() => {
    const global = globalThis as typeof globalThis & {
      __fluxiqCaptureActionBoundary(boundary: unknown): Promise<void>;
      __fluxiqActionEvidencePort?: { disconnect(): void };
    };
    global.__fluxiqActionEvidencePort?.disconnect();
    const port = (globalThis as any).chrome.runtime.connect({ name: "fluxiq.test.action-evidence" });
    global.__fluxiqActionEvidencePort = port;
    port.onMessage.addListener((boundary: unknown) => {
      const value = boundary as { boundaryId?: unknown };
      void global.__fluxiqCaptureActionBoundary(boundary).then(
        () => port.postMessage({ boundaryId: value.boundaryId, ok: true }),
        error => port.postMessage({ boundaryId: value.boundaryId, ok: false, error: error instanceof Error ? error.message : "Evidence capture failed" }),
      );
    });
  });
}

export async function extensionStatus(page: Page): Promise<any> {
  return (await runtimeMessage(page, { type: "fluxiq.getStatus" })).status;
}

export async function pollStatus(page: Page, predicate: (value: any) => boolean, phase: string): Promise<any> {
  const deadline = Date.now() + 20_000;
  let latest: any;
  while (Date.now() < deadline) {
    latest = await extensionStatus(page);
    if (predicate(latest)) return latest;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const diagnostic = {
    connectionState: latest?.connectionState,
    hasSessionId: typeof latest?.sessionId === "string",
    projectId: latest?.projectId,
    activeTabId: latest?.activeTabId,
    gatewayUrl: latest?.gatewayUrl,
    lastError: latest?.lastError,
  };
  throw new RunnerFailure("gateway.connection", `Timed out waiting for extension state during ${phase}: ${JSON.stringify(diagnostic)}`);
}
