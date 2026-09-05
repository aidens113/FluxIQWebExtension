import { createServer } from "node:net";
import { lstat, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { hardenWindowsPrivatePath } from "./windows-acl.js";

export type RunAllocation = {
  runId: string;
  runRoot: string;
  fluxiqRoot: string;
  storageDir: string;
  browserProfileDir: string;
  coreWorkspaceDir: string;
  webWorkspaceDir: string;
  logsDir: string;
  scenarioPort: number;
  webPort: number;
  gatewayPort: number;
  controllerToken: string;
};

export type PersistentRunAllocation = RunAllocation & {
  workspaceName: string;
  workspaceRoot: string;
  sessionRoot: string;
};

const SAFE_WORKSPACE_NAME = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/u;
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|clock\$|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
const RESERVED_WORKSPACE_NAMES = new Set(["persistent-isolated", "sessions"]);

export async function allocateLoopbackPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to allocate a loopback port");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

export async function allocateRun(baseDir: string, requestedRunId?: string): Promise<RunAllocation> {
  const runId = requestedRunId ?? `run-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(runId)) throw new Error("Run ID must contain only letters, numbers, dot, underscore, and dash");
  const runRoot = path.resolve(baseDir, runId);
  const resolvedBase = path.resolve(baseDir);
  if (path.dirname(runRoot) !== resolvedBase) throw new Error("Run directory escaped its configured base");
  const fluxiqRoot = path.join(runRoot, "fluxiq-root");
  const storageDir = path.join(fluxiqRoot, ".fluxiq");
  const browserProfileDir = path.join(runRoot, "browser-profile");
  const coreWorkspaceDir = path.join(runRoot, "core-workspace");
  const webWorkspaceDir = path.join(coreWorkspaceDir, "apps", "web");
  const logsDir = path.join(runRoot, "logs");
  await mkdir(baseDir, { recursive: true });
  await mkdir(runRoot, { recursive: false });
  await mkdir(fluxiqRoot, { recursive: false });
  await Promise.all([storageDir, browserProfileDir, logsDir].map(directory => mkdir(directory, { recursive: false })));
  await mkdir(webWorkspaceDir, { recursive: true });
  const [scenarioPort, webPort, gatewayPort] = await allocateDistinctPorts(3);
  return {
    runId, runRoot, fluxiqRoot, storageDir, browserProfileDir, coreWorkspaceDir, webWorkspaceDir, logsDir,
    scenarioPort: scenarioPort!, webPort: webPort!, gatewayPort: gatewayPort!,
    controllerToken: randomBytes(32).toString("base64url"),
  };
}

/**
 * Allocates one disposable execution session inside a stable isolated workspace.
 * FluxIQ data and the browser profile are deliberately outside the session root,
 * so ordinary run cleanup cannot remove retained workspace state.
 */
export async function allocatePersistentRun(baseDir: string, workspaceName: string, requestedRunId?: string): Promise<PersistentRunAllocation> {
  validatePersistentWorkspaceName(workspaceName);
  const runId = requestedRunId ?? `run-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}`;
  validateRunId(runId);

  const resolvedBase = path.resolve(baseDir);
  const persistentRoot = directChild(resolvedBase, "persistent-isolated", "Persistent workspace root escaped its configured runs directory");
  const workspaceRoot = directChild(persistentRoot, workspaceName, "Persistent workspace escaped its configured root");
  const sessionsRoot = directChild(workspaceRoot, ".sessions", "Persistent sessions directory escaped its workspace");
  const sessionRoot = directChild(sessionsRoot, runId, "Persistent session escaped its workspace");
  const fluxiqRoot = directChild(workspaceRoot, "fluxiq-root", "Persistent FluxIQ root escaped its workspace");
  const storageDir = directChild(fluxiqRoot, ".fluxiq", "Persistent FluxIQ storage escaped its root");
  const browserProfileDir = directChild(workspaceRoot, "browser-profile", "Persistent browser profile escaped its workspace");
  const coreWorkspaceDir = directChild(sessionRoot, "core-workspace", "Core workspace escaped its session");
  const webWorkspaceDir = path.join(coreWorkspaceDir, "apps", "web");
  const logsDir = directChild(sessionRoot, "logs", "Logs directory escaped its session");

  await ensureOwnedDirectory(resolvedBase);
  await ensureOwnedDirectory(persistentRoot);
  await ensureOwnedDirectory(workspaceRoot);
  await hardenWindowsPrivatePath(workspaceRoot, "directory");
  await ensureOwnedDirectory(sessionsRoot);
  await ensureOwnedDirectory(fluxiqRoot);
  await ensureOwnedDirectory(storageDir);
  await ensureOwnedDirectory(browserProfileDir);
  for (const privateDirectory of [sessionsRoot, fluxiqRoot, storageDir, browserProfileDir]) {
    await hardenWindowsPrivatePath(privateDirectory, "directory");
  }
  let sessionCreated = false;
  try {
    await mkdir(sessionRoot, { recursive: false });
    sessionCreated = true;
    await Promise.all([logsDir, webWorkspaceDir].map(directory => mkdir(directory, { recursive: true })));

    const [scenarioPort, webPort, gatewayPort] = await allocateDistinctPorts(3);
    return {
      runId,
      runRoot: sessionRoot,
      fluxiqRoot,
      storageDir,
      browserProfileDir,
      coreWorkspaceDir,
      webWorkspaceDir,
      logsDir,
      scenarioPort: scenarioPort!,
      webPort: webPort!,
      gatewayPort: gatewayPort!,
      controllerToken: randomBytes(32).toString("base64url"),
      workspaceName,
      workspaceRoot,
      sessionRoot,
    };
  } catch (error) {
    if (sessionCreated) await rm(sessionRoot, { recursive: true, force: true });
    throw error;
  }
}

export function validatePersistentWorkspaceName(workspaceName: string): void {
  const normalized = workspaceName.toLowerCase();
  if (!SAFE_WORKSPACE_NAME.test(workspaceName)
    || workspaceName === "."
    || workspaceName === ".."
    || workspaceName.startsWith(".")
    || RESERVED_WORKSPACE_NAMES.has(normalized)
    || WINDOWS_DEVICE_NAME.test(workspaceName)) {
    throw new Error("Persistent workspace name must be a safe, non-reserved 1-64 character name");
  }
}

function validateRunId(runId: string): void {
  if (!/^[A-Za-z0-9._-]{1,128}$/u.test(runId) || runId === "." || runId === "..") {
    throw new Error("Run ID must contain only letters, numbers, dot, underscore, and dash");
  }
}

function directChild(parent: string, child: string, message: string): string {
  const resolved = path.resolve(parent, child);
  if (path.dirname(resolved) !== path.resolve(parent)) throw new Error(message);
  return resolved;
}

async function ensureOwnedDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  const details = await lstat(directory);
  if (!details.isDirectory() || details.isSymbolicLink()) {
    throw new Error(`Persistent allocation path is not a directly owned directory: ${directory}`);
  }
}

async function allocateDistinctPorts(count: number): Promise<number[]> {
  const ports = new Set<number>();
  while (ports.size < count) ports.add(await allocateLoopbackPort());
  return [...ports];
}
