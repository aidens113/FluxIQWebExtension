import { createServer, type Server } from "node:net";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
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
  /**
   * Whether `scenarioPort` is the port the workspace had already recorded.
   * `false` on a workspace's first invocation, and whenever the recorded port
   * could not be bound and a new one was recorded in its place: a Flow saved
   * against the previous address then no longer reaches the fixture.
   */
  scenarioPortRetained: boolean;
};

const SAFE_WORKSPACE_NAME = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/u;
const WINDOWS_DEVICE_NAME = /^(?:con|prn|aux|nul|clock\$|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
const RESERVED_WORKSPACE_NAMES = new Set(["persistent-isolated", "sessions"]);

export async function allocateLoopbackPort(): Promise<number> {
  const server = await listenOnLoopback();
  const port = portOf(server);
  await closeServer(server);
  return port;
}

/** Fail before topology startup when a caller pins a loopback port this host cannot bind. */
export async function assertLoopbackPortBindable(port: number, label = "Loopback port"): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error(`${label} must be an integer from 1 to 65535`);
  let server: Server;
  try {
    server = await listenOnLoopback(port);
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException)?.code;
    throw new Error(`${label} ${port} cannot be bound on 127.0.0.1${code ? ` (${code})` : ""}`, { cause });
  }
  await closeServer(server);
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
  const scenarioPortPath = directChild(workspaceRoot, "scenario-port.json", "Persistent scenario port record escaped its workspace");

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

    const { scenarioPort, webPort, gatewayPort, scenarioPortRetained } = await allocateWorkspacePorts(scenarioPortPath);
    return {
      runId,
      runRoot: sessionRoot,
      fluxiqRoot,
      storageDir,
      browserProfileDir,
      coreWorkspaceDir,
      webWorkspaceDir,
      logsDir,
      scenarioPort,
      webPort,
      gatewayPort,
      controllerToken: randomBytes(32).toString("base64url"),
      workspaceName,
      workspaceRoot,
      sessionRoot,
      scenarioPortRetained,
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

/**
 * Every probe socket is held open until all of them have a port, so the kernel
 * itself guarantees the run's ports differ. Between the last close here and the
 * moment a child binds, a concurrent Lab instance could in principle be handed
 * the same ephemeral port; the OS hands them out on a rotating cursor, so that
 * is rare, and it surfaces as a startup failure rather than silent overlap.
 */
async function allocateDistinctPorts(count: number): Promise<number[]> {
  const servers: Server[] = [];
  try {
    for (let index = 0; index < count; index += 1) servers.push(await listenOnLoopback());
    return servers.map(server => portOf(server));
  } finally {
    await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  }
}

/**
 * A persistent workspace's ports, its Scenario Lab port kept from one
 * invocation to the next.
 *
 * A Flow saved in the workspace goes to an absolute address: a created Flow's
 * first node is a `web.browser.navigate` whose `url` is the page the build
 * explored, port included (`domain/src/output-nodes/payloads.ts`). Serving the
 * fixture on a fresh port each invocation sent every later run of that Flow to
 * a closed port, so nothing saved in a workspace could be replayed. A real
 * site keeps its address between runs, and the workspace's fixture now does
 * too: the port is recorded in `scenario-port.json` the first time and bound
 * again after that, the demo workspace's rule (`demo-workspace/scenario-lab.ts`).
 * The FluxIQ web and gateway ports stay fresh, as nothing saved names them.
 *
 * A recorded port another process now holds is replaced rather than failing
 * the invocation, and `scenarioPortRetained` says so.
 */
async function allocateWorkspacePorts(portPath: string): Promise<{ scenarioPort: number; webPort: number; gatewayPort: number; scenarioPortRetained: boolean }> {
  const recorded = await readRecordedScenarioPort(portPath);
  const servers: Server[] = [];
  try {
    const retained = recorded === undefined ? undefined : await listenOnLoopback(recorded).catch(portUnavailable);
    servers.push(retained ?? await listenOnLoopback(), await listenOnLoopback(), await listenOnLoopback());
    const [scenarioPort, webPort, gatewayPort] = servers.map(server => portOf(server)) as [number, number, number];
    if (!retained) await writeRecordedScenarioPort(portPath, scenarioPort);
    return { scenarioPort, webPort, gatewayPort, scenarioPortRetained: retained !== undefined };
  } finally {
    await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  }
}

/** The recorded port, `undefined` when none is recorded. A record that is not one this module writes fails closed. */
async function readRecordedScenarioPort(portPath: string): Promise<number | undefined> {
  let text: string;
  try { text = await readFile(portPath, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return undefined;
    throw error;
  }
  const parsed = JSON.parse(text) as { schemaVersion?: unknown; port?: unknown };
  if (parsed.schemaVersion !== "0.1" || !Number.isInteger(parsed.port) || Number(parsed.port) < 1024 || Number(parsed.port) > 65_535) {
    throw new Error("The persistent workspace's scenario-port.json is not a valid port record");
  }
  return Number(parsed.port);
}

/** Written beside the record and renamed over it, so a reader never sees half a record. */
async function writeRecordedScenarioPort(portPath: string, port: number): Promise<void> {
  const temporary = `${portPath}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify({ schemaVersion: "0.1", port }, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await hardenWindowsPrivatePath(temporary, "file");
    await rename(temporary, portPath);
  } catch (error) {
    await rm(temporary, { force: true }).catch(/* best-effort: the failed write's own error is the one reported */ () => undefined);
    throw error;
  }
}

/** A recorded port another process now holds, or one this user may not bind, is absent; any other failure is not. */
function portUnavailable(error: unknown): undefined {
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === "EADDRINUSE" || code === "EACCES") return undefined;
  throw error;
}

async function listenOnLoopback(port = 0): Promise<Server> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  return server;
}

function portOf(server: Server): number {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to allocate a loopback port");
  return address.port;
}

function closeServer(server: Server): Promise<void> {
  return new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
