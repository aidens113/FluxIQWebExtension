import { access, cp, mkdir, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { allocatePersistentRun, allocateRun, type RunAllocation } from "./allocation.js";
import { buildFluxIQEnvironment, buildScenarioEnvironment, webPanelHostModulePath } from "./environment.js";
import { RunnerFailure } from "./failure.js";
import { waitForHttp, type FluxIQCredentials } from "./http-control.js";
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
  processExitCodes(): Record<string, number | null>;
  close(): Promise<void>;
};

export type TopologyDependencies = { waitForHttp: typeof waitForHttp };
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
    const hostModulePath = webPanelHostModulePath(repositoryRoot);
    const scenarioEntrypoint = path.join(repositoryRoot, "apps", "scenario-lab", "dist", "server.js");
    const webPackage = path.join(fluxiqRepositoryRoot, "apps", "web", "package.json");
    await requirePaths([scenarioEntrypoint, webPackage], options.prepareHost === false ? [hostModulePath] : []);
    if (options.prepareHost !== false) {
      await supervisor.run({
        name: "host-build", command: executable("node"), args: [path.join(repositoryRoot, "domain", "scripts", "build-web-panel-host.mjs")],
        cwd: repositoryRoot, env: process.env, logPath: processLogPath(allocation.logsDir, "host-build"),
      });
    }
    await requirePaths([hostModulePath]);
    const nextExecutable = await prepareWebWorkspace(fluxiqRepositoryRoot, allocation.webWorkspaceDir);
    supervisor.start({
      name: "scenario-lab", command: executable("node"), args: [scenarioEntrypoint], cwd: repositoryRoot,
      env: buildScenarioEnvironment(allocation, options.seed ?? 1), logPath: processLogPath(allocation.logsDir, "scenario-lab"),
    });
    const scenarioOrigin = `http://127.0.0.1:${allocation.scenarioPort}`;
    await dependencies.waitForHttp(`${scenarioOrigin}/__control/health`, {
      headers: { authorization: `Bearer ${allocation.controllerToken}` },
      ...(options.startupTimeoutMs === undefined ? {} : { timeoutMs: options.startupTimeoutMs }),
      ...(options.signal ? { signal: options.signal } : {}),
    });

    supervisor.start({
      name: "fluxiq-web", command: nextExecutable,
      args: ["dev", "--turbopack", "--hostname", "127.0.0.1", "--port", String(allocation.webPort)],
      cwd: allocation.webWorkspaceDir,
      shell: process.platform === "win32",
      env: buildFluxIQEnvironment(allocation, { repositoryRoot, fluxiqRepositoryRoot, hostModulePath }),
      logPath: processLogPath(allocation.logsDir, "core"),
    });
    const fluxiqOrigin = `http://127.0.0.1:${allocation.webPort}`;
    await dependencies.waitForHttp(fluxiqOrigin, {
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
      processExitCodes: () => supervisor.processExitCodes(),
      close: closeTopology(supervisor, workspaceLock),
    };
  } catch (error) {
    await supervisor.cleanup();
    await removeAllocatedRunRoot(allocation);
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
    const scenarioEntrypoint = path.join(repositoryRoot, "apps", "scenario-lab", "dist", "server.js");
    await requirePaths([scenarioEntrypoint]);
    await dependencies.waitForHttp(target.baseUrl, {
      ...(options.startupTimeoutMs === undefined ? {} : { timeoutMs: options.startupTimeoutMs }),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    supervisor.start({
      name: "scenario-lab", command: executable("node"), args: [scenarioEntrypoint], cwd: repositoryRoot,
      env: buildScenarioEnvironment(allocation, options.seed ?? 1), logPath: processLogPath(allocation.logsDir, "scenario-lab"),
    });
    const scenarioOrigin = `http://127.0.0.1:${allocation.scenarioPort}`;
    await dependencies.waitForHttp(`${scenarioOrigin}/__control/health`, {
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

export async function prepareWebWorkspace(fluxiqRepositoryRoot: string, target: string): Promise<string> {
  const source = path.join(fluxiqRepositoryRoot, "apps", "web");
  const sourceNodeModules = path.join(source, "node_modules");
  const isolatedCoreRoot = path.resolve(target, "..", "..");
  await requirePaths([sourceNodeModules, path.join(fluxiqRepositoryRoot, "tsconfig.base.json"), path.join(fluxiqRepositoryRoot, "packages")]);
  await cp(source, target, {
    recursive: true,
    force: false,
    filter: candidate => ![".next", "node_modules", "playwright-report", "test-results", "next.config.ts"].includes(path.basename(candidate)),
  });
  const targetNodeModules = path.join(target, "node_modules");
  await mirrorNodeModules(sourceNodeModules, targetNodeModules);
  const rootNodeTypes = path.join(fluxiqRepositoryRoot, "node_modules", "@types", "node");
  await requirePaths([rootNodeTypes]);
  await mkdir(path.join(targetNodeModules, "@types"), { recursive: true });
  await symlink(await realpath(rootNodeTypes), path.join(targetNodeModules, "@types", "node"), process.platform === "win32" ? "junction" : "dir");
  await cp(path.join(fluxiqRepositoryRoot, "tsconfig.base.json"), path.join(isolatedCoreRoot, "tsconfig.base.json"));
  await symlink(path.join(fluxiqRepositoryRoot, "packages"), path.join(isolatedCoreRoot, "packages"), process.platform === "win32" ? "junction" : "dir");
  const commonFilesystemRoot = path.parse(path.resolve(fluxiqRepositoryRoot)).root;
  await writeFile(path.join(target, "next.config.mjs"), [
    "export default {",
    '  transpilePackages: ["fluxiq"],',
    `  turbopack: { root: ${JSON.stringify(commonFilesystemRoot)} },`,
    "};",
    "",
  ].join("\n"), "utf8");
  return path.join(sourceNodeModules, ".bin", process.platform === "win32" ? "next.cmd" : "next");
}

async function mirrorNodeModules(source: string, target: string): Promise<void> {
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.name.startsWith("@") && entry.isDirectory()) {
      const sourceScope = path.join(source, entry.name);
      const targetScope = path.join(target, entry.name);
      await mkdir(targetScope, { recursive: true });
      for (const scoped of await readdir(sourceScope)) {
        await symlink(await realpath(path.join(sourceScope, scoped)), path.join(targetScope, scoped), process.platform === "win32" ? "junction" : "dir");
      }
      continue;
    }
    await symlink(await realpath(path.join(source, entry.name)), path.join(target, entry.name), process.platform === "win32" ? "junction" : "dir");
  }
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
