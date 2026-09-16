import { access, rm } from "node:fs/promises";
import path from "node:path";
import { allocatePersistentRun, allocateRun, type RunAllocation } from "./allocation.js";
import { coreWebServerProcessSpec, prepareCoreWebBuild } from "./core-web-build/index.js";
import { buildFluxIQEnvironment, buildScenarioEnvironment, webPanelHostModulePath } from "./environment.js";
import { RunnerFailure } from "./failure.js";
import { waitForHttp, type FluxIQCredentials } from "./http-control/index.js";
import { ExistingFluxIQControlClient } from "./existing-fluxiq-control.js";
import { executable, ProcessSupervisor, processLogPath } from "./process-supervisor.js";
import { randomBytes, randomInt } from "node:crypto";
import type { ExistingTargetConfiguration, FluxIQTargetConfiguration } from "./target-config.js";
import { acquireWorkspaceOperationLock, type WorkspaceOperationLock } from "./workspace-lock.js";
import { loadOrCreatePersistentIdentity } from "./persistent-identity.js";

export type TopologyOptions = {
  repositoryRoot: string;
  fluxiqRepositoryRoot: string;
  runsDirectory?: string;
  runId?: string;
  seed?: number;
  startupTimeoutMs?: number;
  credentials?: FluxIQCredentials;
  prepareHost?: boolean;
  signal?: AbortSignal;
  bootstrapIdentity?: boolean;
  target?: FluxIQTargetConfiguration;
  /** One Lab instance's compiled scenario lab server; defaults to the repository's own. */
  scenarioEntrypoint?: string;
  /** One Lab instance's copy of the web panel host; defaults to the path domain/package.json declares. */
  hostModulePath?: string;
  /**
   * Receives the run's logs directory when startup fails, after the run's
   * processes have stopped and before its run root is removed, so the caller
   * can keep the logs of a run that never produced a topology.
   */
  copyStartupFailureLogs?: (logsDirectory: string) => Promise<void>;
  /**
   * The runs directory whose `.core-web-build/` holds the Core web build every
   * mode shares. `lab run` passes its user-visible runs directory, because an
   * isolated topology's own runs directory is the per-run `.work` area.
   * Defaults to `runsDirectory`.
   */
  coreWebBuildRunsDirectory?: string;
};

export type RunningTopology = {
  allocation: RunAllocation;
  targetMode: "isolated" | "persistent-isolated" | "existing";
  scenarioOrigin: string;
  fluxiqOrigin: string;
  gatewayUrl?: string;
  control?: ExistingFluxIQControlClient;
  projectId?: string;
  authorizationPin?: string;
  /**
   * The account password this topology authenticated with, present only on a
   * topology that owns its Core. Installing a Secret Key is a credentialed
   * mutation in FluxIQ -- Core re-authorizes the session with the password and
   * PIN before it will encrypt one -- so a run that has to install a provider
   * key needs it. It is never written anywhere: an isolated run's is generated
   * per run and lives only in this process.
   */
  authorizationPassword?: string;
  processExitCodes(): Record<string, number | null>;
  close(): Promise<void>;
};

export type TopologyDependencies = { waitForHttp: typeof waitForHttp; prepareCoreWebBuild?: typeof prepareCoreWebBuild };
const defaultTopologyDependencies: TopologyDependencies = { waitForHttp };

export async function startTopology(options: TopologyOptions, supervisor = new ProcessSupervisor(), dependencies: TopologyDependencies = defaultTopologyDependencies): Promise<RunningTopology> {
  const repositoryRoot = path.resolve(options.repositoryRoot);
  const fluxiqRepositoryRoot = path.resolve(options.fluxiqRepositoryRoot);
  const target = options.target ?? { mode: "isolated" };
  const runsDirectory = options.runsDirectory ?? path.join(repositoryRoot, "test-runs");
  let persistentWorkspaceRoot: string | undefined;
  let allocation: RunAllocation;
  if (target.mode === "persistent-isolated") {
    const persistentAllocation = await allocatePersistentRun(runsDirectory, target.workspace, options.runId);
    allocation = persistentAllocation;
    persistentWorkspaceRoot = persistentAllocation.workspaceRoot;
  } else {
    allocation = await allocateRun(runsDirectory, options.runId);
  }
  if (target.mode === "existing") return startExistingTopology(options, target, allocation, repositoryRoot, supervisor, dependencies);
  let workspaceLock: WorkspaceOperationLock | undefined;
  try {
    if (target.mode === "persistent-isolated") {
      workspaceLock = await acquireWorkspaceOperationLock(persistentWorkspaceRoot!);
    }
    const targetCredentials = target.credentials ? { username: target.credentials.username, password: target.credentials.password, ...(target.credentials.authorizationPin ? { pin: target.credentials.authorizationPin } : {}), ...(target.credentials.totp ? { totp: target.credentials.totp } : {}) } : undefined;
    let credentials = options.credentials ?? targetCredentials;
    if (options.bootstrapIdentity) {
      if (target.mode === "persistent-isolated") {
        if (!credentials) {
          credentials = (await loadOrCreatePersistentIdentity(persistentWorkspaceRoot!, generateBootstrapCredentials)).credentials;
        }
        await ensureBootstrapIdentity(allocation.fluxiqRoot, credentials);
      } else if (!credentials) {
        credentials = await bootstrapIdentity(allocation.fluxiqRoot);
      }
    }
    const hostModulePath = options.hostModulePath ?? webPanelHostModulePath(repositoryRoot);
    const scenarioEntrypoint = options.scenarioEntrypoint ?? path.join(repositoryRoot, "apps", "scenario-lab", "dist", "server.js");
    const webPackage = path.join(fluxiqRepositoryRoot, "apps", "web", "package.json");
    await requirePaths([scenarioEntrypoint, webPackage], options.prepareHost === false ? [hostModulePath] : []);
    if (options.prepareHost !== false) {
      await supervisor.run({
        name: "host-build", command: executable("node"), args: [path.join(repositoryRoot, "domain", "scripts", "build-web-panel-host.mjs")],
        cwd: repositoryRoot, env: process.env, logPath: processLogPath(allocation.logsDir, "host-build"),
      });
    }
    await requirePaths([hostModulePath]);
    // Core serves a production build shared by every run and every mode below
    // one runs directory; a development server compiles on demand and waits on
    // its file watcher, which stalled readiness and first requests under load.
    const coreWebBuild = await (dependencies.prepareCoreWebBuild ?? prepareCoreWebBuild)({
      fluxiqRepositoryRoot, runsDirectory: options.coreWebBuildRunsDirectory ?? runsDirectory, supervisor, logPath: processLogPath(allocation.logsDir, "core-web-build"),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    supervisor.start({
      name: "scenario-lab", command: executable("node"), args: [scenarioEntrypoint], cwd: repositoryRoot,
      env: buildScenarioEnvironment(allocation, options.seed ?? 1), logPath: processLogPath(allocation.logsDir, "scenario-lab"),
    });
    const scenarioOrigin = `http://127.0.0.1:${allocation.scenarioPort}`;
    await dependencies.waitForHttp(`${scenarioOrigin}/__control/health`, {
      operationStage: "scenario.health",
      headers: { authorization: `Bearer ${allocation.controllerToken}` },
      ...(options.startupTimeoutMs === undefined ? {} : { timeoutMs: options.startupTimeoutMs }),
      ...(options.signal ? { signal: options.signal } : {}),
    });

    supervisor.start(coreWebServerProcessSpec({
      name: "fluxiq-web", build: coreWebBuild, port: allocation.webPort,
      env: buildFluxIQEnvironment(allocation, { repositoryRoot, fluxiqRepositoryRoot, hostModulePath }),
      logPath: processLogPath(allocation.logsDir, "core"),
    }));
    const fluxiqOrigin = `http://127.0.0.1:${allocation.webPort}`;
    await dependencies.waitForHttp(fluxiqOrigin, {
      operationStage: "core.health",
      ...(options.startupTimeoutMs === undefined ? {} : { timeoutMs: options.startupTimeoutMs }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    // Core creates its gateway lazily when an API route first requests the
    // FluxIQ runtime. An unauthenticated snapshot probe intentionally returns
    // 401, but still initializes the production gateway before TCP polling.
    await fetch(`${fluxiqOrigin}/api/client-gateway/snapshot`, options.signal ? { signal: options.signal } : {}).catch(() => undefined);
    await waitForTcpGateway(allocation.gatewayPort, options.startupTimeoutMs ?? 60_000, options.signal);

    let control: ExistingFluxIQControlClient | undefined;
    let projectId: string | undefined;
    if (credentials) {
      control = new ExistingFluxIQControlClient(fluxiqOrigin);
      await control.login(credentials);
      if (target.mode === "persistent-isolated") {
        const projectName = `Persistent E2E ${target.workspace}`;
        const matches = (await control.listProjects("web-automation")).filter(project => project.name === projectName && project.domainId === "web-automation");
        if (matches.length > 1) throw new RunnerFailure("environment.missing", "Persistent isolated workspace has more than one matching project");
        projectId = matches[0]?.id ?? await control.createProject({ name: projectName, description: "Persistent isolated automated test project", domainId: "web-automation", ...(credentials.pin ? { authorizationPin: credentials.pin } : {}) });
      } else {
        projectId = await control.createProject({ name: `E2E ${allocation.runId}`, description: "Disposable automated test project", domainId: "web-automation", ...(credentials.pin ? { authorizationPin: credentials.pin } : {}) });
      }
      await control.selectProject(projectId);
    }
    return {
      allocation, targetMode: target.mode === "persistent-isolated" ? "persistent-isolated" : "isolated", scenarioOrigin, fluxiqOrigin,
      gatewayUrl: `ws://127.0.0.1:${allocation.gatewayPort}/client`,
      ...(control ? { control } : {}), ...(projectId ? { projectId } : {}),
      ...(credentials?.pin ? { authorizationPin: credentials.pin } : {}),
      ...(credentials?.password ? { authorizationPassword: credentials.password } : {}),
      processExitCodes: () => supervisor.processExitCodes(),
      close: closeTopology(supervisor, workspaceLock),
    };
  } catch (error) {
    // Preserve the startup failure: cleanup is best-effort here and must not
    // replace the safe operation/category diagnostics the caller persists.
    // The stopped processes' logs reach the caller before the run root goes.
    await supervisor.cleanup().catch(() => undefined);
    if (options.copyStartupFailureLogs) await options.copyStartupFailureLogs(allocation.logsDir).catch(() => undefined);
    await removeAllocatedRunRoot(allocation).catch(() => undefined);
    await workspaceLock?.release().catch(() => undefined);
    throw error;
  }
}

function closeTopology(supervisor: ProcessSupervisor, workspaceLock?: WorkspaceOperationLock): () => Promise<void> {
  let closed = false;
  return async () => {
    if (closed) return;
    closed = true;
    try { await supervisor.cleanup(); }
    finally { await workspaceLock?.release(); }
  };
}

async function startExistingTopology(options: TopologyOptions, target: ExistingTargetConfiguration, allocation: RunAllocation, repositoryRoot: string, supervisor: ProcessSupervisor, dependencies: TopologyDependencies): Promise<RunningTopology> {
  try {
    if (options.credentials || options.bootstrapIdentity || options.prepareHost !== undefined) throw new RunnerFailure("environment.missing", "existing target cannot use isolated Core bootstrap, credentials, or host preparation options");
    const scenarioEntrypoint = options.scenarioEntrypoint ?? path.join(repositoryRoot, "apps", "scenario-lab", "dist", "server.js");
    await requirePaths([scenarioEntrypoint]);
    await dependencies.waitForHttp(target.baseUrl, {
      operationStage: "core.health",
      ...(options.startupTimeoutMs === undefined ? {} : { timeoutMs: options.startupTimeoutMs }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    supervisor.start({
      name: "scenario-lab", command: executable("node"), args: [scenarioEntrypoint], cwd: repositoryRoot,
      env: buildScenarioEnvironment(allocation, options.seed ?? 1), logPath: processLogPath(allocation.logsDir, "scenario-lab"),
    });
    const scenarioOrigin = `http://127.0.0.1:${allocation.scenarioPort}`;
    await dependencies.waitForHttp(`${scenarioOrigin}/__control/health`, {
      operationStage: "scenario.health",
      headers: { authorization: `Bearer ${allocation.controllerToken}` },
      ...(options.startupTimeoutMs === undefined ? {} : { timeoutMs: options.startupTimeoutMs }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    return {
      allocation,
      targetMode: "existing",
      scenarioOrigin,
      fluxiqOrigin: target.baseUrl,
      ...(target.gatewayUrl ? { gatewayUrl: target.gatewayUrl } : {}),
      projectId: target.projectId,
      authorizationPin: target.credentials.authorizationPin,
      processExitCodes: () => supervisor.processExitCodes(),
      close: () => supervisor.cleanup(),
    };
  } catch (error) {
    await supervisor.cleanup();
    if (options.copyStartupFailureLogs) await options.copyStartupFailureLogs(allocation.logsDir).catch(() => undefined);
    await removeAllocatedRunRoot(allocation);
    throw error;
  }
}

export async function removeRunOwnedTopologyState(topology: Pick<RunningTopology, "allocation">): Promise<void> {
  await removeAllocatedRunRoot(topology.allocation);
}

async function removeAllocatedRunRoot(allocation: Pick<RunAllocation, "runId" | "runRoot">): Promise<void> {
  const runRoot = path.resolve(allocation.runRoot);
  const expected = path.resolve(path.dirname(runRoot), allocation.runId);
  if (runRoot !== expected || path.basename(runRoot) !== allocation.runId) throw new RunnerFailure("process.startup", "Refused to remove a run directory outside its exact allocation");
  await rm(runRoot, { recursive: true, force: true });
}

async function bootstrapIdentity(rootDir: string) {
  const credentials = generateBootstrapCredentials();
  await ensureBootstrapIdentity(rootDir, credentials);
  return credentials;
}

function generateBootstrapCredentials() {
  return {
    username: `lab-${randomBytes(6).toString("hex")}`,
    password: `Lab-${randomBytes(24).toString("base64url")}!9`,
    pin: String(randomInt(100000, 1000000)),
  };
}

async function ensureBootstrapIdentity(rootDir: string, credentials: FluxIQCredentials): Promise<void> {
  const { FluxIQ } = await import("fluxiq");
  const fluxiq = FluxIQ.create({ rootDir, loadEnv: false });
  await fluxiq.setup();
  const snapshot = await fluxiq.programs.identityAccess.snapshot();
  const byId = snapshot.users.find(user => user.id === "lab-runner-admin");
  const byUsername = snapshot.users.find(user => user.username.toLowerCase() === credentials.username.toLowerCase());
  if (byId || byUsername) {
    if (byId?.username.toLowerCase() !== credentials.username.toLowerCase() || (byUsername && byUsername.id !== "lab-runner-admin")) {
      throw new RunnerFailure("environment.missing", "Persistent isolated workspace identity does not match its configured credentials");
    }
    try {
      await fluxiq.programs.identityAccess.authenticate({ username: credentials.username, password: credentials.password, ...(credentials.totp ? { totp: credentials.totp } : {}) });
    } catch (cause) {
      throw new RunnerFailure("environment.missing", "Persistent isolated workspace credentials no longer authenticate", { cause });
    }
    return;
  }
  await fluxiq.programs.identityAccess.upsertUser({
    id: "lab-runner-admin",
    username: credentials.username,
    displayName: "Lab Runner",
    roleId: "admin",
    password: credentials.password,
    ...(credentials.pin ? { pin: credentials.pin } : {}),
  });
}

export async function withTopology<T>(options: TopologyOptions, operation: (topology: RunningTopology, signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const supervisor = new ProcessSupervisor();
  let topology: RunningTopology | undefined;
  const onSignal = () => {
    controller.abort(new RunnerFailure("process.startup", "Run interrupted by process signal"));
    void supervisor.cleanup();
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  try {
    topology = await startTopology({ ...options, signal: controller.signal }, supervisor);
    return await operation(topology, controller.signal);
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    await topology?.close();
  }
}

async function requirePaths(required: string[], additionallyRequired: string[] = []): Promise<void> {
  for (const target of [...required, ...additionallyRequired]) {
    try { await access(target); }
    catch (cause) { throw new RunnerFailure("environment.missing", `Required test topology path is missing: ${target}`, { cause, details: { path: target } }); }
  }
}

async function waitForTcpGateway(port: number, timeoutMs: number, signal?: AbortSignal): Promise<void> {
  const { connect } = await import("node:net");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw signal.reason;
    const ready = await new Promise<boolean>(resolve => {
      const socket = connect({ host: "127.0.0.1", port });
      socket.once("connect", () => { socket.destroy(); resolve(true); });
      socket.once("error", () => resolve(false));
    });
    if (ready) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new RunnerFailure("gateway.connection", `Timed out waiting for client gateway on 127.0.0.1:${port}`, { details: { port, timeoutMs } });
}
