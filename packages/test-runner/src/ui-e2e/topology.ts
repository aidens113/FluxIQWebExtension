// The end-to-end UI suite's topology: one Core, panel, client gateway, Scenario
// Lab and browser pair, kept across adjacent journeys and restarted only by the
// restart journey. Ports come from `allocateLoopbackPort`, proven bindable --
// never the demo defaults `3300`/`4877`, never the user's panel `3000`/`4711`.
// A run writes only under `$FLUXIQ_TEST_RUNS_DIR/ui-e2e/<run-id>/`: the store,
// both browser profiles, a pinned extension build and the evidence bundles,
// with an identity that is fresh per run and never read from an env file.
// The topology never reads a provider credential; a provider journey's driver
// does. In the provider-free lane the panel's LLM endpoints are blocked and
// every attempt counted, so reaching one fails on a measured number.

import { randomBytes, randomInt } from "node:crypto";
import { access, cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { type BrowserContext, chromium, type Page } from "@playwright/test";
import { allocateLoopbackPort, assertLoopbackPortBindable } from "../allocation.js";
import { BrowserEvidenceRecorder } from "../browser-evidence.js";
import { authenticatedControl, type DemoWorkspaceConfiguration, requireDemoScenarioUrl, resolveDemoWorkspaceConfiguration, type RunningDemoCore, startPersistentDemoCore } from "../demo-workspace/index.js";
import { withoutProviderSecrets } from "../environment.js";
import type { ExistingFluxIQControlClient } from "../existing-fluxiq-control.js";
import { RunnerFailure } from "../failure.js";
import { executable, processLogPath, ProcessSupervisor } from "../process-supervisor.js";
import { hardenWindowsPrivatePath } from "../windows-acl.js";

/** Ports no topology binds: the user's panel and gateway, and the fixed demo defaults. */
export const UI_E2E_EXCLUDED_PORTS: ReadonlySet<number> = new Set([3000, 4711, 3300, 4877]);

/** The panel endpoints a provider-free journey must never reach. */
const PROVIDER_ENDPOINTS = ["generate-flow-bootstrap-adaptation", "preflight-llm-execution", "issue-llm-execution-grant"] as const;
const RUN_ID = /^[a-z0-9][a-z0-9-]{0,39}$/u;
const JOURNEY_ID = /^[a-z0-9][a-z0-9-]{0,47}$/u;
/** How long a stopped Core's ports may take to be released before the restart fails. */
const PORT_RELEASE_MS = 5_000;

export type UiE2eLane = "provider-free" | "provider";
export type UiE2ePorts = { web: number; gateway: number; scenario: number };
export type UiE2eCoreSession = { control: ExistingFluxIQControlClient; gatewayUrl: string; panelCookie: string };
export type UiE2ePages = { extension: Page; panel: Page; scenario: Page };
export type UiE2eIdentity = { username: string; password: string; pin: string };
/** A restart as measured: each port was bindable after the stop, and how long each phase took. */
export type UiE2eCoreRestart = { webPortClosed: boolean; gatewayPortClosed: boolean; stopMs: number; whileStoppedMs: number; startMs: number; authenticateMs: number };
export type UiE2eJourneyResult<T> = { value: T; evidencePath: string; durationMs: number };

export type UiE2eTopologyOptions = {
  repositoryRoot: string;
  /** Read for FLUXIQ_TEST_RUNS_DIR, FLUXIQ_CORE_ROOT, FLUXIQ_DEMO_EXTENSION_DIR and FLUXIQ_DEMO_HEADLESS only. */
  environment: NodeJS.ProcessEnv;
  lane: UiE2eLane;
  runId?: string;
  /** The Scenario Lab page the scenario tab opens first. */
  scenarioPath?: string;
};

/**
 * Allocates `count` distinct loopback ports, none of them excluded, each proven
 * bindable. A port the allocator repeats or hands out from the excluded set is
 * drawn again, within a bound, so a run never waits on an unlucky draw forever.
 */
export async function allocateUiE2ePorts(count: number, dependencies: { allocate?: () => Promise<number>; assertBindable?: (port: number, label: string) => Promise<void> } = {}): Promise<number[]> {
  const allocate = dependencies.allocate ?? allocateLoopbackPort;
  const assertBindable = dependencies.assertBindable ?? assertLoopbackPortBindable;
  const ports: number[] = [];
  for (let draws = 0; ports.length < count; draws += 1) {
    if (draws >= count * 8) throw new RunnerFailure("process.startup", "Could not allocate distinct non-excluded loopback ports for the UI topology");
    const port = await allocate();
    if (UI_E2E_EXCLUDED_PORTS.has(port) || ports.includes(port)) continue;
    await assertBindable(port, "UI end-to-end topology port");
    ports.push(port);
  }
  return ports;
}

/** A fresh identity for one run: nothing is read from an environment file or reused from another run. */
export function freshUiE2eIdentity(): UiE2eIdentity {
  return {
    username: `ui-e2e-${randomBytes(6).toString("hex")}`,
    password: `T-${randomBytes(24).toString("base64url")}`,
    pin: String(randomInt(100_000, 1_000_000)),
  };
}

/** The run-scoped root, refused unless it is a direct child of `<runs>/ui-e2e`. */
export function uiE2eRunRoot(runsDirectory: string, runId: string): string {
  if (!RUN_ID.test(runId)) throw new Error("A UI end-to-end run ID must be 1-40 lowercase letters, digits and dashes");
  const parent = path.resolve(runsDirectory, "ui-e2e");
  const root = path.resolve(parent, runId);
  if (path.dirname(root) !== parent) throw new Error("A UI end-to-end run root escaped its runs directory");
  return root;
}

export class UiE2eTopology {
  readonly timings: Record<string, number> = {};
  private core: RunningDemoCore | undefined;
  private coreSession: UiE2eCoreSession | undefined;
  private browsers: { extension: BrowserContext; panel: BrowserContext; pages: UiE2ePages } | undefined;
  private readonly blockedEndpoints: string[] = [];
  private readonly scenarioToken = randomBytes(32).toString("base64url");
  private stopping: Promise<void> | undefined;

  private constructor(
    readonly runId: string,
    readonly root: string,
    readonly lane: UiE2eLane,
    readonly config: DemoWorkspaceConfiguration,
    readonly ports: UiE2ePorts,
    private readonly scenarioLab: ProcessSupervisor,
  ) {}

  /** Starts the whole topology, or stops whatever part of it had started and throws. */
  static async start(options: UiE2eTopologyOptions): Promise<UiE2eTopology> {
    const began = Date.now();
    const environment = options.environment;
    const repositoryRoot = path.resolve(options.repositoryRoot);
    const runsDirectory = path.resolve(environment.FLUXIQ_TEST_RUNS_DIR ?? path.join(repositoryRoot, "test-runs"));
    const runId = options.runId ?? `r${new Date().toISOString().replace(/[-:]/gu, "").replace(/\..*$/u, "").toLowerCase()}-${randomBytes(2).toString("hex")}`;
    const root = uiE2eRunRoot(runsDirectory, runId);
    await mkdir(path.dirname(root), { recursive: true });
    await mkdir(root, { recursive: false, mode: 0o700 });
    if (process.platform === "win32") await hardenWindowsPrivatePath(root, "directory");

    const [web, gateway, scenario] = await allocateUiE2ePorts(3) as [number, number, number];
    const extensionSource = path.resolve(environment.FLUXIQ_DEMO_EXTENSION_DIR?.trim() || path.join(repositoryRoot, "apps", "extension", "dist", "chrome"));
    await requireFile(path.join(extensionSource, "manifest.json"), "The unpacked extension build is missing; build @fluxiq-web-extension/extension first");
    const pinnedExtension = path.join(root, "extension-under-test");
    const pinBegan = Date.now();
    await cp(extensionSource, pinnedExtension, { recursive: true, errorOnExist: true, force: false });
    const pinExtensionMs = Date.now() - pinBegan;
    const identity = freshUiE2eIdentity();
    const config = resolveDemoWorkspaceConfiguration(repositoryRoot, {
      FLUXIQ_TEST_RUNS_DIR: runsDirectory,
      ...(environment.FLUXIQ_CORE_ROOT ? { FLUXIQ_CORE_ROOT: environment.FLUXIQ_CORE_ROOT } : {}),
      ...(environment.FLUXIQ_DEMO_HEADLESS ? { FLUXIQ_DEMO_HEADLESS: environment.FLUXIQ_DEMO_HEADLESS } : {}),
      FLUXIQ_TEST_USERNAME: identity.username,
      FLUXIQ_TEST_PASSWORD: identity.password,
      FLUXIQ_TEST_PIN: identity.pin,
    }, {
      origin: `http://127.0.0.1:${web}`,
      gatewayUrl: `ws://127.0.0.1:${gateway}/client`,
      workspaceDirectory: root,
      extensionSourceDirectory: pinnedExtension,
    });
    const topology = new UiE2eTopology(runId, root, options.lane, config, { web, gateway, scenario }, new ProcessSupervisor());
    topology.timings.prepareMs = Date.now() - began;
    topology.timings.pinExtensionMs = pinExtensionMs;
    try {
      await topology.startScenarioLab();
      await topology.startCore(false);
      await topology.startBrowsers(options.scenarioPath ?? "/scenarios/basic-form/");
    } catch (error) {
      const stopFailure = await topology.stop().then(() => undefined, (cause: unknown) => cause);
      throw withFollowingLine(error, stopFailure, "UI topology cleanup also failed");
    }
    topology.timings.startMs = Date.now() - began;
    return topology;
  }

  /** The authenticated control client, gateway URL and panel cookie of the Core that is running now. */
  get session(): UiE2eCoreSession {
    if (!this.coreSession) throw new RunnerFailure("process.startup", "The UI topology's Core is not running");
    return this.coreSession;
  }

  get pages(): UiE2ePages {
    if (!this.browsers) throw new RunnerFailure("process.startup", "The UI topology's browsers are not running");
    return this.browsers.pages;
  }

  get scenarioOrigin(): string {
    return `http://127.0.0.1:${this.ports.scenario}`;
  }

  scenarioUrl(pathname: string): string {
    return requireDemoScenarioUrl(this.scenarioOrigin, pathname);
  }

  /**
   * Returns every Scenario Lab fixture to its seeded state. The Lab outlives
   * each journey, and its fixtures keep their state on the server, so without
   * this a submission made while recording would already satisfy the oracle of
   * the run that follows it.
   */
  async resetScenarios(): Promise<void> {
    const response = await fetch(`${this.scenarioOrigin}/__control/reset`, { method: "POST", headers: { authorization: `Bearer ${this.scenarioToken}` }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new RunnerFailure("runtime.behavior", "The Scenario Lab refused its reset", { details: { reasonCode: "ui_e2e.topology.scenario_reset_refused", status: response.status } });
  }

  /** One fixture's server-side state as the Lab holds it: the oracle a journey judges a run by. */
  async scenarioState(scenarioId: string): Promise<unknown> {
    const response = await fetch(`${this.scenarioOrigin}/__control/final-state?scenario=${encodeURIComponent(scenarioId)}`, { headers: { authorization: `Bearer ${this.scenarioToken}` }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new RunnerFailure("runtime.behavior", "The Scenario Lab has no state for that scenario", { details: { reasonCode: "ui_e2e.topology.scenario_state_unavailable", status: response.status } });
    const snapshot: unknown = await response.json();
    return snapshot !== null && typeof snapshot === "object" ? (snapshot as { state?: unknown }).state : undefined;
  }

  /** How many requests the provider-free lane blocked on their way to an LLM endpoint. */
  blockedProviderRequests(): number {
    return this.blockedEndpoints.length;
  }

  /** Runs one journey with its own evidence bundle over the shared pages. */
  async journey<T>(journeyId: string, operation: (input: { topology: UiE2eTopology; evidence: BrowserEvidenceRecorder }) => Promise<T>): Promise<UiE2eJourneyResult<T>> {
    if (!JOURNEY_ID.test(journeyId)) throw new Error("A UI journey ID must be 1-48 lowercase letters, digits and dashes");
    const evidence = new BrowserEvidenceRecorder({
      workspaceDirectory: this.root,
      scenarioId: `ui-e2e-${journeyId}`,
      pages: this.pages,
      sampleFps: 0,
      redactionSecrets: [this.config.password, this.config.pin],
    });
    await evidence.start();
    const began = Date.now();
    let value: T;
    try {
      value = await operation({ topology: this, evidence });
    } catch (error) {
      const finalizeFailure = await evidence.finalize("failed").then(() => undefined, (cause: unknown) => cause);
      throw withFollowingLine(error, finalizeFailure, "Journey evidence finalization also failed");
    }
    const evidencePath = await evidence.finalize("passed");
    return { value, evidencePath, durationMs: Date.now() - began };
  }

  /**
   * Stops Core and its gateway, measures that both ports are released, starts
   * Core again on the same ports and signs in afresh. The browsers, the Scenario
   * Lab and the store stay; reconnecting the extension is the journey's step.
   * `whileStopped` runs after the ports are proven released and before Core
   * starts again -- the one moment the store has no server holding it -- and
   * its time is reported apart from the restart's own.
   */
  async restartCore(options: { whileStopped?: () => Promise<void> } = {}): Promise<UiE2eCoreRestart> {
    const core = this.core;
    if (!core) throw new RunnerFailure("process.startup", "The UI topology's Core is not running");
    const stopBegan = Date.now();
    this.core = undefined;
    this.coreSession = undefined;
    await core.stop();
    const stopMs = Date.now() - stopBegan;
    const deadline = Date.now() + PORT_RELEASE_MS;
    let webPortClosed = await portIsReleased(this.ports.web);
    let gatewayPortClosed = await portIsReleased(this.ports.gateway);
    while ((!webPortClosed || !gatewayPortClosed) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 200));
      webPortClosed = await portIsReleased(this.ports.web);
      gatewayPortClosed = await portIsReleased(this.ports.gateway);
    }
    if (!webPortClosed || !gatewayPortClosed) {
      throw new RunnerFailure("process.startup", "A stopped UI topology Core still holds its port", { details: { reasonCode: "ui_e2e.topology.port_still_bound", webPortClosed, gatewayPortClosed } });
    }
    const maintenanceBegan = Date.now();
    if (options.whileStopped) await options.whileStopped();
    const whileStoppedMs = Date.now() - maintenanceBegan;
    const { startMs, authenticateMs } = await this.startCore(true);
    return { webPortClosed, gatewayPortClosed, stopMs, whileStoppedMs, startMs, authenticateMs };
  }

  /** Stops the browsers, Core and the Scenario Lab. Every call after the first returns the first call's promise. */
  stop(): Promise<void> {
    return this.stopping ??= this.stopAll();
  }

  private async stopAll(): Promise<void> {
    const failures: string[] = [];
    const attempt = async (label: string, work: () => Promise<void>) => {
      try { await work(); }
      catch (error) { failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`); }
    };
    const browsers = this.browsers;
    this.browsers = undefined;
    if (browsers) {
      await attempt("panel browser", () => browsers.panel.close());
      await attempt("extension browser", () => browsers.extension.close());
    }
    const core = this.core;
    this.core = undefined;
    this.coreSession = undefined;
    if (core) await attempt("Core", () => core.stop());
    await attempt("Scenario Lab", () => this.scenarioLab.cleanup());
    if (failures.length) throw new RunnerFailure("process.startup", `UI topology shutdown failed: ${failures.join("; ")}`);
  }

  private async startScenarioLab(): Promise<void> {
    const began = Date.now();
    const entry = path.join(this.config.repositoryRoot, "apps", "scenario-lab", "dist", "server.js");
    await requireFile(entry, "The Scenario Lab build is missing; build @fluxiq-web-extension/scenario-lab first");
    await mkdir(path.join(this.root, "logs"), { recursive: true, mode: 0o700 });
    const token = this.scenarioToken;
    const child = this.scenarioLab.start({
      name: "ui-e2e-scenario-lab",
      command: executable("node"),
      args: [entry],
      cwd: this.config.repositoryRoot,
      env: { ...withoutProviderSecrets(process.env), SCENARIO_LAB_RUN_TOKEN: token, SCENARIO_LAB_PORT: String(this.ports.scenario), SCENARIO_LAB_SEED: "101" },
      logPath: processLogPath(path.join(this.root, "logs"), "scenario-lab"),
    });
    const deadline = Date.now() + 15_000;
    for (;;) {
      if (child.exitCode !== null || child.signalCode !== null) throw new RunnerFailure("process.startup", "The Scenario Lab exited before it became healthy");
      const healthy = await fetch(`${this.scenarioOrigin}/__control/health`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(2_000) })
        .then(response => response.ok, (error: unknown) => isConnectionFailure(error) ? false : Promise.reject(error));
      if (healthy) break;
      if (Date.now() >= deadline) throw new RunnerFailure("process.startup", "Timed out waiting for the UI topology's Scenario Lab");
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.timings.scenarioLabMs = Date.now() - began;
  }

  private async startCore(reusePreparedWorkspace: boolean): Promise<{ startMs: number; authenticateMs: number }> {
    const began = Date.now();
    this.core = await startPersistentDemoCore(this.config, { reusePreparedWorkspace });
    const startMs = Date.now() - began;
    const authenticated = Date.now();
    this.coreSession = await authenticatedControl(this.config);
    const authenticateMs = Date.now() - authenticated;
    if (this.browsers) await this.browsers.panel.addCookies([panelCookie(this.coreSession.panelCookie, this.config.origin)]);
    this.timings[reusePreparedWorkspace ? "coreRestartMs" : "coreStartMs"] = startMs;
    this.timings[reusePreparedWorkspace ? "reauthenticateMs" : "authenticateMs"] = authenticateMs;
    return { startMs, authenticateMs };
  }

  private async startBrowsers(scenarioPath: string): Promise<void> {
    const began = Date.now();
    const launch = (profile: string, args: string[]) => chromium.launchPersistentContext(path.join(this.root, profile), {
      headless: this.config.headless,
      channel: "chromium",
      env: withoutProviderSecrets(process.env),
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1280, height: 720 },
      args: [...args, "--no-first-run", "--disable-default-apps"],
    });
    const extensionPath = this.config.extensionSourceDirectory;
    const extension = await launch("browser-profile-isolated", [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]);
    let panel: BrowserContext;
    try {
      panel = await launch("panel-browser-profile-isolated-v2", []);
    } catch (error) {
      const closeFailure = await extension.close().then(() => undefined, (cause: unknown) => cause);
      throw withFollowingLine(error, closeFailure, "Extension browser close also failed");
    }
    const pages = { extension: await extension.newPage(), panel: await panel.newPage(), scenario: await extension.newPage() };
    this.browsers = { extension, panel, pages };
    await panel.addCookies([panelCookie(this.session.panelCookie, this.config.origin)]);
    if (this.lane === "provider-free") {
      for (const endpoint of PROVIDER_ENDPOINTS) {
        await panel.route(`**/api/programs/automation-studio/${endpoint}`, route => {
          this.blockedEndpoints.push(endpoint);
          return route.abort("blockedbyclient");
        });
      }
    }
    const worker = extension.serviceWorkers()[0] ?? await extension.waitForEvent("serviceworker", { timeout: 15_000 });
    await pages.extension.goto(`chrome-extension://${new URL(worker.url()).hostname}/sidepanel/index.html`);
    await pages.panel.goto(this.config.origin, { waitUntil: "domcontentloaded" });
    await pages.panel.getByRole("heading", { name: "Programs", exact: true }).waitFor();
    await pages.scenario.goto(this.scenarioUrl(scenarioPath));
    await pages.extension.evaluate(async () => {
      const chromeApi = (globalThis as unknown as { chrome: { tabs: { query(filter: object): Promise<Array<{ id?: number }>>; remove(ids: number[]): Promise<void> } } }).chrome;
      const ids = (await chromeApi.tabs.query({ url: "about:blank" })).flatMap(tab => typeof tab.id === "number" ? [tab.id] : []);
      if (ids.length) await chromeApi.tabs.remove(ids);
    });
    await pages.scenario.bringToFront();
    this.timings.browserMs = Date.now() - began;
  }
}

function panelCookie(cookie: string, origin: string): { name: string; value: string; url: string } {
  const [name, value] = cookie.split("=", 2);
  if (!name || !value) throw new RunnerFailure("environment.missing", "FluxIQ panel cookie is malformed");
  return { name, value, url: origin };
}

async function requireFile(file: string, message: string): Promise<void> {
  try { await access(file); }
  catch (cause) { throw new RunnerFailure("environment.missing", message, { cause }); }
}

/** Whether `port` can be bound again: `false` only for the refusals a held port raises. */
async function portIsReleased(port: number): Promise<boolean> {
  return assertLoopbackPortBindable(port).then(() => true, (error: unknown) => {
    const code = (error as { cause?: { code?: unknown } })?.cause?.code;
    return code === "EADDRINUSE" || code === "EACCES" ? false : Promise.reject(error);
  });
}

/** A refused or reset connection, or a probe that timed out: the Scenario Lab is not listening yet. */
function isConnectionFailure(error: unknown): boolean {
  const code = (error as { cause?: { code?: unknown } })?.cause?.code;
  return code === "ECONNREFUSED" || code === "ECONNRESET" || (error as { name?: unknown })?.name === "TimeoutError";
}

/** `error` with a second labelled line naming `following`, or `error` unchanged when nothing followed. */
function withFollowingLine(error: unknown, following: unknown, label: string): unknown {
  if (following === undefined) return error;
  const line = `${label}: ${following instanceof Error ? following.message : String(following)}`;
  if (!(error instanceof Error)) return new Error(`${String(error)}\n${line}`, { cause: error });
  error.message = `${error.message}\n${line}`;
  return error;
}
