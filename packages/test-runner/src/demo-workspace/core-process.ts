// The persistent FluxIQ core the demo lanes run against: its identity, its
// gateway, and the authenticated control client every lane starts from.
import { randomBytes } from "node:crypto";
import { access, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { allocateLoopbackPort, assertLoopbackPortBindable } from "../allocation.js";
import { WebPanelAuthSessionCache } from "../auth-session.js";
import { coreWebServerProcessSpec, prepareCoreWebBuild } from "../core-web-build/index.js";
import { ExistingFluxIQControlClient } from "../existing-fluxiq-control.js";
import { buildFluxIQEnvironment, webPanelHostModulePath } from "../environment.js";
import { RunnerFailure } from "../failure.js";
import { waitForHttp } from "../http-control/index.js";
import { executable, processLogPath, ProcessSupervisor } from "../process-supervisor.js";
import { requireSecureGatewayUrl } from "../target-config.js";
import { hardenWindowsPrivatePath } from "../windows-acl.js";
import { type DemoWorkspaceConfiguration, explicitPort } from "./configuration.js";

/** One running demo Core: the session it was started in, the ports it holds, and the way to stop it. */
export type RunningDemoCore = {
  readonly sessionId: string;
  readonly webPort: number;
  readonly gatewayPort: number;
  /**
   * Stops the Core tree, then removes its session directory. A removal failure
   * after a stop failure is appended to the stop's error rather than replacing
   * it. Every call after the first returns the first call's promise.
   */
  stop(): Promise<void>;
};

export type DemoCoreStartOptions = {
  /**
   * Skip the web panel host build, the domain setup and the identity check. Set
   * only by a caller that already started a Core on this configuration in this
   * process, so the files those steps write are known to be in place; a restart
   * then costs the Core launch alone.
   */
  reusePreparedWorkspace?: boolean;
};

/**
 * Starts the demo Core on the configuration's own ports and returns once its
 * panel answers HTTP and its client gateway accepts a TCP connection. A start
 * that fails part-way stops what it launched and removes its session before
 * the failure is thrown, so a caller only ever holds a Core that is up.
 */
export async function startPersistentDemoCore(config: DemoWorkspaceConfiguration, options: DemoCoreStartOptions = {}): Promise<RunningDemoCore> {
  const sessionId = `run-${new Date().toISOString().replace(/[:.]/gu, "-")}-${randomBytes(4).toString("hex")}`;
  const sessionsDirectory = path.join(config.workspaceDirectory, process.platform === "win32" ? ".s" : ".sessions");
  const sessionDirectoryName = process.platform === "win32" ? randomBytes(6).toString("hex") : sessionId;
  const sessionDirectory = path.join(sessionsDirectory, sessionDirectoryName);
  const coreWorkspaceDirectory = path.join(sessionDirectory, process.platform === "win32" ? "c" : "core-workspace");
  const webWorkspaceDirectory = process.platform === "win32"
    ? path.join(coreWorkspaceDirectory, "a", "w")
    : path.join(coreWorkspaceDirectory, "apps", "web");
  const logsDirectory = path.join(config.workspaceDirectory, "logs");
  const hostModulePath = webPanelHostModulePath(config.repositoryRoot);
  const webPort = explicitPort(config.origin, "FLUXIQ_DEMO_BASE_URL");
  const gatewayPort = explicitPort(config.gatewayUrl, "FLUXIQ_DEMO_GATEWAY_URL");
  if (webPort === gatewayPort) throw new Error("FLUXIQ_DEMO_BASE_URL and FLUXIQ_DEMO_GATEWAY_URL must use different ports");
  await assertLoopbackPortBindable(webPort, "FLUXIQ_DEMO_BASE_URL");
  await assertLoopbackPortBindable(gatewayPort, "FLUXIQ_DEMO_GATEWAY_URL");

  await requirePaths([
    path.join(config.fluxiqRepositoryRoot, "apps", "web", "package.json"),
    path.join(config.fluxiqRepositoryRoot, "apps", "web", "node_modules"),
  ]);
  await mkdir(config.fluxiqRoot, { recursive: true, mode: 0o700 });
  await mkdir(config.storageDirectory, { recursive: true, mode: 0o700 });
  await mkdir(sessionsDirectory, { recursive: true, mode: 0o700 });
  await mkdir(webWorkspaceDirectory, { recursive: true, mode: 0o700 });
  if (process.platform === "win32") {
    for (const directory of [config.fluxiqRoot, config.storageDirectory, sessionsDirectory]) {
      await hardenWindowsPrivatePath(directory, "directory");
    }
  }

  const supervisor = new ProcessSupervisor();
  // Stop the Core tree, then remove the session. A failure after an earlier one
  // is appended as a labelled line instead of replacing it: an EBUSY on the
  // removal used to hide the lane's own error.
  let stopping: Promise<void> | undefined;
  const stop = () => stopping ??= runThenCleanUp(() => supervisor.cleanup(), () => removeDemoSession(sessionsDirectory, sessionDirectoryName), "Demo session removal also failed");
  try {
    if (!options.reusePreparedWorkspace) {
      await supervisor.run({
        name: "demo-host-build",
        command: executable("node"),
        args: [path.join(config.repositoryRoot, "domain", "scripts", "build-web-panel-host.mjs")],
        cwd: config.repositoryRoot,
        env: process.env,
        logPath: processLogPath(logsDirectory, `${sessionId}-host-build`),
      });
      await supervisor.run({
        name: "demo-domain-setup",
        command: executable("node"),
        args: [path.join(config.repositoryRoot, "domain", "scripts", "setup-fluxiq.mjs")],
        cwd: config.repositoryRoot,
        env: { ...process.env, FLUXIQ_WEB_AUTOMATION_ROOT: config.fluxiqRoot },
        logPath: processLogPath(logsDirectory, `${sessionId}-domain-setup`),
      });
      await ensureDemoIdentity(config);
    }
    const coreWebBuild = await prepareCoreWebBuild({
      fluxiqRepositoryRoot: config.fluxiqRepositoryRoot,
      supervisor,
      logPath: processLogPath(logsDirectory, `${sessionId}-core-web-build`),
    });
    const scenarioPort = await allocateLoopbackPort();
    const allocation = {
      runId: sessionId,
      runRoot: sessionDirectory,
      fluxiqRoot: config.fluxiqRoot,
      storageDir: config.storageDirectory,
      browserProfileDir: path.join(config.workspaceDirectory, "browser-profile-isolated"),
      coreWorkspaceDir: coreWorkspaceDirectory,
      webWorkspaceDir: webWorkspaceDirectory,
      logsDir: logsDirectory,
      scenarioPort,
      webPort,
      gatewayPort,
      controllerToken: randomBytes(32).toString("base64url"),
    };
    supervisor.start(coreWebServerProcessSpec({
      name: "demo-fluxiq-web",
      build: coreWebBuild,
      port: webPort,
      env: buildFluxIQEnvironment(allocation, {
        repositoryRoot: config.repositoryRoot,
        fluxiqRepositoryRoot: config.fluxiqRepositoryRoot,
        hostModulePath,
      }),
      logPath: processLogPath(logsDirectory, `${sessionId}-core`),
    }));
    await waitForHttp(config.origin, { timeoutMs: 60_000 });
    await fetch(`${config.origin}/api/client-gateway/snapshot`, { signal: AbortSignal.timeout(30_000) }).catch(() => undefined);
    await waitForTcpGateway(gatewayPort, 60_000);
  } catch (startError) {
    try { await stop(); }
    catch (cleanupError) { throw withFollowingFailure(startError, cleanupError, "Demo session cleanup also failed"); }
    throw startError;
  }
  return { sessionId, webPort, gatewayPort, stop };
}

/** Runs `operation` against a demo Core started for it, and always stops that Core afterwards. */
export async function withPersistentDemoCore<T>(config: DemoWorkspaceConfiguration, operation: () => Promise<T>): Promise<T> {
  const core = await startPersistentDemoCore(config);
  return runThenCleanUp(operation, () => core.stop());
}

/** The removal errors Windows raises while a just-stopped process tree still releases its handles. */
const RETRIED_REMOVAL_CODES = new Set(["EBUSY", "EPERM", "ENOTEMPTY"]);

/**
 * Runs `operation`, then always `cleanUp`. When both fail, the operation's own
 * error is thrown with the cleanup failure appended as a second line under
 * `label`; when only the cleanup fails, its error is the failure.
 */
export async function runThenCleanUp<T>(operation: () => Promise<T>, cleanUp: () => Promise<void>, label = "Demo session cleanup also failed"): Promise<T> {
  let value: T;
  try {
    value = await operation();
  } catch (operationError) {
    try { await cleanUp(); }
    catch (cleanupError) { throw withFollowingFailure(operationError, cleanupError, label); }
    throw operationError;
  }
  await cleanUp();
  return value;
}

/**
 * Removes one demo session directory, retrying what Windows refuses while the
 * stopped Core tree still holds handles. `rm` unlinks a junction rather than
 * descending into it, so the pinned Core the session's junctions point at is
 * never touched; the junction row in `tests/core-process.test.ts` holds that.
 */
export async function removeDemoSession(sessionsDirectory: string, sessionDirectoryName: string, options: { remove?: (target: string) => Promise<void>; attempts?: number; retryDelayMs?: number } = {}): Promise<void> {
  const sessionDirectory = path.resolve(sessionsDirectory, sessionDirectoryName);
  if (path.dirname(sessionDirectory) !== path.resolve(sessionsDirectory)) {
    throw new Error("Refused to remove a demo session outside its workspace");
  }
  const remove = options.remove ?? ((target: string) => rm(target, { recursive: true, force: true }));
  const attempts = options.attempts ?? 8;
  const retryDelayMs = options.retryDelayMs ?? 250;
  for (let attempt = 1; ; attempt += 1) {
    try {
      await remove(sessionDirectory);
      return;
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (attempt >= attempts || !RETRIED_REMOVAL_CODES.has(code)) throw error;
      await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
    }
  }
}

function withFollowingFailure(first: unknown, following: unknown, label: string): unknown {
  const line = `${label}: ${following instanceof Error ? following.message : String(following)}`;
  if (!(first instanceof Error)) return new Error(`${String(first)}\n${line}`, { cause: first });
  const message = first.message;
  try {
    first.message = `${message}\n${line}`;
    const stack = first.stack;
    const at = message.length > 0 && stack !== undefined ? stack.indexOf(message) : -1;
    if (stack !== undefined && at >= 0 && !stack.includes(line)) {
      first.stack = `${stack.slice(0, at + message.length)}\n${line}${stack.slice(at + message.length)}`;
    }
  } catch {
    return new Error(`${message}\n${line}`, { cause: first });
  }
  return first;
}

export async function ensureDemoIdentity(config: DemoWorkspaceConfiguration): Promise<void> {
  const { FluxIQ } = await import("fluxiq");
  const fluxiq = FluxIQ.create({ rootDir: config.fluxiqRoot, loadEnv: false });
  await fluxiq.setup();
  const snapshot = await fluxiq.programs.identityAccess.snapshot();
  const id = "web-extension-demo-runner";
  const byId = snapshot.users.find(user => user.id === id);
  const byUsername = snapshot.users.find(user => user.username.toLowerCase() === config.username.toLowerCase());
  if (byId || byUsername) {
    if (byId?.username.toLowerCase() !== config.username.toLowerCase() || (byUsername && byUsername.id !== id)) {
      throw new RunnerFailure("environment.missing", "Persistent demo identity does not match its configured username");
    }
    try {
      await fluxiq.programs.identityAccess.authenticate({
        username: config.username,
        password: config.password,
        ...(config.totp ? { totp: config.totp } : {}),
      });
    } catch (cause) {
      throw new RunnerFailure("environment.missing", "Persistent demo credentials no longer authenticate; rotate them with pnpm demo:setup-local -- --force", { cause });
    }
    return;
  }
  await fluxiq.programs.identityAccess.upsertUser({
    id,
    username: config.username,
    displayName: "Web Extension Demo Runner",
    roleId: "admin",
    enabled: true,
    password: config.password,
    pin: config.pin,
  });
}

export async function waitForTcpGateway(port: number, timeoutMs: number): Promise<void> {
  const { connect } = await import("node:net");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await new Promise<boolean>(resolve => {
      const socket = connect({ host: "127.0.0.1", port });
      socket.once("connect", () => { socket.destroy(); resolve(true); });
      socket.once("error", () => resolve(false));
    });
    if (ready) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new RunnerFailure("gateway.connection", `Timed out waiting for demo client gateway on 127.0.0.1:${port}`);
}

export async function requirePaths(targets: string[]): Promise<void> {
  for (const target of targets) {
    try { await access(target); }
    catch (cause) { throw new RunnerFailure("environment.missing", `Required demo topology path is missing: ${target}`, { cause }); }
  }
}

export async function authenticatedControl(config: DemoWorkspaceConfiguration): Promise<{ control: ExistingFluxIQControlClient; gatewayUrl: string; panelCookie: string }> {
  const control = new ExistingFluxIQControlClient(config.origin);
  const sessionCache = new WebPanelAuthSessionCache(config.runsDirectory);
  await control.login(
    {
      username: config.username,
      password: config.password,
      pin: config.pin,
      ...(config.totp ? { totp: config.totp } : {}),
    },
    // Each managed demo Core process has a fresh in-memory secret-key unlock.
    // A durable cookie can outlive that process, so establish one fresh login
    // after startup before any LLM grant is requested.
    { sessionCache, freshLogin: true },
  );
  await control.validateCurrentSession(config.username);
  const gateway = await control.gatewayDiscovery();
  const gatewayUrl = config.gatewayUrl ?? gateway.publicUrl;
  if (!gateway.enabled || !gateway.listening || !gatewayUrl) {
    throw new RunnerFailure("gateway.connection", "FluxIQ client gateway is not enabled, listening, and discoverable");
  }
  const cached = await sessionCache.load({ origin: config.origin, username: config.username }, () => true);
  if (!cached.session) throw new RunnerFailure("environment.missing", "Authenticated FluxIQ panel session was not cached");
  return { control, gatewayUrl: requireSecureGatewayUrl(gatewayUrl), panelCookie: cached.session.cookie };
}
