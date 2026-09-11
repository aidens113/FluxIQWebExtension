// The persistent FluxIQ core the demo lanes run against: its identity, its
// gateway, and the authenticated control client every lane starts from.
import { randomBytes } from "node:crypto";
import { access, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { allocateLoopbackPort } from "../allocation.js";
import { WebPanelAuthSessionCache } from "../auth-session.js";
import { ExistingFluxIQControlClient } from "../existing-fluxiq-control.js";
import { prepareWebWorkspace } from "../coordinator.js";
import { buildFluxIQEnvironment } from "../environment.js";
import { RunnerFailure } from "../failure.js";
import { waitForHttp } from "../http-control.js";
import { executable, processLogPath, ProcessSupervisor } from "../process-supervisor.js";
import { requireSecureGatewayUrl } from "../target-config.js";
import { hardenWindowsPrivatePath } from "../windows-acl.js";
import { type DemoWorkspaceConfiguration, explicitPort } from "./configuration.js";

export async function withPersistentDemoCore<T>(config: DemoWorkspaceConfiguration, operation: () => Promise<T>): Promise<T> {
  const sessionId = `run-${new Date().toISOString().replace(/[:.]/gu, "-")}-${randomBytes(4).toString("hex")}`;
  const sessionsDirectory = path.join(config.workspaceDirectory, process.platform === "win32" ? ".s" : ".sessions");
  const sessionDirectoryName = process.platform === "win32" ? randomBytes(6).toString("hex") : sessionId;
  const sessionDirectory = path.join(sessionsDirectory, sessionDirectoryName);
  const coreWorkspaceDirectory = path.join(sessionDirectory, process.platform === "win32" ? "c" : "core-workspace");
  const webWorkspaceDirectory = process.platform === "win32"
    ? path.join(coreWorkspaceDirectory, "a", "w")
    : path.join(coreWorkspaceDirectory, "apps", "web");
  const logsDirectory = path.join(config.workspaceDirectory, "logs");
  const hostModulePath = path.join(config.repositoryRoot, "domain", "dist", "host", "web-panel-host.cjs");
  const webPort = explicitPort(config.origin, "FLUXIQ_DEMO_BASE_URL");
  const gatewayPort = explicitPort(config.gatewayUrl, "FLUXIQ_DEMO_GATEWAY_URL");
  if (webPort === gatewayPort) throw new Error("FLUXIQ_DEMO_BASE_URL and FLUXIQ_DEMO_GATEWAY_URL must use different ports");

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
  try {
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
    const nextExecutable = await prepareWebWorkspace(config.fluxiqRepositoryRoot, webWorkspaceDirectory);
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
    supervisor.start({
      name: "demo-fluxiq-web",
      command: nextExecutable,
      args: ["dev", "--turbopack", "--hostname", "127.0.0.1", "--port", String(webPort)],
      cwd: webWorkspaceDirectory,
      shell: process.platform === "win32",
      env: buildFluxIQEnvironment(allocation, {
        repositoryRoot: config.repositoryRoot,
        fluxiqRepositoryRoot: config.fluxiqRepositoryRoot,
        hostModulePath,
      }),
      logPath: processLogPath(logsDirectory, `${sessionId}-core`),
    });
    await waitForHttp(config.origin, { timeoutMs: 60_000 });
    await fetch(`${config.origin}/api/client-gateway/snapshot`, { signal: AbortSignal.timeout(30_000) }).catch(() => undefined);
    await waitForTcpGateway(gatewayPort, 60_000);
    return await operation();
  } finally {
    try { await supervisor.cleanup(); }
    finally {
      const expected = path.join(sessionsDirectory, sessionDirectoryName);
      if (path.resolve(sessionDirectory) !== path.resolve(expected) || path.dirname(path.resolve(sessionDirectory)) !== path.resolve(sessionsDirectory)) {
        throw new Error("Refused to remove a demo session outside its workspace");
      }
      await rm(sessionDirectory, { recursive: true, force: true });
    }
  }
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
